---
title: Loading tiers and the busy store
tags: [architecture, ux, loading]
updated: 2026-07-05
---

# Loading - one global `busy` store, three signals

`src/lib/stores/busy.svelte.ts` is the single source of truth
([[adr-008-single-busy-store]]). Two reactive flags:

| Flag          | Meaning                          | Drives                                                                                                                  |
| ------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `busy.active` | >= 1 operation running           | thin progress bar in the AppShell header (the ONLY bar in the app) + inline button disabling/spinners                   |
| `busy.slow`   | >= 1 operation running >= 250 ms | full-area overlay over the main slot (`Loader variant="overlay"`, aria-busy/inert; sidebar and header stay interactive) |

Usage: `await busy.run(() => mutation(...))` (preferred) or paired
`const end = busy.begin(); try {...} finally { end() }` (used only for
`beforeNavigate`/`afterNavigate` in `+layout.svelte`, so every route
change flips the busy state).

## Rules

- Never a local `let busy = $state(false)`.
- Never a second progress bar anywhere (tables, cards, dialogs).
- Loading UI must never shift layout (the header bar overlays the
  header's border-b and reserves no flow space).
- No skeleton/loader swaps on detail pages - top-level `await` + the
  global tiers handle it.
- Loader label wording: "Inhalte werden geladen".
- `Loader` variants: `block` (picker dialogs), `inline`, `overlay`
  (AppShell only). There is intentionally no `bar` variant.

## Optimistic updates

Deletes and status flips use single-flight
`mutation.updates(listQuery.withOverride(current => ...))` so the row
vanishes immediately and the same response carries the authoritative
refresh. Always pass the exact filter/page combination currently
rendered.

## Stale-while-revalidate

List pages keep `lastResult` (`query.current ?? lastResult`) so filter /
pagination changes never blank the table; the header bar signals the
refetch.

## Unsaved-changes guard

`$lib/stores/form-dirty.svelte`: forms set `formDirty` via root
`oninput`/`onchange` handlers; the AppShell's `beforeNavigate` +
`beforeunload` prompt only with real unsaved edits. Call
`formDirty.clear()` before the post-save `goto`.

Related: [[remote-functions]], [[adr-003-pagination-fixed-25]], [[styling]].
