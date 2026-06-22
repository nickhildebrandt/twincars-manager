import { error } from '@sveltejs/kit'
import { getRequestEvent } from '$app/server'
import { hasPermission } from './auth-permissions'
import type { AuthSession } from './auth'

type LocalsUser = NonNullable<AuthSession>['user']

/**
 * Assert that the current request is authenticated. Throws a curated
 * 401 with a German message that the global error handler will pass
 * through unchanged.
 *
 * Use as the first call in every remote function:
 *
 * ```ts
 * export const listCustomersRemote = query(listSchema, async (params) => {
 *   const user = requireUser()
 *   requirePermission('customers')
 *   return listCustomers(params)
 * })
 * ```
 */
export function requireUser(): LocalsUser {
  const event = getRequestEvent()
  if (!event.locals.user) {
    error(401, 'Bitte melden Sie sich an.')
  }
  return event.locals.user
}

/**
 * Assert that the current request has the given permission. Throws
 * 401 if anonymous, 403 if missing the permission. Call after
 * `requireUser()` (or instead of it — this calls `requireUser` first).
 */
export function requirePermission(permission: string): LocalsUser {
  const user = requireUser()
  const event = getRequestEvent()
  if (!hasPermission(event.locals.permissions, permission)) {
    error(403, 'Keine Berechtigung für diese Aktion.')
  }
  return user
}

/**
 * Same as `requirePermission` but accepts a list — passes if ANY of
 * the listed permissions is granted. Useful for "read or write"-style
 * checks where read access alone is enough.
 */
export function requireAnyPermission(...permissions: string[]): LocalsUser {
  const user = requireUser()
  const event = getRequestEvent()
  const granted = permissions.some((p) =>
    hasPermission(event.locals.permissions, p)
  )
  if (!granted) {
    error(403, 'Keine Berechtigung für diese Aktion.')
  }
  return user
}
