/**
 * Werkstattaufträge
 *
 * Je Auftrag gibt es höchstens eine aktive Rechnung.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, date, numeric, integer, timestamp, index, uniqueIndex, foreignKey, text, unique, primaryKey } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { calendarEntries } from './calendar.ts'
import { items } from './catalog.ts'
import { customers } from './customers.ts'
import { documents } from './documents.ts'
import { employees } from './employees.ts'
import { vehicles } from './vehicles.ts'

export const workOrders = pgTable('work_orders', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  orderNumber: varchar('order_number', { length: 50 }).notNull(),
  title: varchar({ length: 200 }).notNull(),
  description: text(),
  status: varchar({ length: 20 }).default('open').notNull(),
  customerId: uuid('customer_id'),
  vehicleId: uuid('vehicle_id'),
  appointmentId: uuid('appointment_id'),
  invoiceId: uuid('invoice_id'),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
  scheduledDate: date('scheduled_date'),
  scheduledTime: varchar('scheduled_time', { length: 5 }),
}, table => [
  index('work_orders_created_at_idx').using('btree', table.createdAt.desc().nullsLast()),
  index('work_orders_vehicle_id_idx').using('btree', table.vehicleId.asc().nullsLast()),
  uniqueIndex('work_orders_appointment_id_idx').using('btree', table.appointmentId.asc().nullsLast()).where(sql`(appointment_id IS NOT NULL)`),
  index('work_orders_customer_id_idx').using('btree', table.customerId.asc().nullsLast()),
  index('work_orders_invoice_id_idx').using('btree', table.invoiceId.asc().nullsLast()),
  index('work_orders_status_idx').using('btree', table.status.asc().nullsLast()),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customers.id],
    name: 'work_orders_customer_id_customers_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.vehicleId],
    foreignColumns: [vehicles.id],
    name: 'work_orders_vehicle_id_vehicles_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.appointmentId],
    foreignColumns: [calendarEntries.id],
    name: 'work_orders_appointment_id_calendar_entries_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.invoiceId],
    foreignColumns: [documents.id],
    name: 'work_orders_invoice_id_documents_id_fk',
  }).onDelete('set null'),
  unique('work_orders_order_number_unique').on(table.orderNumber),
])

export const workOrderItems = pgTable('work_order_items', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  workOrderId: uuid('work_order_id').notNull(),
  position: integer().notNull(),
  kind: varchar({ length: 20 }).default('labor').notNull(),
  itemId: uuid('item_id'),
  description: text().notNull(),
  quantity: numeric({ precision: 12, scale: 3 }).default('1').notNull(),
  unit: varchar({ length: 20 }),
  unitPriceNet: numeric('unit_price_net', { precision: 12, scale: 2 }).notNull(),
  employeeId: uuid('employee_id'),
  hours: numeric({ precision: 6, scale: 2 }),
  doneAt: date('done_at').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  index('work_order_items_employee_id_idx').using('btree', table.employeeId.asc().nullsLast()),
  index('work_order_items_item_id_idx').using('btree', table.itemId.asc().nullsLast()),
  index('work_order_items_work_order_id_idx').using('btree', table.workOrderId.asc().nullsLast()),
  foreignKey({
    columns: [table.workOrderId],
    foreignColumns: [workOrders.id],
    name: 'work_order_items_work_order_id_work_orders_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.itemId],
    foreignColumns: [items.id],
    name: 'work_order_items_item_id_items_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.employeeId],
    foreignColumns: [employees.id],
    name: 'work_order_items_employee_id_employees_id_fk',
  }).onDelete('set null'),
])

export const workOrderAssignees = pgTable('work_order_assignees', {
  workOrderId: uuid('work_order_id').notNull(),
  employeeId: uuid('employee_id').notNull(),
}, table => [
  index('work_order_assignees_employee_id_idx').using('btree', table.employeeId.asc().nullsLast()),
  foreignKey({
    columns: [table.workOrderId],
    foreignColumns: [workOrders.id],
    name: 'work_order_assignees_work_order_id_work_orders_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.employeeId],
    foreignColumns: [employees.id],
    name: 'work_order_assignees_employee_id_employees_id_fk',
  }).onDelete('cascade'),
  primaryKey({ columns: [table.workOrderId, table.employeeId], name: 'work_order_assignees_work_order_id_employee_id_pk' }),
])
