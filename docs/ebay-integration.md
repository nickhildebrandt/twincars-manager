# eBay Integration for Tires — Deferred Implementation Spec

**Status: NOT IMPLEMENTED.** Deferred by decision on 2026-06-22 until eBay
developer credentials are available. This document is the build spec for a
later work package. Nothing in the codebase implements any of this yet.

## Goal

TwinCast sells tires through a **normal eBay seller account** (not eBay
Kleinanzeigen). After an initial import, the **local TwinCarsManager
database is the leading source**; new tires, edits, prices, images and —
critically — **stock quantities** are pushed from local to eBay. The later
public website lists available tires via the local API but the **purchase
itself happens on eBay** (link out to the matching offer). No own
checkout/payment for the webshop.

## Scope

- **In:** OAuth connect (skippable in setup, completable in settings),
  one-time import of existing eBay listings, ongoing local→eBay sync of
  tires (create/update/price/images/stock), reliable inventory sync,
  surfacing the eBay offer URL on each tire for the website API.
- **Out:** used-car eBay listing (future, separate), own checkout/payment,
  eBay Kleinanzeigen.

## eBay APIs

- **Sell Inventory API** — primary. `inventoryItem` (SKU = tire
  `articleNumber`), `offer`, `publishOffer`. Stock via `availableQuantity`.
- **Sell Feed API** — evaluate for the bulk initial import / large updates
  (`createInventoryTask`, bulk feeds) to avoid per-item rate limits.
- **OAuth 2.0** — user access token (Authorization Code grant) with the
  `sell.inventory` scope; store + refresh tokens server-side.

## Data model (to add later)

```
ebay_credentials        -- single row: client_id ref, refresh_token (encrypted),
                           token_expiry, connected_at, seller_account_label
ebay_listing_links      -- tire_id FK, ebay_sku, ebay_offer_id, ebay_listing_id,
                           ebay_offer_url, last_synced_at, sync_status, sync_error
ebay_sync_log           -- append-only: action, tire_id, direction, status, payload_hash, at
```

Add `tires.ebayOfferUrl` (or derive from `ebay_listing_links`) for the
public API to link the website to the live eBay offer.

## Flows

1. **Connect (settings + skippable setup step):** OAuth redirect → store
   refresh token. Setup wizard gets an optional "eBay verbinden" step that
   can be skipped and completed later under `/settings/ebay`.
2. **Initial import:** on first connect, offer "vorhandene eBay-Listings
   importieren". Pull listings, normalize into local `tires` (size, season,
   load/speed index, EAN, EU label where available), create
   `ebay_listing_links`. After this, local is authoritative.
3. **Outbound sync:** on tire create/update/stock-change, enqueue a sync to
   eBay (Inventory API). Stock changes are highest priority and must be
   reliable (retry with backoff, surface failures in UI).
4. **Identifiers:** use EAN/GTIN/ePID/manufacturerPartNumber for eBay
   catalog matching when present. `tires` already carries `ean`,
   `manufacturerPartNumber`.

## Catalog enrichment (optional, evaluate)

- **EPREL** (EU tire label/efficiency DB) as a supplementary source for
  fuel/wet-grip/noise class when EAN is known.
- Prepare (don't build) a later AI/OCR workflow for tire sidewall
  recognition to speed up data entry.
- **No hard dependency** on any questionable free tire catalog. Local DB is
  the leading source after import.

## Credentials needed before building

- eBay developer account + registered app: **App ID (Client ID)**,
  **Cert ID (Client Secret)**, **Dev ID**, OAuth redirect URI.
- Sandbox credentials for verification, production credentials for go-live.
- These belong in env vars / encrypted settings, never hardcoded.

## Architecture notes for the implementer

- Keep eBay calls in a dedicated `ebay-service.ts` behind a narrow
  interface so it can be mock-tested without live credentials.
- Respect the project's remote-function transport: the OAuth callback is a
  legitimate `+server.ts` exception (third-party plumbing), analogous to
  the better-auth catch-all. Document it as such.
- The 6-hour-style background work this implies needs an external scheduler
  (there is no in-process scheduler) — wire it to the same operator-triggered
  - cron-callable pattern used by reminders.
