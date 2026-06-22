// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Security + happy-path integration tests for the article-QR-label
 * remote. Mirrors the layout in `src/routes/hours/hours.remote.test.ts`:
 * `$app/server` is replaced with passthrough wrappers and a
 * controllable `getRequestEvent()` so we can flip the caller's
 * permissions per test.
 *
 * @group integration
 * @module items
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
  url: new URL('http://localhost:5173/items/some-id')
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
import { items, itemPriceVersions } from '$lib/server/db/schema'
import { WILDCARD_PERMISSION } from '$lib/server/auth-permissions'
import { getArticleLabelPdfRemote } from './labels.remote'

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

describe('items.labels.remote — getArticleLabelPdfRemote', () => {
  let itemId: string
  let articleNumber: string

  beforeEach(async () => {
    await db.delete(itemPriceVersions)
    await db.delete(items)
    anonymous()

    articleNumber = 'ART-00042'
    const [row] = await db
      .insert(items)
      .values({
        articleNumber,
        description: 'Bremsbelagsatz vorne',
        kind: 'article',
        unit: 'Stk'
      })
      .returning()
    itemId = row.id
    await db
      .insert(itemPriceVersions)
      .values({ itemId, validFrom: '2026-01-01', unitPriceNet: '49.90' })
  })

  it('rejects anonymous callers with 401', async () => {
    await expectHttpError(() => getArticleLabelPdfRemote({ id: itemId }), 401)
  })

  it('rejects callers without items:read with 403', async () => {
    authAs({ permissions: ['vehicles'] })
    await expectHttpError(() => getArticleLabelPdfRemote({ id: itemId }), 403)
  })

  it('returns 404 for an unknown article id', async () => {
    authAs({ permissions: [WILDCARD_PERMISSION] })
    await expectHttpError(
      () =>
        getArticleLabelPdfRemote({
          id: '00000000-0000-0000-0000-000000000000'
        }),
      404
    )
  })

  it('returns a base64 PDF for an authorized caller', async () => {
    authAs({ permissions: ['items'] })
    const res = await getArticleLabelPdfRemote({ id: itemId })
    expect(res.mime).toBe('application/pdf')
    expect(res.filename).toContain('ART-00042')
    expect(res.data.length).toBeGreaterThan(100)
    // base64-decode and assert PDF magic bytes.
    const bytes = Buffer.from(res.data, 'base64')
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
  })
})
