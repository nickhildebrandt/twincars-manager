/**
 * Employee absence service — Urlaub, Krankheit, Sonstiges.
 *
 * Per the requirements (`anforderungen.md` §12), absences:
 * - are entered per employee with type, period, optional half-day flag
 *   and an optional attachment (e.g. AU-Bescheinigung scan);
 * - feed into the calendar and dashboard automatically;
 * - drive the remaining-vacation calculation (Resturlaub) on the
 *   employee detail view.
 *
 * Working-day model: weekends and public holidays are skipped,
 * half-days count as 0.5. Holidays come from the algorithmic
 * holiday-service (no year limit), keyed on the company's Bundesland
 * from `company_settings.state` — unknown/unset Bundesland falls back
 * to the nine federal holidays.
 */

import { and, eq, gte, inArray, lte, ne } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  employeeAbsences,
  employees,
  type EmployeeAbsence,
  type NewEmployeeAbsence
} from '$lib/server/db/schema'
import {
  getCompanyHolidayState,
  isPublicHoliday,
  type GermanState
} from './holiday-service'

/* ── Helpers ─────────────────────────────────────────────────────── */

const toDate = (s: string): Date => new Date(`${s}T00:00:00Z`)

/**
 * Count working days inclusive between two YYYY-MM-DD dates: Mon–Fri,
 * minus the public holidays of `state`.
 */
const businessDaysBetween = (
  fromIso: string,
  toIso: string,
  state: GermanState
): number => {
  const start = toDate(fromIso).getTime()
  const end = toDate(toIso).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0
  const oneDay = 24 * 60 * 60 * 1000
  let n = 0
  for (let t = start; t <= end; t += oneDay) {
    const day = new Date(t)
    const d = day.getUTCDay()
    if (d === 0 || d === 6) continue
    if (isPublicHoliday(day.toISOString().slice(0, 10), state)) continue
    n += 1
  }
  return n
}

/** Number of working days that fall inside `[periodStart, periodEnd]`. */
const overlapBusinessDays = (
  absFrom: string,
  absTo: string,
  periodStart: string,
  periodEnd: string,
  state: GermanState
): number => {
  const from = absFrom < periodStart ? periodStart : absFrom
  const to = absTo > periodEnd ? periodEnd : absTo
  if (from > to) return 0
  return businessDaysBetween(from, to, state)
}

/**
 * Workdays of a single absence row (weekends and public holidays of
 * `state` skipped), optionally clamped to `[clampFrom, clampTo]`.
 * Cancelled rows count 0, half-day rows at most 0.5.
 */
export const absenceWorkdays = (
  a: {
    dateFrom: string
    dateTo: string
    halfDay?: boolean | null
    status?: string | null
  },
  state: GermanState,
  clampFrom?: string,
  clampTo?: string
): number => {
  if (a.status === 'cancelled') return 0
  const span = overlapBusinessDays(
    a.dateFrom,
    a.dateTo,
    clampFrom ?? a.dateFrom,
    clampTo ?? a.dateTo,
    state
  )
  return a.halfDay ? Math.min(0.5, span) : span
}

/* ── Queries ─────────────────────────────────────────────────────── */

export const getAbsence = async (
  id: string
): Promise<EmployeeAbsence | null> => {
  const [row] = await db
    .select()
    .from(employeeAbsences)
    .where(eq(employeeAbsences.id, id))
    .limit(1)
  return row ?? null
}

/**
 * Findet bestehende Urlaubs-/Krankheits-Einträge des Mitarbeiters, die
 * mit dem geplanten neuen Eintrag fachlich kollidieren: andere Art
 * (Urlaub vs. Krankheit), nicht abgesagt, und mit überlappendem
 * Datumsbereich. Sonstiges-Einträge werden bewusst ignoriert — sie
 * decken z.B. Schulungen ab und stehen nicht im Konflikt mit Urlaub
 * oder Krankheit.
 */
export const findVacationSickConflicts = async (params: {
  employeeId: string
  type: 'vacation' | 'sick' | 'other'
  dateFrom: string
  dateTo: string
  excludeId?: string
}): Promise<EmployeeAbsence[]> => {
  if (params.type !== 'vacation' && params.type !== 'sick') return []
  const otherType = params.type === 'vacation' ? 'sick' : 'vacation'
  const filters = [
    eq(employeeAbsences.employeeId, params.employeeId),
    eq(employeeAbsences.type, otherType),
    ne(employeeAbsences.status, 'cancelled'),
    lte(employeeAbsences.dateFrom, params.dateTo),
    gte(employeeAbsences.dateTo, params.dateFrom)
  ]
  if (params.excludeId) {
    filters.push(ne(employeeAbsences.id, params.excludeId))
  }
  return db
    .select()
    .from(employeeAbsences)
    .where(and(...filters))
    .orderBy(employeeAbsences.dateFrom)
}

export const listAbsencesForEmployee = async (
  employeeId: string,
  opts: { year?: number | null } = {}
): Promise<EmployeeAbsence[]> => {
  const filters = [eq(employeeAbsences.employeeId, employeeId)]
  if (opts.year != null) {
    // Overlap filter: dateFrom <= year-end AND dateTo >= year-start.
    const yStart = `${opts.year}-01-01`
    const yEnd = `${opts.year}-12-31`
    filters.push(lte(employeeAbsences.dateFrom, yEnd))
    filters.push(gte(employeeAbsences.dateTo, yStart))
  }
  return db
    .select()
    .from(employeeAbsences)
    .where(and(...filters))
    .orderBy(employeeAbsences.dateFrom)
}

export type AbsenceWithWorkdays = EmployeeAbsence & {
  /** Workdays over the full absence range. */
  workdays: number
  /**
   * Workdays clamped to the requested filter year — equals `workdays`
   * when no year filter is active. This is the number the UI shows so
   * that cross-year absences count per calendar year.
   */
  workdaysInYear: number
}

/**
 * Absence list enriched with server-computed workday counts (weekends
 * and the company Bundesland's public holidays skipped) so clients
 * never have to re-implement the business-day math.
 */
export const listAbsencesWithWorkdays = async (
  employeeId: string,
  opts: { year?: number | null } = {}
): Promise<AbsenceWithWorkdays[]> => {
  const [rows, state] = await Promise.all([
    listAbsencesForEmployee(employeeId, opts),
    getCompanyHolidayState()
  ])
  const clampFrom = opts.year != null ? `${opts.year}-01-01` : undefined
  const clampTo = opts.year != null ? `${opts.year}-12-31` : undefined
  return rows.map((a) => ({
    ...a,
    workdays: absenceWorkdays(a, state),
    workdaysInYear: absenceWorkdays(a, state, clampFrom, clampTo)
  }))
}

/**
 * Overlapping absences of the SAME type for the employee. Same-type
 * overlaps are always rejected upstream — they would double-count the
 * period (e.g. vacation days drawn twice from the allowance). Unlike
 * the vacation↔sick cross-type conflicts there is no replace flow.
 */
export const findSameTypeOverlaps = async (params: {
  employeeId: string
  type: 'vacation' | 'sick' | 'other'
  dateFrom: string
  dateTo: string
  excludeId?: string
}): Promise<EmployeeAbsence[]> => {
  const filters = [
    eq(employeeAbsences.employeeId, params.employeeId),
    eq(employeeAbsences.type, params.type),
    ne(employeeAbsences.status, 'cancelled'),
    lte(employeeAbsences.dateFrom, params.dateTo),
    gte(employeeAbsences.dateTo, params.dateFrom)
  ]
  if (params.excludeId) {
    filters.push(ne(employeeAbsences.id, params.excludeId))
  }
  return db
    .select()
    .from(employeeAbsences)
    .where(and(...filters))
    .orderBy(employeeAbsences.dateFrom)
}

export const listAbsencesInRange = async (
  fromIso: string,
  toIso: string
): Promise<EmployeeAbsence[]> =>
  db
    .select()
    .from(employeeAbsences)
    .where(
      and(
        lte(employeeAbsences.dateFrom, toIso),
        gte(employeeAbsences.dateTo, fromIso)
      )
    )

/**
 * Sum working days an employee was absent inside a period for a given
 * type — weekends and the company Bundesland's public holidays don't
 * count. Half-day rows count as 0.5. Cancelled absences are skipped —
 * only `planned` and `approved` count toward the period balance.
 */
export const absenceDaysInPeriod = async (
  employeeId: string,
  type: 'vacation' | 'sick' | 'other',
  fromIso: string,
  toIso: string,
  opts: { excludeId?: string } = {}
): Promise<number> => {
  const [rows, holidayState] = await Promise.all([
    db
      .select()
      .from(employeeAbsences)
      .where(
        and(
          eq(employeeAbsences.employeeId, employeeId),
          eq(employeeAbsences.type, type)
        )
      ),
    getCompanyHolidayState()
  ])
  let days = 0
  for (const a of rows) {
    if (a.status === 'cancelled') continue
    if (opts.excludeId && a.id === opts.excludeId) continue
    const span = overlapBusinessDays(
      a.dateFrom,
      a.dateTo,
      fromIso,
      toIso,
      holidayState
    )
    days += a.halfDay ? Math.min(0.5, span) : span
  }
  return days
}

/**
 * Remaining vacation days for a calendar year — entitlement
 * (`vacationDaysPerYear` from the employee record) minus the vacation
 * used in that year. Cancelled rows don't count; cross-year absences
 * are clamped to the year, so each calendar year is charged only its
 * own workdays. `opts.excludeId` leaves one row out of the "used"
 * count (needed when validating an update of that very row).
 */
export const remainingVacationDays = async (
  employeeId: string,
  year: number = new Date().getUTCFullYear(),
  opts: { excludeId?: string } = {}
): Promise<{
  year: number
  entitled: number
  used: number
  remaining: number
}> => {
  const [emp] = await db
    .select({ entitled: employees.vacationDaysPerYear })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1)
  const entitled = emp?.entitled ?? 0
  const used = await absenceDaysInPeriod(
    employeeId,
    'vacation',
    `${year}-01-01`,
    `${year}-12-31`,
    opts
  )
  return { year, entitled, used, remaining: Math.max(0, entitled - used) }
}

/**
 * Hard vacation-budget gate (design spec 2026-06-23, decision 4:
 * "harte Sperre"). Checks every calendar year the requested range
 * touches and returns the first violation, or `null` when the request
 * fits. Employees without a configured `vacationDaysPerYear` have no
 * limit (`null` = not configured — deliberately distinct from an
 * explicit 0).
 */
export const checkVacationBudget = async (params: {
  employeeId: string
  dateFrom: string
  dateTo: string
  halfDay?: boolean
  excludeId?: string
}): Promise<{ year: number; remaining: number; requested: number } | null> => {
  const [emp] = await db
    .select({ entitled: employees.vacationDaysPerYear })
    .from(employees)
    .where(eq(employees.id, params.employeeId))
    .limit(1)
  if (emp?.entitled == null) return null
  const state = await getCompanyHolidayState()
  const fromYear = Number(params.dateFrom.slice(0, 4))
  const toYear = Number(params.dateTo.slice(0, 4))
  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear)) return null
  for (let year = fromYear; year <= toYear; year++) {
    const requested = absenceWorkdays(
      {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        halfDay: params.halfDay ?? false
      },
      state,
      `${year}-01-01`,
      `${year}-12-31`
    )
    if (requested <= 0) continue
    const balance = await remainingVacationDays(params.employeeId, year, {
      excludeId: params.excludeId
    })
    if (requested > balance.remaining) {
      return { year, remaining: balance.remaining, requested }
    }
  }
  return null
}

/* ── Mutations ───────────────────────────────────────────────────── */

export type AbsenceInput = Omit<
  NewEmployeeAbsence,
  'id' | 'createdAt' | 'updatedAt'
>

export const createAbsence = async (
  input: AbsenceInput
): Promise<EmployeeAbsence> => {
  if (input.dateTo < input.dateFrom) {
    throw new Error('Bis-Datum darf nicht vor dem Von-Datum liegen.')
  }
  const [row] = await db.insert(employeeAbsences).values(input).returning()
  return row
}

export const updateAbsence = async (
  id: string,
  patch: Partial<AbsenceInput>
): Promise<EmployeeAbsence> => {
  if (patch.dateFrom && patch.dateTo && patch.dateTo < patch.dateFrom) {
    throw new Error('Bis-Datum darf nicht vor dem Von-Datum liegen.')
  }
  const [row] = await db
    .update(employeeAbsences)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(employeeAbsences.id, id))
    .returning()
  if (!row) throw new Error('Abwesenheit nicht gefunden.')
  return row
}

export const deleteAbsence = async (id: string): Promise<void> => {
  await db.delete(employeeAbsences).where(eq(employeeAbsences.id, id))
}

export const deleteAbsencesByIds = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return
  await db.delete(employeeAbsences).where(inArray(employeeAbsences.id, ids))
}
