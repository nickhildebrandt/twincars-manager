/**
 * IBAN / BIC plausibility helpers, shared between server-side Valibot
 * schemas (`$lib/server/db/validation.ts`) and client-side form checks
 * (e.g. the setup wizard's bank step), so the user gets the same verdict
 * on both sides.
 */

/** BIC (ISO 9362): 4-letter bank code, 2-letter country, 2 alphanumeric
 * location chars, optional 3 alphanumeric branch chars. */
const BIC_PATTERN = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/

/** IBAN surface shape: 2-letter country, 2 check digits, 11-30 BBAN
 * chars (total length 15-34, country-specific lengths are not tracked). */
const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/

/**
 * Normalizes user input for IBAN/BIC comparison and storage: strips all
 * whitespace (users commonly paste IBANs in grouped-by-four notation)
 * and upper-cases the rest.
 *
 * @param value - Raw user input.
 * @returns Compact upper-case representation.
 */
export const normalizeBankCode = (value: string): string =>
  value.replace(/\s+/g, '').toUpperCase()

/**
 * Validates an IBAN: surface pattern plus the ISO 13616 mod-97 checksum
 * (rearranged number modulo 97 must equal 1). Expects an already
 * normalized value (see {@link normalizeBankCode}).
 *
 * @param iban - Compact upper-case IBAN candidate.
 * @returns True when pattern and checksum are both valid.
 */
export const isValidIban = (iban: string): boolean => {
  if (!IBAN_PATTERN.test(iban)) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  // Iterative mod-97 so arbitrarily long IBANs never overflow Number.
  let remainder = 0
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0)
    // 'A'..'Z' map to 10..35 (two digits), '0'..'9' stay single digits.
    const digits = code >= 65 ? String(code - 55) : ch
    for (const d of digits) {
      remainder = (remainder * 10 + (d.charCodeAt(0) - 48)) % 97
    }
  }
  return remainder === 1
}

/**
 * Validates a BIC against the ISO 9362 shape (8 or 11 characters).
 * Expects an already normalized value (see {@link normalizeBankCode}).
 *
 * @param bic - Compact upper-case BIC candidate.
 * @returns True when the shape is valid.
 */
export const isValidBic = (bic: string): boolean => BIC_PATTERN.test(bic)
