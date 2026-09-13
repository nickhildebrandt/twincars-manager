/**
 * Fahrzeuge, Bestand und Fahrzeugunterlagen
 *
 * Ein Fahrzeug ohne Kunde ist ein Bestandsfahrzeug. Kennzeichen sind versioniert, damit alte Belege ihr damaliges Kennzeichen behalten.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, date, integer, boolean, timestamp, index, uniqueIndex, foreignKey, text, jsonb } from 'drizzle-orm/pg-core'
import { documents } from './documents.ts'
import { bytea } from './_types.ts'
import { customers } from './customers.ts'

export const vehicles = pgTable('vehicles', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  customerId: uuid('customer_id'),
  legacyVehicleId: varchar('legacy_vehicle_id', { length: 50 }),
  make: varchar({ length: 100 }),
  model: varchar({ length: 150 }),
  vin: varchar({ length: 25 }),
  firstRegistration: date('first_registration'),
  mileageKm: integer('mileage_km'),
  nextHu: date('next_hu'),
  nextAu: date('next_au'),
  hsn: varchar({ length: 10 }),
  tsn: varchar({ length: 10 }),
  displacementCcm: integer('displacement_ccm'),
  powerKw: integer('power_kw'),
  colorCode: varchar('color_code', { length: 30 }),
  engineNumber: varchar('engine_number', { length: 50 }),
  fuelType: varchar('fuel_type', { length: 30 }),
  gearbox: varchar({ length: 30 }),
  bodyType: varchar('body_type', { length: 50 }),
  notes: text(),
  archived: boolean().default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
  previousOwnerCustomerId: uuid('previous_owner_customer_id'),
}, table => [
  index('vehicles_created_at_idx').using('btree', table.createdAt.desc().nullsLast()),
  index('vehicles_previous_owner_customer_id_idx').using('btree', table.previousOwnerCustomerId.asc().nullsLast()),
  index('vehicles_customer_id_idx').using('btree', table.customerId.asc().nullsLast()),
  index('vehicles_next_hu_idx').using('btree', table.nextHu.asc().nullsLast()),
  index('vehicles_vin_idx').using('btree', table.vin.asc().nullsLast()),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customers.id],
    name: 'vehicles_customer_id_customers_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.previousOwnerCustomerId],
    foreignColumns: [customers.id],
    name: 'vehicles_previous_owner_customer_id_customers_id_fk',
  }).onDelete('set null'),
])

export const vehicleLicensePlateVersions = pgTable('vehicle_license_plate_versions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  vehicleId: uuid('vehicle_id').notNull(),
  validFrom: date('valid_from').notNull(),
  licensePlate: varchar('license_plate', { length: 20 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('vehicle_license_plate_versions_plate_idx').using('btree', table.licensePlate.asc().nullsLast()),
  uniqueIndex('vehicle_license_plate_versions_veh_from_idx').using('btree', table.vehicleId.asc().nullsLast(), table.validFrom.asc().nullsLast()),
  index('vehicle_license_plate_versions_vehicle_idx').using('btree', table.vehicleId.asc().nullsLast()),
  foreignKey({
    columns: [table.vehicleId],
    foreignColumns: [vehicles.id],
    name: 'vehicle_license_plate_versions_vehicle_id_vehicles_id_fk',
  }).onDelete('cascade'),
])

export const vehiclePurchases = pgTable('vehicle_purchases', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  vehicleId: uuid('vehicle_id').notNull(),
  purchaseDate: date('purchase_date').notNull(),
  purchasePrice: integer('purchase_price').notNull(),
  previousOwner: varchar('previous_owner', { length: 200 }),
  notes: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('vehicle_purchases_vehicle_id_idx').using('btree', table.vehicleId.asc().nullsLast()),
  foreignKey({
    columns: [table.vehicleId],
    foreignColumns: [vehicles.id],
    name: 'vehicle_purchases_vehicle_id_vehicles_id_fk',
  }).onDelete('cascade'),
])

export const vehicleSales = pgTable('vehicle_sales', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  vehicleId: uuid('vehicle_id').notNull(),
  customerId: uuid('customer_id').notNull(),
  invoiceId: uuid('invoice_id'),
  saleDate: date('sale_date').notNull(),
  salesPriceGross: integer('sales_price_gross').notNull(),
  notes: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('vehicle_sales_invoice_id_idx').using('btree', table.invoiceId.asc().nullsLast()),
  foreignKey({
    columns: [table.invoiceId],
    foreignColumns: [documents.id],
    name: 'vehicle_sales_invoice_id_fk',
  }).onDelete('set null'),
  index('vehicle_sales_customer_id_idx').using('btree', table.customerId.asc().nullsLast()),
  index('vehicle_sales_vehicle_id_idx').using('btree', table.vehicleId.asc().nullsLast()),
  foreignKey({
    columns: [table.vehicleId],
    foreignColumns: [vehicles.id],
    name: 'vehicle_sales_vehicle_id_vehicles_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customers.id],
    name: 'vehicle_sales_customer_id_customers_id_fk',
  }).onDelete('cascade'),
])

export const vehicleListings = pgTable('vehicle_listings', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  vehicleId: uuid('vehicle_id').notNull(),
  status: varchar({ length: 20 }).default('available').notNull(),
  salesPriceGross: integer('sales_price_gross'),
  differentialTax: boolean('differential_tax').default(false).notNull(),
  /** Ausstattungsmerkmale als Liste, z. B. „Klimaanlage". */
  equipment: jsonb().$type<string[]>().default([]),
  highlights: text(),
  location: varchar({ length: 100 }),
  /** Nur intern sichtbar — erscheint in keinem Inserat und keiner Schnittstelle. */
  internalNotes: text('internal_notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  uniqueIndex('vehicle_listings_vehicle_unique').using('btree', table.vehicleId.asc().nullsLast()),
  foreignKey({
    columns: [table.vehicleId],
    foreignColumns: [vehicles.id],
    name: 'vehicle_listings_vehicle_id_vehicles_id_fk',
  }).onDelete('cascade'),
])

export const vehiclePhotos = pgTable('vehicle_photos', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  vehicleId: uuid('vehicle_id').notNull(),
  mime: varchar({ length: 50 }).notNull(),
  dataUrl: text('data_url').notNull(),
  isMain: boolean('is_main').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('vehicle_photos_vehicle_id_idx').using('btree', table.vehicleId.asc().nullsLast()),
  foreignKey({
    columns: [table.vehicleId],
    foreignColumns: [vehicles.id],
    name: 'vehicle_photos_vehicle_id_vehicles_id_fk',
  }).onDelete('cascade'),
])

export const vehicleDocuments = pgTable('vehicle_documents', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  vehicleId: uuid('vehicle_id').notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mime: varchar({ length: 100 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  // TODO: failed to parse database type 'bytea'
  data: bytea('data').notNull(),
  note: varchar({ length: 500 }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  index('vehicle_documents_vehicle_id_idx').using('btree', table.vehicleId.asc().nullsLast()),
  foreignKey({
    columns: [table.vehicleId],
    foreignColumns: [vehicles.id],
    name: 'vehicle_documents_vehicle_id_vehicles_id_fk',
  }).onDelete('cascade'),
])
