/**
 * Kunden, Lieferanten und Anfragen
 *
 * Kunden und Lieferanten werden archiviert, nicht gelöscht.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, date, integer, boolean, timestamp, index, uniqueIndex, foreignKey, text } from 'drizzle-orm/pg-core'

export const customers = pgTable('customers', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  customerNumber: varchar('customer_number', { length: 50 }).notNull(),
  legacyCustomerNumber: varchar('legacy_customer_number', { length: 50 }),
  company: varchar({ length: 200 }),
  salutation: varchar({ length: 30 }),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  street: varchar({ length: 200 }),
  zip: varchar({ length: 10 }),
  city: varchar({ length: 150 }),
  country: varchar({ length: 100 }).default('Deutschland'),
  phone: varchar({ length: 30 }),
  phone2: varchar({ length: 30 }),
  mobile: varchar({ length: 30 }),
  fax: varchar({ length: 30 }),
  email: varchar({ length: 254 }),
  website: varchar({ length: 2048 }),
  birthday: date(),
  notes: text(),
  paymentTermDays: integer('payment_term_days'),
  vatId: varchar('vat_id', { length: 30 }),
  bankIban: varchar('bank_iban', { length: 34 }),
  bankBic: varchar('bank_bic', { length: 11 }),
  bankName: varchar('bank_name', { length: 100 }),
  archived: boolean().default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
  /**
   * Kundenart: `privat`, `firma` oder `ebay` (Entscheidung E-16).
   *
   * Ein ausdrückliches Feld, kein Rückschluss aus einem leeren
   * Firmennamen — genau das war Befund B-200.
   */
  kind: varchar({ length: 20 }).default('privat').notNull(),
  ebayHandle: varchar('ebay_handle', { length: 100 }),
  wantsBroadcast: boolean('wants_broadcast').default(false).notNull(),
  wantsTireReminders: boolean('wants_tire_reminders').default(false).notNull(),
}, table => [
  index('customers_created_at_idx').using('btree', table.createdAt.desc().nullsLast()),
  index('customers_company_idx').using('btree', table.company.asc().nullsLast()),
  uniqueIndex('customers_customer_number_idx').using('btree', table.customerNumber.asc().nullsLast()),
  index('customers_kind_idx').using('btree', table.kind.asc().nullsLast()),
  index('customers_last_name_idx').using('btree', table.lastName.asc().nullsLast()),
  index('customers_wants_broadcast_idx').using('btree', table.wantsBroadcast.asc().nullsLast()),
  index('customers_zip_idx').using('btree', table.zip.asc().nullsLast()),
])

export const suppliers = pgTable('suppliers', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  legacySupplierNumber: varchar('legacy_supplier_number', { length: 50 }),
  name: varchar({ length: 200 }).notNull(),
  customerNumberAtSupplier: varchar('customer_number_at_supplier', { length: 50 }),
  contactPerson: varchar('contact_person', { length: 100 }),
  street: varchar({ length: 200 }),
  zip: varchar({ length: 10 }),
  city: varchar({ length: 150 }),
  country: varchar({ length: 100 }),
  phone: varchar({ length: 30 }),
  fax: varchar({ length: 30 }),
  email: varchar({ length: 254 }),
  website: varchar({ length: 2048 }),
  bankName: varchar('bank_name', { length: 100 }),
  iban: varchar({ length: 34 }),
  bic: varchar({ length: 11 }),
  notes: text(),
  archived: boolean().default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  index('suppliers_created_at_idx').using('btree', table.createdAt.desc().nullsLast()),
])

export const customerInquiries = pgTable('customer_inquiries', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  customerId: uuid('customer_id'),
  customerEmail: varchar('customer_email', { length: 254 }).notNull(),
  customerName: varchar('customer_name', { length: 200 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 30 }),
  subject: varchar({ length: 200 }).notNull(),
  message: text().notNull(),
  referenceId: varchar('reference_id', { length: 64 }),
  referenceType: varchar('reference_type', { length: 20 }),
  status: varchar({ length: 20 }).default('new').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  notificationStatus: varchar('notification_status', { length: 20 }).default('pending').notNull(),
  notificationSentAt: timestamp('notification_sent_at', { withTimezone: true, mode: 'string' }),
  notificationError: text('notification_error'),
}, table => [
  index('customer_inquiries_customer_id_idx').using('btree', table.customerId.asc().nullsLast()),
  index('customer_inquiries_created_at_idx').using('btree', table.createdAt.asc().nullsLast()),
  index('customer_inquiries_notification_status_idx').using('btree', table.notificationStatus.asc().nullsLast()),
  index('customer_inquiries_status_idx').using('btree', table.status.asc().nullsLast()),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customers.id],
    name: 'customer_inquiries_customer_id_fk',
  }).onDelete('cascade'),
])
