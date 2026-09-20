/**
 * Belege, Positionen, Zahlungen und Zahlungserinnerungen
 *
 * Ausgestellte Belege werden nie gelöscht; Korrekturen laufen über eine Stornierung.
 *
 * Erzeugt aus dem Stand des Vorgängersystems (38 Migrationen) und in
 * Domänen aufgeteilt. Änderungen laufen über eine neue Migration, nie durch
 * Bearbeiten einer angewendeten (../../../../docs/rewrite/03-architektur.md §7).
 */
import { pgTable, uuid, varchar, date, numeric, integer, boolean, timestamp, index, uniqueIndex, foreignKey, text, unique, jsonb, type AnyPgColumn, check } from 'drizzle-orm/pg-core'
import { notNegative, oneOf, oneOfOrNull } from './_checks.ts'
import { documentStatuses, documentTypes, itemLineKinds, paymentMethods, reminderStatuses, snapshotEntities } from '../../../shared/domain.ts'
import { bytea } from './_types.ts'
import { items, tires } from './catalog.ts'
import { customers } from './customers.ts'
import { workOrders } from './orders.ts'
import { vehicles } from './vehicles.ts'
import { sql } from 'drizzle-orm'

export const documents = pgTable('documents', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  /**
   * Leer, solange der Beleg ein Entwurf ist (M-14).
   *
   * Die Nummer wird erst beim endgültigen Ausstellen gezogen, in einer
   * Transaktion mit Zeilensperre. Ein gelöschter Entwurf hinterlässt dadurch
   * keine Lücke — und Lücken in einer Rechnungsfolge muss man dem Finanzamt
   * erklären.
   */
  documentNumber: varchar('document_number', { length: 50 }),

  /**
   * Die Originalnummer aus dem Altsystem (M-29).
   *
   * Importierte Belege laufen **nicht** in den neuen Zähler; sie behalten ihre
   * alte Nummer hier, damit ein Kunde mit einem Ausdruck von 2018 wiederfindbar
   * bleibt.
   */
  legacyDocumentNumber: varchar('legacy_document_number', { length: 50 }),

  /** Aus dem Altsystem übernommen und damit unveränderlich (M-30, P-08). */
  imported: boolean().default(false).notNull(),

  /* ── Belegkette (M-41) ─────────────────────────────────────────────────
     Ein Kostenvoranschlag wird selten beim ersten Mal angenommen, und auch
     eine Rechnung entwickelt sich — buchhalterisch über Storno und
     Neuausstellung, fachlich über mehrere Stände desselben Vorgangs.

     Beides läuft über **eine** Kette: alle Stände tragen dieselbe
     `chain_id`, gezählt in `version`, und genau einer ist der gültige.
     Frühere Stände bleiben stehen; der Zeitstrahl (M-02) geht sie zurück.

     Die Kennung ist bewusst **kein Fremdschlüssel**: sie benennt einen
     Vorgang, keine Zeile. Der erste Stand würfelt sie, jeder folgende erbt
     sie. Zwei Indizes halten das zusammen — einer je (Kette, Version), und
     ein bedingter, der **genau einen** gültigen Stand je Kette zulässt. */

  chainId: uuid('chain_id').defaultRandom().notNull(),

  /** 1, 2, 3 … innerhalb der Kette. */
  version: integer().default(1).notNull(),

  /** Gesetzt, sobald ein neuerer Stand diesen abgelöst hat. Leer = gültig. */
  supersededAt: timestamp('superseded_at', { withTimezone: true, mode: 'string' }),

  /**
   * Der Stand, den dieser ersetzt. Leer bei Version 1.
   *
   * Die Kette zeigt **nur rückwärts**. Ein zweiter Zeiger „wer hat mich
   * abgelöst" wäre dieselbe Auskunft ein zweites Mal — und er ginge gar nicht:
   * er müsste auf eine Zeile zeigen, die es im Augenblick des Ablösens noch
   * nicht gibt, während der bedingte Index die umgekehrte Reihenfolge
   * verbietet. Vorwärts fragt man stattdessen nach `replaces_document_id`.
   */
  replacesDocumentId: uuid('replaces_document_id'),

  /** Warum es einen neuen Stand gibt — ein deutscher Halbsatz für den Zeitstrahl. */
  versionNote: varchar('version_note', { length: 300 }),

  type: varchar({ length: 30 }).notNull(),
  status: varchar({ length: 30 }).default('draft').notNull(),
  customerId: uuid('customer_id'),
  vehicleId: uuid('vehicle_id'),
  issueDate: date('issue_date').notNull(),
  serviceDate: date('service_date'),
  dueDate: date('due_date'),
  paymentMethod: varchar('payment_method', { length: 30 }),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('19.00').notNull(),
  netTotal: integer('net_total').default(0).notNull(),
  taxTotal: integer('tax_total').default(0).notNull(),
  grossTotal: integer('gross_total').default(0).notNull(),
  discountTotal: integer('discount_total').default(0).notNull(),
  header: text(),
  footer: text(),
  notes: text(),

  /* ── Eingefroren beim Ausstellen (M-03) ────────────────────────────────
     Ein ausgestellter Beleg holt sich nichts mehr von woanders. Zieht der
     Kunde um oder ändert die Firma ihre Steuernummer, darf sich die Rechnung
     von 2019 nicht rückwirkend ändern. Leer, solange der Beleg ein Entwurf
     ist — dann zeigt die Oberfläche den aktuellen Stand. */

  issuedAt: timestamp('issued_at', { withTimezone: true, mode: 'string' }),

  billedName: varchar('billed_name', { length: 200 }),
  billedStreet: varchar('billed_street', { length: 200 }),
  billedZip: varchar('billed_zip', { length: 10 }),
  billedCity: varchar('billed_city', { length: 150 }),
  billedCountry: varchar('billed_country', { length: 100 }),
  billedVatId: varchar('billed_vat_id', { length: 30 }),

  companyName: varchar('company_name', { length: 200 }),
  companyAddress: text('company_address'),
  companyTaxNumber: varchar('company_tax_number', { length: 40 }),
  companyVatId: varchar('company_vat_id', { length: 30 }),
  companyFooter: text('company_footer'),

  /* ── Das Fahrzeug, wie es auf dem Beleg steht (M-42) ───────────────────
     Bisher trug der Beleg nur die Kundenanschrift eingefroren. Das Fahrzeug
     holte er sich über den Verweis — und damit änderte ein Kennzeichenwechsel
     rückwirkend, was auf einer Rechnung von 2019 zu stehen scheint.

     Hier stehen genau die Felder, die **gedruckt** werden. Der vollständige
     Stand aller Verweise liegt daneben in `document_snapshots`. */

  vehicleMake: varchar('vehicle_make', { length: 100 }),
  vehicleModel: varchar('vehicle_model', { length: 150 }),
  vehicleVin: varchar('vehicle_vin', { length: 25 }),
  vehicleLicensePlate: varchar('vehicle_license_plate', { length: 20 }),
  vehicleFirstRegistration: date('vehicle_first_registration'),
  vehicleMileageKm: integer('vehicle_mileage_km'),

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
  // Ein Auftrag, aus dem ein Beleg entstanden ist, verschwindet nicht
  // spurlos: der Verweis wird nicht still gelöscht, er sperrt (B-190).
  workOrderId: uuid('work_order_id').references((): AnyPgColumn => workOrders.id, { onDelete: 'no action' }),
}, table => [
  check('documents_type_check', oneOf(table.type, documentTypes.values)),
  check('documents_status_check', oneOf(table.status, documentStatuses.values)),
  check('documents_payment_method_check', oneOfOrNull(table.paymentMethod, paymentMethods.values)),
  check('documents_reminder_level_check', notNegative(table.reminderLevel)),
  index('documents_created_at_idx').using('btree', table.createdAt.desc().nullsLast()),
  index('documents_vehicle_id_idx').using('btree', table.vehicleId.asc().nullsLast()),
  index('documents_cancelled_by_idx').using('btree', table.cancelledByDocumentId.asc().nullsLast()),
  index('documents_cancels_idx').using('btree', table.cancelsDocumentId.asc().nullsLast()),
  index('documents_converted_to_invoice_idx').using('btree', table.convertedToInvoiceId.asc().nullsLast()),
  index('documents_customer_id_idx').using('btree', table.customerId.asc().nullsLast()),
  index('documents_imported_idx').using('btree', table.imported.asc().nullsLast()),
  index('documents_legacy_document_number_idx').using('btree', table.legacyDocumentNumber.asc().nullsLast()),
  uniqueIndex('documents_document_number_idx').using('btree', table.documentNumber.asc().nullsLast()),
  index('documents_issue_date_idx').using('btree', table.issueDate.asc().nullsLast()),
  index('documents_type_status_idx').using('btree', table.type.asc().nullsLast(), table.status.asc().nullsLast()),
  index('documents_work_order_id_idx').using('btree', table.workOrderId.asc().nullsLast()),
  // M-41: die Kette. Ein Stand je (Kette, Version) …
  uniqueIndex('documents_chain_version_idx').using('btree', table.chainId.asc().nullsLast(), table.version.asc().nullsLast()),
  // … und **genau einer** gültig. Ohne diese Bedingung entstünde die Lage, in
  // der zwei Stände gleichzeitig gelten und niemand sagen kann, welcher zählt.
  uniqueIndex('documents_chain_current_idx')
    .using('btree', table.chainId.asc().nullsLast())
    .where(sql`superseded_at IS NULL`),
  check('documents_version_check', sql`${table.version} >= 1`),
  // Version 1 ersetzt nichts, jede weitere ersetzt genau einen Stand. Ohne
  // diese Bedingung entstünde eine Kette mit einem Loch in der Mitte.
  check('documents_replaces_check', sql`(${table.version} = 1) = (${table.replacesDocumentId} IS NULL)`),
  uniqueIndex('documents_replaces_idx').using('btree', table.replacesDocumentId.asc().nullsLast()),
  // M-38: Eine erfasste Zahlung ist ein Geldvorgang. Ein Beleg mit Zahlung
  // lässt sich nicht mehr löschen — und ein Entwurf hat keine.
  // M-38: Eine Zahlungserinnerung ging nach draußen. Sie bleibt.
  foreignKey({
    columns: [table.customerId],
    foreignColumns: [customers.id],
    name: 'documents_customer_id_customers_id_fk',
  }).onDelete('no action'),
  foreignKey({
    columns: [table.vehicleId],
    foreignColumns: [vehicles.id],
    name: 'documents_vehicle_id_vehicles_id_fk',
  }).onDelete('no action'),
  foreignKey({
    columns: [table.cancelledByDocumentId],
    foreignColumns: [table.id],
    name: 'documents_cancelled_by_fk',
  }).onDelete('no action'),
  foreignKey({
    columns: [table.convertedToInvoiceId],
    foreignColumns: [table.id],
    name: 'documents_converted_to_invoice_id_fk',
  }).onDelete('no action'),
  foreignKey({
    columns: [table.cancelsDocumentId],
    foreignColumns: [table.id],
    name: 'documents_cancels_fk',
  }).onDelete('no action'),
  foreignKey({
    columns: [table.replacesDocumentId],
    foreignColumns: [table.id],
    name: 'documents_replaces_fk',
  }).onDelete('no action'),
])

/**
 * Der Stand jedes Verweises zum Zeitpunkt des Ausstellens (M-42).
 *
 * Die eingefrorenen Felder am Beleg sind das, was **gedruckt** wurde — sie
 * sind der Beleg. Hier steht daneben, wie der verwiesene Datensatz zu diesem
 * Zeitpunkt **insgesamt** aussah.
 *
 * Zwei verschiedene Zwecke, deshalb zwei Orte:
 *
 *   - Die Spalte `billed_street` ist Inhalt des Belegs. Sie wird gedruckt,
 *     sie ist unveränderlich, und sie steht im PDF.
 *   - Diese Zeile ist **Beweis**. Aus ihr beantwortet die Anwendung die Frage
 *     „hat sich seit dem Ausstellen etwas geändert?" — und zwar für jedes
 *     Feld, nicht nur für die gedruckten.
 *
 * Deshalb `jsonb` und keine dreißig Spalten: was hier liegt, wird nie
 * gefiltert und nie sortiert, sondern genau einmal gegen den heutigen Stand
 * gehalten. Eine Spalte je Feld hieße, das Schema jedes Mal mitzuziehen, wenn
 * ein Kunde ein Feld dazubekommt — und alte Zeilen wären dann still
 * unvollständig.
 *
 * Geändert wird hier nie (P-25).
 */
export const documentSnapshots = pgTable('document_snapshots', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  documentId: uuid('document_id').notNull(),
  /** Woraus der Stand stammt — `customers`, `vehicles`, `company_settings`. */
  entity: varchar({ length: 50 }).notNull(),
  /** Die Kennung des Datensatzes. Leer bei der Firma, die es nur einmal gibt. */
  entityId: uuid('entity_id'),
  takenAt: timestamp('taken_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  /** Der vollständige Stand. Ohne Passwörter und Schlüssel — siehe `audit.ts`. */
  data: jsonb().$type<Record<string, unknown>>().notNull(),
}, table => [
  check('document_snapshots_entity_check', oneOf(table.entity, snapshotEntities.values)),
  // Je Beleg ein Schnappschuss je Art. Zwei Stände desselben Kunden zu
  // demselben Beleg wären nicht zwei Beweise, sondern ein Widerspruch.
  uniqueIndex('document_snapshots_document_entity_idx').using('btree', table.documentId.asc().nullsLast(), table.entity.asc().nullsLast()),
  index('document_snapshots_entity_idx').using('btree', table.entity.asc().nullsLast(), table.entityId.asc().nullsLast()),
  foreignKey({
    columns: [table.documentId],
    foreignColumns: [documents.id],
    name: 'document_snapshots_document_id_documents_id_fk',
  }).onDelete('no action'),
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
  unitPriceNet: integer('unit_price_net').default(0).notNull(),
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }).default('0').notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).default('19.00').notNull(),
  lineTotalNet: integer('line_total_net').default(0).notNull(),
  lineTotalGross: integer('line_total_gross').default(0).notNull(),
  tireId: uuid('tire_id'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull().$onUpdate(() => new Date().toISOString()),
}, table => [
  check('document_items_kind_check', oneOf(table.kind, itemLineKinds.values)),
  index('document_items_document_id_idx').using('btree', table.documentId.asc().nullsLast()),
  index('document_items_item_id_idx').using('btree', table.itemId.asc().nullsLast()),
  index('document_items_tire_idx').using('btree', table.tireId.asc().nullsLast()),
  foreignKey({
    columns: [table.documentId],
    foreignColumns: [documents.id],
    name: 'document_items_document_id_documents_id_fk',
  }).onDelete('no action'),
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
  amount: integer().notNull(),
  method: varchar({ length: 30 }),
  notes: text(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, table => [
  check('document_payments_method_check', oneOfOrNull(table.method, paymentMethods.values)),
  index('document_payments_document_id_idx').using('btree', table.documentId.asc().nullsLast()),
  foreignKey({
    columns: [table.documentId],
    foreignColumns: [documents.id],
    name: 'document_payments_document_id_documents_id_fk',
  }).onDelete('no action'),
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
  }).onDelete('no action'),
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
  check('reminders_status_check', oneOf(table.status, reminderStatuses.values)),
  index('reminders_invoice_id_idx').using('btree', table.invoiceId.asc().nullsLast()),
  uniqueIndex('reminders_invoice_level_idx').using('btree', table.invoiceId.asc().nullsLast(), table.level.asc().nullsLast()),
  index('reminders_status_idx').using('btree', table.status.asc().nullsLast()),
  foreignKey({
    columns: [table.invoiceId],
    foreignColumns: [documents.id],
    name: 'reminders_invoice_id_documents_id_fk',
  }).onDelete('no action'),
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
  }).onDelete('no action'),
])
