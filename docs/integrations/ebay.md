---
title: Integration - eBay
tags: [integration, ebay, oauth]
updated: 2026-07-05
---

# eBay integration (tire sales)

Goal: sell tires through TwinCast's normal eBay seller account with
**bidirectional** sync ([[adr-014-ebay-two-way-sync-deferred]]); the
website links out to the matching eBay offer (no own checkout).
Production keyset: `NickHild-Twincars-PRD-e0ac9b6db-b32dac56`.
Original spec preserved verbatim in `archive/ebay-integration-spec.md`.

## Status (2026-07-05)

- **Phase 0 - compliance endpoint: DONE + live.**
- **Phase 1 - OAuth connect: DONE + deployed.** Waiting on operator to
  (a) save the eBay portal Alerts & Notifications form (endpoint URL +
  verification token) to make the keyset compliant, and (b) click
  "Mit eBay verbinden" on live for the real consent.
- **Next phases (not built)**: initial listing import (Trading API
  `GetMyeBaySelling` / `bulkMigrateListing` - listings created in the
  eBay web UI are NOT visible to the Inventory API), then two-way tire
  sync (Sell Inventory API, SKU = `tires.articleNumber`, stock via
  `availableQuantity`; Feed API for bulk). Planned tables from the spec:
  `ebay_listing_links`, `ebay_sync_log`. Polling/reconciliation must be
  operator-triggered or external cron
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

## Env vars (production: `/etc/twincars/env/manager.env`)

`EBAY_CLIENT_ID`, `EBAY_CERT_ID`, `EBAY_DEV_ID` (set on the server;
not read by current code), `EBAY_RU_NAME`
(`Nick_Hildebrand-NickHild-Twinca-lvhtcwtub`),
`EBAY_VERIFICATION_TOKEN`, `EBAY_DELETION_ENDPOINT_URL`
(`https://tc.ts13.de/api/ebay/account-deletion`), optional `EBAY_ENV`.
See [[environment-variables]].

## Tests

`ebay-auth-service.test.ts`, `crypto.test.ts`,
`api/ebay/account-deletion/endpoint.test.ts`,
`api/ebay/oauth/callback/endpoint.test.ts`, `ebay.remote.test.ts`,
`ebay-page.test.ts` (~35 eBay + 7 crypto tests). Headless E2E against
the production build verified the consent URL and forged-state
rejection.

## Catalog enrichment (future, optional)

EPREL lookup by EAN for EU-label fields; AI/OCR sidewall recognition -
prepared, not built.
