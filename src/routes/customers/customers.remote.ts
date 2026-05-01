import { command, query } from '$app/server'
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
  listParamsSchema,
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

const listSchemaWithFilters = object({
  page: pipe(number()),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  sort: optional(pipe(string(), trim(), maxLength(30))),
  archived: optional(picklist(['active', 'archived', 'all']))
})

/**
 * Paginated, searchable customer list.
 *
 * @group integration
 * @module customers
 */
export const listCustomersRemote = query(
  listSchemaWithFilters,
  async (params) => {
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
  }
)

/**
 * Load a single customer by id.
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
 * Total active-customer count for dashboards.
 *
 * @group integration
 * @module customers
 */
export const countCustomersRemote = query(async () => countCustomers())

/**
 * Create a new customer.
 *
 * @group integration
 * @module customers
 */
export const createCustomerRemote = command(
  customerInputSchema,
  async (input) => {
    const data = await createCustomer(input)
    void listCustomersRemote({ page: 1, size: 25 }).refresh()
    void countCustomersRemote().refresh()
    return data
  }
)

/**
 * Update an existing customer.
 *
 * @group integration
 * @module customers
 */
export const updateCustomerRemote = command(
  object({ id: idSchema, values: customerInputSchema }),
  async ({ id, values }) => {
    const data = await updateCustomer(id, values)
    void listCustomersRemote({ page: 1, size: 25 }).refresh()
    void getCustomerRemote({ id }).refresh()
    return data
  }
)

/**
 * Delete a customer.
 *
 * @group integration
 * @module customers
 */
export const deleteCustomerRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    await deleteCustomer(id)
    void listCustomersRemote({ page: 1, size: 25 }).refresh()
    void countCustomersRemote().refresh()
  }
)
