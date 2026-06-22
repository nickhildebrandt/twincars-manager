import { getRequestEvent, query } from '$app/server'
import { object, pipe, string, trim, maxLength } from 'valibot'
import { globalSearch } from '$lib/server/services/search-service'
import { hasPermission } from '$lib/server/auth-permissions'
import { requireUser } from '$lib/server/auth-guards'

const searchSchema = object({
  q: pipe(
    string('Bitte einen Suchbegriff eingeben.'),
    trim(),
    maxLength(200, 'Suchbegriff zu lang.')
  )
})

/**
 * Global search remote. Returns one bucket per entity type the user
 * is permitted to access; buckets the caller lacks the `<module>`
 * permission for are dropped silently. Short / empty queries short-circuit to empty
 * buckets — the underlying service enforces the 2-character minimum.
 *
 * The query is intentionally broad (every authenticated user may
 * search across the modules they can see) so a service desk can
 * locate a record by any number / name / plate / VIN without
 * navigating to the specific module first.
 *
 * @group integration
 * @module search
 */
export const globalSearchRemote = query(searchSchema, async ({ q }) => {
  requireUser()
  const event = getRequestEvent()
  const perms = event.locals.permissions
  const result = await globalSearch(q)
  return {
    customers: hasPermission(perms, 'customers') ? result.customers : [],
    vehicles: hasPermission(perms, 'vehicles') ? result.vehicles : [],
    items: hasPermission(perms, 'items') ? result.items : [],
    documents:
      hasPermission(perms, 'invoices') || hasPermission(perms, 'offers')
        ? result.documents
        : []
  }
})
