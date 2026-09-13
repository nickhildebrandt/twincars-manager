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

/** A single permission key, e.g. `customers` or `hours:write_own`. */
export type PermissionKey = typeof MODULE_PERMISSIONS[ModuleKey][number]

/** The module a permission key belongs to. */
export function moduleOf(key: string): ModuleKey | undefined {
  for (const [module, keys] of Object.entries(MODULE_PERMISSIONS)) {
    if ((keys as readonly string[]).includes(key)) return module as ModuleKey
  }
  return undefined
}

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

/**
 * True when the set grants **exactly** this key, or holds the wildcard.
 *
 * Endpoints ask this. Seeing a module and being allowed to do everything in it
 * are two different questions: somebody with `hours:write_own` may log their
 * own time but must not read everyone else's.
 */
export function hasPermission(permissions: Set<string>, required: string): boolean {
  return permissions.has(WILDCARD_PERMISSION) || permissions.has(required)
}

/**
 * True when the set grants **any** key of the module.
 *
 * Navigation and page visibility ask this. The predecessor's sidebar demanded
 * `hours:write_own` literally, so a role with full `hours` access lost the
 * entry entirely — the seeded roles happened to hold both keys, which is why
 * nobody noticed (B-058).
 */
export function hasModule(permissions: Set<string>, module: ModuleKey): boolean {
  if (permissions.has(WILDCARD_PERMISSION)) return true
  return (MODULE_PERMISSIONS[module] as readonly string[]).some(key => permissions.has(key))
}

/** True when the set grants at least one of the keys. */
export function hasAnyPermission(permissions: Set<string>, ...required: string[]): boolean {
  return required.some(key => hasPermission(permissions, key))
}
