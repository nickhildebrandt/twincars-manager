---
title: Order-invoice rule set (Auftrag ↔ Rechnung)
tags: [domain, orders, invoices, storno, gobd]
updated: 2026-07-10
---

# The order ↔ invoice rule set

Shipped 2026-07 (migration 0037). Binding business rules for how a
Werkstattauftrag ([[orders]]) and its Rechnungen ([[invoices]]) relate,
including the full Storno cycle. Server-enforced in
`work-order-service.ts` / `document-service.ts` and mirrored in the UI.

## Core concept: the "aktive Rechnung"

An order's **active invoice** is a linked invoice
(`documents.work_order_id` backlink, `type='invoice'`) whose status is
**not** cancelled/storno. The single source of truth is
`getActiveInvoiceForOrder(orderId)` in `work-order-service.ts` - every
guard (completion, item lock, reopen, second-invoice rejection) derives
from it. **An order has at most one active invoice.**

Two links exist on purpose:

- `work_orders.invoice_id` - pointer to the single ACTIVE invoice;
  cleared when that invoice is cancelled (the order reopens).
- `documents.work_order_id` - permanent backlink from EVERY invoice
  that ever billed the order (the active one, cancelled originals AND
  their Storno documents, which inherit the link). This keeps the full
  billing history traceable in both directions across re-invoicing
  cycles (GoBD). Migration 0037 added the column with a guarded
  two-pass backfill (pass 1 from `work_orders.invoice_id`, pass 2
  Storno documents via the `cancels_document_id` chain).

## The rules

1. **Second invoice rejected while one is active** - the server rejects
   with the active invoice's number and a Storno hint.
2. **Items lock under an active invoice** - `work_order_items`
   add/update/delete 409 once an active invoice exists; the UI shows a
   lock hint and hides the editing affordances.
3. **`done` only via `completeWorkOrder`** - the completion command is
   the only path to status `done` (it creates the invoice from the
   recorded items). Kanban drag-drops to "Abgeschlossen" without an
   active invoice are rejected server-side with a German toast and the
   card reverts.
4. **Cancelling the active invoice auto-reopens the order** -
   `cancelInvoice` ([[adr-015-storno-instead-of-delete]]) sets the
   order back to `in_progress`, clears `completed_at`, un-bills the
   order's write-through time entries (`time_entries.document_id`
   cleared) and clears `work_orders.invoice_id` - corrections and
   re-invoicing then work normally. The Storno document and the
   cancelled original keep their `work_order_id` backlink forever.
5. **Undeletable once billed (GoBD)** - orders with any invoice history
   and order-linked invoices cannot be deleted; the Storno path is the
   only correction. The generic invoice status command
   (`setInvoiceStatusRemote`) can no longer flip a status to
   `cancelled` - only the Storno flow cancels.
6. **Standalone invoices unchanged** - invoices without an order
   (Teileverkauf / parts sale) keep their previous lifecycle.

## UI surfaces

- Order detail (`/orders/[id]`): a clickable **invoice-history card**
  (`listOrderInvoices`, ordered by creation) shows every invoice incl.
  Stornos; the item table shows the lock hint while an invoice is
  active.
- Invoice detail: every order-linked invoice (Storno included) links
  back to its order.
- Kanban (`/orders`): cards with status `done` are not draggable;
  drops into "Abgeschlossen" are guarded client-side too.

## Tests

The 11 acceptance cases of the rule set are covered in
`work-order-service.test.ts`, `orders.remote.test.ts` and
`src/routes/orders/[id]/page.test.ts`; the full storno cycle runs
through the real UI in `e2e/orders-invoices.spec.ts`
([[test-database]]).

Related: [[orders]], [[invoices]], [[document-types]],
[[adr-015-storno-instead-of-delete]].
