import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  createEmployee,
  deleteEmployee,
  deleteSalaryVersion,
  getEffectiveSalary,
  getEmployee,
  listEmployees,
  listSalaryVersions,
  nextPersonnelNumber,
  updateEmployee,
  upsertSalaryVersion
} from './employee-service'
import { db } from '$lib/server/db/client'
import { employees, employeeSalaryVersions } from '$lib/server/db/schema'

/**
 * Integration tests for the employee service, exercising the full
 * Drizzle query layer against an in-memory pg-mem database. Salary
 * versioning is the load-bearing logic and gets dedicated coverage.
 *
 * @group integration
 * @module employee-service
 */
describe('employee-service', () => {
  beforeEach(async () => {
    await db.delete(employeeSalaryVersions)
    await db.delete(employees)
  })

  describe('createEmployee', () => {
    it('persists and returns the created row', async () => {
      const created = await createEmployee({
        personnelNumber: 'MA-0001',
        firstName: 'Lena',
        lastName: 'Müller',
        position: 'Mechanikerin'
      })
      expect(created.id).toBeTruthy()
      expect(created.firstName).toBe('Lena')
      const fetched = await getEmployee(created.id)
      expect(fetched?.lastName).toBe('Müller')
      expect(fetched?.monthlySalary).toBeNull()
      expect(fetched?.hourlyWage).toBeNull()
    })
  })

  describe('listEmployees', () => {
    beforeEach(async () => {
      await db.insert(employees).values([
        {
          personnelNumber: 'MA-0001',
          firstName: 'Anna',
          lastName: 'Albers',
          position: 'Mechanikerin',
          department: 'Werkstatt',
          archived: false
        },
        {
          personnelNumber: 'MA-0002',
          firstName: 'Bert',
          lastName: 'Braun',
          position: 'Verkäufer',
          department: 'Vertrieb',
          archived: false
        },
        {
          personnelNumber: 'MA-0003',
          firstName: 'Clara',
          lastName: 'Carstens',
          position: 'Buchhalterin',
          department: 'Verwaltung',
          archived: true
        }
      ])
    })

    it('paginates and reports total + pageCount', async () => {
      const res = await listEmployees({ page: 1, size: 2 })
      expect(res.items).toHaveLength(2)
      expect(res.total).toBe(3)
      expect(res.pageCount).toBe(2)
    })

    it('filters by case-insensitive last-name search', async () => {
      const res = await listEmployees({ page: 1, size: 25, q: 'braun' })
      expect(res.total).toBe(1)
      expect(res.items[0].lastName).toBe('Braun')
    })

    it('filters by personnel number', async () => {
      const res = await listEmployees({ page: 1, size: 25, q: 'MA-0002' })
      expect(res.total).toBe(1)
      expect(res.items[0].lastName).toBe('Braun')
    })

    it('filters by position', async () => {
      const res = await listEmployees({ page: 1, size: 25, q: 'Verkäufer' })
      expect(res.total).toBe(1)
      expect(res.items[0].lastName).toBe('Braun')
    })

    it('filters by department', async () => {
      const res = await listEmployees({ page: 1, size: 25, q: 'Werkstatt' })
      expect(res.total).toBe(1)
      expect(res.items[0].lastName).toBe('Albers')
    })

    it('filters by archived=true', async () => {
      const res = await listEmployees({ page: 1, size: 25, archived: true })
      expect(res.total).toBe(1)
      expect(res.items[0].lastName).toBe('Carstens')
    })

    it('filters by archived=false', async () => {
      const res = await listEmployees({ page: 1, size: 25, archived: false })
      expect(res.total).toBe(2)
    })

    it('enriches each row with the current salary (null when none)', async () => {
      const res = await listEmployees({ page: 1, size: 25 })
      for (const e of res.items) {
        expect(e.monthlySalary).toBeNull()
        expect(e.hourlyWage).toBeNull()
      }
    })

    it('returns pageCount=1 even when empty', async () => {
      await db.delete(employees)
      const res = await listEmployees({ page: 1, size: 25 })
      expect(res.total).toBe(0)
      expect(res.pageCount).toBe(1)
    })
  })

  describe('updateEmployee', () => {
    it('updates fields and refreshes updatedAt', async () => {
      const created = await createEmployee({
        personnelNumber: 'MA-0010',
        firstName: 'Old',
        lastName: 'Name'
      })
      const updated = await updateEmployee(created.id, { firstName: 'New' })
      expect(updated.firstName).toBe('New')
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        created.updatedAt.getTime()
      )
    })
  })

  describe('deleteEmployee', () => {
    it('removes the row', async () => {
      const created = await createEmployee({
        personnelNumber: 'MA-0011',
        firstName: 'Doomed',
        lastName: 'Soul'
      })
      await deleteEmployee(created.id)
      expect(await getEmployee(created.id)).toBeNull()
    })
  })

  describe('getEmployee', () => {
    it('returns null for unknown id', async () => {
      expect(
        await getEmployee('00000000-0000-0000-0000-000000000000')
      ).toBeNull()
    })
  })

  describe('nextPersonnelNumber', () => {
    it('returns MA-0001 when no employees exist', async () => {
      expect(await nextPersonnelNumber()).toBe('MA-0001')
    })

    it('returns the next padded number based on row count', async () => {
      await createEmployee({
        personnelNumber: 'MA-0001',
        firstName: 'A',
        lastName: 'A'
      })
      await createEmployee({
        personnelNumber: 'MA-0002',
        firstName: 'B',
        lastName: 'B'
      })
      expect(await nextPersonnelNumber()).toBe('MA-0003')
    })
  })

  describe('getEffectiveSalary', () => {
    it('returns null when no salary version exists', async () => {
      const e = await createEmployee({
        personnelNumber: 'MA-1000',
        firstName: 'No',
        lastName: 'Salary'
      })
      const v = await getEffectiveSalary(e.id)
      expect(v).toBeNull()
    })

    it('returns the single existing version', async () => {
      const e = await createEmployee({
        personnelNumber: 'MA-1001',
        firstName: 'One',
        lastName: 'Version'
      })
      await upsertSalaryVersion({
        employeeId: e.id,
        validFrom: '2024-01-01',
        monthlySalary: '3200.00',
        hourlyWage: null
      })
      const v = await getEffectiveSalary(e.id, '2025-06-01')
      expect(Number(v?.monthlySalary)).toBe(3200)
    })

    it('returns the version with the latest validFrom <= asOf', async () => {
      const e = await createEmployee({
        personnelNumber: 'MA-1002',
        firstName: 'Multi',
        lastName: 'Version'
      })
      await upsertSalaryVersion({
        employeeId: e.id,
        validFrom: '2023-01-01',
        monthlySalary: '3000.00',
        hourlyWage: null
      })
      await upsertSalaryVersion({
        employeeId: e.id,
        validFrom: '2024-06-01',
        monthlySalary: '3500.00',
        hourlyWage: null
      })
      await upsertSalaryVersion({
        employeeId: e.id,
        validFrom: '2025-01-01',
        monthlySalary: '4000.00',
        hourlyWage: null
      })

      const v1 = await getEffectiveSalary(e.id, '2023-12-31')
      expect(Number(v1?.monthlySalary)).toBe(3000)

      const v2 = await getEffectiveSalary(e.id, '2024-12-31')
      expect(Number(v2?.monthlySalary)).toBe(3500)

      const v3 = await getEffectiveSalary(e.id, '2025-12-31')
      expect(Number(v3?.monthlySalary)).toBe(4000)
    })

    it('returns null when asOf is before the earliest version', async () => {
      const e = await createEmployee({
        personnelNumber: 'MA-1003',
        firstName: 'Early',
        lastName: 'Cutoff'
      })
      await upsertSalaryVersion({
        employeeId: e.id,
        validFrom: '2025-01-01',
        monthlySalary: '3000.00',
        hourlyWage: null
      })
      const v = await getEffectiveSalary(e.id, '2024-12-31')
      expect(v).toBeNull()
    })
  })

  describe('listSalaryVersions', () => {
    it('returns versions for an employee, newest first', async () => {
      const e = await createEmployee({
        personnelNumber: 'MA-2000',
        firstName: 'Hist',
        lastName: 'Ory'
      })
      await upsertSalaryVersion({
        employeeId: e.id,
        validFrom: '2023-01-01',
        monthlySalary: '3000.00',
        hourlyWage: null
      })
      await upsertSalaryVersion({
        employeeId: e.id,
        validFrom: '2024-06-01',
        monthlySalary: '3500.00',
        hourlyWage: null
      })
      const rows = await listSalaryVersions(e.id)
      expect(rows.map((r) => r.validFrom)).toEqual(['2024-06-01', '2023-01-01'])
    })

    it('returns an empty array when no versions exist', async () => {
      const e = await createEmployee({
        personnelNumber: 'MA-2001',
        firstName: 'No',
        lastName: 'Hist'
      })
      expect(await listSalaryVersions(e.id)).toEqual([])
    })
  })

  describe('upsertSalaryVersion', () => {
    it('inserts a new row when none exists at validFrom', async () => {
      const e = await createEmployee({
        personnelNumber: 'MA-3000',
        firstName: 'Up',
        lastName: 'Sert'
      })
      const v = await upsertSalaryVersion({
        employeeId: e.id,
        validFrom: '2025-01-01',
        monthlySalary: '4000.00',
        hourlyWage: null
      })
      expect(v.id).toBeTruthy()
      expect(Number(v.monthlySalary)).toBe(4000)
    })

    it('updates the existing row when validFrom matches', async () => {
      const e = await createEmployee({
        personnelNumber: 'MA-3001',
        firstName: 'Up',
        lastName: 'Dating'
      })
      const first = await upsertSalaryVersion({
        employeeId: e.id,
        validFrom: '2025-01-01',
        monthlySalary: '3000.00',
        hourlyWage: null
      })
      const second = await upsertSalaryVersion({
        employeeId: e.id,
        validFrom: '2025-01-01',
        monthlySalary: '3300.00',
        hourlyWage: null
      })
      expect(second.id).toBe(first.id)
      expect(Number(second.monthlySalary)).toBe(3300)
      const all = await listSalaryVersions(e.id)
      expect(all).toHaveLength(1)
    })
  })

  describe('deleteSalaryVersion', () => {
    it('removes a single version', async () => {
      const e = await createEmployee({
        personnelNumber: 'MA-4000',
        firstName: 'Del',
        lastName: 'Sal'
      })
      const v = await upsertSalaryVersion({
        employeeId: e.id,
        validFrom: '2025-01-01',
        monthlySalary: '3000.00',
        hourlyWage: null
      })
      await deleteSalaryVersion(v.id)
      expect(await listSalaryVersions(e.id)).toEqual([])
    })
  })
})
