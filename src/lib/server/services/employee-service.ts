import { db } from '$lib/server/db/client'
import { employees, type Employee } from '$lib/server/db/schema'
import { and, count, desc, eq, ilike, or } from 'drizzle-orm'
import type { ListParams, ListResult } from '$lib/server/db/validation'

type NewEmployee = typeof employees.$inferInsert

export async function listEmployees(
  params: ListParams & { archived?: boolean }
): Promise<ListResult<Employee>> {
  const { page, size, q, archived } = params
  const offset = (page - 1) * size
  const filters = []
  if (q) {
    const term = `%${q}%`
    filters.push(
      or(
        ilike(employees.firstName, term),
        ilike(employees.lastName, term),
        ilike(employees.personnelNumber, term),
        ilike(employees.position, term),
        ilike(employees.department, term)
      )
    )
  }
  if (typeof archived === 'boolean')
    filters.push(eq(employees.archived, archived))
  const where = filters.length > 0 ? and(...filters) : undefined

  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(employees)
      .where(where)
      .orderBy(desc(employees.createdAt))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(employees).where(where)
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

export async function createEmployee(values: NewEmployee): Promise<Employee> {
  const [created] = await db.insert(employees).values(values).returning()
  return created
}

export async function updateEmployee(
  id: string,
  values: Partial<NewEmployee>
): Promise<Employee> {
  const [updated] = await db
    .update(employees)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(employees.id, id))
    .returning()
  return updated
}

export async function deleteEmployee(id: string): Promise<void> {
  await db.delete(employees).where(eq(employees.id, id))
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const [row] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, id))
    .limit(1)
  return row ?? null
}

export async function nextPersonnelNumber(): Promise<string> {
  const [{ value }] = await db.select({ value: count() }).from(employees)
  return `MA-${String(Number(value) + 1).padStart(4, '0')}`
}
