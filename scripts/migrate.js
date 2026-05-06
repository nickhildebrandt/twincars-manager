#!/usr/bin/env node
/**
 * Production migration runner. Applies all pending Drizzle SQL
 * migrations from `./drizzle` and exits.
 *
 * Run before the application server starts. The container entrypoint
 * is `node scripts/migrate.js && node build` — if migration fails the
 * `&&` short-circuits and the app never starts.
 *
 * Why a separate script (and not in `hooks.server.ts`)?
 *   - Single responsibility for the SvelteKit process: serve HTTP.
 *   - Migrations finish *before* the app accepts traffic, so the
 *     first request is never racing against schema changes.
 *   - `drizzle-kit` (devDependency) is not required in production —
 *     this script uses the runtime migrator from `drizzle-orm`,
 *     which is already a runtime dependency.
 *
 * Operational discipline:
 *   - Database backups are NOT handled here. Backups are an
 *     operations concern (host / Postgres layer). Always snapshot
 *     before deploying a new image with new migrations.
 *   - Generated SQL migrations are committed to the repo. This
 *     script never writes migrations, only applies them.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error(
    '[migrate] DATABASE_URL is not set. Refusing to run migrations.'
  )
  process.exit(1)
}

console.log('[migrate] Running database migrations…')

const client = postgres(databaseUrl, { max: 1 })
try {
  await migrate(drizzle(client), { migrationsFolder: './drizzle' })
  console.log('[migrate] Database migrations completed.')
} catch (err) {
  console.error('[migrate] Database migration failed.')
  // Do not log the connection string. The error from postgres.js
  // already includes the failing SQL and Postgres SQLSTATE — that's
  // enough context to diagnose without leaking credentials.
  console.error(err)
  process.exit(1)
} finally {
  await client.end({ timeout: 5 })
}
