/**
 * Artikel, Leistungen und Reifenkatalog
 *
 * Preise liegen in Versionstabellen; Belege halten ihren eigenen Preis-Schnappschuss.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, date, integer, boolean, timestamp, index, uniqueIndex, foreignKey, text, check } from 'drizzle-orm/pg-core'
import { oneOf } from './_checks.ts'
import { itemKinds, tireConstructions, tireSeasons } from '../../../shared/domain.ts'

export const items = pgTable('items', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  legacyItemNumber: varchar('legacy_item_number', { length: 50 }),
  articleNumber: varchar('article_number', { length: 50 }).notNull(),
  description: text().notNull(),
  kind: varchar({ length: 20 }).default('article').notNull(),
  unit: varchar({ length: 20 }),
  purchasePriceNet: integer('purchase_price_net'),
  stockOnHand: integer('stock_on_hand').default(0).notNull(),
  notes: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
  onlineBookable: boolean('online_bookable').default(false).notNull(),
}, table => [
  check('items_kind_check', oneOf(table.kind, itemKinds.values)),
  index('items_created_at_idx').using('btree', table.createdAt.desc().nullsLast()),
  uniqueIndex('items_article_number_idx').using('btree', table.articleNumber.asc().nullsLast()),
  index('items_kind_idx').using('btree', table.kind.asc().nullsLast()),
])

export const itemPriceVersions = pgTable('item_price_versions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  itemId: uuid('item_id').notNull(),
  validFrom: date('valid_from').notNull(),
  unitPriceNet: integer('unit_price_net').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  uniqueIndex('item_price_versions_item_from_idx').using('btree', table.itemId.asc().nullsLast(), table.validFrom.asc().nullsLast()),
  index('item_price_versions_item_idx').using('btree', table.itemId.asc().nullsLast()),
  foreignKey({
    columns: [table.itemId],
    foreignColumns: [items.id],
    name: 'item_price_versions_item_id_items_id_fk',
  }).onDelete('cascade'),
])

export const tires = pgTable('tires', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  articleNumber: varchar('article_number', { length: 50 }).notNull(),
  legacyArticleNumber: varchar('legacy_article_number', { length: 50 }),
  brand: varchar({ length: 80 }).notNull(),
  model: varchar({ length: 120 }).notNull(),
  width: integer().notNull(),
  aspectRatio: integer('aspect_ratio').notNull(),
  construction: varchar({ length: 5 }).default('R').notNull(),
  diameterInch: integer('diameter_inch').notNull(),
  loadIndex: varchar('load_index', { length: 10 }),
  speedIndex: varchar('speed_index', { length: 5 }),
  season: varchar({ length: 20 }).notNull(),
  ean: varchar({ length: 20 }),
  manufacturerPartNumber: varchar('manufacturer_part_number', { length: 50 }),
  fuelEfficiency: varchar('fuel_efficiency', { length: 1 }),
  wetGrip: varchar('wet_grip', { length: 1 }),
  noiseClass: varchar('noise_class', { length: 1 }),
  noiseDb: integer('noise_db'),
  runFlat: boolean('run_flat').default(false).notNull(),
  reinforced: boolean().default(false).notNull(),
  studdedWinter: boolean('studded_winter').default(false).notNull(),
  mSMarking: boolean('m_s_marking').default(false).notNull(),
  snowFlake: boolean('snow_flake').default(false).notNull(),
  evCertified: boolean('ev_certified').default(false).notNull(),
  description: text(),
  purchasePriceNet: integer('purchase_price_net'),
  stockOnHand: integer('stock_on_hand').default(0).notNull(),
  onlineSellable: boolean('online_sellable').default(false).notNull(),
  notes: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  check('tires_season_check', oneOf(table.season, tireSeasons.values)),
  check('tires_construction_check', oneOf(table.construction, tireConstructions.values)),
  index('tires_created_at_idx').using('btree', table.createdAt.desc().nullsLast()),
  uniqueIndex('tires_article_number_idx').using('btree', table.articleNumber.asc().nullsLast()),
  index('tires_brand_idx').using('btree', table.brand.asc().nullsLast()),
  index('tires_online_sellable_idx').using('btree', table.onlineSellable.asc().nullsLast()),
  index('tires_season_idx').using('btree', table.season.asc().nullsLast()),
  index('tires_size_idx').using('btree', table.width.asc().nullsLast(), table.aspectRatio.asc().nullsLast(), table.diameterInch.asc().nullsLast()),
])

export const tirePriceVersions = pgTable('tire_price_versions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tireId: uuid('tire_id').notNull(),
  validFrom: date('valid_from').notNull(),
  unitPriceNet: integer('unit_price_net').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  uniqueIndex('tire_price_versions_tire_from_idx').using('btree', table.tireId.asc().nullsLast(), table.validFrom.asc().nullsLast()),
  foreignKey({
    columns: [table.tireId],
    foreignColumns: [tires.id],
    name: 'tire_price_versions_tire_id_fk',
  }).onDelete('cascade'),
])

export const tirePhotos = pgTable('tire_photos', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tireId: uuid('tire_id').notNull(),
  mime: varchar({ length: 50 }).notNull(),
  data: text().notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  isMain: boolean('is_main').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('tire_photos_tire_idx').using('btree', table.tireId.asc().nullsLast()),
  foreignKey({
    columns: [table.tireId],
    foreignColumns: [tires.id],
    name: 'tire_photos_tire_id_fk',
  }).onDelete('cascade'),
])
