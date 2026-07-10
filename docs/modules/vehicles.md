---
title: Module - vehicles (Fahrzeuge)
tags: [module, vehicles]
updated: 2026-07-10
---

# vehicles - "Fahrzeuge"

Canonical template module (with [[customers]]).

- **Purpose**: vehicle master data for customer AND stock vehicles,
  photos, documents, license-plate history, sale sign.
- **Routes**: `/vehicles`, `/vehicles/new`, `/vehicles/[id]`,
  `/vehicles/[id]/edit`.
- **Remotes**:
  - `vehicles.remote.ts`: `listVehiclesRemote`, `getVehicleRemote`,
    `countVehiclesRemote`, `getVehicleRelatedRemote`,
    `listVehicleWorkOrdersRemote` (Aufträge tab, paginated 25, guard
    `requireAnyPermission('vehicles', 'orders')`),
    `getVehicleHistoryRemote` (Historie tab),
    `createVehicleRemote`, `updateVehicleRemote`, `deleteVehicleRemote`,
    `setVehicleArchivedRemote`, `purchaseVehicleIntoStockRemote`,
    `listVehiclePhotosRemote`, `addVehiclePhotoRemote`,
    `deleteVehiclePhotoRemote`, `setMainVehiclePhotoRemote`.
  - `vehicle-documents.remote.ts`: `listVehicleDocumentsRemote`,
    `getVehicleDocumentRemote`, `uploadVehicleDocumentRemote`,
    `deleteVehicleDocumentRemote`.
  - `sale-sign.remote.ts`: renders the "Verkaufsschild" PDF
    (`renderVehicleSaleSignPdf`, [[pdf-pipeline]]).
- **Services**: `vehicle-service.ts` (incl.
  `getEffectiveLicensePlate(vehicleId, dateIso)`),
  `vehicle-photo-service.ts`, `vehicle-document-service.ts`.
- **Tables**: `vehicles`, `vehicle_license_plate_versions`,
  `vehicle_photos`, `vehicle_documents`; stock extras
  `vehicle_purchases`, `vehicle_listings`, `vehicle_sales` (surfaced by
  [[inventory]]).
- **Special**:
  - **Tabbed detail page** (2026-07, standard `TabGroup` -
    [[styling]]): Übersicht / Halter (customer-owned only: read-only
    `CompactCustomerCard` + link to the customer, never an embedded
    customer page) / Rechnungen / Aufträge / Fotos (stock only) /
    Dokumente / Historie. The tab set flips in place after an Ankauf.
    The **Historie** tab (`getVehicleHistoryRemote`) merges
    `vehicle_purchases` (rename-proof `previousOwner` snapshot,
    deliberately never linked), `vehicle_sales` (live customer link
    while the buyer exists) and the plate versions, newest first
    (createdAt tie-break); unpaginated by design (a handful of rows
    per ownership cycle).
  - **Stock-only invariants** (2026-07, server-enforced 409s):
    photos AND the Verkaufsschild exist only for stock vehicles
    (`customer_id IS NULL`). `addVehiclePhoto` rejects customer-owned
    vehicles ("Fotos können nur bei Verkaufsfahrzeugen hinterlegt
    werden."), the sale-sign remote likewise. Galleries are **sales
    artifacts**: selling a stock vehicle deletes its photo gallery in
    the same write step, and an Ankauf starts with an empty gallery
    (migration 0035 cleaned up pre-rule rows). The Fotos tab and the
    Verkaufsschild action render only for stock vehicles (photos are
    not even fetched for customer-owned ones).
  - **Ankauf hardening**: archived vehicles cannot be angekauft (409
    with a reactivation hint); double-call safe.
  - License plates are versioned; documents reference the vehicle, not a
    plate, so plate changes never rewrite history
    ([[adr-007-price-snapshots-and-versions]] pattern).
  - **"Dokumente" card** on the detail page (customer AND stock
    vehicles): file attachments in `vehicle_documents` as `bytea`
    inline, max 15 MB per file, allowed MIME types
    `application/pdf` / `image/jpeg` / `image/png` / `image/webp`.
    The list query is meta-only (name, mime, size, note, date); bytes
    travel exclusively through the single-document fetch. Migration 0034.
  - **Vorbesitzer**: optional `previousOwnerCustomerId` back-link for
    stock vehicles (FK customers, SET NULL, migration 0034). The picker
    shows on `/inventory/new` and on the edit form of stock vehicles;
    the detail page links to the customer.
  - **Ownership transfers** (see [[inventory]] for the lifecycle):
    "stock" is defined app-wide as `customerId IS NULL`. The **Ankauf**
    card on the detail page of a customer vehicle
    (`purchaseVehicleIntoStockRemote`, guard
    `requirePermission('inventory')`, confirm modal
    `PurchaseIntoStockModal.svelte`) re-hangs the FK: the current
    holder becomes `previousOwnerCustomerId`, `customerId` is cleared,
    a `vehicle_purchases` history row is written (rename-proof
    `previousOwner` varchar snapshot via `customerDisplayName`; brutto
    price, Paragraph 25a UStG differential taxation, `'0.00'` when
    unknown) and a listing left in `sold` from a previous cycle flips
    back to `available`. All vehicle-FK data (documents, photos, plate
    versions, tire storage, work orders) follows the vehicle
    automatically. The **sale** direction runs through
    `sellStockVehicleToCustomer` when a stock-sale invoice is marked
    paid ([[invoices]]): buyer becomes `customerId`, one
    `vehicle_sales` row (sale price = invoice gross, invoice backlink)
    is written, the listing flips to `sold`; `previousOwnerCustomerId`
    stays untouched. Idempotent per stock cycle (a sale row newer than
    the latest purchase row blocks a second write; older sale rows are
    history from a previous cycle). `listVehiclePurchases` /
    `listVehicleSales` feed the detail history.
  - **Archive is the soft-delete path**: `archived` flag,
    `setVehicleArchivedRemote`, Archiv tab on the list (hidden by
    default, ignores the kind filter so every archived vehicle stays
    findable), "Archiviert" badge, inline "Reaktivieren" on the tab and
    Archivieren/Reaktivieren via `ConfirmDialog` on the detail page.
    `deleteVehicle` refuses with a German count of linked
    Belege/Aufträge/Einlagerungen and points at archiving; archived
    vehicles are excluded from pickers and global [[search]].
  - Detail page renders document statuses through
    `documentStatusLabel()`/`documentStatusBadge()` (never raw enums).
  - Vehicle photos: base64 data URLs, `isMain` + `sortOrder`.
  - `/vehicles/new` doubles as a creation-flow leaf: opened from a
    picker it shows a hint and returns to the origin form with the new
    vehicle auto-selected ([[creation-flow]]).
  - Guard `requirePermission('vehicles')`.
- **Picker**: `pickVehiclesRemote`, `pickInventoryVehiclesRemote`
  (search: plate via the versions table, VIN, make, model, HSN, TSN,
  plus holder name on `pickVehiclesRemote`).
- **Tests**: `vehicle-service.test.ts`, `vehicle-photo-service.test.ts`
  (stock-only guard, gallery deletion on sale),
  `vehicle-document-service.test.ts`, `vehicle-documents.remote.test.ts`,
  `vehicles.remote.test.ts` (history merge, Aufträge tab guards),
  `detail-tabs.test.ts`, `VehicleForm.test.ts`,
  `sale-sign.remote.test.ts`, `e2e/vehicles.spec.ts` (tab/action
  gating, Ankauf modal, archive round trip).
