// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Integration tests for the inventory list — focused on the "stock =
 * customer-less" semantics: historical `vehicle_sales` rows must NOT
 * hide a re-purchased vehicle, while a sold vehicle (buyer set as
 * `customer_id`) drops out. Runs against pg-mem via the shared
 * `$app/server` mock pattern.
 *
 * @group integration
 * @module inventory
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
  vehicleListings,
  vehicleSales,
  vehicles
} from '$lib/server/db/schema'
import { listInventoryRemote } from './inventory.remote'

const asInventoryUser = () => {
  mockRequestEvent.locals.user = {
    id: 'u1',
    name: 'Test',
    email: 'u1@twincars.local'
  }
  mockRequestEvent.locals.permissions = new Set(['inventory'])
}

type ListResult = { items: Array<{ id: string }>; total: number }

describe('inventory.remote — listInventoryRemote', () => {
  beforeEach(async () => {
    await db.delete(vehicleSales)
    await db.delete(vehicleListings)
    await db.delete(vehicles)
    await db.delete(customers)
    asInventoryUser()
  })

  it('shows a re-purchased vehicle despite an old sale row', async () => {
    const [buyer] = await db
      .insert(customers)
      .values({ customerNumber: 'KU-N0001' })
      .returning({ id: customers.id })
    // Stock vehicle that was sold once and later bought back:
    // customer_id is NULL again, but the historical sale row remains.
    const [veh] = await db
      .insert(vehicles)
      .values({ make: 'VW', model: 'Golf', customerId: null })
      .returning({ id: vehicles.id })
    await db
      .insert(vehicleSales)
      .values({
        vehicleId: veh.id,
        customerId: buyer.id,
        saleDate: '2026-06-15',
        salesPriceGross: '9990.00'
      })

    const res = (await listInventoryRemote({ page: 1, size: 25 })) as ListResult
    expect(res.total).toBe(1)
    expect(res.items[0].id).toBe(veh.id)
  })

  it('hides sold vehicles (buyer set as customer_id)', async () => {
    const [buyer] = await db
      .insert(customers)
      .values({ customerNumber: 'KU-N0002' })
      .returning({ id: customers.id })
    await db
      .insert(vehicles)
      .values({ make: 'BMW', model: '320d', customerId: buyer.id })

    const res = (await listInventoryRemote({ page: 1, size: 25 })) as ListResult
    expect(res.total).toBe(0)
  })

  it('does not duplicate a vehicle with multiple historical sales', async () => {
    const [buyer] = await db
      .insert(customers)
      .values({ customerNumber: 'KU-N0003' })
      .returning({ id: customers.id })
    const [veh] = await db
      .insert(vehicles)
      .values({ make: 'Audi', model: 'A4', customerId: null })
      .returning({ id: vehicles.id })
    await db.insert(vehicleSales).values([
      {
        vehicleId: veh.id,
        customerId: buyer.id,
        saleDate: '2025-01-01',
        salesPriceGross: '8000.00'
      },
      {
        vehicleId: veh.id,
        customerId: buyer.id,
        saleDate: '2026-01-01',
        salesPriceGross: '8500.00'
      }
    ])

    const res = (await listInventoryRemote({ page: 1, size: 25 })) as ListResult
    expect(res.total).toBe(1)
    expect(res.items).toHaveLength(1)
  })

  it('rejects callers without the inventory permission (403)', async () => {
    mockRequestEvent.locals.permissions = new Set(['vehicles'])
    await expect(
      listInventoryRemote({ page: 1, size: 25 })
    ).rejects.toMatchObject({ status: 403 })
  })
})
