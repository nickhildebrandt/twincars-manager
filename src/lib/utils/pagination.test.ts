import { describe, it, expect } from 'vitest'
import { clampPagination, paginationButtons } from './pagination'

/**
 * Unit tests for the pagination helpers.
 *
 * @group unit
 * @module pagination
 */
describe('clampPagination', () => {
  it('clamps page below 1 to 1', () => {
    expect(clampPagination(0, 25).page).toBe(1)
    expect(clampPagination(-50, 25).page).toBe(1)
  })

  it('falls back to size 25 when invalid', () => {
    expect(clampPagination(1, 7).size).toBe(25)
    expect(clampPagination(1, undefined).size).toBe(25)
  })

  it('accepts allowed sizes', () => {
    for (const s of [10, 25, 50, 100]) {
      expect(clampPagination(1, s).size).toBe(s)
    }
  })

  it('handles non-numeric input safely', () => {
    const result = clampPagination(NaN, NaN)
    expect(result.page).toBe(1)
    expect(result.size).toBe(25)
  })
})

describe('paginationButtons', () => {
  it('returns single page when pageCount <= 1', () => {
    expect(paginationButtons(1, 1)).toEqual([1])
    expect(paginationButtons(1, 0)).toEqual([1])
  })

  it('shows all pages when pageCount fits', () => {
    expect(paginationButtons(2, 4, 5)).toEqual([1, 2, 3, 4])
  })

  it('inserts ellipsis on the left edge', () => {
    const out = paginationButtons(8, 10, 5)
    expect(out[0]).toBe(1)
    expect(out).toContain(null)
    expect(out[out.length - 1]).toBe(10)
  })

  it('inserts ellipsis on the right edge', () => {
    const out = paginationButtons(2, 10, 5)
    expect(out[0]).toBe(1)
    expect(out).toContain(null)
    expect(out[out.length - 1]).toBe(10)
  })
})
