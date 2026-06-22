/**
 * Workshop opening-hours service. Drives the public-API
 * free-slot computation (which weekdays the workshop is open and
 * between which times). Stored as one row per weekday
 * (0 = Sunday, 6 = Saturday).
 */
import { db } from '$lib/server/db/client'
import { workshopHours, type WorkshopHour } from '$lib/server/db/schema'
import { asc, eq } from 'drizzle-orm'

/**
 * Defaults applied when a weekday row is missing on read. Mon-Fri
 * 08:00-17:00 open; Sat (6) and Sun (0) closed. Matches the
 * `seedDefaultWorkshopHours()` seed step — the lazy create path here
 * is a defensive backstop so a pristine database without the seed
 * having run yet still produces a complete 7-row table.
 */
const DEFAULT_OPEN = (weekday: number) => weekday >= 1 && weekday <= 5
const DEFAULT_OPENS_AT = '08:00'
const DEFAULT_CLOSES_AT = '17:00'

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const

/**
 * Normalize a time value coming from Postgres to the canonical
 * `HH:MM` shape the UI uses. Migration 0011 created `opens_at` /
 * `closes_at` as the SQL `time` type, which Postgres reports back as
 * `HH:MM:SS`; the Drizzle schema declares them as `text`, which is
 * what `<input type="time">` produces. This helper bridges the two
 * so the rest of the app (form bindings, comparisons in
 * `isWithinHours`, JSON payloads) only ever deals with `HH:MM`.
 */
const normalizeTime = (value: string): string => value.slice(0, 5)

const normalizeRow = (row: WorkshopHour): WorkshopHour => ({
  ...row,
  opensAt: normalizeTime(row.opensAt),
  closesAt: normalizeTime(row.closesAt)
})

/**
 * Return all 7 weekday rows ordered Sunday → Saturday. Lazily creates
 * any row that doesn't exist yet so the caller can always render a
 * full table.
 */
export async function listWorkshopHours(): Promise<WorkshopHour[]> {
  const existing = await db
    .select()
    .from(workshopHours)
    .orderBy(asc(workshopHours.weekday))
  const byWeekday = new Map(existing.map((r) => [r.weekday, r]))
  const missing = WEEKDAYS.filter((d) => !byWeekday.has(d))
  if (missing.length > 0) {
    const inserts = missing.map((d) => ({
      weekday: d,
      opensAt: DEFAULT_OPENS_AT,
      closesAt: DEFAULT_CLOSES_AT,
      closed: !DEFAULT_OPEN(d)
    }))
    const created = await db.insert(workshopHours).values(inserts).returning()
    for (const row of created) byWeekday.set(row.weekday, row)
  }
  return WEEKDAYS.map((d) => normalizeRow(byWeekday.get(d)!)).sort(
    (a, b) => a.weekday - b.weekday
  )
}

export type WorkshopHourInput = {
  opensAt: string
  closesAt: string
  closed: boolean
}

/**
 * Update one weekday's opening hours. Creates the row if it does not
 * exist yet (so the writer doesn't need to call list-first).
 */
export async function updateWorkshopHours(
  weekday: number,
  input: WorkshopHourInput
): Promise<WorkshopHour> {
  const [existing] = await db
    .select()
    .from(workshopHours)
    .where(eq(workshopHours.weekday, weekday))
    .limit(1)
  if (!existing) {
    const [created] = await db
      .insert(workshopHours)
      .values({ weekday, ...input })
      .returning()
    return normalizeRow(created)
  }
  const [updated] = await db
    .update(workshopHours)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(workshopHours.weekday, weekday))
    .returning()
  return normalizeRow(updated)
}

/**
 * Helper for the future public free-slot API: returns `true` if the
 * given `date` (interpreted in the server's local timezone) falls
 * within the configured opening hours for that weekday.
 *
 * Times are compared by simple lexicographic ordering of the
 * `HH:MM` strings — works because both sides are zero-padded
 * 24-hour clock values, no DST surprises at the minute granularity.
 *
 * Edge cases:
 *   - closed weekday → always false
 *   - exactly at opensAt → true
 *   - exactly at closesAt → false (closes_at is the cutoff, not the
 *     last bookable minute)
 */
export async function isWithinHours(date: Date): Promise<boolean> {
  const weekday = date.getDay()
  const [row] = await db
    .select()
    .from(workshopHours)
    .where(eq(workshopHours.weekday, weekday))
    .limit(1)
  const opensAt = normalizeTime(row?.opensAt ?? DEFAULT_OPENS_AT)
  const closesAt = normalizeTime(row?.closesAt ?? DEFAULT_CLOSES_AT)
  const closed = row ? row.closed : !DEFAULT_OPEN(weekday)
  if (closed) return false
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const now = `${hh}:${mm}`
  return now >= opensAt && now < closesAt
}
