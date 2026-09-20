/**
 * Dates and times, all in the one business time zone.
 *
 * The predecessor mixed three notions of "today": the container's local time
 * for number ranges, UTC for the dashboard, and UTC again for the calendar.
 * In Europe/Berlin that means the dashboard still showed yesterday during the
 * first one or two hours of every day, and the year in an invoice number
 * depended on the container's time zone (B-028). There is exactly one
 * definition here, and everything uses it.
 */

/** The business runs in one place. Every date boundary is decided here. */
export const BUSINESS_TIMEZONE = 'Europe/Berlin'

/** `en-CA` formats as `YYYY-MM-DD`, which is what the `date` columns hold. */
const ISO_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const partsOf = (at: Date) => {
  const found: Record<string, string> = {}
  for (const part of PARTS.formatToParts(at)) found[part.type] = part.value
  return found
}

/** `2026-09-13` — the business day the given moment falls on. */
export function isoDate(at: Date = new Date()): string {
  return ISO_DATE.format(at)
}

/** Today as a `YYYY-MM-DD` string, in business time. */
export const today = (): string => isoDate()

/** The business year, for number-range templates. */
export function businessYear(at: Date = new Date()): number {
  return Number(partsOf(at).year)
}

/** The business month, 1 to 12. */
export function businessMonth(at: Date = new Date()): number {
  return Number(partsOf(at).month)
}

/** The weekday in business time: 0 is Sunday, 6 is Saturday. */
export function businessWeekday(at: Date = new Date()): number {
  const [year, month, day] = isoDate(at).split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay()
}

/** Monday to Friday. Holidays are a separate question. */
export function isWorkday(at: Date = new Date()): boolean {
  const day = businessWeekday(at)
  return day >= 1 && day <= 5
}

/** First day of the month a moment falls in, as `YYYY-MM-01`. */
export function startOfMonth(at: Date = new Date()): string {
  return `${isoDate(at).slice(0, 7)}-01`
}

/** `YYYY-MM-DD` plus a number of days, staying a calendar date. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const moved = new Date(Date.UTC(year!, month! - 1, day! + days))
  return moved.toISOString().slice(0, 10)
}

/** Whole days from `from` to `to`, negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const parse = (value: string) => {
    const [year, month, day] = value.split('-').map(Number)
    return Date.UTC(year!, month! - 1, day!)
  }
  return Math.round((parse(to) - parse(from)) / 86_400_000)
}

const DATE = new Intl.DateTimeFormat('de-DE', {
  timeZone: BUSINESS_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const DATE_TIME = new Intl.DateTimeFormat('de-DE', {
  timeZone: BUSINESS_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** `2026-09-13` → `13.09.2026`. Accepts a date string or a moment. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const at = typeof value === 'string' ? fromIsoDate(value) : value
  return at ? DATE.format(at) : '—'
}

/** A moment as `13.09.2026, 07:30`. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const at = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(at.getTime()) ? '—' : DATE_TIME.format(at)
}

/**
 * Reads a `YYYY-MM-DD` string as a moment at noon UTC.
 *
 * Noon, not midnight: midnight UTC is the previous day in some zones, which is
 * how off-by-one dates get into a system. Noon is the same calendar day
 * everywhere on earth.
 */
export function fromIsoDate(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null
  const at = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
  return Number.isNaN(at.getTime()) ? null : at
}
