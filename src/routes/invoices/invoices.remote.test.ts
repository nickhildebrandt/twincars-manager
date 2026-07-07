// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Integration tests for the invoice status transition, focused on the
 * enriched stock-vehicle transfer: flipping a stock-sale invoice to
 * `paid` re-hangs the vehicle onto the buyer, writes a
 * `vehicle_sales` history row (price = invoice gross total, invoice
 * backlink) and marks the listing `sold`. Repair invoices on customer
 * vehicles stay untouched, and a double "paid" is idempotent.
 * Runs against pg-mem via the shared `$app/server` mock pattern.
 *
 * @group integration
 * @module invoices
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
  documents,
  vehicleListings,
  vehiclePurchases,
  vehicleSales,
  vehicles
} from '$lib/server/db/schema'
import { setInvoiceStatusRemote } from './invoices.remote'
import { eq } from 'drizzle-orm'

const asInvoicesUser = () => {
  mockRequestEvent.locals.user = {
    id: 'u1',
    name: 'Test',
    email: 'u1@twincars.local'
  }
  mockRequestEvent.locals.permissions = new Set(['invoices'])
}

const seedCustomer = async (customerNumber: string): Promise<string> => {
  const [row] = await db
    .insert(customers)
    .values({ customerNumber, firstName: 'Bernd', lastName: 'Neu' })
    .returning({ id: customers.id })
  return row.id
}

const seedVehicle = async (customerId: string | null): Promise<string> => {
  const [row] = await db
    .insert(vehicles)
    .values({ make: 'VW', model: 'Golf', customerId })
    .returning({ id: vehicles.id })
  return row.id
}

const seedInvoice = async (params: {
  documentNumber: string
  customerId: string | null
  vehicleId: string | null
  grossTotal?: string
}): Promise<string> => {
  const [row] = await db
    .insert(documents)
    .values({
      documentNumber: params.documentNumber,
      type: 'invoice',
      status: 'sent',
      customerId: params.customerId,
      vehicleId: params.vehicleId,
      issueDate: '2026-07-01',
      netTotal: '16798.32',
      taxTotal: '3191.68',
      grossTotal: params.grossTotal ?? '19990.00'
    })
    .returning({ id: documents.id })
  return row.id
}

const todayIso = (): string => new Date().toISOString().slice(0, 10)

describe('invoices.remote — stock-vehicle transfer on payment', () => {
  beforeEach(async () => {
    await db.delete(vehicleSales)
    await db.delete(vehicleListings)
    await db.delete(vehiclePurchases)
    await db.delete(documents)
    await db.delete(vehicles)
    await db.delete(customers)
    asInvoicesUser()
  })

  it('paid transfers the stock vehicle and writes the sale history', async () => {
    const buyerId = await seedCustomer('KU-I0001')
    const vehicleId = await seedVehicle(null)
    await db
      .insert(vehicleListings)
      .values({ vehicleId, salesPriceGross: '19990.00' })
    const invoiceId = await seedInvoice({
      documentNumber: 'RE-1001',
      customerId: buyerId,
      vehicleId
    })

    await setInvoiceStatusRemote({ id: invoiceId, status: 'paid' })

    const [veh] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
    expect(veh.customerId).toBe(buyerId)

    const sales = await db
      .select()
      .from(vehicleSales)
      .where(eq(vehicleSales.vehicleId, vehicleId))
    expect(sales).toHaveLength(1)
    expect(sales[0].customerId).toBe(buyerId)
    expect(sales[0].invoiceId).toBe(invoiceId)
    // Sale price = invoice gross total (pg-mem drops trailing zeros on
    // numeric columns, so compare numerically).
    expect(Number(sales[0].salesPriceGross)).toBe(19990)
    expect(sales[0].saleDate).toBe(todayIso())

    const [listing] = await db
      .select()
      .from(vehicleListings)
      .where(eq(vehicleListings.vehicleId, vehicleId))
    expect(listing.status).toBe('sold')

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, invoiceId))
    expect(doc.status).toBe('paid')
  })

  it('a second paid call is idempotent (single sale row)', async () => {
    const buyerId = await seedCustomer('KU-I0002')
    const vehicleId = await seedVehicle(null)
    const invoiceId = await seedInvoice({
      documentNumber: 'RE-1002',
      customerId: buyerId,
      vehicleId
    })

    await setInvoiceStatusRemote({ id: invoiceId, status: 'paid' })
    await setInvoiceStatusRemote({ id: invoiceId, status: 'paid' })

    const sales = await db
      .select()
      .from(vehicleSales)
      .where(eq(vehicleSales.vehicleId, vehicleId))
    expect(sales).toHaveLength(1)
  })

  it('does not transfer on a repair invoice for a customer vehicle', async () => {
    const ownerId = await seedCustomer('KU-I0003')
    const vehicleId = await seedVehicle(ownerId)
    const invoiceId = await seedInvoice({
      documentNumber: 'RE-1003',
      customerId: ownerId,
      vehicleId,
      grossTotal: '350.00'
    })

    await setInvoiceStatusRemote({ id: invoiceId, status: 'paid' })

    const [veh] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
    expect(veh.customerId).toBe(ownerId)
    expect(veh.previousOwnerCustomerId).toBeNull()

    const sales = await db
      .select()
      .from(vehicleSales)
      .where(eq(vehicleSales.vehicleId, vehicleId))
    expect(sales).toHaveLength(0)
  })

  it('no-ops for an invoice without a vehicle', async () => {
    const buyerId = await seedCustomer('KU-I0004')
    const invoiceId = await seedInvoice({
      documentNumber: 'RE-1004',
      customerId: buyerId,
      vehicleId: null
    })

    await setInvoiceStatusRemote({ id: invoiceId, status: 'paid' })

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, invoiceId))
    expect(doc.status).toBe('paid')
    expect(await db.select().from(vehicleSales)).toHaveLength(0)
  })

  it('rejects callers without the invoices permission (403)', async () => {
    const buyerId = await seedCustomer('KU-I0005')
    const vehicleId = await seedVehicle(null)
    const invoiceId = await seedInvoice({
      documentNumber: 'RE-1005',
      customerId: buyerId,
      vehicleId
    })
    mockRequestEvent.locals.permissions = new Set(['customers'])

    await expect(
      setInvoiceStatusRemote({ id: invoiceId, status: 'paid' })
    ).rejects.toMatchObject({ status: 403 })
    expect(await db.select().from(vehicleSales)).toHaveLength(0)
  })

  it('rejects anonymous callers (401)', async () => {
    mockRequestEvent.locals.user = null
    await expect(
      setInvoiceStatusRemote({ id: crypto.randomUUID(), status: 'paid' })
    ).rejects.toMatchObject({ status: 401 })
  })
})
