import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  array,
  boolean,
  check,
  maxLength,
  minLength,
  number,
  object,
  optional,
  picklist,
  pipe,
  regex,
  string,
  trim
} from 'valibot'
import { auth } from '$lib/server/auth'
import {
  createUserWithCredential,
  deleteUserSessions
} from '$lib/server/auth-users'
import {
  ALL_PERMISSIONS,
  WILDCARD_PERMISSION,
  loadUserPermissions
} from '$lib/server/auth-permissions'
import { requirePermission } from '$lib/server/auth-guards'
import { idSchema, nameSchema } from '$lib/server/db/validation'
import {
  allRoleIdsExist,
  assignRolesToUser,
  createRoleWithPermissions,
  deleteRoleById,
  deleteUserById,
  getRoleById,
  getUserWithRoleIds,
  hasOtherWildcardHolder,
  listRolesWithPermissions,
  listUsersWithRoles,
  listWildcardHolderIds,
  replaceRolePermissions,
  replaceUserRoles,
  rolesGrantWildcard,
  setUserCredentialPassword,
  updateRoleFields,
  updateUserActive,
  updateUserName,
  userExists
} from '$lib/server/services/user-admin-service'

/**
 * Remote functions for user + role management. Mounted under the
 * settings UI; every entry requires the `users` module permission.
 * The Drizzle query work lives in `user-admin-service.ts` — this file
 * keeps validation, guards and the curated German error decisions.
 *
 * @group integration
 * @module users
 */

const ADMIN_ROLE_NAME = 'Administrator'

const usernameSchema = pipe(
  string(),
  trim(),
  minLength(3, 'Benutzername zu kurz (mind. 3 Zeichen).'),
  maxLength(64, 'Benutzername zu lang.'),
  regex(
    /^[a-zA-Z0-9_.]+$/,
    'Benutzername darf nur Buchstaben, Ziffern, Punkt und Unterstrich enthalten.'
  )
)

const passwordSchema = pipe(
  string(),
  minLength(8, 'Passwort zu kurz (mind. 8 Zeichen).'),
  maxLength(128, 'Passwort zu lang.')
)

const permissionSchema = pipe(
  string(),
  trim(),
  check(
    (v) => v === WILDCARD_PERMISSION || ALL_PERMISSIONS.includes(v),
    'Unbekannte Berechtigung.'
  )
)

const listUsersSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200)))
})

const createUserSchema = object({
  username: usernameSchema,
  name: nameSchema,
  password: passwordSchema,
  roleIds: array(idSchema)
})

const updateUserSchema = object({
  id: idSchema,
  name: optional(nameSchema),
  password: optional(passwordSchema),
  roleIds: optional(array(idSchema))
})

const createRoleSchema = object({
  name: nameSchema,
  description: optional(pipe(string(), trim(), maxLength(500))),
  permissions: array(permissionSchema)
})

const updateRoleSchema = object({
  id: idSchema,
  name: optional(nameSchema),
  description: optional(pipe(string(), trim(), maxLength(500))),
  permissions: optional(array(permissionSchema))
})

/**
 * Paginated list of all users with their assigned roles.
 *
 * @group integration
 * @module users
 */
export const listUsersRemote = query(
  listUsersSchema,
  async ({ page, size, q }) => {
    requirePermission('users')
    return listUsersWithRoles({ page, size, q })
  }
)

/**
 * Load a single user plus their assigned role ids.
 *
 * @group integration
 * @module users
 */
export const getUserRemote = query(object({ id: idSchema }), async ({ id }) => {
  requirePermission('users')
  const user = await getUserWithRoleIds(id)
  if (!user) error(404, 'Benutzer nicht gefunden.')
  return user
})

const refreshUserLists = async (): Promise<void> => {
  await requested(listUsersRemote, 4).refreshAll()
}

/**
 * Create a new user account. Synthesises a `<username>@twincars.local`
 * email — better-auth still treats email as the canonical identity but
 * the value never leaves the server.
 *
 * @group integration
 * @module users
 */
export const createUserRemote = command(
  createUserSchema,
  async ({ username, name, password, roleIds }) => {
    requirePermission('users')

    const { id: userId } = await createUserWithCredential({
      username,
      name,
      password
    })

    if (roleIds.length > 0) {
      // Validate all role ids exist before inserting.
      if (!(await allRoleIdsExist(roleIds))) {
        error(400, 'Mindestens eine Rolle wurde nicht gefunden.')
      }
      await assignRolesToUser(userId, roleIds)
    }

    await refreshUserLists()
    return { id: userId }
  }
)

/**
 * Update an existing user. Any subset of `name`, `password`, `roleIds`
 * may be supplied — only the provided fields are touched.
 *
 * Password reset for arbitrary users isn't a first-class better-auth
 * endpoint (the public `setPassword` requires the target's own
 * session), so we hash via the same internal helper and write the new
 * hash to the credential `accounts` row directly.
 *
 * @group integration
 * @module users
 */
export const updateUserRemote = command(
  updateUserSchema,
  async ({ id, name, password, roleIds }) => {
    requirePermission('users')

    if (!(await userExists(id))) error(404, 'Benutzer nicht gefunden.')

    if (name !== undefined) {
      await updateUserName(id, name)
    }

    if (password !== undefined) {
      // better-auth doesn't expose an admin-side "reset another user's
      // password" endpoint — `setPassword` operates on the calling
      // session, and `resetPassword` requires a token from the email
      // flow which we don't run. Hash via the same helper better-auth
      // uses internally (`auth.$context.password.hash`) and write
      // straight to the `credential` account row.
      const ctx = await auth.$context
      const passwordHash = await ctx.password.hash(password)
      await setUserCredentialPassword(id, passwordHash)
    }

    if (roleIds !== undefined) {
      if (roleIds.length > 0 && !(await allRoleIdsExist(roleIds))) {
        error(400, 'Mindestens eine Rolle wurde nicht gefunden.')
      }

      // Last-admin lockout guard (mirrors delete/deactivate): if this
      // user currently holds the wildcard and the NEW role set drops
      // it, there must be at least one other wildcard holder left.
      const keepsWildcard = await rolesGrantWildcard(roleIds)
      if (!keepsWildcard) {
        const holders = await listWildcardHolderIds()
        if (holders.includes(id) && !holders.some((u) => u !== id)) {
          error(
            409,
            'Dem letzten Administrator kann die Administrator-Rolle nicht entzogen werden.'
          )
        }
      }

      await replaceUserRoles(id, roleIds)
    }

    await Promise.all([getUserRemote({ id }).refresh(), refreshUserLists()])
  }
)

/**
 * Delete a user. Refuses to drop the last account that effectively
 * holds the wildcard `*` permission (the last admin) — otherwise the
 * remaining session set could lock everyone out of settings.
 *
 * @group integration
 * @module users
 */
export const deleteUserRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('users')

    if (!(await userExists(id))) error(404, 'Benutzer nicht gefunden.')

    const perms = await loadUserPermissions(id)
    if (perms.has(WILDCARD_PERMISSION)) {
      // Require another admin (other user with the wildcard) to remain.
      if (!(await hasOtherWildcardHolder(id))) {
        error(409, 'Der letzte Administrator kann nicht gelöscht werden.')
      }
    }

    await deleteUserById(id)
    await refreshUserLists()
  }
)

/**
 * Activate or deactivate a user account. Deactivating blocks sign-in and
 * force-logs-out any open session; the account keeps its data and roles.
 * The last account effectively holding the wildcard `*` permission cannot
 * be deactivated (mirrors the delete guard) so an admin can never lock
 * everyone out of settings.
 *
 * @group integration
 * @module users
 */
export const setUserActiveRemote = command(
  object({ id: idSchema, active: boolean() }),
  async ({ id, active }) => {
    requirePermission('users')

    if (!(await userExists(id))) error(404, 'Benutzer nicht gefunden.')

    if (!active) {
      const perms = await loadUserPermissions(id)
      if (perms.has(WILDCARD_PERMISSION)) {
        if (!(await hasOtherWildcardHolder(id))) {
          error(409, 'Der letzte Administrator kann nicht deaktiviert werden.')
        }
      }
    }

    await updateUserActive(id, active)

    // Kill any open session so deactivation takes effect immediately.
    if (!active) await deleteUserSessions(id)

    await Promise.all([getUserRemote({ id }).refresh(), refreshUserLists()])
  }
)

/* ────────────────────────────────────────────────────────────────────── */
/* Roles                                                                  */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * List all roles plus their permission strings.
 *
 * @group integration
 * @module users
 */
export const listRolesRemote = query(async () => {
  requirePermission('users')
  return listRolesWithPermissions()
})

/**
 * Create a new role + its permission set in a single round-trip.
 *
 * @group integration
 * @module users
 */
export const createRoleRemote = command(
  createRoleSchema,
  async ({ name, description, permissions }) => {
    requirePermission('users')
    const created = await createRoleWithPermissions({
      name,
      description,
      permissions
    })
    if (!created) error(500, 'Rolle konnte nicht angelegt werden.')
    await listRolesRemote().refresh()
    return { id: created.id }
  }
)

/**
 * Update a role's name, description and/or permission set. When
 * `permissions` is supplied the existing set is replaced wholesale.
 *
 * @group integration
 * @module users
 */
export const updateRoleRemote = command(
  updateRoleSchema,
  async ({ id, name, description, permissions }) => {
    requirePermission('users')

    const existing = await getRoleById(id)
    if (!existing) error(404, 'Rolle nicht gefunden.')

    // Lockout guard (mirrors deleteRoleRemote): the built-in
    // Administrator role can neither be renamed nor lose its wildcard
    // — stripping `*` here would lock every admin out at once.
    if (existing.name === 'Administrator') {
      if (name !== undefined && name !== 'Administrator') {
        error(409, 'Die Administrator-Rolle kann nicht umbenannt werden.')
      }
      if (
        permissions !== undefined &&
        !permissions.includes(WILDCARD_PERMISSION)
      ) {
        error(
          409,
          'Der Administrator-Rolle kann der Vollzugriff (*) nicht entzogen werden.'
        )
      }
    }

    if (name !== undefined || description !== undefined) {
      await updateRoleFields(id, { name, description })
    }

    if (permissions !== undefined) {
      await replaceRolePermissions(id, permissions)
    }

    await listRolesRemote().refresh()
  }
)

/**
 * Delete a role. The built-in "Administrator" role is protected — it
 * carries the wildcard `*` and removing it would leave no path to
 * regain full access.
 *
 * @group integration
 * @module users
 */
export const deleteRoleRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('users')

    const existing = await getRoleById(id)
    if (!existing) error(404, 'Rolle nicht gefunden.')
    if (existing.name === ADMIN_ROLE_NAME) {
      error(409, 'Die Administrator-Rolle kann nicht gelöscht werden.')
    }

    await deleteRoleById(id)
    await Promise.all([listRolesRemote().refresh(), refreshUserLists()])
  }
)
