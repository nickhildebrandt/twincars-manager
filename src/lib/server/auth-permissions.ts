import { eq, inArray } from 'drizzle-orm'
import { db } from './db/client'
import { rolePermissions, userRoles } from './db/schema'

export {
  WILDCARD_PERMISSION,
  MODULE_PERMISSIONS,
  ALL_PERMISSIONS,
  hasPermission,
  type ModuleKey
} from '$lib/permissions'

/**
 * Load the set of permission strings granted to a user via their
 * assigned roles. Returns an empty set for unknown users.
 */
export async function loadUserPermissions(
  userId: string
): Promise<Set<string>> {
  const roleIds = (
    await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
  ).map((r) => r.roleId)

  if (roleIds.length === 0) return new Set()

  const perms = await db
    .select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(inArray(rolePermissions.roleId, roleIds))

  return new Set(perms.map((p) => p.permission))
}
