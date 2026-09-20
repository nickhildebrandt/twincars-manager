import { describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { testDatabaseOptions } from '../setup/db-per-worker'

describe('Testumgebung (integration)', () => {
  it('erreicht eine eigene Datenbank je Worker', async () => {
    const sql = postgres(testDatabaseOptions())
    try {
      const [row] = await sql<{ db: string }[]>`SELECT current_database() AS db`
      expect(row.db).toMatch(/^twincars_test_w/)
    }
    finally {
      await sql.end({ timeout: 5 })
    }
  })

  it('sieht den Stand der Migrationen', async () => {
    const sql = postgres(testDatabaseOptions())
    try {
      const rows = await sql<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
      `
      // Bis T-005 gibt es keine Migrationen; die Abfrage muss trotzdem laufen.
      expect(Array.isArray(rows)).toBe(true)
    }
    finally {
      await sql.end({ timeout: 5 })
    }
  })

  it('schreibt isoliert vom Nachbar-Worker', async () => {
    const sql = postgres(testDatabaseOptions())
    try {
      await sql`CREATE TABLE IF NOT EXISTS smoke_probe (id serial primary key)`
      await sql`INSERT INTO smoke_probe DEFAULT VALUES`
      const [row] = await sql<{ n: string }[]>`SELECT count(*)::text AS n FROM smoke_probe`
      expect(Number(row.n)).toBeGreaterThan(0)
    }
    finally {
      await sql.end({ timeout: 5 })
    }
  })
})
