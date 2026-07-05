/**
 * Handler for `GET /api/ebay/oauth/callback` — the "Auth Accepted URL"
 * registered with the RuName in the eBay developer portal. eBay
 * redirects the operator's browser here after the consent screen with
 * `?code=<one-time code>&state=<our HMAC state>&expires_in=…`.
 *
 * Session-gated on purpose (NOT whitelisted in hooks): only a
 * logged-in operator can complete the connect flow, and the browser
 * carries the session cookie through the redirect. CSRF is covered by
 * the signed `state` (10-minute TTL) issued by `buildAuthorizeUrl`.
 *
 * All outcomes redirect back to `/settings/ebay` with a coarse query
 * flag; failure details are logged server-side only — never into the
 * URL.
 *
 * @group integration
 * @module ebay
 */
import { redirect } from '@sveltejs/kit'
import type { RequestEvent } from '@sveltejs/kit'
import {
  exchangeAuthCode,
  verifyOauthState
} from '$lib/server/services/ebay-auth-service'

const back = (flag: string): never => {
  redirect(303, `/settings/ebay?${flag}`)
}

export async function handleOauthCallback(
  event: RequestEvent
): Promise<Response> {
  const code = event.url.searchParams.get('code')
  const state = event.url.searchParams.get('state')

  if (!code) {
    // Consent declined / error round-trips arrive without a code.
    return back('error=declined')
  }
  if (!state || !verifyOauthState(state)) {
    console.warn('[ebay] OAuth callback with missing/invalid state — rejected.')
    return back('error=state')
  }

  try {
    await exchangeAuthCode(code)
  } catch (err) {
    console.error('[ebay] OAuth code exchange failed:', err)
    return back('error=exchange')
  }
  return back('connected=1')
}
