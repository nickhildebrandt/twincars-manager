---
title: Module - customers (Kunden)
tags: [module, customers]
updated: 2026-07-07
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
  `setCustomerArchivedRemote`, `deleteCustomerRemote`,
  `sendAdHocCustomerEmailRemote`. All guarded
  with `requirePermission('customers')`.
- **Service**: `src/lib/server/services/customer-service.ts`.
- **Tables**: `customers` (see [[entities]]); relations to `vehicles`,
  `documents`, `tire_storage`, `time_entries`, `customer_inquiries`.
- **Special**:
  - `kind: 'regular' | 'ebay'` discriminator; eBay buyers carry only
    `ebayHandle`.
  - `wantsBroadcast` / `wantsTireReminders` opt-ins feed [[mailings]] and
    the tire reminder job.
  - **Archive is the soft-delete path** (`archived` flag,
    `setCustomerArchivedRemote`): the list has an Archiv tab (hidden by
    default; the archive view deliberately ignores the kind tabs so
    archived eBay customers stay findable), an "Archiviert" badge and
    inline "Reaktivieren"; the detail page offers
    Archivieren/Reaktivieren through `ConfirmDialog`. `deleteCustomer`
    refuses with a German count of linked records
    ("Es sind noch ... verknüpft ...") and points at archiving.
    Archived customers are excluded from pickers and global [[search]].
  - Ad-hoc mail uses the shared `EmailComposer` with optional HTML
    (`asHtml`) - no unsubscribe footer (transactional), see [[smtp-mail]].
  - Number from the `customer` number range; `legacyCustomerNumber` from
    the import.
  - `/customers/new` doubles as a creation-flow leaf: opened via "Neu
    anlegen" from a customer picker it returns to the origin form with
    the new customer auto-selected ([[creation-flow]]).
  - List search covers number, name, company, city, zip, street, phone,
    mobile, email and eBay handle (server-side ILIKE,
    [[remote-functions]]).
- **Picker**: `pickCustomersRemote` in `src/routes/pickers.remote.ts`.
- **Tests**: `customer-service.test.ts` (service),
  `customers.remote.test.ts` (guards/integration),
  `CustomerForm.test.ts` (component).
