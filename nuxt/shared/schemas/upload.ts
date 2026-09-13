/**
 * File uploads. Type, size and count are validated before anything is written
 * (../../../docs/rewrite/03-architektur.md §6.7).
 *
 * The predecessor moved files as base64 inside JSON, trusted the client's
 * content type and stored originals unscaled (B-112, B-248). Here the type is
 * checked against a whitelist and, on the server, against the file's magic
 * bytes as well.
 */
import * as v from 'valibot'

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const DOCUMENT_TYPES = ['application/pdf', ...IMAGE_TYPES] as const

export const LIMITS = {
  image: { bytes: 10 * 1024 * 1024, count: 15 },
  document: { bytes: 15 * 1024 * 1024, count: 20 },
  logo: { bytes: 2 * 1024 * 1024, count: 1 },
  mailAttachment: { bytes: 10 * 1024 * 1024, count: 10 },
  legacyDatabase: { bytes: 64 * 1024 * 1024, count: 1 },
} as const

const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024))

/** One uploaded file, checked for type and size. */
export const fileSchema = (
  types: readonly string[],
  maxBytes: number,
  label = 'Datei',
) =>
  v.pipe(
    v.file(`Bitte eine ${label} auswählen.`),
    v.mimeType(
      types as unknown as `${string}/${string}`[],
      `Erlaubt sind nur ${types.map(t => (t.split('/')[1] ?? t).toUpperCase()).join(', ')}.`,
    ),
    v.maxSize(maxBytes, `Die ${label} darf höchstens ${megabytes(maxBytes)} MB groß sein.`),
  )

export const imageUploadSchema = fileSchema(IMAGE_TYPES, LIMITS.image.bytes, 'Bilddatei')
export const documentUploadSchema = fileSchema(DOCUMENT_TYPES, LIMITS.document.bytes, 'Datei')
export const logoUploadSchema = fileSchema(IMAGE_TYPES, LIMITS.logo.bytes, 'Logodatei')

/** Several files at once, with an upper bound on the count. */
export const fileListSchema = (
  single: ReturnType<typeof fileSchema>,
  maxCount: number,
) =>
  v.pipe(
    v.array(single),
    v.maxLength(maxCount, `Höchstens ${maxCount} Dateien auf einmal.`),
  )

/**
 * Magic bytes per accepted type. The browser-supplied content type is a hint,
 * not evidence — the server checks the first bytes of the file as well.
 */
const SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF, followed by WEBP at byte 8
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
}

/** True when the bytes actually look like the claimed type. */
export function matchesSignature(type: string, bytes: Uint8Array): boolean {
  const candidates = SIGNATURES[type]
  if (!candidates) return false
  const matches = candidates.some(sig => sig.every((byte, i) => bytes[i] === byte))
  if (!matches) return false
  if (type === 'image/webp') {
    return bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  }
  return true
}

/**
 * Ob dieser Medientyp überhaupt hochgeladen werden darf.
 *
 * Eine Zulassungsliste, geprüft im Dialog **und** beim Ablegen. Der Vorgänger
 * prüfte beim Ablegen nur auf „irgendein Bild" und ließ damit Formate durch,
 * die der Dialog gar nicht anbot (B-115).
 */
export const isAllowedUpload = (type: string): boolean =>
  (DOCUMENT_TYPES as readonly string[]).includes(type)

/** `2400000` → `2,4 MB`. Für eine Meldung, die eine Zahl nennt, die jemand kennt. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Byte`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value < 10 ? 1 : 0).replace('.', ',')} ${units[unit]}`
}
