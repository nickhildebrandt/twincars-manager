import { db } from '$lib/server/db/client'
import { vehicles, type Vehicle, type NewVehicle } from '$lib/server/db/schema'
import { and, asc, count, desc, eq, ilike, isNull, or } from 'drizzle-orm'
import type { ListParams, ListResult } from '$lib/server/db/validation'

/**
 * List vehicles with server-side pagination + search.
 */
export async function listVehicles(
  params: ListParams & { archived?: boolean; stockOnly?: boolean }
): Promise<ListResult<Vehicle>> {
  const { page, size, q, archived, stockOnly } = params
  const offset = (page - 1) * size

  const filters = []
  if (q) {
    const term = `%${q}%`
    filters.push(
      or(
        ilike(vehicles.licensePlate, term),
        ilike(vehicles.vin, term),
        ilike(vehicles.make, term),
        ilike(vehicles.model, term)
      )
    )
  }
  if (typeof archived === 'boolean') {
    filters.push(eq(vehicles.archived, archived))
  }
  if (stockOnly) {
    filters.push(isNull(vehicles.customerId))
  }
  const where = filters.length > 0 ? and(...filters) : undefined

  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(vehicles)
      .where(where)
      .orderBy(desc(vehicles.createdAt))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(vehicles).where(where)
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

export async function createVehicle(values: NewVehicle): Promise<Vehicle> {
  const [created] = await db.insert(vehicles).values(values).returning()
  return created
}

export async function updateVehicle(
  id: string,
  values: Partial<NewVehicle>
): Promise<Vehicle> {
  const [updated] = await db
    .update(vehicles)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(vehicles.id, id))
    .returning()
  return updated
}

export async function deleteVehicle(id: string): Promise<void> {
  await db.delete(vehicles).where(eq(vehicles.id, id))
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const [row] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, id))
    .limit(1)
  return row ?? null
}

export async function countVehicles(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(vehicles)
    .where(eq(vehicles.archived, false))
  return Number(row?.value ?? 0)
}

export { asc }
