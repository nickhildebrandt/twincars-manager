import { command, query, requested } from '$app/server'
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
  convertOfferToInvoice,
  deleteDocument,
  getDocument,
  listDocuments
} from '$lib/server/services/document-service'
import { sql, inArray } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import { documents } from '$lib/server/db/schema'

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
  type: picklist(['offer', 'cost_estimate', 'order_confirmation']),
  customerId: optional(idSchema),
  vehicleId: optional(idSchema),
  issueDate: pipe(string(), trim(), maxLength(10)),
  dueDate: optional(pipe(string(), trim(), maxLength(10))),
  header: optional(longTextSchema),
  footer: optional(longTextSchema),
  notes: optional(notesSchema),
  items: pipe(array(itemSchema), maxLength(500))
})

/**
 * Schema for the offer→invoice conversion payload. Same shape as a
 * regular invoice creation but never carries `type` — that's always
 * `invoice` on the way in.
 */
const convertSchema = object({
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
  subtype: optional(
    picklist(['offer', 'cost_estimate', 'order_confirmation', 'all'])
  )
})

/**
 * Paginated offer / cost-estimate / order-confirmation list.
 *
 * @group integration
 * @module offers
 */
export const listOffersRemote = query(listSchema, async (params) => {
  const subtype = params.subtype ?? 'all'
  if (subtype !== 'all') {
    return listDocuments({ ...params, type: subtype })
  }
  // custom multi-type listing
  const offset = (params.page - 1) * params.size
  const ids = ['offer', 'cost_estimate', 'order_confirmation'] as const
  const filters = [inArray(documents.type, ids as unknown as string[])]
  if (params.q) {
    filters.push(sql`${documents.documentNumber} ilike ${'%' + params.q + '%'}`)
  }
  const where = sql`${filters[0]}${params.q ? sql` AND ${filters[1]}` : sql``}`
  const items = await db
    .select()
    .from(documents)
    .where(where)
    .orderBy(sql`${documents.issueDate} DESC, ${documents.createdAt} DESC`)
    .limit(params.size)
    .offset(offset)
  const [{ value }] = await db
    .select({ value: sql<string>`count(*)` })
    .from(documents)
    .where(where)
  const total = Number(value)
  return {
    items,
    total,
    page: params.page,
    size: params.size,
    pageCount: Math.max(1, Math.ceil(total / params.size))
  }
})

/**
 * Load a single offer/KV/AB.
 */
export const getOfferRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    const result = await getDocument(id)
    if (
      !result ||
      !['offer', 'cost_estimate', 'order_confirmation'].includes(
        result.doc.type
      )
    )
      error(404, 'Dokument nicht gefunden.')
    return result
  }
)

/**
 * Create a new offer / Kostenvoranschlag / Auftragsbestätigung.
 *
 * @remarks
 * Single-flight mutation. Pass `listOffersRemote` to `.updates(...)` on the
 * client to refresh the caller's current filter/page combo in the same flight.
 *
 * @group integration
 * @module offers
 */
export const createOfferRemote = command(inputSchema, async (values) => {
  if (values.items.length === 0)
    error(400, 'Bitte mindestens eine Position eingeben.')
  const created = await createDocument(values)
  await requested(listOffersRemote, 4).refreshAll()
  return created
})

/**
 * Delete an offer / Kostenvoranschlag / Auftragsbestätigung.
 *
 * @group integration
 * @module offers
 */
export const deleteOfferRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    await deleteDocument(id)
    await requested(listOffersRemote, 4).refreshAll()
  }
)

/**
 * Convert an offer / Kostenvoranschlag into a fresh invoice. The user has
 * already (optionally) edited positions, quantities, discounts and
 * dates on the convert page; we forward the curated payload to the
 * service-layer transaction.
 *
 * On success: a new invoice exists, the source offer's status flips to
 * `converted`, and `documents.convertedToInvoiceId` links the two so
 * the offer remains in history.
 *
 * @group integration
 * @module offers
 */
export const convertOfferToInvoiceRemote = command(
  object({ offerId: idSchema, values: convertSchema }),
  async ({ offerId, values }) => {
    if (values.items.length === 0)
      error(400, 'Bitte mindestens eine Position eingeben.')
    try {
      const created = await convertOfferToInvoice(offerId, values)
      await requested(listOffersRemote, 4).refreshAll()
      return created
    } catch (e) {
      if (e instanceof Error) error(400, e.message)
      throw e
    }
  }
)
