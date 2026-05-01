import { command, query } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  object,
  optional,
  picklist,
  pipe,
  number,
  string,
  trim,
  maxLength
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
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier
} from '$lib/server/services/supplier-service'

const supplierInputSchema = object({
  name: pipe(string(), trim(), maxLength(200)),
  customerNumberAtSupplier: optional(pipe(string(), trim(), maxLength(50))),
  contactPerson: optional(pipe(string(), trim(), maxLength(100))),
  street: optional(addressLineSchema),
  zip: optional(zipSchema),
  city: optional(citySchema),
  country: optional(pipe(string(), trim(), maxLength(100))),
  phone: optional(phoneSchema),
  fax: optional(phoneSchema),
  email: optionalEmailSchema,
  website: optional(urlSchema),
  bankName: optional(pipe(string(), trim(), maxLength(100))),
  iban: optional(pipe(string(), trim(), maxLength(34))),
  bic: optional(pipe(string(), trim(), maxLength(11))),
  notes: optional(notesSchema)
})

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  archived: optional(picklist(['active', 'archived', 'all']))
})

/**
 * Paginated supplier list.
 *
 * @group integration
 * @module suppliers
 */
export const listSuppliersRemote = query(listSchema, async (params) => {
  const archivedFilter =
    params.archived === 'archived'
      ? true
      : params.archived === 'active'
        ? false
        : undefined
  return listSuppliers({ ...params, archived: archivedFilter })
})

/**
 * Load a single supplier.
 *
 * @group integration
 * @module suppliers
 */
export const getSupplierRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    const row = await getSupplier(id)
    if (!row) error(404, 'Lieferant nicht gefunden.')
    return row
  }
)

/**
 * Create supplier.
 *
 * @group integration
 * @module suppliers
 */
export const createSupplierRemote = command(
  supplierInputSchema,
  async (values) => {
    const data = await createSupplier(values)
    void listSuppliersRemote({ page: 1, size: 25 }).refresh()
    return data
  }
)

/**
 * Update supplier.
 *
 * @group integration
 * @module suppliers
 */
export const updateSupplierRemote = command(
  object({ id: idSchema, values: supplierInputSchema }),
  async ({ id, values }) => {
    const data = await updateSupplier(id, values)
    void listSuppliersRemote({ page: 1, size: 25 }).refresh()
    void getSupplierRemote({ id }).refresh()
    return data
  }
)

/**
 * Delete supplier.
 *
 * @group integration
 * @module suppliers
 */
export const deleteSupplierRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    await deleteSupplier(id)
    void listSuppliersRemote({ page: 1, size: 25 }).refresh()
  }
)
