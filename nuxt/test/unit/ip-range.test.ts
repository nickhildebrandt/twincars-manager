/**
 * Der sichere Adressbereich (P-22).
 *
 * Diese Rechnung entscheidet, ob jemand ausgesperrt werden kann. Ein Fehler
 * hier hat zwei Gesichter: entweder sperrt sich der Betrieb selbst aus, oder
 * ein Angreifer gilt versehentlich als sicher. Beide Richtungen werden
 * geprüft, und die zweite besonders.
 */
import { describe, expect, it } from 'vitest'
import {
  ipv4ToNumber,
  isSafeAddress,
  isUnderstoodEntry,
  matchesEntry,
  unknownEntries,
} from '#shared/ip-range'

describe('ipv4ToNumber', () => {
  it('rechnet eine Adresse in eine Zahl um', () => {
    expect(ipv4ToNumber('0.0.0.0')).toBe(0)
    expect(ipv4ToNumber('0.0.0.1')).toBe(1)
    expect(ipv4ToNumber('0.0.1.0')).toBe(256)
    expect(ipv4ToNumber('192.168.1.7')).toBe(3232235783)
    expect(ipv4ToNumber('255.255.255.255')).toBe(4294967295)
  })

  it('übergeht Leerzeichen am Rand', () => {
    expect(ipv4ToNumber('  10.0.0.1  ')).toBe(ipv4ToNumber('10.0.0.1'))
  })

  it('weist alles zurück, was keine Adresse ist', () => {
    for (const value of [
      '',
      '10.0.0',
      '10.0.0.1.2',
      '10.0.0.256',
      '10.0.0.-1',
      '10.0.0.a',
      '10.0.0.01x',
      'localhost',
      '::1',
      '10.0.0.1/24',
    ]) {
      expect(ipv4ToNumber(value), value).toBeNull()
    }
  })
})

describe('matchesEntry — einzelne Adresse', () => {
  it('trifft genau sich selbst', () => {
    expect(matchesEntry('192.168.1.7', '192.168.1.7')).toBe(true)
    expect(matchesEntry('192.168.1.8', '192.168.1.7')).toBe(false)
  })
})

describe('matchesEntry — Netz in CIDR-Schreibweise', () => {
  it('trifft das ganze Netz, aber nicht das Nachbarnetz', () => {
    expect(matchesEntry('192.168.1.0', '192.168.1.0/24')).toBe(true)
    expect(matchesEntry('192.168.1.255', '192.168.1.0/24')).toBe(true)
    expect(matchesEntry('192.168.2.0', '192.168.1.0/24')).toBe(false)
    expect(matchesEntry('192.168.0.255', '192.168.1.0/24')).toBe(false)
  })

  it('rechnet auch mit einer Maske, die nicht auf einem Punkt endet', () => {
    // /23 fasst 192.168.2.0 und 192.168.3.0 zusammen.
    expect(matchesEntry('192.168.2.5', '192.168.2.0/23')).toBe(true)
    expect(matchesEntry('192.168.3.5', '192.168.2.0/23')).toBe(true)
    expect(matchesEntry('192.168.4.5', '192.168.2.0/23')).toBe(false)
  })

  it('nimmt /32 als genau eine Adresse', () => {
    expect(matchesEntry('10.1.2.3', '10.1.2.3/32')).toBe(true)
    expect(matchesEntry('10.1.2.4', '10.1.2.3/32')).toBe(false)
  })

  it('nimmt /0 als alles — auch jenseits der Vorzeichengrenze', () => {
    expect(matchesEntry('1.2.3.4', '0.0.0.0/0')).toBe(true)
    expect(matchesEntry('255.255.255.255', '0.0.0.0/0')).toBe(true)
  })

  it('rechnet oberhalb von 127.255.255.255 richtig', () => {
    // Hier kippt das Vorzeichenbit in JavaScripts Bit-Rechnung. Ohne `>>> 0`
    // an beiden Seiten des Vergleichs stimmt genau dieser Fall nicht.
    expect(matchesEntry('192.168.1.7', '192.168.0.0/16')).toBe(true)
    expect(matchesEntry('192.169.1.7', '192.168.0.0/16')).toBe(false)
    expect(matchesEntry('240.0.0.1', '240.0.0.0/8')).toBe(true)
  })

  it('weist eine unmögliche Maske zurück', () => {
    expect(matchesEntry('10.0.0.1', '10.0.0.0/33')).toBe(false)
    expect(matchesEntry('10.0.0.1', '10.0.0.0/99')).toBe(false)
  })
})

describe('matchesEntry — Bereich mit Bindestrich', () => {
  it('versteht die Kurzform mit nur dem letzten Glied', () => {
    expect(matchesEntry('192.168.1.9', '192.168.1.10-50')).toBe(false)
    expect(matchesEntry('192.168.1.10', '192.168.1.10-50')).toBe(true)
    expect(matchesEntry('192.168.1.30', '192.168.1.10-50')).toBe(true)
    expect(matchesEntry('192.168.1.50', '192.168.1.10-50')).toBe(true)
    expect(matchesEntry('192.168.1.51', '192.168.1.10-50')).toBe(false)
  })

  it('versteht die lange Form mit zwei vollen Adressen', () => {
    expect(matchesEntry('192.168.2.7', '192.168.1.10-192.168.3.50')).toBe(true)
    expect(matchesEntry('192.168.1.9', '192.168.1.10-192.168.3.50')).toBe(false)
    expect(matchesEntry('192.168.3.51', '192.168.1.10-192.168.3.50')).toBe(false)
  })

  it('erlaubt Leerzeichen um den Bindestrich', () => {
    expect(matchesEntry('192.168.1.30', '192.168.1.10 - 50')).toBe(true)
  })

  it('weist einen verkehrt herum geschriebenen Bereich zurück', () => {
    expect(matchesEntry('192.168.1.30', '192.168.1.50-10')).toBe(false)
  })
})

describe('matchesEntry — was nicht verstanden wird, trifft nie', () => {
  it.each([
    ['leer', ''],
    ['nur Leerzeichen', '   '],
    ['Wortlaut', 'internes Netz'],
    ['IPv6', 'fe80::1'],
    ['halbe Adresse', '192.168.1'],
    ['Oktett zu groß', '192.168.1.999'],
    ['Bereich ohne Zahlen', '192.168.1.10-abc'],
    ['Netz mit unsinniger Basis', '192.168.1.999/24'],
  ])('%s trifft nicht', (_name, entry) => {
    expect(matchesEntry('192.168.1.7', entry)).toBe(false)
  })

  it('trifft nicht, wenn schon die geprüfte Adresse keine ist', () => {
    expect(matchesEntry('kein-rechner', '192.168.1.0/24')).toBe(false)
    expect(matchesEntry('::1', '0.0.0.0/0')).toBe(false)
  })
})

describe('isSafeAddress', () => {
  it('ist leer gelassen für niemanden sicher', () => {
    expect(isSafeAddress('192.168.1.7', '')).toBe(false)
    expect(isSafeAddress('192.168.1.7', '   \n  ')).toBe(false)
  })

  it('liest mehrere Zeilen', () => {
    const setting = '10.0.0.0/8\n192.168.1.0/24\n203.0.113.9'
    expect(isSafeAddress('10.9.9.9', setting)).toBe(true)
    expect(isSafeAddress('192.168.1.7', setting)).toBe(true)
    expect(isSafeAddress('203.0.113.9', setting)).toBe(true)
    expect(isSafeAddress('203.0.113.10', setting)).toBe(false)
  })

  it('liest ebenso Kommata und Semikola', () => {
    expect(isSafeAddress('10.0.0.1', '10.0.0.0/8, 192.168.0.0/16')).toBe(true)
    expect(isSafeAddress('192.168.0.1', '10.0.0.0/8; 192.168.0.0/16')).toBe(true)
  })

  it('übergeht Notizen hinter einer Raute', () => {
    const setting = '# Werkstatt\n192.168.1.0/24 # Büro oben\n\n# 10.0.0.0/8 abgeschaltet'
    expect(isSafeAddress('192.168.1.7', setting)).toBe(true)
    expect(isSafeAddress('10.0.0.1', setting)).toBe(false)
  })

  it('ist ohne Adresse nie sicher', () => {
    expect(isSafeAddress(null, '0.0.0.0/0')).toBe(false)
    expect(isSafeAddress(undefined, '0.0.0.0/0')).toBe(false)
    expect(isSafeAddress('', '0.0.0.0/0')).toBe(false)
  })

  it('macht aus einem Tippfehler keinen Freifahrtschein', () => {
    // Lieber sperrt die Anwendung zu viel als zu wenig: ein Eintrag, den
    // niemand versteht, darf nicht plötzlich alles erlauben.
    expect(isSafeAddress('8.8.8.8', 'internes Netz')).toBe(false)
    expect(isSafeAddress('8.8.8.8', '192.168.1.0/999')).toBe(false)
  })

  it('reicht ein einziger passender Eintrag', () => {
    expect(isSafeAddress('8.8.8.8', 'Unsinn\n8.8.8.8\nnoch mehr Unsinn')).toBe(true)
  })
})

describe('isUnderstoodEntry', () => {
  it.each([
    '192.168.1.7',
    '192.168.1.0/24',
    '0.0.0.0/0',
    '10.0.0.1/32',
    '192.168.1.10-50',
    '192.168.1.10-192.168.3.50',
    '192.168.1.10 - 50',
  ])('versteht %s', (entry) => {
    expect(isUnderstoodEntry(entry)).toBe(true)
  })

  it.each([
    '',
    '   ',
    'internes Netz',
    'fe80::1',
    '192.168.1',
    '192.168.1.256',
    '192.168.1.0/33',
    '192.168.1.50-10',
    '192.168.1.10-abc',
  ])('versteht %s nicht', (entry) => {
    expect(isUnderstoodEntry(entry)).toBe(false)
  })
})

describe('unknownEntries', () => {
  it('nennt genau die Einträge, die nicht verstanden werden', () => {
    const setting = '192.168.1.0/24\ninternes Netz\n10.0.0.1\nfe80::1'
    expect(unknownEntries(setting)).toEqual(['internes Netz', 'fe80::1'])
  })

  it('meldet für eine saubere Einstellung nichts', () => {
    expect(unknownEntries('10.0.0.0/8\n# Notiz\n\n192.168.1.10-50')).toEqual([])
  })

  it('meldet für eine leere Einstellung nichts', () => {
    expect(unknownEntries('')).toEqual([])
    expect(unknownEntries('\n\n  \n')).toEqual([])
  })
})
