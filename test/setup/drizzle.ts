/**
 * A Drizzle instance on this worker's database.
 *
 * It goes through `createDatabase` from `server/utils/db.ts`, so a test talks
 * to the database through exactly the client the server uses — same schema,
 * same casing. A second, hand-rolled client here would be the place where the
 * two quietly drift apart.
 */
import { createDatabase } from '../../server/utils/db.ts'
import { testDatabaseOptions } from './db-per-worker'

/** Opens a client. The caller closes it in `afterAll`. */
export function openTestDatabase() {
  const { client, db } = createDatabase(testDatabaseOptions())
  return { db, close: () => client.end({ timeout: 5 }) }
}

export type TestDatabase = ReturnType<typeof openTestDatabase>['db']
