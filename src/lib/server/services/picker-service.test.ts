import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import { customerPickers, itemPickers, vehiclePickers } from './picker-service'
import { db } from '$lib/server/db/client'
import {
  customers,
  itemPriceVersions,
  items,
  vehicleLicensePlateVersions,
  vehicles
} from '$lib/server/db/schema'

/**
 * Integration tests for picker-service — id/label shape per entity,
 * archived exclusion, label fallbacks.
 *
 * @group integration
 * @module picker-service
 */
describe('picker-service', () => {
  beforeEach(async () => {
    await db.delete(itemPriceVersions)
    await db.delete(items)
    await db.delete(vehicleLicensePlateVersions)
    await db.delete(vehicles)
    await db.delete(customers)
  })

  describe('customerPickers', () => {
    it('returns active customers as id/label pairs, archived excluded', async () => {
      // pg-mem dislikes multi-row inserts that mix defaults with
      // explicit values across rows; insert one row at a time and pass
      // `archived` on every row explicitly.
      await db
        .insert(customers)
        .values({
          customerNumber: 'K-001',
          company: 'Alpha GmbH',
          lastName: 'Albers',
          firstName: 'Anna',
          archived: false
        })
      await db
        .insert(customers)
        .values({
          customerNumber: 'K-002',
          company: null,
          lastName: 'Beispiel',
          firstName: 'Bert',
          archived: false
        })
      await db
        .insert(customers)
        .values({
          customerNumber: 'K-003',
          company: 'Gamma KG',
          lastName: 'Geier',
          firstName: 'Greta',
          archived: true
        })
      const rows = await customerPickers()
      expect(rows).toHaveLength(2)
      const byLabel = rows.map((r) => r.label)
      // company wins when present, full name otherwise.
      expect(byLabel).toContain('Alpha GmbH')
      expect(byLabel).toContain('Bert Beispiel')
      for (const r of rows) expect(r.id).toBeTruthy()
    })

    it('falls back to the customer number when no name fields are set', async () => {
      await db
        .insert(customers)
        .values({
          customerNumber: 'K-999',
          company: null,
          firstName: null,
          lastName: null,
          archived: false
        })
      const rows = await customerPickers()
      expect(rows).toHaveLength(1)
      expect(rows[0].label).toBe('K-999')
    })

    it('returns an empty array when nothing is in the table', async () => {
      const rows = await customerPickers()
      expect(rows).toEqual([])
    })
  })

  describe('vehiclePickers', () => {
    it('returns active vehicles with the current plate joined in (archived excluded)', async () => {
      const [v1] = await db
        .insert(vehicles)
        .values({ make: 'VW', model: 'Golf', archived: false })
        .returning()
      const [v2] = await db
        .insert(vehicles)
        .values({ make: 'BMW', model: '320i', archived: false })
        .returning()
      await db
        .insert(vehicles)
        .values({ make: 'Audi', model: 'A4', archived: true })
      // pg-mem limitation: `selectDistinctOn` is not honoured, so we
      // can only register one plate version per vehicle here. The
      // "most recent valid_from wins" path is covered by the
      // vehicle-service tests against a real DB.
      await db
        .insert(vehicleLicensePlateVersions)
        .values({
          vehicleId: v1.id,
          validFrom: '2025-06-01',
          licensePlate: 'B-AA 200'
        })
      await db
        .insert(vehicleLicensePlateVersions)
        .values({
          vehicleId: v2.id,
          validFrom: '2024-03-01',
          licensePlate: 'M-XY 1'
        })
      const rows = await vehiclePickers()
      expect(rows).toHaveLength(2)
      const labels = rows.map((r) => r.label)
      expect(labels).toContain('B-AA 200 VW Golf')
      expect(labels).toContain('M-XY 1 BMW 320i')
      // archived Audi never makes the list
      expect(labels.some((l) => l.includes('Audi'))).toBe(false)
    })

    it('falls back to a make/model-only label when no plate is recorded', async () => {
      await db
        .insert(vehicles)
        .values({ make: 'Opel', model: 'Astra', archived: false })
        .returning()
      const rows = await vehiclePickers()
      expect(rows).toHaveLength(1)
      expect(rows[0].label).toBe('Opel Astra')
    })
  })

  describe('itemPickers', () => {
    it('returns items with their current net price', async () => {
      const [a] = await db
        .insert(items)
        .values({
          articleNumber: 'ART-00001',
          description: 'Ölfilter',
          unit: 'Stk'
        })
        .returning()
      const [b] = await db
        .insert(items)
        .values({
          articleNumber: 'ART-00002',
          description: 'Bremsbeläge',
          unit: 'Satz'
        })
        .returning()
      await db
        .insert(itemPriceVersions)
        .values({ itemId: a.id, validFrom: '2024-01-01', unitPriceNet: '9.90' })
      await db
        .insert(itemPriceVersions)
        .values({
          itemId: a.id,
          validFrom: '2025-02-01',
          unitPriceNet: '12.50'
        })
      await db
        .insert(itemPriceVersions)
        .values({
          itemId: b.id,
          validFrom: '2024-01-01',
          unitPriceNet: '79.00'
        })
      const rows = await itemPickers()
      expect(rows).toHaveLength(2)
      const byNumber = new Map(rows.map((r) => [r.label.split(' — ')[0], r]))
      expect(byNumber.get('ART-00001')?.label).toBe('ART-00001 — Ölfilter')
      expect(byNumber.get('ART-00001')?.unit).toBe('Stk')
      expect(Number(byNumber.get('ART-00001')?.unitPriceNet)).toBe(12.5)
      expect(Number(byNumber.get('ART-00002')?.unitPriceNet)).toBe(79)
    })

    it('returns null unitPriceNet when no price version exists', async () => {
      await db
        .insert(items)
        .values({
          articleNumber: 'ART-00003',
          description: 'Neuer Artikel',
          unit: 'Stk'
        })
      const rows = await itemPickers()
      expect(rows).toHaveLength(1)
      expect(rows[0].unitPriceNet).toBeNull()
      expect(rows[0].unit).toBe('Stk')
    })

    it('returns an empty array when no items exist', async () => {
      const rows = await itemPickers()
      expect(rows).toEqual([])
    })
  })
})
