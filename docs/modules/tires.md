---
title: Module - tires (Reifenkatalog)
tags: [module, tires, catalog]
updated: 2026-07-05
---

# tires - "Reifenkatalog"

- **Purpose**: dedicated tire SKU catalog (the workshop's only physical
  product line) with EU-label data, versioned prices, photos, shop
  visibility.
- **Routes**: `/tires`, `/tires/new`, `/tires/[id]`, `/tires/[id]/edit`.
- **Remote** `tires.remote.ts`: `listTiresRemote`, `getTireRemote`,
  `getTirePriceHistoryRemote`, `createTireRemote`, `updateTireRemote`,
  `deleteTireRemote`, `upsertTirePriceRemote`, `listTirePhotosRemote`,
  `addTirePhotoRemote`, `setMainTirePhotoRemote`,
  `deleteTirePhotoRemote`. Guard `requirePermission('tires')`.
- **Service**: `tire-service.ts`.
- **Tables**: `tires`, `tire_price_versions`, `tire_photos` (public
  projection caps at the first 7 photos).
- **Special**:
  - Size as typed columns (`width`/`aspectRatio`/`diameterInch`,
    `construction` R|D), season German values
    `Sommer`|`Winter`|`Ganzjahres`, EU label fields, EAN +
    `manufacturerPartNumber` (also the future eBay catalog identifiers).
  - `onlineSellable` is the single public/shop gate
    ([[adr-016-shop-refocus]]); `stockOnHand` kept for the future eBay
    sync ([[ebay]]).
  - `shippingOptionId` links a shipping option for shop orders.
  - Document positions can back-link via `document_items.tireId`.
  - Retired tires are deleted, not flagged.
- **Public surface**: `GET /api/public/tires` (+ `/[id]`)
  ([[public-rest-api]]); tire-change reminders and storage live in
  [[tire-storage]].
- **Picker**: `pickTiresRemote`.
- **Tests**: `tire-service.test.ts`, `TireForm.test.ts`.
