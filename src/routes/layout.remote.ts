import { getRequestEvent, query } from '$app/server'
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

/**
 * Current authenticated user plus the flattened permission set granted via
 * their roles. The AppShell consumes this to filter the navigation —
 * modules whose permission isn't present are hidden.
 *
 * Returns `null` for anonymous requests so the layout can render the
 * shell without throwing on public routes (login / setup).
 *
 * @group integration
 * @module layout
 */
export const getCurrentUserRemote = query(async () => {
  const event = getRequestEvent()
  const user = event.locals.user
  if (!user) return null
  return {
    id: user.id,
    username: (user as { username?: string | null }).username ?? null,
    name: user.name,
    permissions: Array.from(event.locals.permissions)
  }
})
