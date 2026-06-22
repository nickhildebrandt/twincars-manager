/**
 * Shared (client + server safe) list of payment methods (Zahlungsarten).
 *
 * The value stored in `documents.payment_method` / `ledger_entries.
 * payment_method` IS the German label — there is no separate code, so
 * forms render these strings directly and the server validates against
 * the same list via `paymentMethodSchema` (see `db/validation.ts`).
 *
 * Keep this the single source of truth: every `<select>` of payment
 * methods iterates `PAYMENT_METHODS`, and any new method is added here
 * once.
 */
export const PAYMENT_METHODS = [
  'Überweisung',
  'Bar',
  'Lastschrift',
  'Karte'
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
