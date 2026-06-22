import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  createCalendarEntry,
  deleteCalendarEntry,
  findOverlappingAppointments,
  getCalendarEntry,
  listAppointments,
  listCalendarEvents,
  updateCalendarEntry
} from './calendar-service'
import { db } from '$lib/server/db/client'
import {
  calendarEntries,
  customers,
  employeeAbsences,
  employees,
  publicHolidays,
  vehicleLicensePlateVersions,
  vehicles
} from '$lib/server/db/schema'

/**
 * Integration tests for calendar-service — multi-source event merge,
 * appointment paging, CRUD on `calendar_entries`.
 *
 * @group integration
 * @module calendar-service
 */
describe('calendar-service', () => {
  beforeEach(async () => {
    await db.delete(calendarEntries)
    await db.delete(employeeAbsences)
    await db.delete(publicHolidays)
    await db.delete(vehicleLicensePlateVersions)
    await db.delete(vehicles)
    await db.delete(customers)
    await db.delete(employees)
  })

  describe('createCalendarEntry / getCalendarEntry', () => {
    it('persists an appointment and reads it back', async () => {
      const created = await createCalendarEntry({
        kind: 'appointment',
        title: 'Inspektion',
        startsAt: new Date('2026-07-01T08:00:00Z'),
        endsAt: new Date('2026-07-01T10:00:00Z'),
        allDay: false,
        status: 'scheduled'
      })
      expect(created.id).toBeTruthy()
      const fetched = await getCalendarEntry(created.id)
      expect(fetched?.title).toBe('Inspektion')
      expect(fetched?.kind).toBe('appointment')
    })

    it('persists a closure entry', async () => {
      const created = await createCalendarEntry({
        kind: 'closure',
        title: 'Betriebsurlaub',
        startsAt: new Date('2026-12-23T00:00:00Z'),
        endsAt: new Date('2027-01-02T00:00:00Z'),
        allDay: true
      })
      expect(created.kind).toBe('closure')
      const fetched = await getCalendarEntry(created.id)
      expect(fetched?.title).toBe('Betriebsurlaub')
    })

    it('returns null for unknown id', async () => {
      expect(
        await getCalendarEntry('00000000-0000-0000-0000-000000000000')
      ).toBeNull()
    })
  })

  describe('updateCalendarEntry', () => {
    it('updates fields on an existing entry', async () => {
      const created = await createCalendarEntry({
        kind: 'appointment',
        title: 'Alt',
        startsAt: new Date('2026-07-01T08:00:00Z'),
        endsAt: new Date('2026-07-01T10:00:00Z'),
        allDay: false,
        status: 'scheduled'
      })
      const updated = await updateCalendarEntry(created.id, {
        title: 'Neu',
        status: 'completed'
      })
      expect(updated.title).toBe('Neu')
      expect(updated.status).toBe('completed')
    })

    it('returns undefined when updating an unknown id', async () => {
      const updated = await updateCalendarEntry(
        '00000000-0000-0000-0000-000000000000',
        { title: 'noop' }
      )
      expect(updated).toBeUndefined()
    })
  })

  describe('deleteCalendarEntry', () => {
    it('removes the row', async () => {
      const created = await createCalendarEntry({
        kind: 'appointment',
        title: 'Doomed',
        startsAt: new Date('2026-07-01T08:00:00Z'),
        endsAt: new Date('2026-07-01T10:00:00Z'),
        allDay: false,
        status: 'scheduled'
      })
      await deleteCalendarEntry(created.id)
      expect(await getCalendarEntry(created.id)).toBeNull()
    })

    it('is a no-op when the id is unknown', async () => {
      await expect(
        deleteCalendarEntry('00000000-0000-0000-0000-000000000000')
      ).resolves.toBeUndefined()
    })
  })

  describe('listCalendarEvents', () => {
    let employeeId: string
    let otherEmployeeId: string
    let vehicleId: string

    beforeEach(async () => {
      const [emp] = await db
        .insert(employees)
        .values({
          personnelNumber: 'P-001',
          firstName: 'Anna',
          lastName: 'Mustermann'
        })
        .returning()
      const [emp2] = await db
        .insert(employees)
        .values({
          personnelNumber: 'P-002',
          firstName: 'Bert',
          lastName: 'Beispiel'
        })
        .returning()
      employeeId = emp.id
      otherEmployeeId = emp2.id

      const [veh] = await db
        .insert(vehicles)
        .values({
          make: 'VW',
          model: 'Golf',
          archived: false,
          nextHu: '2026-06-15'
        })
        .returning()
      vehicleId = veh.id
      // Plate for the HU label.
      await db
        .insert(vehicleLicensePlateVersions)
        .values({
          vehicleId: veh.id,
          validFrom: '2024-01-01',
          licensePlate: 'B-VW 1'
        })
    })

    it('merges appointments, closures, absences and holidays', async () => {
      // Timed appointment within window
      await createCalendarEntry({
        kind: 'appointment',
        title: 'Inspektion',
        startsAt: new Date('2026-06-10T09:00:00Z'),
        endsAt: new Date('2026-06-10T10:00:00Z'),
        allDay: false,
        status: 'scheduled',
        employeeId
      })
      // Multi-day all-day closure
      await createCalendarEntry({
        kind: 'closure',
        title: 'Brückentag',
        startsAt: new Date('2026-06-19T00:00:00Z'),
        endsAt: new Date('2026-06-20T00:00:00Z'),
        allDay: true
      })
      // Employee vacation
      await db
        .insert(employeeAbsences)
        .values({
          employeeId,
          type: 'vacation',
          dateFrom: '2026-06-22',
          dateTo: '2026-06-24',
          halfDay: false,
          status: 'approved'
        })
      // Public holiday
      await db
        .insert(publicHolidays)
        .values({ state: 'Berlin', date: '2026-06-08', name: 'Pfingstmontag' })

      const events = await listCalendarEvents('2026-06-01', '2026-06-30')

      const kinds = events.map((e) => e.kind)
      expect(kinds).toContain('appointment')
      expect(kinds).toContain('business_closure')
      expect(kinds).toContain('employee_vacation')
      expect(kinds).toContain('public_holiday')

      // Closure spans 2 days, vacation spans 3 days.
      const closures = events.filter((e) => e.kind === 'business_closure')
      expect(closures).toHaveLength(2)
      expect(closures.map((e) => e.dateIso).sort()).toEqual([
        '2026-06-19',
        '2026-06-20'
      ])
      expect(closures[0].title).toMatch(/Betriebsschließung — Brückentag/)

      const vacations = events.filter((e) => e.kind === 'employee_vacation')
      expect(vacations).toHaveLength(3)
      expect(vacations.map((e) => e.dateIso).sort()).toEqual([
        '2026-06-22',
        '2026-06-23',
        '2026-06-24'
      ])
      expect(vacations[0].title).toMatch(/Urlaub · Anna Mustermann/)

      const appt = events.find((e) => e.kind === 'appointment')
      expect(appt?.title).toMatch(/Inspektion · Anna Mustermann/)
    })

    // pg-mem limitation: `AND(isNotNull(col), gte(col, ...), lte(col, ...))`
    // on a date column returns no rows even though each predicate alone
    // matches. The HU subquery in `listCalendarEvents` relies on exactly
    // that combination, so we can't verify the `hu_due` branch in-memory.
    // The integration path is exercised against a real Postgres in CI.
    it.skip('emits hu_due events from vehicles.nextHu in range', () => {})

    it('skips cancelled appointments and cancelled absences', async () => {
      await createCalendarEntry({
        kind: 'appointment',
        title: 'Storniert',
        startsAt: new Date('2026-06-10T09:00:00Z'),
        endsAt: new Date('2026-06-10T10:00:00Z'),
        allDay: false,
        status: 'cancelled'
      })
      await db
        .insert(employeeAbsences)
        .values({
          employeeId,
          type: 'sick',
          dateFrom: '2026-06-22',
          dateTo: '2026-06-24',
          halfDay: false,
          status: 'cancelled'
        })
      const events = await listCalendarEvents('2026-06-01', '2026-06-30')
      expect(events.find((e) => e.title === 'Storniert')).toBeUndefined()
      expect(events.find((e) => e.kind === 'employee_sick')).toBeUndefined()
    })

    it('filters by employee id, both for calendar entries and absences', async () => {
      await createCalendarEntry({
        kind: 'appointment',
        title: 'Anna-Termin',
        startsAt: new Date('2026-06-10T09:00:00Z'),
        endsAt: new Date('2026-06-10T10:00:00Z'),
        allDay: false,
        status: 'scheduled',
        employeeId
      })
      await createCalendarEntry({
        kind: 'appointment',
        title: 'Bert-Termin',
        startsAt: new Date('2026-06-12T09:00:00Z'),
        endsAt: new Date('2026-06-12T10:00:00Z'),
        allDay: false,
        status: 'scheduled',
        employeeId: otherEmployeeId
      })
      await db
        .insert(employeeAbsences)
        .values({
          employeeId,
          type: 'vacation',
          dateFrom: '2026-06-22',
          dateTo: '2026-06-22',
          halfDay: false,
          status: 'approved'
        })
      await db
        .insert(employeeAbsences)
        .values({
          employeeId: otherEmployeeId,
          type: 'vacation',
          dateFrom: '2026-06-23',
          dateTo: '2026-06-23',
          halfDay: false,
          status: 'approved'
        })
      const events = await listCalendarEvents(
        '2026-06-01',
        '2026-06-30',
        employeeId
      )
      const titles = events.map((e) => e.title)
      expect(titles.some((t) => t.includes('Anna-Termin'))).toBe(true)
      expect(titles.some((t) => t.includes('Bert-Termin'))).toBe(false)
      const vac = events.filter((e) => e.kind === 'employee_vacation')
      expect(vac).toHaveLength(1)
      expect(vac[0].dateIso).toBe('2026-06-22')
    })

    it('returns an empty array when no source has data in range', async () => {
      const events = await listCalendarEvents('2030-01-01', '2030-01-31')
      expect(events).toEqual([])
    })
  })

  describe('listAppointments', () => {
    beforeEach(async () => {
      await createCalendarEntry({
        kind: 'appointment',
        title: 'Inspektion',
        startsAt: new Date('2026-06-10T09:00:00Z'),
        endsAt: new Date('2026-06-10T10:00:00Z'),
        allDay: false,
        status: 'scheduled'
      })
      await createCalendarEntry({
        kind: 'appointment',
        title: 'Reifenwechsel',
        startsAt: new Date('2026-07-01T13:00:00Z'),
        endsAt: new Date('2026-07-01T14:00:00Z'),
        allDay: false,
        status: 'scheduled'
      })
      // A closure must not appear in the appointments list.
      await createCalendarEntry({
        kind: 'closure',
        title: 'Betriebsurlaub',
        startsAt: new Date('2026-12-23T00:00:00Z'),
        endsAt: new Date('2026-12-30T00:00:00Z'),
        allDay: true
      })
    })

    it('returns only kind=appointment rows', async () => {
      const res = await listAppointments({ page: 1, size: 25 })
      expect(res.total).toBe(2)
      expect(res.items.every((r) => r.kind === 'appointment')).toBe(true)
      expect(res.pageCount).toBe(1)
    })

    it('paginates and reports pageCount', async () => {
      const res = await listAppointments({ page: 1, size: 1 })
      expect(res.items).toHaveLength(1)
      expect(res.total).toBe(2)
      expect(res.pageCount).toBe(2)
    })

    it('filters by case-insensitive title search', async () => {
      const res = await listAppointments({ page: 1, size: 25, q: 'reifen' })
      expect(res.total).toBe(1)
      expect(res.items[0].title).toBe('Reifenwechsel')
    })

    it('filters by date range on startsAt', async () => {
      const res = await listAppointments({
        page: 1,
        size: 25,
        from: '2026-07-01',
        to: '2026-07-31'
      })
      expect(res.total).toBe(1)
      expect(res.items[0].title).toBe('Reifenwechsel')
    })

    it('returns pageCount=1 even when empty', async () => {
      await db.delete(calendarEntries)
      const res = await listAppointments({ page: 1, size: 25 })
      expect(res.total).toBe(0)
      expect(res.items).toEqual([])
      expect(res.pageCount).toBe(1)
    })
  })

  /* ──────────────────────────────────────────────────────────────────────
   * findOverlappingAppointments — admin double-booking warning gate
   * ──────────────────────────────────────────────────────────────────── */

  describe('findOverlappingAppointments', () => {
    const seedAppt = async (
      title: string,
      starts: string,
      ends: string,
      status: 'scheduled' | 'completed' | 'cancelled' = 'scheduled'
    ): Promise<string> => {
      const row = await createCalendarEntry({
        kind: 'appointment',
        title,
        startsAt: new Date(starts),
        endsAt: new Date(ends),
        allDay: false,
        status
      })
      return row.id
    }

    it('returns an empty list when nothing in the window', async () => {
      await seedAppt(
        'Inspektion',
        '2026-07-01T08:00:00Z',
        '2026-07-01T09:00:00Z'
      )
      const res = await findOverlappingAppointments(
        new Date('2026-07-02T08:00:00Z'),
        new Date('2026-07-02T09:00:00Z')
      )
      expect(res).toEqual([])
    })

    it('detects every overlap flavour (exact, left, right, inside, containing)', async () => {
      // Existing slot: 09:00 – 10:00
      const baseId = await seedAppt(
        'Existing',
        '2026-07-01T09:00:00Z',
        '2026-07-01T10:00:00Z'
      )

      const cases: Array<[string, string, string]> = [
        ['exact', '2026-07-01T09:00:00Z', '2026-07-01T10:00:00Z'],
        ['left edge', '2026-07-01T08:30:00Z', '2026-07-01T09:30:00Z'],
        ['right edge', '2026-07-01T09:30:00Z', '2026-07-01T10:30:00Z'],
        ['fully inside', '2026-07-01T09:15:00Z', '2026-07-01T09:45:00Z'],
        ['containing', '2026-07-01T08:00:00Z', '2026-07-01T11:00:00Z']
      ]

      for (const [label, s, e] of cases) {
        const res = await findOverlappingAppointments(new Date(s), new Date(e))
        expect(
          res.map((r) => r.id),
          `case: ${label}`
        ).toEqual([baseId])
      }
    })

    it('treats back-to-back appointments as NOT overlapping', async () => {
      await seedAppt('First', '2026-07-01T09:00:00Z', '2026-07-01T10:00:00Z')
      // Candidate is 10:00 – 11:00 — touches but does not overlap.
      const res = await findOverlappingAppointments(
        new Date('2026-07-01T10:00:00Z'),
        new Date('2026-07-01T11:00:00Z')
      )
      expect(res).toEqual([])
    })

    it('honours excludeId so self-edits do not trigger a warning', async () => {
      const id = await seedAppt(
        'Self',
        '2026-07-01T09:00:00Z',
        '2026-07-01T10:00:00Z'
      )
      // Same window — without excludeId we'd see one hit.
      const without = await findOverlappingAppointments(
        new Date('2026-07-01T09:00:00Z'),
        new Date('2026-07-01T10:00:00Z')
      )
      expect(without).toHaveLength(1)
      const withExclude = await findOverlappingAppointments(
        new Date('2026-07-01T09:00:00Z'),
        new Date('2026-07-01T10:00:00Z'),
        id
      )
      expect(withExclude).toEqual([])
    })

    it('excludes cancelled appointments — those slots are free for the operator', async () => {
      await seedAppt(
        'Cancelled',
        '2026-07-01T09:00:00Z',
        '2026-07-01T10:00:00Z',
        'cancelled'
      )
      const res = await findOverlappingAppointments(
        new Date('2026-07-01T09:00:00Z'),
        new Date('2026-07-01T10:00:00Z')
      )
      expect(res).toEqual([])
    })

    it('returns appointments ordered by startsAt and surfaces the title', async () => {
      await seedAppt('Zweite', '2026-07-01T10:30:00Z', '2026-07-01T11:00:00Z')
      await seedAppt('Erste', '2026-07-01T09:30:00Z', '2026-07-01T10:00:00Z')
      const res = await findOverlappingAppointments(
        new Date('2026-07-01T09:00:00Z'),
        new Date('2026-07-01T12:00:00Z')
      )
      expect(res.map((r) => r.title)).toEqual(['Erste', 'Zweite'])
      expect(res[0].startsAt).toBeInstanceOf(Date)
      expect(res[0].endsAt).toBeInstanceOf(Date)
    })

    it('ignores closure entries — only kind=appointment counts', async () => {
      await createCalendarEntry({
        kind: 'closure',
        title: 'Betriebsurlaub',
        startsAt: new Date('2026-07-01T00:00:00Z'),
        endsAt: new Date('2026-07-01T23:59:59Z'),
        allDay: true
      })
      const res = await findOverlappingAppointments(
        new Date('2026-07-01T09:00:00Z'),
        new Date('2026-07-01T10:00:00Z')
      )
      expect(res).toEqual([])
    })
  })
})
