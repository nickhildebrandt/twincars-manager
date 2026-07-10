import { command, query, requested } from '$app/server'
import {
  number,
  object,
  optional,
  picklist,
  pipe,
  minValue,
  maxValue
} from 'valibot'
import { requirePermission } from '$lib/server/auth-guards'
import { searchQuerySchema } from '$lib/server/db/validation'
import {
  buildAuthorizeUrl,
  disconnectEbay,
  getConnectionStatus
} from '$lib/server/services/ebay-auth-service'
import {
  getEbayImportInfo,
  importEbayListings,
  listEbayListings
} from '$lib/server/services/ebay-listing-service'

/**
 * Connection status for the eBay settings page — configuration state
 * (which env vars are missing), environment, and the connected seller
 * account. Token material never crosses this boundary.
 *
 * @group integration
 * @module ebay
 */
export const getEbayStatusRemote = query(async () => {
  requirePermission('settings')
  return getConnectionStatus()
})

/**
 * Start the OAuth connect flow: returns the eBay consent URL (with a
 * fresh HMAC-signed `state`, 10-minute TTL) for the client to navigate
 * to. A command (not a query) so every click mints a fresh state.
 *
 * @group integration
 * @module ebay
 */
export const startEbayConnectRemote = command(async () => {
  requirePermission('settings')
  const { url } = buildAuthorizeUrl()
  return { url }
})

/**
 * Drop the stored eBay connection (tokens deleted). The seller can
 * additionally revoke the app's access in their eBay account settings.
 *
 * @group integration
 * @module ebay
 */
export const disconnectEbayRemote = command(async () => {
  requirePermission('settings')
  await disconnectEbay()
  await getEbayStatusRemote().refresh()
})

/* ── Phase 2: listing import ─────────────────────────────────────── */

const listListingsSchema = object({
  page: pipe(
    number('Bitte eine Seite angeben.'),
    minValue(1, 'Seite muss mindestens 1 sein.'),
    maxValue(100_000, 'Seite ist zu groß.')
  ),
  size: picklist([10, 25, 50, 100]),
  q: optional(searchQuerySchema),
  status: optional(picklist(['active', 'ended']))
})

/**
 * Paginated imported eBay listings (current environment only) with
 * title/SKU/item-id search and an active/ended filter.
 *
 * @group integration
 * @module ebay
 */
export const listEbayListingsRemote = query(
  listListingsSchema,
  async (params) => {
    requirePermission('settings')
    return listEbayListings(params)
  }
)

/**
 * Last import run + listing counts for the settings card.
 *
 * @group integration
 * @module ebay
 */
export const getEbayImportInfoRemote = query(async () => {
  requirePermission('settings')
  return getEbayImportInfo()
})

/**
 * Pull the account's active listings from the Trading API and upsert
 * them (idempotent — see `ebay-listing-service`). Failures surface as
 * curated German errors (not-connected, expired token, eBay down, …);
 * the run log is refreshed either way so the card shows failed runs
 * too.
 *
 * @group integration
 * @module ebay
 */
export const importEbayListingsRemote = command(async () => {
  requirePermission('settings')
  try {
    const result = await importEbayListings()
    await requested(listEbayListingsRemote, 4).refreshAll()
    return result
  } finally {
    await getEbayImportInfoRemote().refresh()
  }
})
