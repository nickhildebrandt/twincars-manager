/**
 * Symmetric encryption for secrets at rest (AES-256-GCM).
 *
 * Used for third-party credentials the app must be able to read back
 * in plaintext (e.g. eBay OAuth refresh tokens) — a one-way hash is
 * not an option there, and leaving them plaintext in Postgres would
 * put long-lived seller credentials one DB dump away from abuse.
 *
 * Key derivation: SHA-256 over `APP_ENCRYPTION_KEY` (generated once by
 * `deploy/scripts/provision.sh` in production) falling back to
 * `APP_SECRET` for development — both are mandatory secrets, so the
 * cipher never runs with a known key. Wire format:
 * `v1:<base64(iv)>:<base64(authTag)>:<base64(ciphertext)>` — the
 * version prefix keeps room for future algorithm migrations.
 */
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes
} from 'node:crypto'
import { env } from '$env/dynamic/private'

const readEnv = (key: string): string | undefined =>
  process.env[key] ?? env[key]

const ALGO = 'aes-256-gcm'
const VERSION = 'v1'

function encryptionKey(): Buffer {
  const secret = readEnv('APP_ENCRYPTION_KEY') || readEnv('APP_SECRET')
  if (!secret) {
    throw new Error(
      'Weder APP_ENCRYPTION_KEY noch APP_SECRET ist gesetzt — Verschlüsselung nicht möglich.'
    )
  }
  return createHash('sha256').update(secret).digest()
}

/** Encrypt a UTF-8 string. Every call uses a fresh random IV. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, encryptionKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final()
  ])
  const tag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64')
  ].join(':')
}

/**
 * Decrypt a value produced by {@link encryptSecret}. Throws on
 * tampered data (GCM auth-tag mismatch) or an unknown format version.
 */
export function decryptSecret(stored: string): string {
  const parts = stored.split(':')
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Unbekanntes Chiffrat-Format.')
  }
  const [, ivB64, tagB64, dataB64] = parts
  const decipher = createDecipheriv(
    ALGO,
    encryptionKey(),
    Buffer.from(ivB64, 'base64')
  )
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final()
  ]).toString('utf8')
}
