/**
 * eBay Marketplace Account Deletion/Closure notification endpoint.
 *
 * eBay requires every production application to expose a publicly
 * reachable HTTPS endpoint for account-deletion notifications before
 * the production keyset is marked compliant (the portal shows
 * "Non Compliant" until this handshake succeeds). Two request kinds:
 *
 * 1. **Challenge (GET)** — sent once when the operator saves the
 *    endpoint URL + verification token in the developer portal, and
 *    periodically afterwards. Query param `challenge_code`; the
 *    response must be `200 {"challengeResponse": "<hex>"}` where
 *    `<hex> = SHA-256(challengeCode + verificationToken + endpointUrl)`
 *    — concatenated in exactly that order, hex-encoded.
 *
 * 2. **Notification (POST)** — an actual "eBay user requested account
 *    deletion" event. Must be acknowledged quickly with a 2xx status;
 *    after ~1000 consecutive failures eBay stops delivery and flags
 *    the application. We acknowledge first and process best-effort:
 *    today the app stores no per-eBay-user data (the OAuth token store
 *    is a future work package — see docs/ebay-integration.md), so
 *    processing is limited to a structured log line. When the token
 *    store lands, wire actual data deletion here.
 *
 * Configuration (env, production: /etc/twincars/env/manager.env):
 *   EBAY_VERIFICATION_TOKEN     32–80 chars, the same value the
 *                               operator enters in the eBay portal.
 *                               Unset → endpoint fails closed (404-ish
 *                               503) so nothing responds to challenges
 *                               with a half-configured setup.
 *   EBAY_DELETION_ENDPOINT_URL  Optional override for the exact URL
 *                               string registered in the portal. The
 *                               hash input must match it byte-for-byte;
 *                               default derives from ORIGIN + pathname,
 *                               which is correct behind Caddy because
 *                               production sets ORIGIN explicitly.
 *
 * This route is a documented exception to the remote-functions-only
 * rule (third-party plumbing, like the better-auth catch-all): eBay's
 * servers call it directly, unauthenticated — it is whitelisted in
 * hooks.server.ts and never exposes any data.
 *
 * @group integration
 * @module ebay
 */
import { createHash } from 'node:crypto'
import { json } from '@sveltejs/kit'
import type { RequestEvent } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'

/** `process.env` first (Vitest stubs), then SvelteKit dynamic env. */
const readEnv = (key: string): string | undefined =>
  process.env[key] ?? env[key]

/**
 * Compute the eBay challenge response hash. Exported for tests — the
 * concatenation ORDER (challengeCode, then verificationToken, then
 * endpoint URL) is mandated by eBay and the single most fragile fact
 * in this file.
 */
export function computeChallengeResponse(
  challengeCode: string,
  verificationToken: string,
  endpointUrl: string
): string {
  return createHash('sha256')
    .update(challengeCode)
    .update(verificationToken)
    .update(endpointUrl)
    .digest('hex')
}

/** GET — the portal/periodic challenge handshake. */
export async function handleDeletionChallenge(
  event: RequestEvent
): Promise<Response> {
  const verificationToken = readEnv('EBAY_VERIFICATION_TOKEN')
  if (!verificationToken) {
    // Fail closed: without the shared token no meaningful response is
    // possible, and answering anything else would let a stale portal
    // registration appear healthy.
    return json(
      { error: 'EBAY_VERIFICATION_TOKEN is not configured.' },
      { status: 503 }
    )
  }

  const challengeCode = event.url.searchParams.get('challenge_code')
  if (!challengeCode) {
    return json(
      { error: 'challenge_code query parameter missing.' },
      { status: 400 }
    )
  }

  // The hash input must be the EXACT URL registered in the portal. In
  // production ORIGIN=https://tc.ts13.de:5443 makes origin+pathname
  // correct; the env override exists for setups where the public URL
  // differs from what the container sees. An empty env value counts
  // as unset so `EBAY_DELETION_ENDPOINT_URL=` can't poison the hash.
  const endpointUrl =
    readEnv('EBAY_DELETION_ENDPOINT_URL')?.trim() ||
    `${event.url.origin}${event.url.pathname}`

  // Visible in journalctl — confirms when eBay (re)validates the
  // subscription without needing proxy access logs.
  console.info(
    `[ebay] account-deletion challenge served (endpoint=${endpointUrl})`
  )

  return json(
    {
      challengeResponse: computeChallengeResponse(
        challengeCode,
        verificationToken,
        endpointUrl
      )
    },
    { status: 200 }
  )
}

/** Minimal shape of the notification we care about for logging. */
type DeletionNotification = {
  metadata?: { topic?: string }
  notification?: {
    notificationId?: string
    eventDate?: string
    data?: { username?: string; userId?: string; eiasToken?: string }
  }
}

/** POST — an actual account-deletion notification. Ack fast, always. */
export async function handleDeletionNotification(
  event: RequestEvent
): Promise<Response> {
  // Acknowledge even bodies we cannot parse — a 4xx/5xx would count
  // toward eBay's consecutive-failure threshold and eventually stop
  // ALL notifications for the keyset. Log enough to act on manually.
  try {
    const body = (await event.request.json()) as DeletionNotification
    const topic = body.metadata?.topic ?? 'unknown-topic'
    const n = body.notification
    console.info(
      `[ebay] account-deletion notification received: topic=${topic} ` +
        `id=${n?.notificationId ?? '—'} username=${n?.data?.username ?? '—'} ` +
        `userId=${n?.data?.userId ?? '—'}`
    )
    // No per-eBay-user data is persisted yet. Once the OAuth token
    // store exists (ebay_credentials / ebay_listing_links, see
    // docs/ebay-integration.md), delete matching rows here before the
    // 30-day compliance window.
  } catch {
    console.warn(
      '[ebay] account-deletion notification with unparseable body — acknowledged anyway.'
    )
  }
  return new Response(null, { status: 200 })
}
