// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Tests for the secrets-at-rest cipher (AES-256-GCM): roundtrip,
 * per-call IV freshness, tamper detection, key fallback and the
 * fail-closed path without any secret.
 *
 * @group unit
 * @module crypto
 */

// Neutralize the vite-loaded `.env` passthrough so the fail-closed
// case is actually reachable: `readEnv` checks `process.env` first
// (which `vi.stubEnv` controls), then `$env/dynamic/private`.
vi.mock('$env/dynamic/private', () => ({ env: {} }))

import { encryptSecret, decryptSecret } from './crypto'

beforeEach(() => {
  vi.stubEnv('APP_ENCRYPTION_KEY', 'test-encryption-key-please-rotate')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('encryptSecret / decryptSecret', () => {
  it('roundtrips arbitrary strings (incl. umlauts and long tokens)', () => {
    for (const plain of [
      'kurz',
      'v^1.1#i^1#f^0#refresh-token-öäüß-'.repeat(40),
      ''
    ]) {
      expect(decryptSecret(encryptSecret(plain))).toBe(plain)
    }
  })

  it('produces a fresh IV per call (same plaintext, different ciphertexts)', () => {
    const a = encryptSecret('same')
    const b = encryptSecret('same')
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe('same')
    expect(decryptSecret(b)).toBe('same')
  })

  it('detects tampering via the GCM auth tag', () => {
    const stored = encryptSecret('secret-value')
    const parts = stored.split(':')
    // Flip a byte inside the ciphertext part.
    const data = Buffer.from(parts[3], 'base64')
    data[0] = data[0] ^ 0xff
    parts[3] = data.toString('base64')
    expect(() => decryptSecret(parts.join(':'))).toThrow()
  })

  it('rejects unknown format versions', () => {
    expect(() => decryptSecret('v9:a:b:c')).toThrow(/Format/)
    expect(() => decryptSecret('garbage')).toThrow(/Format/)
  })

  it('falls back to APP_SECRET when APP_ENCRYPTION_KEY is absent', () => {
    vi.unstubAllEnvs()
    vi.stubEnv('APP_SECRET', 'dev-secret-fallback')
    const stored = encryptSecret('with-fallback-key')
    expect(decryptSecret(stored)).toBe('with-fallback-key')
  })

  it('fails closed when neither secret is set', () => {
    vi.unstubAllEnvs()
    const prevKey = process.env.APP_ENCRYPTION_KEY
    const prevSecret = process.env.APP_SECRET
    delete process.env.APP_ENCRYPTION_KEY
    delete process.env.APP_SECRET
    try {
      expect(() => encryptSecret('x')).toThrow(/APP_ENCRYPTION_KEY/)
    } finally {
      if (prevKey != null) process.env.APP_ENCRYPTION_KEY = prevKey
      if (prevSecret != null) process.env.APP_SECRET = prevSecret
    }
  })

  it('a value encrypted under one key does not decrypt under another', () => {
    const stored = encryptSecret('cross-key')
    vi.stubEnv('APP_ENCRYPTION_KEY', 'a-completely-different-key')
    expect(() => decryptSecret(stored)).toThrow()
  })
})
