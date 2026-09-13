/**
 * A fixed-window counter, in the memory of this process.
 *
 * It protects the sign-in endpoint against brute force and the public API
 * against a runaway consumer. The application runs as a single instance, so a
 * shared store would add an operational dependency and buy nothing. The
 * signatures below stay the same if that ever changes
 * (../../../docs/rewrite/03-architektur.md §9.5).
 */

const WINDOW_MS = 60_000
const SWEEP_EVERY_MS = 5 * 60_000

type Bucket = { windowStart: number, count: number }

const buckets = new Map<string, Bucket>()
let sweeper: ReturnType<typeof setInterval> | undefined

/**
 * Drops buckets whose window is long gone.
 *
 * `unref` keeps the timer from holding the process open — without it the
 * server would refuse to shut down and every test run would hang.
 */
function startSweeper(): void {
  if (sweeper) return
  sweeper = setInterval(() => {
    const cutoff = Date.now() - SWEEP_EVERY_MS
    for (const [key, bucket] of buckets) {
      if (bucket.windowStart < cutoff) buckets.delete(key)
    }
    if (buckets.size === 0) stopSweeper()
  }, SWEEP_EVERY_MS)
  sweeper.unref?.()
}

function stopSweeper(): void {
  if (!sweeper) return
  clearInterval(sweeper)
  sweeper = undefined
}

export type RateLimitResult = {
  allowed: boolean
  /** Calls left in this window. */
  remaining: number
  /** Seconds until the window resets — goes into `Retry-After`. */
  retryAfter: number
}

/**
 * Counts one call against `key`.
 *
 * `limit` is the number of calls allowed per minute. The caller decides what a
 * key is: a client address for sign-in, a token prefix for the public API.
 */
export function consume(key: string, limit: number): RateLimitResult {
  startSweeper()
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { windowStart: now, count: 1 })
    // Even the first call of a window is counted against the limit. A limit of
    // zero means closed, and must not let one request through.
    return {
      allowed: limit >= 1,
      remaining: Math.max(0, limit - 1),
      retryAfter: limit >= 1 ? 0 : WINDOW_MS / 1000,
    }
  }

  bucket.count += 1
  const retryAfter = Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000)
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter,
  }
}

/** Empties every bucket. Tests call this; nothing else should. */
export function resetRateLimits(): void {
  buckets.clear()
  stopSweeper()
}

/** How many keys are being tracked. For the health endpoint and for tests. */
export const trackedKeys = (): number => buckets.size
