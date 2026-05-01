import { query } from '$app/server'
import { getSettings } from '$lib/server/services/settings-service'

/**
 * Layout-wide context: setup completion flag and company name. Used by the
 * root `+layout.svelte` to drive the setup-redirect and the sidebar header.
 *
 * @remarks
 * Called once at the top of `+layout.svelte` and `await`-ed inline. During
 * SSR the value is rendered server-side; on the client the same query is
 * dehydrated, so JavaScript navigation uses the cached value without
 * re-fetching unless `getLayoutContext().refresh()` is called explicitly
 * (e.g. after `completeSetup`).
 *
 * @group integration
 * @module layout
 */
export const getLayoutContext = query(async () => {
  const s = await getSettings()
  return {
    setupCompleted: s.setupCompleted,
    companyName: s.companyName || 'TwinCarsManager'
  }
})
