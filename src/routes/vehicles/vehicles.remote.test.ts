// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Integration tests for the vehicle remote input schema — focused on
 * the optional `previousOwnerCustomerId` relation: accepted on create,
 * cleared with an explicit `null` on update, untouched when omitted.
 * Runs against pg-mem via the shared `$app/server` mock pattern.
 *
 * @group integration
 * @module vehicles
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
  const callQuery = (schema: Schema | undefined, impl: Fn, input?: unknown) => {
    const promise = (async () => impl(validate(schema, input)))()
    return Object.assign(promise, { refresh: () => Promise.resolve() })
  }
  const makeQuery = (schema: Schema | undefined, impl: Fn) => {
    const callable = (input?: unknown) => callQuery(schema, impl, input)
    return Object.assign(callable, {
      refresh: () => Promise.resolve(),
      __: { type: 'query' as const }
    })
  }
  const makeCommand = (schema: Schema | undefined, impl: Fn) => {
    const callable = (input?: unknown) =>
      Promise.resolve().then(() => impl(validate(schema, input)))
    return Object.assign(callable, { __: { type: 'command' as const } })
  }
  return {
    query: (schemaOrFn: unknown, fn?: Fn) => {
      if (typeof schemaOrFn === 'function') {
        return makeQuery(undefined, schemaOrFn as Fn)
      }
      return makeQuery(schemaOrFn as Schema, fn as Fn)
    },
    command: (schemaOrFn: unknown, fn?: Fn) => {
      if (typeof schemaOrFn === 'function') {
        return makeCommand(undefined, schemaOrFn as Fn)
      }
      return makeCommand(schemaOrFn as Schema, fn as Fn)
    },
    requested: () => ({ refreshAll: () => Promise.resolve() }),
    getRequestEvent: () => mockRequestEvent
  }
})

vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: () => {} }))

import { db } from '$lib/server/db/client'
import {
  customers,
  vehicleLicensePlateVersions,
  vehiclePhotos,
  vehiclePurchases,
  vehicles,
  workOrders
} from '$lib/server/db/schema'
import {
  addVehiclePhotoRemote,
  createVehicleRemote,
  deleteVehicleRemote,
  getVehicleRemote,
  listVehiclePhotosRemote,
  purchaseVehicleIntoStockRemote,
  setVehicleArchivedRemote,
  updateVehicleRemote
} from './vehicles.remote'
import { eq } from 'drizzle-orm'

const asVehiclesUser = () => {
  mockRequestEvent.locals.user = {
    id: 'u1',
    name: 'Test',
    email: 'u1@twincars.local'
  }
  mockRequestEvent.locals.permissions = new Set(['vehicles'])
}

const withPermissions = (...keys: string[]) => {
  mockRequestEvent.locals.user = {
    id: 'u1',
    name: 'Test',
    email: 'u1@twincars.local'
  }
  mockRequestEvent.locals.permissions = new Set(keys)
}

const seedCustomer = async (): Promise<string> => {
  const [row] = await db
    .insert(customers)
    .values({
      customerNumber: 'KU-R0001',
      company: 'Ankauf GmbH',
      city: 'Kiel'
    })
    .returning({ id: customers.id })
  return row.id
}

describe('vehicles.remote — previousOwnerCustomerId', () => {
  beforeEach(async () => {
    await db.delete(vehiclePurchases)
    await db.delete(vehicleLicensePlateVersions)
    await db.delete(vehicles)
    await db.delete(customers)
    asVehiclesUser()
  })

  it('createVehicleRemote accepts and persists previousOwnerCustomerId', async () => {
    const previousOwnerId = await seedCustomer()
    const created = (await createVehicleRemote({
      make: 'VW',
      model: 'Golf',
      previousOwnerCustomerId: previousOwnerId
    })) as { id: string; previousOwnerCustomerId: string | null }
    expect(created.previousOwnerCustomerId).toBe(previousOwnerId)
    const detail = (await getVehicleRemote({ id: created.id })) as {
      previousOwnerLabel: string | null
    }
    expect(detail.previousOwnerLabel).toBe('Ankauf GmbH · Kiel')
  })

  it('createVehicleRemote works without a previous owner (optional)', async () => {
    const created = (await createVehicleRemote({
      make: 'VW',
      model: 'Polo'
    })) as { id: string; previousOwnerCustomerId: string | null }
    expect(created.previousOwnerCustomerId).toBeNull()
  })

  it('createVehicleRemote accepts an explicit null (never blocks creation)', async () => {
    const created = (await createVehicleRemote({
      make: 'Audi',
      model: 'A4',
      previousOwnerCustomerId: null
    })) as { id: string; previousOwnerCustomerId: string | null }
    expect(created.previousOwnerCustomerId).toBeNull()
  })

  it('updateVehicleRemote clears the previous owner with an explicit null', async () => {
    const previousOwnerId = await seedCustomer()
    const created = (await createVehicleRemote({
      make: 'VW',
      model: 'Golf',
      previousOwnerCustomerId: previousOwnerId
    })) as { id: string }
    const updated = (await updateVehicleRemote({
      id: created.id,
      values: { previousOwnerCustomerId: null }
    })) as { previousOwnerCustomerId: string | null }
    expect(updated.previousOwnerCustomerId).toBeNull()
  })

  it('updateVehicleRemote leaves the previous owner untouched when omitted', async () => {
    const previousOwnerId = await seedCustomer()
    const created = (await createVehicleRemote({
      make: 'VW',
      model: 'Golf',
      previousOwnerCustomerId: previousOwnerId
    })) as { id: string }
    const updated = (await updateVehicleRemote({
      id: created.id,
      values: { model: 'Golf Variant' }
    })) as { previousOwnerCustomerId: string | null; model: string | null }
    expect(updated.model).toBe('Golf Variant')
    expect(updated.previousOwnerCustomerId).toBe(previousOwnerId)
  })
})

describe('vehicles.remote — createVehicleRemote purchase data (Ankauf)', () => {
  beforeEach(async () => {
    await db.delete(vehiclePurchases)
    await db.delete(vehicleLicensePlateVersions)
    await db.delete(vehicles)
    await db.delete(customers)
    asVehiclesUser()
  })

  it('writes a vehicle_purchases row when purchaseDate is sent (stock creation)', async () => {
    const previousOwnerId = await seedCustomer()
    const created = (await createVehicleRemote({
      make: 'VW',
      model: 'Golf',
      previousOwnerCustomerId: previousOwnerId,
      purchaseDate: '2026-07-01',
      purchasePrice: 4500
    })) as { id: string }

    const rows = await db
      .select()
      .from(vehiclePurchases)
      .where(eq(vehiclePurchases.vehicleId, created.id))
    expect(rows).toHaveLength(1)
    expect(rows[0].purchaseDate).toBe('2026-07-01')
    expect(Number(rows[0].purchasePrice)).toBe(4500)
    // Rename-proof display-name snapshot of the picked Vorbesitzer.
    expect(rows[0].previousOwner).toBe('Ankauf GmbH')
  })

  it('records price 0.00 and no owner snapshot when only the date is sent', async () => {
    const created = (await createVehicleRemote({
      make: 'VW',
      model: 'Polo',
      purchaseDate: '2026-07-02'
    })) as { id: string }
    const rows = await db
      .select()
      .from(vehiclePurchases)
      .where(eq(vehiclePurchases.vehicleId, created.id))
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].purchasePrice)).toBe(0)
    expect(rows[0].previousOwner).toBeNull()
  })

  it('writes NO purchase row without purchaseDate (customer creation)', async () => {
    const created = (await createVehicleRemote({
      make: 'Audi',
      model: 'A4'
    })) as { id: string }
    const rows = await db
      .select()
      .from(vehiclePurchases)
      .where(eq(vehiclePurchases.vehicleId, created.id))
    expect(rows).toHaveLength(0)
  })

  it('rejects a negative purchase price with a German message', async () => {
    await expect(
      createVehicleRemote({
        make: 'VW',
        model: 'Golf',
        purchaseDate: '2026-07-01',
        purchasePrice: -1
      })
    ).rejects.toThrowError(/Ankaufspreis darf nicht negativ/)
  })
})

describe('vehicles.remote — purchaseVehicleIntoStockRemote', () => {
  beforeEach(async () => {
    await db.delete(vehiclePurchases)
    await db.delete(vehicleLicensePlateVersions)
    await db.delete(vehicles)
    await db.delete(customers)
  })

  const seedCustomerVehicle = async (): Promise<{
    customerId: string
    vehicleId: string
  }> => {
    const customerId = await seedCustomer()
    const [veh] = await db
      .insert(vehicles)
      .values({ make: 'VW', model: 'Golf', customerId })
      .returning({ id: vehicles.id })
    return { customerId, vehicleId: veh.id }
  }

  it('re-hangs the vehicle into stock with the inventory permission', async () => {
    withPermissions('inventory')
    const { customerId, vehicleId } = await seedCustomerVehicle()

    const updated = (await purchaseVehicleIntoStockRemote({
      id: vehicleId,
      purchaseDate: '2026-07-07',
      purchasePrice: 3000
    })) as { customerId: string | null; previousOwnerCustomerId: string | null }
    expect(updated.customerId).toBeNull()
    expect(updated.previousOwnerCustomerId).toBe(customerId)

    const rows = await db
      .select()
      .from(vehiclePurchases)
      .where(eq(vehiclePurchases.vehicleId, vehicleId))
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].purchasePrice)).toBe(3000)
    expect(rows[0].previousOwner).toBe('Ankauf GmbH')
  })

  it('rejects callers with only the vehicles permission (403)', async () => {
    withPermissions('vehicles')
    const { vehicleId } = await seedCustomerVehicle()
    await expect(
      purchaseVehicleIntoStockRemote({
        id: vehicleId,
        purchaseDate: '2026-07-07'
      })
    ).rejects.toMatchObject({ status: 403 })
    expect(await db.select().from(vehiclePurchases)).toHaveLength(0)
  })

  it('rejects anonymous callers (401)', async () => {
    mockRequestEvent.locals.user = null
    mockRequestEvent.locals.permissions = new Set()
    await expect(
      purchaseVehicleIntoStockRemote({
        id: '00000000-0000-0000-0000-000000000000',
        purchaseDate: '2026-07-07'
      })
    ).rejects.toMatchObject({ status: 401 })
  })

  it('rejects an invalid date with the German validation message', async () => {
    withPermissions('inventory')
    const { vehicleId } = await seedCustomerVehicle()
    await expect(
      purchaseVehicleIntoStockRemote({ id: vehicleId, purchaseDate: 'gestern' })
    ).rejects.toThrowError(/gültiges Datum/)
  })

  it('surfaces the 409 for a vehicle that is already stock', async () => {
    withPermissions('inventory')
    const [veh] = await db
      .insert(vehicles)
      .values({ make: 'BMW', model: '320d', customerId: null })
      .returning({ id: vehicles.id })
    await expect(
      purchaseVehicleIntoStockRemote({ id: veh.id, purchaseDate: '2026-07-07' })
    ).rejects.toMatchObject({ status: 409 })
  })
})

describe('vehicles.remote — setVehicleArchivedRemote + delete guard', () => {
  let vehicleId: string

  beforeEach(async () => {
    await db.delete(workOrders)
    await db.delete(vehiclePurchases)
    await db.delete(vehicleLicensePlateVersions)
    await db.delete(vehicles)
    await db.delete(customers)
    mockRequestEvent.locals.user = null
    mockRequestEvent.locals.permissions = new Set()
    const [row] = await db
      .insert(vehicles)
      .values({ make: 'VW', model: 'Golf' })
      .returning({ id: vehicles.id })
    vehicleId = row.id
  })

  it('rejects anonymous archive calls with 401', async () => {
    await expect(
      setVehicleArchivedRemote({ id: vehicleId, archived: true })
    ).rejects.toMatchObject({ status: 401 })
  })

  it('rejects archive calls without the vehicles module with 403', async () => {
    withPermissions('customers')
    await expect(
      setVehicleArchivedRemote({ id: vehicleId, archived: true })
    ).rejects.toMatchObject({ status: 403 })
  })

  it('archives and reactivates with the vehicles permission', async () => {
    asVehiclesUser()
    const archived = (await setVehicleArchivedRemote({
      id: vehicleId,
      archived: true
    })) as { archived: boolean }
    expect(archived.archived).toBe(true)
    const [rowAfter] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
    expect(rowAfter.archived).toBe(true)
    const restored = (await setVehicleArchivedRemote({
      id: vehicleId,
      archived: false
    })) as { archived: boolean }
    expect(restored.archived).toBe(false)
  })

  it('surfaces the 409 delete guard through the remote layer', async () => {
    asVehiclesUser()
    await db
      .insert(workOrders)
      .values({ orderNumber: 'AU-R1', title: 'Zahnriemen', vehicleId })
    await expect(deleteVehicleRemote({ id: vehicleId })).rejects.toMatchObject({
      status: 409
    })
    // Archive still works as the soft path.
    const archived = (await setVehicleArchivedRemote({
      id: vehicleId,
      archived: true
    })) as { archived: boolean }
    expect(archived.archived).toBe(true)
  })

  it('deletes an unlinked vehicle', async () => {
    asVehiclesUser()
    await deleteVehicleRemote({ id: vehicleId })
    const rows = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
    expect(rows).toHaveLength(0)
  })
})

describe('vehicles.remote — photo remotes (stock-only guard)', () => {
  let stockVehicleId: string
  let customerVehicleId: string

  const pngDataUrl = 'data:image/png;base64,AA=='

  beforeEach(async () => {
    await db.delete(vehiclePhotos)
    await db.delete(vehiclePurchases)
    await db.delete(vehicleLicensePlateVersions)
    await db.delete(vehicles)
    await db.delete(customers)
    mockRequestEvent.locals.user = null
    mockRequestEvent.locals.permissions = new Set()

    const ownerId = await seedCustomer()
    const [stock] = await db
      .insert(vehicles)
      .values({ make: 'VW', model: 'Golf', customerId: null })
      .returning({ id: vehicles.id })
    const [owned] = await db
      .insert(vehicles)
      .values({ make: 'BMW', model: '320d', customerId: ownerId })
      .returning({ id: vehicles.id })
    stockVehicleId = stock.id
    customerVehicleId = owned.id
  })

  it('adds a photo to a stock vehicle (positive path)', async () => {
    asVehiclesUser()
    const row = (await addVehiclePhotoRemote({
      vehicleId: stockVehicleId,
      mime: 'image/png',
      dataUrl: pngDataUrl
    })) as { isMain: boolean }
    expect(row.isMain).toBe(true)
    const list = (await listVehiclePhotosRemote({
      vehicleId: stockVehicleId
    })) as unknown[]
    expect(list).toHaveLength(1)
  })

  it('rejects a photo upload on a customer-owned vehicle with a curated 409', async () => {
    asVehiclesUser()
    await expect(
      addVehiclePhotoRemote({
        vehicleId: customerVehicleId,
        mime: 'image/png',
        dataUrl: pngDataUrl
      })
    ).rejects.toMatchObject({
      status: 409,
      body: {
        message: 'Fotos können nur bei Verkaufsfahrzeugen hinterlegt werden.'
      }
    })
    expect(await db.select().from(vehiclePhotos)).toHaveLength(0)
  })

  it('listing photos of a customer-owned vehicle stays allowed (empty result)', async () => {
    asVehiclesUser()
    const list = (await listVehiclePhotosRemote({
      vehicleId: customerVehicleId
    })) as unknown[]
    expect(list).toEqual([])
  })

  it('rejects anonymous photo uploads (401)', async () => {
    await expect(
      addVehiclePhotoRemote({
        vehicleId: stockVehicleId,
        mime: 'image/png',
        dataUrl: pngDataUrl
      })
    ).rejects.toMatchObject({ status: 401 })
  })
})
