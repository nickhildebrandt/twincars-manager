---
title: ADR-012 - pnpm via corepack + exact pins for experimental framework deps
tags: [adr, tooling, dependencies]
updated: 2026-07-05
---

# ADR-012: pnpm + exact version pins

**Status**: accepted (production-plan P1.0), enforced.

## Context

The app leans on EXPERIMENTAL SvelteKit APIs (remote functions, async
components) whose behavior changes between minor releases; npm's
lockfile had also drifted (legacy-peer-deps).

## Decision

- Package manager: **pnpm**, activated via corepack and pinned with
  `packageManager: pnpm@11.8.0`. `pnpm-lock.yaml` is the only lockfile;
  `package-lock.json` must never reappear (`npm install` is forbidden).
- `pnpm-workspace.yaml` carries the esbuild build-script approval.
- `@sveltejs/kit`, `svelte`, `@testing-library/svelte` pinned **exact**
  (2.58.0 / 5.55.5 / 5.3.1 as of writing). Bumps are deliberate:
  `pnpm check && pnpm test && pnpm build` afterwards.
- Dockerfile: `corepack enable`, `pnpm install --frozen-lockfile`,
  `pnpm prune --prod --ignore-scripts` ([[known-constraints]]).

## Consequences

- No blind `^` floats can break remote functions.
- Contributors must use pnpm commands (`pnpm exec <bin>`).
- Details: [[dev-environment]], [[known-constraints]].
