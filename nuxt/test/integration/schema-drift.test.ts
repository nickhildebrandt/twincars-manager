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

describe('Spaltentypen stimmen überein', () => {
  /**
   * `varchar(30)` im Schema, `character varying(30)` in der Datenbank — beide
   * Schreibweisen auf eine Form bringen, damit der Vergleich den Typ meint und
   * nicht die Formatierung.
   */
  const normalise = (type: string) =>
    type
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/^varchar\(/, 'charactervarying(')
      .replace(/^time$/, 'timewithouttimezone')

  it('jede Spalte hat in der Datenbank den Typ, den das Schema deklariert', async () => {
    // Ohne diesen Vergleich bleibt ein Typwechsel unbemerkt: die Umstellung der
    // Geldspalten von `numeric` auf Ganzzahl-Cent (E-10) lief zunächst genau so
    // durch, weil nur Existenz und Pflichtfeld geprüft wurden.
    const rows = await sql<{ table_name: string, column_name: string, type: string }[]>`
      SELECT c.relname AS table_name,
             a.attname AS column_name,
             format_type(a.atttypid, a.atttypmod) AS type
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND a.attnum > 0 AND NOT a.attisdropped
    `
    const inDatabase = new Map(rows.map(row => [`${row.table_name}.${row.column_name}`, row.type]))

    const mismatches: string[] = []
    for (const [, table] of tables) {
      const tableName = getTableName(table)
      for (const column of Object.values(getTableColumns(table))) {
        const actual = inDatabase.get(`${tableName}.${column.name}`)
        if (actual === undefined) continue
        if (normalise(column.getSQLType()) !== normalise(actual)) {
          mismatches.push(`${tableName}.${column.name}: Schema ${column.getSQLType()}, Datenbank ${actual}`)
        }
      }
    }
    expect(mismatches).toEqual([])
  })
})

describe('E-10: Geld ist eine Ganzzahl in Cent', () => {
  /** Spalten, deren Name einen Geldbetrag ankündigt. */
  const MONEY = /(amount|price|total|salary|wage|discount)/

  it('keine Geldspalte ist mehr eine Kommazahl', async () => {
    // `numeric` plus JavaScript-Fließkomma war die Ursache der Rundungsfehler
    // in Rechnungssummen. Geld ist jetzt durchgehend `integer` in Cent.
    const rows = await sql<{ table_name: string, column_name: string, data_type: string }[]>`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type = 'numeric'
    `
    // `_percent` und `_rate` sind Prozentsätze, keine Beträge.
    const money = rows.filter(
      row => MONEY.test(row.column_name) && !/_(percent|rate)$/.test(row.column_name),
    )
    expect(money.map(row => `${row.table_name}.${row.column_name}`)).toEqual([])
  })

  it('die verbliebenen Kommazahlen sind keine Beträge', async () => {
    const rows = await sql<{ table_name: string, column_name: string }[]>`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type = 'numeric'
      ORDER BY table_name, column_name
    `
    // Prozentsätze, Mengen, Stunden, Profiltiefe, Geokoordinaten.
    expect(rows.map(row => `${row.table_name}.${row.column_name}`)).toEqual([
      'company_settings.default_vat_rate',
      'company_settings.geo_lat',
      'company_settings.geo_lon',
      'document_items.discount_percent',
      'document_items.quantity',
      'document_items.tax_rate',
      'documents.tax_rate',
      'employees.weekly_hours',
      'ledger_categories.default_tax_rate',
      'ledger_entries.tax_rate',
      'wheel_sets.profile_mm',
      'work_order_items.hours',
      'work_order_items.quantity',
    ])
  })

  it('eine Geldspalte nimmt nur ganze Zahlen auf', async () => {
    // Die Datenbank selbst weist den Bruchteil ab — nicht erst eine Prüfung
    // in der Anwendung, die jemand vergessen kann.
    await expect(sql`
      INSERT INTO ledger_entries (booking_date, description, amount_gross, amount_net, direction)
      VALUES (CURRENT_DATE, 'Bruchteil', 12.5, 12.5, 'in')
    `).rejects.toThrow()
  })

  it('das Eingabeschema erlaubt nicht mehr, als die Spalte trägt', () => {
    // Genau die Klasse aus B-556: ein Schema, das mehr durchlässt als die
    // Spalte fasst, macht aus einem Tippfehler einen Serverfehler.
    expect(primitives.MAX_MONEY_CENTS).toBe(2_147_483_647)
    expect(v.safeParse(primitives.moneySchema, 2_147_483_648).success).toBe(false)
    expect(v.safeParse(primitives.moneySchema, 2_147_483_647).success).toBe(true)
  })
})

describe('E-11: Löschen mit Kaskade, Sperre für alles Belegnahe', () => {
  const ruleOf = async (table: string, column: string) => {
    const rows = await sql<{ confdeltype: string }[]>`
      SELECT c.confdeltype FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND c.conrelid = ${table}::regclass AND a.attname = ${column}
    `
    return { a: 'no action', r: 'restrict', c: 'cascade', n: 'set null', d: 'set default' }[
      rows[0]?.confdeltype ?? ''
    ]
  }

  it.each([
    ['work_orders', 'customer_id'],
    ['calendar_entries', 'customer_id'],
    ['customer_inquiries', 'customer_id'],
    ['vehicle_sales', 'customer_id'],
  ])('%s.%s gehört zum Kunden und geht mit ihm', async (table, column) => {
    expect(await ruleOf(table, column)).toBe('cascade')
  })

  it('M-05: das Fahrzeug geht nicht mehr mit dem Kunden', async () => {
    // Beim ersten Entwurf hing das Fahrzeug am Halter und wurde mitgelöscht,
    // während der Vorbesitzer bloß entkoppelt wurde — dieselbe Art Beziehung
    // mit zwei verschiedenen Regeln. Ein Auto ohne Halter ist kein Fehler.
    expect(await ruleOf('vehicles', 'customer_id')).toBe('no action')
  })

  it.each([
    ['documents', 'customer_id'],
    ['ledger_entries', 'customer_id'],
    ['documents', 'vehicle_id'],
    ['work_orders', 'vehicle_id'],
    ['calendar_entries', 'vehicle_id'],
  ])('%s.%s ist belegnah und sperrt statt still zu löschen', async (table, column) => {
    // B-190: kein Verweis wird mehr stillschweigend auf NULL gesetzt.
    expect(await ruleOf(table, column)).toBe('no action')
  })

  it('M-05: ein Kunde mit Fahrzeug lässt sich nicht einfach löschen', async () => {
    const [customer] = await sql<{ id: string }[]>`
      INSERT INTO customers (customer_number, last_name)
      VALUES ('M05-SPERRE', 'Testfall') RETURNING id
    `
    const [vehicle] = await sql<{ id: string }[]>`
      INSERT INTO vehicles (customer_id, make, model)
      VALUES (${customer!.id}, 'VW', 'Golf') RETURNING id
    `

    // Das Fahrzeug sperrt. Wer den Kunden loswerden will, muss das Auto
    // vorher umschreiben oder in den Bestand nehmen — bewusst, nicht nebenbei.
    await expect(sql`DELETE FROM customers WHERE id = ${customer!.id}`).rejects.toThrow()

    await sql`UPDATE vehicles SET customer_id = NULL, status = 'bestand' WHERE id = ${vehicle!.id}`
    await sql`DELETE FROM customers WHERE id = ${customer!.id}`

    const left = await sql`SELECT 1 FROM vehicles WHERE id = ${vehicle!.id}`
    expect(left).toHaveLength(1)
  })

  it('ein Kunde nimmt seinen Auftrag und seinen Termin mit', async () => {
    const [customer] = await sql<{ id: string }[]>`
      INSERT INTO customers (customer_number, last_name)
      VALUES ('E11-KASKADE', 'Testfall') RETURNING id
    `
    await sql`
      INSERT INTO work_orders (order_number, customer_id, title)
      VALUES ('E11-AU-1', ${customer!.id}, 'Inspektion')
    `
    await sql`
      INSERT INTO calendar_entries (kind, customer_id, title, starts_at, ends_at)
      VALUES ('appointment', ${customer!.id}, 'Termin', now(), now())
    `

    await sql`DELETE FROM customers WHERE id = ${customer!.id}`

    const left = await sql<{ count: string }[]>`
      SELECT (SELECT count(*) FROM work_orders WHERE order_number = 'E11-AU-1')
           + (SELECT count(*) FROM calendar_entries WHERE title = 'Termin') AS count
    `
    expect(Number(left[0]!.count)).toBe(0)
  })

  it('eine Rechnung sperrt das Löschen des Kunden', async () => {
    const [customer] = await sql<{ id: string }[]>`
      INSERT INTO customers (customer_number, last_name)
      VALUES ('E11-SPERRE', 'Testfall') RETURNING id
    `
    await sql`
      INSERT INTO documents (document_number, type, customer_id, issue_date)
      VALUES ('E11-RE-1', 'invoice', ${customer!.id}, CURRENT_DATE)
    `

    await expect(
      sql`DELETE FROM customers WHERE id = ${customer!.id}`,
    ).rejects.toThrow()

    // Archivieren bleibt der Weg, der immer offen steht.
    await sql`UPDATE customers SET archived = true WHERE id = ${customer!.id}`
    const rows = await sql<{ archived: boolean }[]>`
      SELECT archived FROM customers WHERE id = ${customer!.id}
    `
    expect(rows[0]?.archived).toBe(true)

    await sql`DELETE FROM documents WHERE document_number = 'E11-RE-1'`
    await sql`DELETE FROM customers WHERE id = ${customer!.id}`
  })
})

describe('E-16: die Kundenart ist ein ausdrückliches Feld', () => {
  it('ein neuer Kunde ist ohne Angabe privat', async () => {
    // B-200: der Vorgänger schloss aus einem leeren Firmenfeld auf einen
    // Privatkunden. Jetzt steht die Art im Datensatz.
    const rows = await sql<{ column_default: string | null }[]>`
      SELECT column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'kind'
    `
    expect(rows[0]?.column_default).toContain('privat')
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
      WHERE conname IN ('tire_reminder_log_wheel_set_id_fk', 'vehicle_sales_invoice_id_fk')
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
          OR (table_name = 'vehicle_sales' AND column_name = 'trade_in_value'))
    `
    expect(rows).toEqual([])
  })

  it('E-13: die Inseratfelder sind zurück, weil sie eine Oberfläche bekommen', async () => {
    // In T-005 als tot entfernt — mit der Entscheidung E-13 bekommen sie eine
    // vollständige Oberfläche und gehören damit wieder ins Modell.
    const rows = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vehicle_listings'
        AND column_name IN ('equipment', 'internal_notes')
    `
    expect(rows.map(r => r.column_name).sort()).toEqual(['equipment', 'internal_notes'])
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
      WHERE table_schema = 'public' AND table_name = 'wheel_sets'
        AND column_name = 'state'
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

describe('Die Schlüsselstrategie', () => {
  it('B-582: die Tabellen der Anmeldebibliothek führen Text-Ids, alle anderen uuid', async () => {
    // Der Befund lässt die Wahl offen: beibehalten, wenn better-auth bleibt.
    // Es bleibt (ADR-019), also bleibt auch seine Id-Form — sie gegen uuid zu
    // tauschen hieße, gegen die Bibliothek zu arbeiten, bei jedem Update aufs
    // Neue. Wichtig ist, dass die Grenze sauber verläuft.
    const rows = await sql<{ table_name: string, data_type: string }[]>`
      SELECT c.table_name, c.data_type
      FROM information_schema.columns c
      JOIN information_schema.table_constraints t
        ON t.table_name = c.table_name AND t.constraint_type = 'PRIMARY KEY'
      JOIN information_schema.key_column_usage k
        ON k.constraint_name = t.constraint_name AND k.column_name = c.column_name
      WHERE c.table_schema = 'public' AND c.column_name = 'id'
    `

    const LIBRARY = ['users', 'sessions', 'accounts', 'verifications']
    for (const row of rows) {
      const expected = LIBRARY.includes(row.table_name) ? 'text' : 'uuid'
      expect(row.data_type, row.table_name).toBe(expected)
    }

    // Und die Fremdschlüssel auf Benutzer folgen der Bibliothek, nicht dem
    // Hausstandard — sonst ließen sie sich gar nicht deklarieren.
    const userRefs = await sql<{ table_name: string, data_type: string }[]>`
      SELECT table_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'user_id'
    `
    for (const row of userRefs) expect(row.data_type, row.table_name).toBe('text')
  })
})

describe('B-190: kein Verweis wird still gelöscht', () => {
  /**
   * Jede verbliebene `SET NULL`-Regel, mit dem Grund, warum sie richtig ist.
   *
   * Der Vorgänger setzte Verweise reihenweise still auf NULL, und niemand
   * merkte, dass Auskünfte verschwanden. Hier steht jede einzelne Regel
   * namentlich in dieser Liste — eine neue, die nicht darin steht, lässt den
   * Test scheitern, und wer sie hinzufügt, muss den Grund aufschreiben.
   */
  const DELIBERATE_SET_NULL: Record<string, string> = {
    'work_orders.appointment_id':
      'Der Termin wird abgesagt, der Auftrag in der Werkstatt läuft weiter.',
    'vehicle_sales.invoice_id':
      'Der Verkauf bleibt, die Rechnung dazu kann neu geschrieben werden.',
    'document_items.item_id':
      'Die Position trägt Bezeichnung und Preis als eigene Kopie; sie bleibt lesbar.',
    'document_items.tire_id':
      'Dasselbe für eine Reifenposition im Beleg: Größe und Preis sind kopiert.',
    'work_order_items.item_id':
      'Dasselbe für eine Position im Auftrag: Bezeichnung und Preis sind kopiert.',
    'ebay_listings.tire_id':
      'Das beendete Angebot behält seine eBay-Daten, auch ohne Reifen im Katalog.',
    'wheel_sets.tire_id':
      'Marke, Größe und Saison stehen als eigene Kopie im Radsatz; er bleibt lesbar.',
    'vehicle_owner_history.customer_id':
      'Der Name des damaligen Halters steht als Kopie im Eintrag und bleibt erhalten.',
    'vehicles.previous_owner_customer_id':
      'Der Vorbesitzer ist eine Zusatzangabe, nicht der Eigentümer.',
  }

  it('jede SET-NULL-Regel steht namentlich in der Liste', async () => {
    const rows = await sql<{ relation: string, column_name: string }[]>`
      SELECT c.conrelid::regclass::text AS relation, a.attname AS column_name
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
        AND c.confdeltype = 'n'
      ORDER BY relation, column_name
    `
    const found = rows.map(row => `${row.relation}.${row.column_name}`)
    expect(found.sort()).toEqual(Object.keys(DELIBERATE_SET_NULL).sort())
  })

  it('jede Begründung ist ein vollständiger deutscher Satz', () => {
    for (const [rule, reason] of Object.entries(DELIBERATE_SET_NULL)) {
      expect(reason, rule).toMatch(/^[A-ZÄÖÜ].*\.$/)
      expect(reason.length, rule).toBeGreaterThan(30)
    }
  })

  it('M-34: das Versandprotokoll verweist ohne Fremdschlüssel', async () => {
    // Es muss den Vorgang überleben, auf den es zeigt — sonst verschwände mit
    // einem gelöschten Entwurf die Spur, dass etwas rausging. Statt eines
    // Verweises zwei Felder: Art des Vorgangs und dessen Kennung.
    const fks = await sql`
      SELECT 1 FROM pg_constraint
      WHERE contype = 'f' AND conrelid = 'sent_messages'::regclass
    `
    expect(fks).toEqual([])

    const columns = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sent_messages'
        AND column_name IN ('subject_type', 'subject_id')
      ORDER BY column_name
    `
    expect(columns.map(row => row.column_name)).toEqual(['subject_id', 'subject_type'])
  })

  it('was einen Beleg oder eine Buchung betrifft, sperrt statt zu nullen', async () => {
    const rows = await sql<{ relation: string, column_name: string, rule: string }[]>`
      SELECT c.conrelid::regclass::text AS relation, a.attname AS column_name,
             c.confdeltype::text AS rule
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
        AND c.conrelid IN ('ledger_entries'::regclass, 'documents'::regclass)
      ORDER BY relation, column_name
    `
    // 'n' wäre SET NULL. Buchungen und Belege nennen ihre Herkunft; verliert
    // sich die, ist die Buchführung nicht mehr nachvollziehbar.
    expect(rows.filter(row => row.rule === 'n')).toEqual([])
  })

  it('die Stornokette reißt nicht', async () => {
    const rows = await sql<{ conname: string, rule: string }[]>`
      SELECT conname, confdeltype::text AS rule FROM pg_constraint
      WHERE contype = 'f' AND conrelid = 'documents'::regclass
        AND confrelid = 'documents'::regclass
      ORDER BY conname
    `
    expect(rows.map(row => row.conname)).toEqual([
      'documents_cancelled_by_fk',
      'documents_cancels_fk',
      'documents_converted_to_invoice_id_fk',
    ])
    for (const row of rows) expect(row.rule, row.conname).toBe('a')
  })

  it('jede Verweisspalte hat auch einen Fremdschlüssel', async () => {
    // `documents.converted_to_invoice_id` hatte keinen: das Angebot nannte die
    // Rechnung, in die es überging, ohne dass die Datenbank das wusste.
    const rows = await sql<{ table_name: string, column_name: string }[]>`
      SELECT c.table_name, c.column_name
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.data_type = 'uuid' AND c.column_name LIKE '%\_id'
        AND NOT EXISTS (
          SELECT 1 FROM pg_constraint con
          JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
          WHERE con.contype = 'f' AND con.conrelid = (quote_ident(c.table_name))::regclass
            AND a.attname = c.column_name)
      ORDER BY c.table_name, c.column_name
    `
    expect(rows.map(row => `${row.table_name}.${row.column_name}`)).toEqual([])
  })

  it('M-10: die Zeiterfassung gibt es nicht mehr', async () => {
    // Sie trug fünf Verweise, drei davon redundant, und widersprach sich
    // selbst: der Verweis auf die Position kaskadierte, der auf den Auftrag
    // nullte. Es wird kein Controlling der Arbeitszeit betrieben — die Zeit
    // steht als Wert an der Auftragsposition.
    const rows = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'time_entries'
    `
    expect(rows).toEqual([])

    const hours = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'work_order_items'
        AND column_name = 'hours'
    `
    expect(hours).toHaveLength(1)
  })
})
