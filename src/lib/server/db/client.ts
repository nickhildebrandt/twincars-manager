import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '$env/dynamic/private'
import * as schema from './schema'

const databaseUrl =
  env.DATABASE_URL ??
  'postgres://admin:TwinCars2026!@localhost:5432/twincars-manager'

const queryClient = postgres(databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10
})

/**
 * Drizzle client connected to the configured PostgreSQL database.
 * Use this for all server-side data access.
 */
export const db = drizzle(queryClient, { schema })

export { schema }
