/**
 * `GET/POST /api/ebay/account-deletion` — eBay marketplace account
 * deletion compliance endpoint (challenge handshake + notifications).
 * Unauthenticated by design: eBay's servers call it directly. It is
 * whitelisted in `hooks.server.ts` and documented as a third-party
 * plumbing exception. Implementation lives in `./endpoint.ts` so tests
 * can target the pure handlers.
 *
 * @group integration
 * @module ebay
 */
import type { RequestHandler } from './$types'
import { handleDeletionChallenge, handleDeletionNotification } from './endpoint'

export const GET: RequestHandler = (event) => handleDeletionChallenge(event)
export const POST: RequestHandler = (event) => handleDeletionNotification(event)
