/**
 * Cross-cutting guarantees over ALL schemas.
 *
 * These tests have no business subject. They keep the rules from
 * ../../../docs/rewrite/03-architektur.md §6 from decaying as modules are
 * added: German messages everywhere, a label for every field key, and types
 * that are derived rather than written twice.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import * as primitives from '#shared/schemas/primitives'
import * as pagination from '#shared/schemas/pagination'
import { FIELD_LABELS, labelForPath } from '#shared/schemas/field-labels'
import { MESSAGES } from '#shared/schemas/messages'

const schemaDir = join(process.cwd(), 'shared', 'schemas')

/** Every exported value that looks like a Valibot schema. */
function exportedSchemas(module: Record<string, unknown>): [string, v.GenericSchema][] {
  return Object.entries(module).filter(
    (entry): entry is [string, v.GenericSchema] =>
      typeof entry[1] === 'object'
      && entry[1] !== null
      && 'kind' in entry[1]
      && (entry[1] as { kind?: string }).kind === 'schema',
  )
}

/** Walks a schema and collects every message it can produce. */
function messagesOf(schema: unknown, seen = new Set<unknown>()): string[] {
  if (!schema || typeof schema !== 'object' || seen.has(schema)) return []
  seen.add(schema)
  const node = schema as Record<string, unknown>
  const out: string[] = []

  if (typeof node.message === 'string') out.push(node.message)
  for (const key of ['pipe', 'entries', 'options', 'item', 'wrapped', 'default']) {
    const value = node[key]
    if (Array.isArray(value)) for (const entry of value) out.push(...messagesOf(entry, seen))
    else if (value && typeof value === 'object') out.push(...messagesOf(value, seen))
  }
  return out
}

/** Words that only appear in English validator output. */
const ENGLISH_MARKERS = [
  'Invalid ', 'Expected ', 'but received', 'must be', 'is required',
  'should be', 'not allowed', 'does not',
]

describe('Alle Schemata sprechen Deutsch', () => {
  const modules: [string, Record<string, unknown>][] = [
    ['primitives', primitives as Record<string, unknown>],
    ['pagination', pagination as Record<string, unknown>],
  ]

  for (const [name, module] of modules) {
    it(`${name}: keine englische Meldung`, () => {
      const offenders: string[] = []
      for (const [exportName, schema] of exportedSchemas(module)) {
        for (const message of messagesOf(schema)) {
          if (ENGLISH_MARKERS.some(marker => message.includes(marker))) {
            offenders.push(`${exportName}: "${message}"`)
          }
        }
      }
      expect(offenders).toEqual([])
    })
  }

  it('die eingebauten Meldungen sind auf Deutsch gestellt', () => {
    // Kein eigener Text am Schema — die Meldung kommt aus der Sprachdatei.
    const result = v.safeParse(v.number(), 'keine Zahl')
    expect(result.success).toBe(false)
    const message = result.success ? '' : result.issues[0]!.message
    expect(message).not.toMatch(/Invalid|Expected|received/)
    expect(message.length).toBeGreaterThan(0)
  })

  it('B-042: eine deutsche Meldung ohne Umlaut wird nicht verworfen', () => {
    // Der Vorgänger hielt jede Meldung ohne Umlaut für Englisch und ersetzte
    // sie durch einen generischen Text. Diese Meldung enthält keinen Umlaut
    // und muss den Nutzer unverändert erreichen.
    const result = v.safeParse(pagination.pageSchema, 0)
    expect(result.success).toBe(false)
    const message = result.success ? '' : result.issues[0]!.message
    expect(message).toBe('Die Seitenzahl beginnt bei 1.')
    expect(message).not.toMatch(/[äöüßÄÖÜ]/)
  })
})

describe('Feldbezeichnungen', () => {
  it('übersetzt einen einfachen Schlüssel', () => {
    expect(labelForPath('bankIban')).toBe('IBAN')
  })

  it('überspringt technische Hüllen', () => {
    expect(labelForPath('values.firstName')).toBe('Vorname')
    expect(labelForPath('body.email')).toBe('E-Mail')
  })

  it('nennt die Position bei Listen, 1-basiert', () => {
    expect(labelForPath('items.0.quantity')).toBe('Menge (Position 1)')
    expect(labelForPath('items.11.unitPriceNet')).toBe('Einzelpreis netto (Position 12)')
  })

  it('fällt auf den Rohschlüssel zurück, statt das Feld zu verschweigen', () => {
    expect(labelForPath('nochNichtBenannt')).toBe('nochNichtBenannt')
  })

  it('B-363: die SMTP-Felder haben deutsche Bezeichnungen', () => {
    // Der Vorgänger kannte für `fromAddress`, `replyTo` und `secure` keine
    // Bezeichnung, sodass der Nutzer im Fehlerfall den technischen Schlüssel
    // sah. Die Formularhälfte des Befunds (novalidate, deutsche Meldungen)
    // gehört zu T-026.
    for (const key of ['host', 'port', 'secure', 'username', 'password',
      'fromAddress', 'fromName', 'replyTo']) {
      expect(FIELD_LABELS[key], key).toBeTruthy()
      expect(labelForPath(key), key).not.toBe(key)
    }
  })

  it('jede Bezeichnung ist auf Deutsch und nicht leer', () => {
    for (const [key, label] of Object.entries(FIELD_LABELS)) {
      expect(label.trim(), `Label für ${key}`).not.toBe('')
      expect(label, `Label für ${key}`).not.toMatch(/^[a-z]+[A-Z]/)
    }
  })
})

describe('Typen werden abgeleitet', () => {
  it('shared/schemas deklariert keine handgeschriebenen Objekttypen', () => {
    const offenders: string[] = []
    for (const file of readdirSync(schemaDir).filter(f => f.endsWith('.ts'))) {
      const source = readFileSync(join(schemaDir, file), 'utf8')
      for (const match of source.matchAll(/^export (?:type|interface) (\w+)([^\n]*)/gm)) {
        const [, name, rest] = match
        const derived = /InferOutput|InferInput|ListResult|ErrorCode|=\s*\w+\[/.test(rest ?? '')
        const generic = /^<|<T>/.test(rest ?? '')
        if (!derived && !generic) offenders.push(`${file}: ${name}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('Meldungskatalog', () => {
  it('baut Längenmeldungen mit der konkreten Zahl', () => {
    expect(MESSAGES.tooLong(50)).toBe('Höchstens 50 Zeichen.')
    expect(MESSAGES.tooShort(3)).toBe('Mindestens 3 Zeichen.')
  })

  it('formuliert jede Meldung als vollständigen Satz', () => {
    const texts = Object.values(MESSAGES).map(entry =>
      typeof entry === 'function' ? entry(1) : entry,
    )
    for (const text of texts) {
      expect(text).toMatch(/[.!?]$/)
      expect(text).not.toMatch(/Invalid|Expected|required/)
    }
  })
})
