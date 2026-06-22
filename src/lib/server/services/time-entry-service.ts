import { db } from '$lib/server/db/client'
import {
  customers,
  documents,
  employees,
  timeEntries,
  type TimeEntry
} from '$lib/server/db/schema'
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
  sum
} from 'drizzle-orm'
import type { ListResult } from '$lib/server/db/validation'

type NewTimeEntry = typeof timeEntries.$inferInsert

/**
 * A time-entry row joined to the human-readable fields the UI needs to
 * render the list without follow-up lookups: employee name, optional
 * customer name and optional document number.
 */
export type TimeEntryWithRefs = TimeEntry & {
  employeeFirstName: string
  employeeLastName: string
  employeeNumber: string
  customerName: string | null
  documentNumber: string | null
  documentType: string | null
}

export type ListTimeEntriesParams = {
  page: number
  size: number
  q?: string
  employeeId?: string
  dateFrom?: string
  dateTo?: string
  customerId?: string
  documentId?: string
}

/**
 * Paginated list of time entries, joined to employee + customer +
 * document for display. Newest entries first.
 */
export async function listTimeEntries(
  params: ListTimeEntriesParams
): Promise<ListResult<TimeEntryWithRefs>> {
  const {
    page,
    size,
    q,
    employeeId,
    dateFrom,
    dateTo,
    customerId,
    documentId
  } = params
  const offset = (page - 1) * size

  const filters = []
  if (q) {
    const term = `%${q}%`
    filters.push(
      or(
        ilike(timeEntries.task, term),
        ilike(timeEntries.note, term),
        ilike(employees.firstName, term),
        ilike(employees.lastName, term),
        ilike(employees.personnelNumber, term),
        ilike(customers.company, term),
        ilike(customers.lastName, term),
        ilike(documents.documentNumber, term)
      )
    )
  }
  if (employeeId) filters.push(eq(timeEntries.employeeId, employeeId))
  if (dateFrom) filters.push(gte(timeEntries.date, dateFrom))
  if (dateTo) filters.push(lte(timeEntries.date, dateTo))
  if (customerId) filters.push(eq(timeEntries.customerId, customerId))
  if (documentId) filters.push(eq(timeEntries.documentId, documentId))
  const where = filters.length > 0 ? and(...filters) : undefined

  const [rows, totalRow, sumRow] = await Promise.all([
    db
      .select({
        id: timeEntries.id,
        employeeId: timeEntries.employeeId,
        date: timeEntries.date,
        hours: timeEntries.hours,
        documentId: timeEntries.documentId,
        customerId: timeEntries.customerId,
        task: timeEntries.task,
        note: timeEntries.note,
        createdAt: timeEntries.createdAt,
        updatedAt: timeEntries.updatedAt,
        employeeFirstName: employees.firstName,
        employeeLastName: employees.lastName,
        employeeNumber: employees.personnelNumber,
        customerCompany: customers.company,
        customerLastName: customers.lastName,
        documentNumber: documents.documentNumber,
        documentType: documents.type
      })
      .from(timeEntries)
      .leftJoin(employees, eq(timeEntries.employeeId, employees.id))
      .leftJoin(customers, eq(timeEntries.customerId, customers.id))
      .leftJoin(documents, eq(timeEntries.documentId, documents.id))
      .where(where)
      .orderBy(desc(timeEntries.date), desc(timeEntries.createdAt))
      .limit(size)
      .offset(offset),
    db
      .select({ value: count() })
      .from(timeEntries)
      .leftJoin(employees, eq(timeEntries.employeeId, employees.id))
      .leftJoin(customers, eq(timeEntries.customerId, customers.id))
      .leftJoin(documents, eq(timeEntries.documentId, documents.id))
      .where(where),
    db
      .select({ value: sum(timeEntries.hours) })
      .from(timeEntries)
      .leftJoin(employees, eq(timeEntries.employeeId, employees.id))
      .leftJoin(customers, eq(timeEntries.customerId, customers.id))
      .leftJoin(documents, eq(timeEntries.documentId, documents.id))
      .where(where)
  ])

  const total = Number(totalRow[0]?.value ?? 0)
  const totalHours = Number(sumRow[0]?.value ?? 0)
  const items: TimeEntryWithRefs[] = rows.map((row) => {
    const {
      customerCompany,
      customerLastName,
      employeeFirstName,
      employeeLastName,
      employeeNumber,
      ...rest
    } = row
    return {
      ...(rest as unknown as TimeEntry),
      employeeFirstName: employeeFirstName ?? '',
      employeeLastName: employeeLastName ?? '',
      employeeNumber: employeeNumber ?? '',
      customerName: customerCompany ?? customerLastName ?? null,
      documentNumber: rest.documentNumber ?? null,
      documentType: rest.documentType ?? null
    }
  })

  return {
    items,
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size)),
    // Convenience field used by the list page's footer summary. The
    // generic `ListResult<T>` type is unaware of it, but TypeScript's
    // structural typing lets callers reach for it freely.
    totalHours
  } as ListResult<TimeEntryWithRefs> & { totalHours: number }
}

/**
 * Load a single time entry joined to its employee / customer / document
 * references — same shape as the list rows so the detail page can reuse
 * the formatting helpers.
 */
export async function getTimeEntry(
  id: string
): Promise<TimeEntryWithRefs | null> {
  const [row] = await db
    .select({
      id: timeEntries.id,
      employeeId: timeEntries.employeeId,
      date: timeEntries.date,
      hours: timeEntries.hours,
      documentId: timeEntries.documentId,
      customerId: timeEntries.customerId,
      task: timeEntries.task,
      note: timeEntries.note,
      createdAt: timeEntries.createdAt,
      updatedAt: timeEntries.updatedAt,
      employeeFirstName: employees.firstName,
      employeeLastName: employees.lastName,
      employeeNumber: employees.personnelNumber,
      customerCompany: customers.company,
      customerLastName: customers.lastName,
      documentNumber: documents.documentNumber,
      documentType: documents.type
    })
    .from(timeEntries)
    .leftJoin(employees, eq(timeEntries.employeeId, employees.id))
    .leftJoin(customers, eq(timeEntries.customerId, customers.id))
    .leftJoin(documents, eq(timeEntries.documentId, documents.id))
    .where(eq(timeEntries.id, id))
    .limit(1)
  if (!row) return null
  const {
    customerCompany,
    customerLastName,
    employeeFirstName,
    employeeLastName,
    employeeNumber,
    ...rest
  } = row
  return {
    ...(rest as unknown as TimeEntry),
    employeeFirstName: employeeFirstName ?? '',
    employeeLastName: employeeLastName ?? '',
    employeeNumber: employeeNumber ?? '',
    customerName: customerCompany ?? customerLastName ?? null,
    documentNumber: rest.documentNumber ?? null,
    documentType: rest.documentType ?? null
  }
}

export async function createTimeEntry(
  values: NewTimeEntry
): Promise<TimeEntry> {
  const [created] = await db.insert(timeEntries).values(values).returning()
  return created
}

export async function updateTimeEntry(
  id: string,
  values: Partial<NewTimeEntry>
): Promise<TimeEntry> {
  const [updated] = await db
    .update(timeEntries)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(timeEntries.id, id))
    .returning()
  return updated
}

export async function deleteTimeEntry(id: string): Promise<void> {
  await db.delete(timeEntries).where(eq(timeEntries.id, id))
}

export type UtilizationRow = {
  employeeId: string
  employeeName: string
  totalHours: number
  billableHours: number
  daysLogged: number
}

export type UtilizationSummary = {
  rows: UtilizationRow[]
  totals: { totalHours: number; billableHours: number; daysLogged: number }
}

/**
 * Aggregate hours per employee for a date range. "Billable" hours are
 * entries that link to a document (offer/invoice/order). `daysLogged`
 * counts distinct calendar dates the employee logged anything on.
 */
export async function utilizationSummary(params: {
  from: string
  to: string
  employeeId?: string
}): Promise<UtilizationSummary> {
  const { from, to, employeeId } = params
  const filters = [gte(timeEntries.date, from), lte(timeEntries.date, to)]
  if (employeeId) filters.push(eq(timeEntries.employeeId, employeeId))
  const where = and(...filters)

  const rows = await db
    .select({
      employeeId: timeEntries.employeeId,
      firstName: employees.firstName,
      lastName: employees.lastName,
      personnelNumber: employees.personnelNumber,
      totalHours: sum(timeEntries.hours),
      billableHours: sum(
        sql<string>`CASE WHEN ${timeEntries.documentId} IS NOT NULL THEN ${timeEntries.hours} ELSE 0 END`
      ),
      daysLogged: countDistinct(timeEntries.date)
    })
    .from(timeEntries)
    .leftJoin(employees, eq(timeEntries.employeeId, employees.id))
    .where(where)
    .groupBy(
      timeEntries.employeeId,
      employees.firstName,
      employees.lastName,
      employees.personnelNumber
    )
    .orderBy(asc(employees.lastName), asc(employees.firstName))

  const result: UtilizationRow[] = rows.map((r) => ({
    employeeId: r.employeeId,
    employeeName:
      `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() ||
      r.personnelNumber ||
      '—',
    totalHours: Number(r.totalHours ?? 0),
    billableHours: Number(r.billableHours ?? 0),
    daysLogged: Number(r.daysLogged ?? 0)
  }))

  const totals = result.reduce(
    (acc, r) => ({
      totalHours: acc.totalHours + r.totalHours,
      billableHours: acc.billableHours + r.billableHours,
      daysLogged: acc.daysLogged + r.daysLogged
    }),
    { totalHours: 0, billableHours: 0, daysLogged: 0 }
  )

  return { rows: result, totals }
}

export type MonthlyReportRow = {
  employeeId: string
  employeeName: string
  totalHours: number
  daysLogged: number
  avgHoursPerDay: number
}

const padMonth = (m: number): string => String(m).padStart(2, '0')

/**
 * Compute the first day of the month (inclusive) and the first day of
 * the following month (exclusive) for use as a half-open date range.
 */
function monthBounds(
  year: number,
  month: number
): { from: string; toExclusive: string } {
  const from = `${year}-${padMonth(month)}-01`
  const next =
    month === 12 ? `${year + 1}-01-01` : `${year}-${padMonth(month + 1)}-01`
  return { from, toExclusive: next }
}

/**
 * One row per employee with logged hours in the given month. Employees
 * without any entries in the month are simply omitted — the caller
 * gets an empty array rather than zero-rows for everybody.
 */
export async function monthlyReport(params: {
  year: number
  month: number
}): Promise<MonthlyReportRow[]> {
  const { from, toExclusive } = monthBounds(params.year, params.month)

  const rows = await db
    .select({
      employeeId: timeEntries.employeeId,
      firstName: employees.firstName,
      lastName: employees.lastName,
      personnelNumber: employees.personnelNumber,
      totalHours: sum(timeEntries.hours),
      daysLogged: countDistinct(timeEntries.date)
    })
    .from(timeEntries)
    .leftJoin(employees, eq(timeEntries.employeeId, employees.id))
    .where(
      and(
        gte(timeEntries.date, from),
        sql`${timeEntries.date} < ${toExclusive}`
      )
    )
    .groupBy(
      timeEntries.employeeId,
      employees.firstName,
      employees.lastName,
      employees.personnelNumber
    )
    .orderBy(asc(employees.lastName), asc(employees.firstName))

  return rows.map((r) => {
    const totalHours = Number(r.totalHours ?? 0)
    const daysLogged = Number(r.daysLogged ?? 0)
    return {
      employeeId: r.employeeId,
      employeeName:
        `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() ||
        r.personnelNumber ||
        '—',
      totalHours,
      daysLogged,
      avgHoursPerDay:
        daysLogged > 0 ? Math.round((totalHours / daysLogged) * 100) / 100 : 0
    }
  })
}
