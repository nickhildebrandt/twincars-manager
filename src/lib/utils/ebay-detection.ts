/**
 * eBay customer detection for the KFZ-Kaufmann import (requirement 5).
 *
 * Rule: a customer whose name — legacy `Name`, `Firma` (company),
 * `Vorname` (first name) or `Nachname` (last name) — contains the
 * substring "ebay" ANYWHERE, case-insensitively, is imported with
 * `customers.kind = 'ebay'`. This is a pure import-time classification;
 * NOTHING at runtime derives `kind` from names (creating or editing a
 * customer sets `kind` explicitly on the form).
 *
 * Deliberate edge cases of the exact substring rule:
 *
 * - "Bayer"  → NO match ("bayer" does not contain "ebay").
 * - "Ebayer" → match ("ebayer" contains "ebay" at index 0).
 * - "Sebayn" → match ("sebayn" contains "ebay" at index 1).
 *
 * False positives of the "Sebayn" kind are accepted: the operator can
 * flip the Kundenart on the customer form afterwards, whereas a missed
 * eBay buyer would silently pollute the regular customer base.
 */

/** True when a single value contains "ebay" (case-insensitive). */
const containsEbay = (value: string | null | undefined): boolean =>
  value != null && value.toLowerCase().includes('ebay')

/**
 * True when ANY of the given name fields contains "ebay"
 * case-insensitively. Fields are checked independently — substrings do
 * NOT combine across fields ("eb" in one field + "ay" in the next is
 * no match). `null` / `undefined` / empty fields never match.
 */
export const isEbayCustomerName = (
  fields: ReadonlyArray<string | null | undefined>
): boolean => fields.some(containsEbay)
