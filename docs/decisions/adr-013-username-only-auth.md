---
title: ADR-013 - Username-only auth, admin-created accounts
tags: [adr, auth]
updated: 2026-07-05
---

# ADR-013: Username + password only

**Status**: accepted (migration 0010), enforced.

## Context

A handful of workshop employees, no self-service onboarding, some users
without meaningful work email addresses. Email flows (verification,
reset mails) would depend on SMTP being configured and add attack
surface.

## Decision

better-auth with the `username` plugin; `disableSignUp: true`; the
administrator creates every account from `/settings/users` (the first
one in the [[setup]] wizard). better-auth's internal email requirement
is satisfied with a synthesized `<username>@twincars.local` that never
leaves the server. Sessions 7 days with a 5-minute cookie cache;
deactivation re-checks the DB per request to beat that cache. Sign-in
POSTs are IP-rate-limited (10/min).

## Consequences

- Password resets are admin-performed, not self-service.
- No account enumeration on the login form (unknown usernames fall
  through to the generic invalid-credentials error).
- Details: [[auth-and-permissions]].
