/**
 * Repository layer for user + role administration. Pure typed Drizzle
 * calls — permission guards, input validation and the curated German
 * error decisions (404/409/...) stay in
 * `src/routes/settings/users/users.remote.ts`.
 */
import { and, asc, count, desc, eq, ilike, inArray, ne, or } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  accounts,
  rolePermissions,
  roles,
  userRoles,
  users
} from '$lib/server/db/schema'
import { WILDCARD_PERMISSION } from '$lib/server/auth-permissions'

/* ────────────────────────────────────────────────────────────────────── */
/* Users                                                                  */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Paginated user list with the assigned roles resolved per user.
 * `q` filters by username, display name or email (case-insensitive).
 */
export async function listUsersWithRoles(params: {
  page: number
  size: number
  q?: string
}) {
  const { page, size, q } = params
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
          .select({ userId: userRoles.userId, id: roles.id, name: roles.name })
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

/** Single user plus their assigned role ids, or `null` when unknown. */
export async function getUserWithRoleIds(id: string) {
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
  if (!row) return null

  const roleRows = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, id))

  return { ...row, roleIds: roleRows.map((r) => r.roleId) }
}

/** `true` when a user row with the given id exists. */
export async function userExists(id: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  return !!existing
}

/** `true` when every given role id resolves to an existing role. */
export async function allRoleIdsExist(roleIds: string[]): Promise<boolean> {
  if (roleIds.length === 0) return true
  const existing = await db
    .select({ id: roles.id })
    .from(roles)
    .where(inArray(roles.id, roleIds))
  return existing.length === roleIds.length
}

/** Assign roles to a user; existing assignments are left untouched. */
export async function assignRolesToUser(
  userId: string,
  roleIds: string[]
): Promise<void> {
  if (roleIds.length === 0) return
  await db
    .insert(userRoles)
    .values(roleIds.map((roleId) => ({ userId, roleId })))
    .onConflictDoNothing({ target: [userRoles.userId, userRoles.roleId] })
}

/** Replace a user's role set wholesale. */
export async function replaceUserRoles(
  userId: string,
  roleIds: string[]
): Promise<void> {
  await db.delete(userRoles).where(eq(userRoles.userId, userId))
  await assignRolesToUser(userId, roleIds)
}

/** Rename a user (display name). */
export async function updateUserName(id: string, name: string): Promise<void> {
  await db
    .update(users)
    .set({ name, updatedAt: new Date() })
    .where(eq(users.id, id))
}

/**
 * Write a pre-hashed password to the user's `credential` account row,
 * creating the row when the user has none yet (e.g. imported users).
 * Hashing happens in the remote via better-auth's own helper so the
 * stored format always matches what sign-in verifies against.
 */
export async function setUserCredentialPassword(
  userId: string,
  passwordHash: string
): Promise<void> {
  const credentialRows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential'))
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
        userId,
        accountId: userId,
        providerId: 'credential',
        password: passwordHash
      })
  }
}

/** Flip the `active` flag of a user account. */
export async function updateUserActive(
  id: string,
  active: boolean
): Promise<void> {
  await db
    .update(users)
    .set({ active, updatedAt: new Date() })
    .where(eq(users.id, id))
}

/** Hard-delete a user row (cascades handle sessions/accounts/roles). */
export async function deleteUserById(id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id))
}

/* ────────────────────────────────────────────────────────────────────── */
/* Wildcard (last-admin) guard queries                                    */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * `true` when the given role set effectively grants the wildcard `*`
 * permission. An empty set never does.
 */
export async function rolesGrantWildcard(roleIds: string[]): Promise<boolean> {
  if (roleIds.length === 0) return false
  const perms = await db
    .select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(inArray(rolePermissions.roleId, roleIds))
  return perms.some((p) => p.permission === WILDCARD_PERMISSION)
}

/**
 * Ids of all users that currently hold the wildcard `*` permission via
 * any of their roles (users → user_roles → role_permissions).
 */
export async function listWildcardHolderIds(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .where(eq(rolePermissions.permission, WILDCARD_PERMISSION))
  return rows.map((r) => r.userId)
}

/**
 * `true` when at least one user other than `excludeUserId` holds the
 * wildcard `*` permission — the query part of the last-admin guards
 * for delete and deactivate.
 */
export async function hasOtherWildcardHolder(
  excludeUserId: string
): Promise<boolean> {
  const rows = await db
    .selectDistinct({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .where(
      and(
        eq(rolePermissions.permission, WILDCARD_PERMISSION),
        ne(userRoles.userId, excludeUserId)
      )
    )
  return rows.length > 0
}

/* ────────────────────────────────────────────────────────────────────── */
/* Roles                                                                  */
/* ────────────────────────────────────────────────────────────────────── */

/** All roles with their permission strings, ordered by name. */
export async function listRolesWithPermissions() {
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
}

/** Single role (id + name) or `null` when unknown. */
export async function getRoleById(
  id: string
): Promise<{ id: string; name: string } | null> {
  const [row] = await db
    .select({ id: roles.id, name: roles.name })
    .from(roles)
    .where(eq(roles.id, id))
    .limit(1)
  return row ?? null
}

/**
 * Create a role plus its (deduplicated) permission set. Returns `null`
 * when the insert unexpectedly yields no row — the remote turns that
 * into a curated 500.
 */
export async function createRoleWithPermissions(input: {
  name: string
  description?: string
  permissions: string[]
}): Promise<{ id: string } | null> {
  const [row] = await db
    .insert(roles)
    .values({ name: input.name, description: input.description ?? null })
    .returning({ id: roles.id })
  if (!row) return null
  if (input.permissions.length > 0) {
    const unique = Array.from(new Set(input.permissions))
    await db
      .insert(rolePermissions)
      .values(unique.map((permission) => ({ roleId: row.id, permission })))
      .onConflictDoNothing({
        target: [rolePermissions.roleId, rolePermissions.permission]
      })
  }
  return { id: row.id }
}

/** Patch a role's name and/or description (only provided fields). */
export async function updateRoleFields(
  id: string,
  fields: { name?: string; description?: string }
): Promise<void> {
  const patch: { name?: string; description?: string | null } = {}
  if (fields.name !== undefined) patch.name = fields.name
  if (fields.description !== undefined) patch.description = fields.description
  await db.update(roles).set(patch).where(eq(roles.id, id))
}

/** Replace a role's permission set wholesale (deduplicated). */
export async function replaceRolePermissions(
  roleId: string,
  permissions: string[]
): Promise<void> {
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))
  if (permissions.length > 0) {
    const unique = Array.from(new Set(permissions))
    await db
      .insert(rolePermissions)
      .values(unique.map((permission) => ({ roleId, permission })))
      .onConflictDoNothing({
        target: [rolePermissions.roleId, rolePermissions.permission]
      })
  }
}

/** Hard-delete a role (assignments cascade). */
export async function deleteRoleById(id: string): Promise<void> {
  await db.delete(roles).where(eq(roles.id, id))
}
