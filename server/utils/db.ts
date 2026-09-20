/**
 * The database connection and the transaction helper.
 *
 * The predecessor had no transactions at all — every multi-step write could
 * leave half of its work behind. That is the cause of several findings
 * (number gaps, half-written cancellations, orphaned rows), so
 * `withTransaction` is mandatory as soon as more than one statement writes
 * (../../docs/rewrite/03-architektur.md §5.2, §7.4).
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../database/schema/index.ts'
import { connectionOptionsFrom } from './connection.ts'

let client: postgres.Sql | undefined
let database: ReturnType<typeof drizzle<typeof schema>> | undefined

/**
 * Opens a client and wraps it in Drizzle.
 *
 * Takes the connection options rather than reading them, so tests and scripts
 * open the very same client the server opens instead of building a second one
 * that might differ in casing or schema.
 */
export function createDatabase(options: postgres.Options<Record<string, never>>) {
  const sql = postgres(options)
  return { client: sql, db: drizzle(sql, { schema, casing: 'snake_case' }) }
}

/** Lazily opened connection pool, shared by the whole server process. */
export function useDatabase() {
  if (!database) {
    // Mapped from DATABASE_URL in nuxt.config.ts. This is the only place the
    // application turns configuration into a connection.
    const opened = createDatabase(connectionOptionsFrom(useRuntimeConfig().databaseUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    }))
    client = opened.client
    database = opened.db
  }
  return database
}

/** Closes the pool. Used by tests and by a graceful shutdown. */
export async function closeDatabase(): Promise<void> {
  await client?.end({ timeout: 5 })
  client = undefined
  database = undefined
}

/** The connection pool, typed. */
export type Database = ReturnType<typeof useDatabase>

/** A transaction handle, as `withTransaction` hands it to the callback. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

/**
 * Anything that can run a statement.
 *
 * Helpers take this instead of reaching for the pool themselves, so the caller
 * decides whether the work joins an open transaction. Allocating a document
 * number outside the transaction that writes the document is how the
 * predecessor produced gaps in the invoice numbering (B-304).
 */
export type Executor = Database | Transaction

/**
 * Runs the callback inside one transaction. Anything that throws rolls the
 * whole thing back.
 *
 *   await withTransaction(async (tx) => {
 *     const number = await allocateNumber(tx, 'invoice')
 *     await tx.insert(documents).values({ ...input, documentNumber: number })
 *   })
 */
export function withTransaction<T>(run: (tx: Transaction) => Promise<T>): Promise<T> {
  return useDatabase().transaction(run)
}

export { schema }
