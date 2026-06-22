import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  array,
  boolean,
  maxLength,
  minLength,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
  trim
} from 'valibot'
import {
  addressLineSchema,
  citySchema,
  idSchema,
  notesSchema,
  optionalEmailSchema,
  phoneSchema,
  urlSchema,
  zipSchema
} from '$lib/server/db/validation'
import {
  countCustomers,
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer
} from '$lib/server/services/customer-service'
import { sendAdHocCustomerEmail } from '$lib/server/services/mail-service'
import { db } from '$lib/server/db/client'
import { documents, vehicles } from '$lib/server/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { latestPlateSubquery } from '$lib/server/services/vehicle-service'
import { requirePermission } from '$lib/server/auth-guards'

/**
 * Validation schema shared by `createCustomerRemote` and
 * `updateCustomerRemote`. All fields are optional at the schema level — the
 * service layer enforces business rules (e.g. at least name or company).
 */
const customerInputSchema = object({
  company: optional(pipe(string(), trim(), maxLength(200))),
  salutation: optional(pipe(string(), trim(), maxLength(30))),
  firstName: optional(pipe(string(), trim(), maxLength(100))),
  lastName: optional(pipe(string(), trim(), maxLength(100))),
  street: optional(addressLineSchema),
  zip: optional(zipSchema),
  city: optional(citySchema),
  country: optional(pipe(string(), trim(), maxLength(100))),
  phone: optional(phoneSchema),
  mobile: optional(phoneSchema),
  fax: optional(phoneSchema),
  email: optionalEmailSchema,
  website: optional(urlSchema),
  notes: optional(notesSchema),
  paymentTermDays: optional(number()),
  vatId: optional(pipe(string(), trim(), maxLength(30))),
  bankIban: optional(pipe(string(), trim(), maxLength(34))),
  bankBic: optional(pipe(string(), trim(), maxLength(11))),
  bankName: optional(pipe(string(), trim(), maxLength(100))),
  customerNumber: optional(pipe(string(), trim(), maxLength(50))),
  kind: optional(picklist(['regular', 'ebay'])),
  ebayHandle: optional(pipe(string(), trim(), maxLength(100))),
  wantsBroadcast: optional(boolean()),
  wantsTireReminders: optional(boolean())
})

/**
 * Schema for the paginated customer list query. `size` is `picklist`-bounded
 * so a malicious client cannot request arbitrarily large pages.
 */
const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  sort: optional(pipe(string(), trim(), maxLength(30))),
  kind: optional(picklist(['all', 'private', 'business', 'ebay']))
})

/**
 * Paginated, searchable customer list with a Privat/Firma/eBay filter.
 *
 * @remarks
 * The `kind` filter accepts `'all' | 'private' | 'business' | 'ebay'`.
 * `'ebay'` restricts to `customers.kind = 'ebay'`; the other three
 * always restrict to `customers.kind = 'regular'` and additionally
 * narrow by the legacy `customers.company` column. Archived
 * customers are always excluded.
 *
 * @group integration
 * @module customers
 */
export const listCustomersRemote = query(listSchema, async (params) => {
  requirePermission('customers')
  return listCustomers({
    page: params.page,
    size: params.size,
    q: params.q,
    sort: params.sort,
    kind: params.kind ?? 'all'
  })
})

/**
 * Load a single customer by id. Throws `404` if the customer does not exist.
 *
 * @group integration
 * @module customers
 */
export const getCustomerRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('customers')
    const row = await getCustomer(id)
    if (!row) error(404, 'Kunde nicht gefunden.')
    return row
  }
)

/**
 * Vehicles + invoices for a customer detail view. Both queries are tiny
 * for typical workshop volumes and run in parallel on the server, so the
 * detail page stays a single round-trip.
 *
 * @group integration
 * @module customers
 */
export const getCustomerRelatedRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('customers')
    const lp = latestPlateSubquery()
    const [vehicleRows, invoiceRows] = await Promise.all([
      db
        .select({
          id: vehicles.id,
          make: vehicles.make,
          model: vehicles.model,
          licensePlate: lp.licensePlate,
          firstRegistration: vehicles.firstRegistration,
          mileageKm: vehicles.mileageKm,
          nextHu: vehicles.nextHu,
          archived: vehicles.archived
        })
        .from(vehicles)
        .leftJoin(lp, eq(lp.vehicleId, vehicles.id))
        .where(eq(vehicles.customerId, id))
        .orderBy(desc(vehicles.createdAt)),
      db
        .select({
          id: documents.id,
          documentNumber: documents.documentNumber,
          type: documents.type,
          status: documents.status,
          issueDate: documents.issueDate,
          dueDate: documents.dueDate,
          grossTotal: documents.grossTotal
        })
        .from(documents)
        .where(and(eq(documents.customerId, id), eq(documents.type, 'invoice')))
        .orderBy(desc(documents.issueDate))
    ])
    return { vehicles: vehicleRows, invoices: invoiceRows }
  }
)

/**
 * Total active-customer count for the dashboard. Cached request-scoped on the
 * server so multiple components on the same page share one DB roundtrip.
 *
 * @group integration
 * @module customers
 */
export const countCustomersRemote = query(async () => {
  requirePermission('customers')
  return countCustomers()
})

/**
 * Refresh the dashboard count plus every list instance the client requested
 * via `.updates(listCustomersRemote)`. Up to 4 instances per request — enough
 * for filter combos rendered simultaneously, capped to bound DoS risk.
 */
const refreshListsAndCount = async (): Promise<void> => {
  await Promise.all([
    countCustomersRemote().refresh(),
    requested(listCustomersRemote, 4).refreshAll()
  ])
}

/**
 * Create a new customer.
 *
 * @remarks
 * Single-flight mutation. Clients should request updates with
 * `await createCustomerRemote(input).updates(listCustomersRemote)` so the
 * caller's specific filter/page combination is refreshed in the same flight.
 *
 * @group integration
 * @module customers
 */
export const createCustomerRemote = command(
  customerInputSchema,
  async (input) => {
    requirePermission('customers')
    const data = await createCustomer(input)
    await refreshListsAndCount()
    return data
  }
)

/**
 * Update an existing customer.
 *
 * @remarks
 * Refreshes the matching `getCustomerRemote({ id })` plus any active list
 * instances requested by the client.
 *
 * @group integration
 * @module customers
 */
export const updateCustomerRemote = command(
  object({ id: idSchema, values: customerInputSchema }),
  async ({ id, values }) => {
    requirePermission('customers')
    const data = await updateCustomer(id, values)
    await Promise.all([
      getCustomerRemote({ id }).refresh(),
      refreshListsAndCount()
    ])
    return data
  }
)

/**
 * Delete a customer.
 *
 * @remarks
 * Refreshes the dashboard count and any active list instances requested by
 * the client.
 *
 * @group integration
 * @module customers
 */
export const deleteCustomerRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('customers')
    await deleteCustomer(id)
    await refreshListsAndCount()
  }
)

/**
 * Per-attachment cap for ad-hoc and broadcast emails. ~10 MB raw
 * encodes to ~13.5 MB base64; 14 MB gives a small buffer without
 * letting a malicious payload exhaust server memory.
 */
const ATTACHMENT_BASE64_MAX = 14_000_000

const attachmentSchema = object({
  filename: pipe(
    string('Bitte einen Dateinamen angeben.'),
    trim(),
    minLength(1, 'Dateiname darf nicht leer sein.'),
    maxLength(255, 'Dateiname darf maximal 255 Zeichen lang sein.')
  ),
  mime: pipe(
    string(),
    trim(),
    maxLength(100, 'MIME-Typ darf maximal 100 Zeichen lang sein.')
  ),
  base64Data: pipe(
    string('Anhang-Daten fehlen.'),
    minLength(1, 'Anhang-Daten dürfen nicht leer sein.'),
    maxLength(
      ATTACHMENT_BASE64_MAX,
      'Der Anhang ist zu groß (maximal 10 MB pro Datei).'
    )
  )
})

const adHocEmailSchema = object({
  customerId: idSchema,
  subject: pipe(
    string('Bitte einen Betreff eingeben.'),
    trim(),
    minLength(1, 'Der Betreff darf nicht leer sein.'),
    maxLength(200, 'Der Betreff darf maximal 200 Zeichen lang sein.')
  ),
  body: pipe(
    string('Bitte einen Nachrichtentext eingeben.'),
    minLength(1, 'Die Nachricht darf nicht leer sein.'),
    maxLength(50_000, 'Die Nachricht darf maximal 50.000 Zeichen lang sein.')
  ),
  asHtml: optional(boolean()),
  attachments: array(attachmentSchema)
})

/**
 * Send a free-form email to a single customer (composer modal on the
 * customer detail page). Wraps `sendAdHocCustomerEmail` from the mail
 * service; failures bubble up as curated German `error(400, …)` so
 * `handleClientError` shows a clean toast.
 *
 * @group integration
 * @module customers
 */
export const sendAdHocCustomerEmailRemote = command(
  adHocEmailSchema,
  async (input) => {
    requirePermission('customers')
    const send = await sendAdHocCustomerEmail(input)
    if (!send.ok) {
      error(400, `E-Mail konnte nicht versendet werden: ${send.error}`)
    }
    return { messageId: send.messageId }
  }
)
