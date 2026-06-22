// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Security + happy-path integration tests for the tire-storage QR
 * label remote. Same mocking pattern as `items/labels.remote.test.ts`.
 *
 * @group integration
 * @module tire-storage
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
  url: new URL('http://localhost:5173/tire-storage/some-id')
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
import { customers, tireStorage } from '$lib/server/db/schema'
import { WILDCARD_PERMISSION } from '$lib/server/auth-permissions'
import { getTireStorageLabelPdfRemote } from './labels.remote'

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

describe('tire-storage.labels.remote — getTireStorageLabelPdfRemote', () => {
  let entryId: string

  beforeEach(async () => {
    await db.delete(tireStorage)
    await db.delete(customers)
    anonymous()

    const [c] = await db
      .insert(customers)
      .values({
        customerNumber: 'KU-00001',
        firstName: 'Max',
        lastName: 'Mustermann'
      })
      .returning()

    const [entry] = await db
      .insert(tireStorage)
      .values({
        storageNumber: 'L-2026-0001',
        customerId: c.id,
        brand: 'Continental',
        model: 'WinterContact',
        size: '205/55 R16',
        season: 'winter',
        quantity: 4,
        storedAt: '2026-04-01'
      })
      .returning()
    entryId = entry.id
  })

  it('rejects anonymous callers with 401', async () => {
    await expectHttpError(
      () => getTireStorageLabelPdfRemote({ id: entryId }),
      401
    )
  })

  it('rejects callers without tires:read with 403', async () => {
    authAs({ permissions: ['vehicles'] })
    await expectHttpError(
      () => getTireStorageLabelPdfRemote({ id: entryId }),
      403
    )
  })

  it('returns 404 for an unknown entry id', async () => {
    authAs({ permissions: [WILDCARD_PERMISSION] })
    await expectHttpError(
      () =>
        getTireStorageLabelPdfRemote({
          id: '00000000-0000-0000-0000-000000000000'
        }),
      404
    )
  })

  it('returns a base64 PDF for an authorized caller', async () => {
    authAs({ permissions: ['tires'] })
    const res = await getTireStorageLabelPdfRemote({ id: entryId })
    expect(res.mime).toBe('application/pdf')
    expect(res.filename).toContain('L-2026-0001')
    const bytes = Buffer.from(res.data, 'base64')
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
  })
})
