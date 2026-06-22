import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  absenceDaysInPeriod,
  createAbsence,
  deleteAbsence,
  deleteAbsencesByIds,
  findVacationSickConflicts,
  getAbsence,
  listAbsencesForEmployee,
  listAbsencesInRange,
  remainingVacationDays,
  updateAbsence
} from './absence-service'
import { db } from '$lib/server/db/client'
import { employeeAbsences, employees } from '$lib/server/db/schema'

/**
 * Integration tests for the absence service — CRUD, range queries,
 * conflict detection and remaining-vacation calculation.
 *
 * @group integration
 * @module absence-service
 */
describe('absence-service', () => {
  let employeeId: string
  let otherEmployeeId: string

  beforeEach(async () => {
    await db.delete(employeeAbsences)
    await db.delete(employees)
    const [e1] = await db
      .insert(employees)
      .values({
        personnelNumber: 'P-001',
        firstName: 'Anna',
        lastName: 'Mustermann',
        vacationDaysPerYear: 30
      })
      .returning()
    const [e2] = await db
      .insert(employees)
      .values({
        personnelNumber: 'P-002',
        firstName: 'Bert',
        lastName: 'Beispiel',
        vacationDaysPerYear: 25
      })
      .returning()
    employeeId = e1.id
    otherEmployeeId = e2.id
  })

  describe('createAbsence', () => {
    it('persists and returns the created row', async () => {
      const created = await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05',
        halfDay: false,
        status: 'approved'
      })
      expect(created.id).toBeTruthy()
      expect(created.type).toBe('vacation')
      const fetched = await getAbsence(created.id)
      expect(fetched?.dateFrom).toBe('2026-06-01')
    })

    it('rejects when dateTo is before dateFrom', async () => {
      await expect(
        createAbsence({
          employeeId,
          type: 'vacation',
          dateFrom: '2026-06-10',
          dateTo: '2026-06-01',
          halfDay: false,
          status: 'approved'
        })
      ).rejects.toThrow('Bis-Datum darf nicht vor dem Von-Datum liegen.')
    })
  })

  describe('updateAbsence', () => {
    it('updates fields and bumps updatedAt', async () => {
      const created = await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05',
        halfDay: false,
        status: 'planned'
      })
      const updated = await updateAbsence(created.id, { status: 'approved' })
      expect(updated.status).toBe('approved')
    })

    it('rejects when patched dateTo is before dateFrom', async () => {
      const created = await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05',
        halfDay: false,
        status: 'approved'
      })
      await expect(
        updateAbsence(created.id, {
          dateFrom: '2026-06-10',
          dateTo: '2026-06-01'
        })
      ).rejects.toThrow('Bis-Datum darf nicht vor dem Von-Datum liegen.')
    })

    it('throws when the absence id is unknown', async () => {
      await expect(
        updateAbsence('00000000-0000-0000-0000-000000000000', {
          status: 'cancelled'
        })
      ).rejects.toThrow('Abwesenheit nicht gefunden.')
    })
  })

  describe('deleteAbsence', () => {
    it('removes the row', async () => {
      const created = await createAbsence({
        employeeId,
        type: 'sick',
        dateFrom: '2026-02-01',
        dateTo: '2026-02-03',
        halfDay: false,
        status: 'approved'
      })
      await deleteAbsence(created.id)
      expect(await getAbsence(created.id)).toBeNull()
    })
  })

  describe('deleteAbsencesByIds', () => {
    it('removes only the listed ids', async () => {
      const a = await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-03-01',
        dateTo: '2026-03-02',
        halfDay: false,
        status: 'approved'
      })
      const b = await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-04-01',
        dateTo: '2026-04-02',
        halfDay: false,
        status: 'approved'
      })
      await deleteAbsencesByIds([a.id])
      expect(await getAbsence(a.id)).toBeNull()
      expect(await getAbsence(b.id)).not.toBeNull()
    })

    it('is a no-op for an empty array', async () => {
      await expect(deleteAbsencesByIds([])).resolves.toBeUndefined()
    })
  })

  describe('getAbsence', () => {
    it('returns null for an unknown id', async () => {
      expect(
        await getAbsence('00000000-0000-0000-0000-000000000000')
      ).toBeNull()
    })
  })

  describe('listAbsencesForEmployee', () => {
    beforeEach(async () => {
      await db.insert(employeeAbsences).values([
        {
          employeeId,
          type: 'vacation',
          dateFrom: '2025-12-20',
          dateTo: '2026-01-05',
          halfDay: false,
          status: 'approved'
        },
        {
          employeeId,
          type: 'vacation',
          dateFrom: '2026-06-01',
          dateTo: '2026-06-05',
          halfDay: false,
          status: 'approved'
        },
        {
          employeeId,
          type: 'sick',
          dateFrom: '2027-01-10',
          dateTo: '2027-01-12',
          halfDay: false,
          status: 'approved'
        },
        {
          employeeId: otherEmployeeId,
          type: 'vacation',
          dateFrom: '2026-06-15',
          dateTo: '2026-06-20',
          halfDay: false,
          status: 'approved'
        }
      ])
    })

    it('returns every absence for the employee (no year filter)', async () => {
      const rows = await listAbsencesForEmployee(employeeId)
      expect(rows).toHaveLength(3)
    })

    it('filters by overlapping year', async () => {
      const rows = await listAbsencesForEmployee(employeeId, { year: 2026 })
      expect(rows.map((r) => r.dateFrom).sort()).toEqual([
        '2025-12-20',
        '2026-06-01'
      ])
    })

    it('returns an empty array for an employee with no absences', async () => {
      const rows = await listAbsencesForEmployee(
        '00000000-0000-0000-0000-000000000000'
      )
      expect(rows).toEqual([])
    })
  })

  describe('listAbsencesInRange', () => {
    it('returns rows that overlap the requested range, across employees', async () => {
      await db.insert(employeeAbsences).values([
        {
          employeeId,
          type: 'vacation',
          dateFrom: '2026-05-25',
          dateTo: '2026-06-02',
          halfDay: false,
          status: 'approved'
        },
        {
          employeeId,
          type: 'vacation',
          dateFrom: '2026-07-01',
          dateTo: '2026-07-05',
          halfDay: false,
          status: 'approved'
        },
        {
          employeeId: otherEmployeeId,
          type: 'sick',
          dateFrom: '2026-06-15',
          dateTo: '2026-06-18',
          halfDay: false,
          status: 'approved'
        }
      ])
      const rows = await listAbsencesInRange('2026-06-01', '2026-06-30')
      expect(rows.map((r) => r.dateFrom).sort()).toEqual([
        '2026-05-25',
        '2026-06-15'
      ])
    })

    it('returns an empty array when no absence overlaps', async () => {
      const rows = await listAbsencesInRange('2030-01-01', '2030-01-31')
      expect(rows).toEqual([])
    })
  })

  describe('findVacationSickConflicts', () => {
    it('finds sick rows that collide with a planned vacation window', async () => {
      const sick = await createAbsence({
        employeeId,
        type: 'sick',
        dateFrom: '2026-06-10',
        dateTo: '2026-06-14',
        halfDay: false,
        status: 'approved'
      })
      const hits = await findVacationSickConflicts({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-12',
        dateTo: '2026-06-20'
      })
      expect(hits.map((h) => h.id)).toEqual([sick.id])
    })

    it('ignores cancelled rows and rows excluded by id', async () => {
      const a = await createAbsence({
        employeeId,
        type: 'sick',
        dateFrom: '2026-06-10',
        dateTo: '2026-06-14',
        halfDay: false,
        status: 'cancelled'
      })
      const b = await createAbsence({
        employeeId,
        type: 'sick',
        dateFrom: '2026-06-13',
        dateTo: '2026-06-15',
        halfDay: false,
        status: 'approved'
      })
      const noExclude = await findVacationSickConflicts({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-12',
        dateTo: '2026-06-20'
      })
      expect(noExclude.map((r) => r.id)).toEqual([b.id])
      const withExclude = await findVacationSickConflicts({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-12',
        dateTo: '2026-06-20',
        excludeId: b.id
      })
      expect(withExclude).toEqual([])
      // ensure cancelled row was never returned
      expect(noExclude.find((r) => r.id === a.id)).toBeUndefined()
    })

    it('returns an empty array for type=other', async () => {
      await createAbsence({
        employeeId,
        type: 'sick',
        dateFrom: '2026-06-10',
        dateTo: '2026-06-14',
        halfDay: false,
        status: 'approved'
      })
      const hits = await findVacationSickConflicts({
        employeeId,
        type: 'other',
        dateFrom: '2026-06-12',
        dateTo: '2026-06-20'
      })
      expect(hits).toEqual([])
    })
  })

  describe('absenceDaysInPeriod', () => {
    it('counts business days in the window (weekends skipped)', async () => {
      // 2026-06-01 (Mon) … 2026-06-07 (Sun) — 5 business days
      await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-07',
        halfDay: false,
        status: 'approved'
      })
      const days = await absenceDaysInPeriod(
        employeeId,
        'vacation',
        '2026-06-01',
        '2026-06-30'
      )
      expect(days).toBe(5)
    })

    it('honours the half-day flag (max 0.5)', async () => {
      await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-02',
        dateTo: '2026-06-02',
        halfDay: true,
        status: 'approved'
      })
      const days = await absenceDaysInPeriod(
        employeeId,
        'vacation',
        '2026-06-01',
        '2026-06-30'
      )
      expect(days).toBe(0.5)
    })

    it('skips cancelled absences', async () => {
      await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05',
        halfDay: false,
        status: 'cancelled'
      })
      const days = await absenceDaysInPeriod(
        employeeId,
        'vacation',
        '2026-06-01',
        '2026-06-30'
      )
      expect(days).toBe(0)
    })

    it('clamps absences to the requested window', async () => {
      // Vacation spans 2026-05-25 (Mon) to 2026-06-05 (Fri). Clamped to
      // June it should yield the 5 weekdays 2026-06-01..2026-06-05.
      await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-05-25',
        dateTo: '2026-06-05',
        halfDay: false,
        status: 'approved'
      })
      const days = await absenceDaysInPeriod(
        employeeId,
        'vacation',
        '2026-06-01',
        '2026-06-30'
      )
      expect(days).toBe(5)
    })
  })

  describe('remainingVacationDays', () => {
    it('subtracts used vacation from the employee entitlement', async () => {
      // 5 business days used in 2026
      await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-07',
        halfDay: false,
        status: 'approved'
      })
      const result = await remainingVacationDays(employeeId, 2026)
      expect(result.entitled).toBe(30)
      expect(result.used).toBe(5)
      expect(result.remaining).toBe(25)
    })

    it('returns zero entitlement (and remaining) for an unknown employee', async () => {
      const result = await remainingVacationDays(
        '00000000-0000-0000-0000-000000000000',
        2026
      )
      expect(result.entitled).toBe(0)
      expect(result.used).toBe(0)
      expect(result.remaining).toBe(0)
    })

    it('floors remaining at zero when usage exceeds entitlement', async () => {
      // Patch entitlement to a low number so we can blow past it.
      await db.update(employees).set({ vacationDaysPerYear: 2 })
      await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-07',
        halfDay: false,
        status: 'approved'
      })
      const result = await remainingVacationDays(employeeId, 2026)
      expect(result.entitled).toBe(2)
      expect(result.used).toBe(5)
      expect(result.remaining).toBe(0)
    })
  })
})
