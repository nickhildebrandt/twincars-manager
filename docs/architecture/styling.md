---
title: Styling rules (DaisyUI v5 + Tailwind v4)
tags: [architecture, styling, daisyui, tailwind, a11y, tabs]
updated: 2026-07-10
---

# Styling - DaisyUI v5 + Tailwind v4, no custom CSS

Design language: flat, bordered, low-contrast. Single `corporate` theme,
no dark mode. Icons from `@lucide/svelte` only.
Confirm class names via the DaisyUI Blueprint MCP before writing markup.

## Hard rules

- **No custom CSS**: no `<style>` blocks in `.svelte`, no additions to
  `app.css` beyond Tailwind/DaisyUI directives + the one
  `scrollbar-gutter: stable` rule. Arbitrary-value utilities
  (`[grid-template-columns:...]`) cover rare one-offs.
- **Card baseline** for every content block:
  `<div class="card border border-base-300 bg-base-100"><div class="card-body">...</div></div>`.
  Tables that reach the edge use `card-body p-0`. `EmptyState` is
  borderless (always rendered inside a card).
- **Shell rhythm**: `p-4` main column (`pb-12` bottom), `px-4` header,
  `gap-4` top-level grids - one 1rem rhythm.
- **Forms**: every input/select/textarea/file-input carries `w-full`
  (DaisyUI v5 clamps controls at 20rem otherwise); grid decides the
  width. Labels above inputs.
- **Always-clickable actions**: action buttons are never disabled for
  missing or invalid input; only `busy.active` and true mode gates may
  disable. Validation is click-time with a German error summary
  (`alert alert-error`) + field errors; forms carry `novalidate`
  (CONTRIBUTING §11, [[validation-and-errors]]).
- **Tables**: no zebra. Clickable rows get
  `hover:bg-base-200 cursor-pointer` + `goto()` on the `<tr>`; action
  cells `<td onclick={(e) => e.stopPropagation()}>`; totals in `<tfoot>`
  (`bg-base-200/30 border-t-2 font-semibold`).
- **Pagination**: shared `Pagination` component, symmetric `p-3 sm:p-4`
  ([[adr-003-pagination-fixed-25]]).

## Forbidden

Shadows in the main column (only the ToastTray floats), dashed/dotted
borders, zebra striping, custom rounding (exception: `rounded-md` on the
PdfViewer iframe), header-bar shadow, version footer outside the sidebar,
piling >3 layout utilities onto a DaisyUI component (pick a better
variant instead).

## Accessibility (QA round 3 sweep)

- Every click-time form **error summary carries `role="alert"`** so
  screen readers announce it on render (about 30 forms audited).
- Dialogs use the **native `<dialog>` with `showModal()`**:
  `ConfirmDialog` gets Esc handling, focus trapping and focus return
  for free from the platform - do not rebuild modal semantics with
  divs.
- Icon-only buttons carry `aria-label`s.

## Tabs standard (2026-07, binding)

`src/lib/components/ui/TabGroup.svelte` is the ONE app-wide tab
implementation - the DaisyUI v5 `tabs tabs-lift` radio pattern with a
unique radio name per group, aria-labels, arrow-key switching, `?tab=`
deep links (mirrored via `replaceState`), panels that stay mounted, and
auto-reset when a conditional tab disappears. It has two modes:

- **State mode** (default): bindable active tab id, `?tab=` in the URL.
  Used by detail pages ([[customers]], [[vehicles]], `/orders/[id]`)
  and content areas like `/hours/reports`.
- **Nav mode** (inferred when every tab carries an `href`): tabs are
  routes; the active tab derives from the pathname, selecting
  navigates, and a cancelled navigation (unsaved-changes confirm)
  snaps back. Drives the flat settings layout ([[settings]]).

Rules: **content switching = TabGroup; mutually exclusive list filters
(Alle/Archiv etc.) = simple filter tabs** (deliberately NOT TabGroup).
**No nested tab groups anywhere** - a page has at most one tab level
(the settings flattening removed the last nesting).

## Wording / typography

- UI strings German; no em-dashes or en-dashes in user-visible strings -
  plain hyphens or rewording.

Related: [[loading-and-busy]], [[remote-functions]] (page patterns),
`CONTRIBUTING.md` §7-§10 for the authoritative long form.
