/**
 * Auswahl: Kunden.
 *
 * Wächter zuerst, dann Valibot, dann der Dienst — wie jeder Endpoint. Gesucht
 * und geblättert wird auf dem Server; der Browser bekommt nie mehr als eine
 * Seite.
 */
import { requirePermission } from '../../utils/guards.ts'
import { useValidatedQuery } from '../../utils/validate.ts'
import { pickCustomers } from '../../services/picker-service.ts'
import { pickerQuerySchema } from '#shared/schemas/picker'

export default defineEventHandler(async (event) => {
  requirePermission(event, 'customers')
  const query = await useValidatedQuery(event, pickerQuerySchema)
  return pickCustomers(query)
})
