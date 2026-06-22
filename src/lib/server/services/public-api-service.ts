/**
 * Helpers for the token-authenticated public REST API. Currently
 * exposes a slot-finder that combines workshop opening hours, existing
 * calendar appointments / business closures and German public
 * holidays into a list of free windows of the requested duration.
 *
 * The function is intentionally pure-logic-around-DB-reads so it can
 * be unit-tested via pg-mem (see `public-api-service.test.ts`).
 *
 * @group integration
 * @module public-api-service
 */
import { and, eq, gte, lte } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  calendarEntries,
  publicHolidays,
  workshopHours
} from '$lib/server/db/schema'

export type FreeSlot = { startsAt: Date; endsAt: Date }

export type FindFreeSlotsParams = {
  from: Date
  to: Date
  durationMinutes: number
}

const MAX_RANGE_DAYS = 60
const SLOT_STEP_MINUTES = 15
const ONE_DAY_MS = 24 * 60 * 60 * 1000

/** Format a Date as `YYYY-MM-DD` in the server's local timezone. */
const toLocalIso = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse `HH:MM` (or `HH:MM:SS`) into hours and minutes. */
const parseHHMM = (value: string): { h: number; m: number } => {
  const [h, m] = value.slice(0, 5).split(':')
  return { h: Number(h), m: Number(m) }
}

/**
 * Compute candidate free slots between `from` and `to`. Slots are
 * generated in 15-minute increments inside the configured opening
 * hours for each weekday and filtered against existing appointments
 * (`calendar_entries.kind='appointment'` that are not cancelled),
 * business closures (`kind='closure'`) and German public holidays.
 *
 * Range bounded to {@link MAX_RANGE_DAYS} days — longer ranges throw,
 * the caller surfaces a 400.
 */
export async function findFreeSlots(
  params: FindFreeSlotsParams
): Promise<FreeSlot[]> {
  const { from, to, durationMinutes } = params
  if (!(durationMinutes > 0)) {
    throw new Error('durationMinutes must be positive')
  }
  if (to.getTime() < from.getTime()) {
    throw new Error('to must be >= from')
  }
  const spanMs = to.getTime() - from.getTime()
  if (spanMs > MAX_RANGE_DAYS * ONE_DAY_MS) {
    throw new Error(`range exceeds ${MAX_RANGE_DAYS} days`)
  }

  // Load opening hours once; default to the lazy values used by the
  // workshop-hours service so callers don't need to seed before use.
  const hourRows = await db.select().from(workshopHours)
  const hoursByWeekday = new Map<
    number,
    { opensAt: string; closesAt: string; closed: boolean }
  >()
  for (const row of hourRows) {
    hoursByWeekday.set(row.weekday, {
      opensAt: row.opensAt.slice(0, 5),
      closesAt: row.closesAt.slice(0, 5),
      closed: row.closed
    })
  }

  // Window padded by one day on each side: an appointment that starts
  // before `from` can still overlap the first slot we consider.
  const overlapWindowStart = new Date(from.getTime() - ONE_DAY_MS)
  const overlapWindowEnd = new Date(to.getTime() + ONE_DAY_MS)

  const [apptRows, closures, holidays] = await Promise.all([
    db
      .select({
        startsAt: calendarEntries.startsAt,
        endsAt: calendarEntries.endsAt,
        status: calendarEntries.status
      })
      .from(calendarEntries)
      .where(
        and(
          eq(calendarEntries.kind, 'appointment'),
          lte(calendarEntries.startsAt, overlapWindowEnd),
          gte(calendarEntries.endsAt, overlapWindowStart)
        )
      ),
    db
      .select({
        startsAt: calendarEntries.startsAt,
        endsAt: calendarEntries.endsAt
      })
      .from(calendarEntries)
      .where(
        and(
          eq(calendarEntries.kind, 'closure'),
          lte(calendarEntries.startsAt, overlapWindowEnd),
          gte(calendarEntries.endsAt, overlapWindowStart)
        )
      ),
    db
      .select({ date: publicHolidays.date })
      .from(publicHolidays)
      .where(
        and(
          gte(publicHolidays.date, toLocalIso(from)),
          lte(publicHolidays.date, toLocalIso(to))
        )
      )
  ])

  const holidaySet = new Set(holidays.map((h) => h.date))

  // Normalize blockers to plain ms intervals. Cancelled appointments
  // are filtered out in JS (small volumes) so we don't have to chase
  // a nullable-aware SQL predicate against `status`.
  type Interval = { start: number; end: number }
  const blockers: Interval[] = []
  for (const a of apptRows) {
    if (a.status === 'cancelled') continue
    blockers.push({ start: a.startsAt.getTime(), end: a.endsAt.getTime() })
  }
  for (const c of closures) {
    blockers.push({ start: c.startsAt.getTime(), end: c.endsAt.getTime() })
  }

  // Helper: does `[start, end)` overlap any blocker?
  const overlapsBlocker = (start: number, end: number): boolean => {
    for (const b of blockers) {
      if (start < b.end && end > b.start) return true
    }
    return false
  }

  const slots: FreeSlot[] = []
  const stepMs = SLOT_STEP_MINUTES * 60 * 1000
  const durationMs = durationMinutes * 60 * 1000

  // Iterate one local day at a time. We pin the cursor to midnight of
  // each day so DST transitions inside the range don't pollute the
  // slot grid (each day's grid is rebuilt from its own opensAt/closesAt).
  const cursor = new Date(from)
  cursor.setHours(0, 0, 0, 0)
  const endStop = to.getTime()
  while (cursor.getTime() <= endStop) {
    const weekday = cursor.getDay()
    const dayIso = toLocalIso(cursor)
    const hours = hoursByWeekday.get(weekday) ?? defaultHoursFor(weekday)
    const isHoliday = holidaySet.has(dayIso)
    if (!hours.closed && !isHoliday) {
      const opens = parseHHMM(hours.opensAt)
      const closes = parseHHMM(hours.closesAt)
      const dayStart = new Date(cursor)
      dayStart.setHours(opens.h, opens.m, 0, 0)
      const dayEnd = new Date(cursor)
      dayEnd.setHours(closes.h, closes.m, 0, 0)

      for (
        let t = dayStart.getTime();
        t + durationMs <= dayEnd.getTime();
        t += stepMs
      ) {
        // Slot has to lie fully inside the requested [from, to] range.
        if (t < from.getTime()) continue
        if (t + durationMs > to.getTime()) break
        if (overlapsBlocker(t, t + durationMs)) continue
        slots.push({ startsAt: new Date(t), endsAt: new Date(t + durationMs) })
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return slots
}

/** Mirror of the workshop-hours-service defaults. */
function defaultHoursFor(weekday: number): {
  opensAt: string
  closesAt: string
  closed: boolean
} {
  const open = weekday >= 1 && weekday <= 5
  return { opensAt: '08:00', closesAt: '17:00', closed: !open }
}
