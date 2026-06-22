import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  numeric,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
  customType
} from 'drizzle-orm/pg-core'

/**
 * Postgres `bytea` column mapped to `Buffer` in Node. We store generated
 * PDFs in the database (single-tenant Werkstatt app — no separate object
 * storage worth the complexity). Always pair with `data_hash` so we can
 * decide whether a re-render is needed.
 */
const bytea = customType<{ data: Buffer; default: false }>({
  dataType: () => 'bytea'
})

/* ────────────────────────────────────────────────────────────────────── */
/* App-weite Einstellungen                                                */
/* ────────────────────────────────────────────────────────────────────── */

export const companySettings = pgTable('company_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  setupCompleted: boolean('setup_completed').notNull().default(false),
  companyName: varchar('company_name', { length: 200 }).notNull().default(''),
  owner: varchar('owner', { length: 200 }),
  street: varchar('street', { length: 200 }).notNull().default(''),
  zip: varchar('zip', { length: 10 }).notNull().default(''),
  city: varchar('city', { length: 150 }).notNull().default(''),
  state: varchar('state', { length: 50 }).notNull().default(''),
  phone: varchar('phone', { length: 30 }).notNull().default(''),
  mobile: varchar('mobile', { length: 30 }),
  fax: varchar('fax', { length: 30 }),
  email: varchar('email', { length: 254 }).notNull().default(''),
  website: varchar('website', { length: 2048 }),
  vatId: varchar('vat_id', { length: 30 }),
  taxNumber: varchar('tax_number', { length: 30 }),
  bankName: varchar('bank_name', { length: 100 }),
  iban: varchar('iban', { length: 34 }),
  bic: varchar('bic', { length: 11 }),
  defaultPaymentTermDays: integer('default_payment_term_days')
    .notNull()
    .default(14),
  defaultCurrency: varchar('default_currency', { length: 3 })
    .notNull()
    .default('EUR'),
  defaultVatRate: numeric('default_vat_rate', { precision: 5, scale: 2 })
    .notNull()
    .default('19.00'),
  salutationStyle: varchar('salutation_style', { length: 10 })
    .notNull()
    .default('Sie'),
  logoMime: varchar('logo_mime', { length: 50 }),
  logoData: text('logo_data'),
  pdfFooter: text('pdf_footer').notNull().default(''),
  /**
   * Whether the user opted into the §19 UStG Kleinunternehmerregelung.
   * When true, every invoice PDF carries the standard German notice
   * instead of a tax breakdown.
   */
  smallBusinessExempt: boolean('small_business_exempt')
    .notNull()
    .default(false),
  /* Zahlungserinnerung-Defaults — see settings UI for documentation.
   *
   * Business rule: we send only a single friendly
   * "Zahlungserinnerung". There is no escalation, no Mahngebühr, no
   * Verzugszinsen. The same mail goes out at `reminder_days_1` days
   * after the invoice's due date and then every
   * `reminder_recur_every_days` days until the invoice is paid.
   */
  reminderAutoEnabled: boolean('reminder_auto_enabled').notNull().default(true),
  /**
   * Days after the invoice's due date the FIRST Zahlungserinnerung
   * goes out. After the first one, subsequent reminders follow
   * `reminderRecurEveryDays` apart.
   */
  reminderDays1: integer('reminder_days_1').notNull().default(3),
  /**
   * Gap (in days) between successive Zahlungserinnerungen for the
   * same unpaid invoice. Same friendly template each time; no
   * escalation. Default `14` (alle zwei Wochen) is the sensible
   * mid-point between "too pushy" and "easy to forget".
   */
  reminderRecurEveryDays: integer('reminder_recur_every_days')
    .notNull()
    .default(14),
  /**
   * Optional geo coordinates of the workshop. Surfaced via the public
   * `GET /api/public/company` endpoint so external websites can render
   * a map widget. Both columns are nullable; the setup wizard treats
   * them as optional fields.
   */
  geoLat: numeric('geo_lat', { precision: 9, scale: 6 }),
  geoLon: numeric('geo_lon', { precision: 9, scale: 6 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
})

export const smtpSettings = pgTable('smtp_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  host: varchar('host', { length: 255 }).notNull().default(''),
  port: integer('port').notNull().default(587),
  secure: varchar('secure', { length: 10 }).notNull().default('STARTTLS'),
  username: varchar('username', { length: 200 }).notNull().default(''),
  password: text('password').notNull().default(''),
  fromAddress: varchar('from_address', { length: 254 }).notNull().default(''),
  fromName: varchar('from_name', { length: 200 }).notNull().default(''),
  replyTo: varchar('reply_to', { length: 254 }),
  verified: boolean('verified').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
})

export const numberRanges = pgTable('number_ranges', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: varchar('kind', { length: 30 }).notNull().unique(),
  formatTemplate: varchar('format_template', { length: 50 }).notNull(),
  nextValue: integer('next_value').notNull().default(1)
})

export const mailTemplates = pgTable(
  'mail_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 50 }).notNull(),
    subject: varchar('subject', { length: 200 }).notNull(),
    body: text('body').notNull(),
    isCustom: boolean('is_custom').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [uniqueIndex('mail_templates_key_idx').on(t.key)]
)

/* ────────────────────────────────────────────────────────────────────── */
/* Kunden                                                                 */
/* ────────────────────────────────────────────────────────────────────── */

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerNumber: varchar('customer_number', { length: 50 }).notNull(),
    legacyCustomerNumber: varchar('legacy_customer_number', { length: 50 }),
    company: varchar('company', { length: 200 }),
    salutation: varchar('salutation', { length: 30 }),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    street: varchar('street', { length: 200 }),
    zip: varchar('zip', { length: 10 }),
    city: varchar('city', { length: 150 }),
    country: varchar('country', { length: 100 }).default('Deutschland'),
    phone: varchar('phone', { length: 30 }),
    phone2: varchar('phone2', { length: 30 }),
    mobile: varchar('mobile', { length: 30 }),
    fax: varchar('fax', { length: 30 }),
    email: varchar('email', { length: 254 }),
    website: varchar('website', { length: 2048 }),
    birthday: date('birthday'),
    notes: text('notes'),
    paymentTermDays: integer('payment_term_days'),
    vatId: varchar('vat_id', { length: 30 }),
    bankIban: varchar('bank_iban', { length: 34 }),
    bankBic: varchar('bank_bic', { length: 11 }),
    bankName: varchar('bank_name', { length: 100 }),
    /**
     * Customer discriminator. `regular` is the default (private or
     * business customer with full contact data); `ebay` is an eBay
     * marketplace buyer where only the eBay handle is meaningful —
     * other contact fields stay null. The list page tabs filter on
     * this column.
     */
    kind: varchar('kind', { length: 20 }).notNull().default('regular'),
    /** eBay user handle. Only populated when `kind = 'ebay'`. */
    ebayHandle: varchar('ebay_handle', { length: 100 }),
    /**
     * Opt-in flag for broadcast / newsletter mailings. Only customers
     * with this flag receive the periodic Rundschreiben.
     */
    wantsBroadcast: boolean('wants_broadcast').notNull().default(false),
    /**
     * Opt-in flag for the twice-yearly tire-change reminder mail.
     * Independent from `wantsBroadcast` so customers can subscribe to
     * tire-season nudges without joining the general newsletter (and
     * vice versa). The job only mails customers with this flag AND an
     * active `tire_storage` row.
     */
    wantsTireReminders: boolean('wants_tire_reminders')
      .notNull()
      .default(false),
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    uniqueIndex('customers_customer_number_idx').on(t.customerNumber),
    index('customers_last_name_idx').on(t.lastName),
    index('customers_company_idx').on(t.company),
    index('customers_zip_idx').on(t.zip),
    index('customers_kind_idx').on(t.kind),
    index('customers_wants_broadcast_idx').on(t.wantsBroadcast)
  ]
)

export type CustomerKind = 'regular' | 'ebay'

/* ────────────────────────────────────────────────────────────────────── */
/* Fahrzeuge — eine Tabelle für Kunden- UND Bestandsfahrzeuge             */
/* ────────────────────────────────────────────────────────────────────── */

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null'
    }),
    legacyVehicleId: varchar('legacy_vehicle_id', { length: 50 }),
    make: varchar('make', { length: 100 }),
    model: varchar('model', { length: 150 }),
    /**
     * Kennzeichen wandert mit Migration 0009 in
     * `vehicle_license_plate_versions`. Die jeweils gültige Version
     * holt `getEffectiveLicensePlate(vehicleId, dateIso)` aus dem
     * Vehicle-Service; Belege referenzieren weiter das Fahrzeug, nicht
     * das Kennzeichen, deshalb verändern Kennzeichenwechsel die
     * historischen Daten nicht.
     */
    vin: varchar('vin', { length: 25 }),
    firstRegistration: date('first_registration'),
    mileageKm: integer('mileage_km'),
    nextHu: date('next_hu'),
    nextAu: date('next_au'),
    hsn: varchar('hsn', { length: 10 }),
    tsn: varchar('tsn', { length: 10 }),
    displacementCcm: integer('displacement_ccm'),
    powerKw: integer('power_kw'),
    colorCode: varchar('color_code', { length: 30 }),
    engineNumber: varchar('engine_number', { length: 50 }),
    fuelType: varchar('fuel_type', { length: 30 }),
    gearbox: varchar('gearbox', { length: 30 }),
    bodyType: varchar('body_type', { length: 50 }),
    notes: text('notes'),
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    index('vehicles_customer_id_idx').on(t.customerId),
    index('vehicles_vin_idx').on(t.vin),
    index('vehicles_next_hu_idx').on(t.nextHu)
  ]
)

/**
 * Versionierte Kennzeichenhistorie. Gleiche Konvention wie
 * `item_price_versions` und `employee_salary_versions`: höchster
 * `valid_from <= today` ist das aktuell gültige Kennzeichen.
 * Belegpositionen referenzieren das Fahrzeug, nicht das Kennzeichen
 * — vergangene Rechnungen bleiben unverändert.
 */
export const vehicleLicensePlateVersions = pgTable(
  'vehicle_license_plate_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    validFrom: date('valid_from').notNull(),
    licensePlate: varchar('license_plate', { length: 20 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    uniqueIndex('vehicle_license_plate_versions_veh_from_idx').on(
      t.vehicleId,
      t.validFrom
    ),
    index('vehicle_license_plate_versions_vehicle_idx').on(t.vehicleId),
    index('vehicle_license_plate_versions_plate_idx').on(t.licensePlate)
  ]
)

/* ────────────────────────────────────────────────────────────────────── */
/* Fahrzeugbestand                                                        */
/* ────────────────────────────────────────────────────────────────────── */

export const vehiclePurchases = pgTable('vehicle_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  vehicleId: uuid('vehicle_id')
    .notNull()
    .references(() => vehicles.id, { onDelete: 'cascade' }),
  purchaseDate: date('purchase_date').notNull(),
  purchasePrice: numeric('purchase_price', {
    precision: 12,
    scale: 2
  }).notNull(),
  previousOwner: varchar('previous_owner', { length: 200 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
})

export const vehicleListings = pgTable('vehicle_listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  vehicleId: uuid('vehicle_id')
    .notNull()
    .references(() => vehicles.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('available'),
  salesPriceGross: numeric('sales_price_gross', { precision: 12, scale: 2 }),
  differentialTax: boolean('differential_tax').notNull().default(false),
  highlights: text('highlights'),
  equipment: jsonb('equipment').$type<string[]>().default([]),
  location: varchar('location', { length: 100 }),
  internalNotes: text('internal_notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
})

export const vehiclePhotos = pgTable('vehicle_photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  vehicleId: uuid('vehicle_id')
    .notNull()
    .references(() => vehicles.id, { onDelete: 'cascade' }),
  mime: varchar('mime', { length: 50 }).notNull(),
  dataUrl: text('data_url').notNull(),
  isMain: boolean('is_main').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
})

export const vehicleSales = pgTable('vehicle_sales', {
  id: uuid('id').primaryKey().defaultRandom(),
  vehicleId: uuid('vehicle_id')
    .notNull()
    .references(() => vehicles.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'restrict' }),
  invoiceId: uuid('invoice_id'),
  saleDate: date('sale_date').notNull(),
  salesPriceGross: numeric('sales_price_gross', {
    precision: 12,
    scale: 2
  }).notNull(),
  tradeInValue: numeric('trade_in_value', { precision: 12, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
})

/* ────────────────────────────────────────────────────────────────────── */
/* Artikel / Leistungen / Lieferanten                                     */
/* ────────────────────────────────────────────────────────────────────── */

export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    legacyItemNumber: varchar('legacy_item_number', { length: 50 }),
    articleNumber: varchar('article_number', { length: 50 }).notNull(),
    description: text('description').notNull(),
    kind: varchar('kind', { length: 20 }).notNull().default('article'),
    unit: varchar('unit', { length: 20 }),
    /**
     * `items.unit_price_net` wurde mit Migration 0008 in
     * `item_price_versions` ausgelagert — siehe `getCurrentItemPrice`
     * im Item-Service. Eine neue Version wird angelegt, sobald der
     * Preis sich ändert; alte Belege bleiben über die in
     * `document_items.unit_price_net` mitgeschriebene Snapshot
     * unverändert.
     */
    purchasePriceNet: numeric('purchase_price_net', {
      precision: 12,
      scale: 2
    }),
    stockOnHand: integer('stock_on_hand').notNull().default(0),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    uniqueIndex('items_article_number_idx').on(t.articleNumber),
    index('items_kind_idx').on(t.kind)
  ]
)

/**
 * Versionierte Preishistorie pro Leistung/Artikel. Gleiches Schema wie
 * `employee_salary_versions`: eine Zeile je `valid_from`, jüngste mit
 * `valid_from <= heute` ist der aktuelle Verkaufspreis. Belegpositionen
 * speichern den damals verwendeten Preis weiterhin in
 * `document_items.unit_price_net`, sodass alte Rechnungen unverändert
 * bleiben — die Versionstabelle ist die Quelle für den aktuellen
 * Stamm-Preis und die Preisverlauf-Anzeige.
 */
export const itemPriceVersions = pgTable(
  'item_price_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    validFrom: date('valid_from').notNull(),
    unitPriceNet: numeric('unit_price_net', {
      precision: 12,
      scale: 2
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    uniqueIndex('item_price_versions_item_from_idx').on(t.itemId, t.validFrom),
    index('item_price_versions_item_idx').on(t.itemId)
  ]
)

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  legacySupplierNumber: varchar('legacy_supplier_number', { length: 50 }),
  name: varchar('name', { length: 200 }).notNull(),
  customerNumberAtSupplier: varchar('customer_number_at_supplier', {
    length: 50
  }),
  contactPerson: varchar('contact_person', { length: 100 }),
  street: varchar('street', { length: 200 }),
  zip: varchar('zip', { length: 10 }),
  city: varchar('city', { length: 150 }),
  country: varchar('country', { length: 100 }),
  phone: varchar('phone', { length: 30 }),
  fax: varchar('fax', { length: 30 }),
  email: varchar('email', { length: 254 }),
  website: varchar('website', { length: 2048 }),
  bankName: varchar('bank_name', { length: 100 }),
  iban: varchar('iban', { length: 34 }),
  bic: varchar('bic', { length: 11 }),
  notes: text('notes'),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
})

/* ────────────────────────────────────────────────────────────────────── */
/* Dokumente (gemeinsames Modell für Rechnung / Angebot etc.)            */
/* ────────────────────────────────────────────────────────────────────── */

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentNumber: varchar('document_number', { length: 50 }).notNull(),
    legacyDocumentNumber: varchar('legacy_document_number', { length: 50 }),
    type: varchar('type', { length: 30 }).notNull(),
    status: varchar('status', { length: 30 }).notNull().default('created'),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null'
    }),
    vehicleId: uuid('vehicle_id').references(() => vehicles.id, {
      onDelete: 'set null'
    }),
    issueDate: date('issue_date').notNull(),
    serviceDate: date('service_date'),
    dueDate: date('due_date'),
    paymentMethod: varchar('payment_method', { length: 30 }),
    taxRate: numeric('tax_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('19.00'),
    netTotal: numeric('net_total', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    taxTotal: numeric('tax_total', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    grossTotal: numeric('gross_total', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    discountTotal: numeric('discount_total', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    header: text('header'),
    footer: text('footer'),
    notes: text('notes'),
    /**
     * For an offer / Kostenvoranschlag: id of the invoice it was
     * converted into. The offer's status flips to `converted` and stays
     * traceable instead of disappearing from history.
     */
    convertedToInvoiceId: uuid('converted_to_invoice_id'),
    /**
     * For an invoice: how many Zahlungserinnerungen have already
     * been sent for it. Plain counter — there is no escalation, the
     * same friendly template is used every time. 0 = no
     * Zahlungserinnerung yet, 1 = first sent, 2 = second sent, etc.
     */
    reminderLevel: integer('reminder_level').notNull().default(0),
    /**
     * GoBD-konforme Storno-Verkettung (§ 14 UStG, §§ 145 ff. AO):
     *
     * Eine bereits ausgestellte Rechnung darf nicht gelöscht werden —
     * Korrekturen erfolgen ausschließlich über eine Storno-Rechnung,
     * die das Original exakt negiert. Die beiden FK-Spalten sind
     * gegenseitig ausschließend pro Zeile:
     *
     * - `cancelledByDocumentId` wird auf der **Original-Rechnung**
     *   gesetzt und zeigt auf die zugehörige Storno-Rechnung. Solange
     *   `null`, ist die Rechnung gültig. Gleichzeitig wird
     *   `cancelledAt` + `cancellationReason` gefüllt.
     * - `cancelsDocumentId` wird auf der **Storno-Rechnung** gesetzt
     *   und zeigt zurück auf das Original. Die Storno-Rechnung trägt
     *   `type = 'invoice'` und `status = 'storno'` mit negierten
     *   Beträgen.
     *
     * Beide Spalten sind ohne `.references()` deklariert (self-FK auf
     * dieselbe Tabelle ist in Drizzle umständlich); die SQL-Migration
     * setzt die FK-Constraints explizit. Audit-Lookups gehen über die
     * beiden Indizes weiter unten.
     */
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: varchar('cancellation_reason', { length: 500 }),
    cancelledByDocumentId: uuid('cancelled_by_document_id'),
    cancelsDocumentId: uuid('cancels_document_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    uniqueIndex('documents_document_number_idx').on(t.documentNumber),
    index('documents_customer_id_idx').on(t.customerId),
    index('documents_type_status_idx').on(t.type, t.status),
    index('documents_issue_date_idx').on(t.issueDate),
    index('documents_converted_to_invoice_idx').on(t.convertedToInvoiceId),
    index('documents_cancelled_by_idx').on(t.cancelledByDocumentId),
    index('documents_cancels_idx').on(t.cancelsDocumentId)
  ]
)

export const documentItems = pgTable('document_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  positionNumber: integer('position_number').notNull(),
  kind: varchar('kind', { length: 20 }).notNull().default('article'),
  /**
   * Optional back-link to the source item (service / Werkstattleistung)
   * the position was generated from. Snapshot fields on this row are
   * the source of truth for billing — the link only exists for
   * navigation ("open the catalogue entry behind this position").
   */
  itemId: uuid('item_id').references(() => items.id, { onDelete: 'set null' }),
  /**
   * Optional back-link to the source tire row. Mutually exclusive with
   * `itemId` in practice (a position is either a service from `items`
   * or a tire from `tires`). Both nullable so legacy / free-text
   * positions stay supported.
   */
  tireId: uuid('tire_id').references(() => tires.id, { onDelete: 'set null' }),
  articleNumber: varchar('article_number', { length: 50 }),
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 3 })
    .notNull()
    .default('1'),
  unit: varchar('unit', { length: 20 }),
  unitPriceNet: numeric('unit_price_net', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 })
    .notNull()
    .default('0'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 })
    .notNull()
    .default('19.00'),
  lineTotalNet: numeric('line_total_net', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  lineTotalGross: numeric('line_total_gross', { precision: 12, scale: 2 })
    .notNull()
    .default('0')
})

export const documentPayments = pgTable('document_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  paymentDate: date('payment_date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  method: varchar('method', { length: 30 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
})

/**
 * Generated PDF for a document. We store the rendered bytes in `bytea`
 * together with a content hash so the renderer can decide cheaply whether
 * a re-render is needed: when the document changes we recompute the hash
 * over its canonical input shape; if it differs from `inputHash`, the
 * cached PDF is stale and gets regenerated, otherwise it's served as is.
 *
 * `bytea` is intentionally kept off the default `select *` of the
 * documents/list queries — the service-layer helpers in
 * `pdf-service.ts` only touch this table when the actual bytes are
 * needed.
 */
export const documentPdfs = pgTable(
  'document_pdfs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    /** Canonical hash over the inputs that influenced this render. */
    inputHash: varchar('input_hash', { length: 64 }).notNull(),
    /** Filename suggested for download (e.g. `RE-2026-0001.pdf`). */
    filename: varchar('filename', { length: 200 }).notNull(),
    mime: varchar('mime', { length: 50 }).notNull().default('application/pdf'),
    /** Size in bytes of `data`. */
    size: integer('size').notNull(),
    data: bytea('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [uniqueIndex('document_pdfs_document_id_idx').on(t.documentId)]
)

/**
 * Zahlungserinnerung record. Always points at the parent invoice.
 * `level` is the sequential reminder number: 1 for the first
 * Zahlungserinnerung ever sent, 2 for the second, etc. Each new send
 * increments by one — there is no escalation, the same friendly
 * template is used every time. The unique index on `(invoiceId,
 * level)` still acts as a safety net against two writes accidentally
 * producing the same counter value for the same invoice.
 */
export const reminders = pgTable(
  'reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Auto-generated Zahlungserinnerungs-Nummer, e.g. `ZE-2026-0001`. */
    documentNumber: varchar('document_number', { length: 50 })
      .notNull()
      .unique(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    /**
     * Sequential counter: 1 for the first Zahlungserinnerung ever
     * sent for this invoice, 2 for the second, etc. The same
     * friendly template is used regardless of level — there is no
     * escalation.
     */
    level: integer('level').notNull(),
    issueDate: date('issue_date').notNull(),
    /** New due date communicated in the Zahlungserinnerung. */
    dueDate: date('due_date').notNull(),
    /** `open` (created), `sent` (mailed), `paid`, `cancelled`. */
    status: varchar('status', { length: 20 }).notNull().default('open'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    uniqueIndex('reminders_invoice_level_idx').on(t.invoiceId, t.level),
    index('reminders_invoice_id_idx').on(t.invoiceId),
    index('reminders_status_idx').on(t.status)
  ]
)

/**
 * Generated PDF for a reminder. Mirrors {@link documentPdfs} but keyed
 * to a reminder row. We keep the two caches separate because reminders
 * are not in the `documents` table — they have their own number range
 * and lifecycle, and a polymorphic foreign key would be uglier than
 * two parallel tables.
 */
export const reminderPdfs = pgTable(
  'reminder_pdfs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reminderId: uuid('reminder_id')
      .notNull()
      .references(() => reminders.id, { onDelete: 'cascade' }),
    inputHash: varchar('input_hash', { length: 64 }).notNull(),
    filename: varchar('filename', { length: 200 }).notNull(),
    mime: varchar('mime', { length: 50 }).notNull().default('application/pdf'),
    size: integer('size').notNull(),
    data: bytea('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [uniqueIndex('reminder_pdfs_reminder_id_idx').on(t.reminderId)]
)

/* ────────────────────────────────────────────────────────────────────── */
/* Mitarbeiter und Lohn                                                   */
/* ────────────────────────────────────────────────────────────────────── */

export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  personnelNumber: varchar('personnel_number', { length: 30 }).notNull(),
  salutation: varchar('salutation', { length: 30 }),
  title: varchar('title', { length: 30 }),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  birthday: date('birthday'),
  birthplace: varchar('birthplace', { length: 100 }),
  nationality: varchar('nationality', { length: 50 }),
  street: varchar('street', { length: 200 }),
  zip: varchar('zip', { length: 10 }),
  city: varchar('city', { length: 150 }),
  country: varchar('country', { length: 100 }).default('Deutschland'),
  privateEmail: varchar('private_email', { length: 254 }),
  privatePhone: varchar('private_phone', { length: 30 }),
  mobile: varchar('mobile', { length: 30 }),
  hireDate: date('hire_date'),
  terminationDate: date('termination_date'),
  position: varchar('position', { length: 150 }),
  department: varchar('department', { length: 100 }),
  employmentType: varchar('employment_type', { length: 30 }),
  weeklyHours: numeric('weekly_hours', { precision: 5, scale: 2 }),
  /**
   * Gehälter wandern mit Migration 0008 in `employee_salary_versions`.
   * Die jeweils gültige Version je Stichtag holt
   * `getEffectiveSalary(employeeId, dateIso)` aus dem Employee-Service.
   */
  vacationDaysPerYear: integer('vacation_days_per_year'),
  taxId: varchar('tax_id', { length: 30 }),
  taxClass: varchar('tax_class', { length: 5 }),
  socialInsuranceNumber: varchar('social_insurance_number', { length: 30 }),
  healthInsurance: varchar('health_insurance', { length: 100 }),
  bankAccountHolder: varchar('bank_account_holder', { length: 200 }),
  bankIban: varchar('bank_iban', { length: 34 }),
  bankBic: varchar('bank_bic', { length: 11 }),
  bankName: varchar('bank_name', { length: 100 }),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
})

/**
 * Versionierte Gehaltshistorie pro Mitarbeiter — eine Zeile je
 * Gültigkeits-Beginn. Per `valid_from` greift die Version ab dem Tag
 * inklusive; die jeweils aktive Version ist die mit dem höchsten
 * `valid_from <= today`. Vergangene Lohnabrechnungen lesen den damals
 * gültigen Wert über `getEffectiveSalary(employeeId, periodStart)`.
 */
export const employeeSalaryVersions = pgTable(
  'employee_salary_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    validFrom: date('valid_from').notNull(),
    monthlySalary: numeric('monthly_salary', { precision: 12, scale: 2 }),
    hourlyWage: numeric('hourly_wage', { precision: 8, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    uniqueIndex('employee_salary_versions_emp_from_idx').on(
      t.employeeId,
      t.validFrom
    ),
    index('employee_salary_versions_employee_idx').on(t.employeeId)
  ]
)

export const employeeAbsences = pgTable(
  'employee_absences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    /** `vacation` (Urlaub), `sick` (Krankheit), `other` (Sonstiges). */
    type: varchar('type', { length: 20 }).notNull(),
    dateFrom: date('date_from').notNull(),
    dateTo: date('date_to').notNull(),
    halfDay: boolean('half_day').notNull().default(false),
    notes: text('notes'),
    /** `planned` (geplant), `approved` (genehmigt), `cancelled` (abgesagt). */
    status: varchar('status', { length: 20 }).notNull().default('approved'),
    /** Optionaler Anhang (z. B. AU-Bescheinigung) — base64 Data-URL. */
    attachmentMime: varchar('attachment_mime', { length: 50 }),
    attachmentName: varchar('attachment_name', { length: 200 }),
    attachmentData: text('attachment_data'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    index('employee_absences_employee_id_idx').on(t.employeeId),
    index('employee_absences_date_from_idx').on(t.dateFrom)
  ]
)

/* ────────────────────────────────────────────────────────────────────── */
/* Termine / Kalender                                                     */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Single calendar entry table — discriminated by `kind`:
 *
 * - `appointment`: workshop/customer appointment with a title, time
 *   range, optional links to customer/vehicle/employee, status
 *   (`scheduled` | `completed` | `cancelled`) and free-text notes.
 *   `allDay` is opt-in via the form toggle.
 * - `closure`: workshop closure (Betriebsschließung). `allDay` is
 *   forced true; `status` and the three FK columns must be null.
 *   Title carries the human-readable reason (e.g. "Betriebsurlaub").
 *
 * Validation of the discriminator's invariants lives in the remote
 * inputSchema, not at the DB level — Postgres just enforces NOT NULLs
 * and FKs.
 */
export const calendarEntries = pgTable(
  'calendar_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: varchar('kind', { length: 20 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').notNull().default(false),
    status: varchar('status', { length: 20 }),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null'
    }),
    vehicleId: uuid('vehicle_id').references(() => vehicles.id, {
      onDelete: 'set null'
    }),
    employeeId: uuid('employee_id').references(() => employees.id, {
      onDelete: 'set null'
    }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    index('calendar_entries_kind_idx').on(t.kind),
    index('calendar_entries_starts_at_idx').on(t.startsAt)
  ]
)

export const publicHolidays = pgTable('public_holidays', {
  id: uuid('id').primaryKey().defaultRandom(),
  state: varchar('state', { length: 50 }).notNull(),
  date: date('date').notNull(),
  name: varchar('name', { length: 100 }).notNull()
})

/* ────────────────────────────────────────────────────────────────────── */
/* Buchhaltung                                                            */
/* ────────────────────────────────────────────────────────────────────── */

export const ledgerCategories = pgTable('ledger_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  direction: varchar('direction', { length: 10 }).notNull(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  defaultTaxRate: numeric('default_tax_rate', { precision: 5, scale: 2 })
})

export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryNumber: varchar('entry_number', { length: 50 }),
    direction: varchar('direction', { length: 10 }).notNull(),
    entryDate: date('entry_date').notNull(),
    amountGross: numeric('amount_gross', { precision: 12, scale: 2 }).notNull(),
    amountNet: numeric('amount_net', { precision: 12, scale: 2 }).notNull(),
    taxAmount: numeric('tax_amount', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    taxRate: numeric('tax_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('19.00'),
    categoryId: uuid('category_id').references(() => ledgerCategories.id, {
      onDelete: 'set null'
    }),
    description: text('description').notNull(),
    paymentMethod: varchar('payment_method', { length: 30 }),
    paymentStatus: varchar('payment_status', { length: 20 })
      .notNull()
      .default('paid'),
    supplierId: uuid('supplier_id').references(() => suppliers.id, {
      onDelete: 'set null'
    }),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null'
    }),
    documentId: uuid('document_id').references(() => documents.id, {
      onDelete: 'set null'
    }),
    source: varchar('source', { length: 30 }).notNull().default('manual'),
    recurringTemplateId: uuid('recurring_template_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    index('ledger_entries_entry_date_idx').on(t.entryDate),
    index('ledger_entries_direction_idx').on(t.direction),
    index('ledger_entries_category_id_idx').on(t.categoryId)
  ]
)

export const recurringEntries = pgTable('recurring_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  direction: varchar('direction', { length: 10 }).notNull(),
  categoryId: uuid('category_id').references(() => ledgerCategories.id, {
    onDelete: 'set null'
  }),
  supplierId: uuid('supplier_id').references(() => suppliers.id, {
    onDelete: 'set null'
  }),
  amountGross: numeric('amount_gross', { precision: 12, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 })
    .notNull()
    .default('19.00'),
  paymentMethod: varchar('payment_method', { length: 30 }),
  intervalKind: varchar('interval_kind', { length: 20 }).notNull(),
  intervalEvery: integer('interval_every').notNull().default(1),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  occurrencesLimit: integer('occurrences_limit'),
  occurrencesCreated: integer('occurrences_created').notNull().default(0),
  nextRunDate: date('next_run_date').notNull(),
  paused: boolean('paused').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
})

/* ────────────────────────────────────────────────────────────────────── */
/* Versand-Historie                                                       */
/* ────────────────────────────────────────────────────────────────────── */

export const sentMessages = pgTable(
  'sent_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id').references(() => documents.id, {
      onDelete: 'set null'
    }),
    documentType: varchar('document_type', { length: 30 }).notNull(),
    recipientEmail: varchar('recipient_email', { length: 254 }).notNull(),
    recipientName: varchar('recipient_name', { length: 200 }),
    subject: varchar('subject', { length: 200 }).notNull(),
    bodyText: text('body_text').notNull(),
    attachmentMeta: jsonb('attachment_meta')
      .$type<{ name: string; size: number }[]>()
      .default([]),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    status: varchar('status', { length: 20 }).notNull().default('sent'),
    errorMessage: text('error_message'),
    smtpMessageId: varchar('smtp_message_id', { length: 200 })
  },
  (t) => [
    index('sent_messages_sent_at_idx').on(t.sentAt),
    index('sent_messages_document_id_idx').on(t.documentId)
  ]
)

/* ────────────────────────────────────────────────────────────────────── */
/* Import-Protokoll                                                       */
/* ────────────────────────────────────────────────────────────────────── */

export const accessImportJobs = pgTable('access_import_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: varchar('status', { length: 20 }).notNull().default('running'),
  tablesProcessed: integer('tables_processed').notNull().default(0),
  rowsImported: integer('rows_imported').notNull().default(0),
  rowsSkipped: integer('rows_skipped').notNull().default(0),
  notes: text('notes')
})

/* ────────────────────────────────────────────────────────────────────── */
/* Time tracking (Stundenerfassung)                                       */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * One row per logged work-hour entry. Either `documentId` or
 * `customerId` may be set (or both, or neither — free-form tasks
 * without a customer link are allowed). The duration is recorded as
 * `hours` (e.g. `1.50` = 1h 30min) rather than start/end timestamps —
 * employees log effort, not punch-in/punch-out.
 */
export const timeEntries = pgTable(
  'time_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    hours: numeric('hours', { precision: 6, scale: 2 }).notNull(),
    documentId: uuid('document_id').references(() => documents.id, {
      onDelete: 'set null'
    }),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null'
    }),
    task: varchar('task', { length: 200 }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    index('time_entries_employee_id_idx').on(t.employeeId),
    index('time_entries_date_idx').on(t.date),
    index('time_entries_document_id_idx').on(t.documentId),
    index('time_entries_customer_id_idx').on(t.customerId)
  ]
)

/* ────────────────────────────────────────────────────────────────────── */
/* Shipping & online-shop plumbing                                        */
/* ────────────────────────────────────────────────────────────────────── */

export const shippingOptions = pgTable(
  'shipping_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    priceNet: numeric('price_net', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    /**
     * If the order net total reaches this threshold, shipping is free
     * (the option is still selectable but shown with `0,00 €`).
     */
    freeAboveNet: numeric('free_above_net', { precision: 12, scale: 2 }),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [index('shipping_options_active_idx').on(t.active)]
)

/* ────────────────────────────────────────────────────────────────────── */
/* Reifenkatalog — dedicated tire SKU table                               */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Tire catalogue. Replaces the previous `items.kind='tire'` + JSONB
 * `attributes` approach: every EU-Reifenkennzeichnung field becomes a
 * proper typed column so size / season / load-index queries hit real
 * indexes instead of JSONB lookups. The workshop only sells tires —
 * there is no other physical product line, so this stays a focused,
 * single-purpose table.
 *
 * The versioned-pricing pattern is the same as `item_price_versions`
 * (see `tire_price_versions` below). Photos live in `tire_photos` and
 * mirror `vehicle_photos` shape exactly.
 */
export const tires = pgTable(
  'tires',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    articleNumber: varchar('article_number', { length: 50 }).notNull(),
    legacyArticleNumber: varchar('legacy_article_number', { length: 50 }),
    brand: varchar('brand', { length: 80 }).notNull(),
    model: varchar('model', { length: 120 }).notNull(),
    /** Breite in mm (z. B. 205). */
    width: integer('width').notNull(),
    /** Querschnitt in % (z. B. 55). */
    aspectRatio: integer('aspect_ratio').notNull(),
    /** Bauart: `R` = Radial (Standard), `D` = Diagonal. */
    construction: varchar('construction', { length: 5 }).notNull().default('R'),
    /** Felgendurchmesser in Zoll (z. B. 16). */
    diameterInch: integer('diameter_inch').notNull(),
    /** Lastindex (z. B. „91" oder „105/103"). */
    loadIndex: varchar('load_index', { length: 10 }),
    /** Geschwindigkeitsindex (T, H, V, W, Y, ZR …). */
    speedIndex: varchar('speed_index', { length: 5 }),
    /** `Sommer` | `Winter` | `Ganzjahres`. */
    season: varchar('season', { length: 20 }).notNull(),
    ean: varchar('ean', { length: 20 }),
    manufacturerPartNumber: varchar('manufacturer_part_number', { length: 50 }),
    /** EU-Label Kraftstoffeffizienz A-E. */
    fuelEfficiency: varchar('fuel_efficiency', { length: 1 }),
    /** EU-Label Nasshaftung A-E. */
    wetGrip: varchar('wet_grip', { length: 1 }),
    /** EU-Label Aussengeräuschklasse A-C. */
    noiseClass: varchar('noise_class', { length: 1 }),
    noiseDb: integer('noise_db'),
    /** Notlauf-Eigenschaft (RFT / SSR). */
    runFlat: boolean('run_flat').notNull().default(false),
    /** Verstärkter Reifen (XL / RF). */
    reinforced: boolean('reinforced').notNull().default(false),
    /** Spike-tauglich. */
    studdedWinter: boolean('studded_winter').notNull().default(false),
    /** M+S-Kennzeichnung. */
    mSMarking: boolean('m_s_marking').notNull().default(false),
    /** 3PMSF-Schneeflocke. */
    snowFlake: boolean('snow_flake').notNull().default(false),
    /** Optimiert für E-Fahrzeuge. */
    evCertified: boolean('ev_certified').notNull().default(false),
    description: text('description'),
    purchasePriceNet: numeric('purchase_price_net', {
      precision: 12,
      scale: 2
    }),
    stockOnHand: integer('stock_on_hand').notNull().default(0),
    /**
     * Whether this tire is exposed via the public token-authenticated
     * API and considered sellable through the storefront. This is the
     * single gate for public/shop visibility (there is no Auslaufartikel
     * flag — retired tires are deleted from the catalog).
     */
    onlineSellable: boolean('online_sellable').notNull().default(false),
    shippingOptionId: uuid('shipping_option_id').references(
      () => shippingOptions.id,
      { onDelete: 'set null' }
    ),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    uniqueIndex('tires_article_number_idx').on(t.articleNumber),
    index('tires_brand_idx').on(t.brand),
    index('tires_size_idx').on(t.width, t.aspectRatio, t.diameterInch),
    index('tires_season_idx').on(t.season),
    index('tires_online_sellable_idx').on(t.onlineSellable)
  ]
)

/**
 * Versionierte Preishistorie pro Reifen. Gleiches Muster wie
 * `item_price_versions` / `employee_salary_versions`: eine Zeile je
 * `valid_from`, jüngste mit `valid_from <= heute` ist der aktuelle
 * Verkaufspreis. Belegpositionen behalten ihren damals verwendeten
 * Preis (Snapshot in `document_items.unit_price_net`), unabhängig von
 * späteren Preisänderungen.
 */
export const tirePriceVersions = pgTable(
  'tire_price_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tireId: uuid('tire_id')
      .notNull()
      .references(() => tires.id, { onDelete: 'cascade' }),
    validFrom: date('valid_from').notNull(),
    unitPriceNet: numeric('unit_price_net', {
      precision: 12,
      scale: 2
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    uniqueIndex('tire_price_versions_tire_from_idx').on(t.tireId, t.validFrom)
  ]
)

/**
 * Gallery photos for a tire. Mirrors `vehicle_photos`: base64 data URL
 * inline, `is_main` flags the cover image and `sort_order` controls
 * gallery ordering. The public projection caps at the first 7 photos.
 */
export const tirePhotos = pgTable(
  'tire_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tireId: uuid('tire_id')
      .notNull()
      .references(() => tires.id, { onDelete: 'cascade' }),
    mime: varchar('mime', { length: 50 }).notNull(),
    data: text('data').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isMain: boolean('is_main').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [index('tire_photos_tire_idx').on(t.tireId)]
)

/* ────────────────────────────────────────────────────────────────────── */
/* Customer inquiries — submissions from the public contact form         */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Persisted submissions from `POST /api/public/contact`. The external
 * website forwards free-form messages plus optional context
 * (`reference_type` + `reference_id`) so the operator can see what
 * page the visitor was on when they reached out. `customer_id`
 * stays nullable because most submitters are leads — the operator
 * links them to a customer record later if needed.
 */
export const customerInquiries = pgTable(
  'customer_inquiries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null'
    }),
    customerEmail: varchar('customer_email', { length: 254 }).notNull(),
    customerName: varchar('customer_name', { length: 200 }).notNull(),
    customerPhone: varchar('customer_phone', { length: 30 }),
    subject: varchar('subject', { length: 200 }).notNull(),
    message: text('message').notNull(),
    referenceId: varchar('reference_id', { length: 64 }),
    referenceType: varchar('reference_type', { length: 20 }),
    status: varchar('status', { length: 20 }).notNull().default('new'),
    /**
     * Internal-notification mail delivery status. The public contact
     * endpoint persists the row first and only then fires the
     * workshop-internal notification — a transient SMTP outage must
     * not lose the inquiry. `pending` is the initial state, `sent` is
     * recorded after a successful nodemailer round-trip, `failed`
     * after any exception with the error text in
     * `notification_error`. Ops can manually retry failed sends from
     * the `/settings/inquiries` page.
     */
    notificationStatus: varchar('notification_status', { length: 20 })
      .notNull()
      .default('pending'),
    notificationSentAt: timestamp('notification_sent_at', {
      withTimezone: true
    }),
    notificationError: text('notification_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    index('customer_inquiries_created_at_idx').on(t.createdAt),
    index('customer_inquiries_status_idx').on(t.status),
    index('customer_inquiries_notification_status_idx').on(t.notificationStatus)
  ]
)

/* ────────────────────────────────────────────────────────────────────── */
/* Reifenlager — customer-owned tires kept on the workshop premises       */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Customer-owned tires stored seasonally at the workshop. The
 * `storage_number` is the human-readable label printed on the QR
 * sticker that workers scan with their phone to look up the entry
 * during re-mounting. Photos are stored as an array of
 * `{ mime, data }` objects inside `photos` so the warehouse-side
 * lookup can show the actual treads.
 */
export const tireStorage = pgTable(
  'tire_storage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storageNumber: varchar('storage_number', { length: 50 }).notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    vehicleId: uuid('vehicle_id').references(() => vehicles.id, {
      onDelete: 'set null'
    }),
    brand: varchar('brand', { length: 80 }),
    model: varchar('model', { length: 120 }),
    size: varchar('size', { length: 40 }),
    profileMm: numeric('profile_mm', { precision: 4, scale: 1 }),
    dotYear: integer('dot_year'),
    /** `summer` | `winter` | `allseason`. */
    season: varchar('season', { length: 20 }),
    quantity: integer('quantity').notNull().default(4),
    photos: jsonb('photos')
      .$type<Array<{ mime: string; data: string; caption?: string }>>()
      .notNull()
      .default([]),
    notes: text('notes'),
    storedAt: date('stored_at').notNull(),
    /** Set once the tires are picked up; null means "still stored". */
    retrievedAt: date('retrieved_at'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    uniqueIndex('tire_storage_storage_number_idx').on(t.storageNumber),
    index('tire_storage_customer_id_idx').on(t.customerId),
    index('tire_storage_active_idx').on(t.retrievedAt)
  ]
)

/**
 * Tire-change reminder send log. One row per `(customer, season, year)`
 * tuple — the unique constraint guarantees the seasonal job is
 * idempotent within a single season: a second invocation in the same
 * year never re-mails customers we already nudged. `season` is
 * `'spring'` (sommerräder, mid-March) or `'autumn'` (winterräder,
 * mid-October).
 */
export const tireReminderLog = pgTable(
  'tire_reminder_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id').notNull(),
    season: varchar('season', { length: 20 }).notNull(),
    year: integer('year').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex('tire_reminder_log_unique').on(t.customerId, t.season, t.year),
    index('tire_reminder_log_customer_id_idx').on(t.customerId),
    index('tire_reminder_log_season_year_idx').on(t.season, t.year)
  ]
)

/* ────────────────────────────────────────────────────────────────────── */
/* Workshop opening hours — drives public-API free-slot computation       */
/* ────────────────────────────────────────────────────────────────────── */

export const workshopHours = pgTable('workshop_hours', {
  /** 0 = Sunday, 1 = Monday, …, 6 = Saturday. */
  weekday: integer('weekday').primaryKey(),
  opensAt: text('opens_at').notNull().default('08:00'),
  closesAt: text('closes_at').notNull().default('17:00'),
  closed: boolean('closed').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
})

/* ────────────────────────────────────────────────────────────────────── */
/* Public-API tokens                                                      */
/* ────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────── */
/* Authentication (better-auth) + RBAC overlay                            */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * better-auth `users` table. Email-based signup / verification flows
 * are disabled in the auth config — accounts are created by the
 * administrator from the settings UI. The username plugin's
 * `username` column is the login handle; `email` is synthesized from
 * the username because better-auth still treats it as the canonical
 * identity.
 */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    username: text('username'),
    displayUsername: text('display_username'),
    /**
     * Whether the account may sign in. Deactivated users keep their data
     * and role assignments but are blocked at sign-in and on every
     * request (see `hooks.server.ts`). The last account effectively
     * holding the wildcard `*` permission cannot be deactivated.
     */
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    uniqueIndex('users_email_idx').on(t.email),
    uniqueIndex('users_username_idx').on(t.username)
  ]
)

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    uniqueIndex('sessions_token_idx').on(t.token),
    index('sessions_user_id_idx').on(t.userId)
  ]
)

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true
    }),
    scope: text('scope'),
    /** bcrypt hash for the `credential` provider, NULL otherwise. */
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [index('accounts_user_id_idx').on(t.userId)]
)

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)]
)

/**
 * Role definitions. `name` is shown in the settings UI; `description`
 * is free-form German.
 */
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [uniqueIndex('roles_name_idx').on(t.name)]
)

/** m:n user ↔ role link. */
export const userRoles = pgTable(
  'user_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' })
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })]
)

/**
 * Permission keys are simple per-module strings: `customers`, `vehicles`,
 * `settings`, … (one grant per module). The only sub-key is
 * `hours:write_own` (self-service time logging). The special key `*`
 * granted to a role means "every permission" — used by the seeded
 * "Administrator" role.
 */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permission: varchar('permission', { length: 100 }).notNull()
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permission] })]
)

/* ────────────────────────────────────────────────────────────────────── */

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
export type Vehicle = typeof vehicles.$inferSelect
export type VehiclePhoto = typeof vehiclePhotos.$inferSelect
export type NewVehiclePhoto = typeof vehiclePhotos.$inferInsert
export type CalendarEntry = typeof calendarEntries.$inferSelect
export type NewCalendarEntry = typeof calendarEntries.$inferInsert
export type CalendarEntryKind = 'appointment' | 'closure'
export type PublicHoliday = typeof publicHolidays.$inferSelect
export type NewPublicHoliday = typeof publicHolidays.$inferInsert
export type NewVehicle = typeof vehicles.$inferInsert
export type Document = typeof documents.$inferSelect
export type DocumentItem = typeof documentItems.$inferSelect
export type DocumentPdf = typeof documentPdfs.$inferSelect
export type NewDocumentPdf = typeof documentPdfs.$inferInsert
export type Reminder = typeof reminders.$inferSelect
export type NewReminder = typeof reminders.$inferInsert
export type ReminderPdf = typeof reminderPdfs.$inferSelect
export type NewReminderPdf = typeof reminderPdfs.$inferInsert
export type Employee = typeof employees.$inferSelect
export type EmployeeSalaryVersion = typeof employeeSalaryVersions.$inferSelect
export type ItemPriceVersion = typeof itemPriceVersions.$inferSelect
export type VehicleLicensePlateVersion =
  typeof vehicleLicensePlateVersions.$inferSelect
export type EmployeeAbsence = typeof employeeAbsences.$inferSelect
export type NewEmployeeAbsence = typeof employeeAbsences.$inferInsert
export type LedgerEntry = typeof ledgerEntries.$inferSelect
export type CompanySettings = typeof companySettings.$inferSelect
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type Account = typeof accounts.$inferSelect
export type Role = typeof roles.$inferSelect
export type NewRole = typeof roles.$inferInsert
export type UserRole = typeof userRoles.$inferSelect
export type RolePermission = typeof rolePermissions.$inferSelect
export type ShippingOption = typeof shippingOptions.$inferSelect
export type NewShippingOption = typeof shippingOptions.$inferInsert
export type TireStorage = typeof tireStorage.$inferSelect
export type NewTireStorage = typeof tireStorage.$inferInsert
export type TireReminderLog = typeof tireReminderLog.$inferSelect
export type NewTireReminderLog = typeof tireReminderLog.$inferInsert
export type TireReminderSeason = 'spring' | 'autumn'
export type WorkshopHour = typeof workshopHours.$inferSelect
export type NewWorkshopHour = typeof workshopHours.$inferInsert
/** Legacy tire-storage season (English, lowercase). */
export type TireStorageSeason = 'summer' | 'winter' | 'allseason'
export type TimeEntry = typeof timeEntries.$inferSelect
export type NewTimeEntry = typeof timeEntries.$inferInsert
/* ── Reifenkatalog ─────────────────────────────────────────────────── */
export type Tire = typeof tires.$inferSelect
export type NewTire = typeof tires.$inferInsert
export type TirePriceVersion = typeof tirePriceVersions.$inferSelect
export type NewTirePriceVersion = typeof tirePriceVersions.$inferInsert
export type TirePhoto = typeof tirePhotos.$inferSelect
export type NewTirePhoto = typeof tirePhotos.$inferInsert
/** Catalog tire seasons — German labels as stored in the column. */
export type TireSeason = 'Sommer' | 'Winter' | 'Ganzjahres'
/** Tire construction kind: Radial (default) or Diagonal. */
export type TireConstruction = 'R' | 'D'
export type CustomerInquiry = typeof customerInquiries.$inferSelect
export type NewCustomerInquiry = typeof customerInquiries.$inferInsert
