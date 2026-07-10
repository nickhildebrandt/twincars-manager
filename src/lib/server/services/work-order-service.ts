/**
 * Work-order service — Aufträge from intake to invoice.
 *
 * See docs/specs/2026-07-06-work-orders-design.md. The order collects
 * work items (labor hours / material) on the shop floor, moves through
 * a three-stage Kanban (`open` / `in_progress` / `done`) and, on
 * completion, creates the invoice from its recorded items via the
 * existing {@link createDocument} pipeline (numbering, totals, PDF).
 *
 * Hours integration: `time_entries` stays the canonical hours store.
 * Every labor work item with employee + hours write-through-upserts
 * exactly ONE linked `time_entries` row; deleting the item removes the
 * entry. Completion back-fills `time_entries.document_id`, so the
 * existing utilization / monthly reports count order hours as billable
 * without any report changes.
 *
 * Status flow: open ⇄ in_progress; → done ONLY through
 * {@link completeWorkOrder} — a done order always carries an ACTIVE
 * invoice (linked invoice whose status is not cancelled/storno, see
 * {@link getActiveInvoiceForOrder}). done → in_progress reopens only
 * while no active invoice exists. Cancelling the active invoice
 * (`cancelInvoice` in document-service) reopens the order
 * automatically: items become editable again and the order can be
 * re-invoiced through {@link completeWorkOrder}; the cancelled
 * original and its Storno stay linked via `documents.work_order_id`.
 * While an active invoice exists, the order's items are locked
 * (add/update/delete refuse with 409). {@link deleteWorkOrder}
 * refuses (409) once any invoice exists — the GoBD invoice chain owns
 * the record then.
 *
 * @group integration
 * @module work-order-service
 */
import { error } from '@sveltejs/kit'
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  notInArray,
  or,
  type SQL
} from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  calendarEntries,
  customers,
  documents,
  employees,
  items,
  timeEntries,
  vehicleLicensePlateVersions,
  vehicles,
  workOrderAssignees,
  workOrderItems,
  workOrders,
  type Document,
  type WorkOrder,
  type WorkOrderItem,
  type WorkOrderStatus
} from '$lib/server/db/schema'
import type { ListParams, ListResult } from '$lib/server/db/validation'
import { allocateNumber } from './number-range-service'
import { latestPlateSubquery } from './vehicle-service'
import { getCurrentItemPrice } from './item-service'
import { getSettings } from './settings-service'
import { createDocument, type DocumentInputItem } from './document-service'

/* ── Shared row shapes ──────────────────────────────────────────────── */

export type WorkOrderListRow = WorkOrder & {
  customerLabel: string | null
  vehiclePlate: string | null
  assigneeNames: string[]
}

export type KanbanCard = {
  id: string
  orderNumber: string
  title: string
  status: string
  customerLabel: string | null
  vehiclePlate: string | null
  /** Planned date `YYYY-MM-DD`, `null` = not scheduled. */
  scheduledDate: string | null
  /** Optional planned start time `HH:MM` (no end time). */
  scheduledTime: string | null
  completedAt: Date | null
  assignees: Array<{ id: string; label: string }>
}

export type KanbanBoard = {
  open: KanbanCard[]
  in_progress: KanbanCard[]
  done: KanbanCard[]
}

export type WorkOrderDetail = {
  order: WorkOrder
  items: WorkOrderItem[]
  assignees: Array<{ id: string; label: string }>
  customerLabel: string | null
  vehicleLabel: string | null
  appointmentTitle: string | null
  invoiceNumber: string | null
  /** Full billing history — active invoice, cancelled originals and
   * their Stornos (oldest first). See {@link listOrderInvoices}. */
  invoices: OrderInvoiceRef[]
}

/* ── Order ↔ invoice rule set ───────────────────────────────────────── */

/**
 * Invoice statuses that do NOT count as "active": a cancelled original
 * and its Storno document are retained history (GoBD), not a live
 * claim. Every other status (`created`, `sent`, `paid`, legacy
 * `draft`/`open`/`overdue`) keeps the invoice active.
 */
const INACTIVE_INVOICE_STATUSES = ['cancelled', 'storno']

/** One entry of an order's billing history. */
export type OrderInvoiceRef = {
  id: string
  documentNumber: string
  status: string
  issueDate: string
  grossTotal: string
  cancelledAt: Date | null
}

const orderInvoiceColumns = {
  id: documents.id,
  documentNumber: documents.documentNumber,
  status: documents.status,
  issueDate: documents.issueDate,
  grossTotal: documents.grossTotal,
  cancelledAt: documents.cancelledAt
}

/**
 * Every invoice ever created for the order — the active one, cancelled
 * originals and their Storno documents — oldest first. Backed by the
 * `documents.work_order_id` backlink, which survives re-invoicing
 * cycles (unlike the single active pointer `work_orders.invoice_id`).
 */
export async function listOrderInvoices(
  orderId: string
): Promise<OrderInvoiceRef[]> {
  return db
    .select(orderInvoiceColumns)
    .from(documents)
    .where(
      and(eq(documents.workOrderId, orderId), eq(documents.type, 'invoice'))
    )
    .orderBy(asc(documents.createdAt))
}

/**
 * The single ACTIVE invoice of an order, or `null`. Rule: an order has
 * at most one linked invoice whose status is not cancelled/storno —
 * this helper is the one source of truth every guard (completion,
 * item lock, reopen, second-invoice rejection) derives from.
 */
export async function getActiveInvoiceForOrder(
  orderId: string
): Promise<OrderInvoiceRef | null> {
  const [row] = await db
    .select(orderInvoiceColumns)
    .from(documents)
    .where(
      and(
        eq(documents.workOrderId, orderId),
        eq(documents.type, 'invoice'),
        notInArray(documents.status, INACTIVE_INVOICE_STATUSES)
      )
    )
    .limit(1)
  return row ?? null
}

/** Latest 25 completed orders shown in the Kanban done column. */
const DONE_COLUMN_LIMIT = 25

const todayIso = (): string => new Date().toISOString().slice(0, 10)

const customerLabelFrom = (row: {
  company: string | null
  firstName: string | null
  lastName: string | null
  customerNumber: string | null
}): string | null =>
  row.company ||
  `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() ||
  row.customerNumber ||
  null

/** Load `{id, label}` assignees for a set of orders, grouped by order. */
const fetchAssignees = async (
  orderIds: string[]
): Promise<Map<string, Array<{ id: string; label: string }>>> => {
  const map = new Map<string, Array<{ id: string; label: string }>>()
  if (orderIds.length === 0) return map
  const rows = await db
    .select({
      workOrderId: workOrderAssignees.workOrderId,
      employeeId: employees.id,
      firstName: employees.firstName,
      lastName: employees.lastName
    })
    .from(workOrderAssignees)
    .innerJoin(employees, eq(workOrderAssignees.employeeId, employees.id))
    .where(inArray(workOrderAssignees.workOrderId, orderIds))
    .orderBy(asc(employees.lastName), asc(employees.firstName))
  for (const r of rows) {
    const label = `${r.firstName} ${r.lastName}`.trim()
    const list = map.get(r.workOrderId) ?? []
    list.push({ id: r.employeeId, label })
    map.set(r.workOrderId, list)
  }
  return map
}

/* ── List / board / detail ──────────────────────────────────────────── */

export async function listWorkOrders(
  params: ListParams & {
    status?: string
    customerId?: string
    employeeId?: string
  }
): Promise<ListResult<WorkOrderListRow>> {
  const { page, size, q, status, customerId, employeeId } = params
  const offset = (page - 1) * size

  const filters = []
  if (q) {
    const term = `%${q}%`
    // Orders whose vehicle has a matching license plate (any version).
    const plateMatches = await db
      .selectDistinct({ vehicleId: vehicleLicensePlateVersions.vehicleId })
      .from(vehicleLicensePlateVersions)
      .where(ilike(vehicleLicensePlateVersions.licensePlate, term))
    const plateVehicleIds = plateMatches.map((r) => r.vehicleId)
    const baseSearch = or(
      ilike(workOrders.orderNumber, term),
      ilike(workOrders.title, term),
      ilike(customers.company, term),
      ilike(customers.lastName, term)
    )!
    filters.push(
      plateVehicleIds.length > 0
        ? or(baseSearch, inArray(workOrders.vehicleId, plateVehicleIds))!
        : baseSearch
    )
  }
  if (status && status !== 'all') filters.push(eq(workOrders.status, status))
  if (customerId) filters.push(eq(workOrders.customerId, customerId))
  if (employeeId) {
    filters.push(
      inArray(
        workOrders.id,
        db
          .select({ id: workOrderAssignees.workOrderId })
          .from(workOrderAssignees)
          .where(eq(workOrderAssignees.employeeId, employeeId))
      )
    )
  }
  const where = filters.length > 0 ? and(...filters) : undefined

  const lp = latestPlateSubquery()
  const [rows, totalRow] = await Promise.all([
    db
      .select({
        order: workOrders,
        customerCompany: customers.company,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        customerNumber: customers.customerNumber,
        vehiclePlate: lp.licensePlate
      })
      .from(workOrders)
      .leftJoin(customers, eq(workOrders.customerId, customers.id))
      .leftJoin(vehicles, eq(workOrders.vehicleId, vehicles.id))
      .leftJoin(lp, eq(lp.vehicleId, vehicles.id))
      .where(where)
      .orderBy(desc(workOrders.createdAt))
      .limit(size)
      .offset(offset),
    db
      .select({ value: count() })
      .from(workOrders)
      .leftJoin(customers, eq(workOrders.customerId, customers.id))
      .where(where)
  ])

  const assigneesByOrder = await fetchAssignees(rows.map((r) => r.order.id))
  const enriched: WorkOrderListRow[] = rows.map((r) => ({
    ...r.order,
    customerLabel: r.order.customerId
      ? customerLabelFrom({
          company: r.customerCompany,
          firstName: r.customerFirstName,
          lastName: r.customerLastName,
          customerNumber: r.customerNumber
        })
      : null,
    vehiclePlate: r.vehiclePlate ?? null,
    assigneeNames: (assigneesByOrder.get(r.order.id) ?? []).map((a) => a.label)
  }))

  const total = Number(totalRow[0]?.value ?? 0)
  return {
    items: enriched,
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size))
  }
}

/**
 * The three Kanban columns. `open` / `in_progress` carry every order in
 * that stage (newest first); `done` is bounded to the latest
 * {@link DONE_COLUMN_LIMIT} by `completed_at` so the column never grows
 * unbounded — older completed orders live in the list view. Optional
 * server-side filters: `q` matches order number, title, customer name
 * or company; `employeeId` narrows to orders the employee is assigned
 * to (same semantics as the calendar work-order source).
 */
export async function listKanbanBoard(params?: {
  q?: string
  employeeId?: string
}): Promise<KanbanBoard> {
  const lp = latestPlateSubquery()
  const term = params?.q?.trim() ? `%${params.q.trim()}%` : null
  const boardFilter = and(
    term
      ? or(
          ilike(workOrders.orderNumber, term),
          ilike(workOrders.title, term),
          ilike(customers.lastName, term),
          ilike(customers.company, term)
        )
      : undefined,
    params?.employeeId
      ? inArray(
          workOrders.id,
          db
            .select({ id: workOrderAssignees.workOrderId })
            .from(workOrderAssignees)
            .where(eq(workOrderAssignees.employeeId, params.employeeId))
        )
      : undefined
  )
  const selectCards = (statusFilter: SQL) =>
    db
      .select({
        order: workOrders,
        customerCompany: customers.company,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        customerNumber: customers.customerNumber,
        vehiclePlate: lp.licensePlate
      })
      .from(workOrders)
      .leftJoin(customers, eq(workOrders.customerId, customers.id))
      .leftJoin(vehicles, eq(workOrders.vehicleId, vehicles.id))
      .leftJoin(lp, eq(lp.vehicleId, vehicles.id))
      .where(and(statusFilter, boardFilter))

  const [active, done] = await Promise.all([
    selectCards(inArray(workOrders.status, ['open', 'in_progress'])).orderBy(
      desc(workOrders.createdAt)
    ),
    selectCards(eq(workOrders.status, 'done'))
      .orderBy(desc(workOrders.completedAt))
      .limit(DONE_COLUMN_LIMIT)
  ])

  const all = [...active, ...done]
  const assigneesByOrder = await fetchAssignees(all.map((r) => r.order.id))
  const toCard = (r: (typeof all)[number]): KanbanCard => ({
    id: r.order.id,
    orderNumber: r.order.orderNumber,
    title: r.order.title,
    status: r.order.status,
    customerLabel: r.order.customerId
      ? customerLabelFrom({
          company: r.customerCompany,
          firstName: r.customerFirstName,
          lastName: r.customerLastName,
          customerNumber: r.customerNumber
        })
      : null,
    vehiclePlate: r.vehiclePlate ?? null,
    scheduledDate: r.order.scheduledDate,
    scheduledTime: r.order.scheduledTime,
    completedAt: r.order.completedAt,
    assignees: assigneesByOrder.get(r.order.id) ?? []
  })

  return {
    open: active.filter((r) => r.order.status === 'open').map(toCard),
    in_progress: active
      .filter((r) => r.order.status === 'in_progress')
      .map(toCard),
    done: done.map(toCard)
  }
}

export async function getWorkOrder(
  id: string
): Promise<WorkOrderDetail | null> {
  const lp = latestPlateSubquery()
  const [row] = await db
    .select({
      order: workOrders,
      customerCompany: customers.company,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerNumber: customers.customerNumber,
      plate: lp.licensePlate,
      vehicleMake: vehicles.make,
      vehicleModel: vehicles.model,
      appointmentTitle: calendarEntries.title,
      invoiceNumber: documents.documentNumber
    })
    .from(workOrders)
    .leftJoin(customers, eq(workOrders.customerId, customers.id))
    .leftJoin(vehicles, eq(workOrders.vehicleId, vehicles.id))
    .leftJoin(lp, eq(lp.vehicleId, vehicles.id))
    .leftJoin(calendarEntries, eq(workOrders.appointmentId, calendarEntries.id))
    .leftJoin(documents, eq(workOrders.invoiceId, documents.id))
    .where(eq(workOrders.id, id))
    .limit(1)
  if (!row) return null

  const [orderItems, assigneesByOrder, invoices] = await Promise.all([
    db
      .select()
      .from(workOrderItems)
      .where(eq(workOrderItems.workOrderId, id))
      .orderBy(asc(workOrderItems.position)),
    fetchAssignees([id]),
    listOrderInvoices(id)
  ])

  const makeModel = `${row.vehicleMake ?? ''} ${row.vehicleModel ?? ''}`.trim()
  return {
    order: row.order,
    items: orderItems,
    assignees: assigneesByOrder.get(id) ?? [],
    customerLabel: row.order.customerId
      ? customerLabelFrom({
          company: row.customerCompany,
          firstName: row.customerFirstName,
          lastName: row.customerLastName,
          customerNumber: row.customerNumber
        })
      : null,
    vehicleLabel: row.order.vehicleId
      ? [row.plate, makeModel].filter(Boolean).join(' · ') || null
      : null,
    appointmentTitle: row.appointmentTitle ?? null,
    invoiceNumber: row.invoiceNumber ?? null,
    invoices
  }
}

/* ── Create / update / delete ───────────────────────────────────────── */

export type CreateWorkOrderInput = {
  title: string
  description?: string | null
  customerId?: string | null
  vehicleId?: string | null
  /** Planned date `YYYY-MM-DD`. */
  scheduledDate?: string | null
  /** Optional planned start time `HH:MM`; ignored without a date. */
  scheduledTime?: string | null
  assigneeIds?: string[]
}

const replaceAssignees = async (
  workOrderId: string,
  assigneeIds: string[]
): Promise<void> => {
  await db
    .delete(workOrderAssignees)
    .where(eq(workOrderAssignees.workOrderId, workOrderId))
  const unique = [...new Set(assigneeIds)]
  if (unique.length > 0) {
    await db
      .insert(workOrderAssignees)
      .values(unique.map((employeeId) => ({ workOrderId, employeeId })))
  }
}

/**
 * Binding rule: an order needs a customer OR a vehicle (both are
 * allowed, neither is not). Enforced on create and against the
 * effective post-patch state on update. Termin-born orders
 * ({@link createWorkOrderFromAppointment}) inherit whatever links the
 * Termin carries and are deliberately not gated here.
 */
const requireCustomerOrVehicle = (
  customerId: string | null | undefined,
  vehicleId: string | null | undefined
): void => {
  if (!customerId && !vehicleId) {
    error(400, 'Bitte mindestens einen Kunden oder ein Fahrzeug zuordnen.')
  }
}

export async function createWorkOrder(
  input: CreateWorkOrderInput
): Promise<WorkOrder> {
  requireCustomerOrVehicle(input.customerId, input.vehicleId)
  const orderNumber = await allocateNumber('work_order')
  const scheduledDate = input.scheduledDate ?? null
  const [created] = await db
    .insert(workOrders)
    .values({
      orderNumber,
      title: input.title,
      description: input.description ?? null,
      customerId: input.customerId ?? null,
      vehicleId: input.vehicleId ?? null,
      scheduledDate,
      // A time without a date is meaningless — normalize it away.
      scheduledTime: scheduledDate ? (input.scheduledTime ?? null) : null
    })
    .returning()
  if (input.assigneeIds && input.assigneeIds.length > 0) {
    await replaceAssignees(created.id, input.assigneeIds)
  }
  return created
}

/**
 * Map a Termin's `startsAt` to the split scheduling fields. All-day
 * appointments are pinned to UTC midnight by the calendar remote, so
 * their date is read in UTC and no start time is carried; timed
 * appointments were created from a local `datetime-local` string, so
 * their wall-clock date + `HH:MM` are read back with local getters
 * (the same convention the forms use).
 */
const scheduleFromAppointment = (appointment: {
  startsAt: Date
  allDay: boolean
}): { scheduledDate: string; scheduledTime: string | null } => {
  const d = appointment.startsAt
  if (appointment.allDay) {
    return { scheduledDate: d.toISOString().slice(0, 10), scheduledTime: null }
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    scheduledDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    scheduledTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
}

/**
 * Create an order from a calendar Termin: copies title / customer /
 * vehicle, turns the appointment's employee into an assignee, links
 * `appointment_id` (UNIQUE — one order per Termin) and places the
 * order at the appointment's start date + time (all-day Termine map
 * to a date-only placement).
 */
export async function createWorkOrderFromAppointment(
  appointmentId: string
): Promise<WorkOrder> {
  const [appointment] = await db
    .select()
    .from(calendarEntries)
    .where(
      and(
        eq(calendarEntries.id, appointmentId),
        eq(calendarEntries.kind, 'appointment')
      )
    )
    .limit(1)
  if (!appointment) {
    error(404, 'Termin nicht gefunden.')
  }

  const [existing] = await db
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(eq(workOrders.appointmentId, appointmentId))
    .limit(1)
  if (existing) {
    error(409, 'Zu diesem Termin existiert bereits ein Auftrag.')
  }

  const orderNumber = await allocateNumber('work_order')
  const schedule = scheduleFromAppointment(appointment)
  const [created] = await db
    .insert(workOrders)
    .values({
      orderNumber,
      title: appointment.title,
      customerId: appointment.customerId,
      vehicleId: appointment.vehicleId,
      appointmentId: appointment.id,
      scheduledDate: schedule.scheduledDate,
      scheduledTime: schedule.scheduledTime
    })
    .returning()
  if (appointment.employeeId) {
    await replaceAssignees(created.id, [appointment.employeeId])
  }
  return created
}

export type UpdateWorkOrderInput = Partial<CreateWorkOrderInput>

export async function updateWorkOrder(
  id: string,
  patch: UpdateWorkOrderInput
): Promise<WorkOrder> {
  const { assigneeIds, ...fields } = patch
  const current = await requireOrder(id)
  // The effective post-patch state must still carry customer OR vehicle.
  requireCustomerOrVehicle(
    fields.customerId !== undefined ? fields.customerId : current.customerId,
    fields.vehicleId !== undefined ? fields.vehicleId : current.vehicleId
  )
  // Clearing the date clears the time with it — a start time without
  // a date is meaningless.
  if (fields.scheduledDate === null) fields.scheduledTime = null
  const [updated] = await db
    .update(workOrders)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(workOrders.id, id))
    .returning()
  if (assigneeIds) {
    await replaceAssignees(id, assigneeIds)
  }
  return updated
}

/**
 * Delete an order. Refuses (409) once ANY invoice exists for it —
 * active, cancelled or Storno — because the GoBD invoice chain owns
 * the record then; corrections go through the invoice's Storno flow.
 * (Checked via the `documents.work_order_id` history backlink, not
 * just the active pointer: an order whose invoice was cancelled must
 * keep its billing history reachable.) The write-through
 * `time_entries` rows of the order's labor items are removed
 * explicitly (production also cascades them via the
 * `work_order_item_id` FK, but the service does not rely on it).
 */
export async function deleteWorkOrder(id: string): Promise<void> {
  const [row] = await db
    .select({ id: workOrders.id, invoiceId: workOrders.invoiceId })
    .from(workOrders)
    .where(eq(workOrders.id, id))
    .limit(1)
  if (!row) return
  const [linkedInvoice] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.workOrderId, id))
    .limit(1)
  if (row.invoiceId !== null || linkedInvoice) {
    error(
      409,
      'Dieser Auftrag wurde bereits abgerechnet und kann nicht gelöscht werden. Die Rechnungshistorie (inklusive Stornos) bleibt erhalten.'
    )
  }
  // Explicit write-through cleanup (mirrors the DB-level ON DELETE
  // CASCADE of time_entries.work_order_item_id).
  await db.delete(timeEntries).where(eq(timeEntries.workOrderId, id))
  await db.delete(workOrders).where(eq(workOrders.id, id))
}

/* ── Status flow ────────────────────────────────────────────────────── */

/**
 * Kanban status transition. Allowed moves:
 *
 *   open         → in_progress
 *   in_progress  → open
 *   done         → in_progress   (reopen, only while no ACTIVE
 *                                 invoice exists — after a Storno the
 *                                 order is reopened automatically)
 *
 * → done is NOT reachable here — a done order requires an active
 * invoice, so completion happens exclusively through
 * {@link completeWorkOrder} (which creates that invoice). This also
 * covers the Kanban drag-to-done path and orders whose only invoice
 * is a Storno.
 */
export async function setWorkOrderStatus(
  id: string,
  status: WorkOrderStatus
): Promise<WorkOrder> {
  const [order] = await db
    .select()
    .from(workOrders)
    .where(eq(workOrders.id, id))
    .limit(1)
  if (!order) {
    error(404, 'Auftrag nicht gefunden.')
  }
  if (status === 'done') {
    error(
      409,
      'Abschließen ist nur über "Abschließen & Rechnung erstellen" möglich — ohne gültige Rechnung kann ein Auftrag nicht abgeschlossen werden.'
    )
  }
  if (order.status === status) return order
  if (order.status === 'done') {
    if (status !== 'in_progress') {
      error(
        409,
        'Ein abgeschlossener Auftrag kann nur nach "in Bearbeitung" zurückgeholt werden.'
      )
    }
    if (await getActiveInvoiceForOrder(order.id)) {
      error(
        409,
        'Dieser Auftrag wurde bereits abgerechnet und kann nicht wieder geöffnet werden. Stornieren Sie zuerst die Rechnung.'
      )
    }
  }
  const [updated] = await db
    .update(workOrders)
    .set({
      status,
      // Reopening clears the completion timestamp AND a stale active
      // pointer (a reopenable order has no active invoice — a leftover
      // link to a cancelled invoice would keep the UI locked; the
      // history stays reachable via documents.work_order_id).
      completedAt: order.status === 'done' ? null : order.completedAt,
      invoiceId: order.status === 'done' ? null : order.invoiceId,
      updatedAt: new Date()
    })
    .where(eq(workOrders.id, id))
    .returning()
  return updated
}

/* ── Work items + time-entry write-through ──────────────────────────── */

export type WorkOrderItemInput = {
  kind: 'labor' | 'material'
  itemId?: string | null
  description: string
  quantity?: string | number
  unit?: string | null
  unitPriceNet: string | number
  employeeId?: string | null
  hours?: string | number | null
  doneAt: string
}

/**
 * Write-through: a labor item with employee + hours mirrors exactly
 * one `time_entries` row (task = description, customer = order
 * customer, date = done_at). Anything else (material, labor without
 * employee/hours) must have no entry — an existing one is removed.
 */
const syncTimeEntryForItem = async (
  order: Pick<WorkOrder, 'id' | 'customerId'>,
  item: WorkOrderItem
): Promise<void> => {
  const hours = item.hours === null ? null : Number(item.hours)
  const isBillableLabor =
    item.kind === 'labor' &&
    item.employeeId !== null &&
    hours !== null &&
    hours > 0

  const [existing] = await db
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(eq(timeEntries.workOrderItemId, item.id))
    .limit(1)

  if (!isBillableLabor) {
    if (existing) {
      await db.delete(timeEntries).where(eq(timeEntries.id, existing.id))
    }
    return
  }

  const values = {
    employeeId: item.employeeId as string,
    date: item.doneAt,
    hours: String(hours),
    customerId: order.customerId,
    task: item.description.slice(0, 200),
    workOrderId: order.id,
    workOrderItemId: item.id
  }
  if (existing) {
    await db
      .update(timeEntries)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(timeEntries.id, existing.id))
  } else {
    await db.insert(timeEntries).values(values)
  }
}

const requireOrder = async (id: string): Promise<WorkOrder> => {
  const [order] = await db
    .select()
    .from(workOrders)
    .where(eq(workOrders.id, id))
    .limit(1)
  if (!order) {
    error(404, 'Auftrag nicht gefunden.')
  }
  return order
}

/**
 * Arbeitserfassung lock: while an ACTIVE invoice exists the recorded
 * items are frozen — they ARE the invoice's basis. Corrections require
 * cancelling the invoice first (which reopens the order and lifts the
 * lock). A done order without an active invoice (legacy edge) is
 * equally locked until it is reopened.
 */
const requireItemsUnlocked = async (order: WorkOrder): Promise<void> => {
  const active = await getActiveInvoiceForOrder(order.id)
  if (active) {
    error(
      409,
      `Positionen sind gesperrt, solange eine gültige Rechnung existiert (${active.documentNumber}). Stornieren Sie die Rechnung, um Änderungen vorzunehmen.`
    )
  }
  if (order.status === 'done') {
    error(
      409,
      'Dieser Auftrag ist abgeschlossen — Positionen können erst nach dem Wiederöffnen geändert werden.'
    )
  }
}

export async function addWorkOrderItem(
  workOrderId: string,
  input: WorkOrderItemInput
): Promise<WorkOrderItem> {
  const order = await requireOrder(workOrderId)
  await requireItemsUnlocked(order)
  const [last] = await db
    .select({ position: workOrderItems.position })
    .from(workOrderItems)
    .where(eq(workOrderItems.workOrderId, workOrderId))
    .orderBy(desc(workOrderItems.position))
    .limit(1)
  const nextPosition = (last?.position ?? 0) + 1

  // Hours exist only on labor rows — a material row silently drops
  // whatever hours value arrives (belt and braces for the UI rule).
  const hours =
    input.kind === 'material' || input.hours == null
      ? null
      : String(input.hours)
  const [created] = await db
    .insert(workOrderItems)
    .values({
      workOrderId,
      position: nextPosition,
      kind: input.kind,
      itemId: input.itemId ?? null,
      description: input.description,
      // Labor rows mirror the hours into quantity.
      quantity: String(
        input.kind === 'labor' && hours !== null ? hours : (input.quantity ?? 1)
      ),
      unit: input.unit ?? (input.kind === 'labor' ? 'Std.' : null),
      unitPriceNet: String(input.unitPriceNet),
      employeeId: input.employeeId ?? null,
      hours,
      doneAt: input.doneAt
    })
    .returning()
  await syncTimeEntryForItem(order, created)
  return created
}

export async function updateWorkOrderItem(
  itemId: string,
  patch: Partial<WorkOrderItemInput>
): Promise<WorkOrderItem> {
  const [current] = await db
    .select()
    .from(workOrderItems)
    .where(eq(workOrderItems.id, itemId))
    .limit(1)
  if (!current) {
    error(404, 'Auftragsposition nicht gefunden.')
  }
  const order = await requireOrder(current.workOrderId)
  await requireItemsUnlocked(order)

  const fields: Partial<typeof workOrderItems.$inferInsert> = {}
  if (patch.kind !== undefined) fields.kind = patch.kind
  if (patch.itemId !== undefined) fields.itemId = patch.itemId ?? null
  if (patch.description !== undefined) fields.description = patch.description
  if (patch.quantity !== undefined) fields.quantity = String(patch.quantity)
  if (patch.unit !== undefined) fields.unit = patch.unit ?? null
  if (patch.unitPriceNet !== undefined)
    fields.unitPriceNet = String(patch.unitPriceNet)
  if (patch.employeeId !== undefined)
    fields.employeeId = patch.employeeId ?? null
  if (patch.hours !== undefined)
    fields.hours = patch.hours == null ? null : String(patch.hours)
  if (patch.doneAt !== undefined) fields.doneAt = patch.doneAt

  // Keep quantity mirroring hours for labor rows; material rows never
  // carry hours (an incoming value — or a kind switch to material —
  // clears the column).
  const effectiveKind = fields.kind ?? current.kind
  if (effectiveKind === 'material') {
    fields.hours = null
  }
  const effectiveHours =
    fields.hours !== undefined ? fields.hours : current.hours
  if (
    effectiveKind === 'labor' &&
    effectiveHours != null &&
    patch.quantity === undefined
  ) {
    fields.quantity = String(effectiveHours)
  }

  const [updated] = await db
    .update(workOrderItems)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(workOrderItems.id, itemId))
    .returning()
  await syncTimeEntryForItem(order, updated)
  return updated
}

export async function deleteWorkOrderItem(itemId: string): Promise<void> {
  const [current] = await db
    .select({ workOrderId: workOrderItems.workOrderId })
    .from(workOrderItems)
    .where(eq(workOrderItems.id, itemId))
    .limit(1)
  // Unknown id: no-op (idempotent — same as before the lock).
  if (!current) return
  await requireItemsUnlocked(await requireOrder(current.workOrderId))
  // Explicit write-through cleanup (mirrors the DB-level ON DELETE
  // CASCADE of time_entries.work_order_item_id).
  await db.delete(timeEntries).where(eq(timeEntries.workOrderItemId, itemId))
  await db.delete(workOrderItems).where(eq(workOrderItems.id, itemId))
}

/* ── Labor rate ─────────────────────────────────────────────────────── */

export type LaborRate = {
  itemId: string
  articleNumber: string
  unitPriceNet: string | null
}

/**
 * The current workshop labor rate: the designated "Arbeitszeit" item
 * (`company_settings.labor_item_id`) with its current price version.
 * Null-safe — returns `null` while no labor item is linked (fresh DB
 * before `seedDefaults`, or the item was deleted).
 */
export async function getLaborRate(): Promise<LaborRate | null> {
  const settings = await getSettings()
  if (!settings.laborItemId) return null
  const [item] = await db
    .select({ id: items.id, articleNumber: items.articleNumber })
    .from(items)
    .where(eq(items.id, settings.laborItemId))
    .limit(1)
  if (!item) return null
  const price = await getCurrentItemPrice(item.id)
  return {
    itemId: item.id,
    articleNumber: item.articleNumber,
    unitPriceNet: price?.unitPriceNet ?? null
  }
}

/* ── Completion → invoice ───────────────────────────────────────────── */

const addDaysIso = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Complete the order: map its work items to invoice positions, create
 * the invoice through {@link createDocument} (numbering, totals, PDF),
 * flip the order to `done` with `completed_at` + `invoice_id`, and
 * back-fill `time_entries.document_id` for the order's write-through
 * hours so the utilization reports count them as billable.
 *
 * Mapping: labor rows become `kind: 'service'` positions with
 * `quantity = hours`, unit `Std.` and the labor item as backlink; a
 * labor row with an employee appends "(ausgeführt von <Name>)" to the
 * position text — a snapshot resolved at completion time, immune to
 * later employee master-data edits. Material rows keep their snapshot
 * price and inherit kind + article number from their catalog item when
 * linked (`kind: 'article'` for free-text material). Tax rate =
 * company default.
 */
export async function completeWorkOrder(
  id: string,
  opts: { issueDate: string; paymentMethod?: string }
): Promise<Document> {
  const order = await requireOrder(id)
  // Rule: at most ONE active invoice per order. Re-invoicing requires
  // cancelling the existing invoice first (which reopens the order);
  // after the Storno this guard passes and a fresh invoice is created.
  const active = await getActiveInvoiceForOrder(id)
  if (active) {
    error(
      409,
      `Für diesen Auftrag existiert bereits die gültige Rechnung ${active.documentNumber}. Stornieren Sie diese zuerst, um den Auftrag neu abzurechnen.`
    )
  }
  if (order.status === 'done') {
    error(409, 'Dieser Auftrag ist bereits abgeschlossen.')
  }

  const orderItems = await db
    .select()
    .from(workOrderItems)
    .where(eq(workOrderItems.workOrderId, id))
    .orderBy(asc(workOrderItems.position))
  if (orderItems.length === 0) {
    error(
      409,
      'Der Auftrag hat keine Positionen und kann nicht abgerechnet werden.'
    )
  }

  const settings = await getSettings()
  const taxRate = Number(settings.defaultVatRate)

  // Catalog rows referenced by material positions — inherit kind +
  // article number for the invoice position.
  const catalogIds = [
    ...new Set(
      orderItems.map((it) => it.itemId).filter((v): v is string => v !== null)
    )
  ]
  const catalogRows =
    catalogIds.length > 0
      ? await db
          .select({
            id: items.id,
            kind: items.kind,
            articleNumber: items.articleNumber
          })
          .from(items)
          .where(inArray(items.id, catalogIds))
      : []
  const catalogById = new Map(catalogRows.map((r) => [r.id, r]))

  // Employee snapshot: labor positions carry the executing employee's
  // name in the invoice text, resolved NOW — later master-data edits
  // (renames, deletions) can never alter the billed document.
  const employeeIds = [
    ...new Set(
      orderItems
        .filter((it) => it.kind === 'labor' && it.employeeId !== null)
        .map((it) => it.employeeId as string)
    )
  ]
  const employeeRows =
    employeeIds.length > 0
      ? await db
          .select({
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName
          })
          .from(employees)
          .where(inArray(employees.id, employeeIds))
      : []
  const employeeNameById = new Map(
    employeeRows.map((r) => [r.id, `${r.firstName} ${r.lastName}`.trim()])
  )

  const invoiceItems: DocumentInputItem[] = orderItems.map((it) => {
    if (it.kind === 'labor') {
      const laborItemId = it.itemId ?? settings.laborItemId ?? undefined
      const laborCatalog = it.itemId ? catalogById.get(it.itemId) : undefined
      const executedBy = it.employeeId
        ? employeeNameById.get(it.employeeId)
        : undefined
      return {
        description: executedBy
          ? `${it.description} (ausgeführt von ${executedBy})`
          : it.description,
        quantity: Number(it.hours ?? it.quantity),
        unit: 'Std.',
        unitPriceNet: Number(it.unitPriceNet),
        taxRate,
        kind: 'service',
        articleNumber: laborCatalog?.articleNumber,
        itemId: laborItemId
      }
    }
    const catalog = it.itemId ? catalogById.get(it.itemId) : undefined
    return {
      description: it.description,
      quantity: Number(it.quantity),
      unit: it.unit ?? 'Stk',
      unitPriceNet: Number(it.unitPriceNet),
      taxRate,
      kind: catalog?.kind ?? 'article',
      articleNumber: catalog?.articleNumber,
      itemId: it.itemId ?? undefined
    }
  })

  const completedAt = new Date()
  const invoice = await createDocument({
    type: 'invoice',
    customerId: order.customerId ?? undefined,
    vehicleId: order.vehicleId ?? undefined,
    // History backlink — survives a later Storno + re-invoicing, so
    // the order's full billing chain stays traceable (GoBD).
    workOrderId: id,
    issueDate: opts.issueDate,
    serviceDate: todayIso(),
    dueDate: addDaysIso(opts.issueDate, settings.defaultPaymentTermDays),
    paymentMethod: opts.paymentMethod,
    items: invoiceItems
  })

  await db
    .update(workOrders)
    .set({
      status: 'done',
      completedAt,
      invoiceId: invoice.id,
      updatedAt: completedAt
    })
    .where(eq(workOrders.id, id))

  // Back-fill: the order's write-through hours are now billed on this
  // invoice — utilization / monthly reports pick them up unchanged.
  await db
    .update(timeEntries)
    .set({ documentId: invoice.id, updatedAt: completedAt })
    .where(eq(timeEntries.workOrderId, id))

  return invoice
}
