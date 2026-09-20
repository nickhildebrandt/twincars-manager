/**
 * Accounts, seen from the application rather than from the library.
 *
 * Every function here takes plain arguments and an executor, never the event,
 * so the rules can be tested against a database without HTTP.
 */
import { and, eq, inArray, ne } from 'drizzle-orm'
import { accounts, rolePermissions, roles, sessions, userRoles, users } from '../database/schema/index.ts'
import type { Executor } from './db.ts'
import { useDatabase } from './db.ts'
import { WILDCARD_PERMISSION } from '#shared/permissions'

/** The e-mail address a username is stored under. It never leaves the server. */
export const syntheticEmail = (username: string) => `${username.toLowerCase()}@twincars.local`

/**
 * Whether the account may hold a session.
 *
 * Checked before a session is created **and** on every request afterwards, so
 * deactivating somebody ends their work immediately rather than at the next
 * login.
 */
export async function isUserActive(userId: string, executor: Executor = useDatabase()): Promise<boolean> {
  const [row] = await executor
    .select({ active: users.active })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return row?.active === true
}

/**
 * Ends every session of one account.
 *
 * Called when an account is deactivated or deleted. Without it the holder
 * keeps working until their cookie expires.
 */
export async function deleteUserSessions(
  userId: string,
  executor: Executor = useDatabase(),
): Promise<number> {
  const removed = await executor
    .delete(sessions)
    .where(eq(sessions.userId, userId))
    .returning({ id: sessions.id })
  return removed.length
}

/** Deactivates an account and ends its sessions in one transaction. */
export async function deactivateUser(userId: string, executor: Executor): Promise<void> {
  await executor.update(users).set({ active: false }).where(eq(users.id, userId))
  await deleteUserSessions(userId, executor)
}

/** Reactivates an account. Existing sessions stay gone; the holder signs in again. */
export async function activateUser(userId: string, executor: Executor = useDatabase()): Promise<void> {
  await executor.update(users).set({ active: true }).where(eq(users.id, userId))
}

/**
 * Every permission key of one account, flattened over its roles.
 *
 * Read once per request and kept in `event.context.auth` for its duration.
 */
export async function loadUserPermissions(
  userId: string,
  executor: Executor = useDatabase(),
): Promise<Set<string>> {
  const rows = await executor
    .select({ permission: rolePermissions.permission })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .where(eq(userRoles.userId, userId))
  return new Set(rows.map(row => row.permission))
}

/** The role names of one account, for the profile and the user list. */
export async function loadUserRoles(
  userId: string,
  executor: Executor = useDatabase(),
): Promise<string[]> {
  const rows = await executor
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId))
  return rows.map(row => row.name).sort()
}

/**
 * Whether this account is the last one that can still reach the settings.
 *
 * Deactivating or deleting it would lock everybody out of user administration,
 * with no way back except the database. The check counts **other** accounts
 * that are active and hold the wildcard.
 */
export async function isLastAdministrator(
  userId: string,
  executor: Executor = useDatabase(),
): Promise<boolean> {
  const holders = await executor
    .selectDistinct({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(and(
      eq(rolePermissions.permission, WILDCARD_PERMISSION),
      eq(users.active, true),
      ne(users.id, userId),
    ))
  return holders.length === 0
}

/** Assigns exactly these roles to an account, removing any others. */
export async function setUserRoles(
  userId: string,
  roleIds: string[],
  executor: Executor,
): Promise<void> {
  await executor.delete(userRoles).where(eq(userRoles.userId, userId))
  if (roleIds.length === 0) return
  await executor.insert(userRoles).values(roleIds.map(roleId => ({ userId, roleId })))
}

/** Whether any account exists yet. The setup wizard asks this. */
export async function hasAnyUser(executor: Executor = useDatabase()): Promise<boolean> {
  const [row] = await executor.select({ id: users.id }).from(users).limit(1)
  return row !== undefined
}

/** Whether the account holds a credential it can sign in with. */
export async function hasCredential(
  userId: string,
  executor: Executor = useDatabase(),
): Promise<boolean> {
  const rows = await executor
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), inArray(accounts.providerId, ['credential'])))
    .limit(1)
  return rows.length > 0
}
