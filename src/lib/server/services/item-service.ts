import { db } from '$lib/server/db/client'
import { items } from '$lib/server/db/schema'
import { and, count, desc, eq, ilike, or } from 'drizzle-orm'
import type { ListParams, ListResult } from '$lib/server/db/validation'

type Item = typeof items.$inferSelect
type NewItem = typeof items.$inferInsert

export async function listItems(
  params: ListParams & { kind?: string }
): Promise<ListResult<Item>> {
  const { page, size, q, kind } = params
  const offset = (page - 1) * size
  const filters = []
  if (q) {
    const term = `%${q}%`
    filters.push(
      or(ilike(items.articleNumber, term), ilike(items.description, term))
    )
  }
  if (kind) filters.push(eq(items.kind, kind))
  const where = filters.length > 0 ? and(...filters) : undefined

  const [list, totalRow] = await Promise.all([
    db
      .select()
      .from(items)
      .where(where)
      .orderBy(desc(items.createdAt))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(items).where(where)
  ])
  const total = Number(totalRow[0]?.value ?? 0)
  return {
    items: list,
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size))
  }
}

export async function createItem(values: NewItem): Promise<Item> {
  const [created] = await db.insert(items).values(values).returning()
  return created
}

export async function updateItem(
  id: string,
  values: Partial<NewItem>
): Promise<Item> {
  const [updated] = await db
    .update(items)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(items.id, id))
    .returning()
  return updated
}

export async function deleteItem(id: string): Promise<void> {
  await db.delete(items).where(eq(items.id, id))
}

export async function getItem(id: string): Promise<Item | null> {
  const [row] = await db.select().from(items).where(eq(items.id, id)).limit(1)
  return row ?? null
}

export async function nextArticleNumber(): Promise<string> {
  const [{ value }] = await db.select({ value: count() }).from(items)
  return `ART-${String(Number(value) + 1).padStart(5, '0')}`
}
