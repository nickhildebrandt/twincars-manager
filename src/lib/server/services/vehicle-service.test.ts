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
  getPublicUsedCar,
  getVehicle,
  listLicensePlateVersions,
  listPublicUsedCars,
  listVehiclePurchases,
  listVehicleSales,
  listVehicles,
  purchaseVehicleIntoStock,
  recordVehiclePurchase,
  sellStockVehicleToCustomer,
  setVehicleArchived,
  updateVehicle,
  upsertLicensePlateVersion,
  withCurrentPlates
} from './vehicle-service'
import { addVehiclePhoto, listVehiclePhotos } from './vehicle-photo-service'
import { db } from '$lib/server/db/client'
import {
  customers,
  documents,
  tireStorage,
  vehicleDocuments,
  vehicleLicensePlateVersions,
  vehicleListings,
  vehiclePhotos,
  vehiclePurchases,
  vehicleSales,
  vehicles,
  workOrders
} from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'

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
    // Delete-guard reference tables first (tire_storage has a RESTRICT
    // FK on customers), then the vehicle satellites, then the roots.
    await db.delete(workOrders)
    await db.delete(tireStorage)
    await db.delete(documents)
    await db.delete(vehicleSales)
    await db.delete(vehicleListings)
    await db.delete(vehiclePurchases)
    await db.delete(vehicleDocuments)
    await db.delete(vehiclePhotos)
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
          lastName: 'Haltermann',
          company: 'Halter & Co. KG'
        })
        .returning()

      await db.insert(vehicles).values([
        {
          make: 'VW',
          model: 'Golf',
          vin: 'WVWZZZ1KZAW111111',
          hsn: '0603',
          tsn: 'BJM',
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

    it('filters by HSN', async () => {
      const res = await listVehicles({ page: 1, size: 25, q: '0603' })
      expect(res.total).toBe(1)
      expect(res.items[0].make).toBe('VW')
    })

    it('filters by TSN (case-insensitive)', async () => {
      const res = await listVehicles({ page: 1, size: 25, q: 'bjm' })
      expect(res.total).toBe(1)
      expect(res.items[0].make).toBe('VW')
    })

    it('matches via the holder last name', async () => {
      const res = await listVehicles({ page: 1, size: 25, q: 'haltermann' })
      expect(res.total).toBe(1)
      expect(res.items[0].make).toBe('VW')
    })

    it('matches via the holder company', async () => {
      const res = await listVehicles({ page: 1, size: 25, q: 'Halter & Co' })
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

    it('hides archived vehicles from the default (active) view', async () => {
      const [first] = await db.select().from(vehicles).limit(1)
      await updateVehicle(first.id, { archived: true })
      const res = await listVehicles({ page: 1, size: 25 })
      expect(res.items.find((v) => v.id === first.id)).toBeUndefined()
      expect(res.total).toBe(2)
    })

    it('archived=true lists only archived vehicles, ignoring kind', async () => {
      const rows = await db.select().from(vehicles)
      const customerCar = rows.find((r) => r.customerId !== null)!
      const stockCar = rows.find((r) => r.customerId === null)!
      await setVehicleArchived(customerCar.id, true)
      await setVehicleArchived(stockCar.id, true)
      // kind='customer' would exclude the stock car — the archive view
      // must span both kinds so archived stock stays findable.
      const res = await listVehicles({
        page: 1,
        size: 25,
        kind: 'customer',
        archived: true
      })
      expect(res.total).toBe(2)
      expect(res.items.every((v) => v.archived)).toBe(true)
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
    it('removes an unlinked row', async () => {
      const created = await createVehicle({ make: 'VW', model: 'Polo' })
      await deleteVehicle(created.id)
      expect(await getVehicle(created.id)).toBeNull()
    })

    it('refuses (409, German) while a document references the vehicle', async () => {
      const created = await createVehicle({ make: 'VW', model: 'Polo' })
      await db
        .insert(documents)
        .values({
          documentNumber: 'RE-V1',
          type: 'invoice',
          vehicleId: created.id,
          issueDate: '2026-01-01'
        })
      await expect(deleteVehicle(created.id)).rejects.toMatchObject({
        status: 409,
        body: { message: expect.stringContaining('1 Beleg') }
      })
      // The vehicle row must be untouched.
      expect(await getVehicle(created.id)).not.toBeNull()
    })

    it('refuses while a work order references the vehicle', async () => {
      const created = await createVehicle({ make: 'BMW', model: '118i' })
      await db
        .insert(workOrders)
        .values({
          orderNumber: 'AU-V1',
          title: 'Bremsen erneuern',
          vehicleId: created.id
        })
      await expect(deleteVehicle(created.id)).rejects.toMatchObject({
        status: 409,
        body: { message: expect.stringContaining('1 Auftrag') }
      })
    })

    it('refuses while tire storage references the vehicle', async () => {
      const [holder] = await db
        .insert(customers)
        .values({ customerNumber: 'KU-TIRE', lastName: 'Reifenhalter' })
        .returning()
      const created = await createVehicle({ make: 'Audi', model: 'A3' })
      await db
        .insert(tireStorage)
        .values({
          storageNumber: 'RL-V1',
          customerId: holder.id,
          vehicleId: created.id,
          storedAt: '2026-07-01'
        })
      await expect(deleteVehicle(created.id)).rejects.toMatchObject({
        status: 409,
        body: { message: expect.stringContaining('1 Reifeneinlagerung') }
      })
    })

    it('aggregates all blocker kinds with plural counts', async () => {
      const created = await createVehicle({ make: 'Ford', model: 'Focus' })
      await db.insert(documents).values([
        {
          documentNumber: 'RE-V2',
          type: 'invoice',
          vehicleId: created.id,
          issueDate: '2026-01-01'
        },
        {
          documentNumber: 'AN-V1',
          type: 'offer',
          vehicleId: created.id,
          issueDate: '2026-01-02'
        }
      ])
      await db.insert(workOrders).values([
        { orderNumber: 'AU-V2', title: 'Inspektion', vehicleId: created.id },
        { orderNumber: 'AU-V3', title: 'HU/AU', vehicleId: created.id }
      ])
      await expect(deleteVehicle(created.id)).rejects.toMatchObject({
        status: 409,
        body: { message: expect.stringContaining('2 Belege') }
      })
      await expect(deleteVehicle(created.id)).rejects.toMatchObject({
        body: { message: expect.stringContaining('2 Aufträge') }
      })
    })
  })

  describe('setVehicleArchived', () => {
    it('archives and reactivates a vehicle', async () => {
      const created = await createVehicle({ make: 'VW', model: 'Up' })
      const archived = await setVehicleArchived(created.id, true)
      expect(archived.archived).toBe(true)
      const restored = await setVehicleArchived(created.id, false)
      expect(restored.archived).toBe(false)
    })

    it('archiving works even while linked records exist (unlike delete)', async () => {
      const created = await createVehicle({ make: 'VW', model: 'Caddy' })
      await db
        .insert(workOrders)
        .values({
          orderNumber: 'AU-V9',
          title: 'Kupplung',
          vehicleId: created.id
        })
      await expect(deleteVehicle(created.id)).rejects.toMatchObject({
        status: 409
      })
      const archived = await setVehicleArchived(created.id, true)
      expect(archived.archived).toBe(true)
    })

    it('throws a curated 404 for unknown ids', async () => {
      await expect(
        setVehicleArchived('00000000-0000-0000-0000-000000000000', true)
      ).rejects.toMatchObject({
        status: 404,
        body: { message: 'Fahrzeug nicht gefunden.' }
      })
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

    it('returns customerLabel null for stock vehicles (no owner)', async () => {
      const created = await createVehicle({ make: 'VW', model: 'Polo' })
      const fetched = await getVehicle(created.id)
      expect(fetched?.customerLabel).toBeNull()
    })

    it('derives customerLabel from the owner in picker-label format', async () => {
      const [c] = await db
        .insert(customers)
        .values({
          customerNumber: 'KU-G0001',
          company: 'Muster GmbH',
          city: 'Berlin'
        })
        .returning()
      const created = await createVehicle({
        make: 'VW',
        model: 'Golf',
        customerId: c.id
      })
      const fetched = await getVehicle(created.id)
      expect(fetched?.customerLabel).toBe('Muster GmbH · Berlin')
    })

    it('falls back to first/last name when the owner has no company', async () => {
      const [c] = await db
        .insert(customers)
        .values({
          customerNumber: 'KU-G0002',
          firstName: 'Max',
          lastName: 'Muster'
        })
        .returning()
      const created = await createVehicle({
        make: 'VW',
        model: 'Golf',
        customerId: c.id
      })
      const fetched = await getVehicle(created.id)
      expect(fetched?.customerLabel).toBe('Max Muster')
    })

    it('returns previousOwnerLabel null when no previous owner is set', async () => {
      const created = await createVehicle({ make: 'VW', model: 'Polo' })
      const fetched = await getVehicle(created.id)
      expect(fetched?.previousOwnerLabel).toBeNull()
    })

    it('derives previousOwnerLabel in picker-label format independent of the owner', async () => {
      const [previous] = await db
        .insert(customers)
        .values({
          customerNumber: 'KU-G0003',
          company: 'Alt GmbH',
          city: 'Hamburg'
        })
        .returning()
      // Stock vehicle: no owner, but a previous owner.
      const created = await createVehicle({
        make: 'VW',
        model: 'Golf',
        previousOwnerCustomerId: previous.id
      })
      const fetched = await getVehicle(created.id)
      expect(fetched?.customerLabel).toBeNull()
      expect(fetched?.previousOwnerLabel).toBe('Alt GmbH · Hamburg')
    })

    it('resolves owner and previous-owner labels side by side', async () => {
      const [owner] = await db
        .insert(customers)
        .values({
          customerNumber: 'KU-G0004',
          firstName: 'Erika',
          lastName: 'Muster'
        })
        .returning()
      const [previous] = await db
        .insert(customers)
        .values({
          customerNumber: 'KU-G0005',
          company: 'Ankauf AG',
          city: 'Kiel'
        })
        .returning()
      const created = await createVehicle({
        make: 'BMW',
        model: '320d',
        customerId: owner.id,
        previousOwnerCustomerId: previous.id
      })
      const fetched = await getVehicle(created.id)
      expect(fetched?.customerLabel).toBe('Erika Muster')
      expect(fetched?.previousOwnerLabel).toBe('Ankauf AG · Kiel')
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

  /* ── Ownership transfers (Ankauf / Verkauf) ─────────────────────── */

  const seedCustomer = async (values: {
    customerNumber: string
    firstName?: string
    lastName?: string
    company?: string
    city?: string
  }): Promise<string> => {
    const [row] = await db
      .insert(customers)
      .values(values)
      .returning({ id: customers.id })
    return row.id
  }

  describe('recordVehiclePurchase', () => {
    it('snapshots the previous owner display name and formats the price', async () => {
      const ownerId = await seedCustomer({
        customerNumber: 'KU-P0001',
        firstName: 'Anna',
        lastName: 'Alt',
        city: 'Kiel'
      })
      const v = await createVehicle({ make: 'VW', model: 'Golf' })
      const row = await recordVehiclePurchase({
        vehicleId: v.id,
        purchaseDate: '2026-07-01',
        purchasePrice: 1234.5,
        previousOwnerCustomerId: ownerId
      })
      // pg-mem does not preserve numeric scale ('1234.5' instead of
      // '1234.50' from real Postgres) — compare numerically.
      expect(Number(row.purchasePrice)).toBe(1234.5)
      // Display name (no city suffix) — rename-proof snapshot.
      expect(row.previousOwner).toBe('Anna Alt')
      expect(row.purchaseDate).toBe('2026-07-01')
    })

    it('defaults the NOT NULL price to 0.00 and allows no previous owner', async () => {
      const v = await createVehicle({ make: 'VW', model: 'Polo' })
      const row = await recordVehiclePurchase({
        vehicleId: v.id,
        purchaseDate: '2026-07-02'
      })
      expect(Number(row.purchasePrice)).toBe(0)
      expect(row.previousOwner).toBeNull()
    })
  })

  describe('sellStockVehicleToCustomer', () => {
    it('transfers a stock vehicle, writes the sale row and flips the listing', async () => {
      const buyerId = await seedCustomer({
        customerNumber: 'KU-S0001',
        firstName: 'Bernd',
        lastName: 'Neu'
      })
      const previousOwnerId = await seedCustomer({
        customerNumber: 'KU-S0002',
        company: 'Alt GmbH'
      })
      const v = await createVehicle({
        make: 'BMW',
        model: '320d',
        previousOwnerCustomerId: previousOwnerId
      })
      await db
        .insert(vehicleListings)
        .values({ vehicleId: v.id, salesPriceGross: '19990.00' })

      const updated = await sellStockVehicleToCustomer({
        vehicleId: v.id,
        customerId: buyerId,
        invoiceId: null,
        salesPriceGross: '19990.00',
        saleDate: '2026-07-07'
      })
      expect(updated?.customerId).toBe(buyerId)
      // Vorbesitzer records who the car was BOUGHT from — untouched.
      expect(updated?.previousOwnerCustomerId).toBe(previousOwnerId)

      const sales = await listVehicleSales(v.id)
      expect(sales).toHaveLength(1)
      expect(sales[0].customerId).toBe(buyerId)
      expect(Number(sales[0].salesPriceGross)).toBe(19990)
      expect(sales[0].saleDate).toBe('2026-07-07')

      const [listing] = await db
        .select()
        .from(vehicleListings)
        .where(eq(vehicleListings.vehicleId, v.id))
      expect(listing.status).toBe('sold')
    })

    it('records the invoice backlink on the sale row', async () => {
      const buyerId = await seedCustomer({ customerNumber: 'KU-S0003' })
      const v = await createVehicle({ make: 'VW', model: 'Golf' })
      const invoiceId = crypto.randomUUID()
      await sellStockVehicleToCustomer({
        vehicleId: v.id,
        customerId: buyerId,
        invoiceId,
        salesPriceGross: 9990,
        saleDate: '2026-07-07'
      })
      const sales = await listVehicleSales(v.id)
      expect(sales[0].invoiceId).toBe(invoiceId)
      expect(Number(sales[0].salesPriceGross)).toBe(9990)
    })

    it('works without a listing row (fresh stock vehicle)', async () => {
      const buyerId = await seedCustomer({ customerNumber: 'KU-S0004' })
      const v = await createVehicle({ make: 'VW', model: 'Polo' })
      const updated = await sellStockVehicleToCustomer({
        vehicleId: v.id,
        customerId: buyerId,
        salesPriceGross: 5000,
        saleDate: '2026-07-07'
      })
      expect(updated?.customerId).toBe(buyerId)
      expect(await listVehicleSales(v.id)).toHaveLength(1)
    })

    it('no-ops for a non-stock vehicle (repair invoice on a customer car)', async () => {
      const ownerId = await seedCustomer({ customerNumber: 'KU-S0005' })
      const buyerId = await seedCustomer({ customerNumber: 'KU-S0006' })
      const v = await createVehicle({
        make: 'Audi',
        model: 'A4',
        customerId: ownerId
      })
      const res = await sellStockVehicleToCustomer({
        vehicleId: v.id,
        customerId: buyerId,
        salesPriceGross: 100,
        saleDate: '2026-07-07'
      })
      expect(res).toBeNull()
      expect(await listVehicleSales(v.id)).toHaveLength(0)
      const after = await getVehicle(v.id)
      expect(after?.customerId).toBe(ownerId)
    })

    it('no-ops for an unknown vehicle', async () => {
      const buyerId = await seedCustomer({ customerNumber: 'KU-S0007' })
      const res = await sellStockVehicleToCustomer({
        vehicleId: '00000000-0000-0000-0000-000000000000',
        customerId: buyerId,
        salesPriceGross: 100,
        saleDate: '2026-07-07'
      })
      expect(res).toBeNull()
    })

    it('no-ops for an unknown buyer', async () => {
      const v = await createVehicle({ make: 'VW', model: 'Polo' })
      const res = await sellStockVehicleToCustomer({
        vehicleId: v.id,
        customerId: '00000000-0000-0000-0000-000000000000',
        salesPriceGross: 100,
        saleDate: '2026-07-07'
      })
      expect(res).toBeNull()
      const after = await getVehicle(v.id)
      expect(after?.customerId).toBeNull()
      expect(await listVehicleSales(v.id)).toHaveLength(0)
    })

    it('deletes the listing photos with the sale (stock-only invariant)', async () => {
      const buyerId = await seedCustomer({ customerNumber: 'KU-S0010' })
      const v = await createVehicle({ make: 'VW', model: 'Golf' })
      const other = await createVehicle({ make: 'BMW', model: 'X1' })
      // pg-mem cannot mix `default` and explicit values for the same
      // column across a multi-row insert — set every column explicitly.
      await db.insert(vehiclePhotos).values([
        {
          vehicleId: v.id,
          mime: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,AA==',
          isMain: true,
          sortOrder: 0
        },
        {
          vehicleId: v.id,
          mime: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,BB==',
          isMain: false,
          sortOrder: 1
        },
        {
          vehicleId: other.id,
          mime: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,CC==',
          isMain: true,
          sortOrder: 0
        }
      ])
      await sellStockVehicleToCustomer({
        vehicleId: v.id,
        customerId: buyerId,
        salesPriceGross: 9990,
        saleDate: '2026-07-07'
      })
      const sold = await db
        .select({ id: vehiclePhotos.id })
        .from(vehiclePhotos)
        .where(eq(vehiclePhotos.vehicleId, v.id))
      expect(sold).toHaveLength(0)
      // Photos of OTHER stock vehicles are untouched.
      const untouched = await db
        .select({ id: vehiclePhotos.id })
        .from(vehiclePhotos)
        .where(eq(vehiclePhotos.vehicleId, other.id))
      expect(untouched).toHaveLength(1)
    })

    it('is idempotent — a second call writes no second sale row', async () => {
      const buyerId = await seedCustomer({ customerNumber: 'KU-S0008' })
      const v = await createVehicle({ make: 'VW', model: 'Golf' })
      await sellStockVehicleToCustomer({
        vehicleId: v.id,
        customerId: buyerId,
        salesPriceGross: 9990,
        saleDate: '2026-07-07'
      })
      const second = await sellStockVehicleToCustomer({
        vehicleId: v.id,
        customerId: buyerId,
        salesPriceGross: 9990,
        saleDate: '2026-07-07'
      })
      expect(second).toBeNull()
      expect(await listVehicleSales(v.id)).toHaveLength(1)
    })

    it('blocks when a current-cycle sale row exists even with customer_id NULL', async () => {
      // Degenerate state: sale row exists (no purchase since), but the
      // FK was cleared manually. The cycle guard must refuse a second
      // sale row.
      const buyerId = await seedCustomer({ customerNumber: 'KU-S0009' })
      const v = await createVehicle({ make: 'VW', model: 'Golf' })
      await db
        .insert(vehicleSales)
        .values({
          vehicleId: v.id,
          customerId: buyerId,
          saleDate: '2026-01-01',
          salesPriceGross: '1000.00'
        })
      const res = await sellStockVehicleToCustomer({
        vehicleId: v.id,
        customerId: buyerId,
        salesPriceGross: 2000,
        saleDate: '2026-07-07'
      })
      expect(res).toBeNull()
      expect(await listVehicleSales(v.id)).toHaveLength(1)
    })
  })

  describe('purchaseVehicleIntoStock', () => {
    it('re-hangs a customer vehicle into stock with history row', async () => {
      const ownerId = await seedCustomer({
        customerNumber: 'KU-A0001',
        firstName: 'Anna',
        lastName: 'Alt',
        city: 'Kiel'
      })
      const v = await createVehicle({
        make: 'VW',
        model: 'Golf',
        customerId: ownerId
      })
      const updated = await purchaseVehicleIntoStock({
        vehicleId: v.id,
        purchasePrice: 5000,
        purchaseDate: '2026-07-01',
        notes: 'Inzahlungnahme'
      })
      expect(updated.customerId).toBeNull()
      expect(updated.previousOwnerCustomerId).toBe(ownerId)

      const purchases = await listVehiclePurchases(v.id)
      expect(purchases).toHaveLength(1)
      expect(Number(purchases[0].purchasePrice)).toBe(5000)
      expect(purchases[0].previousOwner).toBe('Anna Alt')
      expect(purchases[0].notes).toBe('Inzahlungnahme')
      expect(purchases[0].purchaseDate).toBe('2026-07-01')
    })

    it('defaults the purchase price to 0.00 when not provided', async () => {
      const ownerId = await seedCustomer({ customerNumber: 'KU-A0002' })
      const v = await createVehicle({
        make: 'VW',
        model: 'Polo',
        customerId: ownerId
      })
      await purchaseVehicleIntoStock({
        vehicleId: v.id,
        purchaseDate: '2026-07-01'
      })
      const purchases = await listVehiclePurchases(v.id)
      expect(Number(purchases[0].purchasePrice)).toBe(0)
    })

    it('throws 404 for an unknown vehicle', async () => {
      await expect(
        purchaseVehicleIntoStock({
          vehicleId: '00000000-0000-0000-0000-000000000000',
          purchaseDate: '2026-07-01'
        })
      ).rejects.toMatchObject({ status: 404 })
    })

    it('throws 409 for a vehicle that is already stock', async () => {
      const v = await createVehicle({ make: 'VW', model: 'Polo' })
      await expect(
        purchaseVehicleIntoStock({
          vehicleId: v.id,
          purchaseDate: '2026-07-01'
        })
      ).rejects.toMatchObject({
        status: 409,
        body: { message: 'Das Fahrzeug ist bereits im Verkaufsbestand.' }
      })
      expect(await listVehiclePurchases(v.id)).toHaveLength(0)
    })

    it('double call: the second Ankauf is rejected without a duplicate history row', async () => {
      const ownerId = await seedCustomer({ customerNumber: 'KU-A0005' })
      const v = await createVehicle({
        make: 'VW',
        model: 'Golf',
        customerId: ownerId
      })
      await purchaseVehicleIntoStock({
        vehicleId: v.id,
        purchaseDate: '2026-07-01'
      })
      await expect(
        purchaseVehicleIntoStock({
          vehicleId: v.id,
          purchaseDate: '2026-07-01'
        })
      ).rejects.toMatchObject({ status: 409 })
      // Exactly one purchase row; the Vorbesitzer re-hang is stable.
      expect(await listVehiclePurchases(v.id)).toHaveLength(1)
      const after = await getVehicle(v.id)
      expect(after?.customerId).toBeNull()
      expect(after?.previousOwnerCustomerId).toBe(ownerId)
    })

    it('throws 409 for an archived vehicle (reactivate first)', async () => {
      const ownerId = await seedCustomer({ customerNumber: 'KU-A0006' })
      const v = await createVehicle({
        make: 'Opel',
        model: 'Astra',
        customerId: ownerId
      })
      await setVehicleArchived(v.id, true)
      await expect(
        purchaseVehicleIntoStock({
          vehicleId: v.id,
          purchaseDate: '2026-07-01'
        })
      ).rejects.toMatchObject({
        status: 409,
        body: { message: expect.stringContaining('archiviert') }
      })
      // Ownership untouched, no history row written.
      const after = await getVehicle(v.id)
      expect(after?.customerId).toBe(ownerId)
      expect(await listVehiclePurchases(v.id)).toHaveLength(0)
    })

    it('flips a sold listing back to available but leaves other states alone', async () => {
      const ownerId = await seedCustomer({ customerNumber: 'KU-A0003' })
      const vSold = await createVehicle({
        make: 'VW',
        model: 'Golf',
        customerId: ownerId
      })
      await db
        .insert(vehicleListings)
        .values({ vehicleId: vSold.id, status: 'sold' })
      await purchaseVehicleIntoStock({
        vehicleId: vSold.id,
        purchaseDate: '2026-07-01'
      })
      const [soldListing] = await db
        .select()
        .from(vehicleListings)
        .where(eq(vehicleListings.vehicleId, vSold.id))
      expect(soldListing.status).toBe('available')

      const owner2 = await seedCustomer({ customerNumber: 'KU-A0004' })
      const vReserved = await createVehicle({
        make: 'BMW',
        model: '320d',
        customerId: owner2
      })
      await db
        .insert(vehicleListings)
        .values({ vehicleId: vReserved.id, status: 'reserved' })
      await purchaseVehicleIntoStock({
        vehicleId: vReserved.id,
        purchaseDate: '2026-07-01'
      })
      const [reservedListing] = await db
        .select()
        .from(vehicleListings)
        .where(eq(vehicleListings.vehicleId, vReserved.id))
      expect(reservedListing.status).toBe('reserved')
    })
  })

  describe('full ownership lifecycle (Ankauf → Verkauf → Ankauf)', () => {
    it('keeps history, associated data and stock visibility through two cycles', async () => {
      const customerA = await seedCustomer({
        customerNumber: 'KU-L0001',
        firstName: 'Anna',
        lastName: 'Alt'
      })
      const customerB = await seedCustomer({
        customerNumber: 'KU-L0002',
        firstName: 'Bernd',
        lastName: 'Neu'
      })

      // Customer A's vehicle with attached documents + photos.
      const v = await createVehicle({
        make: 'VW',
        model: 'Golf',
        customerId: customerA,
        licensePlate: 'KI-AA 100'
      })
      await db
        .insert(vehicleDocuments)
        .values({
          vehicleId: v.id,
          fileName: 'brief.pdf',
          mime: 'application/pdf',
          sizeBytes: 3,
          data: Buffer.from('pdf')
        })
      await db
        .insert(vehiclePhotos)
        .values({
          vehicleId: v.id,
          mime: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,AA==',
          isMain: true
        })

      // 1) Ankauf from A: vehicle becomes stock, A is the Vorbesitzer.
      const afterPurchase1 = await purchaseVehicleIntoStock({
        vehicleId: v.id,
        purchasePrice: 4000,
        purchaseDate: '2026-06-01'
      })
      expect(afterPurchase1.customerId).toBeNull()
      expect(afterPurchase1.previousOwnerCustomerId).toBe(customerA)
      const purchases1 = await listVehiclePurchases(v.id)
      expect(purchases1).toHaveLength(1)
      expect(purchases1[0].previousOwner).toBe('Anna Alt')

      // Listing goes online; the car shows in stock + public lists.
      await db
        .insert(vehicleListings)
        .values({ vehicleId: v.id, salesPriceGross: '9990.00' })
      const stock1 = await listVehicles({ page: 1, size: 25, kind: 'stock' })
      expect(stock1.items.map((i) => i.id)).toContain(v.id)
      expect((await listPublicUsedCars()).map((c) => c.id)).toContain(v.id)

      // 2) Sale to B (paid invoice): FK re-hang + sale history row.
      const invoiceId = crypto.randomUUID()
      const afterSale = await sellStockVehicleToCustomer({
        vehicleId: v.id,
        customerId: customerB,
        invoiceId,
        salesPriceGross: '9990.00',
        saleDate: '2026-06-15'
      })
      expect(afterSale?.customerId).toBe(customerB)
      // The Vorbesitzer stays A — it records who the car came FROM.
      expect(afterSale?.previousOwnerCustomerId).toBe(customerA)
      const sales1 = await listVehicleSales(v.id)
      expect(sales1).toHaveLength(1)
      expect(sales1[0].invoiceId).toBe(invoiceId)
      expect(Number(sales1[0].salesPriceGross)).toBe(9990)
      const [listingAfterSale] = await db
        .select()
        .from(vehicleListings)
        .where(eq(vehicleListings.vehicleId, v.id))
      expect(listingAfterSale.status).toBe('sold')

      // Documents follow the vehicle FK — nothing re-hung. Listing
      // photos are cycle artifacts and were deleted with the sale.
      const docs = await db
        .select({ id: vehicleDocuments.id })
        .from(vehicleDocuments)
        .where(eq(vehicleDocuments.vehicleId, v.id))
      expect(docs).toHaveLength(1)
      const photos = await db
        .select({ id: vehiclePhotos.id })
        .from(vehiclePhotos)
        .where(eq(vehiclePhotos.vehicleId, v.id))
      expect(photos).toHaveLength(0)

      // Sold car is out of every stock view.
      const stock2 = await listVehicles({ page: 1, size: 25, kind: 'stock' })
      expect(stock2.items.map((i) => i.id)).not.toContain(v.id)
      expect((await listPublicUsedCars()).map((c) => c.id)).not.toContain(v.id)
      expect(await getPublicUsedCar(v.id)).toBeNull()

      // 3) Second Ankauf, now from B — despite the old sale row the
      // vehicle must be back in stock everywhere.
      const afterPurchase2 = await purchaseVehicleIntoStock({
        vehicleId: v.id,
        purchasePrice: 6000,
        purchaseDate: '2026-07-01'
      })
      expect(afterPurchase2.customerId).toBeNull()
      expect(afterPurchase2.previousOwnerCustomerId).toBe(customerB)
      const purchases2 = await listVehiclePurchases(v.id)
      expect(purchases2).toHaveLength(2)
      expect(purchases2[0].previousOwner).toBe('Bernd Neu')
      // The old sale row stays as history.
      expect(await listVehicleSales(v.id)).toHaveLength(1)

      const stock3 = await listVehicles({ page: 1, size: 25, kind: 'stock' })
      expect(stock3.items.map((i) => i.id)).toContain(v.id)
      expect((await listPublicUsedCars()).map((c) => c.id)).toContain(v.id)
      expect((await getPublicUsedCar(v.id))?.id).toBe(v.id)
      const [listingAfterRepurchase] = await db
        .select()
        .from(vehicleListings)
        .where(eq(vehicleListings.vehicleId, v.id))
      expect(listingAfterRepurchase.status).toBe('available')

      // The re-purchase starts with a fresh, empty gallery — the
      // stock-only invariant allows adding new listing photos now.
      expect(await listVehiclePhotos(v.id)).toEqual([])
      const cyclePhoto = await addVehiclePhoto({
        vehicleId: v.id,
        mime: 'image/jpeg',
        dataUrl: 'data:image/jpeg;base64,BB=='
      })
      expect(cyclePhoto.isMain).toBe(true)

      // 4) The re-purchased car can be sold again (second cycle).
      const afterSale2 = await sellStockVehicleToCustomer({
        vehicleId: v.id,
        customerId: customerA,
        salesPriceGross: 11990,
        saleDate: '2026-07-07'
      })
      expect(afterSale2?.customerId).toBe(customerA)
      expect(await listVehicleSales(v.id)).toHaveLength(2)

      // Documents survived both cycles; the second-cycle gallery was
      // deleted with the second sale (photos never outlive a cycle).
      const docsFinal = await db
        .select({ id: vehicleDocuments.id })
        .from(vehicleDocuments)
        .where(eq(vehicleDocuments.vehicleId, v.id))
      expect(docsFinal).toHaveLength(1)
      const photosFinal = await db
        .select({ id: vehiclePhotos.id })
        .from(vehiclePhotos)
        .where(eq(vehiclePhotos.vehicleId, v.id))
      expect(photosFinal).toHaveLength(0)

      // Photo uploads on the now customer-owned car are rejected.
      await expect(
        addVehiclePhoto({
          vehicleId: v.id,
          mime: 'image/jpeg',
          dataUrl: 'data:image/jpeg;base64,CC=='
        })
      ).rejects.toMatchObject({ status: 409 })
    })
  })
})
