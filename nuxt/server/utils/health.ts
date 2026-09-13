/**
 * The liveness check, separated from its endpoint so it can be exercised
 * against a real database — including the case where the database is gone.
 */
import { sql } from 'drizzle-orm'
import type { Executor } from './db.ts'

export type Health = {
  status: 'ok'
  database: 'ok'
  latencyMs: number
}

/**
 * Asks the database the cheapest possible question.
 *
 * Throws when it cannot answer. The caller turns that into a 503 with a plain
 * sentence — the reason stays in the log, because this runs behind a public
 * endpoint and a connection error names hosts and users.
 */
export async function checkHealth(executor: Executor): Promise<Health> {
  const startedAt = Date.now()
  await executor.execute(sql`SELECT 1`)
  return { status: 'ok', database: 'ok', latencyMs: Date.now() - startedAt }
}
