/**
 * The end-to-end project starts a real production build, and that build
 * connects to the database named in `DATABASE_URL` — not to a per-worker copy.
 * This makes sure the database exists and carries the current schema before
 * the first request arrives.
 */
import { beforeAll } from 'vitest'
import { adminSql, databaseNameOf, ensureDatabase } from './database-helpers'

beforeAll(async () => {
  const name = databaseNameOf(process.env.DATABASE_URL ?? '')
  const admin = adminSql()
  try {
    await ensureDatabase(admin, name)
  }
  finally {
    await admin.end({ timeout: 5 })
  }
}, 120_000)
