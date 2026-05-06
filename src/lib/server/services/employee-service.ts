import { db } from '$lib/server/db/client'
import {
  employeeSalaryVersions,
  employees,
  type Employee
} from '$lib/server/db/schema'
import { and, asc, count, desc, eq, ilike, lte, or, sql } from 'drizzle-orm'
import type { ListParams, ListResult } from '$lib/server/db/validation'

type NewEmployee = typeof employees.$inferInsert

export type SalaryVersion = typeof employeeSalaryVersions.$inferSelect

/**
 * Mitarbeiter-Datensatz angereichert um die jeweils aktuell gültige
 * Gehaltsversion (oder `null`, wenn noch keine angelegt wurde). Wird
 * von List- und Detail-Endpunkten zurückgegeben, damit die UI direkt
 * das aktuelle Brutto / den Stundenlohn rendern kann.
 */
export type EmployeeWithSalary = Employee & {
  monthlySalary: string | null
  hourlyWage: string | null
}

export async function listEmployees(
  params: ListParams & { archived?: boolean }
): Promise<ListResult<EmployeeWithSalary>> {
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
  const enriched = await Promise.all(
    items.map(async (e) => {
      const v = await getEffectiveSalary(e.id)
      return {
        ...e,
        monthlySalary: v?.monthlySalary ?? null,
        hourlyWage: v?.hourlyWage ?? null
      }
    })
  )
  return {
    items: enriched,
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

export async function getEmployee(
  id: string
): Promise<EmployeeWithSalary | null> {
  const [row] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, id))
    .limit(1)
  if (!row) return null
  const v = await getEffectiveSalary(id)
  return {
    ...row,
    monthlySalary: v?.monthlySalary ?? null,
    hourlyWage: v?.hourlyWage ?? null
  }
}

export async function nextPersonnelNumber(): Promise<string> {
  const [{ value }] = await db.select({ value: count() }).from(employees)
  return `MA-${String(Number(value) + 1).padStart(4, '0')}`
}

/* ── Versionierte Gehälter ─────────────────────────────────────────── */

const todayIso = (): string => new Date().toISOString().slice(0, 10)

/**
 * Liefert die zum Stichtag (`asOf`) gültige Gehaltsversion: die mit
 * dem höchsten `valid_from <= asOf`. Default-Stichtag ist heute.
 * Gibt `null` zurück, wenn kein Eintrag gespeichert ist.
 */
export const getEffectiveSalary = async (
  employeeId: string,
  asOf: string = todayIso()
): Promise<SalaryVersion | null> => {
  const [row] = await db
    .select()
    .from(employeeSalaryVersions)
    .where(
      and(
        eq(employeeSalaryVersions.employeeId, employeeId),
        lte(employeeSalaryVersions.validFrom, asOf)
      )
    )
    .orderBy(desc(employeeSalaryVersions.validFrom))
    .limit(1)
  return row ?? null
}

/**
 * Listet alle Gehaltsversionen aufsteigend nach `valid_from` —
 * neueste zuerst, damit die UI sie ohne weiteres Sortieren rendern
 * kann.
 */
export const listSalaryVersions = async (
  employeeId: string
): Promise<SalaryVersion[]> =>
  db
    .select()
    .from(employeeSalaryVersions)
    .where(eq(employeeSalaryVersions.employeeId, employeeId))
    .orderBy(desc(employeeSalaryVersions.validFrom))

/**
 * Schreibt eine neue Gehaltsversion. Wenn für `valid_from` schon eine
 * Zeile existiert, wird sie aktualisiert (sonst hätten wir ständig
 * Duplikate aus „Tippfehler korrigiert"-Workflows).
 */
export const upsertSalaryVersion = async (params: {
  employeeId: string
  validFrom: string
  monthlySalary: string | null
  hourlyWage: string | null
}): Promise<SalaryVersion> => {
  const [existing] = await db
    .select()
    .from(employeeSalaryVersions)
    .where(
      and(
        eq(employeeSalaryVersions.employeeId, params.employeeId),
        eq(employeeSalaryVersions.validFrom, params.validFrom)
      )
    )
    .limit(1)
  if (existing) {
    const [row] = await db
      .update(employeeSalaryVersions)
      .set({
        monthlySalary: params.monthlySalary,
        hourlyWage: params.hourlyWage
      })
      .where(eq(employeeSalaryVersions.id, existing.id))
      .returning()
    return row
  }
  const [row] = await db
    .insert(employeeSalaryVersions)
    .values({
      employeeId: params.employeeId,
      validFrom: params.validFrom,
      monthlySalary: params.monthlySalary,
      hourlyWage: params.hourlyWage
    })
    .returning()
  return row
}

export const deleteSalaryVersion = async (id: string): Promise<void> => {
  await db
    .delete(employeeSalaryVersions)
    .where(eq(employeeSalaryVersions.id, id))
}
