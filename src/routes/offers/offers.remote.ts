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
 * Create a new offer/KV/AB.
 */
export const createOfferRemote = command(inputSchema, async (values) => {
  if (values.items.length === 0)
    error(400, 'Bitte mindestens eine Position eingeben.')
  const created = await createDocument(values)
  void listOffersRemote({ page: 1, size: 25 }).refresh()
  return created
})

/**
 * Delete an offer/KV/AB.
 */
export const deleteOfferRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    await deleteDocument(id)
    void listOffersRemote({ page: 1, size: 25 }).refresh()
  }
)
