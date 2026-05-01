import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from './crypto'

/**
 * Round-trip tests for the AES-GCM crypto helpers.
 *
 * @group unit
 * @module crypto
 */
describe('crypto', () => {
  it('encrypts and decrypts a string', () => {
    const enc = encrypt('hello world')
    expect(enc).not.toBe('hello world')
    expect(decrypt(enc)).toBe('hello world')
  })

  it('returns empty string for empty input', () => {
    expect(encrypt('')).toBe('')
    expect(decrypt('')).toBe('')
  })

  it('produces different ciphertext for the same input (random IV)', () => {
    expect(encrypt('foo')).not.toBe(encrypt('foo'))
  })

  it('throws on tampered payload', () => {
    expect(() => decrypt('not.a.payload')).toThrow()
  })
})
