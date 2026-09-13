/**
 * Shared helpers for the test database. Used by the per-worker setup file and
 * by `scripts/test-db.mjs`.
 *
 * Strategy (../../../docs/rewrite/05-teststrategie.md §3): one template
 * database carries the migrated schema, every Vitest worker gets its own copy.
 * Copying a template is a file copy in PostgreSQL and takes milliseconds.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import type { Sql } from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { connectionOptionsForDatabase } from '../../server/utils/connection.ts'

/** Prefix for everything this module creates, so cleanup can be exact. */
const PREFIX = 'twincars_test'
export const TEMPLATE_DATABASE = `${PREFIX}_template`
export const workerDatabase = (worker: string | number) => `${PREFIX}_w${worker}`

/** Advisory lock id, so parallel workers build the template only once. */
const TEMPLATE_LOCK = 828_141

const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../server/database/migrations', import.meta.url),
)

/** Reads `.env.test` without overwriting values that are already set. */
export function loadTestEnv(): void {
  const envFile = fileURLToPath(new URL('../../.env.test', import.meta.url))
  if (!existsSync(envFile)) return
  for (const rawLine of readFileSync(envFile, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    if (process.env[key] === undefined) process.env[key] = line.slice(eq + 1).trim()
  }
}

/**
 * Connection options for one database.
 *
 * postgres.js accepts a unix socket only through the options object, not
 * through the `?host=/path` form that libpq understands — so the URL is parsed
 * here and translated. TCP connection strings are passed through unchanged
 * apart from the database name.
 */
export function connectionOptions(database: string) {
  return connectionOptionsForDatabase(process.env.DATABASE_URL ?? '', database, {
    max: 1,
    connection: { application_name: 'twincars-test' },
  })
}

/** Connection to one database. */
export const sqlFor = (database: string): Sql => postgres(connectionOptions(database))

/**
 * Connection used for CREATE/DROP DATABASE. Those statements cannot run inside
 * a transaction and must not target the database being copied, so this
 * connects to a maintenance database instead.
 */
export function adminSql(): Sql {
  return sqlFor(process.env.PGTEST_MAINTENANCE_DB ?? 'template1')
}

const databaseExists = async (sql: Sql, database: string): Promise<boolean> => {
  const rows = await sql`SELECT 1 FROM pg_database WHERE datname = ${database}`
  return rows.length > 0
}

/** CREATE DATABASE ... TEMPLATE fails while anyone is connected to the source. */
async function terminateConnections(sql: Sql, database: string): Promise<void> {
  await sql`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = ${database} AND pid <> pg_backend_pid()
  `
}

/**
 * Creates the template and applies the migrations, exactly once even when
 * several workers start at the same moment. The advisory lock serialises them.
 */
export async function ensureTemplateDatabase(sql: Sql): Promise<boolean> {
  await sql`SELECT pg_advisory_lock(${TEMPLATE_LOCK})`
  try {
    if (await databaseExists(sql, TEMPLATE_DATABASE)) return false
    await sql.unsafe(`CREATE DATABASE "${TEMPLATE_DATABASE}"`)
    await applyMigrations(TEMPLATE_DATABASE)
    return true
  }
  finally {
    await sql`SELECT pg_advisory_unlock(${TEMPLATE_LOCK})`
  }
}

/**
 * Drops the database the end-to-end project builds against.
 *
 * The baseline is written to be repeatable, so applying it to an existing
 * database adds nothing — a new column stays missing and the built server
 * fails on a query nobody changed. During the rewrite the baseline moves
 * often, so a reset has to take this one with it.
 */
export async function dropBaseDatabase(sql: Sql, database: string): Promise<void> {
  if (database === 'postgres' || database === 'template1') return
  await terminateConnections(sql, database)
  await sql.unsafe(`DROP DATABASE IF EXISTS "${database}"`)
}

/** Drops the template, e.g. to force a rebuild after a schema change. */
export async function dropTemplateDatabase(sql: Sql): Promise<void> {
  await terminateConnections(sql, TEMPLATE_DATABASE)
  await sql.unsafe(`DROP DATABASE IF EXISTS "${TEMPLATE_DATABASE}"`)
}

/** Removes every per-worker database left over from an earlier run. */
export async function dropWorkerDatabases(sql: Sql): Promise<number> {
  const rows = await sql<{ datname: string }[]>`
    SELECT datname FROM pg_database WHERE datname LIKE ${`${PREFIX}_w%`}
  `
  for (const row of rows) {
    await terminateConnections(sql, row.datname)
    await sql.unsafe(`DROP DATABASE IF EXISTS "${row.datname}"`)
  }
  return rows.length
}

/**
 * Copies the template into a fresh database for one worker. Dropping first
 * makes a re-run deterministic even if a previous run crashed.
 */
export async function createWorkerDatabase(
  sql: Sql,
  worker: string | number,
): Promise<string> {
  const name = workerDatabase(worker)
  await terminateConnections(sql, name)
  await sql.unsafe(`DROP DATABASE IF EXISTS "${name}"`)
  await terminateConnections(sql, TEMPLATE_DATABASE)
  await sql.unsafe(`CREATE DATABASE "${name}" TEMPLATE "${TEMPLATE_DATABASE}"`)
  return name
}

/**
 * Makes sure a named database exists and carries the current schema.
 *
 * The end-to-end project starts a real production build, which connects to the
 * database named in `DATABASE_URL` rather than to a per-worker copy. That
 * database has to exist, or the health check answers 503 and every flow fails
 * for a reason that has nothing to do with the flow.
 */
export async function ensureDatabase(sql: Sql, database: string): Promise<boolean> {
  await sql`SELECT pg_advisory_lock(${TEMPLATE_LOCK})`
  try {
    const created = !(await databaseExists(sql, database))
    if (created) await sql.unsafe(`CREATE DATABASE "${database}"`)
    await applyMigrations(database)
    return created
  }
  finally {
    await sql`SELECT pg_advisory_unlock(${TEMPLATE_LOCK})`
  }
}

/** The database name inside a connection string. */
export function databaseNameOf(url: string): string {
  const path = /^[a-z+]+:\/\/[^/]*\/([^?]*)/.exec(url)?.[1] ?? ''
  return decodeURIComponent(path) || 'postgres'
}

/**
 * Applies the migrations with the SAME runner production uses, so the template
 * ends up byte-identical to a freshly deployed database — including Drizzle's
 * journal table.
 */
export async function applyMigrations(database: string): Promise<number> {
  if (!existsSync(MIGRATIONS_DIR)) return 0
  const files = readdirSync(MIGRATIONS_DIR).filter(name => name.endsWith('.sql'))
  if (files.length === 0) return 0

  const sql = sqlFor(database)
  try {
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_DIR })
  }
  finally {
    await sql.end({ timeout: 5 })
  }
  return files.length
}
