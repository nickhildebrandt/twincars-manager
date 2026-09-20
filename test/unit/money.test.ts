/**
 * Money is a whole number of cents (decision E-10).
 *
 * These tests exist because the previous application kept money in `numeric`
 * columns and did its arithmetic in JavaScript floats — the combination that
 * produced totals off by a cent (B-556 class). Every case below is one the old
 * code got wrong or could have.
 */
import { describe, expect, it } from 'vitest'
import {
  addVat,
  applyPercent,
  centsToEuro,
  euroToCents,
  formatAmount,
  formatEuro,
  lineTotal,
  parseEuro,
  splitVat,
  sumCents,
} from '#shared/money'

describe('euroToCents', () => {
  it.each([
    [1234.56, 123_456],
    [0.1, 10],
    [0, 0],
    [-10.5, -1050],
  ])('rechnet %s € in %s Cent um', (euro, cents) => {
    expect(euroToCents(euro)).toBe(cents)
  })

  it('rundet kaufmännisch von der Null weg', () => {
    expect(euroToCents(0.005)).toBe(1)
    expect(euroToCents(-0.005)).toBe(-1)
  })

  it('trifft den Fall, an dem Fließkomma scheitert', () => {
    // 0.1 + 0.2 ist als Fließkommazahl 0.30000000000000004.
    expect(euroToCents(0.1 + 0.2)).toBe(30)
  })
})

describe('centsToEuro', () => {
  it('rechnet zurück', () => {
    expect(centsToEuro(123_456)).toBe(1234.56)
  })
})

describe('formatEuro', () => {
  it.each([
    [123_456, '1.234,56 €'],
    [0, '0,00 €'],
    [-1050, '-10,50 €'],
    [5, '0,05 €'],
  ])('formatiert %s Cent als %s', (cents, text) => {
    expect(formatEuro(cents)).toBe(text)
  })
})

describe('formatAmount', () => {
  it('lässt das Währungszeichen weg', () => {
    expect(formatAmount(123_456)).toBe('1.234,56')
  })
})

describe('parseEuro', () => {
  it.each([
    ['1.234,56', 123_456],
    ['1234,56', 123_456],
    ['1234.56', 123_456],
    ['1234', 123_400],
    ['0,05', 5],
    ['0,5', 50],
    ['-10,50', -1050],
    ['1.234,56 €', 123_456],
    ['€1.234,56', 123_456],
    ['1 234,56', 123_456],
    ['+99,99', 9999],
  ])('liest %s als %s Cent', (input, cents) => {
    expect(parseEuro(input)).toBe(cents)
  })

  it.each([
    ['', 'leere Eingabe'],
    ['abc', 'Buchstaben'],
    ['1,234', 'drei Nachkommastellen'],
    ['1.23.4', 'unsinnige Punkte'],
    ['1,2,3', 'zwei Kommas'],
    ['--5', 'zwei Minus'],
    ['5-', 'Minus hinten'],
  ])('lehnt %s ab (%s)', (input) => {
    expect(parseEuro(input)).toBeNull()
  })

  it('lehnt eine Zahl ab, die keine genaue Ganzzahl mehr ergibt', () => {
    // Jenseits von 2^53 rechnet JavaScript nicht mehr genau. Lieber
    // ablehnen als einen falschen Betrag zurückgeben.
    expect(parseEuro('99999999999999999999,99')).toBeNull()
  })
})

describe('sumCents', () => {
  it('summiert genau, wo Fließkomma daneben liegt', () => {
    expect(sumCents([10, 20])).toBe(30)
    expect(sumCents(Array.from({ length: 10 }, () => 10))).toBe(100)
  })

  it('summiert die leere Liste zu null', () => {
    expect(sumCents([])).toBe(0)
  })
})

describe('applyPercent', () => {
  it('rechnet 19 Prozent von 100 €', () => {
    expect(applyPercent(10_000, 19)).toBe(1900)
  })

  it('rundet kaufmännisch', () => {
    // 19 % von 0,03 € sind 0,0057 € — das ist ein Cent.
    expect(applyPercent(3, 19)).toBe(1)
  })

  it('ergibt bei null Prozent null', () => {
    expect(applyPercent(12_345, 0)).toBe(0)
  })
})

describe('addVat', () => {
  it('macht aus 100 € netto 119 € brutto', () => {
    expect(addVat(10_000, 19)).toBe(11_900)
  })

  it('kennt auch sieben Prozent', () => {
    expect(addVat(10_000, 7)).toBe(10_700)
  })
})

describe('splitVat', () => {
  it('zerlegt 119 € brutto in 100 € netto und 19 € Steuer', () => {
    expect(splitVat(11_900, 19)).toEqual({ net: 10_000, tax: 1900 })
  })

  it('ergibt netto plus Steuer immer wieder genau den Bruttobetrag', () => {
    for (const gross of [1, 7, 99, 1234, 99_999, 1_000_000, 2_147_483_647]) {
      const { net, tax } = splitVat(gross, 19)
      expect(net + tax).toBe(gross)
    }
  })

  it('lässt bei null Prozent die Steuer weg', () => {
    expect(splitVat(5000, 0)).toEqual({ net: 5000, tax: 0 })
  })
})

describe('lineTotal', () => {
  it('multipliziert Menge mit Einzelpreis', () => {
    expect(lineTotal(2500, 4)).toBe(10_000)
  })

  it('verträgt eine gebrochene Menge', () => {
    expect(lineTotal(6500, 2.5)).toBe(16_250)
  })

  it('zieht einen Rabatt ab', () => {
    expect(lineTotal(10_000, 1, 10)).toBe(9000)
  })

  it('rundet das Ergebnis auf ganze Cent', () => {
    // 1,75 × 0,99 € sind 1,7325 € — das sind 173 Cent.
    expect(lineTotal(99, 1.75)).toBe(173)
  })
})
