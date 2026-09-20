/**
 * Symmetric encryption for the few secrets the application must read back:
 * the eBay refresh token and the SMTP password. A hash is not an option
 * there, and plaintext would put long-lived credentials one database dump
 * away from abuse (../../docs/rewrite/03-architektur.md §9.6).
 *
 * Business data is deliberately **not** encrypted at rest. Encrypting
 * everything would cost every query its indexes and buy nothing: whoever can
 * read the database can also read the key.
 *
 * Wire format `v1:<iv>:<tag>:<data>`, all base64. The version prefix leaves
 * room for a future algorithm without a data migration.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const VERSION = 'v1'

/** Turns a configured secret into a 32-byte key. */
export function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

/**
 * The key of this installation, derived from the configured secret.
 *
 * There is no fallback to a built-in value. The predecessor fell back to a
 * fixed development secret when the variable was missing, so a production
 * instance could run with a publicly known key and nobody would notice
 * (B-018). Here the environment is validated at startup, and this function
 * throws rather than invent a key.
 */
function encryptionKey(): Buffer {
  const config = useRuntimeConfig()
  const secret = config.appEncryptionKey || config.appSecret
  if (!secret) {
    throw new Error('Weder APP_ENCRYPTION_KEY noch APP_SECRET ist gesetzt.')
  }
  return deriveKey(secret)
}

/**
 * Encrypts a string. Every call uses a fresh random initialisation vector.
 *
 * The key argument exists so the cipher can be exercised without a running
 * server; production callers omit it.
 */
export function encryptSecret(plain: string, key: Buffer = encryptionKey()): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [
    VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    data.toString('base64'),
  ].join(':')
}

/** True when the value carries the `v1:iv:tag:data` format. */
export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(`${VERSION}:`) && value.split(':').length === 4
}

/** Decrypts a value produced by {@link encryptSecret}. Throws if tampered with. */
export function decryptSecret(stored: string, key: Buffer = encryptionKey()): string {
  const parts = stored.split(':')
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Unbekanntes Chiffrat-Format.')
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(parts[1]!, 'base64'))
  decipher.setAuthTag(Buffer.from(parts[2]!, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(parts[3]!, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

/**
 * Decrypts when the value is encrypted, returns it unchanged otherwise.
 *
 * Rows written before encryption existed stay readable; the next save writes
 * them back encrypted. No data migration, no unreadable settings page.
 */
export function decryptSecretIfNeeded(stored: string, key?: Buffer): string {
  return isEncryptedSecret(stored) ? decryptSecret(stored, key ?? encryptionKey()) : stored
}

/** Masks a secret for display: only the last four characters survive. */
export function maskSecret(value: string): string {
  if (value.length <= 4) return '••••'
  return `••••${value.slice(-4)}`
}
