/**
 * Kalender
 *
 * Eine Tabelle für Termine und Betriebsschließungen; Feiertage werden gerechnet, nicht gespeichert.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, boolean, timestamp, index, foreignKey, text, check } from 'drizzle-orm/pg-core'
import { oneOf, oneOfOrNull } from './_checks.ts'
import { appointmentStatuses, calendarKinds } from '../../../shared/domain.ts'
import { customers } from './customers.ts'
import { employees } from './employees.ts'
import { vehicles } from './vehicles.ts'

export const calendarEntries = pgTable('calendar_entries', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  kind: varchar({ length: 20 }).notNull(),
  title: varchar({ length: 200 }).notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true, mode: 'string' }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true, mode: 'string' }).notNull(),
  allDay: boolean('all_day').default(false).notNull(),
  status: varchar({ length: 20 }),
  customerId: uuid('customer_id'),
  vehicleId: uuid('vehicle_id'),
  employeeId: uuid('employee_id'),
  notes: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  check('calendar_entries_kind_check', oneOf(table.kind, calendarKinds.values)),
  check('calendar_entries_status_check', oneOfOrNull(table.status, appointmentStatuses.values)),
  index('calendar_entries_customer_id_idx').using('btree', table.customerId.asc().nullsLast()),
  index('calendar_entries_employee_id_idx').using('btree', table.employeeId.asc().nullsLast()),
  index('calendar_entries_vehicle_id_idx').using('btree', table.vehicleId.asc().nullsLast()),
  index('calendar_entries_kind_idx').using('btree', table.kind.asc().nullsLast()),
  index('calendar_entries_starts_at_idx').using('btree', table.startsAt.asc().nullsLast()),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customers.id],
    name: 'calendar_entries_customer_id_customers_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.vehicleId],
    foreignColumns: [vehicles.id],
    name: 'calendar_entries_vehicle_id_vehicles_id_fk',
  }).onDelete('no action'),
  foreignKey({
    columns: [table.employeeId],
    foreignColumns: [employees.id],
    name: 'calendar_entries_employee_id_employees_id_fk',
  }).onDelete('no action'),
])
