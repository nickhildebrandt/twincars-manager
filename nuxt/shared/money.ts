/**
 * Money, in whole cents (decision E-10).
 *
 * Every amount in this application — column, payload, schema, calculation — is
 * an integer number of cents. Euro exists only at the two edges: `parseEuro`
 * reads what a person typed, `formatEuro` writes what a person reads. Nothing
 * in between ever sees a fractional euro, so the classic float drift that put
 * a cent of error into an invoice total cannot occur
 * (../docs/rewrite/03-architektur.md §7.1).
 */

/** Rounds half away from zero — the German commercial rule, sign-aware. */
function roundCommercial(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

/** `1234.56` euro → `123456` cents. Rejects nothing; bound it with a schema. */
export function euroToCents(euro: number): number {
  return roundCommercial(euro * 100)
}

/** `123456` cents → `1234.56` euro. For display and export only. */
export function centsToEuro(cents: number): number {
  return cents / 100
}

const EURO = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const PLAIN = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** `123456` → `"1.234,56 €"`. The one way an amount reaches the screen. */
export function formatEuro(cents: number): string {
  return EURO.format(centsToEuro(cents))
}

/** `123456` → `"1.234,56"`, without the sign — for table columns and inputs. */
export function formatAmount(cents: number): string {
  return PLAIN.format(centsToEuro(cents))
}

/**
 * Reads a typed amount into cents, or `null` if it is not one.
 *
 * Accepts what people actually type: `1.234,56`, `1234,56`, `1234.56`,
 * `1 234,56`, a leading or trailing `€`, and a leading minus. More than two
 * decimals are rejected rather than silently rounded — the person meant
 * something else, and guessing is worse than asking.
 */
export function parseEuro(input: string): number | null {
  const cleaned = input
    .replace(/[€\s\u00a0\u202f]/g, '')
    .replace(/^\+/, '')
  if (cleaned === '') return null

  const match = /^(-?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(cleaned)
    ?? /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) return null

  // Gruppe 1 und 2 liefert jeder Treffer, Gruppe 3 nur mit Nachkommastellen.
  const sign = match[1]!
  const digits = match[2]!.replace(/\./g, '')
  const fraction = (match[3] ?? '').padEnd(2, '0')
  const cents = Number(digits) * 100 + Number(fraction)
  if (!Number.isSafeInteger(cents)) return null
  return sign === '-' ? -cents : cents
}

/** Sum of cent amounts. Exact, because they are integers. */
export function sumCents(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

/** `percent` of `cents`, rounded commercially. `applyPercent(10000, 19)` → `1900`. */
export function applyPercent(cents: number, percent: number): number {
  return roundCommercial((cents * percent) / 100)
}

/** Net plus VAT. `addVat(10000, 19)` → `11900`. */
export function addVat(netCents: number, ratePercent: number): number {
  return netCents + applyPercent(netCents, ratePercent)
}

/**
 * Splits a gross amount into net and tax.
 *
 * The net is rounded, the tax is the remainder — so net plus tax is always
 * exactly the gross the customer pays. Rounding both separately would let the
 * two disagree with the sum by a cent.
 */
export function splitVat(grossCents: number, ratePercent: number): { net: number, tax: number } {
  const net = roundCommercial((grossCents * 100) / (100 + ratePercent))
  return { net, tax: grossCents - net }
}

/**
 * A line total: quantity times unit price, less a percentage discount.
 *
 * `quantity` may be fractional (2.5 hours, 1.75 litres); the result is not.
 */
export function lineTotal(unitPriceCents: number, quantity: number, discountPercent = 0): number {
  const gross = roundCommercial(unitPriceCents * quantity)
  return gross - applyPercent(gross, discountPercent)
}
