/**
 * Die Umrechnung zwischen `YYYY-MM-DD` und dem Datumsobjekt, das Nuxt UI
 * erwartet.
 *
 * Nuxt UI hat keinen Datumswähler im klassischen Sinn; `UCalendar` und
 * `UInputDate` arbeiten mit `CalendarDate` aus `@internationalized/date`. Die
 * Anwendung speichert Tage dagegen als Zeichenkette, weil ein Termin am
 * 4. März überall der 4. März ist — unabhängig von Zeitzone und Uhrzeit.
 *
 * Genau an dieser Grenze entstehen Datumsfehler um einen Tag: wer ein
 * `Date`-Objekt dazwischenschaltet, bekommt bei Mitternacht UTC den Vortag.
 * Hier wird deshalb **nie** über `Date` gerechnet, sondern nur über die drei
 * Zahlen Jahr, Monat, Tag.
 */
import { CalendarDate } from '@internationalized/date'

/** Ein Kalendertag als Zeichenkette, so wie ihn eine `date`-Spalte hält. */
export type IsoDate = string

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Ob die Zeichenkette ein gültiger Kalendertag ist — auch fachlich. */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false
  const match = PATTERN.exec(value)
  if (!match) return false

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (month < 1 || month > 12 || day < 1) return false
  return day <= daysInMonth(year, month)
}

/** Wie viele Tage der Monat hat. Schaltjahre eingeschlossen. */
export function daysInMonth(year: number, month: number): number {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return lengths[month - 1] ?? 0
}

/** Die gregorianische Schaltjahresregel, vollständig. */
export const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

/**
 * `2026-03-04` → das Datumsobjekt für Nuxt UI.
 *
 * Gibt `null` zurück, wenn nichts Gültiges dasteht — ein leeres Feld ist kein
 * Fehler, und ein unsinniger Wert soll keine Ausnahme werfen, sondern ein
 * leeres Feld ergeben.
 */
export function toCalendarDate(value: string | null | undefined): CalendarDate | null {
  if (!isIsoDate(value)) return null
  const match = PATTERN.exec(value)!
  return new CalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
}

/** Das Datumsobjekt → `2026-03-04`. Ohne Zeitzone, ohne Uhrzeit, ohne `Date`. */
export function fromCalendarDate(date: CalendarDate | null | undefined): IsoDate | null {
  if (!date) return null
  const month = String(date.month).padStart(2, '0')
  const day = String(date.day).padStart(2, '0')
  return `${String(date.year).padStart(4, '0')}-${month}-${day}`
}

/**
 * Hin und zurück, ohne Verlust.
 *
 * Ein eigener Name, weil genau das die Zusage ist, die der Test prüft: was
 * hineingeht, kommt unverändert wieder heraus — an jedem Tag des Jahres, in
 * jeder Zeitzone.
 */
export const roundTrip = (value: string): IsoDate | null =>
  fromCalendarDate(toCalendarDate(value))
