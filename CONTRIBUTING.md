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

Languages: **all code, comments, JSDoc, identifiers and commit messages are
in English. The user-facing UI is in German.**

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

- Page size is **fixed at 25**. No size selector.
- Filter / search / pagination changes never blank the table — the previous
  result stays visible while the global busy overlay (or a thin
  `Loader variant="bar"`) signals the refetch.

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

- **DaisyUI first.** Look for an existing component or pattern in DaisyUI
  before writing markup. The
  [`daisyUI Blueprint MCP`](https://daisyui.com/blueprint/) is the
  canonical reference.
- **Tailwind second.** Use utility classes for layout / spacing / minor
  tweaks DaisyUI does not cover.
- **No custom CSS.** No `<style>` blocks in components, no rules in
  `app.css` beyond Tailwind/DaisyUI directives. If you think you need a
  custom rule, you probably need a different DaisyUI / Tailwind combo.
- Single `corporate` theme. No dark-mode toggle.
- Icons come from `@lucide/svelte` only.
- Do not add color tokens or spacing scales — use the DaisyUI theme.

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

## 9. Forms

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

## 10. Validation and errors

- **Valibot in every remote function.** No `'unchecked'` shortcuts.
- Keep reusable schemas in `src/lib/server/db/validation.ts`.
- `handleValidationError` in `hooks.server.ts` returns a friendly
  German message ("Ungültige Eingabe für „Feld“: …"); `handleError`
  hides server stack traces behind a generic "Ein interner Fehler ist
  aufgetreten." in production.
- On the client, route errors through `handleClientError(err, baseMessage?)`
  → toast. The single-toast policy stays.

## 11. Testing

- **Unit and component tests** with Vitest + `@testing-library/svelte`,
  co-located next to the source file (`X.svelte` ↔ `X.test.ts`).
- **No Playwright in the project**. The Claude Code Playwright MCP is the
  E2E harness during development.
- Run `npm test`, `npm run test:cov`, `npm run dev` + Playwright
  walkthrough before declaring a feature done.
- Type checking: `npx svelte-check --tsconfig ./tsconfig.json` must report
  **0 errors / 0 warnings** before commit.

## 12. Git workflow

- Commit small, well-described chunks. Imperative German is fine for the
  subject if it stays short; English is preferred for new contributors.
- The project uses Husky + lint-staged + Prettier. Hooks always run; never
  pass `--no-verify`.
- Never commit secrets (`.env`, dumps, mdb files). `.env.example` is the
  only env template that lives in git.

## 13. What to avoid (red list)

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
- ❌ "Roll your own" widgets where DaisyUI already ships an equivalent.

## 14. Adding a new module

When you scaffold a new module (e.g. payroll), copy the **customers** and
**vehicles** modules as templates:

1. `src/lib/server/services/<x>-service.ts` — repository functions, pure
   typed Drizzle calls.
2. `src/routes/<x>/<x>.remote.ts` — `listXRemote` / `getXRemote` / mutation
   commands using the input schema; mutations refresh via
   `requested(listXRemote, 4).refreshAll()`.
3. `src/routes/<x>/+page.svelte` — list page with the standard
   `untrack(() => query)` snapshot + `lastResult` fallback.
4. `src/routes/<x>/[id]/+page.svelte` — top-level await detail page.
5. `src/routes/<x>/[id]/edit/+page.svelte` and `src/routes/<x>/new/+page.svelte`
   — form pages calling `busy.run(...)` inside their `handleSave`.
6. Co-located tests for service logic, schemas, and the form component.

If the new module breaks any of these conventions, the convention is right —
fix the module.

---

By keeping every page on these rails the app stays predictable: any
contributor can read one module, learn the pattern, and ship a new module
that behaves identically. That is the architectural goal.
