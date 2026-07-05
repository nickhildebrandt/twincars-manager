// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Tests for the eBay OAuth callback: every outcome must end in a
 * 303 redirect back to /settings/ebay with a coarse flag — declined
 * consent, invalid/expired state, failed exchange, success.
 *
 * @group integration
 * @module ebay
 */

const exchangeMock = vi.fn<(code: string) => Promise<void>>()
const verifyMock = vi.fn<(state: string) => boolean>()

vi.mock('$lib/server/services/ebay-auth-service', () => ({
  exchangeAuthCode: (code: string) => exchangeMock(code),
  verifyOauthState: (state: string) => verifyMock(state)
}))

import { handleOauthCallback } from './endpoint'
import type { RequestEvent } from '@sveltejs/kit'

const makeEvent = (qs: string): RequestEvent =>
  ({
    url: new URL(`https://tc.example:5443/api/ebay/oauth/callback${qs}`)
  }) as unknown as RequestEvent

/** SvelteKit's redirect() throws; capture status + location. */
async function expectRedirect(
  qs: string
): Promise<{ status: number; location: string }> {
  try {
    await handleOauthCallback(makeEvent(qs))
  } catch (err) {
    const r = err as { status?: number; location?: string }
    if (typeof r.status === 'number' && typeof r.location === 'string') {
      return { status: r.status, location: r.location }
    }
    throw err
  }
  throw new Error('expected a redirect to be thrown')
}

beforeEach(() => {
  exchangeMock.mockReset()
  verifyMock.mockReset()
})

describe('handleOauthCallback', () => {
  it('redirects with error=declined when no code arrives', async () => {
    const r = await expectRedirect('?state=whatever')
    expect(r.status).toBe(303)
    expect(r.location).toBe('/settings/ebay?error=declined')
    expect(exchangeMock).not.toHaveBeenCalled()
  })

  it('rejects a missing or invalid state before touching eBay', async () => {
    verifyMock.mockReturnValue(false)
    const r = await expectRedirect('?code=abc&state=forged')
    expect(r.location).toBe('/settings/ebay?error=state')
    expect(exchangeMock).not.toHaveBeenCalled()

    const r2 = await expectRedirect('?code=abc')
    expect(r2.location).toBe('/settings/ebay?error=state')
  })

  it('redirects with error=exchange when the token exchange fails', async () => {
    verifyMock.mockReturnValue(true)
    exchangeMock.mockRejectedValue(new Error('boom'))
    const r = await expectRedirect('?code=abc&state=ok')
    expect(r.location).toBe('/settings/ebay?error=exchange')
  })

  it('redirects with connected=1 on success and passes the code through', async () => {
    verifyMock.mockReturnValue(true)
    exchangeMock.mockResolvedValue(undefined)
    const r = await expectRedirect('?code=the-code&state=ok')
    expect(r.location).toBe('/settings/ebay?connected=1')
    expect(exchangeMock).toHaveBeenCalledWith('the-code')
  })
})
