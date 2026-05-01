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
  idSchema,
  longTextSchema,
  moneySchema
} from '$lib/server/db/validation'
import {
  createLedgerEntry,
  deleteLedgerEntry,
  getLedgerEntry,
  listLedgerCategories,
  listLedgerEntries
} from '$lib/server/services/ledger-service'

const entryInputSchema = object({
  direction: picklist(['income', 'expense']),
  entryDate: pipe(string(), trim(), maxLength(10)),
  amountGross: moneySchema,
  taxRate: optional(number()),
  categoryId: optional(idSchema),
  description: pipe(string(), trim(), maxLength(500)),
  paymentMethod: optional(pipe(string(), trim(), maxLength(30))),
  paymentStatus: optional(picklist(['paid', 'open', 'partial']))
})

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  direction: optional(picklist(['income', 'expense', 'all'])),
  from: optional(pipe(string(), trim(), maxLength(10))),
  to: optional(pipe(string(), trim(), maxLength(10)))
})

/**
 * Paginated ledger entries with optional date range filter.
 *
 * @group integration
 * @module ledger
 */
export const listLedgerEntriesRemote = query(listSchema, async (params) => {
  return listLedgerEntries({
    page: params.page,
    size: params.size,
    q: params.q,
    direction: params.direction ?? 'all',
    from: params.from,
    to: params.to
  })
})

/**
 * Categories for income/expense.
 *
 * @group integration
 * @module ledger
 */
export const listCategoriesRemote = query(
  object({ direction: optional(picklist(['income', 'expense'])) }),
  async ({ direction }) => listLedgerCategories(direction)
)

/**
 * Get one ledger entry.
 *
 * @group integration
 * @module ledger
 */
export const getLedgerEntryRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    const e = await getLedgerEntry(id)
    if (!e) error(404, 'Buchung nicht gefunden.')
    return e
  }
)

/**
 * Create a manual ledger entry.
 *
 * @group integration
 * @module ledger
 */
export const createLedgerEntryRemote = command(
  entryInputSchema,
  async (values) => {
    const taxRate = values.taxRate ?? 19
    const gross = Number(values.amountGross)
    const net = Math.round((gross / (1 + taxRate / 100)) * 100) / 100
    const tax = Math.round((gross - net) * 100) / 100
    const data = await createLedgerEntry({
      direction: values.direction,
      entryDate: values.entryDate,
      amountGross: String(gross),
      amountNet: String(net),
      taxAmount: String(tax),
      taxRate: String(taxRate),
      categoryId: values.categoryId ?? null,
      description: values.description,
      paymentMethod: values.paymentMethod ?? null,
      paymentStatus: values.paymentStatus ?? 'paid',
      source: 'manual'
    })
    void listLedgerEntriesRemote({ page: 1, size: 25 }).refresh()
    return data
  }
)

/**
 * Delete a ledger entry.
 *
 * @group integration
 * @module ledger
 */
export const deleteLedgerEntryRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    await deleteLedgerEntry(id)
    void listLedgerEntriesRemote({ page: 1, size: 25 }).refresh()
  }
)
