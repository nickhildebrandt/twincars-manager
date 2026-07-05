/**
 * Repository layer for the dashboard (Start page): KPI counters and
 * the mixed upcoming feed. Pure typed Drizzle calls — the auth guard
 * lives in `src/routes/dashboard.remote.ts`.
 */
import { db } from '$lib/server/db/client'
import {
  calendarEntries,
  customers,
  documents,
  ledgerEntries,
  reminders,
  vehicles
} from '$lib/server/db/schema'
import {
  and,
  asc,
  count,
  eq,
  gte,
  isNotNull,
  lt,
  lte,
  ne,
  sum
} from 'drizzle-orm'
import { latestPlateSubquery } from '$lib/server/services/vehicle-service'

export interface DashboardKpis {
  customers: number
  vehicles: number
  monthlyIncome: number
  monthlyExpense: number
  monthlyBalance: number
  openInvoices: number
  openReminders: number
  appointmentsToday: number
}

/**
 * Dashboard KPI summary: entity counters, current-month ledger sums,
 * open invoices, open Zahlungserinnerungen and today's appointments.
 */
export async function getDashboardKpis(): Promise<DashboardKpis> {
  // Current month as a date range. Drizzle accepts plain strings for
  // date columns, which is cleaner than a date_trunc comparison.
  const now = new Date()
  const monthStartIso = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
  const lastDayOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)
  ).getUTCDate()
  const monthEndIso = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`
  const monthRange = and(
    gte(ledgerEntries.entryDate, monthStartIso),
    lte(ledgerEntries.entryDate, monthEndIso)
  )

  // Today as a UTC timestamp range for the appointments-today count.
  const todayIso = now.toISOString().slice(0, 10)
  const todayStart = new Date(`${todayIso}T00:00:00Z`)
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  const [
    customerCount,
    vehicleCount,
    incomeRow,
    expenseRow,
    openInvoiceCount,
    openReminderCount,
    appointmentsTodayCount
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(customers)
      .where(eq(customers.archived, false)),
    db
      .select({ value: count() })
      .from(vehicles)
      .where(eq(vehicles.archived, false)),
    db
      .select({ value: sum(ledgerEntries.amountGross) })
      .from(ledgerEntries)
      .where(and(monthRange, eq(ledgerEntries.direction, 'income'))),
    db
      .select({ value: sum(ledgerEntries.amountGross) })
      .from(ledgerEntries)
      .where(and(monthRange, eq(ledgerEntries.direction, 'expense'))),
    // Open invoices: sent but not yet paid / cancelled. Mirrors the
    // "Offen" filter of the invoices list.
    db
      .select({ value: count() })
      .from(documents)
      .where(and(eq(documents.type, 'invoice'), eq(documents.status, 'sent'))),
    // Open Zahlungserinnerungen: created but not yet mailed / resolved.
    // Same definition as `listOpenReminders` in reminder-service.
    db
      .select({ value: count() })
      .from(reminders)
      .where(eq(reminders.status, 'open')),
    // Appointments starting today, excluding cancelled ones.
    db
      .select({ value: count() })
      .from(calendarEntries)
      .where(
        and(
          eq(calendarEntries.kind, 'appointment'),
          gte(calendarEntries.startsAt, todayStart),
          lt(calendarEntries.startsAt, tomorrowStart),
          ne(calendarEntries.status, 'cancelled')
        )
      )
  ])
  const income = Number(incomeRow[0]?.value ?? 0)
  const expense = Number(expenseRow[0]?.value ?? 0)
  return {
    customers: Number(customerCount[0]?.value ?? 0),
    vehicles: Number(vehicleCount[0]?.value ?? 0),
    monthlyIncome: income,
    monthlyExpense: expense,
    monthlyBalance: income - expense,
    openInvoices: Number(openInvoiceCount[0]?.value ?? 0),
    openReminders: Number(openReminderCount[0]?.value ?? 0),
    appointmentsToday: Number(appointmentsTodayCount[0]?.value ?? 0)
  }
}

export type UpcomingItem =
  | { kind: 'hu_due'; dateIso: string; title: string; vehicleId: string }
  | { kind: 'appointment'; dateIso: string; title: string; entryId: string }

/**
 * Top-10 anstehende Termine: gemischter Feed aus
 * - HU-Fälligkeiten (`vehicles.nextHu` >= heute), und
 * - Calendar-Termine (`calendar_entries` kind='appointment', startsAt
 *   >= heute, status != 'cancelled').
 *
 * Beide Quellen werden auf eine flache Liste reduziert, nach Datum
 * aufsteigend sortiert und auf 10 Einträge gekürzt. Die Karte auf
 * der Start-Seite verlinkt jeden Eintrag passend (HU → Fahrzeug,
 * Termin → Kalender).
 */
export async function getUpcoming(): Promise<UpcomingItem[]> {
  const today = new Date().toISOString().slice(0, 10)
  const todayTs = new Date(`${today}T00:00:00Z`)

  const lp = latestPlateSubquery()
  const [huRows, apptRows] = await Promise.all([
    db
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
          gte(vehicles.nextHu, today)
        )
      )
      .orderBy(asc(vehicles.nextHu))
      .limit(20),
    db
      .select({
        id: calendarEntries.id,
        title: calendarEntries.title,
        startsAt: calendarEntries.startsAt,
        status: calendarEntries.status
      })
      .from(calendarEntries)
      .where(
        and(
          eq(calendarEntries.kind, 'appointment'),
          gte(calendarEntries.startsAt, todayTs)
        )
      )
      .orderBy(asc(calendarEntries.startsAt))
      .limit(20)
  ])

  const items: UpcomingItem[] = []
  for (const v of huRows) {
    if (!v.nextHu) continue
    const label =
      [v.make, v.model].filter(Boolean).join(' ') || v.plate || 'Fahrzeug'
    const plate = v.plate ? ` · ${v.plate}` : ''
    items.push({
      kind: 'hu_due',
      dateIso: v.nextHu,
      title: `HU fällig: ${label}${plate}`,
      vehicleId: v.id
    })
  }
  for (const a of apptRows) {
    if (a.status === 'cancelled') continue
    items.push({
      kind: 'appointment',
      dateIso: a.startsAt.toISOString().slice(0, 10),
      title: a.title,
      entryId: a.id
    })
  }
  items.sort((x, y) => x.dateIso.localeCompare(y.dateIso))
  return items.slice(0, 10)
}
