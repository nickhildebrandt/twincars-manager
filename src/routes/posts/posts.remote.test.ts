// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Permission + validation tests for the posts remote. Covers the
 * `requirePermission('posts')` guard, basic CRUD, the publish flip,
 * and the secure cover-image validation (MIME allowlist + size cap).
 *
 * The `$app/server` shim mirrors every other remote test in this repo.
 *
 * @group integration
 * @module posts
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
import { posts } from '$lib/server/db/schema'
import {
  createPostRemote,
  listPostsRemote,
  setPostPublishedRemote
} from './posts.remote'

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
  if (caught === null) throw new Error('expected the call to throw')
  expect((caught as { status?: number }).status).toBe(status)
}

const validInput = { title: 'Mein Beitrag', body: 'Inhalt', published: false }

describe('posts.remote', () => {
  beforeEach(async () => {
    await db.delete(posts)
    anonymous()
  })

  it('rejects anonymous callers with 401', async () => {
    await expectHttpError(() => createPostRemote(validInput), 401)
  })

  it('rejects callers without the posts permission with 403', async () => {
    authAs(['customers'])
    await expectHttpError(() => createPostRemote(validInput), 403)
  })

  it('creates a post for a caller holding posts', async () => {
    authAs(['posts'])
    const created = await createPostRemote(validInput)
    expect(created.title).toBe('Mein Beitrag')
    expect(created.slug).toBe('mein-beitrag')
  })

  it('wildcard permission can create', async () => {
    authAs(['*'])
    const created = await createPostRemote({
      ...validInput,
      title: 'Admin Post'
    })
    expect(created.slug).toBe('admin-post')
  })

  it('accepts a valid PNG cover image', async () => {
    authAs(['posts'])
    const created = await createPostRemote({
      ...validInput,
      title: 'Mit Bild',
      coverImage: { mime: 'image/png', data: 'data:image/png;base64,AAAA' }
    })
    expect(created.coverImage?.mime).toBe('image/png')
  })

  // Validation rejections surface as a thrown ValiError at the schema
  // boundary (in production `handleValidationError` maps these to a
  // curated German 400). Here we assert the parse rejects the payload.
  it('rejects a cover image with a disallowed MIME type', async () => {
    authAs(['posts'])
    await expect(
      createPostRemote({
        ...validInput,
        coverImage: { mime: 'image/svg+xml', data: 'x' }
      })
    ).rejects.toThrow()
  })

  it('rejects a cover image over the size cap', async () => {
    authAs(['posts'])
    await expect(
      createPostRemote({
        ...validInput,
        coverImage: { mime: 'image/png', data: 'A'.repeat(7_000_001) }
      })
    ).rejects.toThrow()
  })

  it('publish flip stamps publishedAt', async () => {
    authAs(['posts'])
    const created = await createPostRemote(validInput)
    expect(created.publishedAt).toBeNull()
    const published = await setPostPublishedRemote({
      id: created.id,
      published: true
    })
    expect(published.published).toBe(true)
    expect(published.publishedAt).not.toBeNull()
  })

  it('list is gated by the posts permission', async () => {
    authAs(['customers'])
    await expectHttpError(
      () => listPostsRemote({ page: 1, size: 25, published: 'all' }),
      403
    )
  })
})
