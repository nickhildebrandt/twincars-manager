import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import {
  PAGE_SIZE,
  listQuerySchema,
  listResult,
  offsetFor,
  pageSchema,
} from '#shared/schemas/pagination'
import { envSchema, parseTokens } from '#shared/schemas/env'
import {
  IMAGE_TYPES,
  LIMITS,
  documentUploadSchema,
  fileListSchema,
  imageUploadSchema,
  logoUploadSchema,
  matchesSignature,
} from '#shared/schemas/upload'
import '#shared/schemas/messages'

function reject<T extends v.GenericSchema>(schema: T, input: unknown): string {
  const result = v.safeParse(schema, input)
  expect(result.success, `erwartete Ablehnung von ${JSON.stringify(input)}`).toBe(false)
  return result.success ? '' : result.issues[0]!.message
}

describe('Pagination', () => {
  it('hat genau eine Seitengröße', () => {
    expect(PAGE_SIZE).toBe(25)
  })

  it('setzt die Seite standardmäßig auf 1', () => {
    expect(v.parse(listQuerySchema, {}).page).toBe(1)
  })

  it('B-149: die Seitengröße ist nicht vom Aufrufer wählbar', () => {
    // Der Vorgänger erlaubte 10/25/50/100 über den Query-Parameter `size`.
    const parsed = v.parse(listQuerySchema, { page: 2, size: 100 }) as Record<string, unknown>
    expect(parsed.size).toBeUndefined()
    expect(listResult([], 0, 1).size).toBe(25)
  })

  it('lehnt Seite 0 ab, statt einen negativen Offset zu erzeugen', () => {
    expect(reject(pageSchema, 0)).toBe('Die Seitenzahl beginnt bei 1.')
  })

  it('lehnt eine negative Seite ab', () => {
    expect(reject(pageSchema, -3)).toBe('Die Seitenzahl beginnt bei 1.')
  })

  it('lehnt eine gebrochene Seitenzahl ab', () => {
    expect(reject(pageSchema, 1.5)).toBe('Die Seitenzahl muss eine ganze Zahl sein.')
  })

  it('rechnet den Offset korrekt', () => {
    expect(offsetFor(1)).toBe(0)
    expect(offsetFor(3)).toBe(50)
  })

  it('rechnet die Seitenzahl aus der Gesamtmenge', () => {
    expect(listResult([], 0, 1).pageCount).toBe(1)
    expect(listResult([], 25, 1).pageCount).toBe(1)
    expect(listResult([], 26, 1).pageCount).toBe(2)
    expect(listResult([], 100, 4).pageCount).toBe(4)
  })

  it('lehnt eine unbekannte Sortierrichtung ab', () => {
    expect(reject(listQuerySchema, { dir: 'seitwärts' })).toContain('asc')
  })
})

describe('Umgebungsvariablen', () => {
  const valid = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgres://user:pw@127.0.0.1:5432/twincars',
    APP_SECRET: 'a'.repeat(32),
    TZ: 'Europe/Berlin',
  }

  it('nimmt eine vollständige Entwicklungskonfiguration an', () => {
    expect(v.parse(envSchema, valid).DATABASE_URL).toContain('postgres://')
  })

  it('verlangt DATABASE_URL', () => {
    const { DATABASE_URL, ...rest } = valid
    expect(DATABASE_URL).toBeTruthy()
    expect(reject(envSchema, rest)).toBe('DATABASE_URL fehlt.')
  })

  it('lehnt eine Verbindung ab, die nicht auf Postgres zeigt', () => {
    expect(reject(envSchema, { ...valid, DATABASE_URL: 'mysql://x/y' })).toBe(
      'DATABASE_URL muss mit postgres:// beginnen.',
    )
  })

  it('verlangt ein ausreichend langes Sitzungsgeheimnis', () => {
    expect(reject(envSchema, { ...valid, APP_SECRET: 'kurz' })).toBe(
      'APP_SECRET muss mindestens 32 Zeichen lang sein.',
    )
  })

  it('erlaubt keine andere Zeitzone', () => {
    expect(reject(envSchema, { ...valid, TZ: 'UTC' })).toBe(
      'TZ muss auf Europe/Berlin stehen.',
    )
  })

  it('verlangt in der Produktion eine öffentliche Adresse', () => {
    expect(reject(envSchema, {
      ...valid,
      NODE_ENV: 'production',
      APP_ENCRYPTION_KEY: 'b'.repeat(32),
    })).toBe('ORIGIN muss in der Produktion gesetzt sein.')
  })

  it('verlangt in der Produktion einen eigenen Verschlüsselungsschlüssel', () => {
    expect(reject(envSchema, {
      ...valid,
      NODE_ENV: 'production',
      ORIGIN: 'https://tc.example.de',
    })).toContain('APP_ENCRYPTION_KEY')
  })

  it('lässt die Produktion mit vollständiger Konfiguration zu', () => {
    const parsed = v.parse(envSchema, {
      ...valid,
      NODE_ENV: 'production',
      ORIGIN: 'https://tc.example.de',
      APP_ENCRYPTION_KEY: 'b'.repeat(32),
    })
    expect(parsed.NODE_ENV).toBe('production')
  })

  it('lehnt zu kurze API-Token ab', () => {
    expect(reject(envSchema, { ...valid, API_TOKENS: 'kurz,auchkurz' })).toContain(
      'mindestens 16 Zeichen',
    )
  })

  it('nimmt eine leere Token-Liste an', () => {
    expect(v.parse(envSchema, { ...valid, API_TOKENS: '' }).API_TOKENS).toBe('')
  })

  it('trennt Token an Komma, Semikolon und Zeilenumbruch', () => {
    expect(parseTokens('a, b;c\nd')).toEqual(['a', 'b', 'c', 'd'])
    expect(parseTokens(undefined)).toEqual([])
    expect(parseTokens('  ')).toEqual([])
  })

  it('verlangt die eBay-Zugangsdaten gemeinsam', () => {
    expect(reject(envSchema, { ...valid, EBAY_CLIENT_ID: 'nur-eins' })).toContain(
      'gemeinsam gesetzt',
    )
  })

  it('nimmt eine vollständige eBay-Konfiguration an', () => {
    const parsed = v.parse(envSchema, {
      ...valid,
      EBAY_CLIENT_ID: 'a',
      EBAY_CERT_ID: 'b',
      EBAY_RU_NAME: 'c',
    })
    expect(parsed.EBAY_ENV).toBe('production')
  })

  it('lehnt einen zu kurzen eBay-Prüftoken ab', () => {
    expect(reject(envSchema, { ...valid, EBAY_VERIFICATION_TOKEN: 'zu-kurz' })).toContain(
      '32 bis 80 Zeichen',
    )
  })
})

describe('Uploads', () => {
  const file = (type: string, size: number) =>
    new File([new Uint8Array(size)], 'probe', { type })

  it('nimmt ein Bild innerhalb der Grenze an', () => {
    expect(() => v.parse(imageUploadSchema, file('image/png', 1024))).not.toThrow()
  })

  it('lehnt eine zu große Datei mit Angabe der Grenze ab', () => {
    const tooBig = file('image/png', LIMITS.image.bytes + 1)
    expect(reject(imageUploadSchema, tooBig)).toBe(
      'Die Bilddatei darf höchstens 10 MB groß sein.',
    )
  })

  it('lehnt einen nicht erlaubten Typ ab', () => {
    expect(reject(imageUploadSchema, file('application/zip', 10))).toContain('Erlaubt sind nur')
  })

  it('kennt die erlaubten Bildtypen', () => {
    expect(IMAGE_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp'])
  })

  it('erkennt echte Dateiinhalte an den Magic Bytes', () => {
    expect(matchesSignature('image/png', new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))).toBe(true)
    expect(matchesSignature('image/jpeg', new Uint8Array([0xFF, 0xD8, 0xFF]))).toBe(true)
    expect(matchesSignature('application/pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(true)
  })

  it('entlarvt eine als Bild getarnte Datei', () => {
    // "PK" — ein ZIP-Archiv, das sich als PNG ausgibt.
    expect(matchesSignature('image/png', new Uint8Array([0x50, 0x4B, 0x03, 0x04]))).toBe(false)
  })

  it('verlangt bei WebP die RIFF-Kennung samt WEBP-Marke', () => {
    const riffOnly = new Uint8Array(12)
    riffOnly.set([0x52, 0x49, 0x46, 0x46], 0)
    expect(matchesSignature('image/webp', riffOnly)).toBe(false)
    riffOnly.set([0x57, 0x45, 0x42, 0x50], 8)
    expect(matchesSignature('image/webp', riffOnly)).toBe(true)
  })
})

describe('Weitere Upload-Formen', () => {
  it('begrenzt die Anzahl Dateien einer Mehrfachauswahl', () => {
    const many = Array.from({ length: 3 }, () => new File([new Uint8Array(4)], 'a', { type: 'image/png' }))
    const schema = fileListSchema(imageUploadSchema, 2)
    expect(reject(schema, many)).toBe('Höchstens 2 Dateien auf einmal.')
  })

  it('nimmt eine Auswahl innerhalb der Grenze an', () => {
    const two = Array.from({ length: 2 }, () => new File([new Uint8Array(4)], 'a', { type: 'image/png' }))
    expect(v.parse(fileListSchema(imageUploadSchema, 2), two)).toHaveLength(2)
  })

  it('erlaubt beim Dokument-Upload auch PDF', () => {
    const pdf = new File([new Uint8Array(4)], 'beleg.pdf', { type: 'application/pdf' })
    expect(() => v.parse(documentUploadSchema, pdf)).not.toThrow()
  })

  it('begrenzt das Logo strenger als ein Fahrzeugfoto', () => {
    expect(LIMITS.logo.bytes).toBeLessThan(LIMITS.image.bytes)
    const big = new File([new Uint8Array(LIMITS.logo.bytes + 1)], 'logo.png', { type: 'image/png' })
    expect(reject(logoUploadSchema, big)).toContain('Logodatei')
  })

  it('kennt keine Signatur für einen unbekannten Typ', () => {
    expect(matchesSignature('application/zip', new Uint8Array([0x50, 0x4B]))).toBe(false)
  })
})
