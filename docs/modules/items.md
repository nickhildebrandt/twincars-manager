---
title: Module - items (Leistungen, Material, Artikel)
tags: [module, items, catalog]
updated: 2026-07-05
---

# items - "Leistungen, Material, Artikel"

- **Purpose**: the service/article catalog used to build document
  positions; versioned sales prices; QR labels; online-bookable services.
- **Routes**: `/items`, `/items/new`, `/items/[id]`, `/items/[id]/edit`.
- **Remotes**:
  - `items.remote.ts`: `listItemsRemote`, `getItemRemote`,
    `getItemPriceHistoryRemote`, `createItemRemote`, `updateItemRemote`,
    `deleteItemRemote`.
  - `labels.remote.ts`: `getArticleLabelPdfRemote` - A6 QR label, QR
    payload `{origin}/items/<articleNumber>` ([[pdf-pipeline]]).
  - Guard `requirePermission('items')`.
- **Service**: `item-service.ts` - the ONLY price read paths are
  `getCurrentItemPrice(itemId)` and `getItemPriceAt(itemId, dateIso)`.
- **Tables**: `items`, `item_price_versions`.
- **Special**:
  - `kind`: `service` | `material` | `article` (+ Durchlaufposten label
    via `itemKindLabel()` - detail pages never render raw enums).
  - `onlineBookable` (migration 0028): only services flagged here are
    bookable through the public appointment API - TwinCast restricts
    this to tire-change services ([[public-rest-api]]).
  - No `discontinued` / `stockMin` / `stockMax` since migration 0026
    ([[adr-016-shop-refocus]]); `stockOnHand` remains.
  - Document positions snapshot the price - editing an item never
    touches existing documents
    ([[adr-007-price-snapshots-and-versions]]).
- **Picker**: `pickItemsRemote` (returns price extras for pre-fill).
- **Tests**: `item-service.test.ts`, `ItemForm.test.ts`,
  `labels.remote.test.ts`.
