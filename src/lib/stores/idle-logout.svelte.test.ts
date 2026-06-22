import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startIdleLogout } from './idle-logout.svelte'

/**
 * Unit tests for the client-side idle-logout helper. The helper
 * lives in the browser; `jsdom` (configured globally) gives us a
 * working `document` + event APIs.
 *
 * @group unit
 * @module idle-logout
 */
describe('startIdleLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires the logout callback after the configured timeout when idle', () => {
    const onLogout = vi.fn()
    const stop = startIdleLogout({ timeoutMs: 1000, onLogout })
    vi.advanceTimersByTime(999)
    expect(onLogout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2)
    expect(onLogout).toHaveBeenCalledTimes(1)
    stop()
  })

  it('resets the timer on a tracked event', () => {
    const onLogout = vi.fn()
    const stop = startIdleLogout({ timeoutMs: 1000, onLogout })
    vi.advanceTimersByTime(800)
    document.dispatchEvent(new Event('mousemove'))
    vi.advanceTimersByTime(800)
    // Without the reset this would have fired already (800+800 > 1000).
    expect(onLogout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(onLogout).toHaveBeenCalledTimes(1)
    stop()
  })

  it('does not fire after stop() is called', () => {
    const onLogout = vi.fn()
    const stop = startIdleLogout({ timeoutMs: 500, onLogout })
    stop()
    vi.advanceTimersByTime(2000)
    expect(onLogout).not.toHaveBeenCalled()
  })

  it('fires only once even if the timer keeps running', async () => {
    const onLogout = vi.fn(() => Promise.resolve())
    const stop = startIdleLogout({ timeoutMs: 200, onLogout })
    vi.advanceTimersByTime(500)
    // After firing, additional events should NOT re-arm.
    document.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(1000)
    expect(onLogout).toHaveBeenCalledTimes(1)
    stop()
  })

  it('swallows errors from the logout callback', () => {
    const onLogout = vi.fn(() => {
      throw new Error('network down')
    })
    const stop = startIdleLogout({ timeoutMs: 100, onLogout })
    expect(() => vi.advanceTimersByTime(200)).not.toThrow()
    expect(onLogout).toHaveBeenCalledTimes(1)
    stop()
  })

  it('respects a custom event list', () => {
    const onLogout = vi.fn()
    const stop = startIdleLogout({
      timeoutMs: 500,
      events: ['keydown'],
      onLogout
    })
    vi.advanceTimersByTime(400)
    document.dispatchEvent(new Event('mousemove'))
    vi.advanceTimersByTime(200)
    // mousemove not in the list — should still fire.
    expect(onLogout).toHaveBeenCalledTimes(1)
    stop()
  })

  it('returns a no-op stop when called server-side', () => {
    const origWindow = globalThis.window
    // @ts-expect-error simulate SSR
    delete globalThis.window
    const stop = startIdleLogout({ timeoutMs: 1, onLogout: () => {} })
    expect(stop).toBeInstanceOf(Function)
    stop()
    // Restore for later tests.
    globalThis.window = origWindow
  })
})
