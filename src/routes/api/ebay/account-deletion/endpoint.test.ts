// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHash } from 'node:crypto'

/**
 * Tests for the eBay marketplace-account-deletion compliance endpoint:
 * the challenge handshake (hash correctness incl. the mandated
 * concatenation order), fail-closed behaviour without configuration,
 * and the always-acknowledge notification path.
 *
 * @group integration
 * @module ebay
 */

// Neutralize the vite-loaded `.env` passthrough (the dev .env now
// carries a real EBAY_VERIFICATION_TOKEN) — tests control everything
// via `process.env`, which readEnv checks first.
vi.mock('$env/dynamic/private', () => ({ env: {} }))

import {
  computeChallengeResponse,
  handleDeletionChallenge,
  handleDeletionNotification
} from './endpoint'
import type { RequestEvent } from '@sveltejs/kit'

const TOKEN = 'test-verification-token-0123456789abcdef' // 40 chars
const ENDPOINT = 'https://tc.example:5443/api/ebay/account-deletion'

/** Minimal RequestEvent stub — the handlers read `url` and `request`. */
function makeEvent(url: string, init?: RequestInit): RequestEvent {
  const request = new Request(url, init)
  return { url: new URL(url), request } as unknown as RequestEvent
}

beforeEach(() => {
  vi.stubEnv('EBAY_VERIFICATION_TOKEN', TOKEN)
  vi.stubEnv('EBAY_DELETION_ENDPOINT_URL', ENDPOINT)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('computeChallengeResponse', () => {
  it('hashes challengeCode + verificationToken + endpoint in that exact order', () => {
    // Independent re-computation: single concatenated update. Order is
    // the eBay-mandated contract — code, then token, then endpoint URL.
    const expected = createHash('sha256')
      .update(`abc123${TOKEN}${ENDPOINT}`)
      .digest('hex')
    expect(computeChallengeResponse('abc123', TOKEN, ENDPOINT)).toBe(expected)
  })

  it('is order-sensitive (swapping inputs changes the hash)', () => {
    const normal = computeChallengeResponse('a', 'b', 'c')
    const swapped = computeChallengeResponse('b', 'a', 'c')
    expect(normal).not.toBe(swapped)
  })
})

describe('GET challenge handshake', () => {
  it('responds 200 with the challengeResponse JSON', async () => {
    const res = await handleDeletionChallenge(
      makeEvent(`${ENDPOINT}?challenge_code=xyz-789`)
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = await res.json()
    expect(body.challengeResponse).toBe(
      computeChallengeResponse('xyz-789', TOKEN, ENDPOINT)
    )
  })

  it('uses the EBAY_DELETION_ENDPOINT_URL override for the hash input', async () => {
    // The request URL differs from the registered URL (e.g. container
    // sees localhost) — the hash must still use the registered one.
    const res = await handleDeletionChallenge(
      makeEvent(
        'http://localhost:3000/api/ebay/account-deletion?challenge_code=c1'
      )
    )
    const body = await res.json()
    expect(body.challengeResponse).toBe(
      computeChallengeResponse('c1', TOKEN, ENDPOINT)
    )
  })

  it('derives origin+pathname when the override is unset or empty', async () => {
    // An empty EBAY_DELETION_ENDPOINT_URL counts as unset — it must
    // never poison the hash input with "".
    vi.stubEnv('EBAY_DELETION_ENDPOINT_URL', '')
    const res = await handleDeletionChallenge(
      makeEvent(
        'https://host.example/api/ebay/account-deletion?challenge_code=c2'
      )
    )
    const body = await res.json()
    expect(body.challengeResponse).toBe(
      computeChallengeResponse(
        'c2',
        TOKEN,
        'https://host.example/api/ebay/account-deletion'
      )
    )
  })

  it('400 when challenge_code is missing', async () => {
    const res = await handleDeletionChallenge(makeEvent(ENDPOINT))
    expect(res.status).toBe(400)
  })

  it('fails closed with 503 when the verification token is unconfigured', async () => {
    vi.unstubAllEnvs()
    const res = await handleDeletionChallenge(
      makeEvent(`${ENDPOINT}?challenge_code=xyz`)
    )
    expect(res.status).toBe(503)
  })
})

describe('POST notification acknowledgment', () => {
  it('acknowledges a well-formed deletion notification with 200', async () => {
    const res = await handleDeletionNotification(
      makeEvent(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          metadata: { topic: 'MARKETPLACE_ACCOUNT_DELETION' },
          notification: {
            notificationId: 'n-1',
            eventDate: '2026-06-23T10:00:00.000Z',
            data: { username: 'somebody', userId: 'u-1', eiasToken: 't' }
          }
        })
      })
    )
    expect(res.status).toBe(200)
  })

  it('acknowledges even an unparseable body (never trips the failure counter)', async () => {
    const res = await handleDeletionNotification(
      makeEvent(ENDPOINT, { method: 'POST', body: 'not json {{' })
    )
    expect(res.status).toBe(200)
  })
})
