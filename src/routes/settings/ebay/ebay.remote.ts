import { command, query } from '$app/server'
import { requirePermission } from '$lib/server/auth-guards'
import {
  buildAuthorizeUrl,
  disconnectEbay,
  getConnectionStatus
} from '$lib/server/services/ebay-auth-service'

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
