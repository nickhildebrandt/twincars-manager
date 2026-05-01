import { db } from '$lib/server/db/client'
import { suppliers } from '$lib/server/db/schema'
import { and, count, desc, eq, ilike, or } from 'drizzle-orm'
import type { ListParams, ListResult } from '$lib/server/db/validation'

type Supplier = typeof suppliers.$inferSelect
type NewSupplier = typeof suppliers.$inferInsert

/**
 * List suppliers with pagination + search.
 */
export async function listSuppliers(
  params: ListParams & { archived?: boolean }
): Promise<ListResult<Supplier>> {
  const { page, size, q, archived } = params
  const offset = (page - 1) * size
  const filters = []
  if (q) {
    const term = `%${q}%`
    filters.push(
      or(
        ilike(suppliers.name, term),
        ilike(suppliers.city, term),
        ilike(suppliers.contactPerson, term),
        ilike(suppliers.email, term)
      )
    )
  }
  if (typeof archived === 'boolean')
    filters.push(eq(suppliers.archived, archived))
  const where = filters.length > 0 ? and(...filters) : undefined

  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(suppliers)
      .where(where)
      .orderBy(desc(suppliers.createdAt))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(suppliers).where(where)
  ])
  const total = Number(totalRow[0]?.value ?? 0)
  return {
    items,
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size))
  }
}

export async function createSupplier(values: NewSupplier): Promise<Supplier> {
  const [created] = await db.insert(suppliers).values(values).returning()
  return created
}

export async function updateSupplier(
  id: string,
  values: Partial<NewSupplier>
): Promise<Supplier> {
  const [updated] = await db
    .update(suppliers)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(suppliers.id, id))
    .returning()
  return updated
}

export async function deleteSupplier(id: string): Promise<void> {
  await db.delete(suppliers).where(eq(suppliers.id, id))
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const [row] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, id))
    .limit(1)
  return row ?? null
}
