/**
 * Applies pending migrations. This is the ONLY place that changes the schema.
 *
 * Migrations never run inside the request lifecycle: the container calls this
 * before the server starts, so the application can never serve requests
 * against a half-migrated database
 * (../docs/rewrite/03-architektur.md §7.2).
 *
 *   node scripts/migrate.mjs
 */
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { connectionOptionsFrom } from '../server/utils/connection.ts'
import { loadEnv } from './load-env.mjs'

if (loadEnv(['DATABASE_URL']).length > 0) {
  console.error('DATABASE_URL fehlt. Weder in der Umgebung noch in nuxt/.env.')
  process.exit(1)
}

const url = process.env.DATABASE_URL

const folder = fileURLToPath(new URL('../server/database/migrations', import.meta.url))

// `max: 1` because migrations must run in a single, ordered session.
const sql = postgres(connectionOptionsFrom(url, { max: 1 }))

try {
  await migrate(drizzle(sql), { migrationsFolder: folder })
  console.log('Migrationen angewendet.')
}
catch (error) {
  console.error('Migration fehlgeschlagen:', error instanceof Error ? error.message : error)
  process.exitCode = 1
}
finally {
  await sql.end({ timeout: 5 })
}
