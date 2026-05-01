import { command, query } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  array,
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
  idSchema,
  longTextSchema,
  moneySchema,
  notesSchema
} from '$lib/server/db/validation'
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  setDocumentStatus
} from '$lib/server/services/document-service'

const itemSchema = object({
  description: pipe(string(), trim(), maxLength(500)),
  quantity: number(),
  unit: optional(pipe(string(), trim(), maxLength(20))),
  unitPriceNet: moneySchema,
  discountPercent: optional(number()),
  taxRate: number(),
  kind: optional(pipe(string(), maxLength(20))),
  articleNumber: optional(pipe(string(), trim(), maxLength(50)))
})

const inputSchema = object({
  customerId: optional(idSchema),
  vehicleId: optional(idSchema),
  issueDate: pipe(string(), trim(), maxLength(10)),
  serviceDate: optional(pipe(string(), trim(), maxLength(10))),
  dueDate: optional(pipe(string(), trim(), maxLength(10))),
  paymentMethod: optional(pipe(string(), trim(), maxLength(30))),
  header: optional(longTextSchema),
  footer: optional(longTextSchema),
  notes: optional(notesSchema),
  items: pipe(array(itemSchema), maxLength(500))
})

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  status: optional(pipe(string(), trim(), maxLength(20)))
})

/**
 * Paginated invoice list.
 *
 * @group integration
 * @module invoices
 */
export const listInvoicesRemote = query(listSchema, async (params) => {
  return listDocuments({ ...params, type: 'invoice' })
})

/**
 * Load a single invoice with line items.
 *
 * @group integration
 * @module invoices
 */
export const getInvoiceRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    const result = await getDocument(id)
    if (!result || result.doc.type !== 'invoice')
      error(404, 'Rechnung nicht gefunden.')
    return result
  }
)

/**
 * Create a new invoice with positions.
 *
 * @group integration
 * @module invoices
 */
export const createInvoiceRemote = command(inputSchema, async (values) => {
  if (values.items.length === 0)
    error(400, 'Bitte mindestens eine Position eingeben.')
  const created = await createDocument({ type: 'invoice', ...values })
  void listInvoicesRemote({ page: 1, size: 25 }).refresh()
  return created
})

/**
 * Update the status of an invoice.
 */
export const setInvoiceStatusRemote = command(
  object({
    id: idSchema,
    status: picklist(['draft', 'open', 'paid', 'cancelled'])
  }),
  async ({ id, status }) => {
    await setDocumentStatus(id, status)
    void listInvoicesRemote({ page: 1, size: 25 }).refresh()
    void getInvoiceRemote({ id }).refresh()
  }
)

/**
 * Delete an invoice.
 */
export const deleteInvoiceRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    await deleteDocument(id)
    void listInvoicesRemote({ page: 1, size: 25 }).refresh()
  }
)
