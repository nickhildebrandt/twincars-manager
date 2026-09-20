/**
 * The end-to-end project starts a real production build, and that build
 * connects to the database named in `DATABASE_URL` — not to a per-worker copy.
 * This makes sure the database exists and carries the current schema before
 * the first request arrives.
 */
import postgres from 'postgres'
import { beforeAll } from 'vitest'
import { adminSql, connectionOptions, databaseNameOf, ensureDatabase } from './database-helpers'

beforeAll(async () => {
  const name = databaseNameOf(process.env.DATABASE_URL ?? '')
  const admin = adminSql()
  try {
    await ensureDatabase(admin, name)
  }
  finally {
    await admin.end({ timeout: 5 })
  }

  /**
   * Die Einrichtung als abgeschlossen markieren.
   *
   * Seit T-010 leitet das Setup-Tor **jeden** Weg auf den Assistenten um,
   * solange `setup_completed` falsch ist. Genau das soll es (B-001) — und
   * genau deshalb kämen die Tests hier sonst nie an einer Seite an.
   *
   * Der Assistent selbst wird in `test/e2e/setup.test.ts` geprüft, gegen eine
   * Datenbank, in der er **nicht** abgeschlossen ist. Hier geht es um die
   * Anwendung danach.
   */
  const sql = postgres(connectionOptions(name))
  try {
    await sql`
      INSERT INTO company_settings (company_name, street, zip, city, email, setup_completed)
      VALUES ('TwinCars Test', 'Teststraße 1', '89073', 'Ulm', 'test@twincars.local', true)
      ON CONFLICT ((true)) DO UPDATE SET setup_completed = true
    `
  }
  finally {
    await sql.end({ timeout: 5 })
  }
}, 120_000)
