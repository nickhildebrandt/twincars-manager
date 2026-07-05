# Contributing to TwinCarsManager

These are the binding technical guidelines for this project. Every change —
new features, bug fixes, refactors — has to follow them. The goal is one
coherent, lightweight, maintainable application that non-technical users can
operate confidently.

If something here conflicts with code you find in the repo, **the guideline
wins**: align the code, do not weaken the guideline.

---

## 1. Mission and audience

- TwinCarsManager is a lightweight, end-to-end management app for one small
  Kfz / tyre / used-car business. It is the successor to a legacy Access
  ("Kfz-Kaufmann") database.
- The primary users are **not technical**. The UI must feel calm, obvious,
  fast, and trustworthy — like a finished business application, never like a
  prototype.
- Prefer clarity and predictability over cleverness. If a screen needs a
  manual to be operated, it is wrong.

## 2. Tech stack (binding)

| Layer            | Choice                                                     |
| ---------------- | ---------------------------------------------------------- |
| Framework        | **SvelteKit** (Svelte 5 + Runes)                           |
| Language         | **TypeScript** — `.ts` / `.svelte` only                    |
| Server transport | **Remote functions** (`*.remote.ts`) — `query` / `command` |
| Validation       | **Valibot**                                                |
| Database         | **PostgreSQL** + **Drizzle ORM**                           |
| Styling          | **DaisyUI v5** + **Tailwind v4** (no custom CSS)           |
| Icons            | **`@lucide/svelte`**                                       |
| Charts           | **Chart.js**                                               |
| PDF              | **pdf-lib** (create) + **pdfjs-dist** (preview)            |
| Mail             | **nodemailer** (SMTP only)                                 |
| Adapter          | **`@sveltejs/adapter-node`**                               |
| Tests            | **Vitest** + **`@testing-library/svelte`**                 |
| Format           | **Prettier** + **Husky** + **lint-staged**                 |
| Package manager  | **pnpm** (via corepack, pinned in `packageManager`)        |

Languages: **all code, comments, JSDoc, identifiers and commit messages are
in English. The user-facing UI is in German.**

### Package manager (pnpm, binding)

The project uses **pnpm**, activated through corepack and pinned by the
`packageManager` field in `package.json` — do not run `npm install` /
`npm ci` (they would regenerate a `package-lock.json`, which is **not**
committed). Use `pnpm install`, `pnpm <script>`, `pnpm exec <bin>`.

- `pnpm-lock.yaml` is the single committed lockfile. `pnpm-workspace.yaml`
  carries build-script approvals (`allowBuilds: esbuild: true` — esbuild
  ships a platform binary that vite/vitest need).
- Framework packages whose **experimental** APIs change between minors
  (`@sveltejs/kit`, `svelte`, `@testing-library/svelte`) are **pinned to
  exact versions**, not caret ranges — the remote-functions / runes APIs
  are not yet stable across minors. Bump them deliberately, never via a
  blind `^` float, and re-run `pnpm check && pnpm test && pnpm build`.
- The Dockerfile uses `corepack enable` + `pnpm install --frozen-lockfile`
  then `pnpm prune --prod`. `.npmrc` is gitignored / local-only and is
  intentionally not part of the build context.

## 3. Library policy

- Reach for an established, stable, popular library before writing your own
  abstraction.
- Prefer libraries that fit the Svelte / SvelteKit ecosystem.
- Prefer small, single-purpose packages over framework kits.
- Watch bundle size — every new dependency must justify the bytes it costs.
- Do not reinvent something that already exists in DaisyUI / Tailwind /
  date-fns / valibot / drizzle / etc.

## 4. SvelteKit strategy

- **Remote functions are the only way to talk to the server.** No custom
  REST endpoints, no `+page.server.ts` actions, no `+server.ts` handlers,
  no `use:enhance` shortcuts. The experimental flag is on
  (`kit.experimental.remoteFunctions = true`); we treat it as the default.
  Documented `+server.ts` exceptions (third-party plumbing / external
  consumers only): the better-auth catch-all (`/api/auth/[...all]`), the
  Bearer-token public REST API (`/api/public/*`), and the eBay
  marketplace-account-deletion compliance endpoint
  (`/api/ebay/account-deletion` — eBay's servers call it directly with a
  challenge handshake; configured via `EBAY_VERIFICATION_TOKEN`).
- **No legacy load patterns.** Do not use `+layout.server.ts` /
  `+page.server.ts` to ship data into pages. Anything the server provides
  goes through a remote `query()`.
- **Initial render is server-side.** Pages call their remote queries with
  top-level `await`; SvelteKit suspends the component, runs the query
  in-process, and flushes complete HTML on the first byte.
- **After hydration, the app is a SPA.** Client-side navigation, the
  dehydrated query cache, no full reloads.
- Use the modern **`await` + `<svelte:boundary>`** patterns wherever they
  improve clarity (e.g. opt-in pending UIs, error containment).
- All mutations are `command()` calls. Use **single-flight mutations** with
  `requested(listX, N).refreshAll()` on the server and
  `await mutate(...).updates(listX)` on the client so writes return with the
  refreshed list inside the same response.

### Remote function file layout

```ts
// src/routes/<module>/<module>.remote.ts
import { command, query, requested } from '$app/server'
import { object, ... } from 'valibot'

export const listXRemote = query(listSchema, async (params) => { ... })
export const getXRemote  = query(idSchema, async ({ id }) => { ... })
export const createXRemote = command(inputSchema, async (input) => {
  const row = await createX(input)
  await requested(listXRemote, 4).refreshAll()
  return row
})
```

JSDoc every export with `@group integration` and `@module <name>`.

### Authorization (per-module, binding)

The permission model is intentionally simple: **one key per module** — a
user either has access to a module or not, and if they do they can do
everything in it. There is **no** `:read` / `:write` / `:delete` split.

- Canonical keys live in `src/lib/permissions.ts` (`MODULE_PERMISSIONS`):
  `customers`, `vehicles`, `suppliers`, `employees`, `items`, `offers`,
  `invoices`, `reminders`, `ledger`, `calendar`, `inventory`, `hours`,
  `mailings`, `import`, `settings`, `users`, `tires`, `shipping`. The
  wildcard `*` grants everything (seeded "Administrator" role).
- **The one exception is `hours:write_own`** — a self-service grant that
  lets an employee log only their **own** time entries. So `hours` has two
  levels: full (`hours`) or self-service (`hours:write_own`). Do not add
  further sub-keys to any module without the same level of justification.
- **Every** `query` / `command` body starts with a guard as its first
  statement: `requireUser()`, `requirePermission('<module>')`, or
  `requireAnyPermission('<module>', …)` from `auth-guards.ts`. The hours
  remotes use `requireAnyPermission('hours', 'hours:write_own')` and scope
  the result set when only the self-service key is held.
- Seeded roles (`seed-defaults.ts`): **Administrator** (`*`),
  **Werkstattleiter** (every module except `settings` / `users`),
  **Mitarbeiter** (operational modules + `hours:write_own`).
- Sidebar items carry a single `permission` key in `navigation.ts`;
  `filterNavigationByPermissions` drops items + empty groups.
- **Account deactivation:** `users.active` gates sign-in. A deactivated
  account is rejected at the sign-in POST (`blockDeactivatedSignIn` in
  `hooks.server.ts`, clean German error on the login form) and on every
  request (`populateAuthLocals` re-checks `active` against the DB so the
  lockout beats the 5-minute session-cookie cache). Deactivating also
  deletes the user's sessions (`deleteUserSessions`). The last account
  holding the wildcard `*` cannot be deactivated or deleted.

## 5. Page patterns

### List pages (paginated)

```svelte
<script lang="ts">
  import { untrack } from 'svelte'

  let pageNum = $state(1)
  const size = 25
  let q = $state('')

  const query = $derived(
    listXRemote({ page: pageNum, size, q: q || undefined })
  )
  const initial = await untrack(() => query) // SSR seed
  let lastResult = $state<typeof initial>(initial) // bridge across param changes
  $effect(() => {
    if (query.current) lastResult = query.current
  })

  const result = $derived(query.current ?? lastResult)
  const items = $derived(result.items)
</script>
```

- Page size is **fixed at 25**. No size selector. Full pagination rules
  in section 10.
- Filter / search / pagination changes never blank the table — the
  previous result stays visible (stale-while-revalidate) while the
  header loading bar signals the refetch.

### Detail and edit pages

```svelte
<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'

  const id = untrack(() => page.params.id!)
  const data = await getXRemote({ id })
</script>
```

- Top-level `await` only — no `loading/error/current` plumbing on detail
  pages, no skeleton-then-data swap.
- Component re-mounts on every `[id]` change, so the `untrack` snapshot
  is the right call.

## 6. Loading and busy state (tiered, app-wide)

The app uses one **tiered loading mechanism**. The same store drives every
indicator, but the visual response scales with how long the operation
actually takes — fast CRUD never flashes a loader, slow tasks lock the
view properly.

### The `busy` store

Single source of truth: `src/lib/stores/busy.svelte.ts`. It exposes two
reactive flags:

| Flag          | Meaning                                                  | UI driven by it                |
| ------------- | -------------------------------------------------------- | ------------------------------ |
| `busy.active` | at least one operation is currently running              | thin top progress bar          |
| `busy.slow`   | at least one operation has been running for **≥ 250 ms** | full-area overlay on main slot |

Use either:

```ts
// Async wrapper — preferred.
await busy.run(() => deleteCustomerRemote({ id }).updates(...))

// Manual lifecycle — only for paired event boundaries (e.g. SvelteKit
// beforeNavigate / afterNavigate). begin() returns the end-callback.
const end = busy.begin()
try { ... } finally { end() }
```

### Why three signals (header bar / inline / overlay)?

1. **Header loading bar** — the _single_ progress bar in the entire app.
   Lives inside the sticky `AppShell` header, anchored at the bottom of
   the header element via `position: absolute; bottom: 0` so it overlays
   the header's `border-b`. It is mounted unconditionally and only
   toggles `opacity` between 0 and 1 when `busy.active` flips.
   - **The page layout never shifts when the bar appears or disappears.**
     The bar reserves no flow space — it's purely decorative on top of
     the existing border line.
   - **No other component is allowed to render a progress bar.** Tables,
     cards, dialogs, forms, sections — none of them get their own bar.
     The only place the user ever sees a loading bar is right below the
     header, and there is exactly one of them globally.

2. **Inline button busy** (immediate, local).
   Submit and primary action buttons read `busy.active` directly:

   ```svelte
   <button type="submit" class="btn btn-primary" disabled={busy.active}>
     {#if busy.active}
       <span class="loading loading-spinner loading-sm"></span>
     {/if}
     Speichern
   </button>
   ```

   This prevents double-clicks during the first 250 ms before the overlay
   even mounts, and shows feedback exactly where the user clicked.

3. **Full-area overlay** (only when `busy.slow`, i.e. ≥ 250 ms).
   `AppShell` mounts `Loader variant="overlay"` over the main content slot
   and marks it `aria-busy` / `inert`. Sidebar and header stay
   interactive, so the user can navigate away from a slow task. Anything
   that finishes within 250 ms — the vast majority of CRUD against a
   local Postgres — never triggers this overlay.

### Optimistic updates for mutations

For deletions and status changes use the SvelteKit single-flight
optimistic pattern. The row vanishes (or the badge flips) immediately;
the same response carries the authoritative refresh.

```ts
await busy.run(() =>
  deleteCustomerRemote({ id }).updates(
    listCustomersRemote({ page, size, q, archived }).withOverride(
      (current) => ({
        ...current,
        items: current.items.filter((c) => c.id !== id),
        total: Math.max(0, current.total - 1)
      })
    )
  )
)
```

This is the standard pattern for every list-page delete. Always pass
the **specific** filter/page combo currently rendered, so the override
acts on the user's view.

### Stale-while-revalidate for filter / pagination

List pages keep the previously-resolved data via a `lastResult` snapshot
(`query.current ?? lastResult`). The previous rows stay on screen while
the next page loads; the top progress bar signals the refetch. Never
blank the table or replace it with a loader during a filter/pagination
change.

### Page navigation

Wired centrally in `+layout.svelte`:

```svelte
let endNavigation: (() => void) | null = null
beforeNavigate(() => {
  endNavigation?.()
  endNavigation = busy.begin()
})
afterNavigate(() => {
  endNavigation?.()
  endNavigation = null
})
```

Every route change — including `/customers/[id]` → `/customers/[other]`
— flips the busy state. Fast navigations show only the top bar; slow
ones get the overlay too. New pages do not opt in to anything.

### `Loader` component variants

`src/lib/components/ui/Loader.svelte` exposes three DaisyUI/Tailwind
variants. There is intentionally **no `bar` variant** — the single global
progress bar lives directly in `AppShell` and no component is allowed to
render its own.

| Variant   | Use case                                                                     |
| --------- | ---------------------------------------------------------------------------- |
| `block`   | centered spinner + label inside a card body (e.g. SearchablePicker dialog)   |
| `inline`  | small spinner + label inside a button or row                                 |
| `overlay` | full-area cover over a `position: relative` parent — used by `AppShell` only |

### Forbidden loading patterns

- ❌ Local per-component `let busy = $state(false)` — use the global store.
- ❌ **A second progress bar anywhere.** The header bar is the only one.
  No `<progress>` over a card, no `Loader variant="bar"` in a table, no
  rolling-your-own. If you feel a bar would help in the content area, the
  answer is: it would not — the header bar already covers it.
- ❌ Loading indicators that **shift the page layout** when they appear or
  disappear. The header bar overlays the header border for exactly this
  reason — never render anything that adds flow height during load.
- ❌ Showing a full-screen spinner for every transition — the tiered
  model (header bar → 250 ms overlay) is the standard.
- ❌ Skeleton rows or full-card loaders on detail pages — top-level
  `await` plus the global tier handles it.
- ❌ Custom keyframes / `<style>` blocks for spinners.
- ❌ Pessimistic deletes that refresh the whole list before showing the
  user the row is gone — use `withOverride`.

### Wording

The loader label is always **"Inhalte werden geladen"** unless a much
more specific phrase clearly helps. Same wording everywhere.

## 7. UI / styling

The design language is **flat, bordered, low-contrast** — a quiet shell so
the data does the talking. The rules below are not aesthetic preferences;
they exist so screens stay visually consistent without anyone having to
think about it on every PR.

### Library priority

- **DaisyUI first.** Look for an existing component or pattern in DaisyUI
  before writing markup. Configure the
  [`daisyUI Blueprint MCP`](https://daisyui.com/blueprint/) server in
  your editor and use it to confirm the canonical class names, parts and
  modifiers before adding new markup.
- **Tailwind second.** Utility classes are for layout (`grid`, `flex`,
  `gap-*`) and minor spacing tweaks only. Reach for them after you've
  confirmed DaisyUI doesn't already cover the case.
- **No custom CSS.** No `<style>` blocks in components, no rules in
  `app.css` beyond the Tailwind / DaisyUI directives. If you think you
  need a custom rule, you probably need a different DaisyUI / Tailwind
  combo.
- Single `corporate` theme. No dark-mode toggle.
- Icons come from `@lucide/svelte` only.
- Do not add colour tokens or spacing scales — use the DaisyUI theme.

### Shell padding rhythm (single source of truth)

The shell uses **one** spacing value for every important gap:

- `p-4` on the main column, `pb-12` so the page never feels cramped at
  the bottom.
- `px-4` on the top header — same value, so the header's primary action
  button lands directly above the rightmost card edge.
- `gap-4` on every grid that holds top-level cards.

That means top, left, right and inter-card spacing are all the same
(1rem). When you add a new view or component, default to `gap-4` for
card grids and don't introduce custom margins between cards — let the
grid gap do the work.

### The card baseline (single source of truth)

Every block of content in the main column — list tables, search/filter
bars, dashboard tiles, info panels, detail summary boxes, PDF previews,
forms — uses **the same baseline**:

```html
<div class="card border-base-300 bg-base-100 border">
  <div class="card-body">…</div>
</div>
```

No shadow, no extra ring, no custom radius. The DaisyUI `card` class
already gives the right radius (`rounded-box`) and background. The
`border border-base-300` adds the only visual separator we need. Inner
spacing comes from `card-body`, optionally adjusted with `p-0` (for
tables that should reach the card edge) or `gap-*` (for stacked content).

Variants are deliberately limited:

- **Tables that reach the edge:** wrap the `<table>` directly with
  `<div class="card-body p-0">`. Don't add a separate inner border around
  the table — the card already provides one.
- **Search / filter bars** (the `Toolbar` component) reuse the same
  baseline. The card class is applied directly so the row layout works
  without `card-body`.
- **Empty states** (`EmptyState` component) are **borderless** because
  they always render inside a wrapping card. Never put a second border
  around them.

### Tables

- **No zebra striping.** Don't use `table-zebra`. Plain rows on a single
  background read better when paired with our flat card baseline, and
  hover then carries a clear, single signal of clickability.
- **Hover communicates clickability.** Rows that navigate to a detail
  view get `class="hover:bg-base-200 cursor-pointer"` plus an `onclick`
  that calls `goto(...)`. Rows that don't navigate get neither.
- **Total / summary rows** live in `<tfoot>` with their own emphasis
  (`bg-base-200/30 border-t-2 font-semibold`). Keep them visually
  distinct from data rows — they're the only "different" row in the
  table.
- **Action cells** use `<td onclick={(e) => e.stopPropagation()}>` to
  prevent the row navigation from swallowing button clicks.
- **Pagination padding is symmetric.** The shared `Pagination` component
  uses `p-3 sm:p-4` so the corners (Trefferanzahl on the left, page
  switcher on the right) sit the same distance from every edge.

### No custom CSS

`src/app.css` is intentionally tiny — only Tailwind + DaisyUI imports
plus a single `scrollbar-gutter: stable` rule on `html, body` because
that one _has_ to live on the document root. **Don't add anything else
there.** No `@apply`-built component classes, no raw rules, no theme
overrides. If you find yourself reaching for custom CSS, the answer is
a different DaisyUI variant or a Tailwind utility at the use site.

`<style>` blocks inside `.svelte` components are similarly forbidden.
Tailwind's arbitrary-value syntax (e.g. `[scrollbar-gutter:stable]`,
`[grid-template-columns:repeat(4,minmax(0,1fr))]`) covers the rare
case where you genuinely need a one-off CSS value.

### Forbidden styling patterns

These are visual sources of inconsistency we removed on purpose. Don't
re-introduce them:

- **No shadows in the main column.** That includes `shadow-sm`,
  `shadow-md`, `shadow-lg`, `drop-shadow-*` on cards, dashboard tiles,
  the header bar, etc. The only shadow that's allowed is on the
  `ToastTray` (it's a floating overlay, not main content).
- **No dashed / dotted borders** anywhere in the main column —
  `border-dashed` and `border-dotted` are banned for cards, empty
  states and image preview placeholders. Solid borders only.
- **No zebra striping** on tables. See the table rules above — the flat
  card + hover combination is the contract.
- **No custom rounding.** Don't reach for `rounded-md` / `rounded-lg`
  / `rounded-xl` for content blocks — DaisyUI's defaults already handle
  this. The exception is the PDF iframe inside `PdfViewer`, which uses
  `rounded-md` to look like a previewed asset rather than a card.
- **No header-bar shadow.** The top header is separated from the page
  by the same `border-b border-base-300` rule the sidebar uses on its
  right edge. Both lines align by design.
- **No version footer in the main column.** The "v0.0.1 · year" line
  lives only at the bottom of the **sidebar**. Adding one to the main
  column duplicates it and breaks the flat layout.
- **Don't pile Tailwind utilities onto a DaisyUI component.** If you
  find yourself adding more than three layout/spacing classes to a
  card / button / badge / alert, you probably picked the wrong DaisyUI
  variant. Stop and check the Blueprint MCP.

### Why so strict?

The shell, the dashboard and ten different list views were drifting in
small ways — one card had a soft shadow, another didn't; one empty state
had a dashed border, another a solid one; the header had a shadow, the
sidebar a border. That kind of drift compounds quickly and makes the
product feel unfinished. Locking the baseline keeps every page look-alike
without anyone having to remember a style guide.

## 8. Tables and detail navigation

- Tables show **only the most useful columns**. Long lists of fields
  belong on the detail view, not in the row.
- **Every row is fully clickable** and opens its detail view via `goto(...)`.
  Do not require the user to hit a specific column, button, or icon to
  navigate.
- Action cells (edit, delete) sit at the end of the row inside a
  `<td onclick={(e) => e.stopPropagation()}>` so they do not trigger the
  row's navigation.
- The detail view shows everything: stamm­daten, addresses, contact, notes,
  totals — the user should never have to search for a field.

## 9. Picking "the one" out of "the many"

When a form references another record — an invoice referencing a customer,
a position referencing an article, an appointment referencing an employee
— we **never** use a plain `<select>` populated with all rows, and we
never roll a custom typeahead. Every relation is selected through the
shared `SearchablePicker` component fed by a dedicated
`pickXRemote` query.

Why this is the only allowed pattern:

- The "many" side can be large (thousands of customers, vehicles, items).
  A `<select>` would either ship everything to the client or invent its
  own ad-hoc fetching.
- One picker pattern across the whole app is what non-technical users
  expect — the same dialog, the same search box, the same pagination,
  the same "X" to clear, on every screen.
- It composes cleanly with the rest of the architecture: server-side
  search, server-side pagination, Valibot-validated arguments, dehydrated
  cache, no client-side filtering.

### The picker remote function

All pickers live in `src/routes/pickers.remote.ts` so they are
discoverable and share a single Valibot schema:

```ts
const pickerSchema = object({
  q: optional(pipe(string(), trim(), maxLength(200))),
  page: number(),
  size: picklist([10, 25, 50, 100])
})

export const pickCustomersRemote = query(
  pickerSchema,
  async ({ q, page, size }) => {
    // ILIKE on the relevant columns, ordered, paginated
    const rows = await db.select({ ... }).from(customers)
      .where(and(eq(customers.archived, false), q ? or(...) : undefined))
      .orderBy(...)
      .limit(size)
      .offset((page - 1) * size)

    return buildResult(
      rows.map((r) => ({
        id: r.id,
        // human-readable label that the dialog shows
        label: `${r.company || `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || r.number}`,
        // any extra fields the caller wants to pre-fill the form with
      })),
      total,
      page,
      size
    )
  }
)
```

Rules:

- The function must take `{ q, page, size }`. `size` is `picklist([10, 25, 50, 100])` so a malicious client cannot request an unbounded page.
- The return shape is `{ items: T[], total, page, size, pageCount }` where every `T` has at least `id: string` and `label: string`. Add extra fields (price, kind, plate, etc.) when the caller needs them to pre-fill the host form.
- Search via `ILIKE` against the columns the user is most likely to type — name, number, plate, VIN, etc.
- Always order deterministically; never ship random results.

### The component

```svelte
<script lang="ts">
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import { pickCustomersRemote } from '../../pickers.remote'

  let customerId = $state('')
  let customerLabel = $state('')

  const searchCustomers = (params: { q: string; page: number; size: number }) =>
    pickCustomersRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
    }).run()
</script>

<SearchablePicker
  bind:value={customerId}
  bind:valueLabel={customerLabel}
  placeholder="— Kunde suchen und auswählen —"
  dialogTitle="Kunden auswählen"
  search={searchCustomers}
  onSelect={(item) => {
    /* optional: pre-fill other form fields from item extras */
  }}
/>
```

What the component guarantees:

- The trigger looks like a normal `input` so the form layout stays
  consistent with the rest of the form fields.
- The dialog has **fixed dimensions** (640 px tall, max width 2xl,
  internal scroll) — the size never depends on the result count, so
  opening it does not make the page jump.
- Search input has **250 ms debounce** and uses real focus management
  (no `autofocus`, no double-button-in-button anti-patterns).
- Pagination at the bottom of the dialog is the standard `Pagination`
  component (see section 10).
- A clear "X" button on the trigger (only visible when something is
  selected) wipes both `value` and `valueLabel` and fires
  `onSelect(null)`.
- Selecting an item binds `value` and `valueLabel` and closes the dialog.

### Forbidden picker patterns

- ❌ `<select>` for relationships, unless the option list is truly
  hard-coded and small (e.g. "Anrede: Herr / Frau / Familie").
- ❌ A custom inline typeahead built from scratch — use SearchablePicker.
- ❌ Loading the entire list of customers / vehicles / items into the
  client and filtering locally.
- ❌ A picker without server-side search / pagination.
- ❌ Picker remotes outside `pickers.remote.ts` — keep them centralized.

## 10. Pagination

Pagination is **server-side and fixed at 25 entries per page** across the
entire app. There are no page-size selectors anywhere in the UI.

Why fixed 25:

- One predictable layout that fits comfortably on a 1080p screen and
  prints sensibly on A4.
- Less UI noise — non-technical users do not have to choose between
  10 / 25 / 50 / 100.
- Bounded server response, predictable network and DB cost.
- Every list page test assumes 25 → tests stay simple and deterministic.

### The shared `Pagination` component

`src/lib/components/ui/Pagination.svelte` renders:

- A total-count caption on the left ("X Treffer · Seite Y von Z").
- A DaisyUI `join` of buttons on the right: first / prev / numeric
  buttons (sliding window of 5) / next / last.
- **No size selector.** Adding one is forbidden — see the red list.

The component takes:

```ts
type Props = {
  page: number
  pageCount: number
  total: number
  size?: number // accepted for compat, ignored
  onPage: (page: number) => void
}
```

### List-page pagination contract

- The list remote function takes `{ page, size, q?, ...filters }` and
  returns `{ items, total, page, size, pageCount }`.
- The page component holds `let pageNum = $state(1)` and `const size =
25`. Both are passed to the query in a `$derived`.
- Filter, search, or `archivedFilter` changes **must reset
  `pageNum = 1`** (`onQuery={() => (pageNum = 1)}`), otherwise the user
  could end up on a non-existent page after narrowing the result set.
- The `Pagination` component receives `{ total, page: pageNum, pageCount,
size, onPage: (p) => (pageNum = p) }`.
- Stale-while-revalidate (section 6) keeps the previous result visible
  while the next page loads — the table never blanks.

```svelte
<Pagination
  {total}
  page={pageNum}
  {pageCount}
  {size}
  onPage={(p) => (pageNum = p)}
/>
```

### Pagination inside pickers

Pickers reuse the exact same `Pagination` component. The dialog manages
its own internal `page` state — the host page never sees it. Page size
inside pickers is also fixed at 25.

### Forbidden pagination patterns

- ❌ Page-size dropdowns or any user-facing size selector.
- ❌ Hard-coded page sizes other than 25 in new code.
- ❌ Infinite scroll in business lists (the explicit page numbers and
  total counts are part of the audit trail in this app).
- ❌ Client-side slicing of an already-fetched array. Pagination always
  goes server-side via `LIMIT` / `OFFSET` in the remote function.
- ❌ Forgetting to reset `pageNum = 1` on filter / search change.

## 11. Forms

- Forms are plain Svelte components with `<input bind:value>` and a single
  `onSave` callback. Their submit handler delegates the mutation to
  `busy.run(() => createXRemote(...))`.
- The **server schema** in `*.remote.ts` is authoritative. Inline
  client-side validation only mirrors it for UX; never replaces it.
- Numeric DB columns use realistic Valibot bounds (e.g. `mileageKm` ≤
  9_999_999) so no malicious payload can blow past Postgres `int` and
  surface a 500.
- Read `initial` exactly once at component setup with
  `untrack(() => ({ ...initial }))`. Avoid the
  `state_referenced_locally` warning instead of suppressing it.
- **Every `input` / `select` / `textarea` / `file-input` carries `w-full`.**
  DaisyUI v5 sizes form controls at `width: clamp(3rem, 20rem, 100%)` —
  preferred 20rem, not 100%. Without `w-full` an input parks at 320 px no
  matter how wide the grid cell around it is. The grid (`grid-cols-2`,
  `sm:col-span-2`, …) decides how much horizontal space a field gets;
  `w-full` makes the control fill that space. There is no app.css escape
  hatch — the utility goes on the element.
- **Unsaved-changes guard.** Every form wires `formDirty` so the
  AppShell can warn before the user navigates away with unsaved
  edits. Pattern (one line per form, no per-field bookkeeping):

  ```svelte
  <script lang="ts">
    import { formDirty } from '$lib/stores/form-dirty.svelte'
    const markDirty = () => formDirty.set(true)
    $effect(() => () => formDirty.clear()) // reset on unmount
  
    const submit = async (e: Event) => {
      e.preventDefault()
      // … validation …
      formDirty.clear()           // before goto so beforeNavigate is silent
      await busy.run(() => createXRemote(...))
      goto(`/x/${id}`)
    }
  </script>

  <form
    onsubmit={submit}
    oninput={markDirty}
    onchange={markDirty}
    class="card border-base-300 bg-base-100 border"
  >
    …
  </form>
  ```

  `oninput` covers text inputs + textareas, `onchange` covers
  `<select>`, checkbox, radio — both events bubble from children up
  to the `<form>` root, so a single pair of root handlers catches
  the entire form. Calling `formDirty.clear()` before `goto(...)`
  keeps the post-save navigation silent. The AppShell's
  `beforeNavigate` + `window.beforeunload` hooks read the store
  and prompt only when there are real unsaved changes.

## 12. Validation and error handling

Error handling is the part of the app that non-technical users most
notice when something goes wrong, so it has its own end-to-end
contract. Two rules drive everything below:

1. **The user always sees a clear German sentence.** Never English,
   never an HTTP status by itself, never a stack trace, never a SQL
   fragment, never a file path.
2. **The user never sees anything private.** Internal error details
   (DB errors, server stacks, schema names, payloads) live in server
   logs and the browser console — they do **not** leak to the toast
   or to a rendered error page.

Both are enforced in code, not just by convention.

### 12.1 Server-side errors

#### Validation (Valibot)

- **Every remote function validates its argument with Valibot.** Never
  pass `'unchecked'` for an exposed `query` / `command`.
- Reusable schemas live in `src/lib/server/db/validation.ts`. Always
  reach for the existing one (`emailSchema`, `zipSchema`,
  `moneySchema`, `dateStringSchema`, `phoneSchema`, …) before writing
  a new validator. Each existing schema already carries a German
  error message.
- When you write a new schema, supply a **German** message for every
  pipe step:
  ```ts
  pipe(
    string('Bitte einen Wert eingeben.'),
    trim(),
    minLength(1, 'Pflichtfeld.'),
    maxLength(50, 'Maximal 50 Zeichen.')
  )
  ```
  Valibot's built-in defaults are English. If you forget the message,
  `handleValidationError` falls back to a generic German sentence —
  but that's a degraded UX, not a target.
- Numeric fields backed by Postgres `int` need realistic bounds
  (`maxValue(9_999_999)` for `mileageKm`, etc.) so a hostile payload
  cannot turn into a 500 from an integer overflow.

#### `handleValidationError` (in `src/hooks.server.ts`)

Catches Valibot failures and produces the message the user sees.
Format: `Ungültige Eingabe für „<field>": <reason>`. Only the **first**
issue is surfaced — multi-field error walls confuse non-technical users.
If the underlying schema didn't supply a German message (i.e. Valibot's
English default leaked through), we substitute "Bitte prüfen Sie Ihre
Eingabe." rather than show English.

#### `handleError`

Catches anything else that throws on the server.

- **5xx**: the original error object is logged to the server console
  (`[server-error] …`). The user receives only `Ein interner Fehler ist
aufgetreten.` — no stack, no DB error, no original message.
- **4xx with a curated message**: `error(404, 'Kunde nicht gefunden.')`
  and friends already supply a safe German message. We let SvelteKit
  forward it untouched.
- **4xx without a message**: fallback `Die Anfrage konnte nicht
bearbeitet werden.`

#### Throwing inside a remote function

Use SvelteKit's `error(status, 'german message')` for any case that
needs a specific status / message. The message **must be in German**
and must not embed any internal field that isn't safe to show
(no IDs from foreign systems, no file paths, no SQL).

```ts
import { error } from '@sveltejs/kit'

export const getCustomerRemote = query(
  object({ id: idSchema }),
  async ({ id }) => {
    const row = await getCustomer(id)
    if (!row) error(404, 'Kunde nicht gefunden.')
    return row
  }
)
```

### 12.2 Client-side errors

#### `handleClientError(err, baseMessage?)`

Every `await` in a page or form's catch block goes through
`src/lib/utils/client-error.ts → handleClientError`:

```ts
try {
  const created = await busy.run(() => createCustomerRemote(values))
  toast.success('Kunde angelegt.')
  goto(`/customers/${created.id}`)
} catch (err) {
  handleClientError(err, 'Kunde konnte nicht angelegt werden')
}
```

Behaviour:

- The toast text is **only** the curated German message returned by
  the server hooks (or by an explicit `error(...)` inside the remote).
  Anything else — a raw `Error.message`, an English Valibot default
  that slipped through, a network failure with no body — collapses to
  the generic German fallback `Es ist leider ein Fehler aufgetreten.`
- The original `error` is always logged to `console.error`
  (`[client-error] …`) so a developer can still inspect it. The user
  never sees it.
- The optional `baseMessage` argument lets the caller add context
  (`"Kunde konnte nicht angelegt werden"`); the colon and the curated
  detail are appended automatically.

#### Toasts

- Single-toast store (`$lib/stores/toast.svelte`). Only one toast at a
  time on screen — replacements queue cleanly.
- Use `toast.success(...)` for confirmations, `toast.error(...)` only
  via `handleClientError` (i.e. never on the bare path).

#### `+error.svelte`

The root-level `src/routes/+error.svelte` renders whenever a route
throws (top-level `await` rejects, server `error(...)` is hit). It
shows the curated message in a small DaisyUI card with status-aware
copy (404, 403, 400, 5xx) and two clear actions: "Zurück" and "Zum
Dashboard". Never any technical detail beyond `App.Error.message`.

### 12.3 Page-level conventions

- **Forms**: every `onSave` / submit handler must be wrapped in
  `try { await busy.run(() => …) } catch (err) { handleClientError(err, '…') }`.
  No bare `await` of a mutation.
- **List deletes / status changes**: same pattern. Optimistic updates
  via `withOverride` (section 6) compose with `handleClientError` —
  a thrown error rolls back the override and surfaces the German
  message.
- **Detail pages**: top-level `await` is allowed to throw because
  `+error.svelte` will catch it. Do not add a try/catch around it
  yourself — the framework handles the swap.

### 12.4 Required wording catalogue

To keep messages consistent across the app, the following German
templates are canonical. Reuse the wording when adding new modules.

| Situation                          | Wording                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| Generic fallback (toast)           | `Es ist leider ein Fehler aufgetreten.`                                              |
| 5xx (server)                       | `Ein interner Fehler ist aufgetreten.`                                               |
| Valibot rejection                  | `Ungültige Eingabe für „<field>": <reason>`                                          |
| Unknown 4xx                        | `Die Anfrage konnte nicht bearbeitet werden.`                                        |
| Record not found (`error(404, …)`) | `<Entity> nicht gefunden.` (e.g. `Kunde nicht gefunden.`)                            |
| Mutation context (`baseMessage`)   | `<Entity> konnte nicht <verb> werden` (e.g. `Kunde konnte nicht gespeichert werden`) |

### 12.5 Forbidden error patterns

- ❌ Showing `error.message` (or `err.toString()`, or `JSON.stringify(err)`)
  to the user. Always run it through `handleClientError`.
- ❌ Custom `try { ... } catch (e) { alert(e) }`. Use the toast.
- ❌ Hiding errors silently (`catch {}`). Log and toast — or rethrow.
- ❌ Leaking server-only fields (`error.cause`, SQL, file paths) into
  `error(status, …)`. Curated German message only.
- ❌ English default Valibot messages in production schemas. Always
  pass a German message into every pipe step.
- ❌ Per-page custom error boxes that bypass the toast / `+error.svelte`.

## 13. Testing

- **Unit and component tests** with Vitest + `@testing-library/svelte`,
  co-located next to the source file (`X.svelte` ↔ `X.test.ts`).
- **No Playwright in the project**. The Claude Code Playwright MCP is the
  E2E harness during development.
- Run `pnpm test`, `pnpm test:cov`, `pnpm dev` + Playwright
  walkthrough before declaring a feature done.
- Type checking: `pnpm exec svelte-check --tsconfig ./tsconfig.json` must report
  **0 errors / 0 warnings** before commit.

## 14. Git workflow

- Commit small, well-described chunks. Imperative German is fine for the
  subject if it stays short; English is preferred for new contributors.
- The project uses Husky + lint-staged + Prettier. Hooks always run; never
  pass `--no-verify`.
- Never commit secrets (`.env`, dumps, mdb files). `.env.example` is the
  only env template that lives in git.

## 15. What to avoid (red list)

- ❌ `+layout.server.ts`, `+page.server.ts`, `+server.ts`, `actions`,
  `use:enhance` for app data flow.
- ❌ Custom `fetch` calls to internal endpoints — go through remote
  functions.
- ❌ Local per-component `let busy = $state(false)` — use the global
  `busy` store.
- ❌ Skeleton-then-data swap on detail pages — use top-level `await`.
- ❌ `<style>` blocks, custom CSS files, inline `style="..."` for theming.
- ❌ Tables where only one column or icon is clickable.
- ❌ Page-size dropdowns, ad-hoc loading spinners, partial loaders.
- ❌ A loading bar anywhere except the AppShell header. The header bar
  is the single global progress indicator — no second bar in tables,
  cards, dialogs, or anywhere else.
- ❌ Loading indicators that shift the page layout when they appear or
  disappear. Anything that signals "loading" must overlay existing
  pixels, not add height to the flow.
- ❌ Showing the full overlay for every operation — the tiered model
  (header bar → 250 ms overlay) is mandatory.
- ❌ Pessimistic deletes that refresh the whole list before showing the
  user the row is gone — use `mutation.updates(query.withOverride(...))`.
- ❌ `<select>` for relationships, custom typeaheads, or client-side
  filtering of the "many" side. Every one-to-many selection goes
  through `SearchablePicker` + a `pickXRemote` query in
  `pickers.remote.ts` (see section 9).
- ❌ Page sizes other than 25, page-size dropdowns, infinite scroll, or
  client-side slicing for pagination (see section 10).
- ❌ List pages that forget to reset `pageNum = 1` on filter / search
  change.
- ❌ Showing a raw `Error.message`, an HTTP status, a stack trace, a
  SQL fragment or any other internal detail to the user. Every error
  goes through `handleClientError` (toast) or the curated
  `+error.svelte` (full page) — see section 12.
- ❌ English Valibot defaults reaching production. Every pipe step
  carries a German message.
- ❌ Silent `catch {}` blocks. Log and toast — or rethrow.
- ❌ "Roll your own" widgets where DaisyUI already ships an equivalent.

## 16. Price snapshots on documents

Document line items (`document_items`) carry their **own**
`unit_price_net`, `tax_rate`, `discount_percent` and
`line_total_*` columns. They are **snapshots**, not foreign-key
references to a current price.

Why this matters:

- A change to `items.priceNet` must **never** alter the totals on
  invoices that were already issued. A 2024 invoice has to keep
  showing the 2024 price even if the item's catalog price has been
  bumped twice since.
- The `items_id` FK on `document_items` is for traceability only
  (link the line back to the catalog item if the user clicks
  through). Read-paths must never join on it to derive a current
  price.

How to keep this invariant:

1. **`createDocument` copies values explicitly** from the input into
   `document_items` columns. Do not write a query that pulls
   `items.priceNet` at render time.
2. **`updateItem` only writes to the `items` table.** No cascade to
   `document_items`. If you ever need a "re-cost open invoices"
   feature, write a separate, explicit operation with audit logging
   — never as a side-effect of catalog edits.
3. **Audit + history**: if a customer ever asks "why did this price
   change?", the `documents.created_at` plus the `document_items`
   row provide the historical record. A separate `item_price_history`
   table is intentionally **not** part of the schema — the document
   row is the canonical receipt.

If a future feature needs a price-history view (analytics, "show me
the price evolution of part X"), add a separate
`item_price_history` table that's append-only and write to it from
`updateItem`. Don't repurpose `document_items` for that.

### Versionierte Stamm-Werte (Preise, Gehälter, …)

Werte, die zeitabhängig gelten und vergangene Belege/Abrechnungen
nicht rückwirkend verändern dürfen, leben in einer eigenen
`*_versions`-Tabelle pro Domäne — **nicht** in einer generischen
`value_versions`-Tabelle. Aktuell:

- `item_price_versions` — Stamm-Verkaufspreise pro Leistung/Artikel.
  `items.unit_price_net` gibt es seit Migration 0008 nicht mehr;
  `getCurrentItemPrice(itemId)` und `getItemPriceAt(itemId, dateIso)`
  in `item-service.ts` sind die einzigen Lese-Pfade.
- `employee_salary_versions` — Mitarbeitergehälter (Monats- und
  Stundenlohn). `employees.monthly_salary`/`hourly_wage` gibt es
  seit Migration 0008 nicht mehr; `getEffectiveSalary(employeeId,
dateIso)` in `employee-service.ts` löst die zum Stichtag gültige
  Version auf.

Schema-Konvention für jede neue Versionstabelle:

```ts
{
  id: uuid PK,
  <entity>_id: uuid NOT NULL FK CASCADE,
  valid_from: date NOT NULL,
  <wert-spalten>,
  created_at: timestamptz NOT NULL DEFAULT now()
}
UNIQUE(<entity>_id, valid_from)
INDEX(<entity>_id)
```

Service-Helper-Konvention pro Domäne:

- `get<Entity>ValueAt(id, asOf?)` — höchster `valid_from <= asOf`
- `list<Entity>Versions(id)` — alle Versionen DESC nach `valid_from`
- `upsert<Entity>Version({ id, validFrom, … })` — gleicher
  `valid_from` ⇒ Update statt Insert
- `delete<Entity>Version(id)` — Löscht eine einzelne Version

Änderungen an Stamm-Werten gehen **nur** über die Versionen-Tabelle.
Vergangene Belege/Abrechnungen halten ihren damals verwendeten Wert
als Snapshot (z.B. `document_items.unit_price_net`,
`payroll_entries.net_total`); spätere Versionierungen wirken nur auf
zukünftige Auflösungen.

## 17. Database migrations

Migrations are **never** applied by the SvelteKit process. The web
app's only job at boot is to serve HTTP. Schema changes are applied
once, before the server starts, by a dedicated runner.

### Architecture

```
┌─────────────────────────┐      ┌──────────────────┐
│  scripts/migrate.js     │  →   │  node build      │
│  drizzle-orm/postgres-js│      │  (SvelteKit app) │
│  /migrator              │      │                  │
└─────────────────────────┘      └──────────────────┘
   ↑ exits 0 = continue           runs only after migrate succeeded
   ↑ exits 1 = container halts
```

The Docker `CMD` is `node scripts/migrate.js && node build`. If
migration fails, `&&` short-circuits and the app never accepts a
request against a half-migrated database. There is exactly one
runtime container instance, so no migration race is possible.

`drizzle-kit` is a dev-only tool. It is **not** required at runtime
and is not present in the runtime container — `pnpm prune --prod`
in the Dockerfile build stage strips it. The runtime migrator from
`drizzle-orm/postgres-js/migrator` is the only thing executing SQL
in production.

### Workflow

1. **Edit `schema.ts`.** Then `pnpm db:generate` (interactive —
   answer the "rename or new?" prompt). Commit the produced
   `drizzle/<NNNN>_*.sql` and `drizzle/meta/*.json` together.

2. **Apply locally** with `pnpm db:migrate` — same script the
   container runs. No `db:push` in any environment.

3. **Make migrations idempotent.** Drizzle-kit produces
   non-idempotent SQL by default. After generation, hand-edit to add
   guards everywhere it's safe:

   ```sql
   ALTER TABLE foo ADD COLUMN IF NOT EXISTS bar integer DEFAULT 0 NOT NULL;
   CREATE TABLE IF NOT EXISTS bar (…);
   CREATE INDEX IF NOT EXISTS bar_idx ON bar (col);
   DROP TABLE IF EXISTS legacy_x CASCADE;
   ```

   `ALTER COLUMN … SET DEFAULT` is already idempotent. Constraint
   additions need a `DO` block:

   ```sql
   DO $$ BEGIN
     ALTER TABLE foo ADD CONSTRAINT foo_unique UNIQUE (col);
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$;
   ```

   Idempotent migrations cost nothing on the happy path and survive
   every drift scenario without operator intervention.

4. **Snapshots are part of the commit.** `drizzle/meta/*.json` is the
   schema state drizzle-kit diffs against. Skipping the snapshot bump
   produces duplicate migrations on the next `db:generate`.

5. **Never edit applied migrations.** Drizzle keys by the journal
   timestamp; once a migration ships and is in `__drizzle_migrations`,
   editing the SQL doesn't re-run it. Always follow up with a new
   migration.

### Backups

Backups are **not** the application's concern. The runner does not
snapshot the database, the container does not call `pg_dump`, no
script in this repo wraps a backup. Backups are an operations
responsibility on the host / Postgres layer:

- Take a snapshot **before** rolling out a new image whose migrations
  alter or drop existing structure.
- Verify the snapshot is restorable on a separate instance at least
  once per release.
- Retention and storage of backups is policy, not code.

If a migration has the potential to lose data (drop columns, change
types, rename in a way that doesn't preserve content), call this
out in the PR / release note so operations can decide how to gate
the deploy.

## 18. Customer communication (mail)

All SMTP sending goes through `src/lib/server/services/mail-service.ts`
(nodemailer, SMTP-only). Conventions:

- **Plain text is the default.** Every send passes `text`. Document
  mails render a `{platzhalter}` template (`loadTemplate` →
  `buildVars` → `render`); ad-hoc and broadcast mails carry the
  operator's body verbatim.
- **HTML is opt-in (`asHtml`).** `sendAdHocCustomerEmail` and
  `sendBroadcastEmail` accept `asHtml?: boolean`. When `true` the body
  is treated as **operator-authored HTML source**: it is sent as
  `html` and a plain-text fallback is derived via `htmlToPlainText`
  (and stored as the `sent_messages.bodyText` audit value — never the
  HTML source). When absent/false, only `text` is sent. The shared
  `EmailComposer` exposes this through `allowHtml` + bindable `asHtml`.
- **Broadcasts respect `wantsBroadcast`.** Recipients come from
  `listCustomersForBroadcast()` (opt-in + has email). Addresses go in
  **bcc**, chunked into `BROADCAST_BCC_BATCH` (50) per envelope; a
  failed batch is recorded per-customer and does not abort the rest.
  **One `sent_messages` row per recipient** (`documentType='mailing'`),
  not one aggregate row.
- **Unsubscribe (Abbestellen).** Every broadcast appends an opt-out
  footer (`UNSUBSCRIBE_TEXT` / `UNSUBSCRIBE_HTML`) and sets a
  `List-Unsubscribe: <mailto:…?subject=Abbestellen>` header pointing at
  the company email (falling back to SMTP reply-to / from). The flow is
  a **mailto reply** — the operator flips `wantsBroadcast` when a
  customer answers; the next send filters them out. There is no
  tokenized web-unsubscribe route. Ad-hoc single-customer mails do
  **not** get the footer (they are transactional, not bulk advertising).
- **Test at the nodemailer boundary.** `mail-service.test.ts` mocks
  `nodemailer.createTransport().sendMail` and asserts on the captured
  options (`text` / `html` / `headers['List-Unsubscribe']` /
  `attachments`). Use `scripts/dev-mail-catcher.js` (127.0.0.1:1025,
  writes `.eml` to `tmp/mail/`) for manual end-to-end checks.

## 17. Adding a new module

When you scaffold a new module (e.g. payroll), copy the **customers** and
**vehicles** modules as templates:

1. `src/lib/server/services/<x>-service.ts` — repository functions, pure
   typed Drizzle calls.
2. `src/routes/<x>/<x>.remote.ts` — `listXRemote` / `getXRemote` / mutation
   commands using the input schema; mutations refresh via
   `requested(listXRemote, 4).refreshAll()`.
3. `src/routes/<x>/+page.svelte` — list page with the standard
   `untrack(() => query)` snapshot + `lastResult` fallback. Pagination
   contract from section 10. Rows fully clickable per section 8.
4. `src/routes/<x>/[id]/+page.svelte` — top-level await detail page.
5. `src/routes/<x>/[id]/edit/+page.svelte` and `src/routes/<x>/new/+page.svelte`
   — form pages calling `busy.run(...)` inside their `handleSave`. If the
   form references another entity, add a `pickXRemote` query in
   `pickers.remote.ts` and use `SearchablePicker` (section 9).
6. Co-located tests for service logic, schemas, and the form component.

If the new module breaks any of these conventions, the convention is right —
fix the module.

---

By keeping every page on these rails the app stays predictable: any
contributor can read one module, learn the pattern, and ship a new module
that behaves identically. That is the architectural goal.
