import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toast } from './toast.svelte'

/**
 * Unit tests for the global toast store. Single-toast semantics: a new push
 * always replaces the previous toast.
 *
 * @group unit
 * @module toast
 */
describe('toast store', () => {
  beforeEach(() => {
    toast.dismiss()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    toast.dismiss()
  })

  it('starts empty', () => {
    expect(toast.current).toBeNull()
  })

  it('push sets the current toast', () => {
    toast.push('hello', 'info', 1000)
    expect(toast.current?.message).toBe('hello')
    expect(toast.current?.variant).toBe('info')
  })

  it('replaces previous toast when push is called again', () => {
    toast.push('first', 'info', 5000)
    const firstId = toast.current?.id
    toast.push('second', 'error', 5000)
    expect(toast.current?.message).toBe('second')
    expect(toast.current?.variant).toBe('error')
    expect(toast.current?.id).not.toBe(firstId)
  })

  it('auto-dismisses after timeout', () => {
    toast.push('auto-go', 'success', 3000)
    expect(toast.current).not.toBeNull()
    vi.advanceTimersByTime(3001)
    expect(toast.current).toBeNull()
  })

  it('dismiss() clears the toast', () => {
    toast.push('hi', 'info', 5000)
    toast.dismiss()
    expect(toast.current).toBeNull()
  })

  it('helpers set the right variant', () => {
    toast.success('ok')
    expect(toast.current?.variant).toBe('success')
    toast.error('boom')
    expect(toast.current?.variant).toBe('error')
    toast.warning('careful')
    expect(toast.current?.variant).toBe('warning')
    toast.info('fyi')
    expect(toast.current?.variant).toBe('info')
  })
})
