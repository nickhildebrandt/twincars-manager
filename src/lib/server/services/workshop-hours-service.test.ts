import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  isWithinHours,
  listWorkshopHours,
  updateWorkshopHours
} from './workshop-hours-service'
import { db } from '$lib/server/db/client'
import { workshopHours } from '$lib/server/db/schema'

/**
 * Integration tests for the workshop-hours service. Backed by pg-mem.
 *
 * @group integration
 * @module workshop-hours-service
 */
describe('workshop-hours-service', () => {
  beforeEach(async () => {
    await db.delete(workshopHours)
  })

  describe('listWorkshopHours', () => {
    it('lazily creates all 7 rows on first call with sane defaults', async () => {
      const rows = await listWorkshopHours()
      expect(rows).toHaveLength(7)
      expect(rows.map((r) => r.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6])
      // Mon-Fri open
      for (let d = 1; d <= 5; d++) {
        const row = rows.find((r) => r.weekday === d)!
        expect(row.closed).toBe(false)
        expect(row.opensAt).toBe('08:00')
        expect(row.closesAt).toBe('17:00')
      }
      // Sat + Sun closed
      expect(rows.find((r) => r.weekday === 0)!.closed).toBe(true)
      expect(rows.find((r) => r.weekday === 6)!.closed).toBe(true)
    })

    it('is idempotent — calling it again returns the same rows', async () => {
      const first = await listWorkshopHours()
      const second = await listWorkshopHours()
      expect(second.map((r) => r.weekday)).toEqual(first.map((r) => r.weekday))
      const stored = await db.select().from(workshopHours)
      expect(stored).toHaveLength(7)
    })

    it('only fills in missing weekdays without touching existing ones', async () => {
      await db
        .insert(workshopHours)
        .values({
          weekday: 1,
          opensAt: '09:30',
          closesAt: '18:30',
          closed: false
        })
      const rows = await listWorkshopHours()
      expect(rows).toHaveLength(7)
      const monday = rows.find((r) => r.weekday === 1)!
      expect(monday.opensAt).toBe('09:30')
      expect(monday.closesAt).toBe('18:30')
    })
  })

  describe('updateWorkshopHours', () => {
    it('inserts the row if it does not exist yet', async () => {
      const updated = await updateWorkshopHours(3, {
        opensAt: '07:00',
        closesAt: '15:00',
        closed: false
      })
      expect(updated.weekday).toBe(3)
      expect(updated.opensAt).toBe('07:00')
      expect(updated.closesAt).toBe('15:00')
      expect(updated.closed).toBe(false)
    })

    it('updates an existing row and bumps updatedAt', async () => {
      await listWorkshopHours() // seed all 7
      const all = await db.select().from(workshopHours)
      const monday = all.find((r) => r.weekday === 1)!
      const updated = await updateWorkshopHours(1, {
        opensAt: '09:00',
        closesAt: '18:00',
        closed: false
      })
      expect(updated.opensAt).toBe('09:00')
      expect(updated.closesAt).toBe('18:00')
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        monday.updatedAt.getTime()
      )
    })

    it('can toggle a day to closed', async () => {
      await listWorkshopHours()
      const updated = await updateWorkshopHours(5, {
        opensAt: '08:00',
        closesAt: '17:00',
        closed: true
      })
      expect(updated.closed).toBe(true)
    })
  })

  describe('isWithinHours', () => {
    beforeEach(async () => {
      await db.insert(workshopHours).values([
        { weekday: 0, opensAt: '08:00', closesAt: '17:00', closed: true },
        { weekday: 1, opensAt: '08:00', closesAt: '17:00', closed: false },
        { weekday: 2, opensAt: '08:00', closesAt: '17:00', closed: false },
        { weekday: 3, opensAt: '08:00', closesAt: '17:00', closed: false },
        { weekday: 4, opensAt: '08:00', closesAt: '17:00', closed: false },
        { weekday: 5, opensAt: '09:00', closesAt: '13:00', closed: false },
        { weekday: 6, opensAt: '08:00', closesAt: '17:00', closed: true }
      ])
    })

    /** Build a Date for a given weekday at HH:MM in local time. */
    const at = (weekday: number, hh: number, mm: number): Date => {
      // Start from a Sunday (2026-01-04 is a Sunday) and walk forward
      // so the resulting Date has the expected `getDay()` value.
      const base = new Date(2026, 0, 4) // weekday 0
      base.setDate(base.getDate() + weekday)
      base.setHours(hh, mm, 0, 0)
      return base
    }

    it('returns true mid-day on an open weekday', async () => {
      expect(await isWithinHours(at(2, 10, 0))).toBe(true)
    })

    it('returns true exactly at opensAt', async () => {
      expect(await isWithinHours(at(1, 8, 0))).toBe(true)
    })

    it('returns false exactly at closesAt (cutoff, not inclusive)', async () => {
      expect(await isWithinHours(at(1, 17, 0))).toBe(false)
    })

    it('returns false before opensAt', async () => {
      expect(await isWithinHours(at(1, 7, 59))).toBe(false)
    })

    it('returns false after closesAt', async () => {
      expect(await isWithinHours(at(1, 17, 30))).toBe(false)
    })

    it('returns false on a closed weekday at any time', async () => {
      expect(await isWithinHours(at(0, 10, 0))).toBe(false)
      expect(await isWithinHours(at(6, 12, 0))).toBe(false)
    })

    it('honors per-weekday hours (Friday 09:00-13:00)', async () => {
      expect(await isWithinHours(at(5, 8, 30))).toBe(false)
      expect(await isWithinHours(at(5, 9, 0))).toBe(true)
      expect(await isWithinHours(at(5, 12, 59))).toBe(true)
      expect(await isWithinHours(at(5, 13, 0))).toBe(false)
    })

    it('returns sane defaults when no row exists for the weekday', async () => {
      await db.delete(workshopHours)
      // Sunday (0) defaults to closed
      expect(await isWithinHours(at(0, 10, 0))).toBe(false)
      // Tuesday (2) defaults to open 08-17
      expect(await isWithinHours(at(2, 10, 0))).toBe(true)
      expect(await isWithinHours(at(2, 17, 0))).toBe(false)
    })
  })
})
