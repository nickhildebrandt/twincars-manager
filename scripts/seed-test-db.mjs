#!/usr/bin/env node
/**
 * Reset the database behind DATABASE_URL to the committed, anonymized
 * E2E baseline (`e2e/fixtures/seed.sql.gz`).
 *
 * What it does, in order:
 *   1. Safety gate — refuses to touch a non-local database unless
 *      FORCE_SEED=1 is set explicitly.
 *   2. Drops every table in schema `public` plus the `drizzle`
 *      migration schema (only objects the connecting role owns; no
 *      `DROP OWNED BY`, which would also revoke grants).
 *   3. Restores the fixture with `psql` in a single transaction. The
 *      dump is a full schema+data snapshot (`pg_dump --no-owner`), so
 *      no migration run is needed to make it usable …
 *   4. … but `scripts/migrate.js` runs afterwards anyway: it applies
 *      any migrations added since the fixture was generated (they are
 *      idempotent by project convention), keeping an older fixture
 *      forward-compatible.
 *
 * The result is deterministic: a completed setup, the admin account
 * `e2eadmin` / `e2e-passwort-123`, seeded defaults and an anonymized
 * subset of the legacy Kfz-Kaufmann data. Regenerating the fixture is
 * `scripts/generate-test-seed.mjs` (see docs/operations/test-database.md).
 *
 * Requirements: `psql` on the PATH; DATABASE_URL in the environment
 * (falls back to reading it from ./.env like the dev server does).
 *
 * Usage:
 *   node scripts/seed-test-db.mjs
 *   FORCE_SEED=1 DATABASE_URL=postgres://… node scripts/seed-test-db.mjs
 */

import { spawn, spawnSync } from 'node:child_process'
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { createGunzip } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURE = join(ROOT, 'e2e', 'fixtures', 'seed.sql.gz')

/** Minimal .env fallback so `node scripts/…` works like `pnpm dev`. */
const readDotEnv = (key) => {
  try {
    const content = readFileSync(join(ROOT, '.env'), 'utf8')
    const line = content
      .split('\n')
      .find((l) => l.startsWith(`${key}=`) && !l.trimStart().startsWith('#'))
    return line ? line.slice(key.length + 1).trim() : undefined
  } catch {
    return undefined
  }
}

const databaseUrl = process.env.DATABASE_URL ?? readDotEnv('DATABASE_URL')
if (!databaseUrl) {
  console.error('[seed] DATABASE_URL is not set (env or ./.env). Aborting.')
  process.exit(1)
}

/* 1 ── Safety gate: local databases only, unless FORCE_SEED=1. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', ''])
let host
try {
  host = new URL(databaseUrl).hostname
} catch {
  console.error('[seed] DATABASE_URL is not a valid URL. Aborting.')
  process.exit(1)
}
if (!LOCAL_HOSTS.has(host) && process.env.FORCE_SEED !== '1') {
  console.error(
    `[seed] Refusing to reset non-local database host "${host}".\n` +
      '[seed] Set FORCE_SEED=1 if you really mean it.'
  )
  process.exit(1)
}

if (!existsSync(FIXTURE)) {
  console.error(`[seed] Fixture not found: ${FIXTURE}`)
  console.error(
    '[seed] Generate it with scripts/generate-test-seed.mjs (needs the local MDB).'
  )
  process.exit(1)
}

/** Notices (cascades, IF-NOT-EXISTS skips) are expected — keep quiet. */
const QUIET_ENV = {
  ...process.env,
  PGOPTIONS: '-c client_min_messages=warning'
}

const psql = (args, options = {}) =>
  spawnSync('psql', [databaseUrl, '-X', '-v', 'ON_ERROR_STOP=1', ...args], {
    stdio: ['pipe', 'inherit', 'inherit'],
    env: QUIET_ENV,
    ...options
  })

const started = Date.now()

/* 2 ── Drop all public tables + the drizzle migration schema.
 * Deliberately NOT `DROP OWNED BY current_user` — that would also
 * revoke privileges granted to the role (e.g. CREATE on schema public
 * in a scratch database owned by someone else). */
const RESET_SQL = `
DO $reset$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
  END LOOP;
END
$reset$;
DROP SCHEMA IF EXISTS drizzle CASCADE;
`

console.log('[seed] Dropping existing tables …')
const reset = psql(['-q'], { input: RESET_SQL })
if (reset.status !== 0) {
  console.error('[seed] Reset failed. Aborting.')
  process.exit(1)
}

/* 3 ── Restore the gzipped dump through psql (single transaction). */
console.log('[seed] Restoring e2e/fixtures/seed.sql.gz …')
const restore = spawn(
  'psql',
  [
    databaseUrl,
    '-X',
    '-q',
    '-o',
    '/dev/null',
    '-v',
    'ON_ERROR_STOP=1',
    '--single-transaction'
  ],
  { stdio: ['pipe', 'inherit', 'inherit'], env: QUIET_ENV }
)
const restoreExit = new Promise((resolve) => restore.on('close', resolve))
createReadStream(FIXTURE).pipe(createGunzip()).pipe(restore.stdin)
if ((await restoreExit) !== 0) {
  console.error('[seed] Restore failed. Aborting.')
  process.exit(1)
}

/* 4 ── Apply migrations newer than the fixture (idempotent). */
console.log('[seed] Applying pending migrations …')
const migrate = spawnSync(process.execPath, ['scripts/migrate.js'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...QUIET_ENV, DATABASE_URL: databaseUrl }
})
if (migrate.status !== 0) {
  console.error('[seed] Migration top-up failed. Aborting.')
  process.exit(1)
}

/* Summary. */
const summary = spawnSync(
  'psql',
  [
    databaseUrl,
    '-X',
    '-At',
    '-c',
    `SELECT 'customers: ' || count(*) FROM customers
     UNION ALL SELECT 'vehicles: ' || count(*) FROM vehicles
     UNION ALL SELECT 'documents: ' || count(*) FROM documents
     UNION ALL SELECT 'document_items: ' || count(*) FROM document_items
     UNION ALL SELECT 'users: ' || count(*) FROM users`
  ],
  { encoding: 'utf8' }
)
if (summary.status === 0) {
  for (const line of summary.stdout.trim().split('\n')) {
    console.log(`[seed]   ${line}`)
  }
}
console.log(
  `[seed] Done in ${((Date.now() - started) / 1000).toFixed(1)}s. ` +
    'Admin login: e2eadmin / e2e-passwort-123'
)
