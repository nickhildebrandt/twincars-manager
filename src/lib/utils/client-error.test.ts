import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { handleClientError } from './client-error'
import { toast } from '$lib/stores/toast.svelte'

/**
 * Unit tests for handleClientError — maps any thrown value to a toast.
 *
 * @group unit
 * @module client-error
 */
describe('handleClientError', () => {
  beforeEach(() => {
    toast.dismiss()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    toast.dismiss()
  })

  it('toasts a plain Error instance', () => {
    handleClientError(new Error('boom'))
    expect(toast.current?.variant).toBe('error')
    expect(toast.current?.message).toContain('boom')
  })

  it('uses the base message prefix when provided', () => {
    handleClientError(new Error('detail'), 'Speichern fehlgeschlagen')
    expect(toast.current?.message).toContain('Speichern fehlgeschlagen')
    expect(toast.current?.message).toContain('detail')
  })

  it('handles an HttpError-shaped object', () => {
    const httpErr = {
      status: 500,
      body: { message: 'server kaputt' },
      name: 'HttpError'
    }
    // Mock isHttpError via constructor pattern -- we just check fallback for unknown
    handleClientError(httpErr as unknown as Error)
    expect(toast.current?.variant).toBe('error')
  })

  it('falls back to generic message for unknown values', () => {
    handleClientError(undefined)
    expect(toast.current?.message).toContain('Unbekannter Fehler')
  })
})
