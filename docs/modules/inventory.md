---
title: Module - inventory (Zu verkaufende Fahrzeuge)
tags: [module, inventory, used-cars]
updated: 2026-07-05
---

# inventory - "Zu verkaufende Fahrzeuge"

- **Purpose**: the used-car stock view over [[vehicles]] - purchase,
  listing (price, status, equipment, `differentialTax`), sale.
- **Routes**: `/inventory` (list), `/inventory/new` (take a vehicle into
  stock). Detail lives on the vehicle: `getInventoryVehicleRemote`
  backs the stock panel of the vehicle detail page.
- **Remote** `inventory.remote.ts`: `listInventoryRemote`,
  `getInventoryVehicleRemote`. Guard `requirePermission('inventory')`.
- **Tables**: `vehicle_purchases`, `vehicle_listings`
  (status default `available`, `salesPriceGross`, `differentialTax`,
  `highlights`, `equipment` jsonb, `location`), `vehicle_sales`
  (customer FK restrict, `tradeInValue`), `vehicle_photos`.
- **Special**:
  - One-click "Verkaufsschild" A4 PDF from the detail
    (`sale-sign.remote.ts` in [[vehicles]]): honors `differentialTax`
    ("Differenzbesteuert gem. §25a UStG" vs "inkl. gesetzl. MwSt."),
    "Preis auf Anfrage" without price, "Foto folgt" placeholder.
  - Public surface: `GET /api/public/used-cars` (+ `/[id]`) exposes
    available listings to the website ([[public-rest-api]]).
- **Tests**: covered through `vehicle-service.test.ts` /
  `public-api.test.ts`; no dedicated inventory test file.
