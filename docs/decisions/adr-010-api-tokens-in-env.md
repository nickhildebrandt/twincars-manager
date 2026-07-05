---
title: ADR-010 - Public API tokens in an env var (no DB, no UI)
tags: [adr, security, api]
updated: 2026-07-05
---

# ADR-010: API tokens from `API_TOKENS`

**Status**: accepted (migration 0025 DROPPED the earlier token table).

## Context

The public REST API needs machine auth for one known consumer (the
website). A DB-backed token system (minting UI, hashing, revocation
lists) is overkill and widens the attack surface.

## Decision

Read Bearer tokens from the `API_TOKENS` env var (comma / newline /
semicolon separated; entries < 8 chars ignored; empty fails closed).
Validity from server start; rotation = config change + restart.
`timingSafeEqual` comparison; downstream code only ever sees the first
8 chars (rate-limit bucket, audit prefix). Per-token 120/min rate limit
after auth.

## Consequences

- No admin UI, no token table, no persistence of secrets in the DB.
- Rotation requires a restart - fine for one consumer.
- Tests stub the env (`vi.stubEnv('API_TOKENS', ...)`).
- Details: [[public-rest-api]], `src/lib/server/api-tokens.ts`.
