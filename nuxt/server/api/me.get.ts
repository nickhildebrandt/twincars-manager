/**
 * Who is signed in, and what they may see.
 *
 * The interface reads this once while the page is rendered on the server, so
 * navigation and buttons are already correct in the first HTML — no flash of a
 * menu that then disappears.
 */
import { may, optionalUser } from '../utils/guards.ts'
import { loadUserRoles } from '../utils/auth-users.ts'
import { MODULE_PERMISSIONS } from '#shared/permissions'
import type { ModuleKey } from '#shared/permissions'

export default defineEventHandler(async (event) => {
  const auth = optionalUser(event)
  if (!auth) return { user: null, permissions: [], modules: {} as Record<ModuleKey, boolean> }

  const modules = Object.fromEntries(
    Object.keys(MODULE_PERMISSIONS).map(key => [key, may(auth, key as ModuleKey)]),
  ) as Record<ModuleKey, boolean>

  return {
    user: {
      id: auth.userId,
      username: auth.username,
      displayName: auth.displayName,
      roles: await loadUserRoles(auth.userId),
    },
    permissions: [...auth.permissions].sort(),
    modules,
  }
})
