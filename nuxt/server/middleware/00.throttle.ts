/**
 * Brute-force protection for the sign-in.
 *
 * The counting is ours rather than the library's, because the address it
 * counts against has to be one the caller cannot choose. The library reads
 * `x-forwarded-for` by default and accepts a single-valued header, so without
 * a proxy in front an attacker sends a different value with every request and
 * never fills a bucket — the brute-force protection does nothing at all
 * (B-003, B-054).
 *
 * Here the header is only believed when the deployment says a proxy sets it
 * (`TRUST_PROXY=on`). Otherwise the socket address decides.
 *
 * Runs first, before the session lookup: a flood should be turned away without
 * touching the database.
 */
import { SIGN_IN_ATTEMPTS_PER_MINUTE } from '../utils/auth.ts'
import { clientIp, trustsProxy } from '../utils/client-ip.ts'
import { consume } from '../utils/rate-limit.ts'
import { tooManyRequests } from '../utils/errors.ts'

/** Calls per minute allowed on the rest of the authentication endpoints. */
const OTHER_AUTH_CALLS_PER_MINUTE = 60

export default defineEventHandler((event) => {
  const path = event.path.split('?')[0] ?? event.path
  if (!path.startsWith('/api/auth/')) return
  if (event.method !== 'POST') return

  const isSignIn = path.startsWith('/api/auth/sign-in')
  const limit = isSignIn ? SIGN_IN_ATTEMPTS_PER_MINUTE : OTHER_AUTH_CALLS_PER_MINUTE

  const address = clientIp(event, trustsProxy(useRuntimeConfig().trustProxy))
  const result = consume(`auth:${isSignIn ? 'sign-in' : 'other'}:${address}`, limit)

  if (!result.allowed) {
    setResponseHeader(event, 'Retry-After', result.retryAfter)
    throw tooManyRequests('Zu viele Versuche. Bitte warten Sie eine Minute.')
  }
})
