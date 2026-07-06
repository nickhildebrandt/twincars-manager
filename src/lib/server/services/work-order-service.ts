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
 * {@link completeWorkOrder}; done → in_progress reopens only while
 * `invoice_id IS NULL`. {@link deleteWorkOrder} refuses (409) once the
 * invoice exists — the GoBD invoice chain owns the record then.
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
  scheduledAt: Date | null
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
    filters.push(
      or(
        ilike(workOrders.orderNumber, term),
        ilike(workOrders.title, term),
        ilike(customers.company, term),
        ilike(customers.lastName, term)
      )
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
    scheduledAt: r.order.scheduledAt,
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

  const [orderItems, assigneesByOrder] = await Promise.all([
    db
      .select()
      .from(workOrderItems)
      .where(eq(workOrderItems.workOrderId, id))
      .orderBy(asc(workOrderItems.position)),
    fetchAssignees([id])
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
    invoiceNumber: row.invoiceNumber ?? null
  }
}

/* ── Create / update / delete ───────────────────────────────────────── */

export type CreateWorkOrderInput = {
  title: string
  description?: string | null
  customerId?: string | null
  vehicleId?: string | null
  scheduledAt?: Date | null
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

export async function createWorkOrder(
  input: CreateWorkOrderInput
): Promise<WorkOrder> {
  const orderNumber = await allocateNumber('work_order')
  const [created] = await db
    .insert(workOrders)
    .values({
      orderNumber,
      title: input.title,
      description: input.description ?? null,
      customerId: input.customerId ?? null,
      vehicleId: input.vehicleId ?? null,
      scheduledAt: input.scheduledAt ?? null
    })
    .returning()
  if (input.assigneeIds && input.assigneeIds.length > 0) {
    await replaceAssignees(created.id, input.assigneeIds)
  }
  return created
}

/**
 * Create an order from a calendar Termin: copies title / customer /
 * vehicle, turns the appointment's employee into an assignee, links
 * `appointment_id` (UNIQUE — one order per Termin) and places the
 * order at the appointment's start time.
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
  const [created] = await db
    .insert(workOrders)
    .values({
      orderNumber,
      title: appointment.title,
      customerId: appointment.customerId,
      vehicleId: appointment.vehicleId,
      appointmentId: appointment.id,
      scheduledAt: appointment.startsAt
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
  const [updated] = await db
    .update(workOrders)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(workOrders.id, id))
    .returning()
  if (!updated) {
    error(404, 'Auftrag nicht gefunden.')
  }
  if (assigneeIds) {
    await replaceAssignees(id, assigneeIds)
  }
  return updated
}

/**
 * Delete an order. Refuses (409) once the invoice exists — the GoBD
 * invoice chain owns the record then; corrections go through the
 * invoice's Storno flow. The write-through `time_entries` rows of the
 * order's labor items are removed explicitly (production also cascades
 * them via the `work_order_item_id` FK, but the service does not rely
 * on it).
 */
export async function deleteWorkOrder(id: string): Promise<void> {
  const [row] = await db
    .select({ id: workOrders.id, invoiceId: workOrders.invoiceId })
    .from(workOrders)
    .where(eq(workOrders.id, id))
    .limit(1)
  if (!row) return
  if (row.invoiceId !== null) {
    error(
      409,
      'Dieser Auftrag wurde bereits abgerechnet und kann nicht gelöscht werden.'
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
 *   done         → in_progress   (reopen, only while invoice_id IS NULL)
 *
 * → done is NOT reachable here — completion happens exclusively through
 * {@link completeWorkOrder} (which creates the invoice).
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
      'Abschließen ist nur über "Abschließen & Rechnung erstellen" möglich.'
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
    if (order.invoiceId !== null) {
      error(
        409,
        'Dieser Auftrag wurde bereits abgerechnet und kann nicht wieder geöffnet werden.'
      )
    }
  }
  const [updated] = await db
    .update(workOrders)
    .set({
      status,
      // Reopening clears the completion timestamp.
      completedAt: order.status === 'done' ? null : order.completedAt,
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

export async function addWorkOrderItem(
  workOrderId: string,
  input: WorkOrderItemInput
): Promise<WorkOrderItem> {
  const order = await requireOrder(workOrderId)
  const [last] = await db
    .select({ position: workOrderItems.position })
    .from(workOrderItems)
    .where(eq(workOrderItems.workOrderId, workOrderId))
    .orderBy(desc(workOrderItems.position))
    .limit(1)
  const nextPosition = (last?.position ?? 0) + 1

  const hours = input.hours == null ? null : String(input.hours)
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

  // Keep quantity mirroring hours for labor rows.
  const effectiveKind = fields.kind ?? current.kind
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
 * `quantity = hours`, unit `Std.` and the labor item as backlink;
 * material rows keep their snapshot price and inherit kind +
 * article number from their catalog item when linked (`kind:
 * 'article'` for free-text material). Tax rate = company default.
 */
export async function completeWorkOrder(
  id: string,
  opts: { issueDate: string; paymentMethod?: string }
): Promise<Document> {
  const order = await requireOrder(id)
  if (order.status === 'done' || order.invoiceId !== null) {
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

  const invoiceItems: DocumentInputItem[] = orderItems.map((it) => {
    if (it.kind === 'labor') {
      const laborItemId = it.itemId ?? settings.laborItemId ?? undefined
      const laborCatalog = it.itemId ? catalogById.get(it.itemId) : undefined
      return {
        description: it.description,
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
