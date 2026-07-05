---
title: ADR-005 - Encryption scope (what is and is not encrypted)
tags: [adr, security, crypto]
updated: 2026-07-05
---

# ADR-005: Encryption scope

**Status**: accepted (shipped with eBay Phase 1, migration 0030).

## Context

The app stores several kinds of secrets with different threat models:
session integrity, user passwords, third-party credentials that must be
readable back, and SMTP credentials.

## Decision

- **`APP_SECRET`** = HMAC signing for better-auth session cookies only.
  It is NOT a data-encryption key by role (but serves as the dev
  fallback below).
- **User passwords**: bcrypt hashes via better-auth
  (`accounts.password`) - never reversible.
- **Third-party credentials that must be read back** (currently eBay
  OAuth access/refresh tokens): AES-256-GCM at rest via
  `src/lib/server/crypto.ts`. Key = SHA-256 of `APP_ENCRYPTION_KEY`
  (generated once by provisioning) falling back to `APP_SECRET`; wire
  format `v1:<b64 iv>:<b64 tag>:<b64 data>` (versioned for future
  migration). Fresh random IV per encryption; GCM tag detects
  tampering.
- **Not encrypted (deliberate/known)**: `smtp_settings.password` is
  plaintext (needed for SMTP auth round-trips; encrypting it with the
  same helper is an open security-backlog item), inline images/PDFs,
  business data.

## Consequences

- Losing `APP_ENCRYPTION_KEY` invalidates stored eBay tokens
  (re-connect required) but nothing else.
- New reversible secrets MUST use `encryptSecret`/`decryptSecret`,
  never plaintext columns. See [[ebay]], [[environment-variables]].
