import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { handleClientError } from './client-error'
import { toast } from '$lib/stores/toast.svelte'

/**
 * Unit tests for handleClientError.
 *
 * Contract (see CONTRIBUTING.md §12):
 * - The user-facing toast text is **only** the curated server message
 *   from an `HttpError` body. Anything else collapses to the German
 *   fallback "Es ist leider ein Fehler aufgetreten."
 * - Raw `Error.message` is never shown to the user — only logged.
 * - `baseMessage` prefixes the curated text with `<base>: <detail>`.
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

  it('never shows a raw Error.message to the user', () => {
    handleClientError(new Error('postgres: column "x" does not exist'))
    expect(toast.current?.variant).toBe('error')
    // Generic fallback, not the original technical text.
    expect(toast.current?.message).toContain('Es ist leider ein Fehler')
    expect(toast.current?.message).not.toContain('postgres')
    expect(toast.current?.message).not.toContain('column')
  })

  it('logs the original error to console.error for diagnostics', () => {
    const spy = vi.spyOn(console, 'error')
    const err = new Error('boom')
    handleClientError(err)
    expect(spy).toHaveBeenCalled()
  })

  it('uses the base message prefix when provided', () => {
    handleClientError(new Error('whatever'), 'Speichern fehlgeschlagen')
    // Prefix is the user-facing context.
    expect(toast.current?.message).toContain('Speichern fehlgeschlagen')
    // Detail is the German fallback, not the raw error.message.
    expect(toast.current?.message).toContain('Es ist leider ein Fehler')
    expect(toast.current?.message).not.toContain('whatever')
  })

  it('falls back to generic German for unknown / undefined values', () => {
    handleClientError(undefined)
    expect(toast.current?.message).toBe('Es ist leider ein Fehler aufgetreten.')
  })

  it('falls back to generic German for plain objects', () => {
    handleClientError({ kind: 'something', detail: 'private' })
    expect(toast.current?.message).toBe('Es ist leider ein Fehler aufgetreten.')
  })
})
