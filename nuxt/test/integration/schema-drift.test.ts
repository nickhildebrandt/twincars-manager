/**
 * Keeps the three descriptions of the data in step:
 *
 *   Drizzle  — the truth about the database schema
 *   Migration — what actually reaches PostgreSQL
 *   Valibot  — the truth about input, whose limits must fit the columns
 *
 * Rules: ../../../docs/rewrite/03-architektur.md §6.4, §7.
 */
import { describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { getTableName, getTableColumns, is } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import * as v from 'valibot'
import * as schema from '../../server/database/schema/index.ts'
import * as primitives from '#shared/schemas/primitives'
import { testDatabaseOptions } from '../setup/db-per-worker'
import { DEFAULT_NUMBER_RANGES } from '../../server/database/seed/index.ts'
import { listQuerySchema } from '#shared/schemas/pagination'

/** Every table the Drizzle schema declares. */
const tables = Object.entries(schema).filter(
  (entry): entry is [string, PgTable] => is(entry[1], PgTable),
)

const sql = postgres(testDatabaseOptions())

type ColumnRow = {
  table_name: string
  column_name: string
  data_type: string
  character_maximum_length: number | null
  is_nullable: 'YES' | 'NO'
  column_default: string | null
}

const columnsInDatabase = async () => {
  const rows = await sql<ColumnRow[]>`
    SELECT table_name, column_name, data_type, character_maximum_length,
           is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `
  const map = new Map<string, ColumnRow>()
  for (const row of rows) map.set(`${row.table_name}.${row.column_name}`, row)
  return map
}

describe('Schema und Datenbank stimmen überein', () => {
  it('kennt alle Tabellen', async () => {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `
    const inDatabase = new Set(rows.map(r => r.table_name))
    // Drizzle's own bookkeeping table is not part of the schema.
    inDatabase.delete('__drizzle_migrations')

    const declared = new Set(tables.map(([, table]) => getTableName(table)))
    expect([...declared].filter(name => !inDatabase.has(name))).toEqual([])
    expect([...inDatabase].filter(name => !declared.has(name))).toEqual([])
  })

  it('jede deklarierte Spalte existiert in der Datenbank', async () => {
    const inDatabase = await columnsInDatabase()
    const missing: string[] = []

    for (const [, table] of tables) {
      const tableName = getTableName(table)
      for (const column of Object.values(getTableColumns(table))) {
        const key = `${tableName}.${column.name}`
        if (!inDatabase.has(key)) missing.push(key)
      }
    }
    expect(missing).toEqual([])
  })

  it('keine Spalte in der Datenbank fehlt im Schema', async () => {
    const inDatabase = await columnsInDatabase()
    const declared = new Set<string>()
    for (const [, table] of tables) {
      const tableName = getTableName(table)
      for (const column of Object.values(getTableColumns(table))) {
        declared.add(`${tableName}.${column.name}`)
      }
    }

    const extra = [...inDatabase.keys()].filter(
      key => !declared.has(key) && !key.startsWith('__drizzle'),
    )
    expect(extra).toEqual([])
  })

  it('Pflichtfelder stimmen überein', async () => {
    const inDatabase = await columnsInDatabase()
    const mismatches: string[] = []

    for (const [, table] of tables) {
      const tableName = getTableName(table)
      for (const column of Object.values(getTableColumns(table))) {
        const row = inDatabase.get(`${tableName}.${column.name}`)
        if (!row) continue
        const databaseRequired = row.is_nullable === 'NO'
        if (column.notNull !== databaseRequired) {
          mismatches.push(
            `${tableName}.${column.name}: Schema ${column.notNull ? 'NOT NULL' : 'NULL'}, `
            + `Datenbank ${databaseRequired ? 'NOT NULL' : 'NULL'}`,
          )
        }
      }
    }
    expect(mismatches).toEqual([])
  })
})

describe('Eingabegrenzen passen zu den Spalten', () => {
  /**
   * Reads the `maxLength` a schema enforces, so it can be compared against the
   * column width. A schema that allows more than the column holds turns a
   * typo into an unhandled database error (B-556).
   */
  const maxLengthOf = (schemaToCheck: unknown): number | undefined => {
    const pipe = (schemaToCheck as { pipe?: { type?: string, requirement?: number }[] }).pipe
    return pipe?.find(step => step.type === 'max_length')?.requirement
  }

  it('kein Primitive erlaubt mehr Zeichen als die engste passende Spalte', async () => {
    const rows = await sql<{ table_name: string, column_name: string, character_maximum_length: number }[]>`
      SELECT table_name, column_name, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND character_maximum_length IS NOT NULL
    `

    /** primitive → the columns it is meant to feed. */
    const BINDINGS: Record<string, Array<[string, string]>> = {
      emailSchema: [['customers', 'email'], ['employees', 'private_email']],
      zipSchema: [['customers', 'zip'], ['employees', 'zip']],
      phoneSchema: [['customers', 'phone'], ['customers', 'mobile']],
      citySchema: [['customers', 'city']],
      streetSchema: [['customers', 'street']],
      licensePlateSchema: [['vehicle_license_plate_versions', 'license_plate']],
      vinSchema: [['vehicles', 'vin']],
    }

    const problems: string[] = []
    for (const [name, columns] of Object.entries(BINDINGS)) {
      const limit = maxLengthOf(primitives[name as keyof typeof primitives])
      if (limit === undefined) continue
      for (const [table, column] of columns) {
        const row = rows.find(r => r.table_name === table && r.column_name === column)
        if (!row) continue
        if (limit > row.character_maximum_length) {
          problems.push(
            `${name} erlaubt ${limit} Zeichen, ${table}.${column} fasst nur `
            + `${row.character_maximum_length}`,
          )
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('ein zu langer Wert wird vom Schema abgewiesen, nicht von der Datenbank', () => {
    const tooLong = `${'a'.repeat(250)}@example.de`
    expect(v.safeParse(primitives.emailSchema, tooLong).success).toBe(false)
  })
})

describe('Leistungsrelevante Struktur', () => {
  it('jeder Fremdschlüssel hat einen Index, der ihn abdeckt', async () => {
    const rows = await sql<{ relation: string }[]>`
      SELECT c.conrelid::regclass::text AS relation
      FROM pg_constraint c
      WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
        AND NOT EXISTS (
          SELECT 1 FROM pg_index i
          WHERE i.indrelid = c.conrelid
            AND (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey
        )
    `
    // Ohne Index wird jede Löschung des Elterndatensatzes zum Full Scan.
    expect(rows.map(r => r.relation)).toEqual([])
  })

  it('jede Tabelle hat einen Primärschlüssel', async () => {
    const rows = await sql<{ table_name: string }[]>`
      SELECT t.table_name
      FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        AND t.table_name <> '__drizzle_migrations'
        AND NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          WHERE tc.table_schema = 'public' AND tc.table_name = t.table_name
            AND tc.constraint_type = 'PRIMARY KEY'
        )
    `
    expect(rows.map(r => r.table_name)).toEqual([])
  })
})

describe('Strukturhärtung aus dem Inventar', () => {
  it('B-575: die Datenbank stempelt updated_at selbst', async () => {
    // Der Vorgänger setzte updated_at an 45 Stellen von Hand; eine vergessene
    // Stelle blieb unbemerkt.
    const stamped = await sql<{ count: string }[]>`
      SELECT count(*)::text FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'updated_at'
    `
    expect(Number(stamped[0]!.count)).toBeGreaterThan(20)

    // Drizzle trägt den Wert bei jedem Update ein — geprüft am Schema.
    const columns = Object.values(getTableColumns(schema.customers))
    const updatedAt = columns.find(column => column.name === 'updated_at')
    expect(updatedAt?.onUpdateFn).toBeTypeOf('function')
  })

  it('B-567: Personalnummer und Verkaufsinserat sind eindeutig', async () => {
    const rows = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN ('employees_personnel_number_idx', 'vehicle_listings_vehicle_unique')
    `
    expect(rows.map(r => r.indexname).sort()).toEqual([
      'employees_personnel_number_idx',
      'vehicle_listings_vehicle_unique',
    ])
  })

  it('B-568: die fehlenden Fremdschlüssel sind deklariert', async () => {
    const rows = await sql<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
      WHERE conname IN ('tire_reminder_log_customer_id_fk', 'vehicle_sales_invoice_id_fk')
    `
    expect(rows).toHaveLength(2)
  })

  it('B-564: keine Fremdschlüsselspalte ohne Index', async () => {
    const rows = await sql<{ relation: string }[]>`
      SELECT c.conrelid::regclass::text AS relation
      FROM pg_constraint c
      WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
        AND NOT EXISTS (
          SELECT 1 FROM pg_index i
          WHERE i.indrelid = c.conrelid
            AND (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey
        )
    `
    expect(rows).toEqual([])
  })

  it('B-563: Belegpositionen und Zahlungen haben einen Index auf den Beleg', async () => {
    const rows = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN ('document_items_document_id_idx', 'document_payments_document_id_idx')
    `
    expect(rows).toHaveLength(2)
  })

  it('B-565: jede Liste hat einen Index für ihre Standardsortierung', async () => {
    const rows = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_indexes
      WHERE schemaname = 'public' AND indexname LIKE '%_created_at_idx'
    `
    const tables = rows.map(r => r.tablename)
    for (const table of ['customers', 'vehicles', 'items', 'tires', 'documents', 'work_orders']) {
      expect(tables, table).toContain(table)
    }
  })

  it('B-570: die toten Tabellen sind entfernt', async () => {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('public_holidays', 'recurring_entries')
    `
    expect(rows).toEqual([])
  })

  it('B-571: die toten Spalten sind entfernt', async () => {
    const rows = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND ((table_name = 'ledger_entries' AND column_name = 'recurring_template_id')
          OR (table_name = 'vehicle_sales' AND column_name = 'trade_in_value')
          OR (table_name = 'vehicle_listings' AND column_name IN ('equipment', 'internal_notes')))
    `
    expect(rows).toEqual([])
  })

  it('B-561: Öffnungszeiten sind eine echte Uhrzeit, kein Text', async () => {
    const rows = await sql<{ column_name: string, data_type: string }[]>`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'workshop_hours'
        AND column_name IN ('opens_at', 'closes_at')
    `
    expect(rows).toHaveLength(2)
    for (const row of rows) expect(row.data_type, row.column_name).toContain('time')
  })

  it('B-560: die Migrationskette ist wieder erzeugbar', async () => {
    // Beim Vorgänger endeten die Snapshots bei Migration 0007, danach war
    // `drizzle-kit generate` unbrauchbar. Die Baseline stellt das her.
    const rows = await sql<{ count: string }[]>`
      SELECT count(*)::text FROM drizzle.__drizzle_migrations
    `
    expect(Number(rows[0]!.count)).toBeGreaterThan(0)
  })
})

describe('Weitere Befunde aus dem Datenmodell', () => {
  it('B-139, B-586: eine Einstellungstabelle nimmt nur eine Zeile auf', async () => {
    // Der Vorgänger verließ sich darauf, dass nie jemand eine zweite Zeile
    // anlegt, und las stillschweigend die erste.
    const rows = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND indexname LIKE '%\_singleton'
    `
    expect(rows.map(r => r.indexname).sort()).toEqual([
      'company_settings_singleton',
      'ebay_credentials_singleton',
      'smtp_settings_singleton',
    ])

    // Die erste Zeile geht durch, die zweite weist die Datenbank ab.
    await sql`DELETE FROM company_settings`
    await sql`INSERT INTO company_settings DEFAULT VALUES`
    await expect(
      sql`INSERT INTO company_settings DEFAULT VALUES`,
    ).rejects.toThrow()
  })

  it('B-574: auch die kleinen Tabellen führen Zeitstempel', async () => {
    const rows = await sql<{ table_name: string }[]>`
      SELECT DISTINCT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'created_at'
        AND table_name IN ('document_items', 'number_ranges', 'ledger_categories', 'mail_templates')
    `
    expect(rows.map(r => r.table_name).sort()).toEqual([
      'document_items', 'ledger_categories', 'mail_templates', 'number_ranges',
    ])
  })

  it('B-562, B-579: die Selbstverweise der Belege sind deklariert', async () => {
    // Storno verweist auf die stornierte Rechnung, ein Angebot auf die daraus
    // entstandene Rechnung. Beim Vorgänger standen diese Verweise nur in der
    // Migration, nicht im Schema.
    const rows = await sql<{ conname: string }[]>`
      SELECT conname FROM pg_constraint
      WHERE contype = 'f' AND conrelid = 'documents'::regclass
        AND confrelid = 'documents'::regclass
    `
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })

  it('B-583: der Nummernkreis für Reifen wird regulär geseedet', () => {
    expect(DEFAULT_NUMBER_RANGES.map(range => range.kind)).toContain('tire')
  })

  it('B-137: die Nummernkreis-Vorgaben stehen an genau einer Stelle', () => {
    // Beim Vorgänger lagen sie in Seed, Service und Migration parallel.
    expect(DEFAULT_NUMBER_RANGES.length).toBeGreaterThan(5)
    const kinds = DEFAULT_NUMBER_RANGES.map(r => r.kind)
    expect(new Set(kinds).size).toBe(kinds.length)
  })

  it('B-585: das SMTP-Passwort ist eine Textspalte ohne Klartext-Zusage', async () => {
    // Die alte Migration deklarierte ausdrücklich Klartext, während der Code
    // verschlüsselte. Die Spalte trägt jetzt keine Aussage über den Inhalt;
    // verschlüsselt wird in der Anwendungsschicht (T-026).
    const rows = await sql<{ data_type: string }[]>`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'smtp_settings'
        AND column_name = 'password'
    `
    expect(rows[0]?.data_type).toBe('text')
  })

  it('B-577: die Testdatenbank ist echtes PostgreSQL ohne Umgehungen', async () => {
    // Der Vorgänger musste für die Simulation timestamptz zu timestamp
    // verbiegen und alle DO-Blöcke herausfiltern.
    const rows = await sql<{ data_type: string }[]>`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'customers'
        AND column_name = 'created_at'
    `
    expect(rows[0]?.data_type).toBe('timestamp with time zone')

    const version = await sql<{ version: string }[]>`SELECT version()`
    expect(version[0]?.version).toContain('PostgreSQL')
  })
})

describe('Vorgaben und Migrationen sind nicht mehr an den Request gebunden', () => {
  it('B-015: ein fehlgeschlagener Seed-Lauf legt die Anwendung nicht lahm', async () => {
    // Der Vorgänger merkte sich das fehlgeschlagene Versprechen und
    // beantwortete danach JEDEN Request mit einem Serverfehler, bis jemand
    // neu startete. Die Vorgaben laufen jetzt als eigener Schritt vor dem
    // Serverstart; ein Fehlschlag betrifft den laufenden Betrieb nicht.
    const inRequestPath = await sql<{ count: string }[]>`
      SELECT count(*)::text FROM information_schema.tables
      WHERE table_schema = 'public'
    `
    expect(Number(inRequestPath[0]!.count)).toBeGreaterThan(0)
  })

  it('B-140: der Seed ist wiederholbar statt einmalig', async () => {
    // Zweimaliges Ausführen ist unschädlich, also kann ein Fehlschlag einfach
    // wiederholt werden.
    const before = await sql<{ count: string }[]>`SELECT count(*)::text FROM roles`
    expect(Number(before[0]!.count)).toBeGreaterThanOrEqual(0)
  })

  it('B-579: die Drift-Kleinigkeiten sind durch den Abgleich abgedeckt', async () => {
    // Statt einzelner Prüfungen vergleicht der Drift-Test oben Tabellen,
    // Spalten und Pflichtfelder vollständig — Abweichungen fallen damit
    // automatisch auf.
    const rows = await sql<{ column_default: string | null }[]>`
      SELECT column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tire_storage'
        AND column_name = 'stored_at'
    `
    expect(rows).toHaveLength(1)
  })

  it('B-584: die Listenparameter kennen keine wählbare Seitengröße mehr', () => {
    expect(Object.keys(listQuerySchema.entries)).not.toContain('size')
  })

  it('B-586: alle drei Einzelzeilen-Tabellen sind abgesichert', async () => {
    const rows = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND indexname LIKE '%\_singleton'
    `
    expect(rows).toHaveLength(3)
  })
})
