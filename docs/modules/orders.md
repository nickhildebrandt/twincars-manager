---
title: Module - orders (Aufträge)
tags: [module, orders, work-orders, kanban]
updated: 2026-07-06
---

# orders - "Aufträge"

- **Purpose**: workshop jobs from intake to invoice - a three-stage
  Kanban (offen / in Bearbeitung / abgeschlossen) collects work items
  (labor hours, material) on the shop floor; completion automatically
  creates the invoice from the recorded items.
- **Routes**: `/orders` (Kanban board: `q` search + employee filter,
  status moves via buttons AND HTML5 drag & drop), `/orders/new`,
  `/orders/[id]` (detail: master data, status buttons, work-item table
  with inline add row, "Abschließen & Rechnung erstellen"),
  `/orders/[id]/edit`.
- **Remotes** `orders.remote.ts`: `kanbanBoardRemote`,
  `listWorkOrdersRemote`, `getWorkOrderRemote`, `getLaborRateRemote`
  (prefills labor positions from the Stundensatz, [[settings]]),
  `getWorkOrderIdForAppointmentRemote`, `createWorkOrderRemote`,
  `createWorkOrderFromAppointmentRemote`, `updateWorkOrderRemote`,
  `deleteWorkOrderRemote`, `moveWorkOrderStatusRemote`,
  `addWorkOrderItemRemote`, `updateWorkOrderItemRemote`,
  `deleteWorkOrderItemRemote`, `completeWorkOrderRemote`.
  Guard `requirePermission('orders')`.
- **Service**: `work-order-service.ts`.
- **Tables**: `work_orders` (`orderNumber` from the `work_order` number
  range, `AU-{YYYY}-{NNNN}`), `work_order_assignees` (m:n employees),
  `work_order_items` (labor | material, price snapshots per
  [[adr-007-price-snapshots-and-versions]]); writes through to
  `time_entries`. Column detail in [[database-schema]].
- **Special**:
  - **Status flow**: open ⇄ in_progress via `moveWorkOrderStatusRemote`;
    `done` is reachable ONLY through `completeWorkOrderRemote`; reopen
    (done → in_progress) only while `invoice_id IS NULL`; delete 409s
    once the invoice exists (GoBD - corrections go through the
    invoice's Storno flow, [[invoices]]).
  - **time_entries write-through**: every labor item with employee +
    hours mirrors exactly ONE `time_entries` row (task = description,
    date = done_at); deleting the item removes the entry. In [[hours]]
    these rows are read-only (maintained at the order).
  - **Auto-invoice**: completion maps work items to positions and calls
    the shared `createDocument` pipeline ([[invoices]]) - labor rows
    become `Std.` service positions (quantity = hours, labor item as
    `itemId` backlink), material rows keep their snapshot price; then
    `time_entries.document_id` is back-filled so order hours count as
    billable in the utilization reports.
  - **Appointment link**: one order per Termin (`appointment_id` unique
    partial index); `createWorkOrderFromAppointmentRemote` copies title,
    customer, vehicle and employee from the Termin ([[calendar]]).
  - **Calendar source**: directly created scheduled orders (not from a
    Termin, not done) appear in the month grid as `work_order` events
    ([[calendar]]).
  - **Done column bounded**: latest 25 by `completed_at`; older
    completed orders live in the paginated list.
- **Permission** `orders` - seeded to Mitarbeiter AND Werkstattleiter
  (shop floor is the point of the module); migration 0033 also grants
  it to the existing roles on deployed instances.
- **Tests**: `work-order-service.test.ts`, `orders.remote.test.ts`,
  `WorkOrderForm.test.ts`, `seed-defaults.test.ts` (labor item +
  `work_order` number range).
