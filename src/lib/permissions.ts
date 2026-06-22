/**
 * Shared (client + server safe) permission constants and pure helpers.
 * The DB-touching `loadUserPermissions` lives in `$lib/server/auth-permissions`
 * which re-exports the rest of this surface for server callers.
 */

export const WILDCARD_PERMISSION = '*'

export function hasPermission(
  permissions: Set<string>,
  required: string
): boolean {
  return permissions.has(WILDCARD_PERMISSION) || permissions.has(required)
}

/**
 * Permission model: **one key per module** (intentionally simple — a user
 * either has access to a module or not; if they do, they can do everything
 * in it). There is no longer a `:read` / `:write` / `:delete` split.
 *
 * The single, deliberate exception is `hours:write_own`: a self-service
 * grant that lets an employee log only their **own** time entries without
 * seeing or editing anyone else's. So the `hours` module has exactly two
 * grant levels — full (`hours`) or self-service (`hours:write_own`). Every
 * other module is a single boolean grant.
 */
export const MODULE_PERMISSIONS = {
  customers: ['customers'],
  vehicles: ['vehicles'],
  suppliers: ['suppliers'],
  employees: ['employees'],
  items: ['items'],
  offers: ['offers'],
  invoices: ['invoices'],
  reminders: ['reminders'],
  ledger: ['ledger'],
  calendar: ['calendar'],
  inventory: ['inventory'],
  hours: ['hours', 'hours:write_own'],
  mailings: ['mailings'],
  import: ['import'],
  settings: ['settings'],
  users: ['users'],
  tires: ['tires'],
  shipping: ['shipping'],
  posts: ['posts']
} as const

export type ModuleKey = keyof typeof MODULE_PERMISSIONS

export const ALL_PERMISSIONS: readonly string[] =
  Object.values(MODULE_PERMISSIONS).flat()
