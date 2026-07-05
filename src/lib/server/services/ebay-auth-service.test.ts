// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Tests for the eBay OAuth service: configuration gating, consent-URL
 * construction, the HMAC state round-trip, token exchange + encrypted
 * storage, refresh-on-expiry, status shape (no token leakage) and
 * disconnect. eBay's token endpoint is mocked at the fetch boundary.
 *
 * @group integration
 * @module ebay
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

// Neutralize vite-loaded `.env` so tests fully control configuration
// via `process.env` (readEnv checks process.env first).
vi.mock('$env/dynamic/private', () => ({ env: {} }))

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)

import { db } from '$lib/server/db/client'
import { ebayCredentials } from '$lib/server/db/schema'
import { decryptSecret } from '$lib/server/crypto'
import {
  buildAuthorizeUrl,
  createOauthState,
  verifyOauthState,
  disconnectEbay,
  exchangeAuthCode,
  getConnectionStatus,
  getValidAccessToken,
  missingEbayConfig,
  EBAY_SCOPES
} from './ebay-auth-service'

const CONFIG = {
  APP_SECRET: 'test-app-secret-32-bytes-long!!!',
  APP_ENCRYPTION_KEY: 'test-encryption-key',
  EBAY_CLIENT_ID: 'NickHild-Twincars-PRD-abc-123',
  EBAY_CERT_ID: 'PRD-secret-cert-id',
  EBAY_RU_NAME: 'Nick_Hildebra-NickHild-Twinca-test'
}

const tokenResponse = (overrides: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      access_token: 'ACCESS-TOKEN-1',
      expires_in: 7200,
      refresh_token: 'REFRESH-TOKEN-1',
      refresh_token_expires_in: 47304000,
      token_type: 'User Access Token',
      ...overrides
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )

beforeEach(async () => {
  await db.delete(ebayCredentials)
  for (const [k, v] of Object.entries(CONFIG)) vi.stubEnv(k, v)
  fetchMock.mockReset()
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('configuration', () => {
  it('reports missing env vars and buildAuthorizeUrl fails with a German error', () => {
    vi.unstubAllEnvs()
    vi.stubEnv('APP_SECRET', CONFIG.APP_SECRET)
    expect(missingEbayConfig()).toEqual([
      'EBAY_CLIENT_ID',
      'EBAY_CERT_ID',
      'EBAY_RU_NAME'
    ])
    expect(() => buildAuthorizeUrl()).toThrow(/nicht konfiguriert/)
  })
})

describe('buildAuthorizeUrl', () => {
  it('builds the production consent URL with all mandated params', () => {
    const { url, state } = buildAuthorizeUrl()
    const u = new URL(url)
    expect(u.origin).toBe('https://auth.ebay.com')
    expect(u.pathname).toBe('/oauth2/authorize')
    expect(u.searchParams.get('client_id')).toBe(CONFIG.EBAY_CLIENT_ID)
    // redirect_uri carries the RuName, NOT a URL.
    expect(u.searchParams.get('redirect_uri')).toBe(CONFIG.EBAY_RU_NAME)
    expect(u.searchParams.get('response_type')).toBe('code')
    expect(u.searchParams.get('scope')).toBe(EBAY_SCOPES)
    expect(u.searchParams.get('state')).toBe(state)
    expect(u.searchParams.get('locale')).toBe('de-DE')
  })

  it('switches to the sandbox host with EBAY_ENV=sandbox', () => {
    vi.stubEnv('EBAY_ENV', 'sandbox')
    const { url } = buildAuthorizeUrl()
    expect(new URL(url).origin).toBe('https://auth.sandbox.ebay.com')
  })
})

describe('OAuth state (CSRF)', () => {
  it('round-trips a freshly created state', () => {
    expect(verifyOauthState(createOauthState())).toBe(true)
  })

  it('rejects tampered, malformed and foreign states', () => {
    const state = createOauthState()
    expect(verifyOauthState(state.slice(0, -1) + 'x')).toBe(false)
    expect(verifyOauthState('not-a-state')).toBe(false)
    expect(verifyOauthState('1.2')).toBe(false)
  })

  it('rejects an expired state (>10 min) and a future timestamp', () => {
    const old = createOauthState(Date.now() - 11 * 60 * 1000)
    expect(verifyOauthState(old)).toBe(false)
    const future = createOauthState(Date.now() + 60 * 1000)
    expect(verifyOauthState(future)).toBe(false)
  })
})

describe('exchangeAuthCode', () => {
  it('exchanges the code, stores tokens ENCRYPTED, replaces prior rows', async () => {
    // First call: token endpoint. Second call: Identity API (username).
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ username: 'twincast-seller' }), {
          status: 200
        })
      )
    await exchangeAuthCode('the-auth-code')

    // Assert the token request shape.
    const [tokenUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(tokenUrl).toBe('https://api.ebay.com/identity/v1/oauth2/token')
    const basic = Buffer.from(
      `${CONFIG.EBAY_CLIENT_ID}:${CONFIG.EBAY_CERT_ID}`
    ).toString('base64')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${basic}`
    )
    const body = new URLSearchParams(String(init.body))
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('the-auth-code')
    expect(body.get('redirect_uri')).toBe(CONFIG.EBAY_RU_NAME)

    // Stored row: encrypted at rest, decryptable, single-row.
    const rows = await db.select().from(ebayCredentials)
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.ebayUsername).toBe('twincast-seller')
    expect(row.refreshToken).not.toContain('REFRESH-TOKEN-1')
    expect(decryptSecret(row.refreshToken)).toBe('REFRESH-TOKEN-1')
    expect(decryptSecret(row.accessToken!)).toBe('ACCESS-TOKEN-1')
    expect(row.environment).toBe('production')

    // A second connect replaces the row instead of accumulating.
    fetchMock
      .mockResolvedValueOnce(tokenResponse({ refresh_token: 'REFRESH-2' }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    await exchangeAuthCode('second-code')
    const after = await db.select().from(ebayCredentials)
    expect(after).toHaveLength(1)
    expect(decryptSecret(after[0].refreshToken)).toBe('REFRESH-2')
  })

  it('tolerates a failing Identity API (username stays null)', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockRejectedValueOnce(new Error('network down'))
    await exchangeAuthCode('code')
    const [row] = await db.select().from(ebayCredentials)
    expect(row.ebayUsername).toBeNull()
  })

  it('surfaces a curated error when the token endpoint rejects', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"error":"invalid_grant"}', { status: 400 })
    )
    await expect(exchangeAuthCode('bad-code')).rejects.toThrow(
      /eBay-Token-Endpunkt antwortete mit 400/
    )
    expect(await db.select().from(ebayCredentials)).toHaveLength(0)
  })
})

describe('getValidAccessToken', () => {
  it('throws a German error when nothing is connected', async () => {
    await expect(getValidAccessToken()).rejects.toThrow(/Kein eBay-Konto/)
  })

  it('returns the stored token while it is still fresh (no refresh call)', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    await exchangeAuthCode('code')
    fetchMock.mockClear()

    expect(await getValidAccessToken()).toBe('ACCESS-TOKEN-1')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes an expired access token via the refresh grant', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    await exchangeAuthCode('code')
    // Force expiry.
    await db
      .update(ebayCredentials)
      .set({ accessTokenExpiresAt: new Date(Date.now() - 1000) })
    fetchMock.mockClear()
    fetchMock.mockResolvedValueOnce(
      tokenResponse({
        access_token: 'ACCESS-TOKEN-NEU',
        refresh_token: undefined
      })
    )

    expect(await getValidAccessToken()).toBe('ACCESS-TOKEN-NEU')
    const body = new URLSearchParams(
      String((fetchMock.mock.calls[0][1] as RequestInit).body)
    )
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('REFRESH-TOKEN-1')

    // Persisted for the next caller.
    const [row] = await db.select().from(ebayCredentials)
    expect(decryptSecret(row.accessToken!)).toBe('ACCESS-TOKEN-NEU')
  })
})

describe('status + disconnect', () => {
  it('status never exposes token material and reflects connection state', async () => {
    const before = await getConnectionStatus()
    expect(before.connected).toBe(false)
    expect(before.configured).toBe(true)

    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ username: 'seller' }), { status: 200 })
      )
    await exchangeAuthCode('code')

    const after = await getConnectionStatus()
    expect(after.connected).toBe(true)
    expect(after.ebayUsername).toBe('seller')
    // Neither plaintext token values nor ciphertexts may leak.
    const serialized = JSON.stringify(after)
    expect(serialized).not.toContain('ACCESS-TOKEN-1')
    expect(serialized).not.toContain('REFRESH-TOKEN-1')
    expect(serialized).not.toContain('v1:')

    await disconnectEbay()
    expect((await getConnectionStatus()).connected).toBe(false)
  })
})
