import { describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { testDatabaseOptions, worker } from '../setup/db-per-worker'

describe('Worker-Isolation', () => {
  it('arbeitet auf der Datenbank des eigenen Workers', async () => {
    const sql = postgres(testDatabaseOptions())
    try {
      const [row] = await sql<{ db: string }[]>`SELECT current_database() AS db`
      expect(row.db).toBe(`twincars_test_w${worker}`)
    }
    finally {
      await sql.end({ timeout: 5 })
    }
  })

  it('sieht keine Tabelle eines anderen Workers', async () => {
    const sql = postgres(testDatabaseOptions())
    try {
      const table = `probe_w${worker}`
      await sql.unsafe(`CREATE TABLE IF NOT EXISTS ${table} (id serial primary key)`)
      const rows = await sql<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name LIKE 'probe_w%'
      `
      expect(rows.map(r => r.table_name)).toEqual([table])
    }
    finally {
      await sql.end({ timeout: 5 })
    }
  })
})
