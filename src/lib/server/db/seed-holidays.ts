import { db } from './client'
import { publicHolidays } from './schema'
import { and, eq } from 'drizzle-orm'

/**
 * Compute the date of Easter Sunday for a given Gregorian year using
 * the canonical Gauss / Butcher algorithm. Returns a `Date` in UTC.
 *
 * Verified against published church calendars — the 2026 date is
 * 2026-04-05.
 */
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d.getTime())
  r.setUTCDate(r.getUTCDate() + days)
  return r
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Return the list of nationwide German public holidays for a given
 * year. Excludes region-specific ones (Heilige Drei Könige, Fronleichnam,
 * Reformationstag, Allerheiligen) since those depend on `state`.
 *
 * The shape matches `public_holidays` so the seed can insert directly.
 */
export function nationalHolidaysFor(
  year: number
): Array<{ date: string; name: string }> {
  const easter = easterSunday(year)
  return [
    { date: `${year}-01-01`, name: 'Neujahr' },
    { date: iso(addDays(easter, -2)), name: 'Karfreitag' },
    { date: iso(easter), name: 'Ostersonntag' },
    { date: iso(addDays(easter, 1)), name: 'Ostermontag' },
    { date: `${year}-05-01`, name: 'Tag der Arbeit' },
    { date: iso(addDays(easter, 39)), name: 'Christi Himmelfahrt' },
    { date: iso(addDays(easter, 49)), name: 'Pfingstsonntag' },
    { date: iso(addDays(easter, 50)), name: 'Pfingstmontag' },
    { date: `${year}-10-03`, name: 'Tag der Deutschen Einheit' },
    { date: `${year}-12-25`, name: '1. Weihnachtsfeiertag' },
    { date: `${year}-12-26`, name: '2. Weihnachtsfeiertag' }
  ]
}

/**
 * Idempotently seed nationwide German public holidays for the current
 * year and the next two years. `state = 'DE'` marks the row as
 * nationwide so calendar queries can filter by Bundesland later
 * without losing common holidays.
 *
 * Called from `seedDefaults()` on the first request after boot.
 */
export async function seedDefaultHolidays(): Promise<void> {
  const thisYear = new Date().getUTCFullYear()
  const years = [thisYear, thisYear + 1, thisYear + 2]
  for (const year of years) {
    for (const h of nationalHolidaysFor(year)) {
      const existing = await db
        .select({ id: publicHolidays.id })
        .from(publicHolidays)
        .where(
          and(eq(publicHolidays.date, h.date), eq(publicHolidays.state, 'DE'))
        )
        .limit(1)
      if (existing.length === 0) {
        await db
          .insert(publicHolidays)
          .values({ state: 'DE', date: h.date, name: h.name })
      }
    }
  }
}
