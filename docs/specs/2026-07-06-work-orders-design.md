# Aufträge (Work Orders) — Design

Status: approved, in implementation (2026-07-06). Successor of "Teil B"
deferred in [[2026-06-23-employee-absences-vacation-design]].

## Purpose

Track active workshop jobs from intake to invoice. An order is created
directly or from a calendar appointment, is assigned to employees,
collects work items (performed services, material, labor hours) from
the shop floor, moves through a three-stage Kanban (offen / in
Bearbeitung / abgeschlossen) and, on completion, automatically creates
the invoice from its recorded items.

## Schema (migration 0033)

**work_orders**: id uuid PK; order_number varchar(50) NOT NULL UNIQUE
(number range kind `work_order`, template `AU-{YYYY}-{NNNN}`, allocated
via the atomic number-range-service); title varchar(200) NOT NULL;
description text; status varchar(20) NOT NULL DEFAULT 'open'
(`open|in_progress|done`; UI labels offen / in Bearbeitung /
abgeschlossen); customer_id FK customers SET NULL; vehicle_id FK
vehicles SET NULL; appointment_id FK calendar_entries SET NULL (source
Termin, UNIQUE partial index WHERE NOT NULL — one order per Termin);
invoice_id FK documents SET NULL (set by completion); scheduled_at
timestamptz NULL (calendar placement for directly created orders);
completed_at timestamptz NULL; created_at/updated_at. Indexes: status,
customer_id, appointment_id (unique partial), invoice_id.

**work_order_assignees**: work_order_id FK CASCADE + employee_id FK
CASCADE, composite PK. Multiple employees per order.

**work_order_items**: id uuid PK; work_order_id FK CASCADE NOT NULL;
position integer NOT NULL; kind varchar(20) NOT NULL DEFAULT 'labor'
(`labor|material`); item_id FK items SET NULL (catalog backlink, NULL =
free text); description text NOT NULL; quantity numeric(12,3) NOT NULL
DEFAULT 1 (labor: mirrors hours); unit varchar(20); unit_price_net
numeric(12,2) NOT NULL — **snapshot at entry time** for BOTH kinds
(labor resolves the current labor-item price when added, editable per
item; ADR-007 snapshot semantics, no resolve-at-invoice indirection);
employee_id FK employees SET NULL (who did it); hours numeric(6,2) NULL
(labor only); done_at date NOT NULL; created_at/updated_at. Index
work_order_id.

**time_entries** additions: work_order_id uuid FK work_orders SET NULL
(+index), work_order_item_id uuid FK work_order_items CASCADE (+UNIQUE
index WHERE NOT NULL).

**company_settings** addition: labor_item_id uuid FK items SET NULL —
the designated "Arbeitszeit" catalog service item whose current price
version is the workshop labor rate. seedDefaults creates the item
(unit `Std.`, articleNumber `ARBEIT`) idempotently and links it when
the column is NULL.

Migration also grants the `orders` permission to existing
`Werkstattleiter` and `Mitarbeiter` roles (INSERT ... ON CONFLICT DO
NOTHING) so the deployed instance sees the module without manual role
edits.

## Hours integration (single source of truth)

`time_entries` stays the canonical hours store. Every labor work item
(employee + hours) write-through-upserts exactly ONE linked
time_entries row (task = description, customerId = order customer,
date = done_at, work_order_id, work_order_item_id). Deleting the work
item cascades the entry. Completion sets `time_entries.document_id =
invoice.id` for all rows of the order, so utilizationSummary /
monthlyReport count them as billable with ZERO report changes. In
/hours, rows with work_order_item_id are read-only (edited at the
order); the list gains an Auftrag column + filter. Manual free entries
remain possible (non-order work).

## Status flow

open ⇄ in_progress; → done ONLY through completeWorkOrder; done →
in_progress reopens only while invoice_id IS NULL. deleteWorkOrder 409s
once invoice_id is set (GoBD: the invoice chain owns the record).

## Completion → invoice

completeWorkOrder(id, {issueDate, paymentMethod?}) maps work items to
DocumentInputItem[]: material/catalog rows as kind article/service with
snapshot price + articleNumber + itemId backlink; each labor row as
{description, quantity: hours, unit: 'Std.', unitPriceNet: snapshot,
kind: 'service', itemId: labor item}. taxRate =
company_settings.defaultVatRate. Calls the existing
createDocument({type:'invoice', customerId, vehicleId, issueDate,
serviceDate: completion date, dueDate: issueDate +
defaultPaymentTermDays, items}) — numbering, totals, PDF included.
Then sets {status:'done', completedAt, invoiceId} and back-fills
time_entries.document_id. document-service gains optional
DocumentInputItem.itemId (pass-through to document_items.item_id).

## Calendar integration

`listCalendarEvents` gains a sixth derived source: work_orders with
scheduled_at in range AND appointment_id IS NULL AND status != 'done'
(orders created FROM a Termin are already visible as that Termin).
CalendarEventKind += 'work_order', id `wo-<uuid>`, click-through
/orders/[id], badge class bg-secondary/10 text-secondary. The
appointment edit page gets an "Auftrag erstellen" button →
createWorkOrderFromAppointmentRemote (copies title, customer, vehicle,
employee→assignee, links appointment_id, scheduled_at = startsAt);
button becomes a link to the order once one exists.

## Routes & UI

- `/orders` — Kanban main view: 3 columns as card lists (DaisyUI card
  baseline), each card shows order number, title, customer + plate,
  assignee badges; status moves via buttons (mobile/a11y baseline) AND
  HTML5 drag & drop with Tailwind-class-only styling; search input +
  employee filter; done column bounded (latest 25).
- `/orders/new`, `/orders/[id]/edit` — WorkOrderForm: title,
  description, CustomerVehiclePicker (inline create!), assignee
  multi-select from pickEmployeesRemote, scheduled_at.
- `/orders/[id]` — detail: master data card, status buttons, work-item
  table with inline add row (SearchablePicker over pickItemsRemote for
  Leistungen/Material + free-text mode, employee picker, hours input
  for labor), completion button "Abschließen & Rechnung erstellen"
  (ConfirmDialog → busy.run → goto invoice).
- Sidebar: "Aufträge" at the top of the Aufträge & Rechnungen group,
  ClipboardList icon, permission `orders`.

## Permissions

New key `orders` in MODULE_PERMISSIONS; seeded Mitarbeiter role gains
it (shop floor is the point of the module); Werkstattleiter inherits
via flatMap. pickEmployeesRemote guard relaxes to
requireAnyPermission('employees', 'orders').

## Settings

/settings Allgemein gains a "Stundensatz (netto)" field: shows the
current labor-item price, writing a new item_price_versions row on
change (history preserved).

## Related

[[../modules/calendar]] · [[../modules/invoices]] ·
[[../modules/hours]] · [[../architecture/database-schema]] ·
[[../decisions/adr-007-price-snapshots-and-versions]]
