/**
 * Belegnummern und ihre Stände (M-44).
 *
 * Zwei Regeln, und die eine darf die andere nie überschreiben: der
 * Kostenvoranschlag hängt seinen Zähler an, die Rechnung zieht jedes Mal neu.
 * Eine Rechnung mit `-2` wäre keine Kleinigkeit, sondern eine Nummer, die es
 * in der Buchhaltung nicht geben darf.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  numberForVersion,
  numberSearchPattern,
  versionedNumber,
} from '#shared/document-number'

describe('versionedNumber', () => {
  it('lässt den ersten Stand ohne Zusatz', () => {
    // Ein `-1` stünde auf jedem Beleg, der nie geändert wurde.
    expect(versionedNumber('KV-2026-0042', 1)).toBe('KV-2026-0042')
  })

  it('hängt ab dem zweiten Stand den Zähler an', () => {
    expect(versionedNumber('KV-2026-0042', 2)).toBe('KV-2026-0042-2')
    expect(versionedNumber('KV-2026-0042', 11)).toBe('KV-2026-0042-11')
  })

  it('weist eine unmögliche Version zurück', () => {
    for (const version of [0, -1, 1.5, Number.NaN]) {
      expect(() => versionedNumber('KV-2026-0042', version)).toThrow(/Ungültige Version/)
    }
  })
})

describe('numberSearchPattern', () => {
  it('findet alle Stände eines Vorgangs über das Präfix', () => {
    // Wer die Nummer eintippt, meint den Vorgang, nicht nur den ersten Stand.
    expect(numberSearchPattern('KV-2026-0042')).toBe('KV-2026-0042%')
  })

  it('übergeht Leerzeichen am Rand', () => {
    expect(numberSearchPattern('  RE-2026-0007 ')).toBe('RE-2026-0007%')
  })

  it('entwertet die Platzhalter von LIKE', () => {
    // Ein `%` in einer eingetippten Nummer ist eine Ziffernfolge, kein
    // Platzhalter — sonst gäbe die Suche die halbe Tabelle zurück.
    expect(numberSearchPattern('KV-%')).toBe('KV-\\%%')
    expect(numberSearchPattern('KV-_')).toBe('KV-\\_%')
    expect(numberSearchPattern('KV-\\')).toBe('KV-\\\\%')
  })
})

describe('numberForVersion', () => {
  /** Ein Nummernkreis, der mitzählt, wie oft er gezogen wurde. */
  const counter = (prefix: string) => {
    let next = 7
    const drawNext = vi.fn(async () => `${prefix}-2026-${String(next++).padStart(4, '0')}`)
    return drawNext
  }

  it('zieht für den ersten Stand immer eine neue Nummer', async () => {
    for (const type of ['cost_estimate', 'invoice'] as const) {
      const drawNext = counter('X')
      expect(await numberForVersion({ type, version: 1, baseNumber: null, drawNext }))
        .toBe('X-2026-0007')
      expect(drawNext).toHaveBeenCalledOnce()
    }
  })

  it('der Kostenvoranschlag hängt an, statt neu zu ziehen', async () => {
    const drawNext = counter('KV')
    expect(await numberForVersion({
      type: 'cost_estimate',
      version: 2,
      baseNumber: 'KV-2026-0042',
      drawNext,
    })).toBe('KV-2026-0042-2')

    // Der entscheidende Teil: der Kreis wurde **nicht** angefasst. Sonst
    // entstünden Lücken in einer Folge, die keine haben soll.
    expect(drawNext).not.toHaveBeenCalled()
  })

  it('der Kostenvoranschlag zählt über mehrere Stände weiter', async () => {
    const drawNext = counter('KV')
    const numbers: string[] = []
    for (let version = 2; version <= 4; version++) {
      numbers.push(await numberForVersion({
        type: 'cost_estimate',
        version,
        baseNumber: 'KV-2026-0042',
        drawNext,
      }))
    }
    expect(numbers).toEqual(['KV-2026-0042-2', 'KV-2026-0042-3', 'KV-2026-0042-4'])
  })

  it('hängt immer an Stand 1 an, nie an den Vorgänger', async () => {
    // Der Aufrufer reicht die Nummer von **Stand 1** herein. Würde er die des
    // Vorgängers nehmen, entstünde `KV-2026-0042-2-3` — deshalb steht es im
    // Kopfkommentar, deshalb steht es hier.
    const drawNext = counter('KV')
    const numbers: string[] = []
    for (let version = 2; version <= 4; version++) {
      numbers.push(await numberForVersion({
        type: 'cost_estimate',
        version,
        baseNumber: 'KV-2026-0042',
        drawNext,
      }))
    }
    expect(numbers).toEqual(['KV-2026-0042-2', 'KV-2026-0042-3', 'KV-2026-0042-4'])
    expect(numbers.every(number => number.startsWith('KV-2026-0042-'))).toBe(true)
  })

  it('die Rechnung zieht auch ab dem zweiten Stand neu', async () => {
    // Eine korrigierte Rechnung ist ein eigener Beleg mit einer eigenen
    // Nummer. Ein Zusatz `-2` wäre hier ein Fehler mit Behördenkontakt.
    const drawNext = counter('RE')
    expect(await numberForVersion({
      type: 'invoice',
      version: 2,
      baseNumber: 'RE-2026-0042',
      drawNext,
    })).toBe('RE-2026-0007')
    expect(drawNext).toHaveBeenCalledOnce()
  })

  it('die Rechnung bekommt nie einen Zusatz', async () => {
    const drawNext = counter('RE')
    const numbers: string[] = []
    for (let version = 1; version <= 5; version++) {
      numbers.push(await numberForVersion({
        type: 'invoice',
        version,
        baseNumber: 'RE-2026-0042',
        drawNext,
      }))
    }

    // Fünf verschiedene Nummern aus dem Kreis, keine davon abgeleitet.
    expect(numbers).toEqual([
      'RE-2026-0007', 'RE-2026-0008', 'RE-2026-0009', 'RE-2026-0010', 'RE-2026-0011',
    ])
    expect(new Set(numbers).size).toBe(5)
  })

  it('ein Kostenvoranschlag ab Stand 2 ohne die Nummer von Stand 1 ist ein Programmfehler', async () => {
    await expect(numberForVersion({
      type: 'cost_estimate',
      version: 2,
      baseNumber: null,
      drawNext: counter('KV'),
    })).rejects.toThrow(/Nummer von Stand 1/)
  })
})
