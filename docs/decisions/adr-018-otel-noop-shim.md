---
title: ADR-018 - OpenTelemetry no-op shim for better-auth
tags: [adr, build, dependencies]
updated: 2026-07-05
---

# ADR-018: Alias @opentelemetry/api to an inert shim

**Status**: accepted (commit d19dc10, found during the 2026-06-22
production deploy).

## Context

better-auth >= 1.6 wraps every dispatch in `withSpan` from
`@opentelemetry/api`. Rollup's CJS interop can bundle that package into
a default-only namespace where the named `trace` export is undefined -
in the production container this crashed EVERY request with a getTracer 500. The app does not use OpenTelemetry at all.

## Decision

`vite.config.ts` aliases `@opentelemetry/api` to
`src/lib/server/otel-noop.ts`, a deterministic no-op implementation of
the tracing surface better-auth touches.

## Consequences

- Tracing is a no-op everywhere; if real observability is ever wanted,
  remove the alias and validate the production bundle explicitly
  (repeated request smoke test against the built server).
- Any dependency bump of better-auth should re-check whether the shim
  still covers its usage. See [[known-constraints]].
