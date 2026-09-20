/**
 * Writes the default content into the database. Idempotent — running it again
 * changes nothing and never overwrites an operator's edit.
 *
 *   node scripts/seed.mjs
 *
 * Runs after the migrations, never inside a request.
 */
import process from 'node:process'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { connectionOptionsFrom } from '../server/utils/connection.ts'
import * as schema from '../server/database/schema/index.ts'
import { seedDefaults } from '../server/database/seed/index.ts'
import { loadEnv } from './load-env.mjs'

if (loadEnv(['DATABASE_URL']).length > 0) {
  console.error('DATABASE_URL fehlt. Weder in der Umgebung noch in nuxt/.env.')
  process.exit(1)
}

const url = process.env.DATABASE_URL

const sql = postgres(connectionOptionsFrom(url, { max: 1 }))
try {
  const report = await seedDefaults(drizzle(sql, { schema, casing: 'snake_case' }))
  const written = Object.entries(report).filter(([, count]) => count > 0)
  console.log(
    written.length === 0
      ? 'Alle Vorgaben waren bereits vorhanden.'
      : `Angelegt: ${written.map(([name, count]) => `${name} ${count}`).join(', ')}.`,
  )
}
catch (error) {
  console.error('Seeding fehlgeschlagen:', error instanceof Error ? error.message : error)
  process.exitCode = 1
}
finally {
  await sql.end({ timeout: 5 })
}
