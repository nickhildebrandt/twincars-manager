import { describe, it, expect } from 'vitest'
import { safeParse } from 'valibot'
import {
  emailSchema,
  ibanSchema,
  listParamsSchema,
  moneySchema,
  nameSchema,
  notesSchema,
  zipSchema
} from './validation'

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
    it('accepts up to 34 chars', () => {
      expect(safeParse(ibanSchema, 'DE89370400440532013000').success).toBe(true)
    })
    it('rejects > 34 chars', () => {
      expect(safeParse(ibanSchema, 'X'.repeat(35)).success).toBe(false)
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
})
