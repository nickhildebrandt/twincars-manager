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
import { and, asc, count, desc, eq, ilike, inArray, ne, or } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  accounts,
  rolePermissions,
  roles,
  userRoles,
  users
} from '$lib/server/db/schema'
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

/**
 * Remote functions for user + role management. Mounted under the
 * settings UI; every entry requires the `users` module permission.
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
    const offset = (page - 1) * size
    const filters = q
      ? [
          or(
            ilike(users.username, `%${q}%`),
            ilike(users.name, `%${q}%`),
            ilike(users.email, `%${q}%`)
          )!
        ]
      : []
    const where = filters.length > 0 ? and(...filters) : undefined

    const [rows, totalRow] = await Promise.all([
      db
        .select({
          id: users.id,
          username: users.username,
          name: users.name,
          email: users.email,
          active: users.active,
          createdAt: users.createdAt
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(size)
        .offset(offset),
      db.select({ value: count() }).from(users).where(where)
    ])

    const userIds = rows.map((r) => r.id)
    const roleRows =
      userIds.length === 0
        ? []
        : await db
            .select({
              userId: userRoles.userId,
              id: roles.id,
              name: roles.name
            })
            .from(userRoles)
            .innerJoin(roles, eq(roles.id, userRoles.roleId))
            .where(inArray(userRoles.userId, userIds))

    const rolesByUser = new Map<string, Array<{ id: string; name: string }>>()
    for (const r of roleRows) {
      const list = rolesByUser.get(r.userId) ?? []
      list.push({ id: r.id, name: r.name })
      rolesByUser.set(r.userId, list)
    }

    const total = Number(totalRow[0]?.value ?? 0)
    return {
      items: rows.map((r) => ({
        id: r.id,
        username: r.username,
        name: r.name,
        email: r.email,
        active: r.active,
        roles: rolesByUser.get(r.id) ?? [],
        createdAt: r.createdAt
      })),
      total,
      page,
      size,
      pageCount: Math.max(1, Math.ceil(total / size))
    }
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
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      email: users.email,
      active: users.active,
      createdAt: users.createdAt
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  if (!row) error(404, 'Benutzer nicht gefunden.')

  const roleRows = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, id))

  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    active: row.active,
    createdAt: row.createdAt,
    roleIds: roleRows.map((r) => r.roleId)
  }
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
      const existingRoles = await db
        .select({ id: roles.id })
        .from(roles)
        .where(inArray(roles.id, roleIds))
      if (existingRoles.length !== roleIds.length) {
        error(400, 'Mindestens eine Rolle wurde nicht gefunden.')
      }

      await db
        .insert(userRoles)
        .values(roleIds.map((roleId) => ({ userId, roleId })))
        .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] })
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

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
    if (!existing) error(404, 'Benutzer nicht gefunden.')

    if (name !== undefined) {
      await db
        .update(users)
        .set({ name, updatedAt: new Date() })
        .where(eq(users.id, id))
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
      const credentialRows = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(eq(accounts.userId, id), eq(accounts.providerId, 'credential'))
        )
        .limit(1)
      if (credentialRows[0]) {
        await db
          .update(accounts)
          .set({ password: passwordHash, updatedAt: new Date() })
          .where(eq(accounts.id, credentialRows[0].id))
      } else {
        await db
          .insert(accounts)
          .values({
            id: crypto.randomUUID(),
            userId: id,
            accountId: id,
            providerId: 'credential',
            password: passwordHash
          })
      }
    }

    if (roleIds !== undefined) {
      if (roleIds.length > 0) {
        const existingRoles = await db
          .select({ id: roles.id })
          .from(roles)
          .where(inArray(roles.id, roleIds))
        if (existingRoles.length !== roleIds.length) {
          error(400, 'Mindestens eine Rolle wurde nicht gefunden.')
        }
      }
      await db.delete(userRoles).where(eq(userRoles.userId, id))
      if (roleIds.length > 0) {
        await db
          .insert(userRoles)
          .values(roleIds.map((roleId) => ({ userId: id, roleId })))
          .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] })
      }
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

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
    if (!existing) error(404, 'Benutzer nicht gefunden.')

    const perms = await loadUserPermissions(id)
    if (perms.has(WILDCARD_PERMISSION)) {
      // Count remaining admins (other users with the wildcard) by
      // joining users → user_roles → role_permissions.
      const otherAdmins = await db
        .selectDistinct({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(
          rolePermissions,
          eq(rolePermissions.roleId, userRoles.roleId)
        )
        .where(
          and(
            eq(rolePermissions.permission, WILDCARD_PERMISSION),
            ne(userRoles.userId, id)
          )
        )
      if (otherAdmins.length === 0) {
        error(409, 'Der letzte Administrator kann nicht gelöscht werden.')
      }
    }

    await db.delete(users).where(eq(users.id, id))
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

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
    if (!existing) error(404, 'Benutzer nicht gefunden.')

    if (!active) {
      const perms = await loadUserPermissions(id)
      if (perms.has(WILDCARD_PERMISSION)) {
        const otherAdmins = await db
          .selectDistinct({ userId: userRoles.userId })
          .from(userRoles)
          .innerJoin(
            rolePermissions,
            eq(rolePermissions.roleId, userRoles.roleId)
          )
          .where(
            and(
              eq(rolePermissions.permission, WILDCARD_PERMISSION),
              ne(userRoles.userId, id)
            )
          )
        if (otherAdmins.length === 0) {
          error(409, 'Der letzte Administrator kann nicht deaktiviert werden.')
        }
      }
    }

    await db
      .update(users)
      .set({ active, updatedAt: new Date() })
      .where(eq(users.id, id))

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
  const roleRows = await db
    .select({ id: roles.id, name: roles.name, description: roles.description })
    .from(roles)
    .orderBy(asc(roles.name))
  if (roleRows.length === 0) return []
  const permRows = await db
    .select({
      roleId: rolePermissions.roleId,
      permission: rolePermissions.permission
    })
    .from(rolePermissions)
    .where(
      inArray(
        rolePermissions.roleId,
        roleRows.map((r) => r.id)
      )
    )
  const permsByRole = new Map<string, string[]>()
  for (const p of permRows) {
    const list = permsByRole.get(p.roleId) ?? []
    list.push(p.permission)
    permsByRole.set(p.roleId, list)
  }
  return roleRows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    permissions: permsByRole.get(r.id) ?? []
  }))
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
    const [row] = await db
      .insert(roles)
      .values({ name, description: description ?? null })
      .returning({ id: roles.id })
    if (!row) error(500, 'Rolle konnte nicht angelegt werden.')
    if (permissions.length > 0) {
      const unique = Array.from(new Set(permissions))
      await db
        .insert(rolePermissions)
        .values(unique.map((permission) => ({ roleId: row.id, permission })))
        .onConflictDoNothing({
          target: [rolePermissions.roleId, rolePermissions.permission]
        })
    }
    await listRolesRemote().refresh()
    return { id: row.id }
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

    const [existing] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.id, id))
      .limit(1)
    if (!existing) error(404, 'Rolle nicht gefunden.')

    if (name !== undefined || description !== undefined) {
      const patch: { name?: string; description?: string | null } = {}
      if (name !== undefined) patch.name = name
      if (description !== undefined) patch.description = description
      await db.update(roles).set(patch).where(eq(roles.id, id))
    }

    if (permissions !== undefined) {
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id))
      if (permissions.length > 0) {
        const unique = Array.from(new Set(permissions))
        await db
          .insert(rolePermissions)
          .values(unique.map((permission) => ({ roleId: id, permission })))
          .onConflictDoNothing({
            target: [rolePermissions.roleId, rolePermissions.permission]
          })
      }
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

    const [existing] = await db
      .select({ id: roles.id, name: roles.name })
      .from(roles)
      .where(eq(roles.id, id))
      .limit(1)
    if (!existing) error(404, 'Rolle nicht gefunden.')
    if (existing.name === ADMIN_ROLE_NAME) {
      error(409, 'Die Administrator-Rolle kann nicht gelöscht werden.')
    }

    await db.delete(roles).where(eq(roles.id, id))
    await Promise.all([listRolesRemote().refresh(), refreshUserLists()])
  }
)
