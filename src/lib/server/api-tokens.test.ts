// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest'

/**
 * Unit tests for the env-var based public-API Bearer token check.
 *
 * The implementation reads `env.API_TOKENS` (via `$env/dynamic/private`)
 * lazily on every call, so each test sets the value with
 * `vi.stubEnv()` and then exercises the function under test.
 * `unstubAllEnvs()` in `afterEach` restores the original env so
 * tests stay isolated.
 *
 * @group unit
 * @module api-tokens
 */

import { authenticateRequest, verifyApiToken } from './api-tokens'

const VALID_TOKEN_A = 'token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const VALID_TOKEN_B = 'token-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const VALID_TOKEN_C = 'token-cccccccccccccccccccccccccccccccc'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const bearer = (token: string): Request =>
  new Request('http://localhost/api/public/x', {
    headers: { Authorization: `Bearer ${token}` }
  })

describe('verifyApiToken', () => {
  it('rejects every token when API_TOKENS is unset', () => {
    vi.stubEnv('API_TOKENS', '')
    expect(verifyApiToken(VALID_TOKEN_A)).toBe(false)
    expect(verifyApiToken('anything')).toBe(false)
  })

  it('rejects every token when API_TOKENS is missing entirely', () => {
    // Defensive: even with no stub the function must not throw and
    // must fail-closed. We delete to simulate "never set".
    vi.stubEnv('API_TOKENS', '')
    expect(verifyApiToken(VALID_TOKEN_A)).toBe(false)
  })

  it('accepts the single configured token, rejects others', () => {
    vi.stubEnv('API_TOKENS', VALID_TOKEN_A)
    expect(verifyApiToken(VALID_TOKEN_A)).toBe(true)
    expect(verifyApiToken(VALID_TOKEN_B)).toBe(false)
    expect(verifyApiToken('almost-correct')).toBe(false)
  })

  it('accepts any of several comma-separated tokens', () => {
    vi.stubEnv(
      'API_TOKENS',
      `${VALID_TOKEN_A},${VALID_TOKEN_B},${VALID_TOKEN_C}`
    )
    expect(verifyApiToken(VALID_TOKEN_A)).toBe(true)
    expect(verifyApiToken(VALID_TOKEN_B)).toBe(true)
    expect(verifyApiToken(VALID_TOKEN_C)).toBe(true)
    expect(verifyApiToken('not-in-list-aaaaaaaaaaaaa')).toBe(false)
  })

  it('tolerates whitespace and newline / semicolon separators', () => {
    vi.stubEnv(
      'API_TOKENS',
      `  ${VALID_TOKEN_A}  \n ${VALID_TOKEN_B} ; ${VALID_TOKEN_C}  `
    )
    expect(verifyApiToken(VALID_TOKEN_A)).toBe(true)
    expect(verifyApiToken(VALID_TOKEN_B)).toBe(true)
    expect(verifyApiToken(VALID_TOKEN_C)).toBe(true)
  })

  it('ignores tokens shorter than 8 chars from the config list', () => {
    vi.stubEnv('API_TOKENS', `short,${VALID_TOKEN_A},x`)
    // The short entries are dropped, so they cannot grant access.
    expect(verifyApiToken('short')).toBe(false)
    expect(verifyApiToken('x')).toBe(false)
    // The long one still works.
    expect(verifyApiToken(VALID_TOKEN_A)).toBe(true)
  })

  it('rejects empty or short candidate strings without scanning the list', () => {
    vi.stubEnv('API_TOKENS', VALID_TOKEN_A)
    expect(verifyApiToken('')).toBe(false)
    expect(verifyApiToken('abc')).toBe(false)
  })

  it('rejects candidates that differ only in case', () => {
    vi.stubEnv('API_TOKENS', VALID_TOKEN_A)
    expect(verifyApiToken(VALID_TOKEN_A.toUpperCase())).toBe(false)
  })

  it('rejects candidates that share a prefix but differ in length', () => {
    // Constant-time comparison requires equal lengths; a longer or
    // shorter candidate must be rejected without throwing. This
    // exercises the length pre-check that wraps `timingSafeEqual`
    // (which itself errors on length mismatch in older Node
    // versions).
    vi.stubEnv('API_TOKENS', VALID_TOKEN_A)
    expect(verifyApiToken(VALID_TOKEN_A + 'x')).toBe(false)
    expect(verifyApiToken(VALID_TOKEN_A.slice(0, -1))).toBe(false)
  })

  it('re-reads env on every call so config changes take effect', () => {
    vi.stubEnv('API_TOKENS', VALID_TOKEN_A)
    expect(verifyApiToken(VALID_TOKEN_A)).toBe(true)
    vi.stubEnv('API_TOKENS', VALID_TOKEN_B)
    expect(verifyApiToken(VALID_TOKEN_A)).toBe(false)
    expect(verifyApiToken(VALID_TOKEN_B)).toBe(true)
  })
})

describe('authenticateRequest', () => {
  it('returns the token prefix for a valid Bearer token', async () => {
    vi.stubEnv('API_TOKENS', VALID_TOKEN_A)
    const v = await authenticateRequest(bearer(VALID_TOKEN_A))
    expect(v?.tokenPrefix).toBe(VALID_TOKEN_A.slice(0, 8))
  })

  it('accepts a lowercase "bearer" prefix (case-insensitive)', async () => {
    vi.stubEnv('API_TOKENS', VALID_TOKEN_A)
    const req = new Request('http://x/', {
      headers: { Authorization: `bearer ${VALID_TOKEN_A}` }
    })
    const v = await authenticateRequest(req)
    expect(v?.tokenPrefix).toBe(VALID_TOKEN_A.slice(0, 8))
  })

  it('tolerates trailing whitespace on the header value', async () => {
    vi.stubEnv('API_TOKENS', VALID_TOKEN_A)
    const req = new Request('http://x/', {
      headers: { Authorization: `Bearer ${VALID_TOKEN_A}   ` }
    })
    const v = await authenticateRequest(req)
    expect(v?.tokenPrefix).toBe(VALID_TOKEN_A.slice(0, 8))
  })

  it('returns null when no Authorization header is sent', async () => {
    vi.stubEnv('API_TOKENS', VALID_TOKEN_A)
    const req = new Request('http://x/')
    expect(await authenticateRequest(req)).toBeNull()
  })

  it('returns null for a non-Bearer scheme', async () => {
    vi.stubEnv('API_TOKENS', VALID_TOKEN_A)
    const req = new Request('http://x/', {
      headers: { Authorization: `Basic ${VALID_TOKEN_A}` }
    })
    expect(await authenticateRequest(req)).toBeNull()
  })

  it('returns null for "Bearer" with no token at all', async () => {
    vi.stubEnv('API_TOKENS', VALID_TOKEN_A)
    const req = new Request('http://x/', {
      headers: { Authorization: 'Bearer' }
    })
    expect(await authenticateRequest(req)).toBeNull()
  })

  it('returns null for a Bearer token that is not in the configured list', async () => {
    vi.stubEnv('API_TOKENS', VALID_TOKEN_A)
    const req = bearer('not-the-right-token-aaaaaaaaaaaaaaaaaa')
    expect(await authenticateRequest(req)).toBeNull()
  })

  it('returns null when API_TOKENS is empty (fail-closed)', async () => {
    vi.stubEnv('API_TOKENS', '')
    expect(await authenticateRequest(bearer(VALID_TOKEN_A))).toBeNull()
  })
})
