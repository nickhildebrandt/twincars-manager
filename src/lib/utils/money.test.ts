import { describe, it, expect } from 'vitest'
import {
  roundMoney,
  grossFromNet,
  netFromGross,
  taxFromNet,
  applyDiscount,
  formatEuro
} from './money'

/**
 * Unit tests for all money helpers.
 *
 * @group unit
 * @module money
 */
describe('money', () => {
  describe('roundMoney', () => {
    it('rounds half-up to two decimals', () => {
      expect(roundMoney(1.236)).toBe(1.24)
      expect(roundMoney(1.234)).toBe(1.23)
      expect(roundMoney(1.0)).toBe(1.0)
    })
    it('handles negative numbers symmetrically', () => {
      expect(roundMoney(-1.236)).toBe(-1.24)
      expect(roundMoney(-1.234)).toBe(-1.23)
    })
  })

  describe('grossFromNet', () => {
    it('adds 19% VAT', () => {
      expect(grossFromNet(100, 0.19)).toBe(119)
    })
    it('rounds to 2 decimals', () => {
      expect(grossFromNet(0.99, 0.19)).toBeCloseTo(1.18, 2)
    })
  })

  describe('netFromGross', () => {
    it('subtracts 19% VAT', () => {
      expect(netFromGross(119, 0.19)).toBe(100)
    })
  })

  describe('taxFromNet', () => {
    it('returns the VAT amount', () => {
      expect(taxFromNet(100, 0.19)).toBe(19)
      expect(taxFromNet(50, 0.07)).toBe(3.5)
    })
  })

  describe('applyDiscount', () => {
    it('reduces amount by percentage', () => {
      expect(applyDiscount(100, 10)).toBe(90)
    })
    it('handles 0% discount', () => {
      expect(applyDiscount(100, 0)).toBe(100)
    })
    it('handles 100% discount', () => {
      expect(applyDiscount(100, 100)).toBe(0)
    })
  })

  describe('formatEuro', () => {
    it('formats with German locale', () => {
      const formatted = formatEuro(1234.56)
      expect(formatted).toContain('1.234,56')
      expect(formatted).toContain('€')
    })
    it('formats negative values', () => {
      expect(formatEuro(-50)).toContain('50,00')
    })
  })
})
