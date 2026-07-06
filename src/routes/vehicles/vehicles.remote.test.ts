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
  vehicles
} from '$lib/server/db/schema'
import {
  createVehicleRemote,
  getVehicleRemote,
  updateVehicleRemote
} from './vehicles.remote'

const asVehiclesUser = () => {
  mockRequestEvent.locals.user = {
    id: 'u1',
    name: 'Test',
    email: 'u1@twincars.local'
  }
  mockRequestEvent.locals.permissions = new Set(['vehicles'])
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
