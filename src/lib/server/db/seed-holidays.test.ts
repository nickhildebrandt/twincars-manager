import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import { nationalHolidaysFor, seedDefaultHolidays } from './seed-holidays'
import { db } from './client'
import { publicHolidays } from './schema'
import { eq } from 'drizzle-orm'

/**
 * Unit + integration tests for the German public-holiday seed.
 *
 * @group integration
 * @module seed-holidays
 */
describe('nationalHolidaysFor', () => {
  it('returns 11 nationwide holidays per year', () => {
    expect(nationalHolidaysFor(2026)).toHaveLength(11)
  })

  it('includes Neujahr, Tag der Arbeit, Tag der Deutschen Einheit', () => {
    const names = nationalHolidaysFor(2026).map((h) => h.name)
    expect(names).toContain('Neujahr')
    expect(names).toContain('Tag der Arbeit')
    expect(names).toContain('Tag der Deutschen Einheit')
    expect(names).toContain('1. Weihnachtsfeiertag')
    expect(names).toContain('2. Weihnachtsfeiertag')
  })

  it('computes 2026 Easter Sunday as 2026-04-05', () => {
    const ostersonntag = nationalHolidaysFor(2026).find(
      (h) => h.name === 'Ostersonntag'
    )
    expect(ostersonntag?.date).toBe('2026-04-05')
  })

  it('Karfreitag is two days before Easter Sunday', () => {
    const hs = nationalHolidaysFor(2026)
    expect(hs.find((h) => h.name === 'Karfreitag')?.date).toBe('2026-04-03')
  })

  it('Ostermontag is one day after Easter Sunday', () => {
    expect(
      nationalHolidaysFor(2026).find((h) => h.name === 'Ostermontag')?.date
    ).toBe('2026-04-06')
  })

  it('Christi Himmelfahrt is Easter + 39 days', () => {
    expect(
      nationalHolidaysFor(2026).find((h) => h.name === 'Christi Himmelfahrt')
        ?.date
    ).toBe('2026-05-14')
  })

  it('Pfingstmontag is Easter + 50 days', () => {
    expect(
      nationalHolidaysFor(2026).find((h) => h.name === 'Pfingstmontag')?.date
    ).toBe('2026-05-25')
  })

  it('handles non-leap year 2027', () => {
    const hs = nationalHolidaysFor(2027)
    expect(hs.find((h) => h.name === 'Neujahr')?.date).toBe('2027-01-01')
    expect(hs.find((h) => h.name === 'Tag der Arbeit')?.date).toBe('2027-05-01')
  })

  it('handles leap year 2028', () => {
    expect(
      nationalHolidaysFor(2028).find((h) => h.name === 'Ostersonntag')?.date
    ).toBe('2028-04-16')
  })
})

describe('seedDefaultHolidays', () => {
  beforeEach(async () => {
    await db.delete(publicHolidays)
  })

  it('seeds 33 rows (11 holidays * 3 years)', async () => {
    await seedDefaultHolidays()
    const rows = await db.select().from(publicHolidays)
    expect(rows).toHaveLength(33)
  })

  it('is idempotent — repeated calls do not duplicate', async () => {
    await seedDefaultHolidays()
    await seedDefaultHolidays()
    const rows = await db.select().from(publicHolidays)
    expect(rows).toHaveLength(33)
  })

  it('marks every nationwide row with state=DE', async () => {
    await seedDefaultHolidays()
    const rows = await db
      .select()
      .from(publicHolidays)
      .where(eq(publicHolidays.state, 'DE'))
    expect(rows.length).toBeGreaterThanOrEqual(33)
  })
})
