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

## 6. Loading and busy state (one mechanism, app-wide)

- The single source of truth is **`busy`** in
  `src/lib/stores/busy.svelte.ts`. It is a counting semaphore: `begin()`
  before a transition, `end()` after, or simply `await busy.run(() => ...)`.
- The `AppShell` watches `busy.active` and renders a full-area
  `Loader variant="overlay"` over the main content slot. While busy:
  - the outer chrome (sidebar + header) stays visible and interactive;
  - the main slot is `aria-busy` and `inert` so the user cannot click
    around mid-transition.
- **Every** mutation, navigation between detail records, or page-level data
  transition runs inside `busy.run(...)`. No ad-hoc local `let busy = …`
  on form components — that pattern is removed.
- Page navigation is wired up centrally in `+layout.svelte` via
  `beforeNavigate(busy.begin)` / `afterNavigate(busy.end)`. New pages do
  not need to opt in.
- The `Loader` component has four variants:
  | Variant | Use case |
  | --------- | ------------------------------------------------------------------------ |
  | `block` | inline empty card / section while a one-off query loads |
  | `inline` | small spinner + label inside a button or row |
  | `bar` | thin top-of-card progress bar during list refetches |
  | `overlay` | full-area cover over `position: relative` parent — used by AppShell only |
- The label is always **"Inhalte werden geladen"** unless a more specific
  string really helps. Same wording everywhere.

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
