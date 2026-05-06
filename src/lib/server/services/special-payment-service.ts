/**
 * Sonderzahlungen — Bonus / Prämie / sonstige Zahlung zusätzlich
 * zum regulären Lohn.
 *
 * Vereinfachte Datenstruktur: jede Sonderzahlung trägt eine
 * Anwendbarkeits-Spanne (`startMonth..endMonth`) und entscheidet
 * über `targetAll` oder die Junction-Tabelle, welche Mitarbeiter sie
 * erhalten. Der Auto-Payroll-Generator schlägt beim Befüllen einer
 * Periode `applicableSpecialPaymentsFor()` nach und fügt jede
 * passende Zahlung als zusätzliche `payroll_line_items`-Zeile ein.
 *
 * `kind`-Semantik:
 *   - `'one_time'`: gilt nur im `start_month` selbst (z.B. Weihnachten)
 *   - `'recurring'`: gilt jeden Monat in `[start_month, end_month]`
 */

import { and, asc, count, desc, eq, gte, ilike, lte, or } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  employees,
  specialPaymentEmployees,
  specialPayments,
  type NewSpecialPayment,
  type SpecialPayment
} from '$lib/server/db/schema'

export type SpecialPaymentInput = {
  label: string
  kind: 'one_time' | 'recurring'
  amount: number
  startMonth: string // YYYY-MM-01 (or any YYYY-MM-DD; we round to 01 below)
  endMonth?: string | null
  targetAll: boolean
  employeeIds?: string[]
  notes?: string | null
}

const monthStart = (iso: string): string => `${iso.slice(0, 7)}-01`

export type SpecialPaymentRow = SpecialPayment & { employeeIds: string[] }

export type SpecialPaymentList = {
  items: SpecialPaymentRow[]
  total: number
  page: number
  size: number
  pageCount: number
}

export const listSpecialPayments = async (
  page = 1,
  size = 25,
  kindFilter: 'all' | 'one_time' | 'recurring' = 'all',
  q?: string
): Promise<SpecialPaymentList> => {
  const offset = Math.max(0, (page - 1) * size)
  const filters = []
  if (kindFilter !== 'all') filters.push(eq(specialPayments.kind, kindFilter))
  if (q && q.trim().length > 0) {
    filters.push(ilike(specialPayments.label, `%${q.trim()}%`))
  }
  const where = filters.length > 0 ? and(...filters) : undefined
  const [all, totalRow] = await Promise.all([
    db
      .select()
      .from(specialPayments)
      .where(where)
      .orderBy(desc(specialPayments.startMonth))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(specialPayments).where(where)
  ])
  const total = Number(totalRow[0]?.value ?? 0)
  const result: SpecialPaymentList = {
    items: [],
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size))
  }
  if (all.length === 0) return result
  const links = await db.select().from(specialPaymentEmployees)
  const byPayment = new Map<string, string[]>()
  for (const l of links) {
    const arr = byPayment.get(l.paymentId) ?? []
    arr.push(l.employeeId)
    byPayment.set(l.paymentId, arr)
  }
  result.items = all.map((p) => ({
    ...p,
    employeeIds: byPayment.get(p.id) ?? []
  }))
  return result
}

export const getSpecialPayment = async (
  id: string
): Promise<SpecialPaymentRow | null> => {
  const [row] = await db
    .select()
    .from(specialPayments)
    .where(eq(specialPayments.id, id))
    .limit(1)
  if (!row) return null
  const links = await db
    .select({ employeeId: specialPaymentEmployees.employeeId })
    .from(specialPaymentEmployees)
    .where(eq(specialPaymentEmployees.paymentId, id))
  return { ...row, employeeIds: links.map((l) => l.employeeId) }
}

export const createSpecialPayment = async (
  input: SpecialPaymentInput
): Promise<SpecialPayment> => {
  const values: NewSpecialPayment = {
    label: input.label,
    kind: input.kind,
    amount: String(input.amount),
    startMonth: monthStart(input.startMonth),
    endMonth: input.endMonth ? monthStart(input.endMonth) : null,
    targetAll: input.targetAll,
    notes: input.notes ?? null
  }
  const [row] = await db.insert(specialPayments).values(values).returning()
  if (!input.targetAll && input.employeeIds && input.employeeIds.length > 0) {
    await db
      .insert(specialPaymentEmployees)
      .values(
        input.employeeIds.map((employeeId) => ({
          paymentId: row.id,
          employeeId
        }))
      )
  }
  return row
}

export const updateSpecialPayment = async (
  id: string,
  input: SpecialPaymentInput
): Promise<SpecialPayment> => {
  const [row] = await db
    .update(specialPayments)
    .set({
      label: input.label,
      kind: input.kind,
      amount: String(input.amount),
      startMonth: monthStart(input.startMonth),
      endMonth: input.endMonth ? monthStart(input.endMonth) : null,
      targetAll: input.targetAll,
      notes: input.notes ?? null,
      updatedAt: new Date()
    })
    .where(eq(specialPayments.id, id))
    .returning()
  // Junction wird komplett ersetzt — einfacher als Diff.
  await db
    .delete(specialPaymentEmployees)
    .where(eq(specialPaymentEmployees.paymentId, id))
  if (!input.targetAll && input.employeeIds && input.employeeIds.length > 0) {
    await db
      .insert(specialPaymentEmployees)
      .values(
        input.employeeIds.map((employeeId) => ({ paymentId: id, employeeId }))
      )
  }
  return row
}

export const deleteSpecialPayment = async (id: string): Promise<void> => {
  await db.delete(specialPayments).where(eq(specialPayments.id, id))
}

/**
 * Pull alle Sonderzahlungen, die in der Periode `(year, month)` für
 * den gegebenen Mitarbeiter greifen. Wird vom Auto-Payroll
 * aufgerufen und gibt einfache Strukturen zurück, die direkt als
 * `lineItems` in `upsertPayrollEntry` einfließen.
 */
export const applicableSpecialPaymentsFor = async (
  employeeId: string,
  year: number,
  month: number
): Promise<Array<{ label: string; amount: number }>> => {
  const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
  const allMatching = await db
    .select()
    .from(specialPayments)
    .where(
      and(
        lte(specialPayments.startMonth, periodStart),
        or(
          // recurring ohne endMonth oder mit endMonth >= periodStart
          eq(specialPayments.kind, 'recurring'),
          // one_time matcht exakt auf den startMonth
          eq(specialPayments.kind, 'one_time')
        )
      )
    )
  // Filter feiner: kind-spezifische Logik in JS.
  const candidates = allMatching.filter((p) => {
    if (p.kind === 'one_time') {
      return p.startMonth === periodStart
    }
    // recurring: startMonth <= period <= endMonth (oder unendlich)
    if (p.endMonth && p.endMonth < periodStart) return false
    return true
  })
  if (candidates.length === 0) return []

  // Mitarbeiter-Filter: targetAll || in junction
  const targetedIds = new Set<string>()
  const links = await db
    .select()
    .from(specialPaymentEmployees)
    .where(eq(specialPaymentEmployees.employeeId, employeeId))
  for (const l of links) targetedIds.add(l.paymentId)

  return candidates
    .filter((p) => p.targetAll || targetedIds.has(p.id))
    .map((p) => ({ label: p.label, amount: Number(p.amount) }))
}
