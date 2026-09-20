/**
 * Werkstattaufträge
 *
 * Je Auftrag gibt es höchstens eine aktive Rechnung.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, date, numeric, integer, timestamp, index, uniqueIndex, foreignKey, text, unique, primaryKey, check } from 'drizzle-orm/pg-core'
import { oneOf } from './_checks.ts'
import { workOrderItemKinds, workOrderStatuses } from '../../../shared/domain.ts'
import { sql } from 'drizzle-orm'
import { calendarEntries } from './calendar.ts'
import { items } from './catalog.ts'
import { customers } from './customers.ts'
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
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
  scheduledDate: date('scheduled_date'),
  scheduledTime: varchar('scheduled_time', { length: 5 }),
}, table => [
  check('work_orders_status_check', oneOf(table.status, workOrderStatuses.values)),
  index('work_orders_created_at_idx').using('btree', table.createdAt.desc().nullsLast()),
  index('work_orders_vehicle_id_idx').using('btree', table.vehicleId.asc().nullsLast()),
  uniqueIndex('work_orders_appointment_id_idx').using('btree', table.appointmentId.asc().nullsLast()).where(sql`(appointment_id IS NOT NULL)`),
  index('work_orders_customer_id_idx').using('btree', table.customerId.asc().nullsLast()),
  index('work_orders_status_idx').using('btree', table.status.asc().nullsLast()),
  // M-38: Ein Auftrag trägt eine eigene Nummer und ist ein eigener Vorgang.
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customers.id],
    name: 'work_orders_customer_id_customers_id_fk',
  }).onDelete('no action'),
  foreignKey({
    columns: [table.vehicleId],
    foreignColumns: [vehicles.id],
    name: 'work_orders_vehicle_id_vehicles_id_fk',
  }).onDelete('no action'),
  foreignKey({
    columns: [table.appointmentId],
    foreignColumns: [calendarEntries.id],
    name: 'work_orders_appointment_id_calendar_entries_id_fk',
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
  unitPriceNet: integer('unit_price_net').notNull(),
  hours: numeric({ precision: 6, scale: 2 }),
  doneAt: date('done_at').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  check('work_order_items_kind_check', oneOf(table.kind, workOrderItemKinds.values)),
  index('work_order_items_item_id_idx').using('btree', table.itemId.asc().nullsLast()),
  index('work_order_items_work_order_id_idx').using('btree', table.workOrderId.asc().nullsLast()),
  foreignKey({
    columns: [table.workOrderId],
    foreignColumns: [workOrders.id],
    name: 'work_order_items_work_order_id_work_orders_id_fk',
  }).onDelete('no action'),
  foreignKey({
    columns: [table.itemId],
    foreignColumns: [items.id],
    name: 'work_order_items_item_id_items_id_fk',
  }).onDelete('set null'),
])

/**
 * Wer an einer Position gearbeitet hat (M-11).
 *
 * Beim Vorgänger hing die Position an **genau einem** Mitarbeiter, und zwar
 * sperrend. Das ging nicht auf: an einer Bremse arbeiten zwei, und wer die
 * Zuweisung auf den ganzen Auftrag legt, weiß hinterher nicht, wer was gemacht
 * hat. Die Position wird zur Rechnungszeile, also gehört die Zuweisung dorthin.
 */
export const workOrderItemAssignees = pgTable('work_order_item_assignees', {
  workOrderItemId: uuid('work_order_item_id').notNull(),
  employeeId: uuid('employee_id').notNull(),
}, table => [
  index('work_order_item_assignees_employee_id_idx').using('btree', table.employeeId.asc().nullsLast()),
  foreignKey({
    columns: [table.workOrderItemId],
    foreignColumns: [workOrderItems.id],
    name: 'work_order_item_assignees_work_order_item_id_fk',
  }).onDelete('no action'),
  // Ein Mitarbeiter wird deaktiviert, nicht gelöscht (M-12). Ginge er doch,
  // verschwände die Auskunft, wer die Arbeit gemacht hat.
  foreignKey({
    columns: [table.employeeId],
    foreignColumns: [employees.id],
    name: 'work_order_item_assignees_employee_id_fk',
  }).onDelete('no action'),
  primaryKey({ columns: [table.workOrderItemId, table.employeeId], name: 'work_order_item_assignees_pk' }),
])
