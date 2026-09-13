/**
 * Gives every Vitest worker its own database, copied from a template that
 * carries the migrated schema.
 *
 * This lives in the integration project's `setupFiles` rather than in a root
 * `globalSetup`, so that the unit, nuxt and browser projects never need a
 * running PostgreSQL.
 */
import { afterAll, beforeAll } from 'vitest'
import {
  adminSql,
  connectionOptions,
  createWorkerDatabase,
  ensureTemplateDatabase,
  workerDatabase,
} from './database-helpers'

const worker = process.env.VITEST_WORKER_ID ?? '1'

/** One provisioning run per worker process, shared by all its test files. */
let provisioning: Promise<string> | undefined

async function provision(): Promise<string> {
  const admin = adminSql()
  try {
    await ensureTemplateDatabase(admin)
    return await createWorkerDatabase(admin, worker)
  }
  finally {
    await admin.end({ timeout: 5 })
  }
}

beforeAll(async () => {
  provisioning ??= provision()
  const name = await provisioning
  process.env.TEST_DATABASE = name
}, 60_000)

afterAll(() => {
  // The worker database is kept so a failed run can be inspected.
  // `pnpm test:db:reset` removes the leftovers.
})

/** Connection options for the database of the current worker. */
export const testDatabaseOptions = () =>
  connectionOptions(process.env.TEST_DATABASE ?? workerDatabase(worker))

export { worker }
