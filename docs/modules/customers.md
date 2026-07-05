---
title: Module - customers (Kunden)
tags: [module, customers]
updated: 2026-07-05
---

# customers - "Kunden"

Canonical template module (together with [[vehicles]]) - copy this pattern
for new modules.

- **Purpose**: customer master data, related vehicles/documents, ad-hoc
  customer email.
- **Routes**: `/customers` (list, tabs on `kind` regular/ebay),
  `/customers/new`, `/customers/[id]` (detail incl. related data +
  ad-hoc mail modal), `/customers/[id]/edit`.
- **Remote** `src/routes/customers/customers.remote.ts`:
  `listCustomersRemote`, `getCustomerRemote`, `getCustomerRelatedRemote`,
  `countCustomersRemote`, `createCustomerRemote`, `updateCustomerRemote`,
  `deleteCustomerRemote`, `sendAdHocCustomerEmailRemote`. All guarded
  with `requirePermission('customers')`.
- **Service**: `src/lib/server/services/customer-service.ts`.
- **Tables**: `customers` (see [[entities]]); relations to `vehicles`,
  `documents`, `tire_storage`, `time_entries`, `customer_inquiries`.
- **Special**:
  - `kind: 'regular' | 'ebay'` discriminator; eBay buyers carry only
    `ebayHandle`.
  - `wantsBroadcast` / `wantsTireReminders` opt-ins feed [[mailings]] and
    the tire reminder job.
  - Archive instead of delete when references exist (`archived`).
  - Ad-hoc mail uses the shared `EmailComposer` with optional HTML
    (`asHtml`) - no unsubscribe footer (transactional), see [[smtp-mail]].
  - Number from the `customer` number range; `legacyCustomerNumber` from
    the import.
- **Picker**: `pickCustomersRemote` in `src/routes/pickers.remote.ts`.
- **Tests**: `customer-service.test.ts` (service),
  `customers.remote.test.ts` (guards/integration),
  `CustomerForm.test.ts` (component).
