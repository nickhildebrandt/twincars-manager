import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import { findFreeSlots } from './public-api-service'
import { db } from '$lib/server/db/client'
import {
  calendarEntries,
  publicHolidays,
  workshopHours
} from '$lib/server/db/schema'

/**
 * Integration tests for the public-API slot finder. Backed by pg-mem.
 *
 * @group integration
 * @module public-api-service
 */
describe('public-api-service', () => {
  beforeEach(async () => {
    await db.delete(calendarEntries)
    await db.delete(publicHolidays)
    await db.delete(workshopHours)
  })

  /**
   * Build a Date at the given local-time components. Tests anchor on
   * Mon 2026-06-01 so weekday math is predictable.
   */
  const at = (y: number, m: number, d: number, hh = 0, mm = 0): Date =>
    new Date(y, m - 1, d, hh, mm, 0, 0)

  const seedHoursMonFri = async () => {
    await db.insert(workshopHours).values([
      { weekday: 0, opensAt: '08:00', closesAt: '17:00', closed: true },
      { weekday: 1, opensAt: '08:00', closesAt: '17:00', closed: false },
      { weekday: 2, opensAt: '08:00', closesAt: '17:00', closed: false },
      { weekday: 3, opensAt: '08:00', closesAt: '17:00', closed: false },
      { weekday: 4, opensAt: '08:00', closesAt: '17:00', closed: false },
      { weekday: 5, opensAt: '08:00', closesAt: '17:00', closed: false },
      { weekday: 6, opensAt: '08:00', closesAt: '17:00', closed: true }
    ])
  }

  it('honours workshop_hours — closed days are excluded', async () => {
    await seedHoursMonFri()
    // 2026-06-06 is Saturday → closed
    const slots = await findFreeSlots({
      from: at(2026, 6, 6, 0, 0),
      to: at(2026, 6, 6, 23, 59),
      durationMinutes: 30
    })
    expect(slots).toHaveLength(0)
  })

  it('returns 15-minute granular slots within opening hours', async () => {
    await seedHoursMonFri()
    // Monday 2026-06-01, full day, 30 min slots
    const slots = await findFreeSlots({
      from: at(2026, 6, 1, 0, 0),
      to: at(2026, 6, 1, 23, 59),
      durationMinutes: 30
    })
    // From 08:00 in 15-min steps; the last 30-min slot starts at
    // 16:30 (ending 17:00). That's the closing minute — open at
    // [16:30, 17:00). Steps from 08:00 to 16:30 inclusive = 35.
    expect(slots).toHaveLength(35)
    expect(slots[0].startsAt.getHours()).toBe(8)
    expect(slots[0].startsAt.getMinutes()).toBe(0)
    expect(slots[0].endsAt.getHours()).toBe(8)
    expect(slots[0].endsAt.getMinutes()).toBe(30)
    const last = slots[slots.length - 1]
    expect(last.startsAt.getHours()).toBe(16)
    expect(last.startsAt.getMinutes()).toBe(30)
    expect(last.endsAt.getHours()).toBe(17)
    expect(last.endsAt.getMinutes()).toBe(0)
  })

  it('excludes overlapping appointments', async () => {
    await seedHoursMonFri()
    // Block 09:00-10:00 on Monday
    await db
      .insert(calendarEntries)
      .values({
        kind: 'appointment',
        title: 'Inspektion',
        startsAt: at(2026, 6, 1, 9, 0),
        endsAt: at(2026, 6, 1, 10, 0),
        allDay: false,
        status: 'scheduled'
      })
    const slots = await findFreeSlots({
      from: at(2026, 6, 1, 0, 0),
      to: at(2026, 6, 1, 23, 59),
      durationMinutes: 30
    })
    // Any 30-min slot starting between 08:30 and 09:30 inclusive
    // would overlap [09:00, 10:00). That's 08:30, 08:45, 09:00,
    // 09:15, 09:30 — five slots gone.
    expect(slots).toHaveLength(35 - 5)
    for (const s of slots) {
      const start = s.startsAt.getTime()
      const end = s.endsAt.getTime()
      expect(
        start >= at(2026, 6, 1, 10, 0).getTime() ||
          end <= at(2026, 6, 1, 9, 0).getTime()
      ).toBe(true)
    }
  })

  it('cancelled appointments do NOT block slots', async () => {
    await seedHoursMonFri()
    await db
      .insert(calendarEntries)
      .values({
        kind: 'appointment',
        title: 'Abgesagt',
        startsAt: at(2026, 6, 1, 9, 0),
        endsAt: at(2026, 6, 1, 10, 0),
        allDay: false,
        status: 'cancelled'
      })
    const slots = await findFreeSlots({
      from: at(2026, 6, 1, 0, 0),
      to: at(2026, 6, 1, 23, 59),
      durationMinutes: 30
    })
    expect(slots).toHaveLength(35)
  })

  it('excludes business closures (calendar_entries kind=closure)', async () => {
    await seedHoursMonFri()
    // Workshop closed all of Monday
    await db
      .insert(calendarEntries)
      .values({
        kind: 'closure',
        title: 'Betriebsurlaub',
        startsAt: at(2026, 6, 1, 0, 0),
        endsAt: at(2026, 6, 1, 23, 59),
        allDay: true
      })
    const slots = await findFreeSlots({
      from: at(2026, 6, 1, 0, 0),
      to: at(2026, 6, 1, 23, 59),
      durationMinutes: 30
    })
    expect(slots).toHaveLength(0)
  })

  it('excludes German public holidays', async () => {
    await seedHoursMonFri()
    await db
      .insert(publicHolidays)
      .values({ state: 'Berlin', date: '2026-06-01', name: 'Pfingstmontag' })
    const slots = await findFreeSlots({
      from: at(2026, 6, 1, 0, 0),
      to: at(2026, 6, 1, 23, 59),
      durationMinutes: 30
    })
    expect(slots).toHaveLength(0)
  })

  it('supports a multi-day range and counts each open day independently', async () => {
    await seedHoursMonFri()
    // Mon 2026-06-01 .. Wed 2026-06-03 (3 open days, 35 slots each = 105)
    const slots = await findFreeSlots({
      from: at(2026, 6, 1, 0, 0),
      to: at(2026, 6, 3, 23, 59),
      durationMinutes: 30
    })
    expect(slots).toHaveLength(35 * 3)
  })

  it('range > 60 days throws', async () => {
    await seedHoursMonFri()
    await expect(
      findFreeSlots({
        from: at(2026, 6, 1, 0, 0),
        to: at(2026, 9, 1, 0, 0),
        durationMinutes: 30
      })
    ).rejects.toThrow(/60 days/)
  })

  it('refuses non-positive duration', async () => {
    await seedHoursMonFri()
    await expect(
      findFreeSlots({
        from: at(2026, 6, 1, 0, 0),
        to: at(2026, 6, 1, 23, 59),
        durationMinutes: 0
      })
    ).rejects.toThrow(/positive/)
  })

  it('refuses reversed range (to before from)', async () => {
    await seedHoursMonFri()
    await expect(
      findFreeSlots({
        from: at(2026, 6, 2, 0, 0),
        to: at(2026, 6, 1, 0, 0),
        durationMinutes: 30
      })
    ).rejects.toThrow(/>= from/)
  })

  it('honours per-weekday opening hours (Friday 09:00–13:00)', async () => {
    await db.insert(workshopHours).values([
      { weekday: 0, opensAt: '08:00', closesAt: '17:00', closed: true },
      { weekday: 1, opensAt: '08:00', closesAt: '17:00', closed: false },
      { weekday: 2, opensAt: '08:00', closesAt: '17:00', closed: false },
      { weekday: 3, opensAt: '08:00', closesAt: '17:00', closed: false },
      { weekday: 4, opensAt: '08:00', closesAt: '17:00', closed: false },
      { weekday: 5, opensAt: '09:00', closesAt: '13:00', closed: false },
      { weekday: 6, opensAt: '08:00', closesAt: '17:00', closed: true }
    ])
    // Fri 2026-06-05 9:00-13:00 → 30-min slots stepping in 15 min:
    // last slot starts at 12:30 → ends 13:00. From 09:00 to 12:30
    // inclusive = 15 slots.
    const slots = await findFreeSlots({
      from: at(2026, 6, 5, 0, 0),
      to: at(2026, 6, 5, 23, 59),
      durationMinutes: 30
    })
    expect(slots).toHaveLength(15)
    expect(slots[0].startsAt.getHours()).toBe(9)
    expect(slots[slots.length - 1].endsAt.getHours()).toBe(13)
  })
})
