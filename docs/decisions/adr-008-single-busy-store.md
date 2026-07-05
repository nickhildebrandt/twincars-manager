---
title: ADR-008 - One global busy store, tiered loading
tags: [adr, ux, loading]
updated: 2026-07-05
---

# ADR-008: Single busy store, three tiers

**Status**: accepted, enforced (CONTRIBUTING §6).

## Context

Early screens each invented loading UI (local flags, spinners,
skeletons, multiple progress bars) - inconsistent and layout-shifting.

## Decision

One store (`busy.svelte.ts`) with `active` (immediate) and `slow`
(>= 250 ms) flags drives exactly three signals: the single header
progress bar, inline button disabling, and the deferred full-area
overlay. All mutations wrap in `busy.run(...)`; navigation flips busy
centrally in the layout. Deletes/status flips are optimistic
(`withOverride`); lists keep `lastResult` so tables never blank.

## Consequences

- Local `let busy = $state(false)`, second progress bars, skeletons and
  layout-shifting loaders are forbidden.
- Fast CRUD (< 250 ms) never flashes an overlay.
- Details: [[loading-and-busy]].
