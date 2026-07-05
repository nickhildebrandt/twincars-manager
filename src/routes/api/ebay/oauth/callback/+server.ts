/**
 * `GET /api/ebay/oauth/callback` — eBay OAuth redirect target (the
 * RuName's "Auth Accepted URL"). Documented `+server.ts` exception:
 * third-party plumbing, analogous to the better-auth catch-all.
 * Session-gated via hooks (deliberately NOT whitelisted).
 * Implementation lives in `./endpoint.ts` so tests can target the pure
 * handler.
 *
 * @group integration
 * @module ebay
 */
import type { RequestHandler } from './$types'
import { handleOauthCallback } from './endpoint'

export const GET: RequestHandler = (event) => handleOauthCallback(event)
