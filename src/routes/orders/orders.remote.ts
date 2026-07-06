import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  array,
  maxLength,
  maxValue,
  minLength,
  minValue,
  nullable,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
  trim
} from 'valibot'
import { eq, inArray } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import { documents, workOrders } from '$lib/server/db/schema'
import {
  dateStringSchema,
  idSchema,
  longTextSchema,
  moneySchema,
  paymentMethodSchema,
  searchQuerySchema,
  timeHHMMSchema
} from '$lib/server/db/validation'
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
} from '$lib/server/services/work-order-service'
import { requirePermission } from '$lib/server/auth-guards'

/* ── Schemas ────────────────────────────────────────────────────────── */

const titleSchema = pipe(
  string('Bitte einen Titel eingeben.'),
  trim(),
  minLength(1, 'Der Titel darf nicht leer sein.'),
  maxLength(200, 'Der Titel darf maximal 200 Zeichen lang sein.')
)

/**
 * Shared input schema for `createWorkOrderRemote`. Scheduling is a
 * plain `YYYY-MM-DD` date plus an optional `HH:MM` start time (no end
 * time) — both stored as-is, no timezone conversion.
 */
const workOrderInputSchema = object({
  title: titleSchema,
  description: optional(longTextSchema),
  customerId: optional(idSchema),
  vehicleId: optional(idSchema),
  scheduledDate: optional(dateStringSchema),
  scheduledTime: optional(timeHHMMSchema),
  assigneeIds: optional(
    pipe(
      array(idSchema),
      maxLength(50, 'Es können maximal 50 Mitarbeiter zugewiesen werden.')
    )
  )
})

/**
 * Patch schema for `updateWorkOrderRemote`. Every field is optional;
 * nullable fields accept an explicit `null` to clear the relation
 * (customer / vehicle / scheduled date).
 */
const workOrderPatchSchema = object({
  title: optional(titleSchema),
  description: optional(nullable(longTextSchema)),
  customerId: optional(nullable(idSchema)),
  vehicleId: optional(nullable(idSchema)),
  scheduledDate: optional(nullable(dateStringSchema)),
  scheduledTime: optional(nullable(timeHHMMSchema)),
  assigneeIds: optional(
    pipe(
      array(idSchema),
      maxLength(50, 'Es können maximal 50 Mitarbeiter zugewiesen werden.')
    )
  )
})

const listSchema = object({
  page: pipe(
    number('Bitte eine Seitenzahl angeben.'),
    minValue(1, 'Seite muss mindestens 1 sein.'),
    maxValue(100_000, 'Seite ist zu groß.')
  ),
  size: picklist([10, 25, 50, 100]),
  q: optional(searchQuerySchema),
  status: optional(
    picklist(
      ['all', 'open', 'in_progress', 'done'],
      'Bitte einen gültigen Status wählen.'
    )
  ),
  employeeId: optional(idSchema)
})

/**
 * Work-item input. Labor rows carry `hours` (mirrored into quantity by
 * the service); material rows carry `quantity`. `unitPriceNet` is the
 * price snapshot at entry time (ADR-007) — editable per item.
 */
const workOrderItemInputSchema = object({
  kind: picklist(['labor', 'material'], 'Bitte eine gültige Art wählen.'),
  itemId: optional(nullable(idSchema)),
  description: pipe(
    string('Bitte eine Beschreibung eingeben.'),
    trim(),
    minLength(1, 'Die Beschreibung darf nicht leer sein.'),
    maxLength(500, 'Die Beschreibung darf maximal 500 Zeichen lang sein.')
  ),
  quantity: optional(
    pipe(
      number('Bitte eine Menge eingeben.'),
      minValue(0.001, 'Die Menge muss größer als 0 sein.'),
      maxValue(1_000_000, 'Die Menge ist zu groß.')
    )
  ),
  unit: optional(
    pipe(
      string(),
      trim(),
      maxLength(20, 'Die Einheit darf maximal 20 Zeichen lang sein.')
    )
  ),
  unitPriceNet: moneySchema,
  employeeId: optional(nullable(idSchema)),
  hours: optional(
    nullable(
      pipe(
        number('Bitte die Stunden eingeben.'),
        minValue(0.01, 'Die Stunden müssen größer als 0 sein.'),
        maxValue(999, 'Die Stundenzahl ist zu groß.')
      )
    )
  ),
  doneAt: dateStringSchema
})

/* ── Queries ────────────────────────────────────────────────────────── */

/**
 * The three Kanban columns. Done cards are enriched with their invoice
 * id + number so the board can link straight to the generated invoice
 * (the service-level `KanbanCard` is invoice-agnostic).
 *
 * @group integration
 * @module orders
 */
const kanbanFilterSchema = object({
  q: optional(pipe(string(), trim(), maxLength(200, 'Suchbegriff zu lang.'))),
  employeeId: optional(idSchema)
})

export const kanbanBoardRemote = query(kanbanFilterSchema, async (filter) => {
  requirePermission('orders')
  const board = await listKanbanBoard({
    q: filter.q || undefined,
    employeeId: filter.employeeId || undefined
  })
  const doneIds = board.done.map((c) => c.id)
  const invoiceRows =
    doneIds.length > 0
      ? await db
          .select({
            orderId: workOrders.id,
            invoiceId: workOrders.invoiceId,
            invoiceNumber: documents.documentNumber
          })
          .from(workOrders)
          .leftJoin(documents, eq(workOrders.invoiceId, documents.id))
          .where(inArray(workOrders.id, doneIds))
      : []
  const byOrder = new Map(invoiceRows.map((r) => [r.orderId, r]))
  return {
    open: board.open.map((c) => ({
      ...c,
      invoiceId: null as string | null,
      invoiceNumber: null as string | null
    })),
    in_progress: board.in_progress.map((c) => ({
      ...c,
      invoiceId: null as string | null,
      invoiceNumber: null as string | null
    })),
    done: board.done.map((c) => ({
      ...c,
      invoiceId: byOrder.get(c.id)?.invoiceId ?? null,
      invoiceNumber: byOrder.get(c.id)?.invoiceNumber ?? null
    }))
  }
})

/**
 * Paginated, searchable work-order list (used beyond the bounded done
 * column of the Kanban board). Filters: free text, status, assignee.
 *
 * @group integration
 * @module orders
 */
export const listWorkOrdersRemote = query(listSchema, async (params) => {
  requirePermission('orders')
  return listWorkOrders({
    page: params.page,
    size: params.size,
    q: params.q,
    status: params.status ?? 'all',
    employeeId: params.employeeId
  })
})

/**
 * Load one work order with items, assignees and display labels.
 * Throws `404` if the order does not exist.
 *
 * @group integration
 * @module orders
 */
export const getWorkOrderRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('orders')
    const detail = await getWorkOrder(id)
    if (!detail) error(404, 'Auftrag nicht gefunden.')
    return detail
  }
)

/**
 * The current workshop labor rate (designated "Arbeitszeit" item with
 * its current price version) — used to prefill labor positions. `null`
 * while no labor item is configured.
 *
 * @group integration
 * @module orders
 */
export const getLaborRateRemote = query(async () => {
  requirePermission('orders')
  return getLaborRate()
})

/**
 * Id of the work order created from a given Termin, or `null` when the
 * appointment has no order yet. Lets the appointment edit page swap
 * "Auftrag erstellen" for a "Zum Auftrag" link.
 *
 * @group integration
 * @module orders
 */
export const getWorkOrderIdForAppointmentRemote = query(
  object({ appointmentId: idSchema }),
  async ({ appointmentId }) => {
    requirePermission('orders')
    const [row] = await db
      .select({ id: workOrders.id })
      .from(workOrders)
      .where(eq(workOrders.appointmentId, appointmentId))
      .limit(1)
    return row ? { id: row.id } : null
  }
)

/* ── Refresh helpers ────────────────────────────────────────────────── */

/**
 * Refresh every board / list instance the client requested via
 * `.updates(...)` (capped at 4 each to bound DoS risk) — the standard
 * single-flight refresh for order mutations.
 *
 * `requested(...)` is essential here: it re-runs the queries under the
 * client's own cache keys (filters included). A server-side
 * `kanbanBoardRemote({}).refresh()` would refresh a DIFFERENT cache key
 * than the client's `{q: undefined, employeeId: undefined}` instance —
 * the fresh data would never reach the board and optimistic moves
 * would snap back once their override is released.
 */
const refreshBoardAndLists = async (): Promise<void> => {
  await Promise.all([
    requested(kanbanBoardRemote, 4).refreshAll(),
    requested(listWorkOrdersRemote, 4).refreshAll()
  ])
}

/**
 * Curated 400 for the binding rule "an order needs a customer OR a
 * vehicle" (both are allowed, neither is not).
 */
const requireCustomerOrVehicle = (
  customerId: string | null | undefined,
  vehicleId: string | null | undefined
): void => {
  if (!customerId && !vehicleId) {
    error(400, 'Bitte mindestens einen Kunden oder ein Fahrzeug zuordnen.')
  }
}

/* ── Order mutations ────────────────────────────────────────────────── */

/**
 * Create a new work order (allocates an AU number, links customer /
 * vehicle / assignees). Rejects orders without a customer AND without
 * a vehicle — at least one link is required.
 *
 * @group integration
 * @module orders
 */
export const createWorkOrderRemote = command(
  workOrderInputSchema,
  async (input) => {
    requirePermission('orders')
    requireCustomerOrVehicle(input.customerId, input.vehicleId)
    const order = await createWorkOrder({
      title: input.title,
      description: input.description ?? null,
      customerId: input.customerId ?? null,
      vehicleId: input.vehicleId ?? null,
      scheduledDate: input.scheduledDate ?? null,
      scheduledTime: input.scheduledTime ?? null,
      assigneeIds: input.assigneeIds
    })
    await refreshBoardAndLists()
    return order
  }
)

/**
 * Create a work order from a calendar Termin (copies title / customer /
 * vehicle / employee, links `appointment_id`). Returns only the new id
 * — the caller navigates to `/orders/{id}`.
 *
 * @group integration
 * @module orders
 */
export const createWorkOrderFromAppointmentRemote = command(
  object({ appointmentId: idSchema }),
  async ({ appointmentId }) => {
    requirePermission('orders')
    const order = await createWorkOrderFromAppointment(appointmentId)
    await refreshBoardAndLists()
    return { id: order.id }
  }
)

/**
 * Update a work order's master data and/or replace its assignee set.
 * A patch that would leave the order without both customer and vehicle
 * is rejected (the service also enforces this against the effective
 * post-patch state; this is the explicit-both-null fast path).
 *
 * @group integration
 * @module orders
 */
export const updateWorkOrderRemote = command(
  object({ id: idSchema, values: workOrderPatchSchema }),
  async ({ id, values }) => {
    requirePermission('orders')
    if (values.customerId === null && values.vehicleId === null) {
      requireCustomerOrVehicle(null, null)
    }
    const order = await updateWorkOrder(id, values)
    await Promise.all([
      getWorkOrderRemote({ id }).refresh(),
      refreshBoardAndLists()
    ])
    return order
  }
)

/**
 * Delete a work order. The service refuses (409) once the invoice
 * exists (GoBD).
 *
 * @group integration
 * @module orders
 */
export const deleteWorkOrderRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('orders')
    await deleteWorkOrder(id)
    await refreshBoardAndLists()
  }
)

/**
 * Kanban status move. Only `open` and `in_progress` are reachable —
 * `done` happens exclusively through {@link completeWorkOrderRemote}.
 *
 * @group integration
 * @module orders
 */
export const moveWorkOrderStatusRemote = command(
  object({
    id: idSchema,
    status: picklist(
      ['open', 'in_progress'],
      'Bitte einen gültigen Status wählen.'
    )
  }),
  async ({ id, status }) => {
    requirePermission('orders')
    const order = await setWorkOrderStatus(id, status)
    await Promise.all([
      getWorkOrderRemote({ id }).refresh(),
      refreshBoardAndLists()
    ])
    return order
  }
)

/* ── Work-item mutations ────────────────────────────────────────────── */

/**
 * Add a work item (labor / material) to an order. Labor items with
 * employee + hours write through to `time_entries`.
 *
 * @group integration
 * @module orders
 */
export const addWorkOrderItemRemote = command(
  object({ workOrderId: idSchema, values: workOrderItemInputSchema }),
  async ({ workOrderId, values }) => {
    requirePermission('orders')
    const item = await addWorkOrderItem(workOrderId, values)
    await getWorkOrderRemote({ id: workOrderId }).refresh()
    return item
  }
)

/**
 * Update a single work item (partial patch).
 *
 * @group integration
 * @module orders
 */
export const updateWorkOrderItemRemote = command(
  object({ id: idSchema, values: workOrderItemInputSchema }),
  async ({ id, values }) => {
    requirePermission('orders')
    const item = await updateWorkOrderItem(id, values)
    await getWorkOrderRemote({ id: item.workOrderId }).refresh()
    return item
  }
)

/**
 * Delete a work item (removes the linked time entry). `workOrderId`
 * is required so the detail query can refresh in the same flight.
 *
 * @group integration
 * @module orders
 */
export const deleteWorkOrderItemRemote = command(
  object({ id: idSchema, workOrderId: idSchema }),
  async ({ id, workOrderId }) => {
    requirePermission('orders')
    await deleteWorkOrderItem(id)
    await getWorkOrderRemote({ id: workOrderId }).refresh()
  }
)

/* ── Completion ─────────────────────────────────────────────────────── */

/**
 * Complete the order: creates the invoice from its work items, flips
 * the order to `done` and back-fills the write-through time entries.
 * Returns the invoice id + number for the success toast / navigation.
 *
 * @group integration
 * @module orders
 */
export const completeWorkOrderRemote = command(
  object({
    id: idSchema,
    issueDate: dateStringSchema,
    paymentMethod: paymentMethodSchema
  }),
  async ({ id, issueDate, paymentMethod }) => {
    requirePermission('orders')
    const invoice = await completeWorkOrder(id, { issueDate, paymentMethod })
    await Promise.all([
      getWorkOrderRemote({ id }).refresh(),
      refreshBoardAndLists()
    ])
    return { invoiceId: invoice.id, invoiceNumber: invoice.documentNumber }
  }
)
