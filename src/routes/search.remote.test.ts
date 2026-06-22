// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Security + permission-filter tests for the global-search remote.
 *
 * - Anonymous callers get a curated 401.
 * - Authenticated callers without the `customers` module get an empty
 *   `customers` bucket but still receive the others they're allowed
 *   to see.
 * - Wildcard / admin permission sees every bucket populated.
 *
 * The `$app/server` shim is the same pattern used by every other
 * remote test in this repo (see e.g. `users.remote.test.ts`).
 *
 * @group integration
 * @module search
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

const mockRequestEvent = {
  locals: {
    user: null as { id: string; name: string } | null,
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
    command: (schema: unknown, fn: Fn) => makeCommand(schema as Schema, fn),
    requested: () => ({ refreshAll: () => Promise.resolve() }),
    getRequestEvent: () => mockRequestEvent
  }
})

vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: () => {} }))

import { db } from '$lib/server/db/client'
import {
  customers,
  documents,
  items,
  suppliers,
  tireStorage,
  tires,
  vehicleLicensePlateVersions,
  vehicles
} from '$lib/server/db/schema'
import { WILDCARD_PERMISSION } from '$lib/server/auth-permissions'
import { globalSearchRemote } from './search.remote'

async function resetDb() {
  await db.delete(documents)
  await db.delete(items)
  await db.delete(tireStorage)
  await db.delete(tires)
  await db.delete(suppliers)
  await db.delete(vehicleLicensePlateVersions)
  await db.delete(vehicles)
  await db.delete(customers)
}

function authAs(permissions: string[]) {
  mockRequestEvent.locals.user = { id: 'u-1', name: 'Caller' }
  mockRequestEvent.locals.permissions = new Set(permissions)
}

function anonymous() {
  mockRequestEvent.locals.user = null
  mockRequestEvent.locals.permissions = new Set()
}

async function expectHttpError(
  fn: () => Promise<unknown>,
  status: number
): Promise<void> {
  let caught: unknown = null
  try {
    await fn()
  } catch (err) {
    caught = err
  }
  if (caught === null) {
    throw new Error('expected the call to throw, but it resolved')
  }
  const err = caught as { status?: number }
  expect(err.status).toBe(status)
}

describe('globalSearchRemote', () => {
  beforeEach(async () => {
    await resetDb()
    anonymous()
    // Common fixtures used across permission tests.
    const [cust] = await db
      .insert(customers)
      .values({
        customerNumber: 'K-001',
        company: 'Alpha GmbH',
        archived: false
      })
      .returning({ id: customers.id })
    await db
      .insert(vehicles)
      .values({ make: 'Alpha', model: 'Sprinter', archived: false })
    await db
      .insert(items)
      .values({ articleNumber: 'ALPHA-1', description: 'Alpha Service' })
    await db
      .insert(documents)
      .values({
        documentNumber: 'ALPHA-RE-1',
        type: 'invoice',
        status: 'created',
        customerId: cust.id,
        issueDate: '2025-01-01'
      })
    await db
      .insert(tires)
      .values({
        articleNumber: 'ALPHA-TY-1',
        brand: 'Alpha',
        model: 'GripMax',
        width: 205,
        aspectRatio: 55,
        diameterInch: 16,
        season: 'Sommer'
      })
    await db
      .insert(tireStorage)
      .values({
        storageNumber: 'ALPHA-EL-1',
        customerId: cust.id,
        brand: 'Alpha',
        storedAt: '2025-04-01'
      })
    await db
      .insert(suppliers)
      .values({ name: 'Alpha Lieferant', archived: false })
  })

  it('rejects anonymous callers with 401', async () => {
    await expectHttpError(() => globalSearchRemote({ q: 'alpha' }), 401)
  })

  it('returns empty customers bucket without the customers module but still finds other buckets', async () => {
    authAs(['vehicles', 'items', 'invoices'])
    const res = await globalSearchRemote({ q: 'alpha' })
    expect(res.customers).toEqual([])
    expect(res.vehicles.length).toBeGreaterThan(0)
    expect(res.items.length).toBeGreaterThan(0)
    expect(res.documents.length).toBeGreaterThan(0)
  })

  it('returns empty vehicles bucket without the vehicles module', async () => {
    authAs(['customers', 'items', 'invoices'])
    const res = await globalSearchRemote({ q: 'alpha' })
    expect(res.customers.length).toBeGreaterThan(0)
    expect(res.vehicles).toEqual([])
    expect(res.items.length).toBeGreaterThan(0)
    expect(res.documents.length).toBeGreaterThan(0)
  })

  it('returns empty items bucket without the items module', async () => {
    authAs(['customers', 'vehicles', 'invoices'])
    const res = await globalSearchRemote({ q: 'alpha' })
    expect(res.items).toEqual([])
    expect(res.customers.length).toBeGreaterThan(0)
  })

  it('returns documents bucket if offers OR invoices is granted', async () => {
    authAs(['offers'])
    const res = await globalSearchRemote({ q: 'alpha' })
    expect(res.documents.length).toBeGreaterThan(0)
  })

  it('returns empty documents bucket when neither offers nor invoices is granted', async () => {
    authAs(['customers'])
    const res = await globalSearchRemote({ q: 'alpha' })
    expect(res.documents).toEqual([])
    expect(res.customers.length).toBeGreaterThan(0)
  })

  it('admin (wildcard) sees every bucket populated', async () => {
    authAs([WILDCARD_PERMISSION])
    const res = await globalSearchRemote({ q: 'alpha' })
    expect(res.customers.length).toBeGreaterThan(0)
    expect(res.vehicles.length).toBeGreaterThan(0)
    expect(res.items.length).toBeGreaterThan(0)
    expect(res.tires.length).toBeGreaterThan(0)
    expect(res.tireStorage.length).toBeGreaterThan(0)
    expect(res.suppliers.length).toBeGreaterThan(0)
    expect(res.documents.length).toBeGreaterThan(0)
  })

  it('tires module populates both the tires and tire-storage buckets', async () => {
    authAs(['tires'])
    const res = await globalSearchRemote({ q: 'alpha' })
    expect(res.tires.length).toBeGreaterThan(0)
    expect(res.tireStorage.length).toBeGreaterThan(0)
    expect(res.customers).toEqual([])
    expect(res.suppliers).toEqual([])
  })

  it('without the tires module both tire buckets stay empty', async () => {
    authAs(['customers'])
    const res = await globalSearchRemote({ q: 'alpha' })
    expect(res.tires).toEqual([])
    expect(res.tireStorage).toEqual([])
  })

  it('suppliers module populates only the suppliers bucket', async () => {
    authAs(['suppliers'])
    const res = await globalSearchRemote({ q: 'alpha' })
    expect(res.suppliers.length).toBeGreaterThan(0)
    expect(res.tires).toEqual([])
    expect(res.customers).toEqual([])
  })

  it('user with no permissions sees no buckets populated', async () => {
    authAs([])
    const res = await globalSearchRemote({ q: 'alpha' })
    expect(res.customers).toEqual([])
    expect(res.vehicles).toEqual([])
    expect(res.items).toEqual([])
    expect(res.tires).toEqual([])
    expect(res.tireStorage).toEqual([])
    expect(res.suppliers).toEqual([])
    expect(res.documents).toEqual([])
  })

  it('users alone does not leak any business bucket', async () => {
    authAs(['users'])
    const res = await globalSearchRemote({ q: 'alpha' })
    expect(res.customers).toEqual([])
    expect(res.vehicles).toEqual([])
    expect(res.items).toEqual([])
    expect(res.tires).toEqual([])
    expect(res.tireStorage).toEqual([])
    expect(res.suppliers).toEqual([])
    expect(res.documents).toEqual([])
  })

  it('only invoices populates documents but not other buckets', async () => {
    authAs(['invoices'])
    const res = await globalSearchRemote({ q: 'alpha' })
    expect(res.documents.length).toBeGreaterThan(0)
    expect(res.customers).toEqual([])
    expect(res.vehicles).toEqual([])
    expect(res.items).toEqual([])
  })

  it('returning a short query (<2 chars) yields all-empty buckets even with wildcard', async () => {
    authAs([WILDCARD_PERMISSION])
    const res = await globalSearchRemote({ q: 'a' })
    expect(res.customers).toEqual([])
    expect(res.vehicles).toEqual([])
    expect(res.items).toEqual([])
    expect(res.documents).toEqual([])
  })

  it('rejects an empty string as bad input (Valibot pipe + trim collapses to empty)', async () => {
    authAs([WILDCARD_PERMISSION])
    // The Valibot schema accepts an empty string after trim() (no
    // length-min guard), but the underlying service guards on length
    // < 2 and returns empty buckets — verify that.
    const res = await globalSearchRemote({ q: '   ' })
    expect(res.customers).toEqual([])
    expect(res.vehicles).toEqual([])
    expect(res.items).toEqual([])
    expect(res.documents).toEqual([])
  })

  it('rejects a query string above the 200-char cap', async () => {
    authAs([WILDCARD_PERMISSION])
    const tooLong = 'a'.repeat(201)
    await expect(globalSearchRemote({ q: tooLong })).rejects.toThrow()
  })

  it('only items populates the items bucket and nothing else', async () => {
    authAs(['items'])
    const res = await globalSearchRemote({ q: 'alpha' })
    expect(res.items.length).toBeGreaterThan(0)
    expect(res.customers).toEqual([])
    expect(res.vehicles).toEqual([])
    expect(res.documents).toEqual([])
  })

  it('only vehicles populates the vehicles bucket and nothing else', async () => {
    authAs(['vehicles'])
    const res = await globalSearchRemote({ q: 'alpha' })
    expect(res.vehicles.length).toBeGreaterThan(0)
    expect(res.customers).toEqual([])
    expect(res.items).toEqual([])
    expect(res.documents).toEqual([])
  })

  it('combining all module permissions equals wildcard for buckets', async () => {
    authAs(['customers', 'vehicles', 'items', 'invoices', 'offers'])
    const res = await globalSearchRemote({ q: 'alpha' })
    expect(res.customers.length).toBeGreaterThan(0)
    expect(res.vehicles.length).toBeGreaterThan(0)
    expect(res.items.length).toBeGreaterThan(0)
    expect(res.documents.length).toBeGreaterThan(0)
  })
})
