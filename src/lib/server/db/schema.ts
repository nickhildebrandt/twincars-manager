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
  uniqueIndex
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const nowDefault = sql`now()`

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
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(nowDefault),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(nowDefault)
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
    .default(nowDefault)
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
      .default(nowDefault)
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
      .default(nowDefault),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(nowDefault)
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
    licensePlate: varchar('license_plate', { length: 20 }),
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
      .default(nowDefault),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(nowDefault)
  },
  (t) => [
    index('vehicles_customer_id_idx').on(t.customerId),
    index('vehicles_license_plate_idx').on(t.licensePlate),
    index('vehicles_vin_idx').on(t.vin),
    index('vehicles_next_hu_idx').on(t.nextHu)
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
    .default(nowDefault)
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
    .default(nowDefault),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(nowDefault)
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
    .default(nowDefault)
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
    .default(nowDefault)
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
    unitPriceNet: numeric('unit_price_net', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
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
      .default(nowDefault),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(nowDefault)
  },
  (t) => [
    uniqueIndex('items_article_number_idx').on(t.articleNumber),
    index('items_kind_idx').on(t.kind)
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
    .default(nowDefault),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(nowDefault)
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
    status: varchar('status', { length: 30 }).notNull().default('draft'),
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
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(nowDefault),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(nowDefault)
  },
  (t) => [
    uniqueIndex('documents_document_number_idx').on(t.documentNumber),
    index('documents_customer_id_idx').on(t.customerId),
    index('documents_type_status_idx').on(t.type, t.status),
    index('documents_issue_date_idx').on(t.issueDate)
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
    .default(nowDefault)
})

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
  monthlySalary: numeric('monthly_salary', { precision: 12, scale: 2 }),
  hourlyWage: numeric('hourly_wage', { precision: 8, scale: 2 }),
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
    .default(nowDefault),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(nowDefault)
})

export const employeeAbsences = pgTable('employee_absences', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(),
  dateFrom: date('date_from').notNull(),
  dateTo: date('date_to').notNull(),
  halfDay: boolean('half_day').notNull().default(false),
  notes: text('notes'),
  status: varchar('status', { length: 20 }).notNull().default('approved'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(nowDefault)
})

/* ────────────────────────────────────────────────────────────────────── */
/* Termine / Kalender                                                     */
/* ────────────────────────────────────────────────────────────────────── */

export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  customerId: uuid('customer_id').references(() => customers.id, {
    onDelete: 'set null'
  }),
  vehicleId: uuid('vehicle_id').references(() => vehicles.id, {
    onDelete: 'set null'
  }),
  employeeId: uuid('employee_id').references(() => employees.id, {
    onDelete: 'set null'
  }),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  notes: text('notes'),
  status: varchar('status', { length: 20 }).notNull().default('scheduled'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(nowDefault)
})

export const businessClosures = pgTable('business_closures', {
  id: uuid('id').primaryKey().defaultRandom(),
  dateFrom: date('date_from').notNull(),
  dateTo: date('date_to').notNull(),
  reason: varchar('reason', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(nowDefault)
})

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
      .default(nowDefault)
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
    .default(nowDefault)
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
    .default(nowDefault)
})

export const payrollEntries = pgTable('payroll_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  periodId: uuid('period_id')
    .notNull()
    .references(() => payrollPeriods.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'restrict' }),
  grossTotal: numeric('gross_total', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  deductionsTotal: numeric('deductions_total', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  netTotal: numeric('net_total', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  payoutAmount: numeric('payout_amount', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(nowDefault)
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
    sentAt: timestamp('sent_at', { withTimezone: true })
      .notNull()
      .default(nowDefault),
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
    .default(nowDefault),
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
export type NewVehicle = typeof vehicles.$inferInsert
export type Document = typeof documents.$inferSelect
export type DocumentItem = typeof documentItems.$inferSelect
export type Employee = typeof employees.$inferSelect
export type LedgerEntry = typeof ledgerEntries.$inferSelect
export type CompanySettings = typeof companySettings.$inferSelect
