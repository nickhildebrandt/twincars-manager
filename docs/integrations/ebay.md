---
title: Integration - eBay
tags: [integration, ebay, oauth, trading-api]
updated: 2026-07-10
---

# eBay integration (tire sales)

Goal: sell tires through TwinCast's normal eBay seller account with
**bidirectional** sync ([[adr-014-ebay-two-way-sync-deferred]]); the
website links out to the matching eBay offer (no own checkout).
Production keyset: `NickHild-Twincars-PRD-e0ac9b6db-b32dac56`.
Original spec preserved verbatim in `archive/ebay-integration-spec.md`.

## Status (2026-07-10)

- **Phase 0 - compliance endpoint: DONE + live.**
- **Phase 1 - OAuth connect: DONE + deployed.** Waiting on operator to
  (a) save the eBay portal Alerts & Notifications form (endpoint URL +
  verification token) to make the keyset compliant, and (b) click
  "Mit eBay verbinden" on live for the real consent.
- **Phase 2 - listing import: BUILT (2026-07-10), consent still
  pending.** Operator path to the first import: Einstellungen → eBay →
  verbinden → consent → "Angebote importieren".
- **Phase 3 (not built, per ADR)**: bidirectional tire sync (Sell
  Inventory API, SKU = `tires.articleNumber`, stock via
  `availableQuantity`; Feed API for bulk) and listing-tire matching -
  the `ebay_listings.tire_id` FK is prepared but unused.
  Polling/reconciliation must be operator-triggered or external cron
  ([[adr-009-no-in-process-scheduler]]).

## Phase 0 - marketplace account-deletion compliance

`src/routes/api/ebay/account-deletion/` (`endpoint.ts` + `+server.ts`) -
documented `+server.ts` exception #3 ([[remote-functions]]), whitelisted
in hooks (narrow path).

- Challenge GET: respond `200 {"challengeResponse":
hex(sha256(challengeCode + verificationToken + endpointURL))}` -
  concatenation order is mandated and the most fragile fact.
- Notification POST: always acknowledge 200 (fail-open on POST so eBay
  never marks the endpoint down); today processing is a structured log
  line (no per-eBay-user data stored yet).
- Fails closed (503) when `EBAY_VERIFICATION_TOKEN` (32-80 chars,
  `[A-Za-z0-9_-]`) is unset.
- Exposure: registered URL must be HTTPS on port 443 → served on the
  **website vhost** `https://tc.ts13.de/api/ebay/account-deletion` via a
  Caddy `handle` route to the manager container ([[deployment]]).
  `EBAY_DELETION_ENDPOINT_URL` overrides the hash input when it differs
  from ORIGIN + path.

## Phase 1 - OAuth connect

- UI: `/settings/ebay` (connect/disconnect, status card;
  `ebay.remote.ts`, `EbayHost.svelte`).
- Service `src/lib/server/services/ebay-auth-service.ts`:
  - Consent URL `https://auth.ebay.com/oauth2/authorize` with
    `redirect_uri=<RuName>`, scopes `sell.inventory` +
    `commerce.identity.readonly`, HMAC-signed `state` (10-min TTL,
    `createOauthState`/`verifyOauthState`).
  - Exchange/refresh: `POST https://api.ebay.com/identity/v1/oauth2/token`
    with `Basic base64(clientId:certId)`. Access token ~2 h; refresh
    token ~18 months. `getValidAccessToken()` auto-refreshes.
  - `EBAY_ENV=sandbox` switches worlds; tokens never cross environments.
- Callback: `src/routes/api/ebay/oauth/callback/` - exception #4,
  session-gated (NOT whitelisted); all outcomes redirect to
  `/settings/ebay?connected=1|error=declined|state|exchange`, details
  logged server-side only.
- Storage: single-row `ebay_credentials`; tokens AES-256-GCM encrypted
  (`$lib/server/crypto`, key `APP_ENCRYPTION_KEY` → fallback
  `APP_SECRET`, wire format `v1:iv:tag:data`) -
  [[adr-005-encryption-scope]]. Migration 0030.
- Hydration hardening: the page's one-shot OAuth flag handling uses
  deferred `onMount` + `window.location` so the dev-only hydration
  recovery cannot double-fire it ([[known-constraints]]).

## Phase 2 - Trading API listing import (built 2026-07-10)

Listings created in the eBay web UI are NOT visible to the Inventory
API - the initial import therefore uses the legacy **Trading API**
(`GetMyeBaySelling`, XML, site 77/Germany, paginated), authenticated
with the Phase-1 OAuth token (auto-refresh via `ebay-auth-service`).

- Service `src/lib/server/services/ebay-listing-service.ts`:
  - `importEbayListings(transport?)` - the transport
    (`EbayTradingTransport`) is **injectable**, so tests mock the HTTP
    layer; no live calls in the suite.
  - **Idempotent sync** keyed on `(environment, ebay_item_id)`: re-runs
    update rows in place; listings that vanish from the seller account
    flip to `status='ended'` (never deleted) and **revive** to
    `active` when they reappear.
  - `listEbayListings({ q, page, size, status? })`,
    `getEbayImportInfo()` (last-run summary + aktiv/gesamt counts).
  - Every failure class maps to a fixed German message
    (`EBAY_IMPORT_ERRORS`): not connected, expired/revoked token,
    refresh failure, unreachable/timeout, rejected request, malformed
    response. **Token material never reaches logs or clients.**
- Tables (migration 0036, [[database-schema]]): `ebay_listings`
  (item id, SKU, title, price, quantities, listing type, status
  active|ended, URLs, picture URLs jsonb, start/end time, environment,
  optional `tire_id` FK for Phase 3) and `ebay_import_runs`
  (append-only run log storing only curated German errors; the newest
  row backs the "last sync" info).
- UI `/settings/ebay`: import card (always clickable, last-run summary,
  aktiv/gesamt badge, button "Angebote importieren") + a paginated,
  searchable listings table (25/page, Aktiv/Beendet filter, row click
  opens the eBay offer in a new tab).
- Remotes `ebay.remote.ts`: `listEbayListingsRemote`,
  `getEbayImportInfoRemote`, `importEbayListingsRemote` (all
  `requirePermission('settings')`).

## Env vars (production: `/etc/twincars/env/manager.env`)

`EBAY_CLIENT_ID`, `EBAY_CERT_ID`, `EBAY_DEV_ID` (set on the server;
not read by current code), `EBAY_RU_NAME`
(`Nick_Hildebrand-NickHild-Twinca-lvhtcwtub`),
`EBAY_VERIFICATION_TOKEN`, `EBAY_DELETION_ENDPOINT_URL`
(`https://tc.ts13.de/api/ebay/account-deletion`), optional `EBAY_ENV`.
See [[environment-variables]].

## Import-time customer detection (separate concern)

The Kfz-Kaufmann import classifies customers whose name fields contain
"ebay" as `kind='ebay'` via `src/lib/utils/ebay-detection.ts` - a pure
import-time rule, unrelated to this API integration
([[kfz-kaufmann-import]]).

## Tests

`ebay-auth-service.test.ts`, `ebay-listing-service.test.ts` (mocked
transport: pagination, ended/revive, error map), `crypto.test.ts`,
`api/ebay/account-deletion/endpoint.test.ts`,
`api/ebay/oauth/callback/endpoint.test.ts`, `ebay.remote.test.ts`,
`ebay-page.test.ts`; `e2e/settings.spec.ts` covers the disconnected
path.

## Catalog enrichment (future, optional)

EPREL lookup by EAN for EU-label fields; AI/OCR sidewall recognition -
prepared, not built.
