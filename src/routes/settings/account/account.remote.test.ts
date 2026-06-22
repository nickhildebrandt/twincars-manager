// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { randomUUID } from 'node:crypto'

/**
 * Tests for the self-service profile remote layer
 * (`changeOwnPasswordRemote`).
 *
 * Mirrors the harness used by `users.remote.test.ts`:
 *   - `$app/server` is replaced with passthrough query/command
 *     wrappers + a controllable `getRequestEvent()`.
 *   - The DB client is backed by pg-mem via `createTestDb()`.
 *   - `$lib/server/auth` is faked so we don't pull in better-auth's
 *     real machinery — `password.hash`/`password.verify` use a simple
 *     reversible scheme that's good enough to exercise every branch.
 *
 * @group integration
 * @module account
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

vi.mock('$lib/server/auth', async () => {
  return {
    auth: {
      $context: Promise.resolve({
        password: {
          hash: async (plain: string) => `hashed:${plain}`,
          verify: async ({
            hash,
            password
          }: {
            hash: string
            password: string
          }) => hash === `hashed:${password}`
        }
      })
    }
  }
})

async function expectHttpError(
  fn: () => Promise<unknown>,
  status: number,
  messageMatch?: RegExp | string
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
  const err = caught as { status?: number; body?: { message?: string } }
  expect(err.status).toBe(status)
  if (messageMatch) {
    const msg = err.body?.message ?? ''
    if (messageMatch instanceof RegExp) {
      expect(msg).toMatch(messageMatch)
    } else {
      expect(msg).toContain(messageMatch)
    }
  }
}

import { db } from '$lib/server/db/client'
import { accounts, users } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { changeOwnPasswordRemote } from './account.remote'

async function resetDb() {
  await db.delete(accounts)
  await db.delete(users)
}

async function seedUserWithPassword(
  plainPassword: string
): Promise<{ userId: string; accountId: string }> {
  const userId = `u_${randomUUID()}`
  await db
    .insert(users)
    .values({
      id: userId,
      name: 'Test User',
      email: `${userId}@twincars.local`,
      username: userId
    })
  const accountId = `a_${randomUUID()}`
  await db
    .insert(accounts)
    .values({
      id: accountId,
      userId,
      accountId: userId,
      providerId: 'credential',
      password: `hashed:${plainPassword}`
    })
  return { userId, accountId }
}

function authAs(userId: string) {
  mockRequestEvent.locals.user = { id: userId, name: 'Test User' }
  mockRequestEvent.locals.permissions = new Set()
}

function anonymous() {
  mockRequestEvent.locals.user = null
  mockRequestEvent.locals.permissions = new Set()
}

describe('account.remote – changeOwnPasswordRemote', () => {
  beforeEach(async () => {
    await resetDb()
    anonymous()
  })

  it('rejects anonymous callers with 401', async () => {
    await expectHttpError(
      () =>
        changeOwnPasswordRemote({
          currentPassword: 'whatever',
          newPassword: 'longenough',
          newPasswordConfirm: 'longenough'
        }),
      401
    )
  })

  it('rejects when the current password is wrong', async () => {
    const { userId } = await seedUserWithPassword('correct-current')
    authAs(userId)
    await expectHttpError(
      () =>
        changeOwnPasswordRemote({
          currentPassword: 'wrong-current',
          newPassword: 'brand-new-pass',
          newPasswordConfirm: 'brand-new-pass'
        }),
      400,
      /aktuelle Passwort/i
    )
  })

  it('rejects when the confirmation does not match', async () => {
    const { userId } = await seedUserWithPassword('correct-current')
    authAs(userId)
    await expect(
      changeOwnPasswordRemote({
        currentPassword: 'correct-current',
        newPassword: 'brand-new-pass',
        newPasswordConfirm: 'something-else-entirely'
      })
    ).rejects.toThrow()
  })

  it('rejects a new password that is too short', async () => {
    const { userId } = await seedUserWithPassword('correct-current')
    authAs(userId)
    await expect(
      changeOwnPasswordRemote({
        currentPassword: 'correct-current',
        newPassword: 'short',
        newPasswordConfirm: 'short'
      })
    ).rejects.toThrow()
  })

  it('rejects reusing the same password', async () => {
    const { userId } = await seedUserWithPassword('correct-current')
    authAs(userId)
    await expect(
      changeOwnPasswordRemote({
        currentPassword: 'correct-current',
        newPassword: 'correct-current',
        newPasswordConfirm: 'correct-current'
      })
    ).rejects.toThrow()
  })

  it('updates the stored hash on the happy path', async () => {
    const { userId, accountId } = await seedUserWithPassword('correct-current')
    authAs(userId)
    await changeOwnPasswordRemote({
      currentPassword: 'correct-current',
      newPassword: 'brand-new-pass',
      newPasswordConfirm: 'brand-new-pass'
    })
    const [row] = await db
      .select({ password: accounts.password })
      .from(accounts)
      .where(eq(accounts.id, accountId))
    expect(row.password).toBe('hashed:brand-new-pass')
  })

  it('verifies the new password authenticates after the change', async () => {
    const { userId, accountId } = await seedUserWithPassword('start-here')
    authAs(userId)
    await changeOwnPasswordRemote({
      currentPassword: 'start-here',
      newPassword: 'after-change',
      newPasswordConfirm: 'after-change'
    })
    const [row] = await db
      .select({ password: accounts.password })
      .from(accounts)
      .where(eq(accounts.id, accountId))
    // Equivalent to calling `verify({ hash: row.password, password: 'after-change' })`
    // — in our test fake the hash is `hashed:<plain>` so the new
    // password matches.
    expect(row.password).toBe('hashed:after-change')
    // And the old password must no longer match.
    expect(row.password).not.toBe('hashed:start-here')
  })

  it('refuses when the account has no credential password row', async () => {
    const userId = `u_${randomUUID()}`
    await db
      .insert(users)
      .values({
        id: userId,
        name: 'OAuth Only',
        email: `${userId}@twincars.local`,
        username: userId
      })
    authAs(userId)
    await expectHttpError(
      () =>
        changeOwnPasswordRemote({
          currentPassword: 'anything',
          newPassword: 'brand-new-pass',
          newPasswordConfirm: 'brand-new-pass'
        }),
      400,
      /Passwort hinterlegt/i
    )
  })
})
