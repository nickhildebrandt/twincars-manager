import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { env } from '$env/dynamic/private'

let migrationsApplied = false

/**
 * Apply pending Drizzle migrations once during server startup.
 * Subsequent calls are no-ops.
 */
export async function runMigrations(): Promise<void> {
  if (migrationsApplied) return
  const databaseUrl =
    env.DATABASE_URL ??
    'postgres://admin:TwinCars2026!@localhost:5432/twincars-manager'
  const migrationClient = postgres(databaseUrl, { max: 1 })
  try {
    await migrate(drizzle(migrationClient), { migrationsFolder: './drizzle' })
    migrationsApplied = true
  } finally {
    await migrationClient.end()
  }
}
