/**
 * The database connection and the transaction helper.
 *
 * The predecessor had no transactions at all — every multi-step write could
 * leave half of its work behind. That is the cause of several findings
 * (number gaps, half-written cancellations, orphaned rows), so
 * `withTransaction` is mandatory as soon as more than one statement writes
 * (../../../docs/rewrite/03-architektur.md §5.2, §7.4).
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../database/schema/index.ts'
import { connectionOptionsFrom } from './connection.ts'

let client: postgres.Sql | undefined
let database: ReturnType<typeof drizzle<typeof schema>> | undefined

/** Lazily opened connection pool, shared by the whole server process. */
export function useDatabase() {
  if (!database) {
    // Mapped from DATABASE_URL in nuxt.config.ts. Scripts and tests build
    // their own connection instead of going through the Nuxt runtime.
    const url = useRuntimeConfig().databaseUrl
    client = postgres(connectionOptionsFrom(url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    }))
    database = drizzle(client, { schema, casing: 'snake_case' })
  }
  return database
}

/** Closes the pool. Used by tests and by a graceful shutdown. */
export async function closeDatabase(): Promise<void> {
  await client?.end({ timeout: 5 })
  client = undefined
  database = undefined
}

/**
 * Runs the callback inside one transaction. Anything that throws rolls the
 * whole thing back.
 *
 *   await withTransaction(async (tx) => {
 *     const number = await allocateNumber(tx, 'invoice')
 *     await tx.insert(documents).values({ ...input, documentNumber: number })
 *   })
 */
export function withTransaction<T>(
  run: (tx: Parameters<Parameters<ReturnType<typeof useDatabase>['transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  return useDatabase().transaction(run)
}

export { schema }
