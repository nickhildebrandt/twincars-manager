import { command, query } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  array,
  boolean,
  integer,
  maxLength,
  maxValue,
  minValue,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
  trim
} from 'valibot'
import { idSchema } from '$lib/server/db/validation'
import { db } from '$lib/server/db/client'
import { employees } from '$lib/server/db/schema'
import {
  approvePayrollEntry,
  autoGeneratePayrollEntries,
  autoSendPayrollEmails,
  cancelPayrollEntry,
  deletePayrollEntry,
  ensurePayrollPeriod,
  findEntryFor,
  generateEntriesForPeriod,
  getPayrollEntry,
  getPayrollPeriod,
  listAllPayrollEntries,
  listEntriesForPeriod,
  listPayrollPeriods,
  setPeriodStatus,
  upsertPayrollEntry
} from '$lib/server/services/payroll-service'
import { asc, eq } from 'drizzle-orm'

/**
 * List payroll periods (newest first).
 *
 * @group integration
 * @module payroll
 */
export const listPayrollPeriodsRemote = query(async () => {
  return listPayrollPeriods()
})

/**
 * Show a period detail: the period row + all entries joined with the
 * employee names so the table can render without a second round-trip.
 *
 * @group integration
 * @module payroll
 */
export const getPayrollPeriodRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    const period = await getPayrollPeriod(id)
    if (!period) error(404, 'Periode nicht gefunden.')
    const entries = await listEntriesForPeriod(id)
    const empRows = await db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        personnelNumber: employees.personnelNumber,
        archived: employees.archived,
        privateEmail: employees.privateEmail
      })
      .from(employees)
      .orderBy(asc(employees.lastName))
    const empById = new Map(empRows.map((e) => [e.id, e]))
    const rows = entries.map((e) => {
      const emp = empById.get(e.employeeId)
      return {
        ...e,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : '—',
        personnelNumber: emp?.personnelNumber ?? null
      }
    })
    return {
      period,
      entries: rows,
      employees: empRows.filter((e) => !e.archived)
    }
  }
)

/**
 * Single entry with its line items + deductions, for the editor view.
 *
 * @group integration
 * @module payroll
 */
export const getPayrollEntryRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    const e = await getPayrollEntry(id)
    if (!e) error(404, 'Eintrag nicht gefunden.')
    const [emp] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, e.employeeId))
      .limit(1)
    if (!emp) error(404, 'Mitarbeiter nicht gefunden.')
    return { entry: e, employee: emp }
  }
)

/**
 * Find an entry by (period, employee). Returns null if none exists yet
 * — the entry editor uses that to decide whether to render a fresh
 * skeleton vs. load existing values.
 *
 * @group integration
 * @module payroll
 */
export const findEntryRemote = query(
  object({ periodId: idSchema, employeeId: idSchema }),
  async ({ periodId, employeeId }) => {
    const e = await findEntryFor(periodId, employeeId)
    if (!e) return null
    const full = await getPayrollEntry(e.id)
    return full
  }
)

/**
 * Create a new period for `year` + `month` (no-op if it already exists).
 *
 * @group integration
 * @module payroll
 */
export const createPayrollPeriodRemote = command(
  object({
    year: pipe(number(), integer(), minValue(2000), maxValue(2100)),
    month: pipe(number(), integer(), minValue(1), maxValue(12))
  }),
  async ({ year, month }) => {
    const row = await ensurePayrollPeriod(year, month)
    void listPayrollPeriodsRemote().refresh()
    return row
  }
)

export const setPayrollPeriodStatusRemote = command(
  object({ id: idSchema, status: picklist(['open', 'approved', 'closed']) }),
  async ({ id, status }) => {
    const row = await setPeriodStatus(id, status)
    await Promise.all([
      getPayrollPeriodRemote({ id }).refresh(),
      listPayrollPeriodsRemote().refresh()
    ])
    return row
  }
)

const lineItemSchema = object({
  kind: pipe(string(), trim(), maxLength(30)),
  label: pipe(string(), trim(), maxLength(200)),
  quantity: optional(number()),
  unit: optional(pipe(string(), trim(), maxLength(20))),
  rate: optional(number()),
  amount: number(),
  notes: optional(pipe(string(), trim(), maxLength(2000)))
})

const deductionSchema = object({
  kind: pipe(string(), trim(), maxLength(30)),
  label: pipe(string(), trim(), maxLength(200)),
  amount: number(),
  isEmployer: optional(boolean()),
  notes: optional(pipe(string(), trim(), maxLength(2000)))
})

/**
 * Save (create or replace) the payroll entry for a (period, employee).
 *
 * @group integration
 * @module payroll
 */
export const upsertPayrollEntryRemote = command(
  object({
    periodId: idSchema,
    employeeId: idSchema,
    workingDays: optional(pipe(number(), integer(), minValue(0), maxValue(31))),
    payoutDate: optional(pipe(string(), trim(), maxLength(10))),
    payoutMethod: optional(pipe(string(), trim(), maxLength(30))),
    notes: optional(pipe(string(), trim(), maxLength(4000))),
    lineItems: array(lineItemSchema),
    deductions: array(deductionSchema)
  }),
  async (input) => {
    try {
      const row = await upsertPayrollEntry(input)
      await getPayrollPeriodRemote({ id: input.periodId }).refresh()
      return row
    } catch (e) {
      if (e instanceof Error) error(400, e.message)
      throw e
    }
  }
)

export const approveEntryRemote = command(
  object({ id: idSchema, periodId: idSchema }),
  async ({ id, periodId }) => {
    const row = await approvePayrollEntry(id)
    await getPayrollPeriodRemote({ id: periodId }).refresh()
    return row
  }
)

export const cancelEntryRemote = command(
  object({ id: idSchema, periodId: idSchema }),
  async ({ id, periodId }) => {
    const row = await cancelPayrollEntry(id)
    await getPayrollPeriodRemote({ id: periodId }).refresh()
    return row
  }
)

export const deleteEntryRemote = command(
  object({ id: idSchema, periodId: idSchema }),
  async ({ id, periodId }) => {
    await deletePayrollEntry(id)
    await getPayrollPeriodRemote({ id: periodId }).refresh()
  }
)

/**
 * Auto-generate draft entries for every active employee in this period.
 * Idempotent — already-booked employees are skipped. Used by the
 * "Alle Mitarbeiter abrechnen" button on the period detail page; the
 * scheduler (future iteration) calls the same service helper.
 *
 * @group integration
 * @module payroll
 */
export const autoGenerateEntriesRemote = command(
  object({ periodId: idSchema }),
  async ({ periodId }) => {
    try {
      const stats = await generateEntriesForPeriod(periodId)
      await getPayrollPeriodRemote({ id: periodId }).refresh()
      return stats
    } catch (e) {
      if (e instanceof Error) error(400, e.message)
      throw e
    }
  }
)

/**
 * Cross-period flat list of all payroll entries with employee + period
 * info joined in. Backs the new /payroll main view: a single
 * paginated table sorted newest-first.
 *
 * @group integration
 * @module payroll
 */
export const listAllPayrollEntriesRemote = query(
  object({
    page: number(),
    size: picklist([10, 25, 50, 100]),
    year: optional(number()),
    employeeId: optional(idSchema)
  }),
  async ({ page, size, year, employeeId }) =>
    listAllPayrollEntries(page, size, { year, employeeId })
)

/**
 * Lazy auto-generation: ensure every month from earliest hire date up
 * to (current minus stichtag-cutoff) has periods + entries. Called on
 * /payroll page load. Idempotent.
 *
 * @group integration
 * @module payroll
 */
export const ensureAutoPayrollRemote = query(async () => {
  return autoGeneratePayrollEntries()
})

/**
 * Versand-Pendant: schickt alle freigegebenen, noch nicht versendeten
 * Lohnabrechnungen per Mail an den Mitarbeiter und schaltet
 * `payroll_entries.status` auf `sent`. Wird auf der /payroll-Seite
 * direkt nach `ensureAutoPayrollRemote` aufgerufen — und vom Tages-
 * Scheduler in `hooks.server.ts`.
 *
 * @group integration
 * @module payroll
 */
export const ensureAutoPayrollSendRemote = query(async () => {
  return autoSendPayrollEmails()
})
