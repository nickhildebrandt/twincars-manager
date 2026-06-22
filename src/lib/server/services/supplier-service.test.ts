import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier
} from './supplier-service'
import { db } from '$lib/server/db/client'
import { suppliers } from '$lib/server/db/schema'

/**
 * Integration tests for the supplier service, exercising the full
 * Drizzle query layer against an in-memory pg-mem database.
 *
 * @group integration
 * @module supplier-service
 */
describe('supplier-service', () => {
  beforeEach(async () => {
    await db.delete(suppliers)
  })

  describe('createSupplier', () => {
    it('persists and returns the created row', async () => {
      const created = await createSupplier({
        name: 'Reifen Maier GmbH',
        contactPerson: 'Hans Maier',
        email: 'kontakt@reifen-maier.de',
        city: 'München'
      })
      expect(created.id).toBeTruthy()
      expect(created.name).toBe('Reifen Maier GmbH')
      const fetched = await getSupplier(created.id)
      expect(fetched?.name).toBe('Reifen Maier GmbH')
    })
  })

  describe('listSuppliers', () => {
    beforeEach(async () => {
      await db.insert(suppliers).values([
        { name: 'Alpha GmbH', city: 'Berlin', contactPerson: 'Anna' },
        { name: 'Beta AG', city: 'Hamburg', contactPerson: 'Bert' },
        { name: 'Gamma KG', city: 'München', contactPerson: 'Clara' }
      ])
    })

    it('paginates results and reports the total + page count', async () => {
      const res = await listSuppliers({ page: 1, size: 2 })
      expect(res.items).toHaveLength(2)
      expect(res.total).toBe(3)
      expect(res.pageCount).toBe(2)
      expect(res.page).toBe(1)
    })

    it('filters by case-insensitive name search', async () => {
      const res = await listSuppliers({ page: 1, size: 25, q: 'beta' })
      expect(res.total).toBe(1)
      expect(res.items[0].name).toBe('Beta AG')
    })

    it('filters by city search', async () => {
      const res = await listSuppliers({ page: 1, size: 25, q: 'München' })
      expect(res.items.map((s) => s.name)).toEqual(['Gamma KG'])
    })

    it('filters by archived flag', async () => {
      const [s] = await db.select().from(suppliers).limit(1)
      await updateSupplier(s.id, { archived: true })
      const onlyArchived = await listSuppliers({
        page: 1,
        size: 25,
        archived: true
      })
      expect(onlyArchived.total).toBe(1)
      const onlyActive = await listSuppliers({
        page: 1,
        size: 25,
        archived: false
      })
      expect(onlyActive.total).toBe(2)
    })

    it('returns at least pageCount=1 even when empty', async () => {
      await db.delete(suppliers)
      const res = await listSuppliers({ page: 1, size: 25 })
      expect(res.total).toBe(0)
      expect(res.items).toEqual([])
      expect(res.pageCount).toBe(1)
    })
  })

  describe('updateSupplier', () => {
    it('updates fields and bumps updatedAt', async () => {
      const created = await createSupplier({ name: 'Old', city: 'A' })
      const updated = await updateSupplier(created.id, { name: 'New' })
      expect(updated.name).toBe('New')
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        created.updatedAt.getTime()
      )
    })
  })

  describe('deleteSupplier', () => {
    it('removes the row', async () => {
      const created = await createSupplier({ name: 'Doomed' })
      await deleteSupplier(created.id)
      expect(await getSupplier(created.id)).toBeNull()
    })
  })

  describe('getSupplier', () => {
    it('returns null for unknown id', async () => {
      expect(
        await getSupplier('00000000-0000-0000-0000-000000000000')
      ).toBeNull()
    })
  })
})
