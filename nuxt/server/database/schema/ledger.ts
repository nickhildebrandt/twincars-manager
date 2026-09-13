/**
 * Buchhaltung
 *
 * Eine Tabelle für alle Bewegungen, kategorisiert über die geseedeten Kategorien.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, date, numeric, timestamp, index, foreignKey, text, unique, integer, check } from 'drizzle-orm/pg-core'
import { oneOf, oneOfOrNull } from './_checks.ts'
import { ledgerDirections, ledgerPaymentStatuses, ledgerSources, paymentMethods } from '../../../shared/domain.ts'
import { customers, suppliers } from './customers.ts'
import { documents } from './documents.ts'

export const ledgerCategories = pgTable('ledger_categories', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  direction: varchar({ length: 10 }).notNull(),
  name: varchar({ length: 100 }).notNull(),
  defaultTaxRate: numeric('default_tax_rate', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  check('ledger_categories_direction_check', oneOf(table.direction, ledgerDirections.values)),
  unique('ledger_categories_name_unique').on(table.name),
])

export const ledgerEntries = pgTable('ledger_entries', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  entryNumber: varchar('entry_number', { length: 50 }),
  direction: varchar({ length: 10 }).notNull(),
  entryDate: date('entry_date').notNull(),
  amountGross: integer('amount_gross').notNull(),
  amountNet: integer('amount_net').notNull(),
  taxAmount: integer('tax_amount').default(0).notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('19.00').notNull(),
  categoryId: uuid('category_id'),
  description: text().notNull(),
  paymentMethod: varchar('payment_method', { length: 30 }),
  paymentStatus: varchar('payment_status', { length: 20 }).default('paid').notNull(),
  supplierId: uuid('supplier_id'),
  customerId: uuid('customer_id'),
  documentId: uuid('document_id'),
  source: varchar({ length: 30 }).default('manual').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  check('ledger_entries_direction_check', oneOf(table.direction, ledgerDirections.values)),
  check('ledger_entries_payment_status_check', oneOf(table.paymentStatus, ledgerPaymentStatuses.values)),
  check('ledger_entries_payment_method_check', oneOfOrNull(table.paymentMethod, paymentMethods.values)),
  check('ledger_entries_source_check', oneOf(table.source, ledgerSources.values)),
  index('ledger_entries_customer_id_idx').using('btree', table.customerId.asc().nullsLast()),
  index('ledger_entries_document_id_idx').using('btree', table.documentId.asc().nullsLast()),
  index('ledger_entries_supplier_id_idx').using('btree', table.supplierId.asc().nullsLast()),
  index('ledger_entries_category_id_idx').using('btree', table.categoryId.asc().nullsLast()),
  index('ledger_entries_direction_idx').using('btree', table.direction.asc().nullsLast()),
  index('ledger_entries_entry_date_idx').using('btree', table.entryDate.asc().nullsLast()),
  foreignKey({
    columns: [table.categoryId],
    foreignColumns: [ledgerCategories.id],
    name: 'ledger_entries_category_id_ledger_categories_id_fk',
  }).onDelete('no action'),
  foreignKey({
    columns: [table.supplierId],
    foreignColumns: [suppliers.id],
    name: 'ledger_entries_supplier_id_suppliers_id_fk',
  }).onDelete('no action'),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customers.id],
    name: 'ledger_entries_customer_id_customers_id_fk',
  }).onDelete('no action'),
  foreignKey({
    columns: [table.documentId],
    foreignColumns: [documents.id],
    name: 'ledger_entries_document_id_documents_id_fk',
  }).onDelete('no action'),
])
