import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  createShippingOption,
  deleteShippingOption,
  getShippingOption,
  listActiveShippingOptions,
  listShippingOptions,
  updateShippingOption
} from './shipping-option-service'
import { db } from '$lib/server/db/client'
import { shippingOptions } from '$lib/server/db/schema'

/**
 * Integration tests for the shipping-option service, exercising the
 * Drizzle query layer against an in-memory pg-mem database.
 *
 * @group integration
 * @module shipping-option-service
 */
describe('shipping-option-service', () => {
  beforeEach(async () => {
    await db.delete(shippingOptions)
  })

  describe('createShippingOption', () => {
    it('persists and returns the created row', async () => {
      const created = await createShippingOption({
        name: 'DHL Paket',
        description: 'Lieferung 1–3 Werktage',
        priceNet: '6.90',
        active: true,
        sortOrder: 10
      })
      expect(created.id).toBeTruthy()
      expect(created.name).toBe('DHL Paket')
      expect(created.active).toBe(true)
      expect(created.sortOrder).toBe(10)
      const fetched = await getShippingOption(created.id)
      expect(fetched?.name).toBe('DHL Paket')
    })

    it('applies the schema defaults for price, active and sortOrder', async () => {
      const created = await createShippingOption({ name: 'Abholung' })
      // numeric defaults arrive back as strings from pg
      expect(Number(created.priceNet)).toBe(0)
      expect(created.active).toBe(true)
      expect(created.sortOrder).toBe(0)
      expect(created.freeAboveNet).toBeNull()
    })

    it('stores freeAboveNet when provided', async () => {
      const created = await createShippingOption({
        name: 'DPD',
        priceNet: '7.50',
        freeAboveNet: '100.00'
      })
      expect(Number(created.freeAboveNet)).toBe(100)
    })
  })

  describe('listShippingOptions', () => {
    beforeEach(async () => {
      await db.insert(shippingOptions).values([
        { name: 'Bravo', priceNet: '7.50', sortOrder: 20, active: true },
        { name: 'Alpha', priceNet: '5.00', sortOrder: 10, active: true },
        {
          name: 'Charlie',
          description: 'Sondertransport',
          priceNet: '99.00',
          sortOrder: 30,
          active: false
        }
      ])
    })

    it('paginates results and reports the total + page count', async () => {
      const res = await listShippingOptions({ page: 1, size: 2 })
      expect(res.items).toHaveLength(2)
      expect(res.total).toBe(3)
      expect(res.pageCount).toBe(2)
      expect(res.page).toBe(1)
    })

    it('orders by sortOrder ascending, then by name', async () => {
      await db
        .insert(shippingOptions)
        .values({ name: 'Aaa', priceNet: '1.00', sortOrder: 10, active: true })
      const res = await listShippingOptions({ page: 1, size: 25 })
      expect(res.items.map((s) => s.name)).toEqual([
        'Aaa',
        'Alpha',
        'Bravo',
        'Charlie'
      ])
    })

    it('filters by case-insensitive name search', async () => {
      const res = await listShippingOptions({ page: 1, size: 25, q: 'alpha' })
      expect(res.total).toBe(1)
      expect(res.items[0].name).toBe('Alpha')
    })

    it('filters by description search', async () => {
      const res = await listShippingOptions({ page: 1, size: 25, q: 'sonder' })
      expect(res.items.map((s) => s.name)).toEqual(['Charlie'])
    })

    it('filters by active flag', async () => {
      const onlyActive = await listShippingOptions({
        page: 1,
        size: 25,
        active: true
      })
      expect(onlyActive.total).toBe(2)
      const onlyInactive = await listShippingOptions({
        page: 1,
        size: 25,
        active: false
      })
      expect(onlyInactive.total).toBe(1)
      expect(onlyInactive.items[0].name).toBe('Charlie')
    })

    it('returns at least pageCount=1 even when empty', async () => {
      await db.delete(shippingOptions)
      const res = await listShippingOptions({ page: 1, size: 25 })
      expect(res.total).toBe(0)
      expect(res.items).toEqual([])
      expect(res.pageCount).toBe(1)
    })
  })

  describe('updateShippingOption', () => {
    it('updates fields and bumps updatedAt', async () => {
      const created = await createShippingOption({
        name: 'Old',
        priceNet: '1.00'
      })
      const updated = await updateShippingOption(created.id, {
        name: 'New',
        priceNet: '2.50',
        active: false
      })
      expect(updated.name).toBe('New')
      expect(Number(updated.priceNet)).toBe(2.5)
      expect(updated.active).toBe(false)
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        created.updatedAt.getTime()
      )
    })

    it('can clear freeAboveNet by setting it to null', async () => {
      const created = await createShippingOption({
        name: 'X',
        priceNet: '1.00',
        freeAboveNet: '50.00'
      })
      const updated = await updateShippingOption(created.id, {
        freeAboveNet: null
      })
      expect(updated.freeAboveNet).toBeNull()
    })
  })

  describe('deleteShippingOption', () => {
    it('removes the row', async () => {
      const created = await createShippingOption({ name: 'Doomed' })
      await deleteShippingOption(created.id)
      expect(await getShippingOption(created.id)).toBeNull()
    })

    it('is a no-op for an unknown id', async () => {
      await expect(
        deleteShippingOption('00000000-0000-0000-0000-000000000000')
      ).resolves.toBeUndefined()
    })
  })

  describe('getShippingOption', () => {
    it('returns null for unknown id', async () => {
      expect(
        await getShippingOption('00000000-0000-0000-0000-000000000000')
      ).toBeNull()
    })
  })

  describe('listActiveShippingOptions', () => {
    it('returns only active rows ordered by sortOrder then name', async () => {
      await db.insert(shippingOptions).values([
        { name: 'Express', priceNet: '15.00', sortOrder: 30, active: true },
        { name: 'Standard', priceNet: '5.90', sortOrder: 10, active: true },
        { name: 'Same-day', priceNet: '25.00', sortOrder: 20, active: true },
        { name: 'Archived', priceNet: '0.00', sortOrder: 5, active: false }
      ])
      const res = await listActiveShippingOptions()
      expect(res.map((s) => s.name)).toEqual([
        'Standard',
        'Same-day',
        'Express'
      ])
    })

    it('uses name as a stable tiebreaker when sortOrder ties', async () => {
      await db.insert(shippingOptions).values([
        { name: 'Bravo', priceNet: '1.00', sortOrder: 10, active: true },
        { name: 'Alpha', priceNet: '1.00', sortOrder: 10, active: true },
        { name: 'Charlie', priceNet: '1.00', sortOrder: 10, active: true }
      ])
      const res = await listActiveShippingOptions()
      expect(res.map((s) => s.name)).toEqual(['Alpha', 'Bravo', 'Charlie'])
    })

    it('returns an empty array when no active rows exist', async () => {
      await db
        .insert(shippingOptions)
        .values({ name: 'Inactive', priceNet: '1.00', active: false })
      const res = await listActiveShippingOptions()
      expect(res).toEqual([])
    })
  })
})
