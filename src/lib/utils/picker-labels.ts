/**
 * Shared label builders for the entity pickers.
 *
 * The server-side picker queries in `src/routes/pickers.remote.ts` and
 * the client-side quick-create forms must produce byte-identical labels,
 * otherwise an inline-created entity would render differently from the
 * same entity picked from the list. These pure helpers are the single
 * source of truth for the two formats.
 *
 * @group internal
 * @module picker-labels
 */

/** Minimal shape needed to derive a customer's display name. */
export type CustomerNameParts = {
  company?: string | null
  firstName?: string | null
  lastName?: string | null
  customerNumber?: string | null
}

/** Customer row shape used by {@link customerPickerLabel}. */
export type CustomerLabelParts = CustomerNameParts & { city?: string | null }

/** Vehicle row shape used by {@link vehiclePickerLabel}. */
export type VehicleLabelParts = {
  licensePlate?: string | null
  make?: string | null
  model?: string | null
}

/**
 * Display name of a customer: company, else "first last", else the
 * customer number, else `null`. Mirrors the holder derivation in
 * `pickCustomerVehiclesRemote`.
 */
export const customerDisplayName = (r: CustomerNameParts): string | null =>
  r.company ||
  `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() ||
  r.customerNumber ||
  null

/**
 * Picker label of a customer: display name plus ` · city` when a city
 * is set. Mirrors the mapping in `pickCustomersRemote`.
 */
export const customerPickerLabel = (r: CustomerLabelParts): string =>
  `${customerDisplayName(r) ?? ''}${r.city ? ' · ' + r.city : ''}`

/**
 * Picker label of a vehicle: `plate · make model`, with `-` standing in
 * for a missing plate or missing make/model. An optional `holder`
 * (customer display name) is appended as a third segment — mirrors
 * `pickVehiclesRemote` (no holder) and `pickCustomerVehiclesRemote`
 * (holder appended).
 */
export const vehiclePickerLabel = (
  r: VehicleLabelParts,
  holder?: string | null
): string =>
  `${r.licensePlate ?? '-'} · ${[r.make, r.model].filter(Boolean).join(' ') || '-'}${holder ? ' · ' + holder : ''}`
