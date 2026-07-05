---
title: Styling rules (DaisyUI v5 + Tailwind v4)
tags: [architecture, styling, daisyui, tailwind]
updated: 2026-07-05
---

# Styling - DaisyUI v5 + Tailwind v4, no custom CSS

Design language: flat, bordered, low-contrast. Single `corporate` theme,
no dark mode. Icons from `@lucide/svelte` only. Charts: Chart.js.
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

## Wording / typography

- UI strings German; no em-dashes or en-dashes in user-visible strings -
  plain hyphens or rewording.
- Settings pages use browser-style attached tabs
  (`tabs tabs-lift` with `<label class="tab">` + `tab-content`), tab
  state mirrored in `?tab=` (see `/settings`).

Related: [[loading-and-busy]], [[remote-functions]] (page patterns),
`CONTRIBUTING.md` §7-§10 for the authoritative long form.
