import { query } from '$app/server'
import {
  customerPickers,
  vehiclePickers
} from '$lib/server/services/picker-service'
import { requireAnyPermission } from '$lib/server/auth-guards'

/**
 * Pickers used by the invoice/offer creation form.
 *
 * @group integration
 * @module invoices
 */
export const getInvoicePickers = query(async () => {
  requireAnyPermission('invoices', 'offers')
  const [customers, vehicles] = await Promise.all([
    customerPickers(),
    vehiclePickers()
  ])
  return { customers, vehicles }
})
