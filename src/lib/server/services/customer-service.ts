import { db } from '$lib/server/db/client'
import {
  customers,
  numberRanges,
  type Customer,
  type NewCustomer
} from '$lib/server/db/schema'
import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import type { ListParams, ListResult } from '$lib/server/db/validation'
import { renderNumber } from '$lib/utils/numbering'

/**
 * List customers with server-side pagination, search and sorting.
 * @param params pagination + free-text search query
 * @returns { items, total, page, size, pageCount }
 */
export async function listCustomers(
  params: ListParams & { archived?: boolean }
): Promise<ListResult<Customer>> {
  const { page, size, q, sort, archived } = params
  const offset = (page - 1) * size

  const filters = []
  if (q && q.length > 0) {
    const term = `%${q}%`
    filters.push(
      or(
        ilike(customers.customerNumber, term),
        ilike(customers.lastName, term),
        ilike(customers.firstName, term),
        ilike(customers.company, term),
        ilike(customers.city, term),
        ilike(customers.zip, term),
        ilike(customers.phone, term),
        ilike(customers.email, term)
      )
    )
  }
  if (typeof archived === 'boolean') {
    filters.push(eq(customers.archived, archived))
  }
  const where = filters.length > 0 ? and(...filters) : undefined

  const sortableMap: Record<
    string,
    ReturnType<typeof asc> | ReturnType<typeof desc>
  > = {
    customerNumber: asc(customers.customerNumber),
    '-customerNumber': desc(customers.customerNumber),
    lastName: asc(customers.lastName),
    '-lastName': desc(customers.lastName),
    city: asc(customers.city),
    '-city': desc(customers.city),
    createdAt: asc(customers.createdAt),
    '-createdAt': desc(customers.createdAt)
  }
  const orderBy = sortableMap[sort ?? '-createdAt'] ?? desc(customers.createdAt)

  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(where)
      .orderBy(orderBy)
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(customers).where(where)
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
 * Generate the next customer number from the configured range and bump it.
 */
export async function nextCustomerNumber(): Promise<string> {
  const [row] = await db
    .select()
    .from(numberRanges)
    .where(eq(numberRanges.kind, 'customer'))
    .limit(1)
  const template = row?.formatTemplate ?? 'KU-{NNNNN}'
  const next = row?.nextValue ?? 1
  await db
    .update(numberRanges)
    .set({ nextValue: next + 1 })
    .where(eq(numberRanges.kind, 'customer'))
  return renderNumber(template, next)
}

/**
 * Create a new customer record.
 */
export async function createCustomer(
  values: Omit<NewCustomer, 'customerNumber'> & { customerNumber?: string }
): Promise<Customer> {
  const number = values.customerNumber ?? (await nextCustomerNumber())
  const [created] = await db
    .insert(customers)
    .values({ ...values, customerNumber: number })
    .returning()
  return created
}

/**
 * Update an existing customer record.
 */
export async function updateCustomer(
  id: string,
  values: Partial<NewCustomer>
): Promise<Customer> {
  const [updated] = await db
    .update(customers)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(customers.id, id))
    .returning()
  return updated
}

/**
 * Delete a customer record.
 */
export async function deleteCustomer(id: string): Promise<void> {
  await db.delete(customers).where(eq(customers.id, id))
}

/**
 * Load a customer by id.
 */
export async function getCustomer(id: string): Promise<Customer | null> {
  const [row] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1)
  return row ?? null
}

/**
 * Total count helper used for dashboards.
 */
export async function countCustomers(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(customers)
    .where(eq(customers.archived, false))
  return Number(row?.value ?? 0)
}

// Re-exports for tests
export { sql }
