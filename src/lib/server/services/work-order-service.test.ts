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
  getActiveInvoiceForOrder,
  getLaborRate,
  getWorkOrder,
  listKanbanBoard,
  listOrderInvoices,
  listWorkOrders,
  setWorkOrderStatus,
  updateWorkOrder,
  updateWorkOrderItem
} from './work-order-service'
import {
  cancelInvoice,
  createDocument,
  deleteDocument
} from './document-service'

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

/**
 * Orders need a customer OR a vehicle — most tests don't care which,
 * so this helper seeds a throwaway customer unless the caller links
 * one of the two explicitly.
 */
const createOrder = async (
  input: Parameters<typeof createWorkOrder>[0]
): Promise<Awaited<ReturnType<typeof createWorkOrder>>> =>
  createWorkOrder(
    input.customerId || input.vehicleId
      ? input
      : { ...input, customerId: await seedCustomer() }
  )

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
      { kind: 'invoice', formatTemplate: 'RE-{YYYY}-{NNNN}', nextValue: 1 },
      { kind: 'storno', formatTemplate: 'S-{NNNN}', nextValue: 1 }
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
      const order = await createOrder({ title: 'Bremsen erneuern' })
      expect(order.orderNumber).toBe(`AU-${YEAR}-0001`)
      expect(order.status).toBe('open')
      const second = await createOrder({ title: 'Inspektion' })
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
      const dated = await createOrder({
        title: 'Nur Datum',
        scheduledDate: '2026-07-10'
      })
      expect(dated.scheduledDate).toBe('2026-07-10')
      expect(dated.scheduledTime).toBeNull()

      const timed = await createOrder({
        title: 'Mit Uhrzeit',
        scheduledDate: '2026-07-10',
        scheduledTime: '08:30'
      })
      expect(timed.scheduledDate).toBe('2026-07-10')
      expect(timed.scheduledTime).toBe('08:30')
    })

    it('drops a start time that arrives without a date', async () => {
      const order = await createOrder({
        title: 'Zeit ohne Datum',
        scheduledTime: '08:30'
      })
      expect(order.scheduledDate).toBeNull()
      expect(order.scheduledTime).toBeNull()
    })

    it('400s without customer AND vehicle (rule 2.4: at least one link)', async () => {
      await expectHttpError(
        () => createWorkOrder({ title: 'Ohne Zuordnung' }),
        400,
        /Kunden oder ein Fahrzeug/i
      )
      // Either link alone is enough.
      const vehicleOnly = await createWorkOrder({
        title: 'Nur Fahrzeug',
        vehicleId: await seedVehicle(null)
      })
      expect(vehicleOnly.customerId).toBeNull()
      const customerOnly = await createWorkOrder({
        title: 'Nur Kunde',
        customerId: await seedCustomer()
      })
      expect(customerOnly.vehicleId).toBeNull()
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
      const order = await createOrder({ title: 'Alt', assigneeIds: [emp1] })
      const updated = await updateWorkOrder(order.id, {
        title: 'Neu',
        assigneeIds: [emp2]
      })
      expect(updated.title).toBe('Neu')
      const detail = await getWorkOrder(order.id)
      expect(detail?.assignees.map((a) => a.id)).toEqual([emp2])
    })

    it('re-schedules and clears the time together with the date', async () => {
      const order = await createOrder({
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

    it('400s when the patch would clear both customer and vehicle', async () => {
      const customerId = await seedCustomer()
      const order = await createWorkOrder({ title: 'Job', customerId })
      // Explicitly clearing the only link is refused …
      await expectHttpError(
        () => updateWorkOrder(order.id, { customerId: null }),
        400,
        /Kunden oder ein Fahrzeug/i
      )
      // … and so is a patch clearing both at once.
      await expectHttpError(
        () => updateWorkOrder(order.id, { customerId: null, vehicleId: null }),
        400,
        /Kunden oder ein Fahrzeug/i
      )
      // Swapping the customer for a vehicle in the same patch is fine.
      const vehicleId = await seedVehicle(null)
      const swapped = await updateWorkOrder(order.id, {
        customerId: null,
        vehicleId
      })
      expect(swapped.customerId).toBeNull()
      expect(swapped.vehicleId).toBe(vehicleId)
    })
  })

  describe('setWorkOrderStatus', () => {
    it('moves open -> in_progress and back', async () => {
      const order = await createOrder({ title: 'Job' })
      const moved = await setWorkOrderStatus(order.id, 'in_progress')
      expect(moved.status).toBe('in_progress')
      const back = await setWorkOrderStatus(order.id, 'open')
      expect(back.status).toBe('open')
    })

    it('rejects moving to done directly (completion only via completeWorkOrder)', async () => {
      const order = await createOrder({ title: 'Job' })
      await expectHttpError(
        () => setWorkOrderStatus(order.id, 'done'),
        409,
        /Abschließen/i
      )
    })

    it('reopens done -> in_progress while no invoice is linked and clears completedAt', async () => {
      const order = await createOrder({ title: 'Job' })
      await db
        .update(workOrders)
        .set({ status: 'done', completedAt: new Date() })
        .where(eq(workOrders.id, order.id))
      const reopened = await setWorkOrderStatus(order.id, 'in_progress')
      expect(reopened.status).toBe('in_progress')
      expect(reopened.completedAt).toBeNull()
    })

    it('rejects done -> open (reopen goes to in Bearbeitung only)', async () => {
      const order = await createOrder({ title: 'Job' })
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
      const order = await createOrder({ title: 'Job' })
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
      const order = await createOrder({ title: 'Job' })
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
      const order = await createOrder({ title: 'Job' })
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
      const order = await createOrder({ title: 'Job' })
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
      const order = await createOrder({ title: 'Job' })
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

    it('ignores hours on material rows — add keeps quantity, stores no hours', async () => {
      const employeeId = await seedEmployee()
      const order = await createOrder({ title: 'Job' })
      const item = await addWorkOrderItem(order.id, {
        kind: 'material',
        description: 'Bremsscheiben',
        quantity: 2,
        unitPriceNet: 40,
        employeeId,
        // Hostile/legacy input: hours on a material row.
        hours: 3,
        doneAt: '2026-07-06'
      })
      expect(item.hours).toBeNull()
      expect(Number(item.quantity)).toBe(2)
      // No hours → no time-entry write-through, employee or not.
      expect(await db.select().from(timeEntries)).toHaveLength(0)
    })

    it('clears hours (and the time entry) when a labor row becomes material', async () => {
      const employeeId = await seedEmployee()
      const order = await createOrder({ title: 'Job' })
      const item = await addWorkOrderItem(order.id, {
        kind: 'labor',
        description: 'Ölwechsel',
        unitPriceNet: 60,
        employeeId,
        hours: 1.5,
        doneAt: '2026-07-06'
      })
      expect(await db.select().from(timeEntries)).toHaveLength(1)

      const updated = await updateWorkOrderItem(item.id, {
        kind: 'material',
        quantity: 4,
        // Hours sent along anyway — must be ignored for material.
        hours: 2
      })
      expect(updated.kind).toBe('material')
      expect(updated.hours).toBeNull()
      expect(Number(updated.quantity)).toBe(4)
      expect(await db.select().from(timeEntries)).toHaveLength(0)
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

    it('snapshots the executing employee into labor position texts', async () => {
      const { order } = await seedCompletableOrder()
      const invoice = await completeWorkOrder(order.id, {
        issueDate: '2026-07-06'
      })

      const positions = await db
        .select()
        .from(documentItems)
        .where(eq(documentItems.documentId, invoice.id))
      const labor = positions.find((p) => p.positionNumber === 1)
      expect(labor?.description).toBe(
        'Bremsen erneuert (ausgeführt von Max Schrauber)'
      )
      // Material rows never carry the snapshot.
      const mat = positions.find((p) => p.positionNumber === 2)
      expect(mat?.description).toBe('Bremsscheibe')

      // The snapshot is frozen at completion time: renaming the
      // employee afterwards must not alter the billed document.
      await db
        .update(employees)
        .set({ firstName: 'Karl', lastName: 'Umbenannt' })
      const after = await db
        .select()
        .from(documentItems)
        .where(eq(documentItems.documentId, invoice.id))
      expect(after.find((p) => p.positionNumber === 1)?.description).toBe(
        'Bremsen erneuert (ausgeführt von Max Schrauber)'
      )
    })

    it('leaves labor positions without an employee un-suffixed', async () => {
      const customerId = await seedCustomer()
      const order = await createWorkOrder({ title: 'Ohne Monteur', customerId })
      await addWorkOrderItem(order.id, {
        kind: 'labor',
        description: 'Kleinarbeit',
        unitPriceNet: 60,
        hours: 1,
        doneAt: '2026-07-06'
      })
      const invoice = await completeWorkOrder(order.id, {
        issueDate: '2026-07-06'
      })
      const positions = await db
        .select()
        .from(documentItems)
        .where(eq(documentItems.documentId, invoice.id))
      expect(positions[0].description).toBe('Kleinarbeit')
    })

    it('409s on a second completion while the invoice is active (rule: one active invoice)', async () => {
      const { order } = await seedCompletableOrder()
      await completeWorkOrder(order.id, { issueDate: '2026-07-06' })
      await expectHttpError(
        () => completeWorkOrder(order.id, { issueDate: '2026-07-07' }),
        409,
        /existiert bereits die gültige Rechnung RE-.*Stornieren/i
      )
    })

    it('409s when the order has no items', async () => {
      const order = await createOrder({ title: 'Leer' })
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
      const order = await createOrder({ title: 'Job' })
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
      await createOrder({ title: 'Inspektion' })

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
      const open = await createOrder({ title: 'Offen' })
      const inProgress = await createOrder({ title: 'Läuft' })
      await setWorkOrderStatus(inProgress.id, 'in_progress')
      for (let i = 0; i < 27; i++) {
        const done = await createOrder({ title: `Fertig ${i}` })
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

  /**
   * Requirement 10 — the complete order ↔ invoice rule set:
   * one active invoice per order, done requires an active invoice,
   * Storno reopens the order (items editable, re-invoicing possible),
   * full history traceable in both directions, standalone invoices
   * (Teileverkauf) unaffected.
   */
  describe('order ↔ invoice rule set (requirement 10)', () => {
    /** Order with a labor + material item, ready for completion. */
    const seedBillableOrder = async () => {
      const customerId = await seedCustomer()
      const employeeId = await seedEmployee()
      const order = await createWorkOrder({ title: 'Bremsen', customerId })
      await addWorkOrderItem(order.id, {
        kind: 'labor',
        description: 'Bremsen erneuert',
        unitPriceNet: 60,
        employeeId,
        hours: 2,
        doneAt: '2026-07-06'
      })
      await addWorkOrderItem(order.id, {
        kind: 'material',
        description: 'Bremsscheibe',
        quantity: 2,
        unitPriceNet: 45,
        doneAt: '2026-07-06'
      })
      return { order, customerId, employeeId }
    }

    it('case 1+6: an order without invoice can be invoiced (completion possible)', async () => {
      const { order } = await seedBillableOrder()
      expect(await getActiveInvoiceForOrder(order.id)).toBeNull()

      const invoice = await completeWorkOrder(order.id, {
        issueDate: '2026-07-06'
      })
      const detail = await getWorkOrder(order.id)
      expect(detail?.order.status).toBe('done')
      expect(detail?.order.invoiceId).toBe(invoice.id)
      // The history backlink is written at creation time.
      expect(invoice.workOrderId).toBe(order.id)
      const active = await getActiveInvoiceForOrder(order.id)
      expect(active?.id).toBe(invoice.id)
    })

    it('case 2: a second invoice is rejected while an active one exists', async () => {
      const { order } = await seedBillableOrder()
      const invoice = await completeWorkOrder(order.id, {
        issueDate: '2026-07-06'
      })
      await expectHttpError(
        () => completeWorkOrder(order.id, { issueDate: '2026-07-07' }),
        409,
        new RegExp(
          `existiert bereits die gültige Rechnung ${invoice.documentNumber}`
        )
      )
      // Exactly one invoice exists.
      expect(await listOrderInvoices(order.id)).toHaveLength(1)
    })

    it('case 3+8: cancelling the active invoice keeps the Storno document (GoBD)', async () => {
      const { order } = await seedBillableOrder()
      const invoice = await completeWorkOrder(order.id, {
        issueDate: '2026-07-06'
      })
      const { stornoId, stornoNumber } = await cancelInvoice(
        invoice.id,
        'Falsche Positionen'
      )
      expect(stornoNumber).toBe('S-0001')

      const history = await listOrderInvoices(order.id)
      expect(history).toHaveLength(2)
      const original = history.find((d) => d.id === invoice.id)
      const storno = history.find((d) => d.id === stornoId)
      expect(original?.status).toBe('cancelled')
      expect(original?.cancelledAt).not.toBeNull()
      expect(storno?.status).toBe('storno')
      // Neither counts as active anymore.
      expect(await getActiveInvoiceForOrder(order.id)).toBeNull()
      // Storno documents are undeletable, order-linked originals too.
      await expectHttpError(
        () => deleteDocument(stornoId),
        409,
        /Stornorechnungen.*nicht gelöscht/i
      )
      await expectHttpError(
        () => deleteDocument(invoice.id),
        409,
        /gehört zu einem Auftrag/i
      )
    })

    it('lifecycle: the Storno reopens the order and un-bills its time entries', async () => {
      const { order } = await seedBillableOrder()
      const invoice = await completeWorkOrder(order.id, {
        issueDate: '2026-07-06'
      })
      await cancelInvoice(invoice.id, 'Falsche Positionen')

      const detail = await getWorkOrder(order.id)
      expect(detail?.order.status).toBe('in_progress')
      expect(detail?.order.completedAt).toBeNull()
      expect(detail?.order.invoiceId).toBeNull()

      // The write-through hours are no longer billed on any document.
      const entries = await db
        .select()
        .from(timeEntries)
        .where(eq(timeEntries.workOrderId, order.id))
      expect(entries).toHaveLength(1)
      expect(entries[0].documentId).toBeNull()
    })

    it('case 4: after the Storno a new invoice is possible', async () => {
      const { order } = await seedBillableOrder()
      const first = await completeWorkOrder(order.id, {
        issueDate: '2026-07-06'
      })
      await cancelInvoice(first.id, 'Falsche Positionen')

      const second = await completeWorkOrder(order.id, {
        issueDate: '2026-07-08'
      })
      expect(second.id).not.toBe(first.id)
      expect(second.documentNumber).toBe(`RE-${YEAR}-0002`)
      expect(second.workOrderId).toBe(order.id)

      const detail = await getWorkOrder(order.id)
      expect(detail?.order.status).toBe('done')
      expect(detail?.order.invoiceId).toBe(second.id)
      const active = await getActiveInvoiceForOrder(order.id)
      expect(active?.id).toBe(second.id)
      // The re-billed hours point at the new invoice again.
      const entries = await db
        .select()
        .from(timeEntries)
        .where(eq(timeEntries.workOrderId, order.id))
      expect(entries[0].documentId).toBe(second.id)
    })

    it('case 5: flipping an invoice-less order to done directly is rejected', async () => {
      const { order } = await seedBillableOrder()
      await expectHttpError(
        () => setWorkOrderStatus(order.id, 'done'),
        409,
        /ohne gültige Rechnung kann ein Auftrag nicht abgeschlossen werden/i
      )
      const detail = await getWorkOrder(order.id)
      expect(detail?.order.status).toBe('open')
    })

    it('case 7: an order whose only invoice is a Storno cannot be flipped to done', async () => {
      const { order } = await seedBillableOrder()
      const invoice = await completeWorkOrder(order.id, {
        issueDate: '2026-07-06'
      })
      await cancelInvoice(invoice.id, 'Falsche Positionen')
      // Reopened by the Storno — but done stays unreachable without a
      // NEW active invoice (only completeWorkOrder can create one).
      await expectHttpError(
        () => setWorkOrderStatus(order.id, 'done'),
        409,
        /ohne gültige Rechnung/i
      )
    })

    it('case 9: item add/update/delete are rejected while an active invoice exists', async () => {
      const { order } = await seedBillableOrder()
      const detailBefore = await getWorkOrder(order.id)
      const existingItem = detailBefore!.items[0]
      const invoice = await completeWorkOrder(order.id, {
        issueDate: '2026-07-06'
      })

      const lockPattern = new RegExp(
        `Positionen sind gesperrt.*${invoice.documentNumber}.*Stornieren`
      )
      await expectHttpError(
        () =>
          addWorkOrderItem(order.id, {
            kind: 'material',
            description: 'Nachtrag',
            quantity: 1,
            unitPriceNet: 5,
            doneAt: '2026-07-07'
          }),
        409,
        lockPattern
      )
      await expectHttpError(
        () => updateWorkOrderItem(existingItem.id, { description: 'Geändert' }),
        409,
        lockPattern
      )
      await expectHttpError(
        () => deleteWorkOrderItem(existingItem.id),
        409,
        lockPattern
      )
      // Nothing changed.
      const detailAfter = await getWorkOrder(order.id)
      expect(detailAfter?.items).toHaveLength(2)
      expect(detailAfter?.items[0].description).toBe(existingItem.description)
    })

    it('case 10: after the Storno item corrections are possible again', async () => {
      const { order } = await seedBillableOrder()
      const invoice = await completeWorkOrder(order.id, {
        issueDate: '2026-07-06'
      })
      await cancelInvoice(invoice.id, 'Falsche Positionen')

      const detail = await getWorkOrder(order.id)
      const material = detail!.items.find((it) => it.kind === 'material')!
      const corrected = await updateWorkOrderItem(material.id, { quantity: 4 })
      expect(Number(corrected.quantity)).toBe(4)
      const added = await addWorkOrderItem(order.id, {
        kind: 'material',
        description: 'Kleinteile',
        quantity: 1,
        unitPriceNet: 12,
        doneAt: '2026-07-08'
      })
      await deleteWorkOrderItem(added.id)
      expect((await getWorkOrder(order.id))?.items).toHaveLength(2)
    })

    it('case 11: standalone invoices (Teileverkauf) stay unaffected', async () => {
      const customerId = await seedCustomer()
      const invoice = await createDocument({
        type: 'invoice',
        customerId,
        issueDate: '2026-07-06',
        items: [
          {
            description: 'Bremsscheibe (Verkauf über den Tresen)',
            quantity: 2,
            unitPriceNet: 45,
            taxRate: 19
          }
        ]
      })
      expect(invoice.workOrderId).toBeNull()
      // Cancelling a standalone invoice touches no order.
      const { stornoId } = await cancelInvoice(invoice.id, 'Rückgabe')
      const [storno] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, stornoId))
      expect(storno.workOrderId).toBeNull()
      expect(await db.select().from(workOrders)).toHaveLength(0)
    })

    it('traceability: the order detail lists Storno AND new invoice with numbers', async () => {
      const { order } = await seedBillableOrder()
      const first = await completeWorkOrder(order.id, {
        issueDate: '2026-07-06'
      })
      const { stornoId } = await cancelInvoice(first.id, 'Falsche Positionen')
      const second = await completeWorkOrder(order.id, {
        issueDate: '2026-07-08'
      })

      const detail = await getWorkOrder(order.id)
      expect(detail?.invoices.map((d) => d.status)).toEqual([
        'cancelled',
        'storno',
        'created'
      ])
      expect(detail?.invoices.map((d) => d.id)).toEqual([
        first.id,
        stornoId,
        second.id
      ])
      expect(detail?.invoices.map((d) => d.documentNumber)).toEqual([
        `RE-${YEAR}-0001`,
        'S-0001',
        `RE-${YEAR}-0002`
      ])
      // Reverse direction: every document points back at the order.
      const docs = await db.select().from(documents)
      expect(docs.every((d) => d.workOrderId === order.id)).toBe(true)
    })

    it('reopen guard uses the ACTIVE invoice, and delete stays refused after Storno', async () => {
      const { order } = await seedBillableOrder()
      const invoice = await completeWorkOrder(order.id, {
        issueDate: '2026-07-06'
      })
      // Active invoice → reopening is refused with the Storno hint.
      await expectHttpError(
        () => setWorkOrderStatus(order.id, 'in_progress'),
        409,
        /bereits abgerechnet.*Stornieren/i
      )
      await cancelInvoice(invoice.id, 'Falsche Positionen')
      // The billing history keeps the order undeletable (GoBD) even
      // though the active pointer is cleared.
      await expectHttpError(
        () => deleteWorkOrder(order.id),
        409,
        /bereits abgerechnet.*Rechnungshistorie/i
      )
    })
  })
})
