/**
 * Integration tests for the work-order service — creation (number
 * range, assignees), creation from appointments, Kanban status flow,
 * the time-entry write-through of labor items, completion into an
 * invoice and the GoBD delete guard.
 *
 * @group integration
 * @module work-order-service
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

// PDF rendering is best-effort inside createDocument; stub it so the
// completion path neither pulls in pdf-lib nor spams console.error.
vi.mock('./pdf-service', () => ({
  renderAndPersistDocumentPdf: vi.fn().mockResolvedValue(undefined),
  getOrRenderDocumentPdf: vi.fn()
}))

import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  calendarEntries,
  companySettings,
  customers,
  documentItems,
  documents,
  employees,
  itemPriceVersions,
  items,
  numberRanges,
  timeEntries,
  vehicleLicensePlateVersions,
  vehicles,
  workOrderAssignees,
  workOrderItems,
  workOrders
} from '$lib/server/db/schema'
import {
  addWorkOrderItem,
  completeWorkOrder,
  createWorkOrder,
  createWorkOrderFromAppointment,
  deleteWorkOrder,
  deleteWorkOrderItem,
  getLaborRate,
  getWorkOrder,
  listKanbanBoard,
  listWorkOrders,
  setWorkOrderStatus,
  updateWorkOrder,
  updateWorkOrderItem
} from './work-order-service'

const YEAR = new Date().getFullYear()

const pad = (n: number): string => String(n).padStart(2, '0')
/** Local wall-clock date of a Date — mirrors the service conversion. */
const localDate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** Local wall-clock HH:MM of a Date — mirrors the service conversion. */
const localTime = (d: Date): string =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}`

const expectHttpError = async (
  fn: () => Promise<unknown>,
  status: number,
  messagePattern: RegExp
): Promise<void> => {
  try {
    await fn()
    throw new Error('Expected function to throw, but it resolved.')
  } catch (err) {
    const e = err as { status?: number; body?: { message?: string } }
    expect(e.status).toBe(status)
    expect(e.body?.message ?? '').toMatch(messagePattern)
  }
}

const seedCustomer = async (): Promise<string> => {
  const [row] = await db
    .insert(customers)
    .values({
      customerNumber: `KU-${Math.random().toString().slice(2, 8)}`,
      company: 'Mustermann GmbH',
      lastName: 'Mustermann'
    })
    .returning({ id: customers.id })
  return row.id
}

const seedVehicle = async (customerId: string | null): Promise<string> => {
  const [row] = await db
    .insert(vehicles)
    .values({ customerId, make: 'VW', model: 'Golf' })
    .returning({ id: vehicles.id })
  await db
    .insert(vehicleLicensePlateVersions)
    .values({
      vehicleId: row.id,
      validFrom: '2020-01-01',
      licensePlate: 'B-XY 123'
    })
  return row.id
}

const seedEmployee = async (
  firstName = 'Max',
  lastName = 'Schrauber'
): Promise<string> => {
  const [row] = await db
    .insert(employees)
    .values({
      personnelNumber: `P-${Math.random().toString().slice(2, 8)}`,
      firstName,
      lastName
    })
    .returning({ id: employees.id })
  return row.id
}

describe('work-order-service', () => {
  beforeEach(async () => {
    await db.delete(timeEntries)
    await db.delete(workOrderItems)
    await db.delete(workOrderAssignees)
    await db.delete(workOrders)
    await db.delete(documentItems)
    await db.delete(documents)
    await db.delete(calendarEntries)
    await db.delete(itemPriceVersions)
    await db.delete(items)
    await db.delete(vehicleLicensePlateVersions)
    await db.delete(vehicles)
    await db.delete(customers)
    await db.delete(employees)
    await db.delete(numberRanges)
    await db.delete(companySettings)
    await db.insert(numberRanges).values([
      { kind: 'work_order', formatTemplate: 'AU-{YYYY}-{NNNN}', nextValue: 1 },
      { kind: 'invoice', formatTemplate: 'RE-{YYYY}-{NNNN}', nextValue: 1 }
    ])
    await db
      .insert(companySettings)
      .values({
        setupCompleted: true,
        defaultVatRate: '19.00',
        defaultPaymentTermDays: 14
      })
  })

  describe('createWorkOrder', () => {
    it('allocates an AU number from the work_order range', async () => {
      const order = await createWorkOrder({ title: 'Bremsen erneuern' })
      expect(order.orderNumber).toBe(`AU-${YEAR}-0001`)
      expect(order.status).toBe('open')
      const second = await createWorkOrder({ title: 'Inspektion' })
      expect(second.orderNumber).toBe(`AU-${YEAR}-0002`)
    })

    it('links customer, vehicle and assignees', async () => {
      const customerId = await seedCustomer()
      const vehicleId = await seedVehicle(customerId)
      const emp1 = await seedEmployee('Max', 'Schrauber')
      const emp2 = await seedEmployee('Erika', 'Werk')
      const order = await createWorkOrder({
        title: 'Reifenwechsel',
        customerId,
        vehicleId,
        assigneeIds: [emp1, emp2]
      })
      const detail = await getWorkOrder(order.id)
      expect(detail?.customerLabel).toBe('Mustermann GmbH')
      expect(detail?.vehicleLabel).toContain('B-XY 123')
      expect(detail?.assignees.map((a) => a.label).sort()).toEqual([
        'Erika Werk',
        'Max Schrauber'
      ])
    })

    it('persists the split scheduling fields (date + optional time)', async () => {
      const dated = await createWorkOrder({
        title: 'Nur Datum',
        scheduledDate: '2026-07-10'
      })
      expect(dated.scheduledDate).toBe('2026-07-10')
      expect(dated.scheduledTime).toBeNull()

      const timed = await createWorkOrder({
        title: 'Mit Uhrzeit',
        scheduledDate: '2026-07-10',
        scheduledTime: '08:30'
      })
      expect(timed.scheduledDate).toBe('2026-07-10')
      expect(timed.scheduledTime).toBe('08:30')
    })

    it('drops a start time that arrives without a date', async () => {
      const order = await createWorkOrder({
        title: 'Zeit ohne Datum',
        scheduledTime: '08:30'
      })
      expect(order.scheduledDate).toBeNull()
      expect(order.scheduledTime).toBeNull()
    })
  })

  describe('createWorkOrderFromAppointment', () => {
    const seedAppointment = async (overrides = {}) => {
      const customerId = await seedCustomer()
      const vehicleId = await seedVehicle(customerId)
      const employeeId = await seedEmployee()
      const [appt] = await db
        .insert(calendarEntries)
        .values({
          kind: 'appointment',
          title: 'HU-Vorbereitung',
          startsAt: new Date('2026-07-10T08:00:00Z'),
          endsAt: new Date('2026-07-10T10:00:00Z'),
          status: 'scheduled',
          customerId,
          vehicleId,
          employeeId,
          ...overrides
        })
        .returning()
      return { appt, customerId, vehicleId, employeeId }
    }

    it('copies title/customer/vehicle, assigns the employee and links the Termin', async () => {
      const { appt, customerId, vehicleId, employeeId } =
        await seedAppointment()
      const order = await createWorkOrderFromAppointment(appt.id)
      expect(order.title).toBe('HU-Vorbereitung')
      expect(order.customerId).toBe(customerId)
      expect(order.vehicleId).toBe(vehicleId)
      expect(order.appointmentId).toBe(appt.id)
      // Timed Termin → wall-clock date + HH:MM of its start.
      expect(order.scheduledDate).toBe(localDate(appt.startsAt))
      expect(order.scheduledTime).toBe(localTime(appt.startsAt))
      const detail = await getWorkOrder(order.id)
      expect(detail?.assignees.map((a) => a.id)).toEqual([employeeId])
      expect(detail?.appointmentTitle).toBe('HU-Vorbereitung')
    })

    it('maps an all-day Termin to a date-only placement', async () => {
      const { appt } = await seedAppointment({
        allDay: true,
        startsAt: new Date('2026-07-10T00:00:00Z'),
        endsAt: new Date('2026-07-11T00:00:00Z')
      })
      const order = await createWorkOrderFromAppointment(appt.id)
      // All-day Termine are pinned to UTC midnight — UTC date, no time.
      expect(order.scheduledDate).toBe('2026-07-10')
      expect(order.scheduledTime).toBeNull()
    })

    it('404s for an unknown appointment', async () => {
      await expectHttpError(
        () =>
          createWorkOrderFromAppointment(
            '00000000-0000-0000-0000-000000000000'
          ),
        404,
        /Termin nicht gefunden/i
      )
    })

    it('409s when an order already exists for the Termin', async () => {
      const { appt } = await seedAppointment()
      await createWorkOrderFromAppointment(appt.id)
      await expectHttpError(
        () => createWorkOrderFromAppointment(appt.id),
        409,
        /bereits ein Auftrag/i
      )
    })
  })

  describe('updateWorkOrder', () => {
    it('patches fields and replaces the assignee set', async () => {
      const emp1 = await seedEmployee('Max', 'Schrauber')
      const emp2 = await seedEmployee('Erika', 'Werk')
      const order = await createWorkOrder({ title: 'Alt', assigneeIds: [emp1] })
      const updated = await updateWorkOrder(order.id, {
        title: 'Neu',
        assigneeIds: [emp2]
      })
      expect(updated.title).toBe('Neu')
      const detail = await getWorkOrder(order.id)
      expect(detail?.assignees.map((a) => a.id)).toEqual([emp2])
    })

    it('re-schedules and clears the time together with the date', async () => {
      const order = await createWorkOrder({
        title: 'Job',
        scheduledDate: '2026-07-10',
        scheduledTime: '08:30'
      })
      const moved = await updateWorkOrder(order.id, {
        scheduledDate: '2026-07-11',
        scheduledTime: '14:00'
      })
      expect(moved.scheduledDate).toBe('2026-07-11')
      expect(moved.scheduledTime).toBe('14:00')

      const cleared = await updateWorkOrder(order.id, { scheduledDate: null })
      expect(cleared.scheduledDate).toBeNull()
      expect(cleared.scheduledTime).toBeNull()
    })
  })

  describe('setWorkOrderStatus', () => {
    it('moves open -> in_progress and back', async () => {
      const order = await createWorkOrder({ title: 'Job' })
      const moved = await setWorkOrderStatus(order.id, 'in_progress')
      expect(moved.status).toBe('in_progress')
      const back = await setWorkOrderStatus(order.id, 'open')
      expect(back.status).toBe('open')
    })

    it('rejects moving to done directly (completion only via completeWorkOrder)', async () => {
      const order = await createWorkOrder({ title: 'Job' })
      await expectHttpError(
        () => setWorkOrderStatus(order.id, 'done'),
        409,
        /Abschließen/i
      )
    })

    it('reopens done -> in_progress while no invoice is linked and clears completedAt', async () => {
      const order = await createWorkOrder({ title: 'Job' })
      await db
        .update(workOrders)
        .set({ status: 'done', completedAt: new Date() })
        .where(eq(workOrders.id, order.id))
      const reopened = await setWorkOrderStatus(order.id, 'in_progress')
      expect(reopened.status).toBe('in_progress')
      expect(reopened.completedAt).toBeNull()
    })

    it('rejects done -> open (reopen goes to in Bearbeitung only)', async () => {
      const order = await createWorkOrder({ title: 'Job' })
      await db
        .update(workOrders)
        .set({ status: 'done', completedAt: new Date() })
        .where(eq(workOrders.id, order.id))
      await expectHttpError(
        () => setWorkOrderStatus(order.id, 'open'),
        409,
        /in Bearbeitung/i
      )
    })

    it('rejects reopening once the invoice exists', async () => {
      const customerId = await seedCustomer()
      const order = await createWorkOrder({ title: 'Job', customerId })
      await addWorkOrderItem(order.id, {
        kind: 'material',
        description: 'Bremsscheiben',
        quantity: 2,
        unitPriceNet: 40,
        doneAt: '2026-07-06'
      })
      await completeWorkOrder(order.id, { issueDate: '2026-07-06' })
      await expectHttpError(
        () => setWorkOrderStatus(order.id, 'in_progress'),
        409,
        /bereits abgerechnet/i
      )
    })
  })

  describe('work items + time-entry write-through', () => {
    it('creates exactly one linked time entry for a labor item with employee and hours', async () => {
      const customerId = await seedCustomer()
      const employeeId = await seedEmployee()
      const order = await createWorkOrder({ title: 'Job', customerId })
      const item = await addWorkOrderItem(order.id, {
        kind: 'labor',
        description: 'Bremsen hinten erneuert',
        unitPriceNet: 60,
        employeeId,
        hours: 1.5,
        doneAt: '2026-07-06'
      })
      // Labor mirrors hours into quantity and defaults the unit.
      expect(Number(item.quantity)).toBe(1.5)
      expect(item.unit).toBe('Std.')

      const entries = await db
        .select()
        .from(timeEntries)
        .where(eq(timeEntries.workOrderItemId, item.id))
      expect(entries).toHaveLength(1)
      expect(entries[0].employeeId).toBe(employeeId)
      expect(entries[0].date).toBe('2026-07-06')
      expect(Number(entries[0].hours)).toBe(1.5)
      expect(entries[0].task).toBe('Bremsen hinten erneuert')
      expect(entries[0].customerId).toBe(customerId)
      expect(entries[0].workOrderId).toBe(order.id)
    })

    it('does not create a time entry for material or labor without employee', async () => {
      const order = await createWorkOrder({ title: 'Job' })
      await addWorkOrderItem(order.id, {
        kind: 'material',
        description: 'Bremsscheiben',
        quantity: 2,
        unitPriceNet: 40,
        doneAt: '2026-07-06'
      })
      await addWorkOrderItem(order.id, {
        kind: 'labor',
        description: 'Noch niemandem zugewiesen',
        unitPriceNet: 60,
        doneAt: '2026-07-06'
      })
      expect(await db.select().from(timeEntries)).toHaveLength(0)
    })

    it('updates the linked entry when the labor item changes', async () => {
      const employeeId = await seedEmployee()
      const other = await seedEmployee('Erika', 'Werk')
      const order = await createWorkOrder({ title: 'Job' })
      const item = await addWorkOrderItem(order.id, {
        kind: 'labor',
        description: 'Ölwechsel',
        unitPriceNet: 60,
        employeeId,
        hours: 1,
        doneAt: '2026-07-06'
      })
      await updateWorkOrderItem(item.id, {
        description: 'Ölwechsel + Filter',
        employeeId: other,
        hours: 2.25,
        doneAt: '2026-07-07'
      })
      const entries = await db
        .select()
        .from(timeEntries)
        .where(eq(timeEntries.workOrderItemId, item.id))
      expect(entries).toHaveLength(1)
      expect(entries[0].employeeId).toBe(other)
      expect(Number(entries[0].hours)).toBe(2.25)
      expect(entries[0].task).toBe('Ölwechsel + Filter')
      expect(entries[0].date).toBe('2026-07-07')
    })

    it('removes the entry when the item stops being labor-with-employee', async () => {
      const employeeId = await seedEmployee()
      const order = await createWorkOrder({ title: 'Job' })
      const item = await addWorkOrderItem(order.id, {
        kind: 'labor',
        description: 'Ölwechsel',
        unitPriceNet: 60,
        employeeId,
        hours: 1,
        doneAt: '2026-07-06'
      })
      await updateWorkOrderItem(item.id, { employeeId: null })
      expect(await db.select().from(timeEntries)).toHaveLength(0)
    })

    it('removes the entry when the item is deleted', async () => {
      const employeeId = await seedEmployee()
      const order = await createWorkOrder({ title: 'Job' })
      const item = await addWorkOrderItem(order.id, {
        kind: 'labor',
        description: 'Ölwechsel',
        unitPriceNet: 60,
        employeeId,
        hours: 1,
        doneAt: '2026-07-06'
      })
      await deleteWorkOrderItem(item.id)
      expect(await db.select().from(timeEntries)).toHaveLength(0)
      expect(await db.select().from(workOrderItems)).toHaveLength(0)
    })

    it('numbers positions sequentially per order', async () => {
      const order = await createWorkOrder({ title: 'Job' })
      const a = await addWorkOrderItem(order.id, {
        kind: 'material',
        description: 'A',
        unitPriceNet: 1,
        doneAt: '2026-07-06'
      })
      const b = await addWorkOrderItem(order.id, {
        kind: 'material',
        description: 'B',
        unitPriceNet: 1,
        doneAt: '2026-07-06'
      })
      expect(a.position).toBe(1)
      expect(b.position).toBe(2)
    })
  })

  describe('getLaborRate', () => {
    it('returns null while no labor item is linked', async () => {
      expect(await getLaborRate()).toBeNull()
    })

    it('returns the labor item with its current price version', async () => {
      const [item] = await db
        .insert(items)
        .values({
          articleNumber: 'ARBEIT',
          description: 'Arbeitszeit',
          kind: 'service',
          unit: 'Std.'
        })
        .returning()
      await db
        .insert(itemPriceVersions)
        .values({
          itemId: item.id,
          validFrom: '2026-01-01',
          unitPriceNet: '75.00'
        })
      await db.update(companySettings).set({ laborItemId: item.id })
      const rate = await getLaborRate()
      expect(rate?.itemId).toBe(item.id)
      expect(rate?.articleNumber).toBe('ARBEIT')
      // pg-mem trims trailing zeros on numeric — compare numerically.
      expect(Number(rate?.unitPriceNet)).toBe(75)
    })
  })

  describe('completeWorkOrder', () => {
    const seedCompletableOrder = async () => {
      const customerId = await seedCustomer()
      const vehicleId = await seedVehicle(customerId)
      const employeeId = await seedEmployee()
      const [laborItem] = await db
        .insert(items)
        .values({
          articleNumber: 'ARBEIT',
          description: 'Arbeitszeit',
          kind: 'service',
          unit: 'Std.'
        })
        .returning()
      await db.update(companySettings).set({ laborItemId: laborItem.id })
      const [material] = await db
        .insert(items)
        .values({
          articleNumber: 'BS-100',
          description: 'Bremsscheibe',
          kind: 'article'
        })
        .returning()
      const order = await createWorkOrder({
        title: 'Bremsen komplett',
        customerId,
        vehicleId
      })
      await addWorkOrderItem(order.id, {
        kind: 'labor',
        description: 'Bremsen erneuert',
        unitPriceNet: 60,
        employeeId,
        hours: 2.5,
        doneAt: '2026-07-06'
      })
      await addWorkOrderItem(order.id, {
        kind: 'material',
        itemId: material.id,
        description: 'Bremsscheibe',
        quantity: 2,
        unit: 'Stk',
        unitPriceNet: 45,
        doneAt: '2026-07-06'
      })
      return { order, customerId, vehicleId, laborItem, material }
    }

    it('creates the invoice with labor as Std. positions and material backlinks', async () => {
      const { order, customerId, vehicleId, laborItem, material } =
        await seedCompletableOrder()
      const invoice = await completeWorkOrder(order.id, {
        issueDate: '2026-07-06',
        paymentMethod: 'cash'
      })

      expect(invoice.type).toBe('invoice')
      expect(invoice.documentNumber).toBe(`RE-${YEAR}-0001`)
      expect(invoice.customerId).toBe(customerId)
      expect(invoice.vehicleId).toBe(vehicleId)
      expect(invoice.dueDate).toBe('2026-07-20')
      expect(invoice.paymentMethod).toBe('cash')
      // 2.5h * 60 + 2 * 45 = 240 net, 19% VAT.
      expect(Number(invoice.netTotal)).toBe(240)
      expect(Number(invoice.grossTotal)).toBeCloseTo(285.6, 2)

      const positions = await db
        .select()
        .from(documentItems)
        .where(eq(documentItems.documentId, invoice.id))
      expect(positions).toHaveLength(2)
      const labor = positions.find((p) => p.positionNumber === 1)
      expect(labor?.kind).toBe('service')
      expect(labor?.unit).toBe('Std.')
      expect(Number(labor?.quantity)).toBe(2.5)
      expect(Number(labor?.unitPriceNet)).toBe(60)
      expect(labor?.itemId).toBe(laborItem.id)
      const mat = positions.find((p) => p.positionNumber === 2)
      expect(mat?.kind).toBe('article')
      expect(mat?.itemId).toBe(material.id)
      expect(mat?.articleNumber).toBe('BS-100')
    })

    it('flips the order to done and back-fills time_entries.document_id', async () => {
      const { order } = await seedCompletableOrder()
      const invoice = await completeWorkOrder(order.id, {
        issueDate: '2026-07-06'
      })
      const detail = await getWorkOrder(order.id)
      expect(detail?.order.status).toBe('done')
      expect(detail?.order.invoiceId).toBe(invoice.id)
      expect(detail?.order.completedAt).not.toBeNull()
      expect(detail?.invoiceNumber).toBe(invoice.documentNumber)

      const entries = await db
        .select()
        .from(timeEntries)
        .where(eq(timeEntries.workOrderId, order.id))
      expect(entries).toHaveLength(1)
      expect(entries[0].documentId).toBe(invoice.id)
    })

    it('409s on a second completion', async () => {
      const { order } = await seedCompletableOrder()
      await completeWorkOrder(order.id, { issueDate: '2026-07-06' })
      await expectHttpError(
        () => completeWorkOrder(order.id, { issueDate: '2026-07-07' }),
        409,
        /bereits abgeschlossen/i
      )
    })

    it('409s when the order has no items', async () => {
      const order = await createWorkOrder({ title: 'Leer' })
      await expectHttpError(
        () => completeWorkOrder(order.id, { issueDate: '2026-07-06' }),
        409,
        /keine Positionen/i
      )
    })
  })

  describe('deleteWorkOrder', () => {
    it('deletes the order together with items and write-through entries', async () => {
      const employeeId = await seedEmployee()
      const order = await createWorkOrder({ title: 'Job' })
      await addWorkOrderItem(order.id, {
        kind: 'labor',
        description: 'Ölwechsel',
        unitPriceNet: 60,
        employeeId,
        hours: 1,
        doneAt: '2026-07-06'
      })
      await deleteWorkOrder(order.id)
      expect(await getWorkOrder(order.id)).toBeNull()
      expect(await db.select().from(timeEntries)).toHaveLength(0)
    })

    it('refuses once the invoice exists (GoBD)', async () => {
      const customerId = await seedCustomer()
      const order = await createWorkOrder({ title: 'Job', customerId })
      await addWorkOrderItem(order.id, {
        kind: 'material',
        description: 'Teil',
        unitPriceNet: 10,
        doneAt: '2026-07-06'
      })
      await completeWorkOrder(order.id, { issueDate: '2026-07-06' })
      await expectHttpError(
        () => deleteWorkOrder(order.id),
        409,
        /bereits abgerechnet/i
      )
      expect(await getWorkOrder(order.id)).not.toBeNull()
    })

    it('is a no-op for unknown ids', async () => {
      await deleteWorkOrder('00000000-0000-0000-0000-000000000000')
    })
  })

  describe('listWorkOrders', () => {
    it('lists with customer label, plate and assignee names + filters', async () => {
      const customerId = await seedCustomer()
      const vehicleId = await seedVehicle(customerId)
      const employeeId = await seedEmployee()
      await createWorkOrder({
        title: 'Bremsen',
        customerId,
        vehicleId,
        assigneeIds: [employeeId]
      })
      await createWorkOrder({ title: 'Inspektion' })

      const all = await listWorkOrders({ page: 1, size: 25 })
      expect(all.total).toBe(2)
      const bremsen = all.items.find((o) => o.title === 'Bremsen')
      expect(bremsen?.customerLabel).toBe('Mustermann GmbH')
      expect(bremsen?.vehiclePlate).toBe('B-XY 123')
      expect(bremsen?.assigneeNames).toEqual(['Max Schrauber'])

      const byEmployee = await listWorkOrders({ page: 1, size: 25, employeeId })
      expect(byEmployee.total).toBe(1)
      expect(byEmployee.items[0].title).toBe('Bremsen')

      const byCustomer = await listWorkOrders({ page: 1, size: 25, customerId })
      expect(byCustomer.total).toBe(1)

      const byStatus = await listWorkOrders({
        page: 1,
        size: 25,
        status: 'in_progress'
      })
      expect(byStatus.total).toBe(0)

      const byQuery = await listWorkOrders({ page: 1, size: 25, q: 'brems' })
      expect(byQuery.total).toBe(1)

      const byPlate = await listWorkOrders({ page: 1, size: 25, q: 'B-XY' })
      expect(byPlate.total).toBe(1)
      expect(byPlate.items[0].title).toBe('Bremsen')
    })
  })

  describe('listKanbanBoard', () => {
    it('groups by status and bounds done to the latest 25', async () => {
      const open = await createWorkOrder({ title: 'Offen' })
      const inProgress = await createWorkOrder({ title: 'Läuft' })
      await setWorkOrderStatus(inProgress.id, 'in_progress')
      for (let i = 0; i < 27; i++) {
        const done = await createWorkOrder({ title: `Fertig ${i}` })
        await db
          .update(workOrders)
          .set({
            status: 'done',
            completedAt: new Date(Date.UTC(2026, 0, 1 + i))
          })
          .where(eq(workOrders.id, done.id))
      }

      const board = await listKanbanBoard()
      expect(board.open.map((c) => c.id)).toEqual([open.id])
      expect(board.in_progress.map((c) => c.id)).toEqual([inProgress.id])
      expect(board.done).toHaveLength(25)
      // Latest first; the two oldest fall off.
      expect(board.done[0].title).toBe('Fertig 26')
      const titles = board.done.map((c) => c.title)
      expect(titles).not.toContain('Fertig 0')
      expect(titles).not.toContain('Fertig 1')
    })

    it('carries card display fields', async () => {
      const customerId = await seedCustomer()
      const vehicleId = await seedVehicle(customerId)
      const employeeId = await seedEmployee()
      await createWorkOrder({
        title: 'Bremsen',
        customerId,
        vehicleId,
        assigneeIds: [employeeId]
      })
      const board = await listKanbanBoard()
      const card = board.open[0]
      expect(card.orderNumber).toBe(`AU-${YEAR}-0001`)
      expect(card.customerLabel).toBe('Mustermann GmbH')
      expect(card.vehiclePlate).toBe('B-XY 123')
      expect(card.assignees).toEqual([
        { id: employeeId, label: 'Max Schrauber' }
      ])
    })
  })
})
