/**
 * Reifeneinlagerung und Saison-Erinnerungen
 *
 * Das Protokoll je Kunde, Saison und Jahr macht den Erinnerungsversand wiederholsicher.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, date, numeric, integer, timestamp, index, uniqueIndex, foreignKey, text, unique, jsonb } from 'drizzle-orm/pg-core'
import { customers } from './customers.ts'
import { vehicles } from './vehicles.ts'

export const tireStorage = pgTable('tire_storage', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  storageNumber: varchar('storage_number', { length: 50 }).notNull(),
  customerId: uuid('customer_id').notNull(),
  vehicleId: uuid('vehicle_id'),
  brand: varchar({ length: 80 }),
  model: varchar({ length: 120 }),
  size: varchar({ length: 40 }),
  profileMm: numeric('profile_mm', { precision: 4, scale: 1 }),
  dotYear: integer('dot_year'),
  season: varchar({ length: 20 }),
  quantity: integer().default(4).notNull(),
  photos: jsonb().default([]).notNull(),
  notes: text(),
  storedAt: date('stored_at').defaultNow().notNull(),
  retrievedAt: date('retrieved_at'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('tire_storage_vehicle_id_idx').using('btree', table.vehicleId.asc().nullsLast()),
  index('tire_storage_active_idx').using('btree', table.retrievedAt.asc().nullsLast()),
  index('tire_storage_customer_id_idx').using('btree', table.customerId.asc().nullsLast()),
  uniqueIndex('tire_storage_storage_number_idx').using('btree', table.storageNumber.asc().nullsLast()),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customers.id],
    name: 'tire_storage_customer_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.vehicleId],
    foreignColumns: [vehicles.id],
    name: 'tire_storage_vehicle_id_fk',
  }).onDelete('set null'),
])

export const tireReminderLog = pgTable('tire_reminder_log', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  customerId: uuid('customer_id').notNull(),
  season: varchar({ length: 20 }).notNull(),
  year: integer().notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('tire_reminder_log_customer_id_idx').using('btree', table.customerId.asc().nullsLast()),
  index('tire_reminder_log_season_year_idx').using('btree', table.season.asc().nullsLast(), table.year.asc().nullsLast()),
  unique('tire_reminder_log_unique').on(table.customerId, table.season, table.year),
])
