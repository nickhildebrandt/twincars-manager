/**
 * The permission model: **one key per module**.
 *
 * A user either has access to a module or not; if they do, they can do
 * everything in it. There is no read/write/delete split — the business has
 * eight people, and a finer model would only produce configuration nobody
 * maintains.
 *
 * The single, deliberate exception is `hours:write_own`: it lets an employee
 * log their own time without seeing anyone else's.
 */

export const WILDCARD_PERMISSION = '*'

/** Module key → the permission keys that grant it. */
export const MODULE_PERMISSIONS = {
  customers: ['customers'],
  vehicles: ['vehicles'],
  suppliers: ['suppliers'],
  employees: ['employees'],
  items: ['items'],
  offers: ['offers'],
  invoices: ['invoices'],
  /** Werkstattaufträge. */
  orders: ['orders'],
  reminders: ['reminders'],
  ledger: ['ledger'],
  calendar: ['calendar'],
  inventory: ['inventory'],
  /** Full access, or self-service only. */
  hours: ['hours', 'hours:write_own'],
  mailings: ['mailings'],
  import: ['import'],
  settings: ['settings'],
  users: ['users'],
  tires: ['tires'],
  posts: ['posts'],
} as const

export type ModuleKey = keyof typeof MODULE_PERMISSIONS

export const ALL_PERMISSIONS: readonly string[] = Object.values(MODULE_PERMISSIONS).flat()

/** German label per module, for the permission matrix in the user admin. */
export const MODULE_LABELS: Record<ModuleKey, string> = {
  customers: 'Kunden',
  vehicles: 'Fahrzeuge',
  suppliers: 'Lieferanten',
  employees: 'Mitarbeiter',
  items: 'Leistungen und Artikel',
  offers: 'Angebote',
  invoices: 'Rechnungen',
  orders: 'Aufträge',
  reminders: 'Offene Rechnungen',
  ledger: 'Buchhaltung',
  calendar: 'Kalender',
  inventory: 'Zu verkaufende Fahrzeuge',
  hours: 'Zeiterfassung',
  mailings: 'Rundschreiben',
  import: 'Datenübernahme',
  settings: 'Einstellungen',
  users: 'Benutzer und Rollen',
  tires: 'Reifen und Reifenlager',
  posts: 'Aktuelle Informationen',
}

/** True when the set grants the required key, directly or through the wildcard. */
export function hasPermission(permissions: Set<string>, required: string): boolean {
  return permissions.has(WILDCARD_PERMISSION) || permissions.has(required)
}

/** True when the set grants at least one of the keys. */
export function hasAnyPermission(permissions: Set<string>, ...required: string[]): boolean {
  return required.some(key => hasPermission(permissions, key))
}
