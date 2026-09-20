/**
 * Number-range templates.
 *
 * Rendering is pure and shared: the settings page previews a template while it
 * is being typed, and the server renders the same template when it hands out a
 * number. Handing out the sequence value itself is a server matter and lives
 * in `server/utils/numbering.ts`.
 *
 * Placeholders:
 *
 *   {YYYY}  four-digit year      {YY}  two-digit year
 *   {MM}    two-digit month      {N…}  sequence, padded to the number of N
 */
import { businessMonth, businessYear } from './datetime'

/** `RE-{YYYY}-{NNNN}` with sequence 7 → `RE-2026-0007`. */
export function renderNumber(template: string, sequence: number, at: Date = new Date()): string {
  const year = String(businessYear(at))
  return template
    .replace(/\{YYYY\}/g, year)
    .replace(/\{YY\}/g, year.slice(-2))
    .replace(/\{MM\}/g, String(businessMonth(at)).padStart(2, '0'))
    .replace(/\{N+\}/g, match => String(sequence).padStart(match.length - 2, '0'))
}

/** The placeholders a template may use, for the settings help text. */
export const NUMBER_PLACEHOLDERS = ['{YYYY}', '{YY}', '{MM}', '{NNNN}'] as const

/**
 * A template is usable when it produces a different number for a different
 * sequence value. Without an `{N…}` placeholder every document would get the
 * same number — the predecessor accepted such a template silently.
 */
export function templateHasSequence(template: string): boolean {
  return /\{N+\}/.test(template)
}
