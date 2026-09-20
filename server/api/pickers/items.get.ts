/**
 * Auswahl: Artikel und Leistungen.
 *
 * Wächter zuerst, dann Valibot, dann der Dienst — wie jeder Endpoint. Gesucht
 * und geblättert wird auf dem Server; der Browser bekommt nie mehr als eine
 * Seite.
 */
import { requireAnyPermission } from '../../utils/guards.ts'
import { useValidatedQuery } from '../../utils/validate.ts'
import { pickItems } from '../../services/picker-service.ts'
import { pickerQuerySchema } from '#shared/schemas/picker'

export default defineEventHandler(async (event) => {
  requireAnyPermission(event, 'items', 'orders')
  const query = await useValidatedQuery(event, pickerQuerySchema)
  return pickItems(query)
})
