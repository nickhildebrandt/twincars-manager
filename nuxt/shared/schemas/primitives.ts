/**
 * Reusable building blocks for every schema in the application.
 *
 * Rules (../../../docs/rewrite/03-architektur.md §6):
 *   - A field has exactly ONE schema. Module schemas compose these, they do
 *     not re-declare limits.
 *   - Limits match the database column, so a value that passes validation can
 *     always be stored. A drift test keeps both in step.
 *   - Types are derived with `v.InferOutput`, never written a second time.
 */
import * as v from 'valibot'
import { MESSAGES } from './messages'

/** Trimmed text with an upper bound. The workhorse of this module. */
export const text = (max: number, message = MESSAGES.tooLong(max)) =>
  v.pipe(v.string(), v.trim(), v.maxLength(max, message))

/** Trimmed text that must not be empty. */
export const requiredText = (max: number, label = 'Pflichtfeld.') =>
  v.pipe(
    v.string(label),
    v.trim(),
    v.minLength(1, label),
    v.maxLength(max, MESSAGES.tooLong(max)),
  )

/** Optional text: an empty input becomes `undefined`, never an empty string. */
export const optionalText = (max: number) =>
  v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.transform(value => (value === '' ? undefined : value)),
      v.optional(v.pipe(v.string(), v.maxLength(max, MESSAGES.tooLong(max)))),
    ),
  )

/* ── identity ─────────────────────────────────────────────────────────── */

/**
 * Database key. The predecessor accepted any string here, so a mistyped URL
 * reached PostgreSQL and produced an unhandled 500 instead of a clean 404.
 */
export const idSchema = v.pipe(v.string(MESSAGES.invalidId), v.uuid(MESSAGES.invalidId))

/* ── people and addresses ─────────────────────────────────────────────── */

export const nameSchema = text(100)
export const requiredNameSchema = requiredText(100, 'Bitte einen Namen eingeben.')
export const companySchema = text(150)
export const streetSchema = text(150)
export const citySchema = text(100)

export const zipSchema = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^\d{4,5}$/, 'Bitte eine gültige Postleitzahl eingeben.'),
)

export const emailSchema = v.pipe(
  v.string(MESSAGES.invalidEmail),
  v.trim(),
  v.email(MESSAGES.invalidEmail),
  v.maxLength(254, MESSAGES.tooLong(254)),
)

// 30 characters, matching the column. The drift test enforces the match:
// a schema that allows more than the column holds turns a typo into an
// unhandled database error (B-556).
export const phoneSchema = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(30, MESSAGES.tooLong(30)),
  v.regex(
    /^[\d\s+()/-]*$/,
    'Bitte nur Ziffern, Leerzeichen und die Zeichen + ( ) / - verwenden.',
  ),
)

export const websiteSchema = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(200, MESSAGES.tooLong(200)),
  v.regex(/^(https?:\/\/)?[^\s]+\.[^\s]+$/, 'Bitte eine gültige Internetadresse eingeben.'),
)

/* ── banking ──────────────────────────────────────────────────────────── */

/**
 * IBAN including the check-digit calculation from ISO 13616, so a typo is
 * caught before the payment reminder goes out with a wrong account.
 */
export const ibanSchema = v.pipe(
  v.string(),
  v.trim(),
  v.transform(value => value.replace(/\s+/g, '').toUpperCase()),
  v.regex(/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/, 'Bitte eine gültige IBAN eingeben.'),
  v.check(isValidIban, 'Die Prüfziffer der IBAN stimmt nicht.'),
)

/** ISO 13616 modulo-97 check. */
export function isValidIban(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  const digits = [...rearranged]
    .map(char => (/[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char))
    .join('')
  let remainder = 0
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97
  return remainder === 1
}

export const bicSchema = v.pipe(
  v.string(),
  v.trim(),
  v.transform(value => value.toUpperCase()),
  v.regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, 'Bitte einen gültigen BIC eingeben.'),
)

/* ── money and numbers ────────────────────────────────────────────────── */

/**
 * The largest amount an `integer` column holds: 21.474.836,47 €.
 *
 * The schema stops exactly where the column does, so no accepted input can
 * ever overflow it — the class of defect B-556 described.
 */
export const MAX_MONEY_CENTS = 2_147_483_647

/**
 * Money is a **whole number of cents** (decision E-10).
 *
 * Never a float, never a string: 0.1 + 0.2 is not 0.3, and a rounding error in
 * an invoice total is a real one. Euro values exist only at the surface, where
 * `parseEuro` and `formatEuro` in `#shared/money` convert them.
 */
export const moneySchema = v.pipe(
  v.number(MESSAGES.notANumber),
  v.integer('Beträge werden in ganzen Cent geführt.'),
  v.minValue(-MAX_MONEY_CENTS, 'Der Betrag ist unrealistisch klein.'),
  v.maxValue(MAX_MONEY_CENTS, 'Der Betrag ist unrealistisch groß.'),
)

/** Money that cannot be negative — prices, totals. Also in cents. */
export const positiveMoneySchema = v.pipe(
  v.number(MESSAGES.notANumber),
  v.integer('Beträge werden in ganzen Cent geführt.'),
  v.minValue(0, MESSAGES.negative),
  v.maxValue(MAX_MONEY_CENTS, 'Der Betrag ist unrealistisch groß.'),
)

export const percentSchema = v.pipe(
  v.number(MESSAGES.notANumber),
  v.minValue(0, MESSAGES.negative),
  v.maxValue(100, 'Höchstens 100 Prozent.'),
)

export const quantitySchema = v.pipe(
  v.number(MESSAGES.notANumber),
  v.minValue(0, MESSAGES.negative),
  v.maxValue(999_999, 'Die Menge ist unrealistisch groß.'),
)

/** Whole number for counters and indexes. */
export const countSchema = v.pipe(
  v.number(MESSAGES.notANumber),
  v.integer('Bitte eine ganze Zahl eingeben.'),
  v.minValue(0, MESSAGES.negative),
  v.maxValue(9_999_999, 'Der Wert ist unrealistisch groß.'),
)

/* ── dates and times ──────────────────────────────────────────────────── */

/** Calendar day as `YYYY-MM-DD`, checked for real existence. */
export const dateSchema = v.pipe(
  v.string(MESSAGES.invalidDate),
  v.trim(),
  v.isoDate(MESSAGES.invalidDate),
  v.check(isRealDate, 'Dieses Datum gibt es nicht.'),
)

/** Rejects 2026-02-30 and friends, which `isoDate` alone accepts. */
export function isRealDate(value: string): boolean {
  const parts = value.split('-').map(Number)
  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) return false
  const [year, month, day] = parts as [number, number, number]
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

/** Time of day as `HH:MM`. */
export const timeSchema = v.pipe(
  v.string(MESSAGES.invalidTime),
  v.trim(),
  v.regex(/^([01]\d|2[0-3]):[0-5]\d$/, MESSAGES.invalidTime),
)

/* ── vehicles ─────────────────────────────────────────────────────────── */

/**
 * German licence plate. Kept deliberately permissive in length because the
 * legacy import carries historic and foreign plates; the shape is checked,
 * the exact district list is not.
 */
export const licensePlateSchema = v.pipe(
  v.string(),
  v.trim(),
  v.transform(value => value.toUpperCase()),
  v.minLength(2, 'Bitte ein Kennzeichen eingeben.'),
  v.maxLength(20, MESSAGES.tooLong(20)),
)

/**
 * Vehicle identification number. 17 characters since 1981, but the legacy
 * data holds shorter historic numbers, so the length is a range and the
 * forbidden letters I, O and Q are what actually gets checked.
 */
export const vinSchema = v.pipe(
  v.string(),
  v.trim(),
  v.transform(value => value.toUpperCase()),
  v.minLength(5, 'Die Fahrgestellnummer ist zu kurz.'),
  v.maxLength(25, MESSAGES.tooLong(25)),
  v.regex(/^[A-HJ-NPR-Z0-9]+$/, 'Die Fahrgestellnummer enthält ungültige Zeichen.'),
)

export const hsnSchema = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^\d{4}$/, 'Die HSN besteht aus vier Ziffern.'),
)

export const tsnSchema = v.pipe(
  v.string(),
  v.trim(),
  v.transform(value => value.toUpperCase()),
  v.regex(/^[A-Z0-9]{3,10}$/, 'Die TSN besteht aus drei bis zehn Zeichen.'),
)

/* ── free text ────────────────────────────────────────────────────────── */

export const notesSchema = text(5_000)
export const longTextSchema = text(50_000)
export const subjectSchema = requiredText(200, 'Bitte einen Betreff eingeben.')

/** Search term. Bounded so a huge string cannot be used to stall the database. */
export const searchSchema = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(200, 'Der Suchbegriff darf höchstens 200 Zeichen lang sein.'),
)

/* ── derived types ────────────────────────────────────────────────────── */

export type Id = v.InferOutput<typeof idSchema>
export type Email = v.InferOutput<typeof emailSchema>
export type Money = v.InferOutput<typeof moneySchema>
export type IsoDate = v.InferOutput<typeof dateSchema>
export type Time = v.InferOutput<typeof timeSchema>
