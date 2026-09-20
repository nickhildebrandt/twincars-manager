/**
 * Die Anfrage an eine Auswahl.
 *
 * Beim Vorgänger hatten die drei Auswahl-Schemata **keine deutschen
 * Meldungen** (B-082), und `page` war eine bloße Zahl ohne Untergrenze — eine
 * manipulierte Anfrage mit `page=0` erzeugte einen negativen Versatz, die
 * Datenbank brach ab und der Nutzer bekam „Ein interner Fehler ist
 * aufgetreten." zu sehen (B-083).
 *
 * Hier gilt dieselbe Grenze wie für jede Liste: geprüft, deutsch, fest 25.
 */
import * as v from 'valibot'
import { listQuerySchema } from './pagination'
import { idSchema } from './primitives'

/** Was jede Auswahl entgegennimmt. */
export const pickerQuerySchema = v.object({
  page: listQuerySchema.entries.page,
  q: listQuerySchema.entries.q,
})

/** Auswahl, die sich auf einen anderen Datensatz bezieht — etwa Fahrzeuge eines Kunden. */
export const scopedPickerQuerySchema = v.object({
  ...pickerQuerySchema.entries,
  customerId: v.optional(idSchema),
  vehicleId: v.optional(idSchema),
})

export type PickerQuery = v.InferOutput<typeof pickerQuerySchema>
export type ScopedPickerQuery = v.InferOutput<typeof scopedPickerQuerySchema>
