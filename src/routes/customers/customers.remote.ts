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
  archived: optional(picklist(['active', 'archived', 'all']))
})

/**
 * Paginated, searchable, archive-filterable customer list.
 *
 * @remarks
 * The `archived` filter accepts the human-readable values `'active' |
 * 'archived' | 'all'` and is mapped to a boolean (or omitted) before being
 * passed to the service layer.
 *
 * @group integration
 * @module customers
 */
export const listCustomersRemote = query(listSchema, async (params) => {
  const archivedFilter =
    params.archived === 'archived'
      ? true
      : params.archived === 'active'
        ? false
        : undefined
  return listCustomers({
    page: params.page,
    size: params.size,
    q: params.q,
    sort: params.sort,
    archived: archivedFilter
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
    const row = await getCustomer(id)
    if (!row) error(404, 'Kunde nicht gefunden.')
    return row
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
