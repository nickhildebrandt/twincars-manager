---
title: Module - inventory (Zu verkaufende Fahrzeuge)
tags: [module, inventory, used-cars]
updated: 2026-07-07
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
- **Ownership lifecycle** (implemented 2026-07): a vehicle is stock
  when `customerId IS NULL` - that definition drives the list, the
  public API and the inventory picker.
  - **Ankauf in**: either create fresh via `/inventory/new` (stock
    mode of `VehicleForm` with optional Ankaufspreis / Ankaufsdatum
    fields; `createVehicleRemote` writes the `vehicle_purchases` row
    when a `purchaseDate` is sent), or take an existing customer
    vehicle into stock via the Ankauf card on the vehicle detail
    (`purchaseVehicleIntoStockRemote`, guard
    `requirePermission('inventory')` - buying into stock is an
    inventory operation, not master-data editing). The Ankauf re-hangs
    the FK: current holder becomes `previousOwnerCustomerId`, the
    customer link is detached, the history row snapshots the seller's
    display name rename-proof and the brutto price (Paragraph 25a UStG
    differential taxation), and a `sold` listing from an earlier cycle
    reopens as `available`.
  - **Verkauf out**: a sale invoice carries the vehicle as a position
    AND as `documents.vehicleId` (both the `?vehicleId` preload from
    the stock panel and a manually picked vehicle position set the
    document-level link); when that invoice is marked paid,
    `transferStockVehicleOnPayment`
    ([[invoices]]) calls `sellStockVehicleToCustomer`: buyer FK set,
    `vehicle_sales` row with the invoice gross + backlink, listing
    flips to `sold`. Vorbesitzer stays untouched. The transfer is
    idempotent per stock cycle and no-ops for ordinary repair invoices.
- **Special**:
  - One-click "Verkaufsschild" A4 PDF from the detail
    (`sale-sign.remote.ts` in [[vehicles]]): redesigned 2026-07 (red
    header band, logo chip with app-icon fallback, hero price box,
    aligned facts grid, two-column highlights, QR "Online ansehen" -
    [[pdf-pipeline]]); honors `differentialTax`
    ("Differenzbesteuert gem. §25a UStG" vs "inkl. gesetzl. MwSt."),
    "Preis auf Anfrage" without price, "Foto folgt" placeholder.
  - `/inventory/new` offers the optional Vorbesitzer picker
    (`vehicles.previousOwnerCustomerId`, [[vehicles]]).
  - Public surface: `GET /api/public/used-cars` (+ `/[id]`) exposes
    available listings to the website ([[public-rest-api]]).
- **Tests**: covered through `vehicle-service.test.ts` /
  `public-api.test.ts`; no dedicated inventory test file.
