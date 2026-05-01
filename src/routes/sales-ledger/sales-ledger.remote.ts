import { query } from '$app/server'
import {
  object,
  optional,
  picklist,
  pipe,
  string,
  trim,
  maxLength
} from 'valibot'
import { db } from '$lib/server/db/client'
import { documents, customers } from '$lib/server/db/schema'
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm'

const filterSchema = object({
  from: optional(pipe(string(), trim(), maxLength(10))),
  to: optional(pipe(string(), trim(), maxLength(10))),
  period: optional(picklist(['this_month', 'last_month', 'this_year', 'all']))
})

const computeRange = (
  period: string | undefined,
  from?: string,
  to?: string
): { from?: string; to?: string } => {
  if (from || to) return { from, to }
  const today = new Date()
  if (period === 'this_year') {
    return {
      from: `${today.getFullYear()}-01-01`,
      to: `${today.getFullYear()}-12-31`
    }
  }
  if (period === 'last_month') {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const e = new Date(today.getFullYear(), today.getMonth(), 0)
    return {
      from: d.toISOString().slice(0, 10),
      to: e.toISOString().slice(0, 10)
    }
  }
  if (period === 'this_month' || !period) {
    const d = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: d.toISOString().slice(0, 10) }
  }
  return {}
}

/**
 * Sales-ledger query — invoices in a given date range with totals.
 *
 * @group integration
 * @module sales-ledger
 */
export const getSalesLedgerRemote = query(filterSchema, async (params) => {
  const { from, to } = computeRange(params.period, params.from, params.to)
  const conds = [eq(documents.type, 'invoice')]
  if (from) conds.push(gte(documents.issueDate, from))
  if (to) conds.push(lte(documents.issueDate, to))

  const rows = await db
    .select({
      id: documents.id,
      documentNumber: documents.documentNumber,
      issueDate: documents.issueDate,
      grossTotal: documents.grossTotal,
      netTotal: documents.netTotal,
      taxTotal: documents.taxTotal,
      status: documents.status,
      customerName: sql<
        string | null
      >`COALESCE(${customers.company}, ${customers.lastName})`.as(
        'customer_name'
      )
    })
    .from(documents)
    .leftJoin(customers, eq(documents.customerId, customers.id))
    .where(and(...conds))
    .orderBy(asc(documents.issueDate))

  const totals = rows.reduce(
    (acc, r) => {
      acc.net += Number(r.netTotal)
      acc.tax += Number(r.taxTotal)
      acc.gross += Number(r.grossTotal)
      return acc
    },
    { net: 0, tax: 0, gross: 0 }
  )
  return { rows, totals, from, to }
})
