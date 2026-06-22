// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _rateLimitCountForTests,
  rateLimit,
  resetRateLimit
} from './rate-limit'

/**
 * Behavioural tests for the in-memory fixed-window rate limiter.
 * Uses `vi.useFakeTimers` so window expiry can be exercised without
 * sleeping.
 *
 * @group integration
 * @module rate-limit
 */

describe('rateLimit', () => {
  beforeEach(() => {
    resetRateLimit()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    resetRateLimit()
  })

  it('allows the first N calls within the window', () => {
    for (let i = 0; i < 5; i++) {
      const r = rateLimit('a', { perMinute: 5 })
      expect(r.allowed).toBe(true)
    }
    expect(_rateLimitCountForTests('a')).toBe(5)
  })

  it('denies the call that exceeds the limit and reports retryAfter', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('a', { perMinute: 5 })
    }
    const denied = rateLimit('a', { perMinute: 5 })
    expect(denied.allowed).toBe(false)
    expect(denied.retryAfter).toBeGreaterThan(0)
    expect(denied.retryAfter).toBeLessThanOrEqual(60)
  })

  it('honours the burst allowance on top of perMinute', () => {
    for (let i = 0; i < 7; i++) {
      const r = rateLimit('a', { perMinute: 5, burst: 2 })
      expect(r.allowed).toBe(true)
    }
    const denied = rateLimit('a', { perMinute: 5, burst: 2 })
    expect(denied.allowed).toBe(false)
  })

  it('resets the counter once the 60-second window elapses', () => {
    for (let i = 0; i < 5; i++) rateLimit('a', { perMinute: 5 })
    expect(rateLimit('a', { perMinute: 5 }).allowed).toBe(false)

    // Move 61 seconds forward — the previous window has elapsed.
    vi.advanceTimersByTime(61_000)

    const fresh = rateLimit('a', { perMinute: 5 })
    expect(fresh.allowed).toBe(true)
    expect(_rateLimitCountForTests('a')).toBe(1)
  })

  it('tracks each key independently', () => {
    for (let i = 0; i < 5; i++) rateLimit('a', { perMinute: 5 })
    // `a` is exhausted, but `b` should still have a fresh allowance.
    expect(rateLimit('a', { perMinute: 5 }).allowed).toBe(false)
    expect(rateLimit('b', { perMinute: 5 }).allowed).toBe(true)
    expect(rateLimit('b', { perMinute: 5 }).allowed).toBe(true)
  })

  it('does not increment the counter for denied calls', () => {
    for (let i = 0; i < 3; i++) rateLimit('a', { perMinute: 3 })
    expect(_rateLimitCountForTests('a')).toBe(3)
    // Multiple denied calls inside the same window must not push the
    // counter higher — that would extend the lock-out artificially.
    rateLimit('a', { perMinute: 3 })
    rateLimit('a', { perMinute: 3 })
    rateLimit('a', { perMinute: 3 })
    expect(_rateLimitCountForTests('a')).toBe(3)
  })

  it('handles concurrent-style hammering without exceeding the limit', () => {
    const results: boolean[] = []
    for (let i = 0; i < 20; i++) {
      results.push(rateLimit('hammer', { perMinute: 5 }).allowed)
    }
    const allowed = results.filter(Boolean).length
    expect(allowed).toBe(5)
  })

  it('reports retryAfter close to the remaining window length', () => {
    for (let i = 0; i < 2; i++) rateLimit('a', { perMinute: 2 })
    // Halfway through the window.
    vi.advanceTimersByTime(30_000)
    const denied = rateLimit('a', { perMinute: 2 })
    expect(denied.allowed).toBe(false)
    // Roughly 30s left — accept anything from 25 to 35s for jitter.
    expect(denied.retryAfter!).toBeGreaterThanOrEqual(25)
    expect(denied.retryAfter!).toBeLessThanOrEqual(35)
  })
})
