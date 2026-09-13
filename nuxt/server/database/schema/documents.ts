/**
 * Belege, Positionen, Zahlungen und Zahlungserinnerungen
 *
 * Ausgestellte Belege werden nie gelöscht; Korrekturen laufen über eine Stornierung.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, date, numeric, integer, timestamp, index, uniqueIndex, foreignKey, text, unique, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { bytea } from './_types.ts'
import { items, tires } from './catalog.ts'
import { customers } from './customers.ts'
import { workOrders } from './orders.ts'
import { vehicles } from './vehicles.ts'

export const documents = pgTable('documents', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  documentNumber: varchar('document_number', { length: 50 }).notNull(),
  legacyDocumentNumber: varchar('legacy_document_number', { length: 50 }),
  type: varchar({ length: 30 }).notNull(),
  status: varchar({ length: 30 }).default('created').notNull(),
  customerId: uuid('customer_id'),
  vehicleId: uuid('vehicle_id'),
  issueDate: date('issue_date').notNull(),
  serviceDate: date('service_date'),
  dueDate: date('due_date'),
  paymentMethod: varchar('payment_method', { length: 30 }),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('19.00').notNull(),
  netTotal: numeric('net_total', { precision: 12, scale: 2 }).default('0').notNull(),
  taxTotal: numeric('tax_total', { precision: 12, scale: 2 }).default('0').notNull(),
  grossTotal: numeric('gross_total', { precision: 12, scale: 2 }).default('0').notNull(),
  discountTotal: numeric('discount_total', { precision: 12, scale: 2 }).default('0').notNull(),
  header: text(),
  footer: text(),
  notes: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
  convertedToInvoiceId: uuid('converted_to_invoice_id'),
  reminderLevel: integer('reminder_level').default(0).notNull(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'string' }),
  cancellationReason: varchar('cancellation_reason', { length: 500 }),
  cancelledByDocumentId: uuid('cancelled_by_document_id'),
  cancelsDocumentId: uuid('cancels_document_id'),
  // Deferred reference: documents and work orders point at each other.
  // The thunk plus the explicit column type breaks the cycle for both the
  // module evaluation order and the type checker.
  workOrderId: uuid('work_order_id').references((): AnyPgColumn => workOrders.id, { onDelete: 'set null' }),
}, table => [
  index('documents_created_at_idx').using('btree', table.createdAt.desc().nullsLast()),
  index('documents_vehicle_id_idx').using('btree', table.vehicleId.asc().nullsLast()),
  index('documents_cancelled_by_idx').using('btree', table.cancelledByDocumentId.asc().nullsLast()),
  index('documents_cancels_idx').using('btree', table.cancelsDocumentId.asc().nullsLast()),
  index('documents_converted_to_invoice_idx').using('btree', table.convertedToInvoiceId.asc().nullsLast()),
  index('documents_customer_id_idx').using('btree', table.customerId.asc().nullsLast()),
  uniqueIndex('documents_document_number_idx').using('btree', table.documentNumber.asc().nullsLast()),
  index('documents_issue_date_idx').using('btree', table.issueDate.asc().nullsLast()),
  index('documents_type_status_idx').using('btree', table.type.asc().nullsLast(), table.status.asc().nullsLast()),
  index('documents_work_order_id_idx').using('btree', table.workOrderId.asc().nullsLast()),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customers.id],
    name: 'documents_customer_id_customers_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.vehicleId],
    foreignColumns: [vehicles.id],
    name: 'documents_vehicle_id_vehicles_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.cancelledByDocumentId],
    foreignColumns: [table.id],
    name: 'documents_cancelled_by_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.cancelsDocumentId],
    foreignColumns: [table.id],
    name: 'documents_cancels_fk',
  }).onDelete('set null'),
])

export const documentItems = pgTable('document_items', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  documentId: uuid('document_id').notNull(),
  positionNumber: integer('position_number').notNull(),
  kind: varchar({ length: 20 }).default('article').notNull(),
  itemId: uuid('item_id'),
  articleNumber: varchar('article_number', { length: 50 }),
  description: text().notNull(),
  quantity: numeric({ precision: 12, scale: 3 }).default('1').notNull(),
  unit: varchar({ length: 20 }),
  unitPriceNet: numeric('unit_price_net', { precision: 12, scale: 2 }).default('0').notNull(),
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).default('0').notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('19.00').notNull(),
  lineTotalNet: numeric('line_total_net', { precision: 12, scale: 2 }).default('0').notNull(),
  lineTotalGross: numeric('line_total_gross', { precision: 12, scale: 2 }).default('0').notNull(),
  tireId: uuid('tire_id'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  index('document_items_document_id_idx').using('btree', table.documentId.asc().nullsLast()),
  index('document_items_item_id_idx').using('btree', table.itemId.asc().nullsLast()),
  index('document_items_tire_idx').using('btree', table.tireId.asc().nullsLast()),
  foreignKey({
    columns: [table.documentId],
    foreignColumns: [documents.id],
    name: 'document_items_document_id_documents_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.itemId],
    foreignColumns: [items.id],
    name: 'document_items_item_id_items_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.tireId],
    foreignColumns: [tires.id],
    name: 'document_items_tire_id_fk',
  }).onDelete('set null'),
])

export const documentPayments = pgTable('document_payments', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  documentId: uuid('document_id').notNull(),
  paymentDate: date('payment_date').notNull(),
  amount: numeric({ precision: 12, scale: 2 }).notNull(),
  method: varchar({ length: 30 }),
  notes: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('document_payments_document_id_idx').using('btree', table.documentId.asc().nullsLast()),
  foreignKey({
    columns: [table.documentId],
    foreignColumns: [documents.id],
    name: 'document_payments_document_id_documents_id_fk',
  }).onDelete('cascade'),
])

export const documentPdfs = pgTable('document_pdfs', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  documentId: uuid('document_id').notNull(),
  inputHash: varchar('input_hash', { length: 64 }).notNull(),
  filename: varchar({ length: 200 }).notNull(),
  mime: varchar({ length: 50 }).default('application/pdf').notNull(),
  size: integer().notNull(),
  // TODO: failed to parse database type 'bytea'
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  uniqueIndex('document_pdfs_document_id_idx').using('btree', table.documentId.asc().nullsLast()),
  foreignKey({
    columns: [table.documentId],
    foreignColumns: [documents.id],
    name: 'document_pdfs_document_id_documents_id_fk',
  }).onDelete('cascade'),
])

export const reminders = pgTable('reminders', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  documentNumber: varchar('document_number', { length: 50 }).notNull(),
  invoiceId: uuid('invoice_id').notNull(),
  level: integer().notNull(),
  issueDate: date('issue_date').notNull(),
  dueDate: date('due_date').notNull(),
  status: varchar({ length: 20 }).default('open').notNull(),
  notes: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  index('reminders_invoice_id_idx').using('btree', table.invoiceId.asc().nullsLast()),
  uniqueIndex('reminders_invoice_level_idx').using('btree', table.invoiceId.asc().nullsLast(), table.level.asc().nullsLast()),
  index('reminders_status_idx').using('btree', table.status.asc().nullsLast()),
  foreignKey({
    columns: [table.invoiceId],
    foreignColumns: [documents.id],
    name: 'reminders_invoice_id_documents_id_fk',
  }).onDelete('cascade'),
  unique('reminders_document_number_unique').on(table.documentNumber),
])

export const reminderPdfs = pgTable('reminder_pdfs', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  reminderId: uuid('reminder_id').notNull(),
  inputHash: varchar('input_hash', { length: 64 }).notNull(),
  filename: varchar({ length: 200 }).notNull(),
  mime: varchar({ length: 50 }).default('application/pdf').notNull(),
  size: integer().notNull(),
  // TODO: failed to parse database type 'bytea'
  data: bytea('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  uniqueIndex('reminder_pdfs_reminder_id_idx').using('btree', table.reminderId.asc().nullsLast()),
  foreignKey({
    columns: [table.reminderId],
    foreignColumns: [reminders.id],
    name: 'reminder_pdfs_reminder_id_reminders_id_fk',
  }).onDelete('cascade'),
])
