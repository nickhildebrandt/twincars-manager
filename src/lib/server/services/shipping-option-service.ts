import { db } from '$lib/server/db/client'
import { shippingOptions } from '$lib/server/db/schema'
import { and, asc, count, eq, ilike, or } from 'drizzle-orm'
import type { ListParams, ListResult } from '$lib/server/db/validation'

type ShippingOption = typeof shippingOptions.$inferSelect
type NewShippingOption = typeof shippingOptions.$inferInsert

/**
 * List shipping options with pagination + search.
 *
 * Ordering matches the storefront expectation: `sortOrder` ascending,
 * then `name` ascending as a stable tiebreaker.
 */
export async function listShippingOptions(
  params: ListParams & { active?: boolean }
): Promise<ListResult<ShippingOption>> {
  const { page, size, q, active } = params
  const offset = (page - 1) * size
  const filters = []
  if (q) {
    const term = `%${q}%`
    filters.push(
      or(
        ilike(shippingOptions.name, term),
        ilike(shippingOptions.description, term)
      )
    )
  }
  if (typeof active === 'boolean')
    filters.push(eq(shippingOptions.active, active))
  const where = filters.length > 0 ? and(...filters) : undefined

  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(shippingOptions)
      .where(where)
      .orderBy(asc(shippingOptions.sortOrder), asc(shippingOptions.name))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(shippingOptions).where(where)
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

/**
 * Load a single shipping option, or `null` if it doesn't exist.
 */
export async function getShippingOption(
  id: string
): Promise<ShippingOption | null> {
  const [row] = await db
    .select()
    .from(shippingOptions)
    .where(eq(shippingOptions.id, id))
    .limit(1)
  return row ?? null
}

/**
 * Insert a new shipping option row.
 */
export async function createShippingOption(
  values: NewShippingOption
): Promise<ShippingOption> {
  const [created] = await db.insert(shippingOptions).values(values).returning()
  return created
}

/**
 * Patch an existing shipping option. `updatedAt` is bumped automatically.
 */
export async function updateShippingOption(
  id: string,
  values: Partial<NewShippingOption>
): Promise<ShippingOption> {
  const [updated] = await db
    .update(shippingOptions)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(shippingOptions.id, id))
    .returning()
  return updated
}

/**
 * Hard-delete a shipping option by id. Idempotent.
 */
export async function deleteShippingOption(id: string): Promise<void> {
  await db.delete(shippingOptions).where(eq(shippingOptions.id, id))
}

/**
 * Return all active shipping options ordered by `sortOrder`, then `name`.
 *
 * Used by the Phase 7 public storefront API — the order matters because
 * the first entry is the suggested default at checkout.
 */
export async function listActiveShippingOptions(): Promise<ShippingOption[]> {
  return db
    .select()
    .from(shippingOptions)
    .where(eq(shippingOptions.active, true))
    .orderBy(asc(shippingOptions.sortOrder), asc(shippingOptions.name))
}
