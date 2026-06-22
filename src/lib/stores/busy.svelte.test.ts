import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { busy } from './busy.svelte'

/**
 * Unit tests for the global busy / loading store.
 *
 * Covers the two-tier semantics:
 *   - `active` flips immediately on begin / release on end.
 *   - `slow` only flips after the 250 ms threshold and never flips back
 *     if the operation finishes before crossing it.
 * Plus the counting-semaphore property and the `run` async wrapper.
 *
 * @group unit
 * @module busy
 */
describe('busy store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts inactive and non-slow', () => {
    expect(busy.active).toBe(false)
    expect(busy.slow).toBe(false)
  })

  it('begin flips active immediately', () => {
    const end = busy.begin()
    expect(busy.active).toBe(true)
    expect(busy.slow).toBe(false)
    end()
    expect(busy.active).toBe(false)
  })

  it('slow stays false if the operation finishes before 250 ms', () => {
    const end = busy.begin()
    vi.advanceTimersByTime(249)
    expect(busy.slow).toBe(false)
    end()
    vi.advanceTimersByTime(10)
    expect(busy.slow).toBe(false)
    expect(busy.active).toBe(false)
  })

  it('slow flips on after 250 ms and clears on end', () => {
    const end = busy.begin()
    vi.advanceTimersByTime(260)
    expect(busy.slow).toBe(true)
    end()
    expect(busy.slow).toBe(false)
    expect(busy.active).toBe(false)
  })

  it('composes concurrent operations via the semaphore', () => {
    const end1 = busy.begin()
    const end2 = busy.begin()
    expect(busy.active).toBe(true)
    end1()
    expect(busy.active).toBe(true)
    end2()
    expect(busy.active).toBe(false)
  })

  it('slow tracks per-operation crossings independently', () => {
    const end1 = busy.begin()
    vi.advanceTimersByTime(260)
    expect(busy.slow).toBe(true)
    const end2 = busy.begin()
    expect(busy.slow).toBe(true)
    end1()
    expect(busy.slow).toBe(false)
    vi.advanceTimersByTime(260)
    expect(busy.slow).toBe(true)
    end2()
    expect(busy.slow).toBe(false)
  })

  it('run wraps async work and clears on success', async () => {
    const result = await busy.run(async () => {
      expect(busy.active).toBe(true)
      return 42
    })
    expect(result).toBe(42)
    expect(busy.active).toBe(false)
  })

  it('run wraps async work and clears on rejection', async () => {
    await expect(
      busy.run(async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
    expect(busy.active).toBe(false)
    expect(busy.slow).toBe(false)
  })

  it('does not underflow when end is invoked twice', () => {
    const end = busy.begin()
    end()
    end()
    expect(busy.active).toBe(false)
  })
})
