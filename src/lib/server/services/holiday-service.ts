/**
 * German public-holiday service — deterministic, algorithmic, no year
 * limit. Replaces the retired static `public_holidays` seed (the table
 * itself still exists in the schema but is dormant; dropping it is left
 * to a future migration).
 *
 * Movable feasts derive from Easter Sunday via the Gauss Easter
 * algorithm in the Meeus/Jones/Butcher form, valid for all Gregorian
 * years. Verified against published church calendars (e.g. Easter
 * 2026-04-05, 2028-04-16, 2035-03-25) and the invariant that Easter is
 * always a Sunday in March or April.
 *
 * State coverage — statutory, state-wide holidays for all 16
 * Bundesländer plus the pseudo-state `'DE'` (federal-only fallback for
 * an unknown/unset company Bundesland). Deliberate caveats:
 *
 * - Fronleichnam in Sachsen / Thüringen is only a holiday in selected
 *   (predominantly Catholic) municipalities, not state-wide — we
 *   implement the state-wide rule only, so SN/TH do NOT include it.
 * - Mariä Himmelfahrt is state-wide only in the Saarland; in Bayern it
 *   applies only in municipalities with a Catholic majority, so BY does
 *   NOT include it here.
 * - The Augsburger Friedensfest (Aug 8, city of Augsburg only) is out
 *   of scope — it is a municipal holiday, not a Bundesland-level one.
 *
 * @module holiday-service
 */

import { db } from '$lib/server/db/client'
import { companySettings } from '$lib/server/db/schema'

/**
 * ISO 3166-2:DE codes for the 16 Bundesländer, plus `'DE'` meaning
 * "federal holidays only" (used when the company's Bundesland is
 * unknown).
 */
export type GermanState =
  | 'BW'
  | 'BY'
  | 'BE'
  | 'BB'
  | 'HB'
  | 'HH'
  | 'HE'
  | 'MV'
  | 'NI'
  | 'NW'
  | 'RP'
  | 'SL'
  | 'SN'
  | 'ST'
  | 'SH'
  | 'TH'
  | 'DE'

export type PublicHolidayEntry = { date: string; name: string }

const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * Easter Sunday for a Gregorian `year` — Gauss algorithm in the
 * Meeus/Jones/Butcher form. Pure integer arithmetic, no lookup tables,
 * valid for every Gregorian year (we guard to 1583..4099 to stay well
 * inside the calendar's validity and avoid nonsense input).
 */
export function easterSundayIso(year: number): string {
  if (!Number.isInteger(year) || year < 1583 || year > 4099) {
    throw new Error(`easterSundayIso: unsupported year ${year}`)
  }
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
  return isoFromUtc(new Date(Date.UTC(year, month - 1, day)))
}

const isoFromUtc = (d: Date): string => d.toISOString().slice(0, 10)

const addDaysIso = (iso: string, days: number): string =>
  isoFromUtc(
    new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * ONE_DAY_MS)
  )

/**
 * Buß- und Bettag (Sachsen): the Wednesday strictly before November 23,
 * i.e. always between Nov 16 and Nov 22.
 */
export function bussUndBettagIso(year: number): string {
  const nov23 = new Date(Date.UTC(year, 10, 23))
  let offset = (nov23.getUTCDay() - 3 + 7) % 7 // 3 = Wednesday
  if (offset === 0) offset = 7 // Nov 23 itself is a Wednesday → back a week
  return isoFromUtc(new Date(nov23.getTime() - offset * ONE_DAY_MS))
}

/* ── Holiday rule table ──────────────────────────────────────────── */

type HolidayRule = {
  name: string
  /** `'*'` = federal (every state incl. the `'DE'` fallback). */
  states: '*' | readonly GermanState[]
  /** Resolve the ISO date for a given year (easter = Easter Sunday ISO). */
  date: (year: number, easter: string) => string
}

/**
 * Statutory holiday rules. Federal rules apply everywhere (including
 * the `'DE'` fallback); state rules only to the listed Bundesländer.
 * Names match the wording of the retired seed where both defined the
 * same holiday (e.g. `1. Weihnachtsfeiertag`).
 */
const HOLIDAY_RULES: readonly HolidayRule[] = [
  // Federal (bundeseinheitlich)
  { name: 'Neujahr', states: '*', date: (y) => `${y}-01-01` },
  { name: 'Karfreitag', states: '*', date: (_y, e) => addDaysIso(e, -2) },
  { name: 'Ostermontag', states: '*', date: (_y, e) => addDaysIso(e, 1) },
  { name: 'Tag der Arbeit', states: '*', date: (y) => `${y}-05-01` },
  {
    name: 'Christi Himmelfahrt',
    states: '*',
    date: (_y, e) => addDaysIso(e, 39)
  },
  { name: 'Pfingstmontag', states: '*', date: (_y, e) => addDaysIso(e, 50) },
  { name: 'Tag der Deutschen Einheit', states: '*', date: (y) => `${y}-10-03` },
  { name: '1. Weihnachtsfeiertag', states: '*', date: (y) => `${y}-12-25` },
  { name: '2. Weihnachtsfeiertag', states: '*', date: (y) => `${y}-12-26` },
  // State-specific
  {
    name: 'Heilige Drei Könige',
    states: ['BW', 'BY', 'ST'],
    date: (y) => `${y}-01-06`
  },
  {
    name: 'Internationaler Frauentag',
    states: ['BE', 'MV'],
    date: (y) => `${y}-03-08`
  },
  { name: 'Ostersonntag', states: ['BB'], date: (_y, e) => e },
  {
    name: 'Pfingstsonntag',
    states: ['BB'],
    date: (_y, e) => addDaysIso(e, 49)
  },
  {
    // State-wide in BW/BY/HE/NW/RP/SL only; communal in SN/TH (see
    // module caveat) — deliberately not included for SN/TH.
    name: 'Fronleichnam',
    states: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'],
    date: (_y, e) => addDaysIso(e, 60)
  },
  {
    // State-wide only in the Saarland; communal in Bayern (see caveat).
    name: 'Mariä Himmelfahrt',
    states: ['SL'],
    date: (y) => `${y}-08-15`
  },
  { name: 'Weltkindertag', states: ['TH'], date: (y) => `${y}-09-20` },
  {
    name: 'Reformationstag',
    states: ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'],
    date: (y) => `${y}-10-31`
  },
  {
    name: 'Allerheiligen',
    states: ['BW', 'BY', 'NW', 'RP', 'SL'],
    date: (y) => `${y}-11-01`
  },
  { name: 'Buß- und Bettag', states: ['SN'], date: (y) => bussUndBettagIso(y) }
]

/* ── Memoization ─────────────────────────────────────────────────── */

/**
 * Bounded per-(year, state) memo. FIFO eviction keeps the cache at a
 * fixed maximum — 17 states × a handful of years in practice, so 64
 * entries is plenty while staying strictly bounded.
 */
const MEMO_MAX_ENTRIES = 64
const memo = new Map<string, readonly PublicHolidayEntry[]>()

/**
 * All statutory public holidays of `year` in `state`, sorted by date.
 * `'DE'` yields the nine federal holidays only. The returned array is
 * frozen and memoized — do not mutate it.
 */
export function getPublicHolidays(
  year: number,
  state: GermanState
): readonly PublicHolidayEntry[] {
  const key = `${year}:${state}`
  const cached = memo.get(key)
  if (cached) return cached

  const easter = easterSundayIso(year)
  const list: PublicHolidayEntry[] = []
  for (const rule of HOLIDAY_RULES) {
    const applies =
      rule.states === '*' || (state !== 'DE' && rule.states.includes(state))
    if (!applies) continue
    list.push({ date: rule.date(year, easter), name: rule.name })
  }
  list.sort((a, b) => a.date.localeCompare(b.date))
  const frozen = Object.freeze(list.map((h) => Object.freeze(h)))

  if (memo.size >= MEMO_MAX_ENTRIES) {
    // FIFO: Map iterates in insertion order — evict the oldest entry.
    const oldest = memo.keys().next().value
    if (oldest !== undefined) memo.delete(oldest)
  }
  memo.set(key, frozen)
  return frozen
}

/** Whether `dateIso` (YYYY-MM-DD) is a public holiday in `state`. */
export function isPublicHoliday(dateIso: string, state: GermanState): boolean {
  const year = Number(dateIso.slice(0, 4))
  if (!Number.isInteger(year)) return false
  return getPublicHolidays(year, state).some((h) => h.date === dateIso)
}

/**
 * All holidays with `fromIso <= date <= toIso` in `state` — computes
 * every year the range touches and filters. Handy for calendar-style
 * range queries that may span a year boundary.
 */
export function getPublicHolidaysInRange(
  fromIso: string,
  toIso: string,
  state: GermanState
): PublicHolidayEntry[] {
  const fromYear = Number(fromIso.slice(0, 4))
  const toYear = Number(toIso.slice(0, 4))
  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear)) return []
  const out: PublicHolidayEntry[] = []
  for (let year = fromYear; year <= toYear; year++) {
    for (const h of getPublicHolidays(year, state)) {
      if (h.date >= fromIso && h.date <= toIso) out.push(h)
    }
  }
  return out
}

/* ── Bundesland resolution ───────────────────────────────────────── */

/**
 * Normalize a free-text Bundesland: lowercase, transliterate umlauts,
 * drop everything that is not a letter (spaces, hyphens, dots).
 */
const normalizeStateName = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .replace(/[^a-z]/g, '')

const STATE_ALIASES: Record<string, GermanState> = {
  // Full names (normalized) — matches the setup wizard's select options.
  badenwuerttemberg: 'BW',
  badenwurttemberg: 'BW', // umlaut typed as plain "u"
  bayern: 'BY',
  freistaatbayern: 'BY',
  berlin: 'BE',
  brandenburg: 'BB',
  bremen: 'HB',
  freiehansestadtbremen: 'HB',
  hamburg: 'HH',
  freieundhansestadthamburg: 'HH',
  hessen: 'HE',
  mecklenburgvorpommern: 'MV',
  niedersachsen: 'NI',
  nordrheinwestfalen: 'NW',
  nrw: 'NW',
  rheinlandpfalz: 'RP',
  saarland: 'SL',
  sachsen: 'SN',
  freistaatsachsen: 'SN',
  sachsenanhalt: 'ST',
  schleswigholstein: 'SH',
  thueringen: 'TH',
  thuringen: 'TH',
  freistaatthueringen: 'TH',
  // ISO codes typed directly.
  bw: 'BW',
  by: 'BY',
  be: 'BE',
  bb: 'BB',
  hb: 'HB',
  hh: 'HH',
  he: 'HE',
  mv: 'MV',
  ni: 'NI',
  nw: 'NW',
  rp: 'RP',
  sl: 'SL',
  sn: 'SN',
  st: 'ST',
  sh: 'SH',
  th: 'TH',
  // Explicit "whole country" spellings.
  de: 'DE',
  deutschland: 'DE',
  bund: 'DE'
}

/**
 * Tolerant free-text Bundesland → code resolver. Accepts the official
 * names (as written by the setup wizard, e.g. `'Nordrhein-Westfalen'`),
 * ISO codes and common abbreviations (`'NRW'`), case-/umlaut-/hyphen-
 * insensitively. Unknown or empty input falls back to `'DE'`
 * (federal-only) so holiday logic degrades gracefully instead of
 * failing or inventing state holidays.
 */
export function resolveGermanState(
  value: string | null | undefined
): GermanState {
  if (!value) return 'DE'
  return STATE_ALIASES[normalizeStateName(value)] ?? 'DE'
}

/**
 * The company's Bundesland for holiday purposes — reads the free-text
 * `company_settings.state` (a select in the setup wizard, but stored
 * as text) and resolves it. No settings row / unknown text → `'DE'`.
 */
export async function getCompanyHolidayState(): Promise<GermanState> {
  const [row] = await db
    .select({ state: companySettings.state })
    .from(companySettings)
    .limit(1)
  return resolveGermanState(row?.state)
}
