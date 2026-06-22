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
  idSchema,
  moneySchema,
  paymentMethodSchema
} from '$lib/server/db/validation'
import {
  createLedgerEntry,
  deleteLedgerEntry,
  getLedgerEntry,
  listLedgerCategories,
  listLedgerEntries,
  updateLedgerEntry
} from '$lib/server/services/ledger-service'
import { requirePermission } from '$lib/server/auth-guards'

const entryInputSchema = object({
  direction: picklist(['income', 'expense']),
  entryDate: pipe(string(), trim(), maxLength(10)),
  amountGross: moneySchema,
  taxRate: optional(number()),
  categoryId: optional(idSchema),
  description: pipe(string(), trim(), maxLength(500)),
  paymentMethod: paymentMethodSchema,
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
  requirePermission('ledger')
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
  async ({ direction }) => {
    requirePermission('ledger')
    return listLedgerCategories(direction)
  }
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
    requirePermission('ledger')
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
    requirePermission('ledger')
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
    await requested(listLedgerEntriesRemote, 4).refreshAll()
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
    requirePermission('ledger')
    await deleteLedgerEntry(id)
    await requested(listLedgerEntriesRemote, 4).refreshAll()
  }
)

/**
 * Update an existing ledger entry. Re-derives net + tax from
 * `amountGross` and `taxRate` so the totals on stat-cards stay
 * consistent.
 *
 * @group integration
 * @module ledger
 */
export const updateLedgerEntryRemote = command(
  object({ id: idSchema, values: entryInputSchema }),
  async ({ id, values }) => {
    requirePermission('ledger')
    const taxRate = values.taxRate ?? 19
    const gross = Number(values.amountGross)
    const net = Math.round((gross / (1 + taxRate / 100)) * 100) / 100
    const tax = Math.round((gross - net) * 100) / 100
    const data = await updateLedgerEntry(id, {
      direction: values.direction,
      entryDate: values.entryDate,
      amountGross: String(gross),
      amountNet: String(net),
      taxAmount: String(tax),
      taxRate: String(taxRate),
      categoryId: values.categoryId ?? null,
      description: values.description,
      paymentMethod: values.paymentMethod ?? null,
      paymentStatus: values.paymentStatus ?? 'paid'
    })
    await Promise.all([
      getLedgerEntryRemote({ id }).refresh(),
      requested(listLedgerEntriesRemote, 4).refreshAll()
    ])
    return data
  }
)
