import { describe, it, expect } from 'vitest'
import { isEbayCustomerName } from './ebay-detection'

/**
 * Exhaustive unit tests for the eBay-import predicate. The rule is
 * exactly "any field contains the substring 'ebay', case-insensitive"
 * — including its documented edges ("Ebayer"/"Sebayn" match, "Bayer"
 * does not).
 *
 * @group unit
 * @module ebay-detection
 */
describe('isEbayCustomerName', () => {
  describe('positive matches (substring "ebay", any casing)', () => {
    it.each([
      ['eBay'],
      ['EBAY'],
      ['ebay'],
      ['ebaY'],
      ['Firma eBay Berlin'],
      ['Max eBay Mustermann'],
      ['eBay-Autohandel'],
      ['Autohandel-eBay'],
      ['(ebay) Käufer']
    ])('matches %j as a single field', (value) => {
      expect(isEbayCustomerName([value])).toBe(true)
    })

    it('matches when only the company field carries it', () => {
      expect(isEbayCustomerName([null, 'eBay-Autohandel', null, null])).toBe(
        true
      )
    })

    it('matches when only the first name carries it', () => {
      expect(isEbayCustomerName([null, null, 'eBay', 'Meier'])).toBe(true)
    })

    it('matches when only the last name carries it', () => {
      expect(isEbayCustomerName([null, null, 'Max', 'eBay-Käufer'])).toBe(true)
    })

    it('matches "Ebayer" — documented edge: contains "ebay"', () => {
      expect(isEbayCustomerName(['Ebayer'])).toBe(true)
    })

    it('matches "Sebayn" — documented edge: contains "ebay" at index 1', () => {
      expect(isEbayCustomerName(['Sebayn'])).toBe(true)
    })
  })

  describe('negative matches', () => {
    it('does NOT match "Bayer" (no "ebay" substring)', () => {
      expect(isEbayCustomerName(['Bayer'])).toBe(false)
      expect(isEbayCustomerName(['Hans', 'Bayer'])).toBe(false)
    })

    it('does NOT match regular names or companies', () => {
      expect(isEbayCustomerName(['Müller GmbH', 'Erika', 'Musterfrau'])).toBe(
        false
      )
    })

    it('does NOT combine substrings across fields ("eb" + "ay")', () => {
      expect(isEbayCustomerName(['eb', 'ay'])).toBe(false)
    })

    it('never matches null / undefined / empty fields', () => {
      expect(isEbayCustomerName([null, undefined, ''])).toBe(false)
    })

    it('returns false for an empty field list', () => {
      expect(isEbayCustomerName([])).toBe(false)
    })
  })
})
