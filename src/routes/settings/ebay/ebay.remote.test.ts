// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Permission tests for the eBay settings remotes: everything is gated
 * behind the `settings` module; the status payload carries no token
 * material (asserted at the service level, shape re-checked here).
 *
 * @group integration
 * @module ebay
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

vi.mock('$env/dynamic/private', () => ({ env: {} }))

const mockRequestEvent = {
  locals: {
    user: null as { id: string; name: string } | null,
    session: null as unknown,
    permissions: new Set<string>()
  }
}

vi.mock('$app/server', async () => {
  const makeCallable = (fn: (input?: unknown) => Promise<unknown>) => {
    const callable = (input?: unknown) => {
      const promise = Promise.resolve().then(() => fn(input))
      return Object.assign(promise, { refresh: () => Promise.resolve() })
    }
    return Object.assign(callable, {
      refresh: () => Promise.resolve(),
      __: { type: 'query' as const }
    })
  }
  return {
    query: (fnOrSchema: unknown, fn?: (input?: unknown) => Promise<unknown>) =>
      makeCallable(
        (typeof fnOrSchema === 'function' ? fnOrSchema : fn) as (
          input?: unknown
        ) => Promise<unknown>
      ),
    command: (
      fnOrSchema: unknown,
      fn?: (input?: unknown) => Promise<unknown>
    ) =>
      makeCallable(
        (typeof fnOrSchema === 'function' ? fnOrSchema : fn) as (
          input?: unknown
        ) => Promise<unknown>
      ),
    requested: () => ({ refreshAll: () => Promise.resolve() }),
    getRequestEvent: () => mockRequestEvent
  }
})

vi.mock('@sveltejs/kit/internal', () => ({ init_remote_functions: () => {} }))

import {
  getEbayStatusRemote,
  startEbayConnectRemote,
  disconnectEbayRemote
} from './ebay.remote'

function authAs(permissions: string[]) {
  mockRequestEvent.locals.user = { id: 'u-1', name: 'Caller' }
  mockRequestEvent.locals.permissions = new Set(permissions)
}

async function expectStatus(fn: () => Promise<unknown>, status: number) {
  let caught: unknown = null
  try {
    await fn()
  } catch (err) {
    caught = err
  }
  expect((caught as { status?: number })?.status).toBe(status)
}

beforeEach(() => {
  mockRequestEvent.locals.user = null
  mockRequestEvent.locals.permissions = new Set()
})

describe('ebay.remote permission gating', () => {
  it('rejects anonymous callers with 401 on all three remotes', async () => {
    await expectStatus(() => getEbayStatusRemote(), 401)
    await expectStatus(() => startEbayConnectRemote(), 401)
    await expectStatus(() => disconnectEbayRemote(), 401)
  })

  it('rejects callers without the settings module with 403', async () => {
    authAs(['customers', 'tires'])
    await expectStatus(() => getEbayStatusRemote(), 403)
    await expectStatus(() => startEbayConnectRemote(), 403)
    await expectStatus(() => disconnectEbayRemote(), 403)
  })

  it('settings permission gets the status (unconfigured, disconnected)', async () => {
    authAs(['settings'])
    const status = (await getEbayStatusRemote()) as {
      configured: boolean
      connected: boolean
      missingConfig: string[]
    }
    expect(status.configured).toBe(false)
    expect(status.connected).toBe(false)
    expect(status.missingConfig).toContain('EBAY_CLIENT_ID')
  })

  it('startEbayConnectRemote surfaces the German not-configured error', async () => {
    authAs(['settings'])
    await expect(startEbayConnectRemote()).rejects.toThrow(/nicht konfiguriert/)
  })
})
