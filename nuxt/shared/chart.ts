/**
 * Die Rechnung hinter einem Diagramm.
 *
 * Getrennt von der Darstellung, damit sie prüfbar ist: eine Achse, die einen
 * Wert abschneidet, oder eine Beschriftung, die keinen Punkt benennt, fällt
 * hier auf und nicht im Browser.
 *
 * **Kennzahlen werden immer gerechnet, nie zwischengespeichert** (M-35, P-09).
 * Sonst zeigt das Diagramm etwas anderes als die Liste darunter — und dann
 * glaubt niemand mehr einem von beidem.
 */

export type Point = {
  /** Die Stelle auf der Zeitachse, als `YYYY-MM-DD` oder `YYYY-MM`. */
  at: string
  value: number
}

export type Scale = {
  min: number
  max: number
  /** Werte, an denen eine Linie und eine Beschriftung stehen. */
  ticks: number[]
}

/**
 * Die Achse zu einer Reihe von Werten.
 *
 * Sie beginnt bei null, wenn alle Werte positiv sind — eine abgeschnittene
 * Achse lässt einen Anstieg von zwei Prozent aussehen wie eine Verdopplung.
 * Enthält die Reihe negative Werte, wird symmetrisch um null gerundet, damit
 * die Nulllinie sichtbar bleibt.
 */
export function scaleFor(values: number[], desiredTicks = 5): Scale {
  if (values.length === 0) return { min: 0, max: 1, ticks: [0, 1] }

  const lowest = Math.min(...values, 0)
  const highest = Math.max(...values, 0)

  if (lowest === 0 && highest === 0) return { min: 0, max: 1, ticks: [0, 1] }

  const step = niceStep((highest - lowest) / Math.max(1, desiredTicks - 1))
  const min = Math.floor(lowest / step) * step
  const max = Math.ceil(highest / step) * step

  const ticks: number[] = []
  for (let value = min; value <= max + step / 2; value += step) {
    // Rundung gegen die Fließkomma-Drift beim Aufaddieren.
    ticks.push(Math.round(value / step) * step)
  }
  return { min, max, ticks }
}

/**
 * Ein runder Schritt in der Nähe von `raw`: 1, 2, 5 oder 10 mal einer
 * Zehnerpotenz. Krumme Achsenbeschriftungen liest niemand.
 */
export function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalised = raw / magnitude
  const rounded = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10
  return rounded * magnitude
}

/** Wo ein Wert zwischen 0 (unten) und 1 (oben) liegt. */
export function positionOf(value: number, scale: Scale): number {
  const span = scale.max - scale.min
  if (span === 0) return 0.5
  return Math.min(1, Math.max(0, (value - scale.min) / span))
}

/**
 * Die Punkte einer Reihe als Koordinaten in einem Feld der Größe `width` ×
 * `height`, mit Rand.
 */
export function pathPoints(
  points: Point[],
  scale: Scale,
  box: { width: number, height: number, padding: number },
): { x: number, y: number, point: Point }[] {
  if (points.length === 0) return []

  const inner = {
    width: box.width - box.padding * 2,
    height: box.height - box.padding * 2,
  }
  const step = points.length === 1 ? 0 : inner.width / (points.length - 1)

  return points.map((point, index) => ({
    point,
    x: box.padding + (points.length === 1 ? inner.width / 2 : index * step),
    y: box.padding + inner.height * (1 - positionOf(point.value, scale)),
  }))
}

/** Die Summe einer Reihe. Ganze Zahlen bleiben ganz. */
export const sumOf = (points: Point[]): number =>
  points.reduce((total, point) => total + point.value, 0)

/**
 * Der laufende Bestand: jeder Punkt ist die Summe aller vorigen.
 *
 * Genau so wird der Kassenbestand gezeigt — **gerechnet**, nie gespeichert.
 * Ein gespeicherter Saldo läuft auseinander, sobald jemand eine alte Buchung
 * korrigiert (M-23).
 */
export function runningTotal(points: Point[], opening = 0): Point[] {
  let total = opening
  return points.map((point) => {
    total += point.value
    return { at: point.at, value: total }
  })
}
