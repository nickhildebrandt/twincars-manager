/**
 * Auswahl: Fahrzeuge.
 *
 * Drei Varianten über `scope`: alle, nur die eines Kunden, nur der Bestand.
 * Der Vorgänger hatte dafür drei Funktionen mit dreimal derselben
 * Kennzeichensuche (B-086).
 */
import * as v from 'valibot'
import { requirePermission } from '../../utils/guards.ts'
import { useValidatedQuery } from '../../utils/validate.ts'
import { pickVehicles } from '../../services/picker-service.ts'
import { scopedPickerQuerySchema } from '#shared/schemas/picker'

const querySchema = v.object({
  ...scopedPickerQuerySchema.entries,
  scope: v.optional(
    v.picklist(['alle', 'kunde', 'bestand'], 'Auswahl: bitte alle, kunde oder bestand angeben.'),
    'alle',
  ),
})

export default defineEventHandler(async (event) => {
  requirePermission(event, 'vehicles')
  const query = await useValidatedQuery(event, querySchema)
  return pickVehicles(query)
})
