import { describe, it, expect } from 'vitest'
import { safeParse } from 'valibot'
import {
  bicSchema,
  emailSchema,
  hsnSchema,
  ibanSchema,
  licensePlateSchema,
  listParamsSchema,
  moneySchema,
  nameSchema,
  notesSchema,
  paymentMethodSchema,
  personnelNumberSchema,
  timeHHMMSchema,
  tsnSchema,
  vinSchema,
  zipSchema
} from './validation'
import { PAYMENT_METHODS } from '$lib/payment-methods'

/**
 * Unit tests for the reusable Valibot schemas.
 *
 * @group unit
 * @module validation
 */
describe('validation schemas', () => {
  describe('nameSchema', () => {
    it('accepts trimmed strings 1-100 chars', () => {
      expect(safeParse(nameSchema, 'Mustermann').success).toBe(true)
    })
    it('rejects empty strings', () => {
      expect(safeParse(nameSchema, '').success).toBe(false)
    })
    it('rejects strings longer than 100 chars', () => {
      expect(safeParse(nameSchema, 'x'.repeat(101)).success).toBe(false)
    })
    it('trims surrounding whitespace', () => {
      const r = safeParse(nameSchema, '  Müller  ')
      expect(r.success).toBe(true)
      if (r.success) expect(r.output).toBe('Müller')
    })
  })

  describe('emailSchema', () => {
    it('accepts a valid email', () => {
      expect(safeParse(emailSchema, 'a@b.de').success).toBe(true)
    })
    it('rejects garbage', () => {
      expect(safeParse(emailSchema, 'not-an-email').success).toBe(false)
    })
    it('rejects empty', () => {
      expect(safeParse(emailSchema, '').success).toBe(false)
    })
  })

  describe('zipSchema', () => {
    it('accepts up to 10 chars', () => {
      expect(safeParse(zipSchema, '10115').success).toBe(true)
    })
    it('rejects > 10 chars', () => {
      expect(safeParse(zipSchema, '12345678901').success).toBe(false)
    })
  })

  describe('ibanSchema', () => {
    it('accepts a valid German IBAN', () => {
      expect(safeParse(ibanSchema, 'DE89370400440532013000').success).toBe(true)
    })
    it('rejects > 34 chars', () => {
      expect(safeParse(ibanSchema, 'X'.repeat(35)).success).toBe(false)
    })
    it('rejects an IBAN with a broken mod-97 checksum', () => {
      expect(safeParse(ibanSchema, 'DE00370400440532013000').success).toBe(
        false
      )
    })
    it('rejects arbitrary text that fits the length limit', () => {
      expect(safeParse(ibanSchema, 'DE00INVALIDIBAN').success).toBe(false)
    })
    it('normalizes grouped lowercase input to compact upper-case', () => {
      const r = safeParse(ibanSchema, 'de89 3704 0044 0532 0130 00')
      expect(r.success).toBe(true)
      if (r.success) expect(r.output).toBe('DE89370400440532013000')
    })
    it('still allows an empty string (optional bank details)', () => {
      expect(safeParse(ibanSchema, '').success).toBe(true)
    })
  })

  describe('bicSchema', () => {
    it('accepts 8- and 11-char BICs', () => {
      expect(safeParse(bicSchema, 'MARKDEF1').success).toBe(true)
      expect(safeParse(bicSchema, 'BYLADEM1001').success).toBe(true)
    })
    it('rejects a one-letter BIC', () => {
      expect(safeParse(bicSchema, 'X').success).toBe(false)
    })
    it('rejects a 9-char BIC (invalid length)', () => {
      expect(safeParse(bicSchema, 'MARKDEF12').success).toBe(false)
    })
    it('still allows an empty string (optional bank details)', () => {
      expect(safeParse(bicSchema, '').success).toBe(true)
    })
  })

  describe('moneySchema', () => {
    it('accepts numbers in range', () => {
      expect(safeParse(moneySchema, 0).success).toBe(true)
      expect(safeParse(moneySchema, 1234.56).success).toBe(true)
      expect(safeParse(moneySchema, -1234.56).success).toBe(true)
    })
    it('rejects non-numbers', () => {
      expect(safeParse(moneySchema, 'abc').success).toBe(false)
    })
    it('rejects values outside the allowed range', () => {
      expect(safeParse(moneySchema, 1e10).success).toBe(false)
    })
  })

  describe('notesSchema', () => {
    it('accepts up to 2000 chars', () => {
      expect(safeParse(notesSchema, 'x'.repeat(2000)).success).toBe(true)
    })
    it('rejects > 2000 chars', () => {
      expect(safeParse(notesSchema, 'x'.repeat(2001)).success).toBe(false)
    })
  })

  describe('listParamsSchema', () => {
    it('accepts valid params', () => {
      expect(safeParse(listParamsSchema, { page: 1, size: 25 }).success).toBe(
        true
      )
    })
    it('rejects unknown size', () => {
      expect(safeParse(listParamsSchema, { page: 1, size: 7 }).success).toBe(
        false
      )
    })
    it('rejects page < 1', () => {
      expect(safeParse(listParamsSchema, { page: 0, size: 25 }).success).toBe(
        false
      )
    })
  })

  describe('paymentMethodSchema', () => {
    it('accepts every method from the shared constant', () => {
      for (const method of PAYMENT_METHODS) {
        expect(safeParse(paymentMethodSchema, method).success).toBe(true)
      }
    })
    it('accepts undefined (optional — not specified)', () => {
      expect(safeParse(paymentMethodSchema, undefined).success).toBe(true)
    })
    it('rejects an unknown method', () => {
      expect(safeParse(paymentMethodSchema, 'Bitcoin').success).toBe(false)
    })
    it('rejects an empty string (forms send undefined instead)', () => {
      expect(safeParse(paymentMethodSchema, '').success).toBe(false)
    })
  })

  describe('licensePlateSchema', () => {
    it('accepts common German plates including umlauts and Kürzel-Ziffern variants', () => {
      for (const plate of [
        'B-XY 123',
        'M-A 1',
        'TÖL-K 42',
        'GÖ-AB 1234',
        'B-XY 123E',
        'B-XY 123H',
        '0-1'
      ]) {
        expect(safeParse(licensePlateSchema, plate).success).toBe(true)
      }
    })
    it('uppercases the input', () => {
      const r = safeParse(licensePlateSchema, ' b-xy 123 ')
      expect(r.success).toBe(true)
      if (r.success) expect(r.output).toBe('B-XY 123')
    })
    it('rejects empty, overlong and out-of-charset values', () => {
      expect(safeParse(licensePlateSchema, '').success).toBe(false)
      expect(safeParse(licensePlateSchema, 'B-XY 123456789').success).toBe(
        false
      )
      expect(safeParse(licensePlateSchema, 'B_XY!123').success).toBe(false)
    })
  })

  describe('vinSchema', () => {
    it('accepts a valid 17-char VIN and uppercases it', () => {
      const r = safeParse(vinSchema, 'wvwzzz1jz3w386752')
      expect(r.success).toBe(true)
      if (r.success) expect(r.output).toBe('WVWZZZ1JZ3W386752')
    })
    it('rejects wrong lengths', () => {
      expect(safeParse(vinSchema, 'WVWZZZ1JZ3W38675').success).toBe(false)
      expect(safeParse(vinSchema, 'WVWZZZ1JZ3W3867521').success).toBe(false)
    })
    it('rejects the forbidden letters I, O and Q', () => {
      expect(safeParse(vinSchema, 'IVWZZZ1JZ3W386752').success).toBe(false)
      expect(safeParse(vinSchema, 'OVWZZZ1JZ3W386752').success).toBe(false)
      expect(safeParse(vinSchema, 'QVWZZZ1JZ3W386752').success).toBe(false)
    })
  })

  describe('hsnSchema', () => {
    it('accepts exactly 4 digits', () => {
      expect(safeParse(hsnSchema, '0603').success).toBe(true)
    })
    it('rejects letters and wrong lengths', () => {
      expect(safeParse(hsnSchema, '060').success).toBe(false)
      expect(safeParse(hsnSchema, '06035').success).toBe(false)
      expect(safeParse(hsnSchema, '06A3').success).toBe(false)
    })
  })

  describe('tsnSchema', () => {
    it('accepts 3 alphanumeric characters and uppercases them', () => {
      const r = safeParse(tsnSchema, 'ajh')
      expect(r.success).toBe(true)
      if (r.success) expect(r.output).toBe('AJH')
      expect(safeParse(tsnSchema, '123').success).toBe(true)
    })
    it('rejects wrong lengths and special characters', () => {
      expect(safeParse(tsnSchema, 'AJ').success).toBe(false)
      expect(safeParse(tsnSchema, 'AJHX').success).toBe(false)
      expect(safeParse(tsnSchema, 'A-1').success).toBe(false)
    })
  })

  describe('timeHHMMSchema', () => {
    it('accepts valid 24h times', () => {
      for (const t of ['00:00', '08:30', '19:05', '23:59']) {
        expect(safeParse(timeHHMMSchema, t).success).toBe(true)
      }
    })
    it('rejects invalid times and other formats', () => {
      for (const t of ['24:00', '12:60', '8:30', '0830', '12:5', 'abc']) {
        expect(safeParse(timeHHMMSchema, t).success).toBe(false)
      }
    })
  })

  describe('personnelNumberSchema', () => {
    it('accepts trimmed values up to 20 chars', () => {
      const r = safeParse(personnelNumberSchema, '  P-001  ')
      expect(r.success).toBe(true)
      if (r.success) expect(r.output).toBe('P-001')
    })
    it('rejects empty and overlong values', () => {
      expect(safeParse(personnelNumberSchema, '   ').success).toBe(false)
      expect(safeParse(personnelNumberSchema, 'x'.repeat(21)).success).toBe(
        false
      )
    })
  })
})
