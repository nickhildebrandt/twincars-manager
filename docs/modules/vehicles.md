---
title: Module - vehicles (Fahrzeuge)
tags: [module, vehicles]
updated: 2026-07-06
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
    `createVehicleRemote`, `updateVehicleRemote`, `deleteVehicleRemote`,
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
- **Tests**: `vehicle-service.test.ts`, `vehicle-photo-service.test.ts`,
  `vehicle-document-service.test.ts`, `vehicle-documents.remote.test.ts`,
  `VehicleForm.test.ts`, `sale-sign.remote.test.ts`.
