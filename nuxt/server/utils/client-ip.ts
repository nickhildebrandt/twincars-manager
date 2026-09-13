/**
 * Who is calling.
 *
 * The rate limiter counts per client address, so the address has to be one the
 * caller cannot choose. The predecessor read `x-forwarded-for` unconditionally
 * (B-003, B-054): without a proxy in front that overwrites the header, an
 * attacker sent a different value with every request, landed in a fresh bucket
 * every time, and the brute-force protection did nothing at all.
 *
 * The header is therefore only believed when the deployment says there is a
 * proxy (`TRUST_PROXY=on`). Otherwise the socket address decides — that one
 * cannot be forged.
 */
import { getRequestHeader, getRequestIP } from 'h3'
import type { H3Event } from 'h3'

/** The address to count against, or `unknown` when there is none. */
export function clientIp(event: H3Event, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = getRequestHeader(event, 'x-forwarded-for')
    // The header is a list: the client first, then the proxies it passed.
    const first = forwarded?.split(',')[0]?.trim()
    if (first) return first
  }
  return getRequestIP(event) ?? 'unknown'
}

/** Whether the configuration says a trusted proxy sets the forwarding header. */
export const trustsProxy = (setting: string | undefined): boolean => setting === 'on'
