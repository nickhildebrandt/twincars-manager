import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  createLedgerEntry,
  deleteLedgerEntry,
  getLedgerEntry,
  listLedgerCategories,
  listLedgerEntries,
  updateLedgerEntry
} from './ledger-service'
import { db } from '$lib/server/db/client'
import { ledgerCategories, ledgerEntries } from '$lib/server/db/schema'

/**
 * Integration tests for the ledger service — list, sums, filters and
 * CRUD over the in-memory pg-mem database.
 *
 * @group integration
 * @module ledger-service
 */
describe('ledger-service', () => {
  let incomeCategoryId: string
  let expenseCategoryId: string

  beforeEach(async () => {
    await db.delete(ledgerEntries)
    await db.delete(ledgerCategories)
    const [inc] = await db
      .insert(ledgerCategories)
      .values({
        direction: 'income',
        name: 'Fahrzeugverkauf',
        defaultTaxRate: '19.00'
      })
      .returning()
    const [exp] = await db
      .insert(ledgerCategories)
      .values({
        direction: 'expense',
        name: 'Werkstattmaterial',
        defaultTaxRate: '19.00'
      })
      .returning()
    incomeCategoryId = inc.id
    expenseCategoryId = exp.id
  })

  describe('listLedgerCategories', () => {
    it('returns all categories sorted by direction then name', async () => {
      await db
        .insert(ledgerCategories)
        .values({ direction: 'expense', name: 'Büro', defaultTaxRate: '19.00' })
      const all = await listLedgerCategories()
      // direction asc, name asc — 'expense' sorts before 'income'.
      expect(all.map((c) => c.name)).toEqual([
        'Büro',
        'Werkstattmaterial',
        'Fahrzeugverkauf'
      ])
    })

    it('filters by direction when supplied', async () => {
      const income = await listLedgerCategories('income')
      expect(income.map((c) => c.name)).toEqual(['Fahrzeugverkauf'])
      const expense = await listLedgerCategories('expense')
      expect(expense.map((c) => c.name)).toEqual(['Werkstattmaterial'])
    })
  })

  describe('createLedgerEntry', () => {
    it('persists and returns the created row', async () => {
      const created = await createLedgerEntry({
        direction: 'income',
        entryDate: '2026-05-01',
        entryNumber: 'BUCH-001',
        description: 'Rechnung 2026-001',
        amountGross: '1190.00',
        amountNet: '1000.00',
        taxAmount: '190.00',
        taxRate: '19.00',
        categoryId: incomeCategoryId
      })
      expect(created.id).toBeTruthy()
      expect(Number(created.amountGross)).toBe(1190)
      const fetched = await getLedgerEntry(created.id)
      expect(fetched?.description).toBe('Rechnung 2026-001')
    })
  })

  describe('listLedgerEntries', () => {
    beforeEach(async () => {
      await db.insert(ledgerEntries).values([
        {
          direction: 'income',
          entryDate: '2026-01-15',
          entryNumber: 'BUCH-100',
          description: 'Rechnung A',
          amountGross: '1190.00',
          amountNet: '1000.00',
          taxAmount: '190.00',
          taxRate: '19.00',
          categoryId: incomeCategoryId
        },
        {
          direction: 'income',
          entryDate: '2026-03-10',
          entryNumber: 'BUCH-101',
          description: 'Rechnung B Premium',
          amountGross: '238.00',
          amountNet: '200.00',
          taxAmount: '38.00',
          taxRate: '19.00',
          categoryId: incomeCategoryId
        },
        {
          direction: 'expense',
          entryDate: '2026-02-20',
          entryNumber: 'BUCH-200',
          description: 'Ölfilter',
          amountGross: '59.50',
          amountNet: '50.00',
          taxAmount: '9.50',
          taxRate: '19.00',
          categoryId: expenseCategoryId
        }
      ])
    })

    it('returns all entries sorted desc by entryDate with sums', async () => {
      const res = (await listLedgerEntries({ page: 1, size: 25 })) as Awaited<
        ReturnType<typeof listLedgerEntries>
      > & { incomeSum: number; expenseSum: number }
      expect(res.total).toBe(3)
      expect(res.items[0].entryDate).toBe('2026-03-10')
      expect(res.incomeSum).toBeCloseTo(1428)
      expect(res.expenseSum).toBeCloseTo(59.5)
      expect(res.pageCount).toBe(1)
    })

    it('paginates using size and reports pageCount', async () => {
      const res = await listLedgerEntries({ page: 1, size: 2 })
      expect(res.items).toHaveLength(2)
      expect(res.total).toBe(3)
      expect(res.pageCount).toBe(2)
    })

    it('filters by direction', async () => {
      const income = await listLedgerEntries({
        page: 1,
        size: 25,
        direction: 'income'
      })
      expect(income.total).toBe(2)
      const expense = await listLedgerEntries({
        page: 1,
        size: 25,
        direction: 'expense'
      })
      expect(expense.total).toBe(1)
      const all = await listLedgerEntries({
        page: 1,
        size: 25,
        direction: 'all'
      })
      expect(all.total).toBe(3)
    })

    it('filters by date range (from/to inclusive)', async () => {
      const res = await listLedgerEntries({
        page: 1,
        size: 25,
        from: '2026-02-01',
        to: '2026-02-28'
      })
      expect(res.total).toBe(1)
      expect(res.items[0].description).toBe('Ölfilter')
    })

    it('filters by case-insensitive search on description and entryNumber', async () => {
      const byDesc = await listLedgerEntries({
        page: 1,
        size: 25,
        q: 'premium'
      })
      expect(byDesc.total).toBe(1)
      expect(byDesc.items[0].description).toBe('Rechnung B Premium')
      const byNumber = await listLedgerEntries({
        page: 1,
        size: 25,
        q: 'BUCH-200'
      })
      expect(byNumber.total).toBe(1)
      expect(byNumber.items[0].description).toBe('Ölfilter')
    })

    it('returns pageCount=1 even on empty results', async () => {
      await db.delete(ledgerEntries)
      const res = await listLedgerEntries({ page: 1, size: 25 })
      expect(res.total).toBe(0)
      expect(res.items).toEqual([])
      expect(res.pageCount).toBe(1)
    })
  })

  describe('updateLedgerEntry', () => {
    it('updates fields and returns the new row', async () => {
      const created = await createLedgerEntry({
        direction: 'expense',
        entryDate: '2026-04-01',
        description: 'Anfang',
        amountGross: '10.00',
        amountNet: '10.00',
        taxAmount: '0',
        taxRate: '0',
        categoryId: expenseCategoryId
      })
      const updated = await updateLedgerEntry(created.id, {
        description: 'Korrigiert',
        amountGross: '12.00'
      })
      expect(updated.description).toBe('Korrigiert')
      expect(Number(updated.amountGross)).toBe(12)
    })

    it('returns undefined when updating an unknown id', async () => {
      const updated = await updateLedgerEntry(
        '00000000-0000-0000-0000-000000000000',
        { description: 'noop' }
      )
      expect(updated).toBeUndefined()
    })
  })

  describe('deleteLedgerEntry', () => {
    it('removes the row', async () => {
      const created = await createLedgerEntry({
        direction: 'income',
        entryDate: '2026-04-01',
        description: 'Doomed',
        amountGross: '1.00',
        amountNet: '1.00',
        taxAmount: '0',
        taxRate: '0',
        categoryId: incomeCategoryId
      })
      await deleteLedgerEntry(created.id)
      expect(await getLedgerEntry(created.id)).toBeNull()
    })

    it('is a no-op when the id does not exist', async () => {
      await expect(
        deleteLedgerEntry('00000000-0000-0000-0000-000000000000')
      ).resolves.toBeUndefined()
    })
  })

  describe('getLedgerEntry', () => {
    it('returns null for an unknown id', async () => {
      expect(
        await getLedgerEntry('00000000-0000-0000-0000-000000000000')
      ).toBeNull()
    })
  })
})
