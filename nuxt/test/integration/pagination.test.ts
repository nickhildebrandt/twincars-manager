/**
 * The list helper.
 *
 * Twenty-five rows per page, server-side, everywhere. The predecessor carried
 * a `clampPagination` that allowed 10, 50 and 100 and was dead code besides
 * (B-026), and it never bounded the page number, so `page=0` produced a
 * negative offset and an unhandled server error (B-149).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { customers } from '../../server/database/schema/index.ts'
import { sliceFor, sortableNames } from '../../server/utils/pagination.ts'
import { PAGE_SIZE, listQuerySchema, listResult } from '#shared/schemas/pagination'
import { openTestDatabase } from '../setup/drizzle'

const { db, close } = openTestDatabase()
afterAll(close)

const SORTABLE = {
  name: customers.lastName,
  number: customers.customerNumber,
  created: customers.createdAt,
}

const query = (raw: Record<string, unknown>) => v.parse(listQuerySchema, raw)

beforeAll(async () => {
  await db.delete(customers)
  await db.insert(customers).values(
    Array.from({ length: 30 }, (_, index) => ({
      customerNumber: `P-${String(index + 1).padStart(3, '0')}`,
      lastName: `Kunde ${String(index + 1).padStart(3, '0')}`,
    })),
  )
})

const page = async (raw: Record<string, unknown>) => {
  const parsed = query(raw)
  const slice = sliceFor(parsed, SORTABLE, customers.createdAt)
  const rows = await db
    .select({ number: customers.customerNumber })
    .from(customers)
    .orderBy(...slice.orderBy)
    .limit(slice.limit)
    .offset(slice.offset)
  return { rows, parsed }
}

describe('sliceFor', () => {
  it('liefert nie mehr als 25 Zeilen', async () => {
    const { rows } = await page({})
    expect(rows).toHaveLength(PAGE_SIZE)
  })

  it('liefert auf der zweiten Seite den Rest', async () => {
    const { rows } = await page({ page: 2 })
    expect(rows).toHaveLength(5)
  })

  it('überschneidet sich nicht zwischen den Seiten', async () => {
    const first = await page({ sort: 'number', dir: 'asc' })
    const second = await page({ page: 2, sort: 'number', dir: 'asc' })
    const numbers = [...first.rows, ...second.rows].map(row => row.number)
    expect(new Set(numbers).size).toBe(30)
  })

  it('sortiert nach einer erlaubten Spalte', async () => {
    const { rows } = await page({ sort: 'number', dir: 'asc' })
    expect(rows[0]?.number).toBe('P-001')

    const descending = await page({ sort: 'number', dir: 'desc' })
    expect(descending.rows[0]?.number).toBe('P-030')
  })

  it('ignoriert einen unbekannten Sortierwunsch, statt zu scheitern', async () => {
    // Ein alter Lesezeichen-Link soll die Liste zeigen, keinen Fehler.
    const { rows } = await page({ sort: 'gibtsnicht' })
    expect(rows).toHaveLength(PAGE_SIZE)
  })

  it('lässt keinen Spaltennamen aus der Anfrage in die Abfrage', async () => {
    // Der Sortierwunsch ist eine Zeichenkette aus dem Netz. Ohne Weißliste
    // stünde sie in der SQL-Anweisung.
    const { rows } = await page({ sort: 'last_name; DROP TABLE customers' })
    expect(rows).toHaveLength(PAGE_SIZE)
    const [{ count }] = await db.select({ count: customers.id }).from(customers).limit(1)
    expect(count).toBeTruthy()
  })

  it('hängt eine eindeutige Spalte als Stichentscheid an', async () => {
    // Ohne zweites Sortierkriterium können Zeilen mit gleichem Wert auf zwei
    // Seiten oder auf keiner erscheinen.
    const slice = sliceFor(query({ sort: 'name' }), SORTABLE, customers.createdAt)
    expect(slice.orderBy).toHaveLength(2)
  })

  it('nennt die erlaubten Sortierspalten', () => {
    expect(sortableNames(SORTABLE)).toEqual(['created', 'name', 'number'])
  })
})

describe('listQuerySchema', () => {
  it.each([
    ['page=0', { page: 0 }],
    ['eine negative Seite', { page: -1 }],
    ['eine unsinnige Richtung', { dir: 'seitwärts' }],
  ])('lehnt %s ab', (_name, raw) => {
    expect(v.safeParse(listQuerySchema, raw).success).toBe(false)
  })

  it('kennt keine Seitengröße', () => {
    // B-026: es gibt keinen Größenwähler, also auch keinen Parameter dafür.
    expect(Object.keys(listQuerySchema.entries)).not.toContain('size')
    const parsed = v.parse(listQuerySchema, { page: 1, size: 100 })
    expect(parsed).not.toHaveProperty('size')
  })
})

describe('listResult', () => {
  it('rechnet die Seitenzahl aus', () => {
    expect(listResult([], 30, 1)).toMatchObject({ size: 25, pageCount: 2, total: 30 })
  })

  it('meldet bei einer leeren Liste eine Seite', () => {
    expect(listResult([], 0, 1).pageCount).toBe(1)
  })
})

describe('Regression', () => {
  it('B-026: es gibt keine wählbare Seitengröße mehr', async () => {
    // Der Vorgänger trug einen `clampPagination`-Helfer, der 10, 50 und 100
    // erlaubte — entgegen der Regel „fest 25" — und der obendrein von
    // niemandem aufgerufen wurde. Auch die Pagination-Komponente nahm
    // `size`-Eigenschaften an, die nichts bewirkten.
    expect(PAGE_SIZE).toBe(25)
    expect(Object.keys(listQuerySchema.entries)).not.toContain('size')

    // Ein mitgeschickter Größenwunsch wird nicht übernommen, sondern fällt weg.
    const parsed = v.parse(listQuerySchema, { page: 1, size: 100, pageSize: 50 })
    expect(parsed).not.toHaveProperty('size')
    expect(parsed).not.toHaveProperty('pageSize')

    // Und die Abfrage liefert trotzdem genau 25 Zeilen.
    const slice = sliceFor(parsed, SORTABLE, customers.createdAt)
    expect(slice.limit).toBe(25)
    const rows = await db
      .select({ number: customers.customerNumber })
      .from(customers)
      .orderBy(...slice.orderBy)
      .limit(slice.limit)
      .offset(slice.offset)
    expect(rows).toHaveLength(25)
  })
})
