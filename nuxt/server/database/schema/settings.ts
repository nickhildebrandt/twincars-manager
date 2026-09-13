/**
 * Firmeneinstellungen und Nummernkreise
 *
 * Beides sind faktisch Einzelzeilen-Tabellen bzw. Zähler.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, numeric, integer, boolean, timestamp, foreignKey, text, unique, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { items } from './catalog.ts'

export const companySettings = pgTable('company_settings', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  setupCompleted: boolean('setup_completed').default(false).notNull(),
  companyName: varchar('company_name', { length: 200 }).default('').notNull(),
  owner: varchar({ length: 200 }),
  street: varchar({ length: 200 }).default('').notNull(),
  zip: varchar({ length: 10 }).default('').notNull(),
  city: varchar({ length: 150 }).default('').notNull(),
  state: varchar({ length: 50 }).default('').notNull(),
  phone: varchar({ length: 30 }).default('').notNull(),
  mobile: varchar({ length: 30 }),
  fax: varchar({ length: 30 }),
  email: varchar({ length: 254 }).default('').notNull(),
  website: varchar({ length: 2048 }),
  vatId: varchar('vat_id', { length: 30 }),
  taxNumber: varchar('tax_number', { length: 30 }),
  bankName: varchar('bank_name', { length: 100 }),
  iban: varchar({ length: 34 }),
  bic: varchar({ length: 11 }),
  defaultPaymentTermDays: integer('default_payment_term_days').default(14).notNull(),
  defaultCurrency: varchar('default_currency', { length: 3 }).default('EUR').notNull(),
  defaultVatRate: numeric('default_vat_rate', { precision: 5, scale: 2 }).default('19.00').notNull(),
  salutationStyle: varchar('salutation_style', { length: 10 }).default('Sie').notNull(),
  logoMime: varchar('logo_mime', { length: 50 }),
  logoData: text('logo_data'),
  pdfFooter: text('pdf_footer').default('').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
  smallBusinessExempt: boolean('small_business_exempt').default(false).notNull(),
  reminderAutoEnabled: boolean('reminder_auto_enabled').default(true).notNull(),
  reminderDays1: integer('reminder_days_1').default(3).notNull(),
  reminderRecurEveryDays: integer('reminder_recur_every_days').default(14).notNull(),
  geoLat: numeric('geo_lat', { precision: 9, scale: 6 }),
  geoLon: numeric('geo_lon', { precision: 9, scale: 6 }),
  laborItemId: uuid('labor_item_id'),
}, table => [
  uniqueIndex('company_settings_singleton').using('btree', sql`((true))`),
  index('company_settings_labor_item_id_idx').using('btree', table.laborItemId.asc().nullsLast()),
  foreignKey({
    columns: [table.laborItemId],
    foreignColumns: [items.id],
    name: 'company_settings_labor_item_id_items_id_fk',
  }).onDelete('set null'),
])

export const numberRanges = pgTable('number_ranges', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  kind: varchar({ length: 30 }).notNull(),
  formatTemplate: varchar('format_template', { length: 50 }).notNull(),
  nextValue: integer('next_value').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  unique('number_ranges_kind_unique').on(table.kind),
])
