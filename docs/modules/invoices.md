---
title: Module - invoices (Rechnungen)
tags: [module, invoices, documents]
updated: 2026-07-05
---

# invoices - "Rechnungen"

- **Purpose**: invoice lifecycle - create, pay, send, cancel via Storno;
  XRechnung export.
- **Routes**: `/invoices`, `/invoices/new` (with its own
  `new/pickers.remote.ts`), `/invoices/[id]`.
- **Remotes**:
  - `invoices.remote.ts`: `listInvoicesRemote`, `getInvoiceRemote`,
    `createInvoiceRemote`, `setInvoiceStatusRemote`,
    `markInvoiceSentRemote`, `sendInvoiceRemote`, `deleteInvoiceRemote`,
    `cancelInvoiceRemote` (creates the Storno-Rechnung).
  - `xrechnung.remote.ts`: EN 16931 XML sidecar download ([[xrechnung]]).
  - Guard `requirePermission('invoices')`.
- **Service**: `document-service.ts` (shared with [[offers]]).
- **Tables**: `documents`, `document_items`, `document_payments`,
  `document_pdfs`, `sent_messages`.
- **Special**:
  - **GoBD**: issued invoices are never deleted; `cancelInvoiceRemote`
    creates a negating `status='storno'` invoice from the `storno`
    number range and chains
    `cancelledByDocumentId`/`cancelsDocumentId`
    ([[adr-015-storno-instead-of-delete]]).
  - Payments (`document_payments`) with method from the shared
    `PAYMENT_METHODS` constant; covering the gross total flips status to
    `paid`.
  - `reminderLevel` counts sent Zahlungserinnerungen ([[reminders]]).
  - Sending mails the cached PDF ([[pdf-pipeline]], [[smtp-mail]]).
  - Vehicle sales can generate invoices (`vehicle_sales.invoiceId`).
- **Tests**: `document-service.test.ts`, `xrechnung-service.test.ts`,
  `pdf-service.test.ts`.
