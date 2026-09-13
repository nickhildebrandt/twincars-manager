/**
 * Default content the application needs to be usable: roles, mail templates,
 * ledger categories, number ranges, opening hours and the labour item.
 *
 * Every step is idempotent — running it twice changes nothing and never
 * overwrites an edit the operator made. It runs once after the migrations,
 * **not** on the first request: the predecessor seeded inside the request
 * lifecycle and stayed permanently broken after a single failure (B-015).
 */
import { eq } from 'drizzle-orm'
import type { useDatabase } from '../../utils/db.ts'
import {
  companySettings,
  itemPriceVersions,
  items,
  ledgerCategories,
  mailTemplates,
  numberRanges,
  rolePermissions,
  roles,
  smtpSettings,
  workshopHours,
} from '../schema/index.ts'
import { MODULE_PERMISSIONS, WILDCARD_PERMISSION } from '#shared/permissions'
import { DEFAULT_MAIL_TEMPLATES } from './mail-templates.ts'

type Database = ReturnType<typeof useDatabase>

/**
 * Number formats. Customer and document numbers are plain counters on purpose:
 * the business has to continue the series of the legacy Access database
 * without a gap, because the tax office sees them. Reminders, storage slots
 * and work orders are new and start at 1 with a year prefix.
 */
export const DEFAULT_NUMBER_RANGES = [
  { kind: 'invoice', formatTemplate: '{N}' },
  { kind: 'offer', formatTemplate: '{N}' },
  { kind: 'cost_estimate', formatTemplate: '{N}' },
  { kind: 'order_confirmation', formatTemplate: '{N}' },
  { kind: 'customer', formatTemplate: '{N}' },
  { kind: 'reminder', formatTemplate: 'ZE-{YYYY}-{NNNN}' },
  { kind: 'tire_storage', formatTemplate: 'L-{YYYY}-{NNNN}' },
  { kind: 'work_order', formatTemplate: 'AU-{YYYY}-{NNNN}' },
  { kind: 'tire', formatTemplate: '{N}' },
  // Cancellations keep the invoice counter style with an S prefix, so an
  // audit list separates them at a glance.
  { kind: 'storno', formatTemplate: 'S-{N}' },
] as const

export const DEFAULT_LEDGER_CATEGORIES = [
  { direction: 'income', name: 'Werkstatterlöse' },
  { direction: 'income', name: 'Fahrzeugverkauf' },
  { direction: 'income', name: 'Sonstige Einnahmen' },
  { direction: 'expense', name: 'Material' },
  { direction: 'expense', name: 'Werkzeug' },
  { direction: 'expense', name: 'Miete' },
  { direction: 'expense', name: 'Strom' },
  { direction: 'expense', name: 'Internet' },
  { direction: 'expense', name: 'Reisekosten' },
  { direction: 'expense', name: 'Lohnaufwand' },
  { direction: 'expense', name: 'Fahrzeug-Einkauf' },
  { direction: 'expense', name: 'Inzahlungnahme' },
  { direction: 'expense', name: 'Sonstiges' },
] as const

/** Monday to Friday open, weekend closed. */
export const DEFAULT_WORKSHOP_HOURS = [0, 1, 2, 3, 4, 5, 6].map(weekday => ({
  weekday,
  opensAt: '08:00',
  closesAt: '17:00',
  closed: weekday === 0 || weekday === 6,
}))

export const DEFAULT_PDF_FOOTER
  = 'Vielen Dank für Ihren Auftrag. Es gelten unsere allgemeinen Geschäftsbedingungen.\n'
    + 'Zahlbar innerhalb des angegebenen Zahlungsziels ohne Abzug.'

/** Article number of the catalogue item that carries the workshop hourly rate. */
export const LABOUR_ARTICLE_NUMBER = 'ARBEIT'

export type SeedReport = Record<string, number>

/** Runs every seed step. Returns how many rows each step inserted. */
export async function seedDefaults(db: Database): Promise<SeedReport> {
  return {
    companySettings: await seedCompanySettings(db),
    smtpSettings: await seedSmtpSettings(db),
    numberRanges: await seedNumberRanges(db),
    mailTemplates: await seedMailTemplates(db),
    ledgerCategories: await seedLedgerCategories(db),
    roles: await seedRoles(db),
    workshopHours: await seedWorkshopHours(db),
    labourItem: await seedLabourItem(db),
  }
}

async function seedCompanySettings(db: Database): Promise<number> {
  const existing = await db.select({ id: companySettings.id }).from(companySettings).limit(1)
  if (existing.length > 0) return 0
  await db.insert(companySettings).values({ pdfFooter: DEFAULT_PDF_FOOTER })
  return 1
}

async function seedSmtpSettings(db: Database): Promise<number> {
  const existing = await db.select({ id: smtpSettings.id }).from(smtpSettings).limit(1)
  if (existing.length > 0) return 0
  await db.insert(smtpSettings).values({})
  return 1
}

async function seedNumberRanges(db: Database): Promise<number> {
  let inserted = 0
  for (const range of DEFAULT_NUMBER_RANGES) {
    const result = await db
      .insert(numberRanges)
      .values({ kind: range.kind, formatTemplate: range.formatTemplate, nextValue: 1 })
      .onConflictDoNothing({ target: numberRanges.kind })
      .returning({ id: numberRanges.id })
    inserted += result.length
  }
  return inserted
}

async function seedMailTemplates(db: Database): Promise<number> {
  let inserted = 0
  for (const template of DEFAULT_MAIL_TEMPLATES) {
    const result = await db
      .insert(mailTemplates)
      .values({ ...template, isCustom: false })
      .onConflictDoNothing({ target: mailTemplates.key })
      .returning({ id: mailTemplates.id })
    inserted += result.length
  }
  return inserted
}

async function seedLedgerCategories(db: Database): Promise<number> {
  let inserted = 0
  for (const category of DEFAULT_LEDGER_CATEGORIES) {
    const result = await db
      .insert(ledgerCategories)
      .values({ direction: category.direction, name: category.name })
      .onConflictDoNothing({ target: ledgerCategories.name })
      .returning({ id: ledgerCategories.id })
    inserted += result.length
  }
  return inserted
}

async function seedWorkshopHours(db: Database): Promise<number> {
  let inserted = 0
  for (const row of DEFAULT_WORKSHOP_HOURS) {
    const result = await db
      .insert(workshopHours)
      .values(row)
      .onConflictDoNothing({ target: workshopHours.weekday })
      .returning({ weekday: workshopHours.weekday })
    inserted += result.length
  }
  return inserted
}

/**
 * The three built-in roles.
 *
 * Administrator holds the wildcard, so a new module is granted automatically.
 * Werkstattleiter gets every module except settings and users — also derived,
 * so it keeps up on its own. Mitarbeiter is a curated list and gains a new
 * module only deliberately; time is self-service only.
 */
async function seedRoles(db: Database): Promise<number> {
  let inserted = 0
  inserted += await ensureRole(db, 'Administrator', 'Voller Zugriff auf alle Module.', [
    WILDCARD_PERMISSION,
  ])
  inserted += await ensureRole(
    db,
    'Werkstattleiter',
    'Vollzugriff auf alle Module außer Einstellungen und Benutzer.',
    Object.entries(MODULE_PERMISSIONS)
      .filter(([module]) => module !== 'settings' && module !== 'users')
      .flatMap(([, keys]) => keys),
  )
  inserted += await ensureRole(
    db,
    'Mitarbeiter',
    'Operativer Zugriff auf die wichtigsten Module; Stunden nur für sich selbst.',
    [
      'customers', 'vehicles', 'suppliers', 'items', 'offers', 'invoices',
      'orders', 'reminders', 'calendar', 'inventory', 'tires', 'hours:write_own',
    ],
  )
  return inserted
}

async function ensureRole(
  db: Database,
  name: string,
  description: string,
  permissions: readonly string[],
): Promise<number> {
  let [role] = await db.select().from(roles).where(eq(roles.name, name)).limit(1)
  let inserted = 0
  if (!role) {
    ;[role] = await db.insert(roles).values({ name, description }).returning()
    inserted = 1
  }
  if (!role) return inserted

  for (const permission of permissions) {
    await db
      .insert(rolePermissions)
      .values({ roleId: role.id, permission })
      .onConflictDoNothing({
        target: [rolePermissions.roleId, rolePermissions.permission],
      })
  }
  return inserted
}

/**
 * The catalogue item that carries the workshop hourly rate. Work-order labour
 * lines snapshot its current price, so it must exist before the first order.
 * Only a newly created item gets the zero starting price; an operator edit is
 * never overwritten.
 */
async function seedLabourItem(db: Database): Promise<number> {
  let [item] = await db
    .select()
    .from(items)
    .where(eq(items.articleNumber, LABOUR_ARTICLE_NUMBER))
    .limit(1)

  let inserted = 0
  if (!item) {
    ;[item] = await db
      .insert(items)
      .values({
        articleNumber: LABOUR_ARTICLE_NUMBER,
        description: 'Arbeitszeit',
        kind: 'service',
        unit: 'Std.',
      })
      .returning()
    inserted = 1
    if (item) {
      await db.insert(itemPriceVersions).values({
        itemId: item.id,
        validFrom: new Date().toISOString().slice(0, 10),
        unitPriceNet: '0',
      })
    }
  }

  const [settings] = await db.select().from(companySettings).limit(1)
  if (item && settings && settings.laborItemId === null) {
    await db
      .update(companySettings)
      .set({ laborItemId: item.id })
      .where(eq(companySettings.id, settings.id))
  }
  return inserted
}
