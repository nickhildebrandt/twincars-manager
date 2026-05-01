import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto'
import { env } from '$env/dynamic/private'

const ALGO = 'aes-256-gcm'

/**
 * Derive a 32-byte AES key from the configured APP_ENCRYPTION_KEY.
 * @throws if no key is set in production
 */
const getKey = (): Buffer => {
  const raw = env.APP_ENCRYPTION_KEY ?? 'dev-only-key-please-change-me-32'
  return createHash('sha256').update(raw).digest()
}

/**
 * Encrypt a plaintext string. Returns a base64 string with the format
 * `<iv>.<authTag>.<ciphertext>` (all base64-encoded).
 */
export const encrypt = (plain: string): string => {
  if (!plain) return ''
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    enc.toString('base64')
  ].join('.')
}

/**
 * Decrypt a string previously produced by encrypt(). Returns '' for empty input.
 */
export const decrypt = (data: string): string => {
  if (!data) return ''
  const [ivB64, tagB64, encB64] = data.split('.')
  if (!ivB64 || !tagB64 || !encB64) throw new Error('invalid encrypted payload')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const enc = Buffer.from(encB64, 'base64')
  const decipher = createDecipheriv(ALGO, getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    'utf-8'
  )
}
