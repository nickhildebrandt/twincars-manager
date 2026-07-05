# eBay Integration for Tires — Implementation Spec

**Status: IN PROGRESS (started 2026-06-23).** Production keyset exists
(`NickHild-Twincars-PRD-…`). Phase 0 (marketplace-account-deletion
compliance endpoint — the production-keyset activation gate) is
implemented at `/api/ebay/account-deletion`. OAuth connect + sync are the
next phases.

## Phase 0 — Compliance / keyset activation (implemented)

eBay blocks a new production keyset entirely ("Non Compliant", no API or
OAuth calls possible) until the app either subscribes to **Marketplace
Account Deletion notifications** or claims a no-data-persistence
exemption. Because this app will persist users' OAuth tokens and listing
data, the exemption does not apply — the endpoint is mandatory.

Facts confirmed against official docs (2026-06):

- Challenge: eBay sends `GET <endpoint>?challenge_code=…`; the response
  must be `200`, `Content-Type: application/json`, body
  `{"challengeResponse": hex(sha256(challengeCode + verificationToken +
endpointURL))}` — concatenated in exactly that order, hex not base64,
  no BOM.
- Verification token: 32–80 chars, `[A-Za-z0-9_-]` only.
- Notifications: `POST` JSON (`metadata.topic =
MARKETPLACE_ACCOUNT_DELETION`, `notification.data.username/userId/
eiasToken`), must be acknowledged immediately with 200/201/202/204.
  24 h unacknowledged → endpoint marked down + alert email; 30 days
  unfixed → developer non-compliant.
- The registered URL must be HTTPS, no localhost/internal IP, no query
  string; **only port 443 is evidenced to work** (docs are silent on
  ports; community reports with custom ports failed). The OAuth
  accept/decline URLs, by contrast, explicitly allow any SSL port
  (eBay KB 612).
- Signature validation of `X-EBAY-SIGNATURE` (ECDSA via Notification API
  `getPublicKey`) is recommended but not the compliance gate — wire it
  when the token store lands and real data deletion happens.

Deployment shape: the manager listens behind `tc.ts13.de:5443`, so the
endpoint is exposed on the **website vhost (port 443)** and routed to the
manager container by Caddy (`handle /api/ebay/account-deletion*` →
`localhost:3000`). Env on the manager:

```
EBAY_VERIFICATION_TOKEN=<32–80 chars, also entered in the portal>
EBAY_DELETION_ENDPOINT_URL=https://tc.ts13.de/api/ebay/account-deletion
```

Portal steps (Alerts & Notifications → Production → Marketplace Account
Deletion): enter alert email, the endpoint URL above, and the same
verification token → Save. eBay fires the challenge immediately; on
success the keyset becomes compliant/active.

## Phase 1 — OAuth connect (next)

Portal prerequisite: create the production **RuName** under Application
Keys → "User Tokens" → "Get a Token from eBay via Your Application" →
add a Redirect URL with display title, privacy-policy URL (public
HTTPS), auth-accepted URL (`https://tc.ts13.de:5443/api/ebay/oauth/callback`
— any SSL port allowed), auth-declined URL. Needed in env afterwards:
`EBAY_CLIENT_ID`, `EBAY_CERT_ID` (client secret), `EBAY_RU_NAME`.

Flow facts (confirmed 2026-06): consent URL
`https://auth.ebay.com/oauth2/authorize?client_id=…&redirect_uri=<RuName>
&response_type=code&scope=…&state=…&locale=de-DE`; the accepted URL
receives `code` (single-use, ~5 min) + `state`. Token exchange: `POST
https://api.ebay.com/identity/v1/oauth2/token` with
`Basic base64(client_id:cert_id)`, `grant_type=authorization_code`.
Access token 2 h; refresh token ~18 months (no new refresh token on
refresh; auto-revoked if the seller changes username/password). Scope
`https://api.ebay.com/oauth/api_scope/sell.inventory` covers the entire
Inventory API read+write+publish surface.

Note for the initial import: listings created outside the Inventory API
(eBay web UI) are NOT returned by it — read them via the Trading API
(`GetMyeBaySelling`, same user token in the `X-EBAY-API-IAF-TOKEN`
header, no scopes) or migrate them with `bulkMigrateListing`.

## Goal

TwinCast sells tires through a **normal eBay seller account** (not eBay
Kleinanzeigen). After an initial import, the **local TwinCarsManager
database is the leading source**; new tires, edits, prices, images and —
critically — **stock quantities** are pushed from local to eBay. The later
public website lists available tires via the local API but the **purchase
itself happens on eBay** (link out to the matching offer). No own
checkout/payment for the webshop.

## Scope

- **In:** OAuth connect (completable in settings), one-time import of
  existing eBay listings, ongoing **bidirectional** sync of tires
  (create/update/price/images/stock): local changes push to eBay, and
  eBay-side changes (sales reducing quantity, edits, ended listings)
  flow back — via Platform Notifications where available plus periodic
  reconciliation polling (there is no in-process scheduler; polling is
  operator-triggered / external-cron like the reminder jobs). Conflict
  rule to be decided in the Phase-2 design (requirement updated
  2026-06-23: user asked for two-way sync, superseding the earlier
  "local is leading after import" simplification). Surfacing the eBay
  offer URL on each tire for the website API.
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
