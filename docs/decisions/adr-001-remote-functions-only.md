---
title: ADR-001 - Remote functions are the only server transport
tags: [adr, architecture]
updated: 2026-07-05
---

# ADR-001: Remote functions only

**Status**: accepted, enforced (CONTRIBUTING §4).

## Context

SvelteKit offers many data paths (`+page.server.ts` loads, form actions,
`+server.ts` endpoints, custom fetch). Mixing them produces inconsistent
validation, error handling and caching, and the app is maintained by
rotating contributors/agents who need ONE learnable pattern.

## Decision

Enable `kit.experimental.remoteFunctions` and route every app-internal
server interaction through `query`/`command` in `*.remote.ts`. SSR via
top-level `await`; single-flight mutations with optimistic overrides.
Exactly four `+server.ts` exceptions exist, all third-party plumbing or
external consumers ([[remote-functions]]). New exceptions need the same
justification - never convenience.

## Consequences

- Uniform Valibot validation + German error funnel
  ([[validation-and-errors]]) on every server call.
- Experimental APIs force exact version pins
  ([[adr-012-pnpm-and-exact-pins]]) and cause a dev-only hydration
  quirk on async pages ([[known-constraints]]).
- `src/hooks.ts` must exist as an empty transport map.
- External consumers (website, eBay) get dedicated, documented
  endpoints instead of reusing internal ones.
