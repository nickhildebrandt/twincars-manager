import { describe, it, expect } from 'vitest'
import { renderNumber } from './numbering'

/**
 * Unit tests for the number-range renderer.
 *
 * @group unit
 * @module numbering
 */
describe('renderNumber', () => {
  it('replaces year, month and sequence placeholders', () => {
    const out = renderNumber(
      'RE-{YYYY}-{NNNN}',
      42,
      new Date('2026-05-15T00:00:00Z')
    )
    expect(out).toBe('RE-2026-0042')
  })

  it('handles two-digit year and month', () => {
    const out = renderNumber(
      '{YY}{MM}-{NNN}',
      7,
      new Date('2026-03-15T00:00:00Z')
    )
    expect(out).toBe('2603-007')
  })

  it('keeps sequences without padding when N width is small', () => {
    expect(renderNumber('K-{N}', 12345)).toBe('K-12345')
  })

  it('renders 5-digit padding (KU template)', () => {
    expect(renderNumber('KU-{NNNNN}', 7)).toBe('KU-00007')
  })

  it('handles complex template with multiple placeholders', () => {
    const out = renderNumber(
      'AN-{YYYY}-{MM}-{NNNN}',
      1,
      new Date('2026-01-15T00:00:00Z')
    )
    expect(out).toBe('AN-2026-01-0001')
  })

  it('uses current time as default', () => {
    const out = renderNumber('{YYYY}-{NN}', 5)
    expect(out).toMatch(/^\d{4}-05$/)
  })
})
