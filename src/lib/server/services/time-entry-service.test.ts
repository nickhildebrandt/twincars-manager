import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import {
  createTimeEntry,
  deleteTimeEntry,
  getTimeEntry,
  listTimeEntries,
  monthlyReport,
  updateTimeEntry,
  utilizationSummary
} from './time-entry-service'
import { db } from '$lib/server/db/client'
import {
  customers,
  documents,
  employees,
  timeEntries
} from '$lib/server/db/schema'

/**
 * Integration tests for the time-entry service, exercising the full
 * Drizzle query layer (incl. joins + aggregations) against an in-memory
 * pg-mem database.
 *
 * @group integration
 * @module time-entry-service
 */
describe('time-entry-service', () => {
  let employeeId: string
  let otherEmployeeId: string
  let customerId: string
  let documentId: string

  beforeEach(async () => {
    await db.delete(timeEntries)
    await db.delete(documents)
    await db.delete(customers)
    await db.delete(employees)

    const [e1] = await db
      .insert(employees)
      .values({
        personnelNumber: 'MA-0001',
        firstName: 'Anna',
        lastName: 'Mustermann'
      })
      .returning()
    const [e2] = await db
      .insert(employees)
      .values({
        personnelNumber: 'MA-0002',
        firstName: 'Bert',
        lastName: 'Beispiel'
      })
      .returning()
    employeeId = e1.id
    otherEmployeeId = e2.id

    const [c] = await db
      .insert(customers)
      .values({
        customerNumber: 'K-0001',
        lastName: 'Kunde',
        firstName: 'Karl',
        kind: 'regular'
      })
      .returning()
    customerId = c.id

    const [d] = await db
      .insert(documents)
      .values({
        documentNumber: 'RG-0001',
        type: 'invoice',
        status: 'created',
        customerId,
        issueDate: '2026-05-15'
      })
      .returning()
    documentId = d.id
  })

  /* ────────────────────────────────────────────────────────────────── */
  /* CRUD                                                              */
  /* ────────────────────────────────────────────────────────────────── */

  describe('createTimeEntry', () => {
    it('persists and returns the created row', async () => {
      const created = await createTimeEntry({
        employeeId,
        date: '2026-05-10',
        hours: '2.50',
        task: 'Inspektion vorbereiten'
      })
      expect(created.id).toBeTruthy()
      expect(created.employeeId).toBe(employeeId)
      expect(created.date).toBe('2026-05-10')
      expect(Number(created.hours)).toBe(2.5)
    })
  })

  describe('getTimeEntry', () => {
    it('returns the joined row including employee / customer / document', async () => {
      const created = await createTimeEntry({
        employeeId,
        date: '2026-05-10',
        hours: '1.00',
        customerId,
        documentId,
        task: 'Bremsen prüfen'
      })
      const got = await getTimeEntry(created.id)
      expect(got?.id).toBe(created.id)
      expect(got?.employeeFirstName).toBe('Anna')
      expect(got?.employeeLastName).toBe('Mustermann')
      expect(got?.employeeNumber).toBe('MA-0001')
      expect(got?.customerName).toBe('Kunde')
      expect(got?.documentNumber).toBe('RG-0001')
      expect(got?.documentType).toBe('invoice')
    })

    it('returns null for unknown id', async () => {
      expect(
        await getTimeEntry('00000000-0000-0000-0000-000000000000')
      ).toBeNull()
    })
  })

  describe('updateTimeEntry', () => {
    it('updates fields and bumps updatedAt', async () => {
      const created = await createTimeEntry({
        employeeId,
        date: '2026-05-10',
        hours: '1.00',
        task: 'Alt'
      })
      const updated = await updateTimeEntry(created.id, {
        hours: '2.25',
        task: 'Neu'
      })
      expect(Number(updated.hours)).toBe(2.25)
      expect(updated.task).toBe('Neu')
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        created.updatedAt.getTime()
      )
    })
  })

  describe('deleteTimeEntry', () => {
    it('removes the row', async () => {
      const created = await createTimeEntry({
        employeeId,
        date: '2026-05-10',
        hours: '1.00'
      })
      await deleteTimeEntry(created.id)
      expect(await getTimeEntry(created.id)).toBeNull()
    })
  })

  /* ────────────────────────────────────────────────────────────────── */
  /* listTimeEntries — pagination + filters                            */
  /* ────────────────────────────────────────────────────────────────── */

  describe('listTimeEntries', () => {
    beforeEach(async () => {
      await db.insert(timeEntries).values([
        {
          employeeId,
          date: '2026-05-01',
          hours: '2.00',
          task: 'Außerhalb Bereich'
        },
        {
          employeeId,
          date: '2026-05-10',
          hours: '3.00',
          customerId,
          documentId,
          task: 'Im Bereich, billable'
        },
        {
          employeeId: otherEmployeeId,
          date: '2026-05-15',
          hours: '1.50',
          task: 'Anderer Mitarbeiter'
        },
        {
          employeeId,
          date: '2026-06-01',
          hours: '4.00',
          task: 'Nach dem Bereich'
        }
      ])
    })

    it('paginates results and reports the total + page count', async () => {
      const res = await listTimeEntries({ page: 1, size: 2 })
      expect(res.items).toHaveLength(2)
      expect(res.total).toBe(4)
      expect(res.pageCount).toBe(2)
    })

    it('filters by employee id', async () => {
      const res = await listTimeEntries({
        page: 1,
        size: 25,
        employeeId: otherEmployeeId
      })
      expect(res.total).toBe(1)
      expect(res.items[0].employeeId).toBe(otherEmployeeId)
    })

    it('filters by date range — entries inside / outside', async () => {
      const inside = await listTimeEntries({
        page: 1,
        size: 25,
        dateFrom: '2026-05-05',
        dateTo: '2026-05-20'
      })
      expect(inside.total).toBe(2)
      const dates = inside.items.map((e) => e.date).sort()
      expect(dates).toEqual(['2026-05-10', '2026-05-15'])

      const outside = await listTimeEntries({
        page: 1,
        size: 25,
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31'
      })
      expect(outside.total).toBe(0)
      expect(outside.items).toEqual([])
    })

    it('filters by customer id', async () => {
      const res = await listTimeEntries({ page: 1, size: 25, customerId })
      expect(res.total).toBe(1)
      expect(res.items[0].customerName).toBe('Kunde')
    })

    it('filters by document id', async () => {
      const res = await listTimeEntries({ page: 1, size: 25, documentId })
      expect(res.total).toBe(1)
      expect(res.items[0].documentNumber).toBe('RG-0001')
    })

    it('orders newest first', async () => {
      const res = await listTimeEntries({ page: 1, size: 25 })
      // 2026-06-01 should come before 2026-05-*.
      expect(res.items[0].date).toBe('2026-06-01')
    })

    it('joins employee + customer + document for display', async () => {
      const res = await listTimeEntries({
        page: 1,
        size: 25,
        employeeId,
        dateFrom: '2026-05-10',
        dateTo: '2026-05-10'
      })
      expect(res.items[0].employeeFirstName).toBe('Anna')
      expect(res.items[0].customerName).toBe('Kunde')
      expect(res.items[0].documentNumber).toBe('RG-0001')
    })
  })

  /* ────────────────────────────────────────────────────────────────── */
  /* utilizationSummary                                                */
  /* ────────────────────────────────────────────────────────────────── */

  describe('utilizationSummary', () => {
    beforeEach(async () => {
      await db.insert(timeEntries).values([
        // Anna, May: 5h total, 3h billable, 2 distinct days
        { employeeId, date: '2026-05-01', hours: '2.00', task: 'free' },
        {
          employeeId,
          date: '2026-05-10',
          hours: '3.00',
          documentId,
          task: 'billable'
        },
        // Anna, June (outside range when scoped to May)
        { employeeId, date: '2026-06-01', hours: '4.00' },
        // Bert, May: 1.5h, none billable, 1 day
        { employeeId: otherEmployeeId, date: '2026-05-15', hours: '1.50' }
      ])
    })

    it('aggregates total / billable / daysLogged per employee', async () => {
      const res = await utilizationSummary({
        from: '2026-05-01',
        to: '2026-05-31'
      })
      const anna = res.rows.find((r) => r.employeeId === employeeId)
      const bert = res.rows.find((r) => r.employeeId === otherEmployeeId)
      expect(anna?.totalHours).toBe(5)
      expect(anna?.billableHours).toBe(3)
      expect(anna?.daysLogged).toBe(2)
      expect(bert?.totalHours).toBe(1.5)
      expect(bert?.billableHours).toBe(0)
      expect(bert?.daysLogged).toBe(1)
    })

    it('returns grand totals across the bucket', async () => {
      const res = await utilizationSummary({
        from: '2026-05-01',
        to: '2026-05-31'
      })
      expect(res.totals.totalHours).toBe(6.5)
      expect(res.totals.billableHours).toBe(3)
      expect(res.totals.daysLogged).toBe(3)
    })

    it('respects the employeeId filter', async () => {
      const res = await utilizationSummary({
        from: '2026-05-01',
        to: '2026-05-31',
        employeeId
      })
      expect(res.rows).toHaveLength(1)
      expect(res.rows[0].employeeId).toBe(employeeId)
      expect(res.totals.totalHours).toBe(5)
    })

    it('returns empty rows + zero totals for an empty range', async () => {
      const res = await utilizationSummary({
        from: '2030-01-01',
        to: '2030-01-31'
      })
      expect(res.rows).toEqual([])
      expect(res.totals).toEqual({
        totalHours: 0,
        billableHours: 0,
        daysLogged: 0
      })
    })
  })

  /* ────────────────────────────────────────────────────────────────── */
  /* monthlyReport                                                     */
  /* ────────────────────────────────────────────────────────────────── */

  describe('monthlyReport', () => {
    beforeEach(async () => {
      await db.insert(timeEntries).values([
        // Anna, May 2026: 5h over 2 days → avg 2.5
        { employeeId, date: '2026-05-01', hours: '2.00' },
        { employeeId, date: '2026-05-10', hours: '3.00' },
        // Anna, June 2026: 4h over 1 day → outside May report
        { employeeId, date: '2026-06-01', hours: '4.00' },
        // Bert, May 2026: 1h over 1 day → avg 1
        { employeeId: otherEmployeeId, date: '2026-05-15', hours: '1.00' },
        // April 2026 boundary check (before)
        { employeeId, date: '2026-04-30', hours: '7.00' },
        // June 2026 boundary check (after — should NOT count for May)
        { employeeId, date: '2026-06-30', hours: '8.00' }
      ])
    })

    it('aggregates per employee within the month', async () => {
      const res = await monthlyReport({ year: 2026, month: 5 })
      const anna = res.find((r) => r.employeeId === employeeId)
      const bert = res.find((r) => r.employeeId === otherEmployeeId)
      expect(anna?.totalHours).toBe(5)
      expect(anna?.daysLogged).toBe(2)
      expect(anna?.avgHoursPerDay).toBe(2.5)
      expect(bert?.totalHours).toBe(1)
      expect(bert?.daysLogged).toBe(1)
      expect(bert?.avgHoursPerDay).toBe(1)
    })

    it('respects month boundaries (April / June stay out of May)', async () => {
      const may = await monthlyReport({ year: 2026, month: 5 })
      const totalMay = may.reduce((acc, r) => acc + r.totalHours, 0)
      // Anna 5 + Bert 1 = 6 (April 7 and June 4 + 8 excluded).
      expect(totalMay).toBe(6)
    })

    it('returns the surrounding months independently', async () => {
      const april = await monthlyReport({ year: 2026, month: 4 })
      expect(april).toHaveLength(1)
      expect(april[0].totalHours).toBe(7)

      const june = await monthlyReport({ year: 2026, month: 6 })
      const total = june.reduce((acc, r) => acc + r.totalHours, 0)
      // 4 + 8 = 12
      expect(total).toBe(12)
    })

    it('handles December → January boundary correctly', async () => {
      await db.insert(timeEntries).values([
        { employeeId, date: '2026-12-31', hours: '1.50' },
        { employeeId, date: '2027-01-01', hours: '2.00' }
      ])
      const dec = await monthlyReport({ year: 2026, month: 12 })
      expect(dec[0].totalHours).toBe(1.5)
      const jan = await monthlyReport({ year: 2027, month: 1 })
      expect(jan[0].totalHours).toBe(2)
    })

    it('returns an empty array when no employee logged anything', async () => {
      await db.delete(timeEntries)
      const res = await monthlyReport({ year: 2026, month: 5 })
      expect(res).toEqual([])
    })
  })
})
