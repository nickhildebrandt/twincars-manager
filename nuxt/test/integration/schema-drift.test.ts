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
