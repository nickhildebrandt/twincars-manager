/**
 * eBay-Anbindung und Legacy-Import
 *
 * Zugangsdaten liegen verschlüsselt; der Importlauf wird protokolliert.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, integer, timestamp, index, uniqueIndex, foreignKey, text, jsonb, check } from 'drizzle-orm/pg-core'
import { oneOf } from './_checks.ts'
import { ebayEnvironments, ebayListingStatuses, importRunStatuses } from '../../../shared/domain.ts'
import { sql } from 'drizzle-orm'
import { tires } from './catalog.ts'

export const ebayCredentials = pgTable('ebay_credentials', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  ebayUsername: varchar('ebay_username', { length: 100 }),
  accessToken: text('access_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true, mode: 'string' }),
  refreshToken: text('refresh_token').notNull(),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true, mode: 'string' }),
  scopes: text().default('').notNull(),
  environment: varchar({ length: 20 }).default('production').notNull(),
  connectedAt: timestamp('connected_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  check('ebay_credentials_environment_check', oneOf(table.environment, ebayEnvironments.values)),
  uniqueIndex('ebay_credentials_singleton').using('btree', sql`((true))`),
])

export const ebayListings = pgTable('ebay_listings', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  ebayItemId: varchar('ebay_item_id', { length: 30 }).notNull(),
  sku: varchar({ length: 80 }),
  title: varchar({ length: 255 }).notNull(),
  priceValue: integer('price_value'),
  priceCurrency: varchar('price_currency', { length: 3 }),
  quantityAvailable: integer('quantity_available'),
  quantitySold: integer('quantity_sold'),
  listingType: varchar('listing_type', { length: 30 }),
  status: varchar({ length: 20 }).default('active').notNull(),
  viewItemUrl: text('view_item_url'),
  galleryUrl: text('gallery_url'),
  pictureUrls: jsonb('picture_urls').default([]),
  startTime: timestamp('start_time', { withTimezone: true, mode: 'string' }),
  endTime: timestamp('end_time', { withTimezone: true, mode: 'string' }),
  environment: varchar({ length: 20 }).default('production').notNull(),
  tireId: uuid('tire_id'),
  firstImportedAt: timestamp('first_imported_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  check('ebay_listings_status_check', oneOf(table.status, ebayListingStatuses.values)),
  check('ebay_listings_environment_check', oneOf(table.environment, ebayEnvironments.values)),
  index('ebay_listings_tire_id_idx').using('btree', table.tireId.asc().nullsLast()),
  uniqueIndex('ebay_listings_env_item_idx').using('btree', table.environment.asc().nullsLast(), table.ebayItemId.asc().nullsLast()),
  index('ebay_listings_status_idx').using('btree', table.status.asc().nullsLast()),
  foreignKey({
    columns: [table.tireId],
    foreignColumns: [tires.id],
    name: 'ebay_listings_tire_id_tires_id_fk',
  }).onDelete('set null'),
])

export const ebayImportRuns = pgTable('ebay_import_runs', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
  status: varchar({ length: 20 }).default('running').notNull(),
  imported: integer().default(0).notNull(),
  updated: integer().default(0).notNull(),
  ended: integer().default(0).notNull(),
  failed: integer().default(0).notNull(),
  totalActive: integer('total_active').default(0).notNull(),
  error: text(),
  environment: varchar({ length: 20 }).default('production').notNull(),
}, table => [
  check('ebay_import_runs_status_check', oneOf(table.status, importRunStatuses.values)),
  check('ebay_import_runs_environment_check', oneOf(table.environment, ebayEnvironments.values)),
])

export const accessImportJobs = pgTable('access_import_jobs', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
  status: varchar({ length: 20 }).default('running').notNull(),
  tablesProcessed: integer('tables_processed').default(0).notNull(),
  rowsImported: integer('rows_imported').default(0).notNull(),
  rowsSkipped: integer('rows_skipped').default(0).notNull(),
  notes: text(),
  progress: integer().default(0).notNull(),
  progressLabel: varchar('progress_label', { length: 200 }),
}, table => [
  check('access_import_jobs_status_check', oneOf(table.status, importRunStatuses.values)),
])
