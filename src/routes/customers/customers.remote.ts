import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  maxLength,
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
import { db } from '$lib/server/db/client'
import { documents, vehicles } from '$lib/server/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { latestPlateSubquery } from '$lib/server/services/vehicle-service'

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
  customerNumber: optional(pipe(string(), trim(), maxLength(50)))
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
  kind: optional(picklist(['all', 'private', 'business']))
})

/**
 * Paginated, searchable customer list with a Privat/Firma filter.
 *
 * @remarks
 * The `kind` filter accepts `'all' | 'private' | 'business'` and is
 * derived from `customers.company` at the service layer (a non-null
 * company is a Firmenkunde, otherwise Privatkunde). Archived customers
 * are always excluded.
 *
 * @group integration
 * @module customers
 */
export const listCustomersRemote = query(listSchema, async (params) =>
  listCustomers({
    page: params.page,
    size: params.size,
    q: params.q,
    sort: params.sort,
    kind: params.kind ?? 'all'
  })
)

/**
 * Load a single customer by id. Throws `404` if the customer does not exist.
 *
 * @group integration
 * @module customers
 */
export const getCustomerRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
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
export const countCustomersRemote = query(async () => countCustomers())

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
    await deleteCustomer(id)
    await refreshListsAndCount()
  }
)
