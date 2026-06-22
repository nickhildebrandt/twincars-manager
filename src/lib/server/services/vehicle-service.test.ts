import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  countVehicles,
  createVehicle,
  deleteLicensePlateVersion,
  deleteVehicle,
  getEffectiveLicensePlate,
  getVehicle,
  listLicensePlateVersions,
  listVehicles,
  updateVehicle,
  upsertLicensePlateVersion,
  withCurrentPlates
} from './vehicle-service'
import { db } from '$lib/server/db/client'
import {
  customers,
  vehicleLicensePlateVersions,
  vehicles
} from '$lib/server/db/schema'

/**
 * Integration tests for the vehicle service, exercising the full
 * Drizzle query layer against an in-memory pg-mem database. The
 * versioned license-plate helpers are the load-bearing logic and get
 * dedicated coverage.
 *
 * @group integration
 * @module vehicle-service
 */
describe('vehicle-service', () => {
  beforeEach(async () => {
    await db.delete(vehicleLicensePlateVersions)
    await db.delete(vehicles)
    await db.delete(customers)
  })

  describe('createVehicle', () => {
    it('persists a vehicle without a license plate', async () => {
      const created = await createVehicle({
        make: 'VW',
        model: 'Golf',
        vin: 'WVWZZZ1KZAW000001'
      })
      expect(created.id).toBeTruthy()
      expect(created.make).toBe('VW')
      expect(created.licensePlate).toBeNull()
    })

    it('seeds the initial license plate version when provided', async () => {
      const created = await createVehicle({
        make: 'BMW',
        model: '320d',
        licensePlate: 'M-AB 1234'
      })
      expect(created.licensePlate).toBe('M-AB 1234')
      const history = await listLicensePlateVersions(created.id)
      expect(history).toHaveLength(1)
    })

    it('ignores a blank license plate string', async () => {
      const created = await createVehicle({
        make: 'Opel',
        model: 'Corsa',
        licensePlate: '   '
      })
      expect(created.licensePlate).toBeNull()
      const history = await listLicensePlateVersions(created.id)
      expect(history).toHaveLength(0)
    })
  })

  describe('listVehicles', () => {
    beforeEach(async () => {
      const [c] = await db
        .insert(customers)
        .values({
          customerNumber: 'KU-V0001',
          firstName: 'Kunde',
          lastName: 'Test'
        })
        .returning()

      await db.insert(vehicles).values([
        {
          make: 'VW',
          model: 'Golf',
          vin: 'WVWZZZ1KZAW111111',
          customerId: c.id,
          archived: false
        },
        {
          make: 'BMW',
          model: '320d',
          vin: 'WBA8E5G50FNU22222',
          customerId: null,
          archived: false
        },
        {
          make: 'Audi',
          model: 'A4',
          vin: 'WAUZZZ8K9DA333333',
          customerId: null,
          archived: false
        }
      ])
    })

    it('paginates and reports total + pageCount', async () => {
      const res = await listVehicles({ page: 1, size: 2 })
      expect(res.items).toHaveLength(2)
      expect(res.total).toBe(3)
      expect(res.pageCount).toBe(2)
    })

    it('filters by VIN (case-insensitive)', async () => {
      const res = await listVehicles({
        page: 1,
        size: 25,
        q: 'wba8e5g50fnu22222'
      })
      expect(res.total).toBe(1)
      expect(res.items[0].make).toBe('BMW')
    })

    it('filters by make', async () => {
      const res = await listVehicles({ page: 1, size: 25, q: 'audi' })
      expect(res.total).toBe(1)
      expect(res.items[0].make).toBe('Audi')
    })

    it('filters by model', async () => {
      const res = await listVehicles({ page: 1, size: 25, q: 'Golf' })
      expect(res.total).toBe(1)
      expect(res.items[0].make).toBe('VW')
    })

    it('matches via the latest license plate', async () => {
      const rows = await db.select().from(vehicles)
      const bmw = rows.find((r) => r.make === 'BMW')!
      await upsertLicensePlateVersion({
        vehicleId: bmw.id,
        validFrom: '2025-01-01',
        licensePlate: 'M-XY 9999'
      })
      const res = await listVehicles({ page: 1, size: 25, q: 'M-XY' })
      expect(res.total).toBe(1)
      expect(res.items[0].make).toBe('BMW')
      expect(res.items[0].licensePlate).toBe('M-XY 9999')
    })

    it('filters by kind=customer', async () => {
      const res = await listVehicles({ page: 1, size: 25, kind: 'customer' })
      expect(res.total).toBe(1)
      expect(res.items[0].make).toBe('VW')
    })

    it('filters by kind=stock', async () => {
      const res = await listVehicles({ page: 1, size: 25, kind: 'stock' })
      expect(res.total).toBe(2)
      expect(res.items.every((v) => v.customerId === null)).toBe(true)
    })

    it('always hides archived vehicles', async () => {
      const [first] = await db.select().from(vehicles).limit(1)
      await updateVehicle(first.id, { archived: true })
      const res = await listVehicles({ page: 1, size: 25 })
      expect(res.items.find((v) => v.id === first.id)).toBeUndefined()
      expect(res.total).toBe(2)
    })

    it('returns pageCount=1 when empty', async () => {
      await db.delete(vehicles)
      const res = await listVehicles({ page: 1, size: 25 })
      expect(res.total).toBe(0)
      expect(res.pageCount).toBe(1)
    })
  })

  describe('updateVehicle', () => {
    it('updates fields and refreshes updatedAt', async () => {
      const created = await createVehicle({ make: 'VW', model: 'Polo' })
      const updated = await updateVehicle(created.id, { model: 'Golf' })
      expect(updated.model).toBe('Golf')
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        created.updatedAt.getTime()
      )
    })

    it('writes a new license-plate version when the plate changes', async () => {
      const created = await createVehicle({
        make: 'VW',
        model: 'Polo',
        licensePlate: 'M-AA 1111'
      })
      const updated = await updateVehicle(created.id, {
        licensePlate: 'M-BB 2222'
      })
      expect(updated.licensePlate).toBe('M-BB 2222')
      const all = await listLicensePlateVersions(created.id)
      expect(all).toHaveLength(1)
      expect(all[0].licensePlate).toBe('M-BB 2222')
    })

    it('does not write a new version when the plate is unchanged', async () => {
      const created = await createVehicle({
        make: 'VW',
        model: 'Polo',
        licensePlate: 'M-SAME 1'
      })
      await updateVehicle(created.id, { licensePlate: 'M-SAME 1' })
      const all = await listLicensePlateVersions(created.id)
      expect(all).toHaveLength(1)
    })

    it('leaves the plate untouched when licensePlate is not in the patch', async () => {
      const created = await createVehicle({
        make: 'VW',
        model: 'Polo',
        licensePlate: 'M-KEEP 1'
      })
      const updated = await updateVehicle(created.id, { model: 'Golf' })
      expect(updated.licensePlate).toBe('M-KEEP 1')
    })
  })

  describe('deleteVehicle', () => {
    it('removes the row', async () => {
      const created = await createVehicle({ make: 'VW', model: 'Polo' })
      await deleteVehicle(created.id)
      expect(await getVehicle(created.id)).toBeNull()
    })
  })

  describe('getVehicle', () => {
    it('returns null for unknown id', async () => {
      expect(
        await getVehicle('00000000-0000-0000-0000-000000000000')
      ).toBeNull()
    })

    it('returns the row with the current plate', async () => {
      const created = await createVehicle({
        make: 'VW',
        model: 'Polo',
        licensePlate: 'M-GET 1'
      })
      const fetched = await getVehicle(created.id)
      expect(fetched?.make).toBe('VW')
      expect(fetched?.licensePlate).toBe('M-GET 1')
    })
  })

  describe('countVehicles', () => {
    it('counts only non-archived vehicles', async () => {
      await db.insert(vehicles).values([
        { make: 'A', model: 'A', archived: false },
        { make: 'B', model: 'B', archived: true }
      ])
      expect(await countVehicles()).toBe(1)
    })

    it('returns 0 when the table is empty', async () => {
      expect(await countVehicles()).toBe(0)
    })
  })

  describe('getEffectiveLicensePlate', () => {
    it('returns null when no version exists', async () => {
      const v = await createVehicle({ make: 'VW', model: 'Polo' })
      expect(await getEffectiveLicensePlate(v.id)).toBeNull()
    })

    it('returns the version with the highest validFrom <= asOf', async () => {
      const v = await createVehicle({ make: 'VW', model: 'Polo' })
      await upsertLicensePlateVersion({
        vehicleId: v.id,
        validFrom: '2023-01-01',
        licensePlate: 'OLD-1'
      })
      await upsertLicensePlateVersion({
        vehicleId: v.id,
        validFrom: '2024-06-01',
        licensePlate: 'MID-1'
      })
      await upsertLicensePlateVersion({
        vehicleId: v.id,
        validFrom: '2025-01-01',
        licensePlate: 'NEW-1'
      })

      expect(
        (await getEffectiveLicensePlate(v.id, '2023-12-31'))?.licensePlate
      ).toBe('OLD-1')
      expect(
        (await getEffectiveLicensePlate(v.id, '2024-12-31'))?.licensePlate
      ).toBe('MID-1')
      expect(
        (await getEffectiveLicensePlate(v.id, '2025-12-31'))?.licensePlate
      ).toBe('NEW-1')
    })

    it('returns null when asOf is before the earliest version', async () => {
      const v = await createVehicle({ make: 'VW', model: 'Polo' })
      await upsertLicensePlateVersion({
        vehicleId: v.id,
        validFrom: '2025-01-01',
        licensePlate: 'FUTURE-1'
      })
      expect(await getEffectiveLicensePlate(v.id, '2024-12-31')).toBeNull()
    })
  })

  describe('listLicensePlateVersions', () => {
    it('returns versions newest first', async () => {
      const v = await createVehicle({ make: 'VW', model: 'Polo' })
      await upsertLicensePlateVersion({
        vehicleId: v.id,
        validFrom: '2023-01-01',
        licensePlate: 'A-1'
      })
      await upsertLicensePlateVersion({
        vehicleId: v.id,
        validFrom: '2024-06-01',
        licensePlate: 'B-1'
      })
      const rows = await listLicensePlateVersions(v.id)
      expect(rows.map((r) => r.validFrom)).toEqual(['2024-06-01', '2023-01-01'])
    })

    it('returns empty array when no versions exist', async () => {
      const v = await createVehicle({ make: 'VW', model: 'Polo' })
      expect(await listLicensePlateVersions(v.id)).toEqual([])
    })
  })

  describe('upsertLicensePlateVersion', () => {
    it('inserts when no version exists at validFrom', async () => {
      const v = await createVehicle({ make: 'VW', model: 'Polo' })
      const row = await upsertLicensePlateVersion({
        vehicleId: v.id,
        validFrom: '2025-01-01',
        licensePlate: 'X-1'
      })
      expect(row.id).toBeTruthy()
      expect(row.licensePlate).toBe('X-1')
    })

    it('updates the existing version when validFrom matches', async () => {
      const v = await createVehicle({ make: 'VW', model: 'Polo' })
      const first = await upsertLicensePlateVersion({
        vehicleId: v.id,
        validFrom: '2025-01-01',
        licensePlate: 'X-1'
      })
      const second = await upsertLicensePlateVersion({
        vehicleId: v.id,
        validFrom: '2025-01-01',
        licensePlate: 'X-2'
      })
      expect(second.id).toBe(first.id)
      expect(second.licensePlate).toBe('X-2')
      const all = await listLicensePlateVersions(v.id)
      expect(all).toHaveLength(1)
    })
  })

  describe('deleteLicensePlateVersion', () => {
    it('removes a single version', async () => {
      const v = await createVehicle({ make: 'VW', model: 'Polo' })
      const row = await upsertLicensePlateVersion({
        vehicleId: v.id,
        validFrom: '2025-01-01',
        licensePlate: 'DEL-1'
      })
      await deleteLicensePlateVersion(row.id)
      expect(await listLicensePlateVersions(v.id)).toEqual([])
    })
  })

  describe('withCurrentPlates', () => {
    it('attaches the current plate to a list of vehicle rows', async () => {
      const a = await createVehicle({
        make: 'A',
        model: 'A',
        licensePlate: 'A-1'
      })
      const b = await createVehicle({ make: 'B', model: 'B' })
      const enriched = await withCurrentPlates([
        { id: a.id, extra: 'a' },
        { id: b.id, extra: 'b' }
      ])
      expect(enriched.find((e) => e.id === a.id)?.licensePlate).toBe('A-1')
      expect(enriched.find((e) => e.id === b.id)?.licensePlate).toBeNull()
    })

    it('returns an empty array for empty input', async () => {
      expect(await withCurrentPlates([])).toEqual([])
    })
  })
})
