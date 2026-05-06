/**
 * Employee absence service — Urlaub, Krankheit, Sonstiges.
 *
 * Per the requirements (`anforderungen.md` §12), absences:
 * - are entered per employee with type, period, optional half-day flag
 *   and an optional attachment (e.g. AU-Bescheinigung scan);
 * - feed into the calendar and dashboard automatically;
 * - drive the remaining-vacation calculation (Resturlaub) on the
 *   employee detail view;
 * - feed payroll (vacation/sick days per period) — see
 *   {@link absenceDaysInPeriod}.
 *
 * Working-day model: weekends are skipped, half-days count as 0.5. The
 * model is intentionally conservative (no Feiertags-Awareness yet) — it
 * stays correct enough for typical Werkstatt-Schichtpläne and we leave
 * holiday-aware counting as a future iteration once the public-holidays
 * source becomes authoritative.
 */

import { and, eq, gte, inArray, lte, ne } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  employeeAbsences,
  employees,
  type EmployeeAbsence,
  type NewEmployeeAbsence
} from '$lib/server/db/schema'

/* ── Helpers ─────────────────────────────────────────────────────── */

const toDate = (s: string): Date => new Date(`${s}T00:00:00Z`)

/** Count business days (Mon–Fri) inclusive between two YYYY-MM-DD dates. */
const businessDaysBetween = (fromIso: string, toIso: string): number => {
  const start = toDate(fromIso).getTime()
  const end = toDate(toIso).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0
  const oneDay = 24 * 60 * 60 * 1000
  let n = 0
  for (let t = start; t <= end; t += oneDay) {
    const d = new Date(t).getUTCDay()
    if (d !== 0 && d !== 6) n += 1
  }
  return n
}

/** Number of (business) days that fall inside `[periodStart, periodEnd]`. */
const overlapBusinessDays = (
  absFrom: string,
  absTo: string,
  periodStart: string,
  periodEnd: string
): number => {
  const from = absFrom < periodStart ? periodStart : absFrom
  const to = absTo > periodEnd ? periodEnd : absTo
  if (from > to) return 0
  return businessDaysBetween(from, to)
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
 * Sum business days an employee was absent inside a period for a given
 * type. Half-day rows count as 0.5. Cancelled absences are skipped —
 * only `planned` and `approved` count toward the period balance.
 */
export const absenceDaysInPeriod = async (
  employeeId: string,
  type: 'vacation' | 'sick' | 'other',
  fromIso: string,
  toIso: string
): Promise<number> => {
  const rows = await db
    .select()
    .from(employeeAbsences)
    .where(
      and(
        eq(employeeAbsences.employeeId, employeeId),
        eq(employeeAbsences.type, type)
      )
    )
  let days = 0
  for (const a of rows) {
    if (a.status === 'cancelled') continue
    const span = overlapBusinessDays(a.dateFrom, a.dateTo, fromIso, toIso)
    days += a.halfDay ? Math.min(0.5, span) : span
  }
  return days
}

/**
 * Remaining vacation days for the current calendar year — entitlement
 * (`vacationDaysPerYear` from the employee record) minus the
 * year-to-date used vacation. Cancelled rows don't count.
 */
export const remainingVacationDays = async (
  employeeId: string,
  year: number = new Date().getUTCFullYear()
): Promise<{ entitled: number; used: number; remaining: number }> => {
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
    `${year}-12-31`
  )
  return { entitled, used, remaining: Math.max(0, entitled - used) }
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
