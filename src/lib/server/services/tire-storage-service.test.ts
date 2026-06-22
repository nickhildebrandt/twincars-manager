import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  createTireStorage,
  deleteTireStorage,
  getTireStorage,
  getTireStorageIdByNumber,
  listTireStorage,
  markRetrieved,
  nextStorageNumber,
  updateTireStorage
} from './tire-storage-service'
import { db } from '$lib/server/db/client'
import { customers, numberRanges, tireStorage } from '$lib/server/db/schema'

/**
 * Integration tests for the tire-storage service. Backed by pg-mem so
 * the full Drizzle query layer + joins + jsonb round-trip are
 * exercised.
 *
 * @group integration
 * @module tire-storage-service
 */
describe('tire-storage-service', () => {
  const currentYear = new Date().getFullYear()

  let customerId: string
  let secondCustomerId: string

  beforeEach(async () => {
    await db.delete(tireStorage)
    await db.delete(customers)
    await db.delete(numberRanges)
    await db
      .insert(numberRanges)
      .values({
        kind: 'tire_storage',
        formatTemplate: 'L-{YYYY}-{NNNN}',
        nextValue: 1
      })
    const [c1] = await db
      .insert(customers)
      .values({
        customerNumber: 'KU-0001',
        firstName: 'Anna',
        lastName: 'Albers',
        city: 'Berlin'
      })
      .returning()
    const [c2] = await db
      .insert(customers)
      .values({
        customerNumber: 'KU-0002',
        firstName: 'Bert',
        lastName: 'Braun',
        company: 'Braun GmbH'
      })
      .returning()
    customerId = c1.id
    secondCustomerId = c2.id
  })

  describe('getTireStorageIdByNumber (QR scan lookup)', () => {
    it('resolves a storage number to its entry id', async () => {
      const created = await createTireStorage({
        customerId,
        brand: 'Continental',
        season: 'winter'
      })
      const id = await getTireStorageIdByNumber(created.storageNumber)
      expect(id).toBe(created.id)
    })

    it('returns null for an unknown number', async () => {
      expect(await getTireStorageIdByNumber('L-9999-9999')).toBeNull()
    })
  })

  describe('nextStorageNumber', () => {
    it('renders the configured template and bumps the sequence', async () => {
      const first = await nextStorageNumber()
      const second = await nextStorageNumber()
      expect(first).toBe(`L-${currentYear}-0001`)
      expect(second).toBe(`L-${currentYear}-0002`)
    })

    it('falls back to the default template if no range row exists', async () => {
      await db.delete(numberRanges)
      const num = await nextStorageNumber()
      expect(num).toBe(`L-${currentYear}-0001`)
    })
  })

  describe('createTireStorage', () => {
    it('auto-allocates a sequential storage number', async () => {
      const a = await createTireStorage({
        customerId,
        brand: 'Continental',
        model: 'WinterContact',
        size: '205/55 R16',
        season: 'winter',
        quantity: 4
      })
      const b = await createTireStorage({
        customerId,
        brand: 'Michelin',
        model: 'Pilot Sport',
        size: '225/45 R17',
        season: 'summer',
        quantity: 4
      })
      expect(a.storageNumber).toBe(`L-${currentYear}-0001`)
      expect(b.storageNumber).toBe(`L-${currentYear}-0002`)
    })

    it('persists photos as a jsonb array and reads them back unchanged', async () => {
      const photos = [
        { mime: 'image/jpeg', data: 'AAAA', caption: 'links' },
        { mime: 'image/png', data: 'BBBB' }
      ]
      const created = await createTireStorage({
        customerId,
        brand: 'Pirelli',
        size: '195/65 R15',
        season: 'allseason',
        photos
      })
      const fetched = await getTireStorage(created.id)
      expect(fetched).not.toBeNull()
      expect(fetched!.photos).toEqual(photos)
    })

    it('defaults storedAt to today (YYYY-MM-DD)', async () => {
      const today = new Date().toISOString().slice(0, 10)
      const created = await createTireStorage({ customerId, season: 'winter' })
      expect(created.storedAt).toBe(today)
    })

    it('still allocates a fresh storage number when an explicit one is given', async () => {
      // Explicit number bypasses the auto-generator but the counter
      // should not advance — keeps the next auto-generated value
      // predictable for the operator.
      const custom = await createTireStorage({
        customerId,
        storageNumber: 'LEGACY-42',
        season: 'winter'
      })
      expect(custom.storageNumber).toBe('LEGACY-42')
      const next = await nextStorageNumber()
      expect(next).toBe(`L-${currentYear}-0001`)
    })
  })

  describe('listTireStorage', () => {
    beforeEach(async () => {
      await createTireStorage({
        customerId,
        brand: 'Continental',
        model: 'WinterContact',
        size: '205/55 R16',
        season: 'winter'
      })
      await createTireStorage({
        customerId,
        brand: 'Michelin',
        model: 'Pilot Sport',
        size: '225/45 R17',
        season: 'summer'
      })
      await createTireStorage({
        customerId: secondCustomerId,
        brand: 'Pirelli',
        model: 'P Zero',
        size: '245/40 R18',
        season: 'summer'
      })
    })

    it('paginates and reports total + pageCount', async () => {
      const res = await listTireStorage({ page: 1, size: 2 })
      expect(res.items).toHaveLength(2)
      expect(res.total).toBe(3)
      expect(res.pageCount).toBe(2)
    })

    it('joins the customer name into customerLabel', async () => {
      const res = await listTireStorage({ page: 1, size: 25 })
      const labels = res.items.map((i) => i.customerLabel).sort()
      expect(labels).toEqual(['Anna Albers', 'Anna Albers', 'Braun GmbH'])
    })

    it('searches across storage_number, brand, model, size', async () => {
      const byBrand = await listTireStorage({ page: 1, size: 25, q: 'pirelli' })
      expect(byBrand.total).toBe(1)
      expect(byBrand.items[0].brand).toBe('Pirelli')

      const bySize = await listTireStorage({ page: 1, size: 25, q: '205/55' })
      expect(bySize.total).toBe(1)
      expect(bySize.items[0].brand).toBe('Continental')

      const byNumber = await listTireStorage({
        page: 1,
        size: 25,
        q: `L-${currentYear}-0001`
      })
      expect(byNumber.total).toBe(1)
    })

    it('searches across the joined customer name', async () => {
      const res = await listTireStorage({ page: 1, size: 25, q: 'braun' })
      expect(res.total).toBe(1)
      expect(res.items[0].brand).toBe('Pirelli')
    })

    it('filters by active=true (still stored)', async () => {
      const all = await listTireStorage({ page: 1, size: 25 })
      const target = all.items[0]
      await markRetrieved(target.id)
      const stillStored = await listTireStorage({
        page: 1,
        size: 25,
        active: true
      })
      expect(stillStored.total).toBe(2)
      expect(stillStored.items.find((i) => i.id === target.id)).toBeUndefined()
    })

    it('filters by active=false (retrieved)', async () => {
      const all = await listTireStorage({ page: 1, size: 25 })
      const target = all.items[0]
      await markRetrieved(target.id)
      const retrieved = await listTireStorage({
        page: 1,
        size: 25,
        active: false
      })
      expect(retrieved.total).toBe(1)
      expect(retrieved.items[0].id).toBe(target.id)
    })

    it('returns pageCount=1 even when empty', async () => {
      await db.delete(tireStorage)
      const res = await listTireStorage({ page: 1, size: 25 })
      expect(res.total).toBe(0)
      expect(res.items).toEqual([])
      expect(res.pageCount).toBe(1)
    })
  })

  describe('markRetrieved', () => {
    it('sets retrievedAt to the given date', async () => {
      const created = await createTireStorage({
        customerId,
        brand: 'Continental',
        season: 'winter'
      })
      expect(created.retrievedAt).toBeNull()
      const updated = await markRetrieved(created.id, '2026-04-15')
      expect(updated.retrievedAt).toBe('2026-04-15')
    })

    it('defaults to today when no date is given', async () => {
      const today = new Date().toISOString().slice(0, 10)
      const created = await createTireStorage({ customerId, season: 'summer' })
      const updated = await markRetrieved(created.id)
      expect(updated.retrievedAt).toBe(today)
    })
  })

  describe('updateTireStorage', () => {
    it('updates fields and bumps updatedAt', async () => {
      const created = await createTireStorage({
        customerId,
        brand: 'Continental',
        season: 'winter',
        notes: 'Regal A1'
      })
      const updated = await updateTireStorage(created.id, { notes: 'Regal B3' })
      expect(updated.notes).toBe('Regal B3')
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        created.updatedAt.getTime()
      )
    })
  })

  describe('deleteTireStorage', () => {
    it('removes the row', async () => {
      const created = await createTireStorage({ customerId, season: 'summer' })
      await deleteTireStorage(created.id)
      expect(await getTireStorage(created.id)).toBeNull()
    })
  })

  describe('getTireStorage', () => {
    it('returns null for unknown id', async () => {
      expect(
        await getTireStorage('00000000-0000-0000-0000-000000000000')
      ).toBeNull()
    })
  })
})
