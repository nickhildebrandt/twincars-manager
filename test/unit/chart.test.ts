/**
 * Die Rechnung hinter einem Diagramm (M-35).
 *
 * Getrennt von der Darstellung geprüft: eine Achse, die einen Wert
 * abschneidet, oder eine Beschriftung, die keinen Punkt benennt, fällt hier
 * auf und nicht erst im Browser.
 */
import { describe, expect, it } from 'vitest'
import { niceStep, pathPoints, positionOf, runningTotal, scaleFor, sumOf } from '#shared/chart'

const points = (...values: number[]) =>
  values.map((value, index) => ({ at: `2026-${String(index + 1).padStart(2, '0')}-01`, value }))

describe('niceStep', () => {
  it.each([
    [0.3, 0.5],
    [1, 1],
    [1.5, 2],
    [3, 5],
    [7, 10],
    [23, 50],
    [1200, 2000],
  ])('rundet %s auf %s', (raw, expected) => {
    expect(niceStep(raw)).toBe(expected)
  })

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])('verträgt %s', (raw) => {
    expect(niceStep(raw)).toBe(1)
  })
})

describe('scaleFor', () => {
  it('beginnt bei null, wenn alles positiv ist', () => {
    // Eine abgeschnittene Achse lässt einen Anstieg von zwei Prozent aussehen
    // wie eine Verdopplung.
    expect(scaleFor([100, 102, 104]).min).toBe(0)
  })

  it('umschließt jeden Wert', () => {
    const values = [12, 480, 97]
    const scale = scaleFor(values)
    for (const value of values) {
      expect(value, String(value)).toBeGreaterThanOrEqual(scale.min)
      expect(value, String(value)).toBeLessThanOrEqual(scale.max)
    }
  })

  it('nimmt negative Werte mit und behält die Nulllinie', () => {
    const scale = scaleFor([-300, 500])
    expect(scale.min).toBeLessThanOrEqual(-300)
    expect(scale.max).toBeGreaterThanOrEqual(500)
    expect(scale.ticks).toContain(0)
  })

  it('gibt jeder Beschriftung einen Platz innerhalb der Achse', () => {
    const scale = scaleFor([5, 900, 340])
    for (const tick of scale.ticks) {
      expect(tick).toBeGreaterThanOrEqual(scale.min)
      expect(tick).toBeLessThanOrEqual(scale.max)
    }
  })

  it('verträgt eine leere Reihe', () => {
    expect(scaleFor([])).toEqual({ min: 0, max: 1, ticks: [0, 1] })
  })

  it('verträgt lauter Nullen', () => {
    expect(scaleFor([0, 0, 0]).ticks.length).toBeGreaterThan(1)
  })
})

describe('positionOf', () => {
  it('legt den kleinsten Wert nach unten und den größten nach oben', () => {
    const scale = scaleFor([0, 100])
    expect(positionOf(scale.min, scale)).toBe(0)
    expect(positionOf(scale.max, scale)).toBe(1)
  })

  it('legt einen Wert außerhalb der Achse an den Rand, nicht darüber hinaus', () => {
    const scale = { min: 0, max: 100, ticks: [0, 100] }
    expect(positionOf(-50, scale)).toBe(0)
    expect(positionOf(500, scale)).toBe(1)
  })

  it('setzt einen Wert in die Mitte, wenn die Achse keine Spannweite hat', () => {
    // Kommt vor, wenn eine Reihe nur aus demselben Wert besteht. Oben oder
    // unten wäre beides gelogen.
    expect(positionOf(3, { min: 3, max: 3, ticks: [3] })).toBe(0.5)
  })
})

describe('pathPoints', () => {
  const box = { width: 600, height: 200, padding: 20 }

  it('bleibt innerhalb der Zeichenfläche', () => {
    const series = points(10, 900, 400, 0)
    for (const coordinate of pathPoints(series, scaleFor(series.map(p => p.value)), box)) {
      expect(coordinate.x).toBeGreaterThanOrEqual(box.padding)
      expect(coordinate.x).toBeLessThanOrEqual(box.width - box.padding)
      expect(coordinate.y).toBeGreaterThanOrEqual(box.padding)
      expect(coordinate.y).toBeLessThanOrEqual(box.height - box.padding)
    }
  })

  it('verteilt die Punkte gleichmäßig', () => {
    const series = points(1, 2, 3)
    const [first, second, third] = pathPoints(series, scaleFor([1, 2, 3]), box)
    expect(second!.x - first!.x).toBeCloseTo(third!.x - second!.x)
  })

  it('stellt einen einzelnen Punkt in die Mitte', () => {
    const [only] = pathPoints(points(42), scaleFor([42]), box)
    expect(only!.x).toBe(box.width / 2)
  })

  it('gibt für nichts nichts zurück', () => {
    expect(pathPoints([], scaleFor([]), box)).toEqual([])
  })
})

describe('sumOf', () => {
  it('summiert exakt', () => {
    expect(sumOf(points(10, 20, 30))).toBe(60)
  })

  it('summiert die leere Reihe zu null', () => {
    expect(sumOf([])).toBe(0)
  })
})

describe('runningTotal', () => {
  it('P-09: der Bestand wird gerechnet, nicht gespeichert', () => {
    // Ein gespeicherter Saldo läuft auseinander, sobald jemand eine alte
    // Buchung korrigiert. Deshalb entsteht er hier bei jeder Anzeige neu.
    expect(runningTotal(points(100, -30, 50)).map(p => p.value)).toEqual([100, 70, 120])
  })

  it('beginnt beim Übertrag des Vormonats', () => {
    expect(runningTotal(points(50), 1000).map(p => p.value)).toEqual([1050])
  })

  it('behält die Zeitpunkte', () => {
    const series = points(1, 2)
    expect(runningTotal(series).map(p => p.at)).toEqual(series.map(p => p.at))
  })
})
