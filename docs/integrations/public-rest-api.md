---
title: Integration - public REST API
tags: [integration, api, website]
updated: 2026-07-05
---

# Public REST API (`/api/public/*`)

External read/write surface for the marketing website - documented
`+server.ts` exception #2 ([[remote-functions]]). Each endpoint splits
its testable handler into `endpoint.ts` next to `+server.ts` and is
wrapped in `publicApi(...)` from `src/lib/server/public-api.ts`.

## Authentication and limits

- **Bearer tokens from the `API_TOKENS` env var**
  ([[adr-010-api-tokens-in-env]]): comma/newline/semicolon separated,
  entries < 8 chars ignored, empty/unset fails closed (every request
  401). `src/lib/server/api-tokens.ts` compares with `timingSafeEqual`
  and exposes only an 8-char prefix downstream (rate-limit bucket key +
  audit). Rotation = config change + restart; no admin UI, no DB table
  (dropped in migration 0025).
- Per-token rate limit 120/min AFTER successful auth (429 +
  Retry-After). Sign-in throttling is separate
  ([[auth-and-permissions]]).
- `OPTIONS` bypasses auth (CORS preflight); responses carry CORS
  headers. Envelope: `{ data }` on success,
  `{ error: { code, message } }` on failure (error messages English -
  consumer-facing API, not end-user UI).

## Endpoints (all under `/api/public`)

| Method + path                           | Purpose                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/used-cars`, GET `/used-cars/[id]` | available stock vehicles ([[inventory]]) with photos                                                                                                          |
| GET `/tires`, GET `/tires/[id]`         | `onlineSellable` tires ([[tires]]); detail caps at 7 photos                                                                                                   |
| GET `/services`, GET `/services/[id]`   | `kind='service'` items; projection includes `onlineBookable`                                                                                                  |
| GET `/free-slots`                       | bookable slots from `workshop_hours` minus closures; rejects non-bookable services                                                                            |
| POST `/appointments`                    | online booking - REQUIRES a serviceId referencing an `onlineBookable` service (tire change); others get "arrange by phone" rejection; sends confirmation mail |
| POST `/orders`                          | shop orders (tires)                                                                                                                                           |
| POST `/contact`                         | contact form → `customer_inquiries` row FIRST, then internal notification mail (SMTP outage never loses the inquiry; retry from `/settings/inquiries`)        |
| GET `/company`                          | company card incl. geo coordinates for a map widget                                                                                                           |
| GET `/posts`, GET `/posts/[slug]`       | published news, paginated, newest first; drafts 404 ([[posts]])                                                                                               |

Handlers delegate to `public-api-service.ts` (projections that never
leak internal fields).

Note: the `/orders` body no longer accepts `shippingOptionId` (unknown
keys are silently stripped, so legacy clients keep working), and the
response field `shippingNet` is always the JSON number `0` for wire
compatibility.

## Testing convention

Stub the token env with `vi.stubEnv('API_TOKENS', '<token>')` in
`beforeAll` and `vi.unstubAllEnvs()` in `afterAll`. Suites:
`api-tokens.test.ts`, `public-api-service.test.ts`,
`routes/api/public/public-api.test.ts`,
`public-api-security.test.ts`.
