/**
 * Fahrzeuge, Bestand und Fahrzeugunterlagen
 *
 * Ein Fahrzeug überlebt seinen Halter (M-05): der Verweis auf den Kunden
 * sperrt, statt mitzulöschen, und ein Statusfeld sagt, was das Fahrzeug für den
 * Betrieb ist. Kennzeichen und Halter sind versioniert, damit alte Belege ihren
 * damaligen Stand behalten.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, date, integer, boolean, timestamp, index, uniqueIndex, foreignKey, text, jsonb, check } from 'drizzle-orm/pg-core'
import { oneOf } from './_checks.ts'
import { listingStatuses, ownerChangeReasons, vehicleExitKinds, vehicleStatuses } from '../../../shared/domain.ts'
import { documents } from './documents.ts'
import { bytea } from './_types.ts'
import { customers } from './customers.ts'
import { sql } from 'drizzle-orm'

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
  /**
   * Was das Fahrzeug für den Betrieb ist (M-05): Kundenfahrzeug, im Bestand
   * oder verkauft. In allen drei Fällen bleiben die Daten vollständig.
   */
  status: varchar({ length: 20 }).default('kundenfahrzeug').notNull(),
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
  check('vehicles_status_check', oneOf(table.status, vehicleStatuses.values)),
  index('vehicles_status_idx').using('btree', table.status.asc().nullsLast()),
  // M-05: Das Fahrzeug überlebt den Kunden. Es zu löschen, weil sein Halter
  // geht, wäre Datenverlust — ein Auto ohne Halter ist kein Fehler.
  // M-38: Ein Verkauf ist ein Geldvorgang. Er verschwindet nie.
  // M-38: Der Ankauf ist ein Geldvorgang und geht nicht mit dem Fahrzeug.
  // M-38: Der Verkauf ebenso.
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customers.id],
    name: 'vehicles_customer_id_customers_id_fk',
  }).onDelete('no action'),
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
  }).onDelete('no action'),
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
  }).onDelete('no action'),
])

/**
 * Der Abgang eines Fahrzeugs — und wohin es ging (M-43).
 *
 * Bisher stand hier ein Kunde, und zwar zwingend. Ein Fahrzeug, das an einen
 * Händler geht, exportiert oder verwertet wird, hatte damit keinen Abgang,
 * den man hätte aufschreiben können — es hörte einfach auf, eine Geschichte zu
 * haben.
 *
 * Jetzt sagt `exit_kind`, **wohin** es ging, und der Kunde ist nur noch einer
 * von fünf Fällen. Name und Anschrift des Käufers stehen zusätzlich als
 * Abschrift daneben: sie überleben ein gelöschtes Kundenkonto und den Fall,
 * dass es nie eines gab.
 */
export const vehicleSales = pgTable('vehicle_sales', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  vehicleId: uuid('vehicle_id').notNull(),
  /** Nur beim Verkauf an einen Kunden gesetzt. */
  customerId: uuid('customer_id'),
  /** Wohin das Fahrzeug ging. */
  exitKind: varchar('exit_kind', { length: 20 }).default('kunde').notNull(),
  /** Name des Käufers zum Zeitpunkt des Verkaufs — auch ohne Kundenkonto. */
  buyerName: varchar('buyer_name', { length: 200 }),
  /** Anschrift des Käufers, einzeilig abgeschrieben. */
  buyerAddress: varchar('buyer_address', { length: 400 }),
  /** Wo das Fahrzeug geblieben ist, in Worten — „Export nach Polen". */
  destination: varchar({ length: 200 }),
  invoiceId: uuid('invoice_id'),
  saleDate: date('sale_date').notNull(),
  salesPriceGross: integer('sales_price_gross').notNull(),
  notes: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  check('vehicle_sales_exit_kind_check', oneOf(table.exitKind, vehicleExitKinds.values)),
  // Ein Verkauf an einen Kunden ohne Kunden wäre keiner. Jeder andere Abgang
  // hat keinen — deshalb die Bedingung und kein `notNull`.
  check('vehicle_sales_customer_check', sql`${table.exitKind} <> 'kunde' OR ${table.customerId} IS NOT NULL`),
  index('vehicle_sales_exit_kind_idx').using('btree', table.exitKind.asc().nullsLast()),
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
  }).onDelete('no action'),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customers.id],
    name: 'vehicle_sales_customer_id_customers_id_fk',
  }).onDelete('no action'),
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
  check('vehicle_listings_status_check', oneOf(table.status, listingStatuses.values)),
  uniqueIndex('vehicle_listings_vehicle_unique').using('btree', table.vehicleId.asc().nullsLast()),
  foreignKey({
    columns: [table.vehicleId],
    foreignColumns: [vehicles.id],
    name: 'vehicle_listings_vehicle_id_vehicles_id_fk',
  }).onDelete('no action'),
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
  }).onDelete('no action'),
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
  }).onDelete('no action'),
])

/**
 * Wer wann Halter war (M-06).
 *
 * Neben der Kennzeichenhistorie die zweite Zeitleiste am Fahrzeug. `bis` bleibt
 * offen, solange der Eintrag der aktuelle ist.
 */
export const vehicleOwnerHistory = pgTable('vehicle_owner_history', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  vehicleId: uuid('vehicle_id').notNull(),
  customerId: uuid('customer_id'),
  /** Name zum Zeitpunkt des Halterwechsels — überlebt ein gelöschtes Konto. */
  customerName: varchar('customer_name', { length: 200 }),
  /**
   * Anschrift zum Zeitpunkt des Halterwechsels (M-43).
   *
   * Der Name allein beantwortet nicht, **wo** das Fahrzeug damals stand. Zieht
   * der Halter später um, sagt der Kundendatensatz die neue Anschrift — und
   * die stimmte für diesen Zeitraum nie.
   */
  customerAddress: varchar('customer_address', { length: 400 }),
  /**
   * Warum gewechselt wurde (M-43).
   *
   * Ohne den Grund liest sich jede Zeile gleich, egal ob der Betrieb das
   * Fahrzeug angekauft, verkauft oder nur einen Tippfehler geradegezogen hat.
   */
  reason: varchar({ length: 20 }).default('halterwechsel').notNull(),
  /** Der Beleg, aus dem der Wechsel hervorging — eine Kaufrechnung etwa. */
  documentId: uuid('document_id'),
  ownerFrom: date('owner_from').notNull(),
  ownerUntil: date('owner_until'),
  note: varchar({ length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  check('vehicle_owner_history_reason_check', oneOf(table.reason, ownerChangeReasons.values)),
  // Ein Zeitraum, der vor seinem Beginn endet, ist keiner.
  check('vehicle_owner_history_period_check', sql`${table.ownerUntil} IS NULL OR ${table.ownerUntil} >= ${table.ownerFrom}`),
  index('vehicle_owner_history_document_id_idx').using('btree', table.documentId.asc().nullsLast()),
  index('vehicle_owner_history_vehicle_id_idx').using('btree', table.vehicleId.asc().nullsLast(), table.ownerFrom.desc().nullsLast()),
  index('vehicle_owner_history_customer_id_idx').using('btree', table.customerId.asc().nullsLast()),
  foreignKey({
    columns: [table.vehicleId],
    foreignColumns: [vehicles.id],
    name: 'vehicle_owner_history_vehicle_id_fk',
  }).onDelete('no action'),
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customers.id],
    name: 'vehicle_owner_history_customer_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.documentId],
    foreignColumns: [documents.id],
    name: 'vehicle_owner_history_document_id_fk',
  }).onDelete('no action'),
])
