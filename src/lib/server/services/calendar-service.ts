/**
 * Calendar service — single source of truth for `calendar_entries` and
 * the four other event sources the calendar grid renders
 * (employee absences, business holidays).
 *
 * `calendar_entries` is a discriminated table: `kind` is either
 * `'appointment'` or `'closure'`. The form/remote layer enforces the
 * per-kind invariants (status nullability, link nullability, allDay
 * forced for closures) — this layer just inserts/reads.
 *
 * The `listCalendarEvents` query returns flat date-tagged rows so the
 * calendar grid only has to bucket by `dateIso`. Multi-day entries
 * (closures spanning a whole week, all-day appointments spanning two
 * days) expand into one row per covered day.
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  lte
} from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  calendarEntries,
  customers,
  employeeAbsences,
  employees,
  publicHolidays,
  vehicles,
  type CalendarEntry,
  type NewCalendarEntry
} from '$lib/server/db/schema'
import type { ListParams, ListResult } from '$lib/server/db/validation'
import { latestPlateSubquery } from './vehicle-service'

export type CalendarEventKind =
  | 'appointment'
  | 'business_closure'
  | 'employee_vacation'
  | 'employee_sick'
  | 'employee_other'
  | 'public_holiday'
  | 'hu_due'

export type CalendarEvent = {
  id: string
  kind: CalendarEventKind
  /** YYYY-MM-DD; for multi-day events one row per day. */
  dateIso: string
  title: string
  startsAt?: Date | null
  endsAt?: Date | null
  /** Optional id back to the source row for click-through. */
  sourceId?: string
  employeeId?: string | null
  customerId?: string | null
  vehicleId?: string | null
}

const dateToIso = (d: Date): string => d.toISOString().slice(0, 10)
const oneDay = 24 * 60 * 60 * 1000

const expandDays = (fromIso: string, toIsoStr: string): string[] => {
  const out: string[] = []
  const start = new Date(`${fromIso}T00:00:00Z`).getTime()
  const end = new Date(`${toIsoStr}T00:00:00Z`).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return out
  for (let t = start; t <= end; t += oneDay) {
    out.push(dateToIso(new Date(t)))
  }
  return out
}

/**
 * Pull every event that overlaps `[fromIso, toIso]`. Three sources:
 * `calendar_entries` (split into appointment / closure rows by `kind`),
 * `employee_absences` (vacation / sick / other), and `public_holidays`.
 * Filtering by employee narrows the calendar entries (those that link
 * to that employee) and the absences (their owner).
 */
export const listCalendarEvents = async (
  fromIso: string,
  toIso: string,
  employeeId?: string | null
): Promise<CalendarEvent[]> => {
  const fromTs = new Date(`${fromIso}T00:00:00Z`)
  const toTs = new Date(`${toIso}T23:59:59Z`)

  const [entries, absences, holidays, empRows, huRows] = await Promise.all([
    db
      .select({
        id: calendarEntries.id,
        kind: calendarEntries.kind,
        title: calendarEntries.title,
        startsAt: calendarEntries.startsAt,
        endsAt: calendarEntries.endsAt,
        allDay: calendarEntries.allDay,
        status: calendarEntries.status,
        employeeId: calendarEntries.employeeId,
        customerId: calendarEntries.customerId,
        vehicleId: calendarEntries.vehicleId
      })
      .from(calendarEntries)
      .where(
        and(
          // Inclusive overlap with [from, to].
          lte(calendarEntries.startsAt, toTs),
          gte(calendarEntries.endsAt, fromTs),
          employeeId ? eq(calendarEntries.employeeId, employeeId) : undefined
        )
      ),
    db
      .select()
      .from(employeeAbsences)
      .where(
        and(
          lte(employeeAbsences.dateFrom, toIso),
          gte(employeeAbsences.dateTo, fromIso),
          employeeId ? eq(employeeAbsences.employeeId, employeeId) : undefined
        )
      ),
    db
      .select()
      .from(publicHolidays)
      .where(
        and(gte(publicHolidays.date, fromIso), lte(publicHolidays.date, toIso))
      ),
    db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName
      })
      .from(employees),
    // HU-Fälligkeiten: Datum-Spalte direkt aus vehicles. Kein eigener
    // Termin-Eintrag — abgeleitet aus dem Stammdatensatz. Aktuelles
    // Kennzeichen kommt per Subquery aus `vehicle_license_plate_versions`.
    (() => {
      const lp = latestPlateSubquery()
      return db
        .select({
          id: vehicles.id,
          plate: lp.licensePlate,
          make: vehicles.make,
          model: vehicles.model,
          nextHu: vehicles.nextHu
        })
        .from(vehicles)
        .leftJoin(lp, eq(lp.vehicleId, vehicles.id))
        .where(
          and(
            eq(vehicles.archived, false),
            isNotNull(vehicles.nextHu),
            gte(vehicles.nextHu, fromIso),
            lte(vehicles.nextHu, toIso)
          )
        )
    })()
  ])
  const empById = new Map(empRows.map((e) => [e.id, e]))
  const empLabel = (id: string | null | undefined): string => {
    if (!id) return ''
    const e = empById.get(id)
    return e ? ` · ${e.firstName} ${e.lastName}` : ''
  }

  const out: CalendarEvent[] = []
  for (const e of entries) {
    if (e.kind === 'appointment') {
      if (e.status === 'cancelled') continue
      // All-day appointments span their full date range; timed ones
      // sit on their start day. Both expand to one row per covered
      // day so the grid can render them.
      const days = e.allDay
        ? expandDays(dateToIso(e.startsAt), dateToIso(e.endsAt))
        : [dateToIso(e.startsAt)]
      for (const dateIso of days) {
        out.push({
          id: `appt-${e.id}-${dateIso}`,
          kind: 'appointment',
          dateIso,
          title: e.title + empLabel(e.employeeId),
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          sourceId: e.id,
          employeeId: e.employeeId,
          customerId: e.customerId,
          vehicleId: e.vehicleId
        })
      }
    } else if (e.kind === 'closure') {
      const fromIsoStr = dateToIso(e.startsAt)
      const toIsoStr = dateToIso(e.endsAt)
      for (const dateIso of expandDays(fromIsoStr, toIsoStr)) {
        out.push({
          id: `clo-${e.id}-${dateIso}`,
          kind: 'business_closure',
          dateIso,
          title: `Betriebsschließung — ${e.title}`,
          sourceId: e.id
        })
      }
    }
  }
  for (const ab of absences) {
    if (ab.status === 'cancelled') continue
    const kind: CalendarEventKind =
      ab.type === 'vacation'
        ? 'employee_vacation'
        : ab.type === 'sick'
          ? 'employee_sick'
          : 'employee_other'
    const label =
      ab.type === 'vacation'
        ? 'Urlaub'
        : ab.type === 'sick'
          ? 'Krankheit'
          : 'Abwesenheit'
    for (const dateIso of expandDays(ab.dateFrom, ab.dateTo)) {
      out.push({
        id: `abs-${ab.id}-${dateIso}`,
        kind,
        dateIso,
        title: `${label}${empLabel(ab.employeeId)}`,
        sourceId: ab.id,
        employeeId: ab.employeeId
      })
    }
  }
  for (const h of holidays) {
    out.push({
      id: `hol-${h.id}`,
      kind: 'public_holiday',
      dateIso: h.date,
      title: h.name,
      sourceId: h.id
    })
  }
  for (const v of huRows) {
    if (!v.nextHu) continue
    const label = [v.make, v.model].filter(Boolean).join(' ') || v.plate || '—'
    const plate = v.plate ? ` · ${v.plate}` : ''
    out.push({
      id: `hu-${v.id}`,
      kind: 'hu_due',
      dateIso: v.nextHu,
      title: `HU: ${label}${plate}`,
      sourceId: v.id,
      vehicleId: v.id
    })
  }
  return out
}

/* ── Appointments list (kind='appointment' only) ────────────────── */

export type AppointmentRow = CalendarEntry & {
  customerName: string | null
  vehicleLabel: string | null
  employeeName: string | null
}

export async function listAppointments(
  params: ListParams & { from?: string; to?: string }
): Promise<ListResult<AppointmentRow>> {
  const { page, size, q, from, to } = params
  const offset = (page - 1) * size

  const filters = [eq(calendarEntries.kind, 'appointment')]
  if (q) filters.push(ilike(calendarEntries.title, `%${q}%`))
  if (from) filters.push(gte(calendarEntries.startsAt, new Date(from)))
  if (to) filters.push(lte(calendarEntries.startsAt, new Date(to)))
  const where = and(...filters)

  const lp = latestPlateSubquery()
  const [items, totalRow] = await Promise.all([
    db
      .select({
        id: calendarEntries.id,
        kind: calendarEntries.kind,
        title: calendarEntries.title,
        startsAt: calendarEntries.startsAt,
        endsAt: calendarEntries.endsAt,
        allDay: calendarEntries.allDay,
        status: calendarEntries.status,
        customerId: calendarEntries.customerId,
        vehicleId: calendarEntries.vehicleId,
        employeeId: calendarEntries.employeeId,
        notes: calendarEntries.notes,
        createdAt: calendarEntries.createdAt,
        customerCompany: customers.company,
        customerLastName: customers.lastName,
        vehicleLabel: lp.licensePlate,
        employeeFirstName: employees.firstName,
        employeeLastName: employees.lastName
      })
      .from(calendarEntries)
      .leftJoin(customers, eq(calendarEntries.customerId, customers.id))
      .leftJoin(vehicles, eq(calendarEntries.vehicleId, vehicles.id))
      .leftJoin(lp, eq(lp.vehicleId, vehicles.id))
      .leftJoin(employees, eq(calendarEntries.employeeId, employees.id))
      .where(where)
      .orderBy(asc(calendarEntries.startsAt))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(calendarEntries).where(where)
  ])

  const total = Number(totalRow[0]?.value ?? 0)
  // Wir setzen die zusammengesetzten Labels in JS — vorher passierte
  // das per `coalesce(...) ||`-SQL, jetzt geht es ohne handgeschriebene
  // SQL-Templates.
  const enriched: AppointmentRow[] = items.map((r) => {
    const customerName = r.customerCompany ?? r.customerLastName ?? null
    const employeeName =
      r.employeeFirstName || r.employeeLastName
        ? `${r.employeeFirstName ?? ''} ${r.employeeLastName ?? ''}`.trim()
        : null
    const {
      customerCompany: _cc,
      customerLastName: _cl,
      employeeFirstName: _ef,
      employeeLastName: _el,
      ...rest
    } = r
    void _cc
    void _cl
    void _ef
    void _el
    return {
      ...(rest as unknown as CalendarEntry),
      customerName,
      vehicleLabel: r.vehicleLabel ?? null,
      employeeName
    }
  })
  return {
    items: enriched,
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size))
  }
}

/* ── Discriminated insert / delete ──────────────────────────────── */

export async function createCalendarEntry(
  values: NewCalendarEntry
): Promise<CalendarEntry> {
  const [created] = await db.insert(calendarEntries).values(values).returning()
  return created
}

export async function deleteCalendarEntry(id: string): Promise<void> {
  await db.delete(calendarEntries).where(eq(calendarEntries.id, id))
}

export async function getCalendarEntry(
  id: string
): Promise<CalendarEntry | null> {
  const [row] = await db
    .select()
    .from(calendarEntries)
    .where(eq(calendarEntries.id, id))
    .limit(1)
  return row ?? null
}

export async function updateCalendarEntry(
  id: string,
  values: Partial<NewCalendarEntry>
): Promise<CalendarEntry> {
  const [row] = await db
    .update(calendarEntries)
    .set(values)
    .where(eq(calendarEntries.id, id))
    .returning()
  return row
}
