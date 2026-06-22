// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetRateLimit } from '$lib/server/rate-limit'

/**
 * Tests for the cross-cutting handle chain in `hooks.server.ts`. The
 * focus here is the brute-force shield on the `/api/auth/sign-in/*`
 * endpoints; the rest of the chain (better-auth, locals, redirects)
 * is exercised via the integration tests of the individual modules.
 *
 * @group integration
 * @module hooks
 */

vi.mock('$app/environment', () => ({ building: false }))

vi.mock('$lib/server/auth', () => ({
  auth: { api: { getSession: async () => null } }
}))

vi.mock('$lib/server/auth-permissions', () => ({
  loadUserPermissions: async () => new Set<string>()
}))

vi.mock('$lib/server/db/seed-defaults', () => ({
  seedDefaults: async () => {}
}))

vi.mock('better-auth/svelte-kit', () => ({
  // Forward to whatever `resolve` produces — when the inner chain
  // already returned a Response (the rate-limit 429), we never reach
  // this point. For the happy path we just return a sentinel 200.
  svelteKitHandler: async (args: {
    event: { request: Request; url: URL }
    resolve: (event: { request: Request; url: URL }) => Promise<Response>
  }) => {
    const inner = await args.resolve(args.event)
    if (inner) return inner
    return new Response('ok', { status: 200 })
  }
}))

import { handle, resolveClientIp } from './hooks.server'

function makeEvent(
  url: string,
  init: RequestInit & { ip?: string; xff?: string | null } = {}
): Parameters<typeof handle>[0]['event'] {
  const headers = new Headers(init.headers ?? {})
  if (init.xff) headers.set('x-forwarded-for', init.xff)
  const request = new Request(url, { ...init, headers })
  return {
    request,
    url: new URL(url),
    locals: {
      user: null,
      session: null,
      permissions: new Set<string>()
    } as unknown,
    params: {},
    route: { id: null },
    setHeaders: () => undefined,
    getClientAddress: () => init.ip ?? '127.0.0.1'
  } as unknown as Parameters<typeof handle>[0]['event']
}

const resolveOk = async () => new Response('ok', { status: 200 })

describe('hooks.server – rate limit on sign-in', () => {
  beforeEach(() => {
    resetRateLimit()
  })

  afterEach(() => {
    resetRateLimit()
  })

  it('allows up to 10 sign-in POSTs per IP per minute', async () => {
    for (let i = 0; i < 10; i++) {
      const event = makeEvent('http://localhost/api/auth/sign-in/username', {
        method: 'POST',
        xff: '1.2.3.4'
      })
      const res = await handle({ event, resolve: resolveOk })
      expect(res.status).toBe(200)
    }
  })

  it('returns 429 with German message once the limit is exceeded', async () => {
    for (let i = 0; i < 10; i++) {
      await handle({
        event: makeEvent('http://localhost/api/auth/sign-in/username', {
          method: 'POST',
          xff: '5.6.7.8'
        }),
        resolve: resolveOk
      })
    }
    const denied = await handle({
      event: makeEvent('http://localhost/api/auth/sign-in/username', {
        method: 'POST',
        xff: '5.6.7.8'
      }),
      resolve: resolveOk
    })
    expect(denied.status).toBe(429)
    expect(denied.headers.get('Retry-After')).toBeTruthy()
    const body = (await denied.json()) as { message: string }
    expect(body.message).toMatch(/Anmeldeversuche/i)
  })

  it('buckets each IP independently', async () => {
    for (let i = 0; i < 10; i++) {
      await handle({
        event: makeEvent('http://localhost/api/auth/sign-in/username', {
          method: 'POST',
          xff: '9.9.9.9'
        }),
        resolve: resolveOk
      })
    }
    // Same path, a different IP — should still be allowed.
    const other = await handle({
      event: makeEvent('http://localhost/api/auth/sign-in/username', {
        method: 'POST',
        xff: '10.10.10.10'
      }),
      resolve: resolveOk
    })
    expect(other.status).toBe(200)
  })

  it('does not rate-limit GETs on the sign-in path', async () => {
    for (let i = 0; i < 30; i++) {
      const event = makeEvent('http://localhost/api/auth/sign-in/username', {
        method: 'GET',
        xff: '11.11.11.11'
      })
      const res = await handle({ event, resolve: resolveOk })
      expect(res.status).toBe(200)
    }
  })

  it('does not rate-limit unrelated POSTs', async () => {
    for (let i = 0; i < 30; i++) {
      const event = makeEvent('http://localhost/api/auth/sign-out', {
        method: 'POST',
        xff: '12.12.12.12'
      })
      const res = await handle({ event, resolve: resolveOk })
      expect(res.status).toBe(200)
    }
  })
})

describe('hooks.server – resolveClientIp', () => {
  it('prefers the first entry of x-forwarded-for', () => {
    const event = makeEvent('http://localhost/x', {
      xff: '1.1.1.1, 2.2.2.2, 3.3.3.3'
    })
    expect(resolveClientIp(event)).toBe('1.1.1.1')
  })

  it('falls back to getClientAddress when XFF is missing', () => {
    const event = makeEvent('http://localhost/x', { ip: '42.42.42.42' })
    expect(resolveClientIp(event)).toBe('42.42.42.42')
  })
})
