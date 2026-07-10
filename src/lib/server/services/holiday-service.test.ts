import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  bussUndBettagIso,
  easterSundayIso,
  getCompanyHolidayState,
  getPublicHolidays,
  getPublicHolidaysInRange,
  isPublicHoliday,
  resolveGermanState,
  type GermanState
} from './holiday-service'
import { db } from '$lib/server/db/client'
import { companySettings } from '$lib/server/db/schema'

/**
 * Tests for the algorithmic German public-holiday service — Easter
 * known answers, full state coverage, the Sachsen Buß- und Bettag rule,
 * the tolerant Bundesland resolver and the bounded memo cache.
 *
 * @group integration
 * @module holiday-service
 */
describe('holiday-service', () => {
  describe('easterSundayIso — known answers', () => {
    // Published Gregorian Easter dates (Meeus/Jones/Butcher).
    const known: Array<[number, string]> = [
      [2000, '2000-04-23'],
      [2016, '2016-03-27'],
      [2024, '2024-03-31'],
      [2026, '2026-04-05'],
      [2028, '2028-04-16'],
      [2035, '2035-03-25'],
      [2040, '2040-04-01'],
      [2049, '2049-04-18']
    ]
    it.each(known)('Easter Sunday %i is %s', (year, iso) => {
      expect(easterSundayIso(year)).toBe(iso)
    })

    it('is always a Sunday in March or April (1900–2200)', () => {
      for (let year = 1900; year <= 2200; year++) {
        const iso = easterSundayIso(year)
        const d = new Date(`${iso}T00:00:00Z`)
        expect(d.getUTCDay()).toBe(0)
        expect([2, 3]).toContain(d.getUTCMonth())
      }
    })

    it('rejects years outside the supported Gregorian range', () => {
      expect(() => easterSundayIso(1500)).toThrow(/unsupported year/)
      expect(() => easterSundayIso(2026.5)).toThrow(/unsupported year/)
    })
  })

  describe('getPublicHolidays — Berlin 2026 full set', () => {
    it('matches the statutory Berlin calendar exactly (sorted)', () => {
      expect(getPublicHolidays(2026, 'BE')).toEqual([
        { date: '2026-01-01', name: 'Neujahr' },
        { date: '2026-03-08', name: 'Internationaler Frauentag' },
        { date: '2026-04-03', name: 'Karfreitag' },
        { date: '2026-04-06', name: 'Ostermontag' },
        { date: '2026-05-01', name: 'Tag der Arbeit' },
        { date: '2026-05-14', name: 'Christi Himmelfahrt' },
        { date: '2026-05-25', name: 'Pfingstmontag' },
        { date: '2026-10-03', name: 'Tag der Deutschen Einheit' },
        { date: '2026-12-25', name: '1. Weihnachtsfeiertag' },
        { date: '2026-12-26', name: '2. Weihnachtsfeiertag' }
      ])
    })

    it('reproduces every previously seeded 2026 row (retired static seed)', () => {
      // Source-of-truth check: the retired `seed-holidays.ts` inserted
      // these 11 nationwide rows for 2026. The federal set covers nine
      // of them; Ostersonntag / Pfingstsonntag are statutory holidays
      // only in Brandenburg (they always fall on Sundays), so they are
      // covered via the BB set.
      const previouslySeeded = [
        { date: '2026-01-01', name: 'Neujahr' },
        { date: '2026-04-03', name: 'Karfreitag' },
        { date: '2026-04-05', name: 'Ostersonntag' },
        { date: '2026-04-06', name: 'Ostermontag' },
        { date: '2026-05-01', name: 'Tag der Arbeit' },
        { date: '2026-05-14', name: 'Christi Himmelfahrt' },
        { date: '2026-05-24', name: 'Pfingstsonntag' },
        { date: '2026-05-25', name: 'Pfingstmontag' },
        { date: '2026-10-03', name: 'Tag der Deutschen Einheit' },
        { date: '2026-12-25', name: '1. Weihnachtsfeiertag' },
        { date: '2026-12-26', name: '2. Weihnachtsfeiertag' }
      ]
      const federal = getPublicHolidays(2026, 'DE')
      const brandenburg = getPublicHolidays(2026, 'BB')
      for (const seeded of previouslySeeded) {
        const pool =
          seeded.name === 'Ostersonntag' || seeded.name === 'Pfingstsonntag'
            ? brandenburg
            : federal
        expect(pool).toContainEqual(seeded)
      }
      expect(federal).toHaveLength(9)
    })
  })

  describe('getPublicHolidays — state specifics', () => {
    it('Bayern 2026: Heilige Drei Könige, Fronleichnam, Allerheiligen — no Mariä Himmelfahrt', () => {
      const by = getPublicHolidays(2026, 'BY')
      expect(by).toContainEqual({
        date: '2026-01-06',
        name: 'Heilige Drei Könige'
      })
      expect(by).toContainEqual({ date: '2026-06-04', name: 'Fronleichnam' })
      expect(by).toContainEqual({ date: '2026-11-01', name: 'Allerheiligen' })
      // Mariä Himmelfahrt is only communal in BY (Catholic-majority
      // municipalities) — state-wide it exists solely in the Saarland.
      expect(by.map((h) => h.name)).not.toContain('Mariä Himmelfahrt')
      expect(by).toHaveLength(12)
    })

    it('Saarland has Mariä Himmelfahrt, Thüringen has Weltkindertag', () => {
      expect(getPublicHolidays(2026, 'SL')).toContainEqual({
        date: '2026-08-15',
        name: 'Mariä Himmelfahrt'
      })
      expect(getPublicHolidays(2026, 'TH')).toContainEqual({
        date: '2026-09-20',
        name: 'Weltkindertag'
      })
    })

    it('Brandenburg includes Oster- and Pfingstsonntag', () => {
      const bb = getPublicHolidays(2026, 'BB')
      expect(bb).toContainEqual({ date: '2026-04-05', name: 'Ostersonntag' })
      expect(bb).toContainEqual({ date: '2026-05-24', name: 'Pfingstsonntag' })
    })

    it('Fronleichnam is not state-wide in Sachsen / Thüringen (communal only)', () => {
      expect(getPublicHolidays(2026, 'SN').map((h) => h.name)).not.toContain(
        'Fronleichnam'
      )
      expect(getPublicHolidays(2026, 'TH').map((h) => h.name)).not.toContain(
        'Fronleichnam'
      )
    })

    it('Reformationstag applies to exactly BB/HB/HH/MV/NI/SN/ST/SH/TH', () => {
      const withReformation: GermanState[] = []
      const all: GermanState[] = [
        'BW',
        'BY',
        'BE',
        'BB',
        'HB',
        'HH',
        'HE',
        'MV',
        'NI',
        'NW',
        'RP',
        'SL',
        'SN',
        'ST',
        'SH',
        'TH'
      ]
      for (const s of all) {
        if (isPublicHoliday('2026-10-31', s)) withReformation.push(s)
      }
      expect(withReformation).toEqual([
        'BB',
        'HB',
        'HH',
        'MV',
        'NI',
        'SN',
        'ST',
        'SH',
        'TH'
      ])
    })

    it('per-state statutory holiday counts (coverage table, 2026)', () => {
      const expected: Record<GermanState, number> = {
        DE: 9,
        BW: 12,
        BY: 12,
        BE: 10,
        BB: 12,
        HB: 10,
        HH: 10,
        HE: 10,
        MV: 11,
        NI: 10,
        NW: 11,
        RP: 11,
        SL: 12,
        SN: 11,
        ST: 11,
        SH: 10,
        TH: 11
      }
      for (const [state, count] of Object.entries(expected)) {
        expect(
          getPublicHolidays(2026, state as GermanState),
          `state ${state}`
        ).toHaveLength(count)
      }
    })
  })

  describe('Buß- und Bettag (Sachsen)', () => {
    // Wednesday strictly before Nov 23 — published dates 2026–2033.
    const known: Array<[number, string]> = [
      [2026, '2026-11-18'],
      [2027, '2027-11-17'],
      [2028, '2028-11-22'],
      [2029, '2029-11-21'],
      [2030, '2030-11-20'],
      [2031, '2031-11-19'],
      [2032, '2032-11-17'],
      [2033, '2033-11-16']
    ]
    it.each(known)('%i falls on %s', (year, iso) => {
      expect(bussUndBettagIso(year)).toBe(iso)
      expect(getPublicHolidays(year, 'SN')).toContainEqual({
        date: iso,
        name: 'Buß- und Bettag'
      })
      // Only Sachsen keeps it as a statutory holiday.
      expect(isPublicHoliday(iso, 'BY')).toBe(false)
    })

    it('always lands on a Wednesday between Nov 16 and Nov 22', () => {
      for (let year = 2026; year <= 2126; year++) {
        const iso = bussUndBettagIso(year)
        const d = new Date(`${iso}T00:00:00Z`)
        expect(d.getUTCDay()).toBe(3)
        expect(iso >= `${year}-11-16` && iso <= `${year}-11-22`).toBe(true)
      }
    })
  })

  describe('year boundaries', () => {
    it('Neujahr is a holiday, Silvester is not', () => {
      expect(isPublicHoliday('2027-01-01', 'DE')).toBe(true)
      expect(isPublicHoliday('2026-12-31', 'DE')).toBe(false)
      expect(isPublicHoliday('2026-12-31', 'BY')).toBe(false)
    })

    it('a range spanning the year boundary yields holidays of both years', () => {
      const days = getPublicHolidaysInRange('2032-12-20', '2033-01-10', 'DE')
      expect(days).toContainEqual({
        date: '2032-12-25',
        name: '1. Weihnachtsfeiertag'
      })
      expect(days).toContainEqual({
        date: '2032-12-26',
        name: '2. Weihnachtsfeiertag'
      })
      expect(days).toContainEqual({ date: '2033-01-01', name: 'Neujahr' })
      expect(days).toHaveLength(3)
    })

    it('isPublicHoliday recognises movable feasts far in the future', () => {
      // Easter 2033 is 2033-04-17 → Karfreitag 2033-04-15.
      expect(isPublicHoliday('2033-04-15', 'DE')).toBe(true)
      expect(isPublicHoliday('2033-04-17', 'BB')).toBe(true) // Ostersonntag
      expect(isPublicHoliday('2033-04-17', 'DE')).toBe(false)
    })
  })

  describe('resolveGermanState', () => {
    it('resolves official names as written by the setup wizard', () => {
      expect(resolveGermanState('Nordrhein-Westfalen')).toBe('NW')
      expect(resolveGermanState('Baden-Württemberg')).toBe('BW')
      expect(resolveGermanState('Mecklenburg-Vorpommern')).toBe('MV')
      expect(resolveGermanState('Sachsen')).toBe('SN')
      expect(resolveGermanState('Sachsen-Anhalt')).toBe('ST')
      expect(resolveGermanState('Thüringen')).toBe('TH')
    })

    it('is tolerant of case, missing umlauts/hyphens and abbreviations', () => {
      expect(resolveGermanState('NRW')).toBe('NW')
      expect(resolveGermanState('nordrhein westfalen')).toBe('NW')
      expect(resolveGermanState('Baden-Wuerttemberg')).toBe('BW')
      expect(resolveGermanState('  bayern  ')).toBe('BY')
      expect(resolveGermanState('Freistaat Bayern')).toBe('BY')
      expect(resolveGermanState('Thueringen')).toBe('TH')
      expect(resolveGermanState('BY')).toBe('BY')
    })

    it('falls back to federal-only for unknown or empty input', () => {
      expect(resolveGermanState('Atlantis')).toBe('DE')
      expect(resolveGermanState('')).toBe('DE')
      expect(resolveGermanState(null)).toBe('DE')
      expect(resolveGermanState(undefined)).toBe('DE')
      expect(resolveGermanState('Deutschland')).toBe('DE')
    })
  })

  describe('memo cache', () => {
    it('returns the identical frozen array on repeat calls', () => {
      const a = getPublicHolidays(2200, 'HE')
      const b = getPublicHolidays(2200, 'HE')
      expect(b).toBe(a)
      expect(Object.isFrozen(a)).toBe(true)
      expect(Object.isFrozen(a[0])).toBe(true)
    })

    it('is bounded — old entries get evicted after many distinct queries', () => {
      const first = getPublicHolidays(2300, 'DE')
      // Flood the cache far past its 64-entry bound.
      for (let year = 2301; year <= 2400; year++) {
        getPublicHolidays(year, 'DE')
      }
      const again = getPublicHolidays(2300, 'DE')
      expect(again).not.toBe(first) // evicted → freshly computed
      expect(again).toEqual(first) // …but deterministic
    })
  })

  describe('getCompanyHolidayState', () => {
    beforeEach(async () => {
      await db.delete(companySettings)
    })

    it('resolves the stored Bundesland text', async () => {
      await db.insert(companySettings).values({ state: 'Berlin' })
      expect(await getCompanyHolidayState()).toBe('BE')
    })

    it('falls back to DE for unknown text', async () => {
      await db.insert(companySettings).values({ state: 'Mordor' })
      expect(await getCompanyHolidayState()).toBe('DE')
    })

    it('falls back to DE when no settings row exists', async () => {
      expect(await getCompanyHolidayState()).toBe('DE')
    })
  })
})
