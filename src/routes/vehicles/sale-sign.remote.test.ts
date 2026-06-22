// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Security + happy-path integration tests for the vehicle sale-sign
 * remote. Same mocking pattern as `items/labels.remote.test.ts`.
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
  },
  url: new URL('http://localhost:5173/vehicles/some-id')
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
  return {
    query: (schemaOrFn: unknown, fn?: Fn) => {
      if (typeof schemaOrFn === 'function') {
        return makeQuery(undefined, schemaOrFn as Fn)
      }
      return makeQuery(schemaOrFn as Schema, fn as Fn)
    },
    command: () => () => Promise.resolve(),
    requested: () => ({ refreshAll: () => Promise.resolve() }),
    getRequestEvent: () => mockRequestEvent
  }
})

vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: () => {} }))

import { db } from '$lib/server/db/client'
import {
  companySettings,
  vehicleListings,
  vehiclePhotos,
  vehicles
} from '$lib/server/db/schema'
import { WILDCARD_PERMISSION } from '$lib/server/auth-permissions'
import { getVehicleSaleSignPdfRemote } from './sale-sign.remote'

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
  expect((caught as { status?: number }).status).toBe(status)
}

function authAs(opts: { permissions?: string[] } = {}) {
  mockRequestEvent.locals.user = {
    id: 'caller-id',
    name: 'Caller',
    email: 'caller@twincars.local'
  }
  mockRequestEvent.locals.permissions = new Set(opts.permissions ?? [])
}

function anonymous() {
  mockRequestEvent.locals.user = null
  mockRequestEvent.locals.permissions = new Set()
}

describe('vehicles.sale-sign.remote — getVehicleSaleSignPdfRemote', () => {
  let vehicleId: string

  beforeEach(async () => {
    await db.delete(vehiclePhotos)
    await db.delete(vehicleListings)
    await db.delete(vehicles)
    await db.delete(companySettings)
    anonymous()

    await db
      .insert(companySettings)
      .values({
        companyName: 'Demo Werkstatt GmbH',
        street: 'Werkstattstr. 1',
        zip: '10115',
        city: 'Berlin',
        phone: '030/123456'
      })

    const [vehicle] = await db
      .insert(vehicles)
      .values({
        make: 'Volkswagen',
        model: 'Golf VII',
        vin: 'WVWZZZ1KZAW123456',
        firstRegistration: '2018-04-01',
        mileageKm: 84500,
        fuelType: 'Benzin',
        powerKw: 92,
        colorCode: 'Reflex Silver'
      })
      .returning()
    vehicleId = vehicle.id

    await db
      .insert(vehicleListings)
      .values({
        vehicleId,
        status: 'available',
        salesPriceGross: '14990.00',
        differentialTax: true,
        highlights: 'Scheckheftgepflegt\nNichtraucherfahrzeug'
      })
  })

  it('rejects anonymous callers with 401', async () => {
    await expectHttpError(
      () => getVehicleSaleSignPdfRemote({ id: vehicleId }),
      401
    )
  })

  it('rejects callers without vehicles:read with 403', async () => {
    authAs({ permissions: ['items'] })
    await expectHttpError(
      () => getVehicleSaleSignPdfRemote({ id: vehicleId }),
      403
    )
  })

  it('returns 404 for an unknown vehicle id', async () => {
    authAs({ permissions: [WILDCARD_PERMISSION] })
    await expectHttpError(
      () =>
        getVehicleSaleSignPdfRemote({
          id: '00000000-0000-0000-0000-000000000000'
        }),
      404
    )
  })

  it('returns a base64 PDF for an authorized caller', async () => {
    authAs({ permissions: ['vehicles'] })
    const res = await getVehicleSaleSignPdfRemote({ id: vehicleId })
    expect(res.mime).toBe('application/pdf')
    expect(res.filename).toMatch(/Verkaufsschild/)
    const bytes = Buffer.from(res.data, 'base64')
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    // A4 landscape is 842 × 595 pt; the bytes should be a non-trivial
    // PDF (well over 1 KB once a QR is embedded).
    expect(bytes.length).toBeGreaterThan(1024)
  })

  it('still works when no listing row exists yet', async () => {
    await db.delete(vehicleListings)
    authAs({ permissions: ['vehicles'] })
    const res = await getVehicleSaleSignPdfRemote({ id: vehicleId })
    expect(res.mime).toBe('application/pdf')
    expect(Buffer.from(res.data, 'base64').subarray(0, 5).toString()).toBe(
      '%PDF-'
    )
  })
})
