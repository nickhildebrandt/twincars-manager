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
import { idSchema, notesSchema } from '$lib/server/db/validation'
import {
  createItem,
  deleteItem,
  getItem,
  listItemPriceHistory,
  listItems,
  nextArticleNumber,
  updateItem
} from '$lib/server/services/item-service'

const itemInputSchema = object({
  articleNumber: optional(pipe(string(), trim(), maxLength(50))),
  description: pipe(string(), trim(), maxLength(500)),
  kind: picklist(['service', 'material', 'article', 'pass_through']),
  unit: optional(pipe(string(), trim(), maxLength(20))),
  unitPriceNet: optional(number()),
  purchasePriceNet: optional(number()),
  stockOnHand: optional(number()),
  stockMin: optional(number()),
  stockMax: optional(number()),
  discontinued: optional(picklist(['true', 'false'])),
  notes: optional(notesSchema)
})

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  kind: optional(pipe(string(), trim(), maxLength(20)))
})

/**
 * Paginated item list.
 *
 * @group integration
 * @module items
 */
export const listItemsRemote = query(listSchema, async (params) => {
  const kind = params.kind && params.kind !== 'all' ? params.kind : undefined
  return listItems({ ...params, kind })
})

/**
 * Load a single item.
 *
 * @group integration
 * @module items
 */
export const getItemRemote = query(object({ id: idSchema }), async ({ id }) => {
  const e = await getItem(id)
  if (!e) error(404, 'Artikel nicht gefunden.')
  return e
})

const priceHistorySchema = object({
  id: idSchema,
  page: number(),
  size: picklist([10, 25, 50, 100])
})

/**
 * Paginated price history of an item across all documents it appears in.
 *
 * @group integration
 * @module items
 */
export const getItemPriceHistoryRemote = query(
  priceHistorySchema,
  async ({ id, page, size }) => {
    return listItemPriceHistory(id, page, size)
  }
)

const toRow = (
  v: typeof itemInputSchema.entries extends never
    ? never
    : Record<string, unknown>
) => {
  const out: Record<string, unknown> = { ...v }
  if (typeof out.unitPriceNet === 'number')
    out.unitPriceNet = String(out.unitPriceNet)
  if (typeof out.purchasePriceNet === 'number')
    out.purchasePriceNet = String(out.purchasePriceNet)
  if (out.discontinued === 'true') out.discontinued = true
  if (out.discontinued === 'false') out.discontinued = false
  return out
}

/**
 * Create item.
 *
 * @remarks
 * Single-flight mutation. Pass `listItemsRemote` to `.updates(...)` to refresh
 * the active list view in the same response.
 *
 * @group integration
 * @module items
 */
export const createItemRemote = command(itemInputSchema, async (values) => {
  const articleNumber = values.articleNumber || (await nextArticleNumber())
  const data = await createItem({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(toRow(values as any) as any),
    articleNumber
  })
  await requested(listItemsRemote, 4).refreshAll()
  return data
})

/**
 * Update item.
 *
 * @group integration
 * @module items
 */
export const updateItemRemote = command(
  object({ id: idSchema, values: itemInputSchema }),
  async ({ id, values }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await updateItem(id, toRow(values as any) as any)
    await Promise.all([
      getItemRemote({ id }).refresh(),
      requested(listItemsRemote, 4).refreshAll()
    ])
    return data
  }
)

/**
 * Delete item.
 *
 * @group integration
 * @module items
 */
export const deleteItemRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    await deleteItem(id)
    await requested(listItemsRemote, 4).refreshAll()
  }
)
