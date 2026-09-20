/**
 * Wie ein Datensatz für die Aufbewahrung abgeschrieben wird (M-42, M-45).
 *
 * Zwei Stellen brauchen dasselbe: der Schnappschuss eines Belegs
 * (`snapshot-service.ts`) und der Stand eines versionierten Datensatzes
 * (`record-version-service.ts`). Beide schreiben den vollständigen Zustand als
 * `jsonb` weg, und beide müssen dieselben Felder auslassen.
 *
 * **Getrennt gehalten wäre es eine Lücke.** Vergisst eine der beiden Stellen
 * ein Geheimnis, steht das Passwort in der Datenbank — und zwar an der Stelle,
 * an der niemand danach sucht. Also steht die Regel einmal hier.
 */
import { isLoggableField } from './audit.ts'

/**
 * Felder, die in keiner Abschrift stehen.
 *
 * Zwei Gruppen: was ohnehin in jeder Zeile steht (Kennung, Zeitstempel) — es
 * sagt nichts über den Zustand und machte jeden Vergleich zu einem Treffer —
 * und die Rohdaten von Dateien, die den Eintrag sonst um Megabytes aufblähen.
 */
export const UNSTORED_FIELDS = [
  'id',
  'createdAt',
  'updatedAt',
  'logoData',
  'logoMime',
  'dataUrl',
] as const

/** Ob ein Feld in eine Abschrift gehört. */
export const isStoredField = (field: string): boolean =>
  !UNSTORED_FIELDS.includes(field as typeof UNSTORED_FIELDS[number]) && isLoggableField(field)

/**
 * Macht aus einem Datensatz die Abschrift, die aufbewahrt wird.
 *
 * Ein `Date` wird zur Zeichenkette: sonst steht in `jsonb` je nach Treiber
 * etwas anderes, und der Vergleich meldet einen Unterschied, wo keiner ist.
 */
export function stateOf(record: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(record)) {
    if (!isStoredField(field)) continue
    if (value === undefined) continue
    copy[field] = value instanceof Date ? value.toISOString() : value
  }
  return copy
}
