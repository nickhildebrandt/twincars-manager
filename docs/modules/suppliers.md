---
title: Module - suppliers (Lieferanten)
tags: [module, suppliers]
updated: 2026-07-05
---

# suppliers - "Lieferanten"

- **Purpose**: supplier master data (address, contact, bank,
  `customerNumberAtSupplier`).
- **Routes**: `/suppliers`, `/suppliers/new`, `/suppliers/[id]`,
  `/suppliers/[id]/edit`.
- **Remote** `suppliers.remote.ts`: `listSuppliersRemote`,
  `getSupplierRemote`, `createSupplierRemote`, `updateSupplierRemote`,
  `deleteSupplierRemote`. Guard `requirePermission('suppliers')`.
- **Service**: `supplier-service.ts`.
- **Tables**: `suppliers` (`legacySupplierNumber` from the import,
  `archived` soft delete).
- **Special**: referenced by `ledger_entries.supplierId` and
  `recurring_entries.supplierId` ([[ledger]]); searchable in the global
  [[search]] (archived excluded); `pickSuppliersRemote` picker.
- **Tests**: `supplier-service.test.ts`, `SupplierForm.test.ts`.
