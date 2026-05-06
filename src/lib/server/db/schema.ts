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
  /* Mahnwesen-Defaults — see settings UI for documentation. */
  reminderAutoEnabled: boolean('reminder_auto_enabled').notNull().default(true),
  /** Days after due date for the first reminder (Zahlungserinnerung). */
  reminderDays1: integer('reminder_days_1').notNull().default(3),
  /** Days after due date for the 1. Mahnung. */
  reminderDays2: integer('reminder_days_2').notNull().default(10),
  /** Days after due date for the 2. Mahnung. */
  reminderDays3: integer('reminder_days_3').notNull().default(20),
  /** Days after due date for the letzte Mahnung. */
  reminderDays4: integer('reminder_days_4').notNull().default(30),
  reminderFee1: numeric('reminder_fee_1', { precision: 12, scale: 2 })
    .notNull()
    .default('0.00'),
  reminderFee2: numeric('reminder_fee_2', { precision: 12, scale: 2 })
    .notNull()
    .default('5.00'),
  reminderFee3: numeric('reminder_fee_3', { precision: 12, scale: 2 })
    .notNull()
    .default('10.00'),
  reminderFee4: numeric('reminder_fee_4', { precision: 12, scale: 2 })
    .notNull()
    .default('15.00'),
  /** Annual default-interest rate in percent (Verzugszinsen p.a.). */
  reminderInterestRate: numeric('reminder_interest_rate', {
    precision: 5,
    scale: 2
  })
    .notNull()
    .default('9.62'),
  /**
   * Tag im Monat, ab dem die monatlichen Lohnabrechnungen automatisch
   * angelegt werden (1..28). Vor diesem Tag erzeugt das Auto-Payroll
   * keinen Eintrag für den laufenden Monat — der wird am Stichtag
   * angelegt und kann dann versendet/ausgezahlt werden.
   */
  payrollGenerationDay: integer('payroll_generation_day').notNull().default(25),
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
  passwordEncrypted: text('password_encrypted').notNull().default(''),
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
    index('customers_zip_idx').on(t.zip)
  ]
)

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
    stockMin: integer('stock_min'),
    stockMax: integer('stock_max'),
    discontinued: boolean('discontinued').notNull().default(false),
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
/* Dokumente (gemeinsames Modell für Rechnung / Angebot / Mahnung etc.)   */
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
     * For an invoice: which dunning level we are currently at.
     * 0 = no reminder, 1 = Zahlungserinnerung, 2 = 1. Mahnung,
     * 3 = 2. Mahnung, 4 = letzte Mahnung. Lets us prevent generating a
     * second reminder for the same level.
     */
    reminderLevel: integer('reminder_level').notNull().default(0),
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
    index('documents_converted_to_invoice_idx').on(t.convertedToInvoiceId)
  ]
)

export const documentItems = pgTable('document_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  positionNumber: integer('position_number').notNull(),
  kind: varchar('kind', { length: 20 }).notNull().default('article'),
  itemId: uuid('item_id').references(() => items.id, { onDelete: 'set null' }),
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
 * Dunning record. Always points at the parent invoice. `level` is the
 * dunning stage (1..4 — see `documents.reminderLevel`). A unique index on
 * `(invoiceId, level)` enforces "no second reminder for the same level".
 */
export const reminders = pgTable(
  'reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Auto-generated dunning number, e.g. `M-2026-0001`. */
    documentNumber: varchar('document_number', { length: 50 })
      .notNull()
      .unique(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    /** 1 = Zahlungserinnerung, 2 = 1. Mahnung, 3 = 2. Mahnung, 4 = letzte. */
    level: integer('level').notNull(),
    issueDate: date('issue_date').notNull(),
    /** New due date communicated in the reminder. */
    dueDate: date('due_date').notNull(),
    /** Reminder fee (Mahngebühr) in EUR. */
    fee: numeric('fee', { precision: 12, scale: 2 }).notNull().default('0'),
    /** Default-interest amount accrued at the time of the reminder. */
    interest: numeric('interest', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
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
 * Generated Lohnzettel-PDF for a payroll entry. Same caching contract
 * as {@link documentPdfs}: hashed inputs invalidate when an entry,
 * employee profile or settings change.
 */
export const payslipPdfs = pgTable(
  'payslip_pdfs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id').notNull(),
    inputHash: varchar('input_hash', { length: 64 }).notNull(),
    filename: varchar('filename', { length: 200 }).notNull(),
    mime: varchar('mime', { length: 50 }).notNull().default('application/pdf'),
    size: integer('size').notNull(),
    data: bytea('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [uniqueIndex('payslip_pdfs_entry_id_idx').on(t.entryId)]
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
   * `getEffectiveSalary(employeeId, dateIso)` aus dem Employee-Service;
   * vergangene Lohnabrechnungen bleiben über den im
   * `payroll_entries` mitgespeicherten Brutto-Snapshot unverändert.
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
/* Lohn                                                                    */
/* ────────────────────────────────────────────────────────────────────── */

export const payrollPeriods = pgTable('payroll_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
})

export const payrollEntries = pgTable('payroll_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  periodId: uuid('period_id')
    .notNull()
    .references(() => payrollPeriods.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'restrict' }),
  /** Soll-Arbeitstage in der Periode (z. B. 22 für einen Monat). */
  workingDays: integer('working_days'),
  /** Bezahlte Urlaubstage in der Periode. */
  vacationDaysUsed: numeric('vacation_days_used', { precision: 5, scale: 1 })
    .notNull()
    .default('0'),
  /** Krankheitstage in der Periode. */
  sickDays: numeric('sick_days', { precision: 5, scale: 1 })
    .notNull()
    .default('0'),
  grossTotal: numeric('gross_total', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  deductionsTotal: numeric('deductions_total', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  /** Summe der reinen Steuerabzüge — separater Block auf dem Lohnzettel. */
  taxTotal: numeric('tax_total', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  /** Summe der SV-Beiträge des Arbeitnehmers. */
  socialEmployeeTotal: numeric('social_employee_total', {
    precision: 12,
    scale: 2
  })
    .notNull()
    .default('0'),
  /** Summe der SV-Beiträge des Arbeitgebers (informativ auf dem Lohnzettel). */
  socialEmployerTotal: numeric('social_employer_total', {
    precision: 12,
    scale: 2
  })
    .notNull()
    .default('0'),
  netTotal: numeric('net_total', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  payoutAmount: numeric('payout_amount', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  /** Geplantes / tatsächliches Auszahlungsdatum (Überweisung). */
  payoutDate: date('payout_date'),
  payoutMethod: varchar('payout_method', { length: 30 })
    .notNull()
    .default('Überweisung'),
  /** `open` (Entwurf), `approved` (freigegeben, immutable), `cancelled`. */
  status: varchar('status', { length: 20 }).notNull().default('open'),
  notes: text('notes'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
})

/**
 * Lohnarten je Abrechnungseintrag (Grundlohn, Stundenlohn, Überstunden,
 * Zuschläge, Boni, Sachbezug etc.). Pro Eintrag mehrere Zeilen mit
 * Menge × Satz = Betrag.
 */
export const payrollLineItems = pgTable('payroll_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryId: uuid('entry_id')
    .notNull()
    .references(() => payrollEntries.id, { onDelete: 'cascade' }),
  positionNumber: integer('position_number').notNull().default(1),
  /**
   * Lohnart-Schlüssel — z. B. `base` (Grundlohn), `hourly`, `overtime`,
   * `bonus`, `bonus_night`, `bonus_holiday`, `commission`, `benefit_in_kind`,
   * `other`. Frei erweiterbar; das Label wird unten getrennt geführt.
   */
  kind: varchar('kind', { length: 30 }).notNull().default('base'),
  /** Frei wählbares Anzeige-Label (z. B. „Grundlohn April 2026"). */
  label: varchar('label', { length: 200 }).notNull(),
  /** Stunden / Stück — optional (Pauschalen lassen das Feld leer). */
  quantity: numeric('quantity', { precision: 10, scale: 3 }),
  /** Einheit: `Std`, `Tag`, `pauschal`, `€` etc. */
  unit: varchar('unit', { length: 20 }),
  /** Stundensatz / Stücksatz — optional. */
  rate: numeric('rate', { precision: 12, scale: 2 }),
  /** Effektiver Brutto-Betrag dieser Lohnart. */
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'),
  notes: text('notes')
})

/**
 * Abzüge je Eintrag — Lohnsteuer, Soli, Kirchensteuer, KV/PV/RV/AV
 * (jeweils Arbeitnehmer-Anteil), geldwerte Vorteile etc. Mit
 * `isEmployer = true` markierte Zeilen sind reine Arbeitgeber-Anteile,
 * werden auf dem Lohnzettel separat ausgewiesen und zählen NICHT in den
 * Netto-Block.
 */
export const payrollDeductions = pgTable('payroll_deductions', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryId: uuid('entry_id')
    .notNull()
    .references(() => payrollEntries.id, { onDelete: 'cascade' }),
  positionNumber: integer('position_number').notNull().default(1),
  /**
   * `tax_income` (Lohnsteuer), `tax_solidarity`, `tax_church`, `health`
   * (KV-AN), `care` (PV-AN), `pension` (RV-AN), `unemployment` (AV-AN),
   * `benefit_in_kind`, `other`. Spiegelbild auf AG-Seite via `isEmployer`.
   */
  kind: varchar('kind', { length: 30 }).notNull(),
  label: varchar('label', { length: 200 }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'),
  /** True = Arbeitgeber-Anteil (informativ); false = Arbeitnehmer-Abzug. */
  isEmployer: boolean('is_employer').notNull().default(false),
  notes: text('notes')
})

/**
 * Sonderzahlungen — separat erfasste Bonus-/Prämien-/sonstige
 * Zahlungen, die zusätzlich zum regulären Lohn ausgezahlt werden.
 * Wird beim Auto-Generieren von `payroll_entries` als zusätzliche
 * line item eingefügt (für `kind = 'one_time'` einmalig im
 * angegebenen Monat, für `kind = 'recurring'` jeden Monat innerhalb
 * `[start_month, end_month]`).
 *
 * Mitarbeiter-Zuordnung: ist `target_all = true`, gilt die Zahlung
 * für alle aktiven Mitarbeiter; sonst entscheidet die
 * `special_payment_employees`-Junction-Tabelle.
 */
export const specialPayments = pgTable(
  'special_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    label: varchar('label', { length: 200 }).notNull(),
    /** `one_time` (einmalig im Start-Monat) oder `recurring` (monatlich). */
    kind: varchar('kind', { length: 20 }).notNull().default('one_time'),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    /** Erstes Monat der Anwendbarkeit (YYYY-MM-01). */
    startMonth: date('start_month').notNull(),
    /** Letztes Monat (inklusive). NULL = unbefristet (für recurring). */
    endMonth: date('end_month'),
    /** True = gilt für alle aktiven Mitarbeiter. */
    targetAll: boolean('target_all').notNull().default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [index('special_payments_start_month_idx').on(t.startMonth)]
)

/**
 * Junction: welche Mitarbeiter erhalten welche Sonderzahlung. Nur
 * relevant, wenn `special_payments.target_all = false`.
 */
export const specialPaymentEmployees = pgTable(
  'special_payment_employees',
  {
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => specialPayments.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' })
  },
  (t) => [
    primaryKey({ columns: [t.paymentId, t.employeeId] }),
    index('special_payment_employees_employee_idx').on(t.employeeId)
  ]
)

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
export type PayrollPeriod = typeof payrollPeriods.$inferSelect
export type NewPayrollPeriod = typeof payrollPeriods.$inferInsert
export type PayrollEntry = typeof payrollEntries.$inferSelect
export type NewPayrollEntry = typeof payrollEntries.$inferInsert
export type PayrollLineItem = typeof payrollLineItems.$inferSelect
export type NewPayrollLineItem = typeof payrollLineItems.$inferInsert
export type PayrollDeduction = typeof payrollDeductions.$inferSelect
export type NewPayrollDeduction = typeof payrollDeductions.$inferInsert
export type PayslipPdf = typeof payslipPdfs.$inferSelect
export type NewPayslipPdf = typeof payslipPdfs.$inferInsert
export type LedgerEntry = typeof ledgerEntries.$inferSelect
export type CompanySettings = typeof companySettings.$inferSelect
export type SpecialPayment = typeof specialPayments.$inferSelect
export type NewSpecialPayment = typeof specialPayments.$inferInsert
export type SpecialPaymentEmployee = typeof specialPaymentEmployees.$inferSelect
