import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  absenceDaysInPeriod,
  absenceWorkdays,
  checkVacationBudget,
  createAbsence,
  deleteAbsence,
  deleteAbsencesByIds,
  findSameTypeOverlaps,
  findVacationSickConflicts,
  getAbsence,
  listAbsencesForEmployee,
  listAbsencesInRange,
  listAbsencesWithWorkdays,
  remainingVacationDays,
  updateAbsence
} from './absence-service'
import { db } from '$lib/server/db/client'
import { eq } from 'drizzle-orm'
import {
  companySettings,
  employeeAbsences,
  employees
} from '$lib/server/db/schema'

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
    await db.delete(companySettings)
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

    it('excludes computed public holidays (2031, company Bundesland)', async () => {
      await db.insert(companySettings).values({ state: 'Berlin' })
      // Easter 2031 is Sunday 2031-04-13: Karfreitag 04-11 (Fri) and
      // Ostermontag 04-14 (Mon) are holidays. 2031-04-07..2031-04-14
      // spans 6 weekdays, two of which are holidays → 4 working days.
      await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2031-04-07',
        dateTo: '2031-04-14',
        halfDay: false,
        status: 'approved'
      })
      const days = await absenceDaysInPeriod(
        employeeId,
        'vacation',
        '2031-01-01',
        '2031-12-31'
      )
      expect(days).toBe(4)
    })

    it('falls back to federal holidays when no Bundesland is set', async () => {
      // No company_settings row: only the nine federal holidays apply.
      // 2031-04-28 (Mon) .. 2031-05-02 (Fri) contains Tag der Arbeit
      // (Thu 2031-05-01) → 5 weekdays minus 1 holiday = 4.
      await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2031-04-28',
        dateTo: '2031-05-02',
        halfDay: false,
        status: 'approved'
      })
      const days = await absenceDaysInPeriod(
        employeeId,
        'vacation',
        '2031-01-01',
        '2031-12-31'
      )
      expect(days).toBe(4)
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

    it('reports the requested year and honours excludeId', async () => {
      const row = await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05',
        halfDay: false,
        status: 'approved'
      })
      const withRow = await remainingVacationDays(employeeId, 2026)
      expect(withRow.year).toBe(2026)
      expect(withRow.used).toBe(5)
      const withoutRow = await remainingVacationDays(employeeId, 2026, {
        excludeId: row.id
      })
      expect(withoutRow.used).toBe(0)
      expect(withoutRow.remaining).toBe(30)
    })

    it('splits a cross-year vacation per calendar year', async () => {
      // 2026-12-28 (Mon) .. 2027-01-05 (Tue), federal fallback:
      // 2026 part = Mon..Thu = 4 days; 2027 part = Jan 1 (Fri, Neujahr,
      // skipped) + Jan 4 + Jan 5 = 2 days.
      await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-12-28',
        dateTo: '2027-01-05',
        halfDay: false,
        status: 'approved'
      })
      const y2026 = await remainingVacationDays(employeeId, 2026)
      const y2027 = await remainingVacationDays(employeeId, 2027)
      expect(y2026.used).toBe(4)
      expect(y2026.remaining).toBe(26)
      expect(y2027.used).toBe(2)
      expect(y2027.remaining).toBe(28)
    })
  })

  describe('absenceWorkdays (pure)', () => {
    it('skips weekends', () => {
      // Fri 2026-06-05 .. Mon 2026-06-08 → Fri + Mon = 2.
      const n = absenceWorkdays(
        { dateFrom: '2026-06-05', dateTo: '2026-06-08' },
        'DE'
      )
      expect(n).toBe(2)
    })

    it('skips public holidays of the given state', () => {
      // Mon 2026-04-27 .. Fri 2026-05-01; May 1st is Tag der Arbeit.
      const n = absenceWorkdays(
        { dateFrom: '2026-04-27', dateTo: '2026-05-01' },
        'BE'
      )
      expect(n).toBe(4)
    })

    it('counts cancelled rows as zero', () => {
      const n = absenceWorkdays(
        { dateFrom: '2026-06-01', dateTo: '2026-06-05', status: 'cancelled' },
        'DE'
      )
      expect(n).toBe(0)
    })

    it('counts a half day as 0.5', () => {
      const n = absenceWorkdays(
        { dateFrom: '2026-06-02', dateTo: '2026-06-02', halfDay: true },
        'DE'
      )
      expect(n).toBe(0.5)
    })

    it('clamps to the given window', () => {
      // Cross-year row clamped to 2026 → the 4 December workdays only.
      const n = absenceWorkdays(
        { dateFrom: '2026-12-28', dateTo: '2027-01-05' },
        'DE',
        '2026-01-01',
        '2026-12-31'
      )
      expect(n).toBe(4)
    })
  })

  describe('listAbsencesWithWorkdays', () => {
    it('enriches rows with full and year-clamped workday counts', async () => {
      await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-12-28',
        dateTo: '2027-01-05',
        halfDay: false,
        status: 'approved'
      })
      const in2026 = await listAbsencesWithWorkdays(employeeId, { year: 2026 })
      expect(in2026).toHaveLength(1)
      expect(in2026[0].workdays).toBe(6)
      expect(in2026[0].workdaysInYear).toBe(4)
      const in2027 = await listAbsencesWithWorkdays(employeeId, { year: 2027 })
      expect(in2027[0].workdaysInYear).toBe(2)
    })

    it('equals the full count when no year filter is active', async () => {
      await createAbsence({
        employeeId,
        type: 'sick',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05',
        halfDay: false,
        status: 'approved'
      })
      const rows = await listAbsencesWithWorkdays(employeeId)
      expect(rows[0].workdays).toBe(5)
      expect(rows[0].workdaysInYear).toBe(5)
    })

    it('applies the company Bundesland holidays', async () => {
      await db.insert(companySettings).values({ state: 'Berlin' })
      // Mon 2026-04-27 .. Fri 2026-05-01 contains Tag der Arbeit.
      await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-04-27',
        dateTo: '2026-05-01',
        halfDay: false,
        status: 'approved'
      })
      const rows = await listAbsencesWithWorkdays(employeeId, { year: 2026 })
      expect(rows[0].workdaysInYear).toBe(4)
    })
  })

  describe('findSameTypeOverlaps', () => {
    it('finds an overlapping row of the same type', async () => {
      const existing = await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-10',
        halfDay: false,
        status: 'approved'
      })
      const hits = await findSameTypeOverlaps({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-10',
        dateTo: '2026-06-15'
      })
      expect(hits.map((h) => h.id)).toEqual([existing.id])
    })

    it('ignores other types, cancelled rows, other employees and excludeId', async () => {
      const cancelled = await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-10',
        halfDay: false,
        status: 'cancelled'
      })
      await createAbsence({
        employeeId,
        type: 'sick',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-10',
        halfDay: false,
        status: 'approved'
      })
      await createAbsence({
        employeeId: otherEmployeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-10',
        halfDay: false,
        status: 'approved'
      })
      const own = await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-08',
        dateTo: '2026-06-09',
        halfDay: false,
        status: 'approved'
      })
      const hits = await findSameTypeOverlaps({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-05',
        dateTo: '2026-06-12',
        excludeId: own.id
      })
      expect(hits).toEqual([])
      expect(hits.find((h) => h.id === cancelled.id)).toBeUndefined()
    })

    it('does not flag adjacent, non-overlapping ranges', async () => {
      await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05',
        halfDay: false,
        status: 'approved'
      })
      const hits = await findSameTypeOverlaps({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-06',
        dateTo: '2026-06-10'
      })
      expect(hits).toEqual([])
    })
  })

  describe('absenceDaysInPeriod excludeId', () => {
    it('leaves the excluded row out of the sum', async () => {
      const a = await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05',
        halfDay: false,
        status: 'approved'
      })
      await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-08',
        dateTo: '2026-06-09',
        halfDay: false,
        status: 'approved'
      })
      const all = await absenceDaysInPeriod(
        employeeId,
        'vacation',
        '2026-01-01',
        '2026-12-31'
      )
      expect(all).toBe(7)
      const without = await absenceDaysInPeriod(
        employeeId,
        'vacation',
        '2026-01-01',
        '2026-12-31',
        { excludeId: a.id }
      )
      expect(without).toBe(2)
    })
  })

  describe('checkVacationBudget', () => {
    it('returns null when no entitlement is configured', async () => {
      await db
        .update(employees)
        .set({ vacationDaysPerYear: null })
        .where(eq(employees.id, employeeId))
      const violation = await checkVacationBudget({
        employeeId,
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31'
      })
      expect(violation).toBeNull()
    })

    it('returns null when the request fits the remaining allowance', async () => {
      const violation = await checkVacationBudget({
        employeeId,
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05'
      })
      expect(violation).toBeNull()
    })

    it('flags a request that exceeds the remaining allowance', async () => {
      await db
        .update(employees)
        .set({ vacationDaysPerYear: 3 })
        .where(eq(employees.id, employeeId))
      const violation = await checkVacationBudget({
        employeeId,
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05'
      })
      expect(violation).toEqual({ year: 2026, remaining: 3, requested: 5 })
    })

    it('accounts for already-used vacation days', async () => {
      await db
        .update(employees)
        .set({ vacationDaysPerYear: 6 })
        .where(eq(employees.id, employeeId))
      await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05',
        halfDay: false,
        status: 'approved'
      })
      const violation = await checkVacationBudget({
        employeeId,
        dateFrom: '2026-07-06',
        dateTo: '2026-07-08'
      })
      expect(violation).toEqual({ year: 2026, remaining: 1, requested: 3 })
    })

    it('checks each calendar year of a cross-year range separately', async () => {
      await db
        .update(employees)
        .set({ vacationDaysPerYear: 3 })
        .where(eq(employees.id, employeeId))
      // 2026 part is 4 workdays > 3 → violation reported for 2026.
      const violation = await checkVacationBudget({
        employeeId,
        dateFrom: '2026-12-28',
        dateTo: '2027-01-05'
      })
      expect(violation).toEqual({ year: 2026, remaining: 3, requested: 4 })
    })

    it('lets a half day through a nearly exhausted allowance', async () => {
      await db
        .update(employees)
        .set({ vacationDaysPerYear: 1 })
        .where(eq(employees.id, employeeId))
      const violation = await checkVacationBudget({
        employeeId,
        dateFrom: '2026-06-02',
        dateTo: '2026-06-02',
        halfDay: true
      })
      expect(violation).toBeNull()
    })

    it('excludes the row being updated via excludeId', async () => {
      await db
        .update(employees)
        .set({ vacationDaysPerYear: 5 })
        .where(eq(employees.id, employeeId))
      const row = await createAbsence({
        employeeId,
        type: 'vacation',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-05',
        halfDay: false,
        status: 'approved'
      })
      // Moving the same 5 workdays elsewhere fits when the row itself
      // is excluded, but not when it still counts.
      const withExclude = await checkVacationBudget({
        employeeId,
        dateFrom: '2026-07-06',
        dateTo: '2026-07-10',
        excludeId: row.id
      })
      expect(withExclude).toBeNull()
      const withoutExclude = await checkVacationBudget({
        employeeId,
        dateFrom: '2026-07-06',
        dateTo: '2026-07-10'
      })
      expect(withoutExclude).toEqual({ year: 2026, remaining: 0, requested: 5 })
    })
  })
})
