// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Integration tests for the shared entity pickers — focused on the
 * expanded search surface (phone / mobile / email on customers,
 * HSN / TSN on vehicles, position + private contact data on
 * employees, contact person + email on suppliers, EAN on tires) plus
 * the auth guards. Pagination shape is covered per picker via the
 * shared `buildResult`.
 *
 * Pattern mirrors `customers.remote.test.ts`: `$app/server` is
 * replaced with thin `query` wrappers that run the Valibot schema and
 * a controllable `getRequestEvent()`.
 *
 * @group integration
 * @module pickers
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

const mockRequestEvent = {
  locals: {
    user: null as { id: string; name: string; email: string } | null,
    session: null as unknown,
    permissions: new Set<string>()
  }
}

vi.mock('$app/server', async () => {
  const valibot = await import('valibot')
  type Fn = (input?: unknown) => Promise<unknown>
  type Schema = Parameters<typeof valibot.parse>[0]

  const validate = (schema: Schema | undefined, input: unknown) => {
    if (!schema) return input
    return valibot.parse(schema, input)
  }

  const makeQuery = (schema: Schema | undefined, impl: Fn) => {
    const callable = (input?: unknown) =>
      Promise.resolve().then(() => impl(validate(schema, input)))
    return Object.assign(callable, {
      refresh: () => Promise.resolve(),
      __: { type: 'query' as const }
    })
  }
  return {
    query: (schemaOrFn: unknown, fn?: Fn) => {
      if (typeof schemaOrFn === 'function') {
        return makeQuery(undefined, schemaOrFn as Fn)
      }
      return makeQuery(schemaOrFn as Schema, fn as Fn)
    },
    command: (schema: unknown, fn: Fn) => makeQuery(schema as Schema, fn),
    requested: () => ({ refreshAll: () => Promise.resolve() }),
    getRequestEvent: () => mockRequestEvent
  }
})

vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: () => {} }))

import { db } from '$lib/server/db/client'
import {
  customers,
  employees,
  suppliers,
  tires,
  vehicleLicensePlateVersions,
  vehicleListings,
  vehicles
} from '$lib/server/db/schema'
import { WILDCARD_PERMISSION } from '$lib/server/auth-permissions'
import {
  pickCustomersRemote,
  pickCustomerVehiclesRemote,
  pickEmployeesRemote,
  pickInventoryVehiclesRemote,
  pickSuppliersRemote,
  pickTiresRemote,
  pickVehiclesRemote
} from './pickers.remote'

async function resetDb() {
  await db.delete(vehicleListings)
  await db.delete(vehicleLicensePlateVersions)
  await db.delete(vehicles)
  await db.delete(customers)
  await db.delete(employees)
  await db.delete(suppliers)
  await db.delete(tires)
}

function authAs(opts: { permissions?: string[] } = {}) {
  mockRequestEvent.locals.user = {
    id: 'caller-id',
    name: 'Caller',
    email: 'caller@twincars.local'
  }
  mockRequestEvent.locals.permissions = new Set(
    opts.permissions ?? [WILDCARD_PERMISSION]
  )
}

function anonymous() {
  mockRequestEvent.locals.user = null
  mockRequestEvent.locals.permissions = new Set()
}

const page = { page: 1, size: 25 as const }

describe('pickers.remote', () => {
  beforeEach(async () => {
    await resetDb()
    anonymous()
  })

  describe('guards', () => {
    it('rejects anonymous callers with 401', async () => {
      await expect(pickCustomersRemote(page)).rejects.toMatchObject({
        status: 401
      })
    })

    it('rejects callers without the module permission with 403', async () => {
      authAs({ permissions: ['vehicles:read'] })
      await expect(pickCustomersRemote(page)).rejects.toMatchObject({
        status: 403
      })
    })
  })

  describe('pickCustomersRemote', () => {
    beforeEach(async () => {
      authAs()
      await db.insert(customers).values([
        {
          customerNumber: 'KU-1',
          lastName: 'Albers',
          phone: '030 998877',
          email: 'albers@example.de'
        },
        { customerNumber: 'KU-2', lastName: 'Braun', mobile: '0170 4433221' }
      ])
    })

    it('finds customers by phone', async () => {
      const res = await pickCustomersRemote({ ...page, q: '998877' })
      expect(res.total).toBe(1)
      expect(res.items[0].label).toContain('Albers')
    })

    it('finds customers by mobile', async () => {
      const res = await pickCustomersRemote({ ...page, q: '4433221' })
      expect(res.total).toBe(1)
      expect(res.items[0].label).toContain('Braun')
    })

    it('finds customers by email', async () => {
      const res = await pickCustomersRemote({ ...page, q: 'albers@example' })
      expect(res.total).toBe(1)
      expect(res.items[0].label).toContain('Albers')
    })

    it('excludes archived customers', async () => {
      await db
        .insert(customers)
        .values({
          customerNumber: 'KU-ARCH',
          lastName: 'Verstorben',
          archived: true
        })
      const res = await pickCustomersRemote({ ...page, q: 'Verstorben' })
      expect(res.total).toBe(0)
      expect(res.items).toEqual([])
    })
  })

  describe('vehicle pickers', () => {
    let customerId: string

    beforeEach(async () => {
      authAs()
      const [c] = await db
        .insert(customers)
        .values({ customerNumber: 'KU-9', lastName: 'Halter' })
        .returning({ id: customers.id })
      customerId = c.id
      await db.insert(vehicles).values([
        {
          make: 'VW',
          model: 'Golf',
          vin: 'WVW111',
          hsn: '0603',
          tsn: 'BJM',
          customerId
        },
        { make: 'BMW', model: '320d', vin: 'WBA222' }
      ])
    })

    it('pickVehiclesRemote finds by HSN', async () => {
      const res = await pickVehiclesRemote({ ...page, q: '0603' })
      expect(res.total).toBe(1)
      expect(res.items[0].label).toContain('Golf')
    })

    it('pickVehiclesRemote finds by TSN (case-insensitive)', async () => {
      const res = await pickVehiclesRemote({ ...page, q: 'bjm' })
      expect(res.total).toBe(1)
      expect(res.items[0].label).toContain('Golf')
    })

    it('pickCustomerVehiclesRemote finds by TSN and carries the holder', async () => {
      const res = await pickCustomerVehiclesRemote({ ...page, q: 'BJM' })
      expect(res.total).toBe(1)
      expect(res.items[0].customerId).toBe(customerId)
    })

    it('pickInventoryVehiclesRemote finds available stock by HSN', async () => {
      const [stock] = await db
        .insert(vehicles)
        .values({ make: 'Audi', model: 'A4', hsn: '0588', tsn: 'AXX' })
        .returning({ id: vehicles.id })
      await db
        .insert(vehicleListings)
        .values({
          vehicleId: stock.id,
          status: 'available',
          salesPriceGross: '19990.00'
        })
      const res = await pickInventoryVehiclesRemote({ ...page, q: '0588' })
      expect(res.total).toBe(1)
      expect(res.items[0].label).toContain('A4')
    })

    it('pickInventoryVehiclesRemote includes fresh stock without a listing row', async () => {
      // Regression: /inventory/new creates no vehicle_listings row —
      // the picker must still offer the vehicle (listing is optional,
      // mirroring listInventoryRemote), otherwise a freshly created
      // stock vehicle can never be sold via invoice position.
      await db
        .insert(vehicles)
        .values({ make: 'Skoda', model: 'Fabia', hsn: '8004', tsn: 'AJH' })
      const res = await pickInventoryVehiclesRemote({ ...page, q: 'Fabia' })
      expect(res.total).toBe(1)
      expect(res.items[0].label).toContain('Fabia')
    })

    it('pickVehiclesRemote excludes archived vehicles', async () => {
      await db
        .insert(vehicles)
        .values({
          make: 'Opel',
          model: 'Corsa',
          vin: 'WOL333',
          customerId,
          archived: true
        })
      const res = await pickVehiclesRemote({ ...page, q: 'Corsa' })
      expect(res.total).toBe(0)
    })

    it('pickInventoryVehiclesRemote excludes archived stock', async () => {
      await db
        .insert(vehicles)
        .values({ make: 'Fiat', model: 'Panda', archived: true })
      const res = await pickInventoryVehiclesRemote({ ...page, q: 'Panda' })
      expect(res.total).toBe(0)
    })

    it('pickInventoryVehiclesRemote excludes sold listings', async () => {
      const [sold] = await db
        .insert(vehicles)
        .values({ make: 'Seat', model: 'Ibiza' })
        .returning({ id: vehicles.id })
      await db
        .insert(vehicleListings)
        .values({ vehicleId: sold.id, status: 'sold' })
      const res = await pickInventoryVehiclesRemote({ ...page, q: 'Ibiza' })
      expect(res.total).toBe(0)
    })
  })

  describe('pickEmployeesRemote', () => {
    beforeEach(async () => {
      authAs()
      await db.insert(employees).values([
        {
          personnelNumber: 'MA-1',
          firstName: 'Max',
          lastName: 'Schrauber',
          position: 'Kfz-Mechatroniker',
          privateEmail: 'max@web.de',
          mobile: '0151 2211334'
        },
        {
          personnelNumber: 'MA-2',
          firstName: 'Erika',
          lastName: 'Meisterin',
          privatePhone: '040 5544332'
        }
      ])
    })

    it('finds employees by position', async () => {
      const res = await pickEmployeesRemote({ ...page, q: 'Mechatroniker' })
      expect(res.total).toBe(1)
      expect(res.items[0].label).toContain('Schrauber')
    })

    it('finds employees by private email', async () => {
      const res = await pickEmployeesRemote({ ...page, q: 'max@web.de' })
      expect(res.total).toBe(1)
      expect(res.items[0].label).toContain('Schrauber')
    })

    it('finds employees by private phone', async () => {
      const res = await pickEmployeesRemote({ ...page, q: '5544332' })
      expect(res.total).toBe(1)
      expect(res.items[0].label).toContain('Meisterin')
    })

    it('finds employees by mobile', async () => {
      const res = await pickEmployeesRemote({ ...page, q: '2211334' })
      expect(res.total).toBe(1)
      expect(res.items[0].label).toContain('Schrauber')
    })
  })

  describe('pickSuppliersRemote', () => {
    beforeEach(async () => {
      authAs()
      await db.insert(suppliers).values([
        {
          name: 'Alpha GmbH',
          contactPerson: 'Anna Ansprech',
          email: 'einkauf@alpha.de'
        },
        { name: 'Beta AG', city: 'Hamburg' }
      ])
    })

    it('finds suppliers by contact person', async () => {
      const res = await pickSuppliersRemote({ ...page, q: 'Ansprech' })
      expect(res.total).toBe(1)
      expect(res.items[0].label).toContain('Alpha GmbH')
    })

    it('finds suppliers by email', async () => {
      const res = await pickSuppliersRemote({ ...page, q: 'einkauf@alpha' })
      expect(res.total).toBe(1)
      expect(res.items[0].label).toContain('Alpha GmbH')
    })
  })

  describe('pickTiresRemote', () => {
    beforeEach(async () => {
      authAs()
      await db.insert(tires).values([
        {
          articleNumber: 'T-1',
          brand: 'Michelin',
          model: 'CrossClimate',
          width: 205,
          aspectRatio: 55,
          diameterInch: 16,
          season: 'Ganzjahres',
          ean: '4027784567890'
        },
        {
          articleNumber: 'T-2',
          brand: 'Continental',
          model: 'WinterContact',
          width: 195,
          aspectRatio: 65,
          diameterInch: 15,
          season: 'Winter'
        }
      ])
    })

    it('finds tires by EAN', async () => {
      const res = await pickTiresRemote({ ...page, q: '4027784567890' })
      expect(res.total).toBe(1)
      expect(res.items[0].articleNumber).toBe('T-1')
    })
  })
})
