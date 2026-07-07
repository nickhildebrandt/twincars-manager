import { describe, it, expect } from 'vitest'
import { isValidBic, isValidIban, normalizeBankCode } from './iban'

/**
 * Unit tests for the shared IBAN/BIC plausibility helpers.
 *
 * @group unit
 * @module iban
 */
describe('normalizeBankCode', () => {
  it('strips whitespace and upper-cases', () => {
    expect(normalizeBankCode(' de89 3704 0044 0532 0130 00 ')).toBe(
      'DE89370400440532013000'
    )
  })
})

describe('isValidIban', () => {
  it('accepts valid IBANs from different countries', () => {
    expect(isValidIban('DE89370400440532013000')).toBe(true)
    expect(isValidIban('DE02120300000000202051')).toBe(true)
    expect(isValidIban('AT611904300234573201')).toBe(true)
    expect(isValidIban('CH9300762011623852957')).toBe(true)
  })
  it('rejects a checksum off by one', () => {
    expect(isValidIban('DE88370400440532013000')).toBe(false)
  })
  it('rejects check digits 00', () => {
    expect(isValidIban('DE00370400440532013000')).toBe(false)
  })
  it('rejects too-short and malformed values', () => {
    expect(isValidIban('DE89')).toBe(false)
    expect(isValidIban('DE00INVALIDIBAN')).toBe(false)
    expect(isValidIban('1234567890123456')).toBe(false)
    expect(isValidIban('')).toBe(false)
  })
})

describe('isValidBic', () => {
  it('accepts 8- and 11-char BICs', () => {
    expect(isValidBic('MARKDEF1')).toBe(true)
    expect(isValidBic('BYLADEM1001')).toBe(true)
  })
  it('rejects wrong lengths and shapes', () => {
    expect(isValidBic('X')).toBe(false)
    expect(isValidBic('MARKDEF12')).toBe(false)
    expect(isValidBic('12345678')).toBe(false)
    expect(isValidBic('')).toBe(false)
  })
})
