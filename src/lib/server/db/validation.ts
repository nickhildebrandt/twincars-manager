import {
  check,
  email,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
  transform,
  trim
} from 'valibot'
import { PAYMENT_METHODS } from '$lib/payment-methods'

/**
 * Reusable Valibot schemas. Use these in every Remote Function instead of
 * hand-crafted validation. All max-length limits are enforced server-side
 * to keep the app stable under untrusted input.
 */

export const idSchema = pipe(string(), minLength(1), maxLength(64), trim())

export const nameSchema = pipe(
  string('Bitte geben Sie einen Namen ein.'),
  trim(),
  minLength(1, 'Der Name darf nicht leer sein.'),
  maxLength(100, 'Der Name darf maximal 100 Zeichen lang sein.')
)

export const optionalNameSchema = pipe(
  string(),
  trim(),
  maxLength(100, 'Der Name darf maximal 100 Zeichen lang sein.')
)

export const addressLineSchema = pipe(
  string(),
  trim(),
  maxLength(200, 'Die Anschrift darf maximal 200 Zeichen lang sein.')
)

export const zipSchema = pipe(
  string(),
  trim(),
  maxLength(10, 'Die PLZ darf maximal 10 Zeichen lang sein.')
)

export const citySchema = pipe(
  string(),
  trim(),
  maxLength(150, 'Der Ort darf maximal 150 Zeichen lang sein.')
)

export const phoneSchema = pipe(
  string(),
  trim(),
  maxLength(30, 'Die Telefonnummer darf maximal 30 Zeichen lang sein.')
)

export const emailSchema = pipe(
  string(),
  trim(),
  maxLength(254, 'Die E-Mail darf maximal 254 Zeichen lang sein.'),
  email('Bitte geben Sie eine gültige E-Mail-Adresse ein.')
)

export const optionalEmailSchema = optional(
  pipe(
    string(),
    trim(),
    maxLength(254, 'Die E-Mail darf maximal 254 Zeichen lang sein.'),
    check(
      (v) => v.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
    )
  )
)

export const urlSchema = pipe(
  string(),
  trim(),
  maxLength(2048, 'Die URL darf maximal 2048 Zeichen lang sein.')
)

export const ibanSchema = pipe(
  string(),
  trim(),
  maxLength(34, 'Die IBAN darf maximal 34 Zeichen lang sein.')
)

export const bicSchema = pipe(
  string(),
  trim(),
  maxLength(11, 'Der BIC darf maximal 11 Zeichen lang sein.')
)

export const notesSchema = pipe(
  string(),
  trim(),
  maxLength(2000, 'Die Notiz darf maximal 2000 Zeichen lang sein.')
)

export const longTextSchema = pipe(
  string(),
  trim(),
  maxLength(10000, 'Der Text darf maximal 10.000 Zeichen lang sein.')
)

export const subjectSchema = pipe(
  string(),
  trim(),
  maxLength(200, 'Der Betreff darf maximal 200 Zeichen lang sein.')
)

export const numberRangeKindSchema = picklist([
  'invoice',
  'offer',
  'cost_estimate',
  'order_confirmation',
  'reminder',
  'customer'
])

export const documentTypeSchema = picklist([
  'offer',
  'cost_estimate',
  'order_confirmation',
  'invoice',
  'reminder',
  'customer_letter'
])

/**
 * Payment method (Zahlungsart). Optional — an empty selection means
 * "not specified". The allowed labels live in the shared, client-safe
 * `$lib/payment-methods` so forms and the server share one list.
 */
export const paymentMethodSchema = optional(
  picklist(PAYMENT_METHODS, 'Bitte eine gültige Zahlungsart wählen.')
)

export const dateStringSchema = pipe(
  string(),
  trim(),
  check(
    (v) =>
      /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime()),
    'Bitte geben Sie ein gültiges Datum ein (YYYY-MM-DD).'
  )
)

export const dateFromStringSchema = pipe(
  string(),
  transform((value) => new Date(value)),
  check(
    (d) => !Number.isNaN(d.getTime()),
    'Bitte geben Sie ein gültiges Datum ein.'
  )
)

export const moneySchema = pipe(
  number('Bitte geben Sie einen Betrag ein.'),
  minValue(-1_000_000_000, 'Der Betrag ist zu klein.'),
  maxValue(1_000_000_000, 'Der Betrag ist zu groß.')
)

export const percentSchema = pipe(
  number(),
  minValue(0, 'Der Prozentwert darf nicht negativ sein.'),
  maxValue(100, 'Der Prozentwert darf maximal 100 sein.')
)

export const positiveIntegerSchema = pipe(
  number(),
  minValue(0, 'Der Wert darf nicht negativ sein.'),
  maxValue(1_000_000_000, 'Der Wert ist zu groß.'),
  check((v) => Number.isInteger(v), 'Bitte geben Sie eine ganze Zahl ein.')
)

export const searchQuerySchema = pipe(
  string(),
  trim(),
  maxLength(200, 'Der Suchbegriff darf maximal 200 Zeichen lang sein.')
)

/**
 * List query parameters used by every paginated list view.
 */
export const listParamsSchema = object({
  page: pipe(
    number(),
    minValue(1, 'Seite muss mindestens 1 sein.'),
    maxValue(100_000)
  ),
  size: picklist([10, 25, 50, 100]),
  q: optional(searchQuerySchema),
  sort: optional(pipe(string(), maxLength(50)))
})

export type ListParams = {
  page: number
  size: number
  q?: string
  sort?: string
}

/**
 * Standard list result wrapper returned by all list queries.
 */
export type ListResult<T> = {
  items: T[]
  total: number
  page: number
  size: number
  pageCount: number
}
