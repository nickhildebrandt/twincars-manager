import { db } from '$lib/server/db/client'
import {
  ledgerEntries,
  ledgerCategories,
  type LedgerEntry
} from '$lib/server/db/schema'
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sum
} from 'drizzle-orm'
import type { ListParams, ListResult } from '$lib/server/db/validation'

type NewLedgerEntry = typeof ledgerEntries.$inferInsert
type Category = typeof ledgerCategories.$inferSelect

export async function listLedgerCategories(
  direction?: 'income' | 'expense'
): Promise<Category[]> {
  if (direction) {
    return db
      .select()
      .from(ledgerCategories)
      .where(eq(ledgerCategories.direction, direction))
      .orderBy(asc(ledgerCategories.name))
  }
  return db
    .select()
    .from(ledgerCategories)
    .orderBy(asc(ledgerCategories.direction), asc(ledgerCategories.name))
}

export async function listLedgerEntries(
  params: ListParams & {
    direction?: 'income' | 'expense' | 'all'
    from?: string
    to?: string
  }
): Promise<ListResult<LedgerEntry>> {
  const { page, size, q, direction, from, to } = params
  const offset = (page - 1) * size

  const filters = []
  if (q) {
    const term = `%${q}%`
    filters.push(
      or(
        ilike(ledgerEntries.description, term),
        ilike(ledgerEntries.entryNumber, term)
      )
    )
  }
  if (direction && direction !== 'all')
    filters.push(eq(ledgerEntries.direction, direction))
  if (from) filters.push(gte(ledgerEntries.entryDate, from))
  if (to) filters.push(lte(ledgerEntries.entryDate, to))
  const where = filters.length > 0 ? and(...filters) : undefined

  const incomeWhere = where
    ? and(where, eq(ledgerEntries.direction, 'income'))
    : eq(ledgerEntries.direction, 'income')
  const expenseWhere = where
    ? and(where, eq(ledgerEntries.direction, 'expense'))
    : eq(ledgerEntries.direction, 'expense')

  const [items, totalRow, incomeRow, expenseRow] = await Promise.all([
    db
      .select()
      .from(ledgerEntries)
      .where(where)
      .orderBy(desc(ledgerEntries.entryDate), desc(ledgerEntries.createdAt))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(ledgerEntries).where(where),
    db
      .select({ value: sum(ledgerEntries.amountGross) })
      .from(ledgerEntries)
      .where(incomeWhere),
    db
      .select({ value: sum(ledgerEntries.amountGross) })
      .from(ledgerEntries)
      .where(expenseWhere)
  ])

  const total = Number(totalRow[0]?.value ?? 0)
  const result: ListResult<LedgerEntry> & {
    incomeSum?: number
    expenseSum?: number
  } = {
    items,
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size)),
    incomeSum: Number(incomeRow[0]?.value ?? 0),
    expenseSum: Number(expenseRow[0]?.value ?? 0)
  }
  return result
}

export async function createLedgerEntry(
  values: NewLedgerEntry
): Promise<LedgerEntry> {
  const [created] = await db.insert(ledgerEntries).values(values).returning()
  return created
}

export async function deleteLedgerEntry(id: string): Promise<void> {
  await db.delete(ledgerEntries).where(eq(ledgerEntries.id, id))
}

export async function getLedgerEntry(id: string): Promise<LedgerEntry | null> {
  const [row] = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.id, id))
    .limit(1)
  return row ?? null
}

export async function updateLedgerEntry(
  id: string,
  values: Partial<NewLedgerEntry>
): Promise<LedgerEntry> {
  const [row] = await db
    .update(ledgerEntries)
    .set(values)
    .where(eq(ledgerEntries.id, id))
    .returning()
  return row
}
