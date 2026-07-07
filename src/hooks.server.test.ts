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

import { handle, handleValidationError, resolveClientIp } from './hooks.server'

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

describe('hooks.server – rate limit on the public API', () => {
  beforeEach(() => {
    resetRateLimit()
  })

  afterEach(() => {
    resetRateLimit()
  })

  const LIMIT = 180 // 120 steady + 60 burst per window

  it('allows up to the limit per Bearer-token bucket, then 429s', async () => {
    const mk = () =>
      makeEvent('http://localhost/api/public/used-cars', {
        method: 'GET',
        headers: { authorization: 'Bearer secret-token-abcdef' },
        xff: '20.20.20.20'
      })
    for (let i = 0; i < LIMIT; i++) {
      const res = await handle({ event: mk(), resolve: resolveOk })
      expect(res.status).toBe(200)
    }
    const denied = await handle({ event: mk(), resolve: resolveOk })
    expect(denied.status).toBe(429)
    expect(denied.headers.get('Retry-After')).toBeTruthy()
    const body = (await denied.json()) as { message: string }
    expect(body.message).toMatch(/Anfragen/i)
  })

  it('buckets by token, not by IP — a second token stays unaffected', async () => {
    for (let i = 0; i < LIMIT; i++) {
      await handle({
        event: makeEvent('http://localhost/api/public/services', {
          method: 'GET',
          headers: { authorization: 'Bearer first-token-000000' },
          xff: '21.21.21.21'
        }),
        resolve: resolveOk
      })
    }
    const other = await handle({
      event: makeEvent('http://localhost/api/public/services', {
        method: 'GET',
        headers: { authorization: 'Bearer other-token-111111' },
        xff: '21.21.21.21'
      }),
      resolve: resolveOk
    })
    expect(other.status).toBe(200)
  })

  it('falls back to the client IP for requests without a Bearer header', async () => {
    const mk = () =>
      makeEvent('http://localhost/api/public/company', {
        method: 'GET',
        xff: '22.22.22.22'
      })
    for (let i = 0; i < LIMIT; i++) {
      await handle({ event: mk(), resolve: resolveOk })
    }
    const denied = await handle({ event: mk(), resolve: resolveOk })
    expect(denied.status).toBe(429)
  })

  it('does not throttle routes outside the public API namespace', async () => {
    for (let i = 0; i < LIMIT + 10; i++) {
      const res = await handle({
        event: makeEvent('http://localhost/login', {
          method: 'GET',
          xff: '23.23.23.23'
        }),
        resolve: resolveOk
      })
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

describe('hooks.server – handleValidationError field labels', () => {
  type Issue = { message?: string; path?: Array<{ key: string }> }
  const call = (issues: Issue[]) =>
    (
      handleValidationError as unknown as (args: { issues: Issue[] }) => {
        message: string
      }
    )({ issues })

  it('maps known field keys to German labels', () => {
    const res = call([
      {
        message: 'Bitte geben Sie eine gültige IBAN ein.',
        path: [{ key: 'bankIban' }]
      }
    ])
    expect(res.message).toBe(
      'Ungültige Eingabe für „IBAN“: Bitte geben Sie eine gültige IBAN ein.'
    )
  })

  it('skips the `values` wrapper of update commands', () => {
    const res = call([
      {
        message: 'Bitte ein gültiges Kennzeichen eingeben.',
        path: [{ key: 'values' }, { key: 'licensePlate' }]
      }
    ])
    expect(res.message).toContain('„Kennzeichen“')
    expect(res.message).not.toContain('values')
  })

  it('renders array positions 1-based', () => {
    const res = call([
      {
        message: 'Bitte eine gültige Menge angeben.',
        path: [{ key: 'items' }, { key: '0' }, { key: 'quantity' }]
      }
    ])
    expect(res.message).toContain('„Menge (Position 1)“')
  })

  it('labels the array itself when the path ends on an index', () => {
    const res = call([
      {
        message: 'Ungültiger Anhang.',
        path: [{ key: 'attachments' }, { key: '1' }]
      }
    ])
    expect(res.message).toContain('„Anhänge (Position 2)“')
  })

  it('falls back to the raw key for unmapped fields', () => {
    const res = call([
      {
        message: 'Bitte prüfen Sie die Länge.',
        path: [{ key: 'someExoticField' }]
      }
    ])
    expect(res.message).toContain('„someExoticField“')
  })

  it('replaces English default messages with a generic German sentence', () => {
    const res = call([
      {
        message: 'Invalid type: Expected string but received undefined',
        path: [{ key: 'email' }]
      }
    ])
    expect(res.message).toBe(
      'Ungültige Eingabe für „E-Mail“: Bitte prüfen Sie Ihre Eingabe.'
    )
  })

  it('handles issues without a path', () => {
    const res = call([{ message: 'Bitte prüfen Sie Ihre Eingabe.' }])
    expect(res.message).toBe(
      'Ungültige Eingabe: Bitte prüfen Sie Ihre Eingabe.'
    )
  })
})
