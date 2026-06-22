/**
 * In-memory fixed-window rate limiter.
 *
 * Designed for protecting brute-force-prone endpoints (sign-in) and
 * the token-authenticated public API from accidental or hostile
 * traffic bursts. Each key keeps a counter that resets at the end of
 * a fixed minute window.
 *
 * # Algorithm
 *
 * Fixed window with a 60-second period. The first request seen for a
 * key starts the window; every following request inside the window
 * increments the counter. Once the counter exceeds `perMinute + burst`,
 * subsequent calls are denied until the window expires.
 *
 * # Multi-replica caveat
 *
 * The counter lives in this Node process's memory. The project runs as
 * a single replica behind the SvelteKit adapter-node container (see
 * `Dockerfile` + `CONTRIBUTING.md` §17), so a single shared bucket is
 * sufficient and avoids the operational cost of Redis. If the app is
 * ever horizontally scaled, replace this implementation with a shared
 * store (Redis `INCR` + `EXPIRE`, or a per-instance soft limit with a
 * second tier in front of the load balancer). The public function
 * signature is stable, so callers do not need to change.
 *
 * # Memory growth
 *
 * Each unique key adds a single small record. Stale records are pruned
 * lazily when their key is hit again and the previous window has
 * expired. A periodic background sweep deletes entries whose window
 * ended more than 5 minutes ago, so a flood of unique keys cannot make
 * memory grow without bound.
 */

const WINDOW_MS = 60_000
const SWEEP_INTERVAL_MS = 5 * 60_000
const STALE_AFTER_MS = 5 * 60_000

type Bucket = {
  /** Timestamp (ms) when the current window started. */
  windowStart: number
  /** Calls counted in the current window. */
  count: number
}

const buckets = new Map<string, Bucket>()
let sweepHandle: ReturnType<typeof setInterval> | null = null

const ensureSweep = (): void => {
  if (sweepHandle !== null) return
  // `setInterval` returns a Timeout that keeps Node alive; `unref` lets
  // the process exit normally when the only outstanding handle is this
  // sweeper. In test environments the interval is never started because
  // `resetRateLimit()` (or absence of traffic) keeps the map empty.
  sweepHandle = setInterval(() => {
    const cutoff = Date.now() - STALE_AFTER_MS
    for (const [key, bucket] of buckets) {
      if (bucket.windowStart < cutoff) buckets.delete(key)
    }
  }, SWEEP_INTERVAL_MS)
  if (
    typeof sweepHandle === 'object' &&
    sweepHandle &&
    'unref' in sweepHandle
  ) {
    ;(sweepHandle as { unref: () => void }).unref()
  }
}

export type RateLimitOptions = {
  /** Steady-state allowance per 60-second window. */
  perMinute: number
  /**
   * Extra calls allowed inside a single window on top of `perMinute`,
   * absorbing short bursts without rejecting legitimate spikes.
   * Defaults to 0 for strict windows (e.g. sign-in).
   */
  burst?: number
}

export type RateLimitResult = {
  /** True if the call is allowed and counted. */
  allowed: boolean
  /** Seconds the caller should wait before retrying (only set when denied). */
  retryAfter?: number
}

/**
 * Record one call against `key` and return whether it is allowed. The
 * counter is incremented only when the call is allowed — denied calls
 * do not extend the window.
 *
 * @example
 *   const r = rateLimit('signin:' + ip, { perMinute: 10 })
 *   if (!r.allowed) return new Response('Too many', { status: 429 })
 */
export function rateLimit(
  key: string,
  opts: RateLimitOptions
): RateLimitResult {
  ensureSweep()
  const now = Date.now()
  const limit = opts.perMinute + (opts.burst ?? 0)
  const existing = buckets.get(key)
  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    // Start a fresh window. The first call always passes.
    buckets.set(key, { windowStart: now, count: 1 })
    return { allowed: true }
  }
  if (existing.count >= limit) {
    const elapsed = now - existing.windowStart
    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - elapsed) / 1000))
    return { allowed: false, retryAfter }
  }
  existing.count += 1
  return { allowed: true }
}

/**
 * Drop every counter. Tests call this in `beforeEach` so adjacent
 * specs cannot leak state into each other.
 */
export function resetRateLimit(): void {
  buckets.clear()
}

/**
 * Internal accessor for tests. Returns the current count for a key,
 * or 0 if the key has no active window.
 */
export function _rateLimitCountForTests(key: string): number {
  const b = buckets.get(key)
  if (!b) return 0
  if (Date.now() - b.windowStart >= WINDOW_MS) return 0
  return b.count
}
