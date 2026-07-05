---
title: Module - ledger (Buchhaltung)
tags: [module, ledger, accounting]
updated: 2026-07-05
---

# ledger - "Buchhaltung"

- **Purpose**: income/expense bookkeeping with categories, recurring
  templates and DATEV export.
- **Routes**: `/ledger`, `/ledger/new`, `/ledger/[id]/edit`.
- **Remotes**:
  - `ledger.remote.ts`: `listLedgerEntriesRemote`,
    `listCategoriesRemote`, `getLedgerEntryRemote`,
    `createLedgerEntryRemote`, `updateLedgerEntryRemote`,
    `deleteLedgerEntryRemote`.
  - `datev.remote.ts`: DATEV Buchungsstapel CSV export ([[datev]]).
  - Guard `requirePermission('ledger')`.
- **Service**: `ledger-service.ts`.
- **Tables**: `ledger_entries` (direction einnahme/ausgabe, gross/net/tax,
  `paymentMethod` from the shared constant, `paymentStatus`, FKs to
  category/supplier/customer/document, `source`,
  `recurringTemplateId`), `ledger_categories` (seeded with
  `defaultTaxRate`), `recurring_entries` (intervalKind/Every,
  nextRunDate, paused, occurrence limits).
- **Special**: invoice payments can flow into the ledger via the
  document FK; recurring templates materialize entries when due
  (operator-triggered, [[adr-009-no-in-process-scheduler]]).
- **Related view**: [[sales-ledger]] is the separate read-only
  Rechnungsausgangsbuch over `documents`.
- **Tests**: `ledger-service.test.ts`, `datev-export-service.test.ts`.
