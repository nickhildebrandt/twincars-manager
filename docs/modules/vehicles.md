---
title: Module - vehicles (Fahrzeuge)
tags: [module, vehicles]
updated: 2026-07-05
---

# vehicles - "Fahrzeuge"

Canonical template module (with [[customers]]).

- **Purpose**: vehicle master data for customer AND stock vehicles,
  photos, license-plate history, sale sign.
- **Routes**: `/vehicles`, `/vehicles/new`, `/vehicles/[id]`,
  `/vehicles/[id]/edit`.
- **Remotes**:
  - `vehicles.remote.ts`: `listVehiclesRemote`, `getVehicleRemote`,
    `countVehiclesRemote`, `getVehicleRelatedRemote`,
    `createVehicleRemote`, `updateVehicleRemote`, `deleteVehicleRemote`,
    `listVehiclePhotosRemote`, `addVehiclePhotoRemote`,
    `deleteVehiclePhotoRemote`, `setMainVehiclePhotoRemote`.
  - `sale-sign.remote.ts`: renders the "Verkaufsschild" PDF
    (`renderVehicleSaleSignPdf`, [[pdf-pipeline]]).
- **Services**: `vehicle-service.ts` (incl.
  `getEffectiveLicensePlate(vehicleId, dateIso)`),
  `vehicle-photo-service.ts`.
- **Tables**: `vehicles`, `vehicle_license_plate_versions`,
  `vehicle_photos`; stock extras `vehicle_purchases`, `vehicle_listings`,
  `vehicle_sales` (surfaced by [[inventory]]).
- **Special**:
  - License plates are versioned; documents reference the vehicle, not a
    plate, so plate changes never rewrite history
    ([[adr-007-price-snapshots-and-versions]] pattern).
  - Detail page renders document statuses through
    `documentStatusLabel()`/`documentStatusBadge()` (never raw enums).
  - Vehicle photos: base64 data URLs, `isMain` + `sortOrder`.
  - Guard `requirePermission('vehicles')`.
- **Picker**: `pickVehiclesRemote`, `pickInventoryVehiclesRemote`.
- **Tests**: `vehicle-service.test.ts`, `vehicle-photo-service.test.ts`,
  `VehicleForm.test.ts`, `sale-sign.remote.test.ts`.
