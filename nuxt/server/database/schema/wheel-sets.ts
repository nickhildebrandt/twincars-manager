/**
 * Radsätze und Saison-Erinnerungen
 *
 * Der Reifenbereich besteht aus zwei Welten, die sich an genau einer Stelle
 * berühren. Im **Handel** stehen Reifen im Katalog, haben Preise, Fotos und
 * eBay-Angebote. Im **Service** hat der Kunde Radsätze, die zum Fahrzeug
 * gehören, gewechselt und eingelagert werden. Der Berührungspunkt: ein
 * gekaufter Satz wird beim Verkauf zum Radsatz und ist ab dann
 * Katalog-Vergangenheit.
 *
 * Der Radsatz löst die alte Reifeneinlagerung ab (M-17). Die hing am **Kunden**
 * und optional am Fahrzeug, ohne Verweis auf einen Reifen — und kannte nur
 * „eingelagert" oder „abgeholt". Ein Radsatz gehört zum **Fahrzeug** und ist
 * entweder montiert oder im Regal. Je Fahrzeug ist genau einer montiert
 * (P-03); ein Wechsel ist der Tausch der beiden Zustände.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, date, numeric, integer, timestamp, index, uniqueIndex, foreignKey, text, unique, jsonb, check } from 'drizzle-orm/pg-core'
import { oneOf, oneOfOrNull } from './_checks.ts'
import { reminderSeasons, tireSeasons, wheelSetStates } from '../../../shared/domain.ts'
import { vehicles } from './vehicles.ts'
import { tires } from './catalog.ts'

export const wheelSets = pgTable('wheel_sets', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  setNumber: varchar('set_number', { length: 50 }).notNull(),

  /** Der Radsatz gehört dem Fahrzeug, nicht dem Kunden (M-17). */
  vehicleId: uuid('vehicle_id').notNull(),

  /**
   * Der Katalogreifen, aus dem der Satz entstand — falls er hier gekauft wurde.
   * Leer bei Sätzen, die der Kunde mitbrachte.
   */
  tireId: uuid('tire_id'),

  /** Montiert oder eingelagert. Genau einer je Fahrzeug ist montiert (P-03). */
  state: varchar({ length: 20 }).default('eingelagert').notNull(),

  season: varchar({ length: 20 }),
  brand: varchar({ length: 80 }),
  model: varchar({ length: 120 }),
  size: varchar({ length: 40 }),
  profileMm: numeric('profile_mm', { precision: 4, scale: 1 }),
  dotYear: integer('dot_year'),
  quantity: integer().default(4).notNull(),

  /** Wo im Regal. Leer, solange der Satz am Auto ist. */
  storagePlace: varchar('storage_place', { length: 60 }),

  photos: jsonb().default([]).notNull(),
  notes: text(),

  /** Wann zuletzt gewechselt wurde — für den Zeitstrahl am Fahrzeug. */
  lastChangedAt: date('last_changed_at'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  check('wheel_sets_state_check', oneOf(table.state, wheelSetStates.values)),
  check('wheel_sets_season_check', oneOfOrNull(table.season, tireSeasons.values)),
  uniqueIndex('wheel_sets_set_number_idx').using('btree', table.setNumber.asc().nullsLast()),
  index('wheel_sets_vehicle_id_idx').using('btree', table.vehicleId.asc().nullsLast()),
  index('wheel_sets_state_idx').using('btree', table.state.asc().nullsLast()),
  index('wheel_sets_tire_id_idx').using('btree', table.tireId.asc().nullsLast()),
  foreignKey({
    columns: [table.vehicleId],
    foreignColumns: [vehicles.id],
    name: 'wheel_sets_vehicle_id_fk',
  }).onDelete('cascade'),
  // Der Katalogreifen darf verschwinden; Marke, Modell und Größe stehen als
  // eigene Kopie im Satz, wie bei einer Belegposition.
  foreignKey({
    columns: [table.tireId],
    foreignColumns: [tires.id],
    name: 'wheel_sets_tire_id_fk',
  }).onDelete('set null'),
])

/**
 * Wem wann zum Wechsel geschrieben wurde.
 *
 * Hing beim Vorgänger am **Kunden** — dann war unklar, welches Fahrzeug gemeint
 * ist, wenn jemand zwei hat. Sie hängt jetzt am Radsatz (M-19). Die
 * Eindeutigkeit je Satz, Saison und Jahr macht den Versand wiederholsicher:
 * zweimal ausgeführt schreibt er nichts doppelt.
 */
export const tireReminderLog = pgTable('tire_reminder_log', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  wheelSetId: uuid('wheel_set_id').notNull(),
  season: varchar({ length: 20 }).notNull(),
  year: integer().notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  check('tire_reminder_log_season_check', oneOf(table.season, reminderSeasons.values)),
  foreignKey({
    columns: [table.wheelSetId],
    foreignColumns: [wheelSets.id],
    name: 'tire_reminder_log_wheel_set_id_fk',
  }).onDelete('cascade'),
  index('tire_reminder_log_wheel_set_id_idx').using('btree', table.wheelSetId.asc().nullsLast()),
  index('tire_reminder_log_season_year_idx').using('btree', table.season.asc().nullsLast(), table.year.asc().nullsLast()),
  unique('tire_reminder_log_unique').on(table.wheelSetId, table.season, table.year),
])
