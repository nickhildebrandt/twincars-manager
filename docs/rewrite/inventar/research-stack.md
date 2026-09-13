---
title: Recherche Ziel-Stack und Versionen
teil_von: docs/rewrite/03-architektur.md
stand: 2026-09-12, gegen offizielle Quellen geprüft
---

> Recherchegrundlage für [03-architektur.md](../03-architektur.md).
> Aussagen ohne Beleg sind ausdrücklich als **NICHT VERIFIZIERT** markiert.

# Research: Stack für Rewrite SvelteKit → Nuxt + Nuxt UI

Recherchedatum: **2026-09-12**. Alle Versionen aus npm-Registry (`registry.npmjs.org`, dist-tag `latest`) bzw. GitHub Releases; API-Fakten aus den offiziellen Doku-Seiten. Nicht verifizierbare Punkte sind unten in `## Nicht verifiziert` gesammelt und im Text mit **NICHT VERIFIZIERT** markiert.

---

## 0. Versions-Kurztabelle (alle am 2026-09-12 aus npm `latest` gelesen)

| Paket | Version | Veröffentlicht | Anmerkung |
|---|---|---|---|
| `nuxt` | **4.5.2** | 2026-08-05 | dist-tags: `latest=4.5.2`, `3x=3.21.11`. Kein Nuxt 5. |
| `@nuxt/ui` | **4.11.1** | 2026-09-07 | v4 = UI + UI Pro vereint, MIT |
| `nitropack` | **2.13.4** | 2026-04-29 | Nuxt 4.5 hängt daran (über `@nuxt/nitro-server`) |
| `h3` | **1.15.11** (in Nuxt) / `2.0.1-rc.31` (npm latest) | 2026-04-01 / 2026-09-03 | Nuxt 4.5 nutzt **h3 v1**, nicht v2 |
| `drizzle-orm` | **0.45.2** | 2026-03-27 | `rc`-Tag = `1.0.0-rc.4` (GitHub) / `1.0.0-rc.5-…` (npm-Snapshot) |
| `drizzle-kit` | **0.31.10** | 2026-03-17 | `rc` = `1.0.0-rc.4` |
| `drizzle-valibot` | **0.4.2** | **2025-05-20** | seit >15 Monaten kein stabiles Release |
| `valibot` | **1.5.0** | 2026-09-09 | |
| `@nuxt/test-utils` | **4.3.2** | 2026-09-07 | peer: `vitest ^4.0.2 \|\| ^5.0.0` |
| `vitest` | **5.0.0** | 2026-09-03 | `V4=4.1.11`, `V3=3.2.7` |
| `@vitest/coverage-v8` | **5.0.0** | 2026-09-03 | |
| `@vitest/browser-playwright` | **5.0.0** | 2026-09-03 | neues, aufgespaltenes Provider-Paket |
| `eslint` | **10.10.0** | 2026-09-04 | `maintenance=9.39.5` |
| `@nuxt/eslint` | **1.17.0** | 2026-08-06 | peer: `eslint ^9 \|\| ^10` |
| `@stylistic/eslint-plugin` | **5.10.0** | 2026-03-06 | `beta=6.0.0-beta.6` |
| `typescript-eslint` | **8.70.0** | 2026-09-07 | |
| `semantic-release` | **25.0.9** | 2026-08-05 | engines: `^22.14.0 \|\| >=24.10.0` |
| `typescript` | **7.0.2** | 2026-07-08 | 6.0.3 war 2026-04-16 |
| `vue` | **3.5.42** | 2026-08-27 | `beta=3.6.0-beta.17` |
| `vue-tsc` | **3.3.11** | 2026-08-21 | peer `typescript >=5.0.0` |
| `pnpm` | **12.4.1** | 2026-09-10 | |
| Node LTS | **24.21.0** (Active LTS), **26.8.2** wird LTS am 2026-10-28 | | Nuxt 4.5.2 engines: `^22.19.0 \|\| ^24.11.0 \|\| >=26.0.0` |
| PostgreSQL | **18.6** (aktueller Major), 17.11 | | 18 EOL 2030-11-14 |

---

## 1. Nuxt

### 1.1 Version, Node, Nitro, h3

- **Nuxt 4.5.2** (2026-08-05) ist der aktuelle stabile Stand. Es gibt **kein Nuxt 5**; dist-tags sind `latest=4.5.2`, `3x=3.21.11`, `2x=2.18.1`. GitHub-Releases bestätigen v4.5.2 als neuestes Release (parallel gepflegter v3-Zweig).
- **Node-Mindestversion** (aus `nuxt@4.5.2` `engines`): `^22.19.0 || ^24.11.0 || >=26.0.0`. → **Node 22.19+ ist das Minimum, Node 24.11+ empfohlen.** (Achtung: Das ist strenger als die heutige Projektvorgabe „Node ≥ 22" — 22.0–22.18 fallen raus.)
- **Nitro**: Nuxt 4.5.2 zieht `@nuxt/nitro-server@4.5.2`, das intern `nitropack ^2.13.4` und `h3 ^1.15.11` verwendet. → **Nitro 2.13.x, h3 1.15.x.** Nitro 3 existiert nur als `nitro@3.0.260903-beta` (Beta) und ist in Nuxt 4.5 **nicht** aktiv.
- Weitere relevante Nuxt-4.5-Deps: `vue ^3.5.40`, **`vue-router ^5.2.0`**, `unhead ^3.3.1`, `@nuxt/vite-builder` mit peer `rolldown ~1.2.1`, `jiti ^2.7.0`.

### 1.2 `app/`-Ordnerstruktur (Nuxt 4)

Verifizierter Baum aus dem Upgrade-Guide:

```
app/
  assets/ components/ composables/ layouts/ middleware/ pages/ plugins/ utils/
  app.config.ts
  app.vue
  error.vue            (laut Doku ebenfalls unter app/)
  router.options.ts
content/
layers/
modules/
public/
shared/
  types/ utils/
server/
  api/ middleware/ plugins/ routes/ utils/
nuxt.config.ts
```

- **`srcDir` default = `app/`** (Nuxt 4). Nach `app/` wandern: `assets/`, `components/`, `composables/`, `layouts/`, `middleware/`, `pages/`, `plugins/`, `utils/`, `app.vue`, `error.vue`, `app.config.ts`.
- Im Root bleiben: `server/`, `public/`, `shared/`, `modules/`, `content/`, `layers/`, `nuxt.config.ts`.
- Neu: `dir.app` (Ort von `router.options.ts` und `spa-loading-template.html`), default `<srcDir>/`.
- `compatibilityVersion` steuert das Verhalten; Nuxt erkennt die alte Struktur automatisch, Migration ist nicht zwingend. Ausnahme laut Doku: bei bereits gesetztem custom `srcDir` muss man aufpassen, wie `modules/`, `public/`, `shared/`, `server/` aufgelöst werden.
- **`shared/`** ist der Ordner für Code, den Client *und* Server nutzen (Utils/Typen) — relevant für unsere geteilten Valibot-Schemas.

### 1.3 Datenabruf: `useFetch` / `useAsyncData` / `$fetch`

- `$fetch(url, options)` — ofetch. **Keine** Dedupe, keine SSR-Payload-Weitergabe, blockiert keine Navigation. Nur für Event-Handler/Mutationen. Optionen: `method`, `headers`, `body`, `query`/`params`.
- `useFetch(url, options)` — Wrapper um `$fetch`; erzeugt Cache-Key automatisch aus URL + Fetch-Optionen; verhindert Doppel-Fetch bei Hydration.
- `useAsyncData(key, handler, options)` — key explizit (auto-generiert wenn weggelassen); Handler bekommt `(nuxtApp, { signal })`. Für eigene Query-Layer / parallele Requests.
- **Return**: `{ data, error, status, refresh, execute, clear }`. `status` ∈ `'idle' | 'pending' | 'success' | 'error'` (`'idle'` nur bei `immediate: false`).
- **Gemeinsame Optionen**: `key`, `getCachedData`, `dedupe` (default `true`), `watch` (Array reaktiver Quellen → Refetch), `immediate` (default `true`), `lazy`, `server` (default `true`), `transform`, `pick`, `default`, `deep`, `headers`, `method`, `query`/`params` (reaktiv erlaubt).
- **Reaktive Keys/URLs**: Key darf `computed` oder Getter sein; URL darf Getter sein (`() => \`/api/users/${id.value}\``) → automatischer Refetch bei Änderung. **Das ersetzt unseren SvelteKit-`queryArgs`-`$derived`-Trick.**
- **Key-Konsistenzregel** (wichtig!): Bei gleichem Key müssen `handler`, `deep`, `transform`, `pick`, `getCachedData`, `default` in allen Aufrufen identisch sein; abweichen dürfen `server`, `lazy`, `immediate`, `dedupe`, `watch`.
- `getCachedData` ist der offizielle Hook für Stale-While-Revalidate / „Liste beim Filterwechsel nicht leeren" — ersetzt unser `lastResult`-Muster.
- Seiteneffekte gehören nicht in `useAsyncData` → `callOnce`.

### 1.4 Server-Routen (`server/api/**`)

- `server/api/**` → automatisch unter `/api` gemountet; `server/routes/**` ohne Präfix; `server/middleware/**` läuft vor jedem Request (soll **nichts** zurückgeben, nur Context anreichern); `server/plugins/**` = Nitro-Plugins (Lifecycle-Hooks); `server/utils/**` = auto-importierte Helfer (hier gehört `db.ts` hin).
- Handler: `export default defineEventHandler((event) => …)`.
- Dynamische Segmente: `server/api/hello/[name].ts` → `getRouterParam(event, 'name')`.
- Methoden-Suffixe: `.get.ts`, `.post.ts`, `.put.ts`, `.delete.ts`, `.patch.ts`.
- Weitere Utils: `readBody`, `getQuery`, `createError`, `setResponseStatus`, `sendRedirect`, `useRuntimeConfig(event)`, `useStorage()`, `event.context`.
- `defineCachedEventHandler` existiert (Nitro-Caching) — Details **NICHT VERIFIZIERT** in dieser Recherche.

#### 1.4.1 **Kritisch geprüft: `readValidatedBody` & Co. akzeptieren KEIN Standard Schema**

Quellcode h3 **v1.15.11** (die Version, die Nuxt 4.5.2 fährt):

```ts
// src/utils/internal/validate.ts
export type ValidateResult<T> = T | true | false | void
export type ValidateFunction<T> = (data: unknown) => ValidateResult<T> | Promise<ValidateResult<T>>
```

```ts
export async function readValidatedBody<T, Event extends H3Event = H3Event,
  _T = InferEventInput<"body", Event, T>>(event: Event, validate: ValidateFunction<_T>): Promise<_T>

export function getValidatedQuery<T, Event extends H3Event = H3Event,
  _T = InferEventInput<"query", Event, T>>(event: Event, validate: ValidateFunction<_T>): Promise<_T>

export function getValidatedRouterParams<T, Event extends H3Event = H3Event,
  _T = InferEventInput<"routerParams", Event, T>>(
  event: Event, validate: ValidateFunction<_T>, opts: { decode?: boolean } = {}): Promise<_T>
```

`validateData` prüft weder `~standard` noch `parse`/`safeParse`. **Es gibt in h3 v1 KEINE Standard-Schema-Unterstützung.** Die JSDoc-Beispiele zeigen zwar `z.object({...})` direkt bzw. `objectSchema.safeParse` — das ist in v1 irreführend bzw. fehlerhaft (ein Zod-Schemaobjekt ist keine Funktion; `safeParse` liefert `{success, data, error}`, das h3 als Ergebnis unverändert durchreicht).

**Konsequenz für uns — verbindliches Muster mit Valibot:**

```ts
// server/api/customers/index.post.ts
import * as v from 'valibot'

const Body = v.object({ name: v.pipe(v.string(), v.nonEmpty('Name ist erforderlich')) })

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, data => v.parse(Body, data))
  // …
})
```

`v.parse` wirft bei Fehler → h3 macht daraus einen Validation-Error (HTTP 400). Für kuratierte deutsche Meldungen besser eigener Wrapper in `server/utils/`, der `v.safeParse` benutzt und `createError({ statusCode: 400, statusMessage: … })` wirft — das ist das Äquivalent unseres heutigen `handleValidationError` + `FIELD_LABELS`.

> Hinweis: h3 **v2** (npm `latest = 2.0.1-rc.31`) hat ein anderes Utility-Set; ob dort Standard Schema direkt akzeptiert wird, ist **NICHT VERIFIZIERT** und für Nuxt 4.5 ohnehin irrelevant.

### 1.5 `createError` / Fehlerbehandlung

```ts
function createError(err: string | {
  cause, data, message, name, stack, status, statusText, fatal
}): Error
```

- Server: `throw createError(...)` → Vollbild-Fehlerseite. Client: nur mit `fatal: true` Vollbild.
- `showError(err)` (Doku: „It is recommended instead to use `throw createError()`"), `clearError({ redirect })`, `useError()`.
- `app/error.vue` bekommt `error: NuxtError` als Prop (`import type { NuxtError } from '#app'`), `clearError({ redirect: '/' })` zum Verlassen.
- `<NuxtErrorBoundary @error="…">` mit `#error="{ error, clearError }"` für lokale Fehlergrenzen (ersetzt unser „Toast statt Crash"-Muster punktuell).
- Hook `nuxtApp.hook('vue:error', (error, instance, info) => {})`.

### 1.6 Middleware, Layouts, State, Transitions, Loading

- **Route-Middleware**: `app/middleware/*.ts` (`defineNuxtRouteMiddleware`), `.global.ts` für global; `definePageMeta({ middleware: [...] })`. **Details der Signatur NICHT VERIFIZIERT** in dieser Recherche (Standardwissen, vor Umsetzung nachschlagen).
- **Server-Middleware**: `server/middleware/*` — läuft vor jeder Route, darf nichts zurückgeben. Genau der richtige Ort für Session-Auflösung + Auth-Gate (heute `hooks.server.ts`).
- **Layouts**: `app/layouts/*.vue`, `<NuxtLayout>` + `<slot />`; `definePageMeta({ layout: 'x' })`.
- **`useState(key, init?)`**: SSR-sicherer, geteilter State; Wert überlebt SSR→Hydration; **nur JSON-serialisierbare Daten** (keine Klassen/Funktionen/Symbole). Pattern: `export const useColor = () => useState<string>('color', () => 'pink')`. `clearNuxtState()` invalidiert.
- Pinia: Die Nuxt-Doku nennt Pinia ausdrücklich als „the official Vue recommendation" und liefert Integrationsanleitung. **Nötig ist es nicht** — `useState` + Composables decken unseren Bedarf (busy-Store, Creation-Flow-Stack) ab. Bei Bedarf: `pinia@4.0.3` + `@pinia/nuxt@1.0.2`.
- **Transitions**: `app.pageTransition: { name: 'page', mode: 'out-in' }` und `app.layoutTransition` in `nuxt.config`; per Seite via `definePageMeta`; `<NuxtPage :transition>` (per-Page-Override dann nicht mehr möglich); global abschaltbar mit `false`. Experimentell: `experimental.viewTransition: true` — bei `true` respektiert Nuxt `prefers-reduced-motion: reduce` (empfohlen), `'always'` ignoriert die Präferenz.
- **`<NuxtLoadingIndicator />`**: in `app.vue` oder Layout platzieren. Props: `color` (mit `false` deaktivierbar), `errorColor`, `height` (default 3), `duration` (default 2000 ms), `throttle` (default 200 ms), `estimatedProgress`. → **ersetzt unsere `busy`-Progressbar 1:1 für Navigationen.** Für Mutationen (heute `busy.run`) braucht es zusätzlich `useLoadingIndicator()` (existiert; einzelne Methoden `start/finish/clear/isLoading/progress` **NICHT VERIFIZIERT**).
- **SEO**: `useHead()` / `useSeoMeta()` — existieren (Nuxt-Kern, über `unhead ^3.3.1`). Detailoptionen **NICHT VERIFIZIERT** (nicht recherchiert, für eine interne App zweitrangig).

### 1.7 `runtimeConfig` vs `app.config.ts`

- `runtimeConfig: { apiSecret: '…', public: { apiBase: '/api' } }`. Override zur Laufzeit per `NUXT_API_SECRET` bzw. `NUXT_PUBLIC_API_BASE`.
- **Wichtig für Docker**: „when you run your built server, **your .env file will not be read**" — Env-Variablen müssen im Container gesetzt sein (bzw. via `--env-file`). Unser heutiges `.env`-Vorgehen gilt nur für `dev`.
- Zugriff: `useRuntimeConfig()` (Client sieht nur `public` + `app`); Server read-only; **in Nitro-Routen immer `useRuntimeConfig(event)`**, sonst greifen Env-Overrides nicht.
- Typisierung via `declare module 'nuxt/schema' { interface RuntimeConfig {...} interface PublicRuntimeConfig {...} }`.
- `app/app.config.ts` = reaktive, **client-gebündelte** Konfiguration (`useAppConfig()`, `updateAppConfig()`). Doku-Warnung: „Do not put any secret values inside `app.config`". → Für Nuxt-UI-Theming, **nicht** für Secrets.

### 1.8 Nitro `useStorage`

`useStorage()` existiert als „Cross-platform storage layer" (unstorage `^1.17.5`, über Nitro). Konkrete Mount-/Driver-Konfiguration (`nitro.storage`, fs-Driver für unseren PDF-Cache) **NICHT VERIFIZIERT** — vor Umsetzung `nitro.build/docs/storage` prüfen.

### 1.9 Nitro Tasks / `scheduledTasks`

Voll verifiziert (nitro.build/docs/tasks):

```ts
// nitro.config.ts / nuxt.config.ts → nitro: { experimental: { tasks: true } }
export default defineConfig({
  serverDir: './server',
  experimental: { tasks: true }
})
```

```ts
// server/tasks/db/migrate.ts   → Taskname "db:migrate"
import { defineTask } from 'nitro/task'
export default defineTask({
  meta: { name: 'db:migrate', description: 'Run database migrations' },
  run({ payload, context }) { return { result: 'Success' } }
})
```

```ts
scheduledTasks: {
  '* * * * *': ['cms:update'],
  '0 * * * *': 'db:cleanup'
}
```

- Scheduled Tasks bekommen automatisch `payload.scheduledTime`.
- **Unterstützte Presets: `dev`, `node_server`, `node_cluster`, `node_middleware`, `bun`, `deno_server` (via croner), `cloudflare_module`, `cloudflare_pages`, `vercel`.** → **`node-server` kann Cron nativ** ⇒ unser „kein In-Process-Scheduler, Operator drückt ‚Jetzt prüfen'"-Workaround (Zahlungserinnerungen) lässt sich durch einen echten `scheduledTasks`-Eintrag ersetzen, oder beides (Task + Button, der `runTask()` ruft).
- Programmatisch: `import { runTask } from 'nitro/task'` → `await runTask('db:migrate', { payload })`; wirft 404 (Task fehlt) / 501 (kein Handler).
- Nebenläufigkeit: „Each task can have at most one running instance per server instance" — parallele Aufrufe teilen sich das Ergebnis des ersten laufenden Laufs (auch bei unterschiedlichem Payload!). Wichtig, falls wir Payload-abhängige Tasks bauen.
- Dev: `GET /_nitro/tasks`, `GET|POST /_nitro/tasks/:name`; CLI `nitro task list` / `nitro task run db:migrate --payload "{}"`.

### 1.10 Deployment `node-server` + Docker

- `nitro: { preset: 'node-server' }` oder `NITRO_PRESET=node-server nuxt build`.
- Start: `NODE_ENV=production node .output/server/index.mjs`. Doku betont `NODE_ENV=production` (Vue Router strippt Dev-Warnungen nur dann).
- Env: `NITRO_PORT`/`PORT` (default 3000), `NITRO_HOST`/`HOST` (default `0.0.0.0`), `NITRO_SSL_CERT`/`NITRO_SSL_KEY` (nur Test), `NUXT_APP_BASE_URL` für Subpath.
- Cluster: `NITRO_PRESET=node_cluster`.
- **DB-Migrationen** weiterhin als separater Schritt vor `node .output/server/index.mjs` (siehe §3) — genau wie heute `scripts/migrate.js` im Dockerfile-CMD. Alternativ als Nitro-Task `db:migrate`, aber dann nicht im Request-Pfad.
- Es gibt keine offizielle Nuxt-Dockerfile-Vorlage in der Deployment-Doku (nur Hinweis auf das Output-Verzeichnis) — **unser bestehendes `node:lts-slim`-Dockerfile bleibt gültig**, `BODY_SIZE_LIMIT` entfällt (das ist adapter-node-spezifisch; Nitro hat kein Äquivalent in der Doku → Upload-Limit **NICHT VERIFIZIERT**, vor MDB-Import-Portierung klären).

### 1.11 `nuxt typecheck`

```
npx nuxt typecheck [ROOTDIR] [--cwd=<dir>] [--logLevel=<silent|info|verbose>] [--dotenv] [-e, --extends=<layer>] [--checker]
```

- Führt **`vue-tsc` oder „Golar"** aus; ist keiner installiert, wird zur Installation aufgefordert. `--checker` wählt zwischen beiden.
- Setzt `process.env.NODE_ENV = 'production'` (override via `.env`/CLI).
- Die Option `typescript.typeCheck` in `nuxt.config` wird auf dieser Seite **nicht** dokumentiert → **NICHT VERIFIZIERT**.
- Ersetzt unser `pnpm check` (`svelte-kit sync && svelte-check`). Ziel bleibt: 0 Fehler / 0 Warnungen.

### 1.12 Offizielle Module

| Modul | Version | Relevanz |
|---|---|---|
| `@nuxt/image` | **2.1.0** (2026-07-28) | `<NuxtImg>`/`<NuxtPicture>`, Provider/IPX. Optional — wir haben kaum Bilder außer Fahrzeugfotos/eBay-Listings. Für die braucht es Resizing ⇒ nützlich (benötigt `sharp` serverseitig). |
| `@nuxt/fonts` | **0.14.0** (2026-02-14) | Lokales Self-Hosting von Webfonts, keine Config nötig. **Wird von `@nuxt/ui` automatisch registriert.** |
| `@nuxt/icon` | **2.5.1** (2026-08-24) | Iconify-Integration, `<UIcon name="i-lucide-x">`. **Wird von `@nuxt/ui` automatisch registriert.** |
| `@pinia/nuxt` | **1.0.2** (`pinia@4.0.3`) | **Nicht nötig** — `useState` reicht. |
| `@nuxtjs/color-mode` | 4.x | wird von `@nuxt/ui` automatisch registriert (wir bleiben bei einem festen hellen Theme, ggf. `colorMode: { preference: 'light' }`). |

---

## 2. Nuxt UI

### 2.1 Version, Lizenz, Basis

- **`@nuxt/ui` 4.11.1** (2026-09-07). GitHub-Releases: 4.11.1 / 4.11.0 (2026-08-21) / 4.10.0 / 4.9.0. **Kein v5.**
- **Lizenz/Pro:** Zitat aus der Doku: *„Nuxt UI v4 marks a major milestone: Nuxt UI and Nuxt UI Pro are now unified into a single, fully open-source and free library of 125+ production-ready components and a complete Figma Kit."* und FAQ: *„Nuxt UI is completely free and open source under the MIT license"*. ⇒ **Alle früheren Pro-Komponenten (Dashboard-Layout, Page-/Pricing-Bausteine, AuthForm, …) sind jetzt kostenlos.** `@nuxt/ui-pro` steht nur noch auf 3.3.7 (2025-10-23) und ist obsolet.
- **Basis (verifiziert über die Dependencies von `@nuxt/ui@4.11.1`):**
  - `reka-ui ^2.10.4` (Headless-Primitives)
  - `tailwindcss ^4.3.3` (Peer: `tailwindcss ^4.0.0`)
  - `tailwind-variants ^3.2.2`
  - `@tanstack/vue-table ^8.21.3` (UTable)
  - `@standard-schema/spec ^1.1.0` ⇒ UForm validiert über **Standard Schema**
  - `@internationalized/date ^3.12.4`, `@vueuse/core ^14.4.0`, `embla-carousel-vue ^8.6.0`, `vaul-vue 0.4.1` (Drawer), `motion-v ^2.4.2`, `@tiptap/vue-3 ^3.31.3` (Editor)
  - `@nuxt/icon ^2.5.1`, `@nuxt/fonts ^0.14.0`, `@nuxtjs/color-mode ^4.0.1` (automatisch registriert)
- **Peer-Dependencies (Auszug):** `vue-router ^4.5.0 || ^5.0.0`, `typescript ^5.6.3 || ^6.0.0 || ^7.0.0`, `valibot ^1.0.0`, `zod ^3.24 || ^4`, `yup ^1.7`, `joi ^18`, `superstruct ^2`, `@internationalized/date ^3.0.0`, `tailwindcss ^4.0.0`.
- **`engines` von `@nuxt/ui`: `^20.19.0 || >=22.12.0`** — lockerer als Nuxt selbst; maßgeblich ist Nuxt (22.19+).
- Benötigte Nuxt-Version: in der Installationsdoku **nicht explizit genannt** (**NICHT VERIFIZIERT**); `@nuxt/kit ^4.5.2` als Dependency impliziert Nuxt 4.5+.

### 2.2 Installation

```bash
pnpm add @nuxt/ui tailwindcss
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css']
})
```

```css
/* app/assets/css/main.css — PFLICHT */
@import "tailwindcss";
@import "@nuxt/ui";
```

**Ja, die CSS-Datei mit beiden `@import`-Zeilen ist verpflichtend** und muss über `css: [...]` eingebunden werden (verifiziert in der Installationsdoku).

```vue
<!-- app/app.vue -->
<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
```

`<UApp>` „sets up global config and is required for Toast, Tooltip and programmatic overlays" ⇒ **Pflicht-Wrapper**.

### 2.3 Theming (`app.config.ts`)

```ts
export default defineAppConfig({
  ui: {
    colors: { primary: 'blue', secondary: 'purple', neutral: 'zinc' }
    // + per-Komponente: button: { slots: {...}, defaultVariants: {...} }
  }
})
```

- Sieben semantische Farben mit Defaults: `primary` (green), `secondary` (blue), `success` (green), `info` (blue), `warning` (yellow), `error` (red), `neutral` (slate).
- Design-Tokens über Tailwind-v4-**`@theme`**-Direktive in der CSS-Datei (CSS-first). **Einschränkung:** Man darf in `ui.colors` nur Farben referenzieren, die es schon gibt (Tailwind-Default oder eigene via `@theme`); eigene Farben brauchen **alle Shades 50…950**.
- Komponenten nutzen `tailwind-variants` (`tv()`), Anpassung per Slot/Variant global in `app.config.ts` oder lokal über die **`:ui`-Prop** an jeder Komponente. (Die genaue Slot-/Variant-Syntax pro Komponente steht jeweils auf der Komponentenseite unter „Theme" — im Detail **NICHT VERIFIZIERT**.)
- **Relevanz für uns:** Ersetzt die DaisyUI-`corporate`-Regel. Unsere Regel „keine Custom-CSS-Blöcke" bleibt durchhaltbar: Theming läuft über `app.config.ts` + `@theme`-Tokens, nicht über `<style>`.

### 2.4 Vollständige Komponentenliste (offizielle Übersicht, 125+)

**Layout:** App, Container, **Error**, Footer, Header, Main, Sidebar, Splitter, Theme
**Element:** Alert, Avatar, AvatarGroup, Badge, Banner, Button, Calendar, Card, Chip, Collapsible, FieldGroup, Icon, Kbd, Progress, ProgressGroup, Separator, Skeleton
**Form:** Checkbox, CheckboxGroup, ColorPicker, FileUpload, Form, FormField, Input, InputDate, InputMenu, InputNumber, InputRating, InputTags, InputTime, Listbox, PinInput, RadioGroup, Select, SelectMenu, Slider, Switch, Textarea
**Data:** Accordion, Carousel, **Empty**, Marquee, ScrollArea, Table, Timeline, Tree, User
**Navigation:** Breadcrumb, CommandPalette, FooterColumns, Link, NavigationMenu, Pagination, Stepper, Tabs
**Overlay:** ContextMenu, Drawer, DropdownMenu, Modal, Popover, Slideover, Toast, Tooltip
**Page:** AuthForm, BlogPost, BlogPosts, ChangelogVersion, ChangelogVersions, Page, PageAnchors, PageAside, PageBody, **PageCard**, PageColumns, PageCTA, PageFeature, PageGrid, PageHeader, PageHero, PageLinks, PageList, PageLogos, PageSection, PricingPlan, PricingPlans, PricingTable
**Dashboard:** DashboardGroup, DashboardNavbar, DashboardPanel, DashboardResizeHandle, DashboardSearch, DashboardSearchButton, DashboardSidebar, DashboardSidebarCollapse, DashboardSidebarToggle, DashboardToolbar
**AI Chat:** ChatMessage, ChatMessages, ChatPalette, ChatPrompt, ChatPromptSubmit, ChatReasoning, ChatShimmer, ChatTool
**Editor:** Editor, EditorDragHandle, EditorEmojiMenu, EditorMentionMenu, EditorSuggestionMenu, EditorToolbar
**Content:** ContentNavigation, ContentSearch, ContentSearchButton, ContentSurround, ContentToc
**Color Mode:** ColorModeAvatar, ColorModeButton, ColorModeImage, ColorModeSelect, ColorModeSwitch
**i18n:** LocaleSelect

**Abgleich mit der Anfrage — was es NICHT gibt bzw. anders heißt:**

| Angefragt | Status |
|---|---|
| `UApp`, `UModal`, `USlideover`, `UDrawer`, `UTable`, `UPagination`, `UForm`, `UFormField`, `UInput`, `UInputNumber`, `USelectMenu`, `UInputMenu`, `UCommandPalette`, `UTabs`, `UStepper`, `UDashboardGroup/Sidebar/Panel/Navbar/Search`, `UNavigationMenu`, `UDropdownMenu`, `UBadge`, `UAlert`, `UCard`, `UPageCard`, `UFileUpload`, `UCalendar`, `USkeleton`, `UProgress`, `UButton`, `UAvatar`, `UBreadcrumb`, `USeparator`, `UAccordion`, `UCheckbox`, `USwitch`, `URadioGroup`, `UTextarea`, `USlider` | **alle vorhanden** |
| `UEmpty` | **vorhanden** (Kategorie Data) |
| `UError` | **vorhanden** (Kategorie Layout) — Achtung: das ist die Fehlerseiten-Komponente, nicht „Inline-Fehler" |
| **„Datepicker"** | **existiert nicht als eigene Komponente.** Muster = `UInputDate` + `UPopover` + `UCalendar` (siehe 2.11) |
| `UDashboardSidebarCollapse` / `UDashboardSidebarToggle` / `UDashboardToolbar` / `UDashboardResizeHandle` / `UDashboardSearchButton` | vorhanden (zusätzlich zu den angefragten) |

### 2.5 `UApp` / Toasts / `useToast`

- `<UApp>`-Props: `toaster` (`position`, `expand`, `duration`, `max` — default 5), `locale`, `tooltip`, `portal` (weitere **NICHT VERIFIZIERT**).
- `useToast()`:
  - `add(toast: Partial<Toast>): Toast`
  - `update(id, toast)` — Toast öffnet erneut, Dauer wird zurückgesetzt sofern nicht neu gesetzt
  - `remove(id)`, `clear()`, `toasts: Ref<Toast[]>`
- Toast-Optionen: `title`, `description`, `icon`, `avatar`, `color` (default `primary`), `orientation` (default vertical), `close` (default `true`), `progress` (default `true`), **`duration` default 5000 ms; `0` = bleibt bis manuell geschlossen**, `actions` (Buttons mit `onClick`), `onClick`, `onClose`.
- ⇒ Ersetzt unseren Toast-Layer direkt. Unser `handleClientError(err, baseMessage)` wird zu einem Composable `useClientError()`, das `toast.add({ color: 'error', title })` ruft.

### 2.6 Overlays: `UModal` / `USlideover` / `UDrawer` / `useOverlay`

- `UModal`: `v-model:open` bzw. `:open`, `title`, `description`, `close` (`false` versteckt den Button), `close-icon` (default `i-lucide-x`), `overlay` (default `true`), `transition` (default `true`), `fullscreen` (default `false`), `dismissible` (default `true`, steuert Klick-außerhalb/Escape).
- Slots: `default` = Trigger, `#header`, `#body`, `#footer`, `#content` (ersetzt Header).
- **Fokusfalle ist eingebaut** („built-in focus trapping"), verschachtelte Modals werden unterstützt, Inhalt wird per Portal außerhalb des Dokumentflusses gerendert.
- `useOverlay()` (über `createSharedComposable`, App-weit geteilter State):

```ts
const overlay = useOverlay()
const modal = overlay.create(ConfirmDialog, { props: { title: 'Löschen?' }, destroyOnClose: true })
const confirmed = await modal.open({ title: 'Kunde archivieren?' })  // resolved über das close-Event
modal.patch({ title: 'Neuer Titel' })   // Props ändern ohne Neuöffnen
modal.close(returnValue)
```

`await open()` funktioniert **nur**, wenn die Overlay-Komponente ein `close`-Event emittiert. ⇒ Ersetzt unseren `ConfirmDialog` und die „Unsaved-Changes"-Bestätigung sauber und promise-basiert (unser SvelteKit-`formDirty`-vor-`goto`-Bug fällt strukturell weg).

### 2.7 `UTable`

- Basiert auf **TanStack Table v8** (`@tanstack/vue-table ^8.21.3`), intern `useVueTable`. Kann „sorting, filtering, pagination, row selection, expansion, grouping, pinning and virtualization".
- Props: `data`, `columns` (`ColumnDef[]`), `loading`, `loading-color`, `loading-animation`, `sticky`, `meta` (TableMeta für Zeilen-Styling), `virtualize`, `get-sub-rows`.
- Column-Def: `accessorKey`, `header` (String oder Funktion), `footer`, `cell` (Render via `h()`), `meta: { class: { td, th }, style }`.
- **v-model-fähige State-Props**: `sorting`, `pagination`, `column-filters`, `global-filter`, `column-visibility`, `column-pinning`, `expanded`, `row-selection`, `row-pinning`.
- **Events**: `@select` (Row-Klick!), `@contextmenu`, `@hover`. ⇒ „Jede Zeile voll klickbar" wird zu `@select="row => navigateTo(...)"` statt unserem `<tr onclick>`-Konstrukt; Aktionszellen brauchen weiterhin `@click.stop`.
- **Slots**: `#<column>-header`, `#<column>-cell`, `#expanded`, **`#empty`**.
- `tableApi` über Template-Ref für die volle TanStack-API.
- **Server-Pagination**: `getPaginationRowModel()` ist nur Client-seitig; Server-Pagination wird laut Doku über die kontrollierten State-Props (manual mode) gemacht, Beispiel mit `useLazyFetch`. Die exakte „manualPagination: true"-Schreibweise als Prop (`pagination-options`, `sorting-options`) ist auf der Seite erwähnt, aber die Defaults dazu sind **NICHT VERIFIZIERT** — vor Implementierung die „Table"-Seite im Abschnitt Pagination/Sorting nochmal lesen.
- Footer/Summenzeile: über `footer` in der Column-Def (unser `<tfoot>`-Muster bleibt möglich).

### 2.8 `UPagination`

- Props: `v-model:page`, `total`, `items-per-page` (**default 10** → für uns explizit auf 25 setzen), `sibling-count` (default 2), `show-edges`, `show-controls` (default `true`), `color` (default `neutral`), `variant` (default `outline`), `active-color` (default `primary`), `active-variant` (default `solid`), `size` (default `md`), `disabled`, `to` (macht Buttons zu Links).
- Event: `update:page`.
- Server-Pagination-Beispiel nutzt `:to="pageNum => ({ query: { page: pageNum } })"` → Query-Param-getriebene Liste. Das passt gut zu unserem „Filter-/Seitenwechsel muss `page=1` resetten"-Invariant (Query-State statt lokalem State).

### 2.9 `UForm` / `UFormField` — **Validierung**

**Akzeptierte Schema-Bibliotheken:** alles, was **Standard Schema** implementiert — explizit genannt: **Valibot**, Zod, Regle, Yup, Joi, Superstruct. Peer-Dep `@standard-schema/spec ^1.1.0` bestätigt das. Es ist keine Bibliothek eingebaut.

```vue
<script setup lang="ts">
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'

const schema = v.object({
  email: v.pipe(v.string(), v.email('Ungültige E-Mail')),
  password: v.pipe(v.string(), v.minLength(8, 'Mindestens 8 Zeichen'))
})
type Schema = v.InferOutput<typeof schema>

const state = reactive({ email: '', password: '' })

async function onSubmit(event: FormSubmitEvent<Schema>) {
  console.log(event.data)   // bereits validiert & transformiert
}
</script>

<template>
  <UForm :schema="schema" :state="state" @submit="onSubmit">
    <UFormField label="E-Mail" name="email">
      <UInput v-model="state.email" />
    </UFormField>
    <UButton type="submit" loading-auto>Speichern</UButton>
  </UForm>
</template>
```

- **`:schema`** — Standard-Schema-Objekt **direkt** (kein Wrapper). Auch Superstruct.
- **`:state`** — reaktives Objekt mit den Formularwerten.
- **`:validate`** — zusätzliche Funktion, gibt `FormError[]` (`{ name, message }`) zurück; kombinierbar mit `:schema`.
- **`:validate-on`** — default `['blur', 'change', 'input']`; **Validierung passiert immer zusätzlich beim Submit.** ⇒ Unsere Regel „Validierung ist click-time, Buttons nie wegen fehlender Eingabe disabled" lässt sich umsetzen mit `:validate-on="[]"` (nur Submit) + `loading-auto` am Button.
- **Events**: `@submit` → `FormSubmitEvent<Schema>` mit `event.data`; `@error` → `FormErrorEvent` (feuert beim Submit mit Fehlern) — ideal für unsere deutsche **Fehler-Zusammenfassung** oben im Formular.
- **Exposed über `useTemplateRef`**: `form.validate({ silent? })` → `Promise<T>`, `form.clear(path?)`, `form.setErrors(errors, name?)`, `form.getErrors(path?)`, `form.submit()`, `form.errors: Ref<FormErrorWithId[]>`, **`form.dirty: Ref<boolean>`**, `form.dirtyFields`, `form.touchedFields`, `form.blurredFields`.
  ⇒ **`form.dirty` ersetzt unser handgebautes `formDirty`** inkl. der 24 Call-Sites — und damit die Bug-Klasse „formDirty vor goto zurücksetzen".
- **Fehleranzeige pro Feld**: Zuordnung über `UFormField name="…"`; verschachtelt per Dot-Notation (`user.email`), Array-Items mit Index (`tags.0`), `:error-pattern="/^tags\..+/"` für Sammelanzeige.
- **Nested forms**: `:nested="true"` + `:name` — erben den Parent-State und validieren mit.
- `:transform` (default `true`) wendet Schema-Transformationen beim Submit an.
- `:disabled` deaktiviert alle Felder; `loading-auto` (Form-Prop) deaktiviert Elemente während des Submits.

### 2.10 `USelectMenu` / `UInputMenu` — Server-Suche (unser „Picker"-Ersatz)

- `USelectMenu`-Props: `items` (Strings/Zahlen/Objekte/gruppiert), `v-model` (Objekt oder — mit `value-key` — ein Feld), `label-key` (default `'label'`), `multiple`, `search-input` (`false` versteckt die Suche), **`ignore-filter`** („disable the default filters, useful for custom filtering"), `create-item`, `icon`, `placeholder`, `loading`, `disabled`.
- **Server-/Async-Suche** (verifiziertes Muster):

```vue
<script setup>
const searchTerm = ref('')
const { data: users, status, execute } = await useLazyFetch('/api/pickers/customers', {
  params: { q: searchTerm },
  immediate: false
})
</script>

<template>
  <USelectMenu
    v-model:search-term="searchTerm"
    :items="users"
    ignore-filter
    :loading="status === 'pending'"
    @update:open="() => !users?.length && execute()"
  />
</template>
```

- `UInputMenu` = gleiche Idee, aber Suche direkt im Input (Combobox) statt im Menü; `USelectMenu` hat einen Select-Trigger mit Suche im Popover.
- **Multi-Select** = `multiple`-Prop (ersetzt unseren `MultiSearchablePicker`).
- **„Neu anlegen" aus dem Picker**: `create-item` bietet Inline-Anlage. Unser Full-Page-Creation-Flow (Draft in sessionStorage + `returnUrl`) hat kein direktes Nuxt-UI-Pendant — bleibt Eigenbau (mit `useState` + `sessionStorage`), **NICHT VERIFIZIERT**, ob `create-item` einen Redirect-Hook bietet.

### 2.11 Datum

- **`UInputDate`** ist *kein* fertiger Datepicker, sondern ein segmentiertes Datumsfeld. Props: `v-model`, `range`, `min-value`/`max-value`, `locale`, `granularity` (`day|hour|minute|second`), `is-date-unavailable`, `disabled`, `readonly`, `color`/`variant`/`size`, `icon`/`leading-icon`/`trailing-icon`.
- **Arbeitet ausschließlich mit `@internationalized/date`-Objekten** (`CalendarDate`, `CalendarDateTime`, `ZonedDateTime`, `DateRange`) — **nicht** mit `string` oder `Date`:

```ts
import { CalendarDate } from '@internationalized/date'
const value = shallowRef(new CalendarDate(2022, 2, 3))   // ✓
// new Date() oder '2022-02-03' ✗
```

- **Datepicker-Muster** = `UInputDate` + `UPopover` + `UCalendar`:

```vue
<UInputDate ref="inputDate" v-model="modelValue">
  <template #trailing>
    <UPopover :reference="inputDate?.inputsRef[3]?.$el">
      <UCalendar v-model="modelValue" range />
    </UPopover>
  </template>
</UInputDate>
```

- Das Datumsformat folgt der `locale`-Prop von `<UApp>`.
- ⇒ **Konsequenz:** Wir brauchen eine Konvertierungsschicht `string (ISO, DB) ↔ CalendarDate` in `shared/utils/`. Unser `dateStringSchema` bleibt an der API-Grenze, das UI arbeitet mit `CalendarDate`. Das ist ein nennenswerter Mehraufwand gegenüber `<input type="date">` heute.

### 2.12 Locale `de`

```vue
<script setup>
import { de } from '@nuxt/ui/locale'
</script>
<template>
  <UApp :locale="de"><NuxtPage /></UApp>
</template>
```

- 50+ Locales, `de` dabei; `dir` für RTL; Datumsformatierung folgt dem `code`.
- Eigene/erweiterte Locale via `defineLocale<Messages>({ name, code: 'de', dir: 'ltr', messages })`.
- Dynamischer Wechsel nur nötig mit `@nuxtjs/i18n` — für uns **nicht** relevant (reine DE-App).

### 2.13 Weitere geprüfte Komponenten/Composables

- **`UButton`**: `color` (primary…neutral), `variant` (`solid|outline|soft|subtle|ghost|link`), `size` (`xs…xl`), `icon`/`leading-icon`/`trailing-icon`, `loading`, `loading-icon` (default `i-lucide-loader-circle`), **`loading-auto`** = *„Set loading state automatically based on the `@click` promise state"* ⇒ ersetzt unser `busy.run(...)`-Disable-Muster für einzelne Buttons, `disabled`, `block`, `square`, `to`/`href` (NuxtLink), `type`.
- **`defineShortcuts`**:

```ts
defineShortcuts({
  meta_k: () => { open.value = !open.value },
  escape: { usingInput: true, handler: () => clearSearch() },
  enter:  { usingInput: 'queryInput', handler: () => performSearch() }
})
```
  Modifier: `meta`/`command` (⌘ bzw. Ctrl), `ctrl`, `shift`, `alt`/`option`; Kombination mit `_`, Sequenzen mit `-` (`g-d`); Spezialtasten `escape, enter, arrowleft/right/up/down, tab, backspace, delete, space`. `usingInput`: `false` (default) / `true` / Input-Name. Zusätzlich `extractShortcuts` für Menü-Items.
- **`UCommandPalette`**: Props `groups` (`CommandPaletteGroup[]`), `items`, `multiple`, `loading`, `close`, `placeholder`, `icon` (default `i-lucide-search`); Fuzzy-Suche via Fuse.js mit Defaults `{ fuseOptions: { ignoreLocation: true, threshold: 0.1, keys: ['label','description','suffix'] }, resultLimit: 12, matchAllWhenSearchEmpty: true }`; **Server-Suche über `ignoreFilter: true` an der Gruppe**; Kombination mit `UModal` bzw. `UDashboardSearch`. Tastatur: Enter (ausführen/absteigen), Backspace (zurück), Pfeile. ⇒ Ersatz für unsere globale Suche.
- **`UFileUpload`**: `v-model` (`File | null` bzw. `File[]`), `multiple`, `accept` (MIME/Extensions), `dropzone` (default `true`), `interactive` (default `true`), `variant` `area` (default) | `button`, `size` `xs…xl`, `layout` `grid|list` (nur area), `position` `inside|outside` (nur list), `label`, `description`, `icon`, `file-icon`, `file-delete`; Events `update:modelValue`, `change`; integriert direkt in `UForm`/`UFormField` mit `highlight` für Fehlerzustände. ⇒ Ersatz für unseren MDB-Upload und Belegupload.
- **`UDashboardGroup`**: „fixed layout component that provides context for dashboard components with sidebar state management and persistence". Props: `as` (default `div`), `storage` `'cookie'|'local'` (default `cookie`), `storageKey` (default `dashboard`), `storageOptions`, `persistent` (default `true`), `unit` `'%'|'rem'|'px'` (default `'%'`). Slot: `default`.

```vue
<UDashboardGroup>
  <UDashboardSidebar />
  <slot />
</UDashboardGroup>
```
  Details zu `UDashboardPanel`, `UDashboardNavbar`, `UDashboardToolbar`, `UDashboardSearch`, `UDashboardResizeHandle`, `UDashboardSidebarCollapse/Toggle`: **NICHT VERIFIZIERT** (eigene Doku-Seiten, nicht abgerufen). Sie existieren laut Komponentenindex.
- **`UTabs`, `UStepper`, `UAlert`, `UBadge`, `UCard`, `UPageCard`, `USkeleton`, `UProgress`, `UAvatar`, `UBreadcrumb`, `USeparator`, `UAccordion`, `UCheckbox`, `USwitch`, `URadioGroup`, `UTextarea`, `USlider`, `UNavigationMenu`, `UDropdownMenu`, `UInput`, `UInputNumber`**: existieren (Index verifiziert); Props **nicht einzeln verifiziert**.
- **Reduced Motion / Overlay-Transitions**: `UModal`/`USlideover`/`UDrawer` haben `transition` (default `true`), abschaltbar. Eine dedizierte `prefers-reduced-motion`-Aussage für Nuxt UI wurde **nicht** gefunden → **NICHT VERIFIZIERT**. (Auf Nuxt-Ebene respektiert `experimental.viewTransition: true` die Präferenz.) `motion-v ^2.4.2` ist als Dependency drin.
- **Icons**: `@nuxt/icon` wird automatisch registriert; Icon-Namen im Format `i-lucide-*`. Icon-Set installieren: `pnpm add -D @iconify-json/lucide` (**1.2.131**, 2026-09-10) → volloffline/bundle-fähig. Nuxt-UI-Defaults verwenden bereits Lucide (z. B. `i-lucide-loader-circle`, `i-lucide-x`, `i-lucide-search`). ⇒ 1:1 unser heutiges `@lucide/svelte`.

---

## 3. Drizzle

### 3.1 Versionen & 1.0-Status

- **`drizzle-orm` stabil: 0.45.2** (2026-03-27). **`drizzle-kit` stabil: 0.31.10** (2026-03-17).
- **1.0 ist noch RC**: GitHub-Releases zeigen als neuestes `v1.0.0-rc.4` (2026-06-27, `prerelease: true`); npm-`rc`-Tag = `1.0.0-rc.4`, dazu ein Snapshot `1.0.0-rc.5-5935859` (2026-09-09). **Es gibt kein stabiles 1.0.**
- ⚠️ **Wichtige Diskrepanz:** Die Doku auf `orm.drizzle.team` beschreibt bereits durchgehend v1 (inkl. „Upgrade to v1"). Die npm-`latest`-Installation liefert aber 0.45.2. Beim Lesen der Docs muss man ständig prüfen, ob ein Feature schon in 0.45 existiert.

### 3.2 Treiber

Beide offiziell unterstützt:

```bash
# node-postgres
pnpm add drizzle-orm pg && pnpm add -D drizzle-kit @types/pg
# postgres.js
pnpm add drizzle-orm postgres && pnpm add -D drizzle-kit
```

```ts
import { drizzle } from 'drizzle-orm/node-postgres'
const db = drizzle(process.env.DATABASE_URL)
// oder
const db = drizzle({ connection: { connectionString: process.env.DATABASE_URL, ssl: true } })
```

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
const db = drizzle(process.env.DATABASE_URL)
const db2 = drizzle({ connection: { url: process.env.DATABASE_URL, ssl: true } })
```

- Doku-Hinweise: `pg` optional mit `pg-native` (~10 % schneller); `postgres.js` nutzt **standardmäßig Prepared Statements** und hat bekannte Probleme in AWS-Umgebungen.
- Versionen: `postgres` **3.4.9**, `pg` **8.23.0**.
- **Empfehlung:** Es gibt keine ausgesprochene „offizielle" Präferenz in der Doku. Für einen Node-Server hinter Reverse Proxy sind beide tragfähig; `pg` ist konservativer (kein implizites Prepared-Statement-Verhalten) — **die Wahl ist eine Projektentscheidung, keine verifizierte Vorgabe.**

### 3.3 Nitro-Integration

Muster: `server/utils/db.ts` (auto-import in allen Server-Handlern):

```ts
// server/utils/db.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from '../database/schema'

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined
export function useDb() {
  if (!_db) _db = drizzle(process.env.DATABASE_URL!, { schema })
  return _db
}
```

Ein offiziell dokumentiertes Nuxt/Nitro-Drizzle-Rezept wurde nicht abgerufen → dieses Muster ist **Ableitung, NICHT VERIFIZIERT**. `server/utils/**` als Ort für auto-importierte Helfer ist dagegen verifiziert (Nuxt-Server-Doku).

### 3.4 Migrationen

- CLI: `drizzle-kit generate` (Diff → SQL-Datei), `migrate` (anwenden), `push` (direkt, ohne Datei), `pull` (Introspect), `export` (SQL auf stdout), `check` (Integrität), `up`.
- Ordnerstruktur: `drizzle/<timestamp>_<name>/{snapshot.json, migration.sql}`.
- Runtime-Migrator:

```ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'   // bzw. drizzle-orm/postgres-js/migrator
const db = drizzle(process.env.DATABASE_URL)
await migrate(db, { migrationsFolder: './drizzle' })
```

- **Doku empfiehlt ausdrücklich einen separaten Prozess** für Migrationen (nicht im Request-/Boot-Pfad) → unser heutiges `scripts/migrate.js`-vor-`node build` bleibt das richtige Muster; alternativ als Nitro-Task `db:migrate`.
- `drizzle.config.ts`: `dialect`, `schema`, `out`, `dbCredentials`, `migrationsFolder`, `casing`, `verbose`, `strict`.

### 3.5 Relational Queries v2 (RQB v2)

- **Status: Teil von Drizzle 1.0 — also noch RC, nicht stabil.** Die Doku-Seite `docs/rqb-v2` beschreibt sie als v1-Feature.
- Setup:

```ts
export const relations = defineRelations(schema, (r) => ({
  users: { posts: r.many.posts() },
  posts: { author: r.one.users({ from: r.posts.authorId, to: r.users.id }) }
}))
const db = drizzle(process.env.DATABASE_URL, { relations })
```

- API: `db.query.<table>.findMany()` / `.findFirst()` mit `with`, `columns`, `where`, `extras`, `orderBy`, `limit`, `offset`.
- **Breaking gegenüber v1:** *„References to a table's columns must go through the callback parameter, not through the imported table object."* — gilt für `orderBy`, `where.RAW`, `extras` und Subqueries:

```ts
// ✗ v1  where: { RAW: sql`${users.name} LIKE 'john%'` }
// ✓ v2  where: { RAW: (t) => sql`LOWER(${t.name}) LIKE 'john%'` }
```

- **Empfehlung für den Rewrite:** auf 0.45.2 + klassischen Query-Builder / RQB v1 setzen und RQB v2 erst nach dem 1.0-GA evaluieren. Unser bestehender Service-Layer („pure typed Drizzle calls") ist ohnehin explizit-Query-basiert und migriert weitgehend 1:1.

### 3.6 `drizzle-valibot` — ⚠️ **Problemzone**

- **Stabile Version: `0.4.2`, veröffentlicht 2025-05-20** — also seit ~16 Monaten kein stabiles Release. Aktive Entwicklung nur in den `1.0.0-beta.*`-Snapshots (letzter: `1.0.0-beta.14-a36c63d`, 2026-02-04 — und damit auch schon 7 Monate alt).
- Peer-Deps von `0.4.2`: `{ "valibot": ">=1.0.0-beta.7", "drizzle-orm": ">=0.36.0" }` → **kompatibel mit `valibot@1.5.0` und `drizzle-orm@0.45.2`** (Range-technisch; funktional nicht getestet).
- Die offizielle Doku (`orm.drizzle.team/docs/valibot`) zeigt `npm i drizzle-orm@rc valibot`, beschreibt also den 1.0-RC-Stand.
- API: `createSelectSchema`, `createInsertSchema`, `createUpdateSchema` (alle Felder optional); zweiter Parameter = Refinements: Callback erweitert (`(schema) => v.pipe(schema, v.maxLength(20))`), direkt übergebenes Schema **überschreibt komplett inkl. Nullability**. Views und Enums werden unterstützt. Typ-Mapping PG→Valibot inkl. UUID (`v.pipe(v.string(), v.uuid())`), numerische Min/Max je Bitbreite, Arrays als `v.pipe(v.array(...), v.length(size))`.
- `createSchemaFactory` wird in der Doku erwähnt; ob es in **0.4.2** bereits enthalten ist: **NICHT VERIFIZIERT**.
- **Empfehlung:** `drizzle-valibot` als *optionale Bequemlichkeit* behandeln, nicht als Fundament. Unsere heutigen handgeschriebenen Valibot-Schemas mit **deutschen** Meldungen sind ohnehin nicht aus DB-Typen ableitbar (jede `pipe`-Stufe braucht eine deutsche Message). Vorschlag: Schemas weiter handschreiben, `drizzle-valibot` höchstens für interne/Import-Pfade.

---

## 4. Valibot

- **Version: `1.5.0`** (2026-09-09). `engines` leer; peer `typescript >=5`.
- **Import-Konvention**: `import * as v from 'valibot'` (modulare Einzelfunktionen, aggressives Tree-Shaking; Doku nennt „less than 700 bytes" für minimale Fälle, bis 95 % kleiner als Zod).
- **Standard Schema**: Auf der Intro-Seite nicht explizit erwähnt (**NICHT VERIFIZIERT dort**), aber **indirekt bestätigt**: `@nuxt/ui@4.11.1` listet `valibot ^1.0.0` als Peer und validiert `UForm` ausschließlich über `@standard-schema/spec ^1.1.0`, und die Nuxt-UI-Doku nennt Valibot unter den Standard-Schema-Bibliotheken. ⇒ **Valibot 1.x implementiert Standard Schema.**
- **Kern**: `v.pipe(v.string(), v.email())`, `v.parse(Schema, input)` (wirft), `v.safeParse(Schema, input)` (Ergebnisobjekt), `v.InferOutput<typeof S>`, `v.InferInput`.
- **Verifiziert vorhanden** (API-Index): `v.file`, `v.blob`, `v.mimeType`, `v.maxSize`, `v.minSize`, `v.check`, `v.forward`, `v.variant`, `v.picklist`, `v.flatten`, `v.transform`, `v.pipe`, `v.partial`, `v.omit`, `v.pick`, `v.safeParse`, `v.parse`, `v.InferOutput`, `v.InferInput`, `v.getDotPath`, `v.summarize`, `v.setGlobalConfig`, `v.setGlobalMessage`, `v.setSpecificMessage`, `v.setSchemaMessage`.
  ⇒ **Upload-Validierung** (MIME + Größe) ist damit abgedeckt: `v.pipe(v.file(), v.mimeType(['application/pdf'], 'Nur PDF erlaubt'), v.maxSize(64 * 1024 * 1024, 'Datei zu groß'))`.
- **Fehlerobjekt**: `safeParse` liefert `issues`; `v.flatten(issues)` erzeugt eine feldweise Struktur, `v.getDotPath(issue)` den Pfad als `a.b.0.c`, `v.summarize(issues)` eine lesbare Zusammenfassung. Die genaue Feldstruktur eines Issues (`kind`, `type`, `input`, `expected`, `received`, `message`, `path`) ist aus der Doku bekannt, wurde in dieser Recherche aber **nicht Feld für Feld verifiziert** → **teilweise NICHT VERIFIZIERT**.
- **Zentrale deutsche Meldungen — ja, das geht:**

```ts
import * as v from 'valibot'
import '@valibot/i18n/de'                 // lädt alle deutschen Übersetzungen (Side-Effect)
// oder granular: import '@valibot/i18n/de/schema'; import '@valibot/i18n/de/minLength'
v.setGlobalConfig({ lang: 'de' })          // global
// oder lokal: v.parse(Schema, input, { lang: 'de' })
```

  Eigene Übersetzungen, Auflösungsreihenfolge **specific → schema → global**:

```ts
v.setGlobalMessage((issue) => `Ungültige Eingabe: …`, 'custom')
v.setSchemaMessage((issue) => `Ungültiger Typ: …`, 'custom')
v.setSpecificMessage(v.minLength, (issue) => `Ungültige Länge: …`, 'custom')
v.setGlobalConfig({ lang: 'custom' })
```

  ⇒ **Das ist ein echter Gewinn gegenüber heute:** Statt jeder `pipe`-Stufe eine deutsche Message mitzugeben, kann man Defaults global auf Deutsch setzen und nur fachliche Sonderfälle einzeln überschreiben. `@valibot/i18n` ist ein separates Paket (Version **NICHT VERIFIZIERT**).
- **Env-Validierung**: kein dediziertes Muster in der Doku recherchiert → Eigenbau: ein `shared/env.ts` mit `v.object({...})` + `v.parse(EnvSchema, process.env)` in einem Nitro-Plugin, oder `runtimeConfig` + Typaugmentation. **NICHT VERIFIZIERT.**

---

## 5. Testing

### 5.1 `@nuxt/test-utils` **4.3.2** (2026-09-07)

- `engines`: `^20.19.0 || ^22.12.0 || >=24.0.0`.
- **Peer-Dependencies (alle optional):** `vitest ^4.0.2 || ^5.0.0`, `@vue/test-utils ^2.4.2`, `@testing-library/vue ^8.0.1`, `happy-dom >=20.0.11`, `jsdom >=27.4.0`, `playwright-core ^1.43.1`, `@playwright/test ^1.43.1`, `@cucumber/cucumber >=11`, `@jest/globals >=30`, **`h3-next >=2.0.1-rc.22`**.

### 5.2 Installation & Setup (aus `nuxt.com/docs/4.x/getting-started/testing`)

```bash
npm i --save-dev @nuxt/test-utils vitest @vue/test-utils happy-dom playwright-core
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxt/test-utils/module']
})
```

```ts
// vitest.config.ts  — Projects-basiert (empfohlener Stand)
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'unit', include: ['test/unit/*.{test,spec}.ts'], environment: 'node' }
      },
      await defineVitestProject({
        test: { name: 'nuxt', include: ['test/nuxt/*.{test,spec}.ts'], environment: 'nuxt' }
      })
    ]
  }
})
```

- `defineVitestProject` ist **async** → `await` im Array.
- `defineVitestConfig` (aus `@nuxt/test-utils/config`) existiert weiterhin für die Single-Config-Variante:

```ts
export default defineVitestConfig({
  test: {
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom',   // oder 'jsdom'
        mock: { intersectionObserver: true, indexedDb: false }
      }
    }
  }
})
```

- **Empfohlene Struktur:** `test/unit/` (node), `test/nuxt/` (nuxt-Env), `test/e2e/`.
- Environment pro Datei alternativ per `// @vitest-environment nuxt` oder Dateiendung `*.nuxt.spec.ts`.

### 5.3 Runtime-Helfer (`@nuxt/test-utils/runtime`)

```ts
import { mountSuspended, renderSuspended, mockNuxtImport, mockComponent, registerEndpoint } from '@nuxt/test-utils/runtime'
```

- **`mountSuspended(Component, { route: '/', props, spy })`** — mountet im Nuxt-Kontext, async `setup()` und Injections funktionieren; `spy` gibt Zugriff auf `setupState`.
- **`renderSuspended(Component)`** — dasselbe über `@testing-library/vue`, rendert in `<div id="test-wrapper">`; danach `screen.getByText(...)`.
- **`mockNuxtImport('useState', () => () => ({ value: 'mocked' }))`** — hoisted Makro, **pro Import nur einmal je Testdatei**.
- **`mockComponent('MyComponent', { setup() { return () => h('div','mocked') } })`** bzw. `mockComponent('~/components/my.vue', () => import('./MockComponent.vue'))`.
- **`registerEndpoint('/test/', () => ({ test: 'test-field' }))`**, mit Optionen: `registerEndpoint('/api/', { method: 'POST', handler: () => ({...}), once: true })` — ersetzt unser heutiges pg-mem-gestütztes Remote-Function-Stubbing auf der UI-Seite.

### 5.4 E2E (`@nuxt/test-utils/e2e`)

```ts
import { setup, $fetch, fetch, url, createPage } from '@nuxt/test-utils/e2e'
describe('…', async () => {
  await setup({ setupTimeout: 10_000 })
})
```

`setup()`-Optionen (verifiziert):
- Nuxt-Config: `rootDir` (default `'.'`), `configFile` (default `'nuxt.config'`)
- Timing: `setupTimeout` (default **120000**), `teardownTimeout` (default 30000)
- Features: `build` (default `true`), `server` (default `true`), `port` (default undefined), **`host`** (Ziel-URL statt eigenem Build; ignoriert `build`/`server`), `browser` (default `false`), `browserOptions: { type: 'chromium'|'firefox'|'webkit', launch: {...} }`, `runner: 'vitest'|'jest'|'cucumber'` (default `vitest`), `captureServerLogs`.
- `env`: In der abgerufenen Zusammenfassung **nicht** aufgeführt → **NICHT VERIFIZIERT**.

APIs: `$fetch(url)` (SSR-HTML), `fetch(url)` (Response mit `body`/`headers`), `url(path)` (volle URL mit Testport), `createPage('/page')` (Playwright-Page, volle Playwright-API), `getServerLogs()` / `clearServerLogs()` (mit `captureServerLogs: true`).

### 5.5 Playwright-Runner

```bash
npm i --save-dev @playwright/test @nuxt/test-utils
```

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'
export default defineConfig<ConfigOptions>({
  use: { nuxt: { rootDir: fileURLToPath(new URL('.', import.meta.url)) } }
})
```

```ts
import { expect, test } from '@nuxt/test-utils/playwright'
test('test', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await expect(page.getByRole('heading')).toHaveText('Welcome!')
})
```

`waitUntil: 'hydration'` ist der Nuxt-spezifische Mehrwert — **löst genau die Flakiness, gegen die unsere heutige E2E-Suite kämpft.**

### 5.6 Vitest Browser Mode mit Nuxt — **ja, es gibt `@nuxt/test-utils/browser`**

```bash
npm i --save-dev @vitest/browser-playwright
```

```ts
import { defineVitestProject } from '@nuxt/test-utils/config'
import { playwright } from '@vitest/browser-playwright'

await defineVitestProject({
  test: {
    name: 'browser',
    include: ['test/browser/**/*.{test,spec}.ts'],
    browser: { enabled: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
    setupFiles: ['@nuxt/test-utils/browser']
  }
})
```

```ts
import { render } from '@nuxt/test-utils/browser'
it('renders component', async () => {
  const screen = await render(MyCounter)
  await screen.getByRole('button').click()
})
```

Rückgabe: `container`, `baseElement`, `locator`, `setupState`, `debug()`, `unmount()`, `emitted()`, `rerender(props)`.

### 5.7 Harte Regel

> „`@nuxt/test-utils/runtime` and `@nuxt/test-utils/e2e` need to run in different testing environments and so **can't be used in the same file**."

Trennung per Dateiendung (`*.nuxt.spec.ts`) oder `// @vitest-environment nuxt`.
⇒ **Bricht mit unserer heutigen „co-located `<file>.test.ts` neben der Quelle"-Regel**: Unit-Tests (node) und Nuxt-Runtime-Tests müssen in getrennten Dateien/Projects liegen. Co-Location bleibt für reine Unit-Tests möglich (Project `unit` mit `include: ['app/**/*.test.ts', 'server/**/*.test.ts']`).

### 5.8 Vitest 5

- **`vitest` 5.0.0** (2026-09-03). `engines`: `^22.12.0 || ^24.0.0 || >=26.0.0`. Peer `vite ^6.4 || ^7 || ^8`.
- **Browser-Provider sind aufgesplittet**: `@vitest/browser-playwright` **5.0.0**, außerdem `@vitest/browser-webdriverio`, `@vitest/browser-preview`, `@vitest/browser` (Meta) — alle 5.0.0. (Das ist neu gegenüber dem alten `@vitest/browser` + `provider: 'playwright'`-String.)
- **`@vitest/coverage-v8` 5.0.0** — Version muss exakt zur Vitest-Version passen (Peer `"@vitest/coverage-v8": "5.0.0"`).
- **`test.projects`-Syntax** (verifiziert): Globs (`'packages/*'`), Config-Dateipfade, oder Inline-Objekte. Namen müssen eindeutig sein. Inline-Projekte erben Root-Config (`extends: true` default; `extends: false` oder Pfad möglich). `setupFiles` werden konkateniert, nicht überschrieben; `name` und `projects` werden nie vererbt.
  - **Root-only Optionen (in Projects NICHT erlaubt): `coverage`, `reporters`, `resolveSnapshotPath`, `attachmentsDir`, `globalSetup`.**
  - CLI: `vitest --project unit`, mehrfach, mit Wildcards und Negation (`--project '!e2e'`).
  - Debug: `DEBUG=vitest:projects vitest`.
- **Coverage-Thresholds-Syntax** (verifiziert):

```ts
coverage: {
  provider: 'v8',                                  // 'v8' | 'istanbul' | 'custom'
  reporter: ['text', 'html', 'clover', 'json'],    // default
  reportsDirectory: './coverage',                  // default
  clean: true,                                     // default
  include: [...], exclude: [], allowExternal: false,
  thresholds: {
    lines: 90,
    functions: -10,        // negativ = max. Anzahl unabgedeckter Einheiten
    branches: 85,
    statements: 85,
    perFile: true,
    autoUpdate: true,
    '100': true,           // alle Metriken auf 100
    'src/utils/**': { lines: 95, perFile: true }   // Glob-spezifisch
  }
}
```

- Weitere Versionen: `happy-dom` **20.14.5**, `@vue/test-utils` **2.5.0**, `playwright-core` / `@playwright/test` **1.63.0** (2026-09-04), `@testing-library/vue` (peer `^8.0.1`).

---

## 6. ESLint

- **`eslint` 10.10.0** (2026-09-04); `engines`: `^20.19.0 || ^22.13.0 || >=24`; peer `jiti` (für TS-Configs).
- **`@nuxt/eslint` 1.17.0** (2026-08-06); peer: `eslint ^9.0.0 || ^10.0.0`, optional `vite-plugin-eslint2 ^5` / `eslint-webpack-plugin ^4`. Bringt `@nuxt/eslint-config@1.17.0`, `@nuxt/eslint-plugin@1.17.0`, `eslint-typegen`, `@eslint/config-inspector`.
- **`@stylistic/eslint-plugin` 5.10.0**, `typescript-eslint` **8.70.0**, `eslint-plugin-vue` **10.11.0**.

### 6.1 Setup

```bash
npx nuxi module add eslint     # oder: pnpm add -D @nuxt/eslint eslint typescript
```

```js
// eslint.config.mjs
import withNuxt from './.nuxt/eslint.config.mjs'
export default withNuxt(
  // eigene Flat-Configs
)
```

`withNuxt()` liefert einen chainbaren `FlatConfigComposer` (`.prepend()`, `.override()`, …). **Nur Flat Config**, kein `.eslintrc`.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxt/eslint'],
  eslint: {
    config: {
      stylistic: true,          // oder Objekt mit StylisticCustomizeOptions
      standalone: true,         // default true; false = eigene Presets (z.B. @antfu/eslint-config)
      // nuxt: { sortConfigKeys: true }   // default true wenn stylistic an
    },
    checker: false              // true = ESLint im Dev-Server (braucht vite-plugin-eslint2)
  }
})
```

### 6.2 `createConfigForNuxt` / Feature-Optionen (verifiziert aus `packages/eslint-config/src/types.ts`)

```ts
interface NuxtESLintFeaturesOptions {
  standalone?: boolean                          // default true
  tooling?: boolean | { regexp?: boolean /*true*/, unicorn?: boolean /*true*/, jsdoc?: boolean /*true*/ }  // default false (experimentell)
  import?: boolean | { package?: 'eslint-plugin-import-lite' | 'eslint-plugin-import-x' /*default*/ }      // default true
  stylistic?: boolean | StylisticCustomizeOptions            // default false
  formatters?: boolean | OptionsFormatters                   // default false, braucht eslint-plugin-format
  nuxt?: { sortConfigKeys?: boolean }                        // default true wenn stylistic an
  typescript?: boolean | { strict?: boolean /*true*/, tsconfigPath?: string }  // auto wenn typescript installiert
}
```

Die Stylistic-Config von Nuxt ist ein dünner Wrapper:

```ts
// packages/eslint-config/src/configs/stylistic.ts
export default (options?: StylisticCustomizeOptions): Linter.Config => ({
  name: 'nuxt/stylistic',
  files: [GLOB_SRC, GLOB_VUE],
  ...stylistic.configs.customize(options)
})
```

### 6.3 **ALLE Stylistic-Optionen mit Defaults** (aus `eslint-stylistic` `customize.ts`, verifiziert am Quellcode)

| Option | Default | Wirkung (Auszug) |
|---|---|---|
| `arrowParens` | **`false`** | `arrow-parens: 'as-needed'` + `requireForBlockBody: true` |
| `blockSpacing` | **`true`** | `block-spacing: 'always'` |
| `braceStyle` | **`'stroustrup'`** | `brace-style` mit `allowSingleLine: true` |
| `commaDangle` | **`'always-multiline'`** | |
| `experimental` | **`false`** | experimentelle Regeln |
| `indent` | **`2`** | auch `'tab'` oder `[level, options]`; steuert `@stylistic/indent` + `indent-binary-ops` |
| `jsx` | **`true`** | |
| `pluginName` | `'@stylistic'` | |
| `quoteProps` | **`'consistent-as-needed'`** | |
| `quotes` | **`'single'`** | |
| `semi` | **`false`** | steuert auch `member-delimiter-style` (`'semi'` vs `'none'`) |
| `severity` | **`'error'`** | |

Default-`indent`-Optionen (wenn nur eine Zahl übergeben wird): `ArrayExpression: 1`, `CallExpression: { arguments: 1 }`, `flatTernaryExpressions: false`, `FunctionDeclaration/FunctionExpression: { body: 1, parameters: 1, returnType: 1 }`, `ignoreComments: false`, `ignoredNodes: ['TSUnionType','TSIntersectionType']`, `ImportDeclaration: 1`, `MemberExpression: 1`, `ObjectExpression: 1`, `offsetTernaryExpressions: true`, `outerIIFEBody: 1`, `SwitchCase: 1`, `VariableDeclarator: 1`.

**Für uns passend:** Die Defaults (`semi: false`, `quotes: 'single'`, `indent: 2`, `commaDangle: 'always-multiline'`) decken sich fast vollständig mit unserer Prettier-Konfiguration — **Ausnahme: `commaDangle`.** Heute gilt „no trailing comma"; Stylistic-Default ist `always-multiline`. Entweder anpassen (`stylistic: { commaDangle: 'never' }`) oder die Regel im Rewrite fallen lassen.

### 6.4 `eslint --fix` als Formatter

- Doku: „ESLint Stylistic handles formatting separately from Prettier" und „The module does not enable stylistic/formatting rules by default"; „Formatting capabilities vary by file type (not all formats supported)".
- **Was Stylistic NICHT formatiert:** alles außerhalb von JS/TS/Vue (Glob `GLOB_SRC`, `GLOB_VUE`) — also **kein** Markdown, CSS, JSON, YAML, HTML. Dafür gibt es die separate Feature-Flag `formatters` (benötigt `eslint-plugin-format`, das Prettier/dprint intern nutzt).
- ⇒ **Empfehlung:** `stylistic: true` + `formatters: true` (für md/css/json/yaml) → Prettier ersatzlos streichen. Alternativ Prettier nur für Nicht-Code behalten. Der heutige Husky+lint-staged-Flow wird zu `lint-staged` **17.5.1** mit `"*.{js,ts,vue}": "eslint --fix"`.
- Husky: **9.1.7** (2024-11-18, unverändert seit fast zwei Jahren — stabil, nicht tot).

---

## 7. semantic-release

- **`semantic-release` 25.0.9** (2026-08-05). `engines`: `^22.14.0 || >= 24.10.0`. (`beta = 26.0.0-beta.1`, `next = 25.0.5`.)
- ⚠️ `semantic-release.gitbook.io` ist laut eigener Angabe **eingestellt**; aktuelle Doku unter **semantic-release.org**.
- **Config-Dateien**: `.releaserc` (+ `.yaml|.yml|.json|.js|.cjs|.mjs`), `release.config.(js|cjs|mjs)`, oder `release`-Key in `package.json`.
- **`branches` Default**: `['+([0-9])?(.{+([0-9]),x}).x', 'master', 'main', 'next', 'next-major', {name: 'beta', prerelease: true}, {name: 'alpha', prerelease: true}]`.
- **`plugins` Default**: `['@semantic-release/commit-analyzer', '@semantic-release/release-notes-generator', '@semantic-release/npm', '@semantic-release/github']`.
- Weitere Optionen: `repositoryUrl`, `tagFormat` (default `v${version}`), `dryRun`, `ci` (default `true`; `false` für lokale Releases).
- Env: `GIT_AUTHOR_NAME/EMAIL`, `GIT_COMMITTER_NAME/EMAIL` (default semantic-release-bot). **`GITHUB_TOKEN`/`GH_TOKEN` wurde auf der abgerufenen Seite nicht genannt** → **NICHT VERIFIZIERT** (steht in der `@semantic-release/github`-Doku).

### 7.1 Empfohlene Konfiguration für ein privates Projekt ohne npm-Publish

```json
{
  "branches": ["main"],
  "plugins": [
    ["@semantic-release/commit-analyzer", { "preset": "conventionalcommits" }],
    ["@semantic-release/release-notes-generator", { "preset": "conventionalcommits" }],
    "@semantic-release/changelog",
    ["@semantic-release/npm", { "npmPublish": false }],
    ["@semantic-release/exec", { "prepareCmd": "…docker build/tag mit ${nextRelease.version}…" }],
    ["@semantic-release/git", {
      "assets": ["CHANGELOG.md", "package.json"],
      "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
    }],
    "@semantic-release/github"
  ]
}
```

`@semantic-release/npm` mit `"npmPublish": false` ist das offizielle Muster, um nur `package.json` zu versionieren ohne zu publishen (**vom Plugin dokumentiert; hier nicht einzeln nachgelesen → als Muster NICHT VERIFIZIERT**, aber Standard). Wer nicht einmal `package.json` bumpen will, lässt das Plugin weg.

**Plugin-Versionen (alle 2026 gepflegt):**
`@semantic-release/changelog` **7.0.0** (2026-07-21) · `@semantic-release/git` **11.0.1** (2026-07-24) · `@semantic-release/github` **12.0.9** (2026-07-01) · `@semantic-release/exec` **7.1.0** (2025-05-09) · `@semantic-release/npm` **13.1.5** (2026-03-01) · `conventional-changelog-conventionalcommits` **10.4.0** (2026-08-18).

**Commit-Lint:** `@commitlint/cli` **21.2.2** + `@commitlint/config-conventional` **21.2.2** (beide 2026-08-13), via Husky-Hook `commit-msg`.

**CI-Aufruf**: `npx semantic-release` in einem Job nach Tests; benötigt `GITHUB_TOKEN` (bzw. PAT bei `@semantic-release/git` + Branch-Protection) und `persist-credentials`/`fetch-depth: 0` beim Checkout. **NICHT VERIFIZIERT** (kein CI-Doku-Abruf).

---

## 8. Sonstige Pakete (Version + ein Satz)

| Paket | Version | Datum | Satz |
|---|---|---|---|
| `nodemailer` | **10.0.9** | 2026-09-12 | Aktiv gepflegt (heute erschienen), `engines: node >=20`; unser SMTP-Versand portiert unverändert. |
| `pdf-lib` | **1.17.1** | **2021-11-06** | Seit ~5 Jahren kein Release → faktisch unmaintained, aber funktional stabil und dependency-frei; Alternativen: `pdf-lib`-Fork `@cantoo/pdf-lib` (**NICHT VERIFIZIERT**), `pdfkit`, `puppeteer`/HTML→PDF (schwer), `@react-pdf`. **Empfehlung: bei `pdf-lib` bleiben** — unsere byte-deterministischen Snapshot-Tests hängen daran, ein Wechsel würde alle `__pdf_snapshots__` invalidieren. |
| `qrcode` | **1.5.4** | 2024-08-05 | Stabil, seit 2 Jahren unverändert; reicht für unsere Verkaufsschild-QR-Codes. |
| `csv-parse` | **7.0.2** | 2026-08-02 | Aktiv gepflegt, Teil der `csv`-Suite. |
| `nanoid` | **6.0.1** | 2026-08-03 | Aktiv; ESM-only ab v4 — in Nitro unproblematisch. |
| `postgres` (postgres.js) | **3.4.9** | 2026-04-05 | Schlanker PG-Treiber, Prepared Statements per Default. |
| `pg` (node-postgres) | **8.23.0** | 2026-08-08 | Der konservative PG-Treiber; braucht `@types/pg`. |
| `@electric-sql/pglite` | **0.5.8** | 2026-08-26 | Echtes Postgres als WASM in-process — **der naheliegende `pg-mem`-Ersatz für Tests**; Drizzle hat einen Treiber `drizzle-orm/pglite` (**Existenz in 0.45.2 NICHT VERIFIZIERT**, in der Drizzle-Doku gelistet). Vorteil gegenüber pg-mem: echte PG-Semantik inkl. Migrationen. |
| `@testcontainers/postgresql` | **12.1.0** | 2026-08-04 | Echte PG-Instanz im Docker-Container pro Testlauf; langsamer als PGlite, dafür 100 % produktionsgleich — Option für die Integrationsschicht. |
| `sharp` | **0.35.4** | 2026-08-26 | Bildverarbeitung; nur nötig, wenn `@nuxt/image` serverseitig (IPX) Fahrzeugfotos skalieren soll. |
| `@iconify-json/lucide` | **1.2.131** | 2026-09-10 | Lucide-Icon-Daten für `@nuxt/icon`, offline gebündelt. |
| `@internationalized/date` | **3.12.4** | 2026-09-01 | Pflicht-Peer für `UCalendar`/`UInputDate`; `CalendarDate` & Co. |
| `typescript` | **7.0.2** | 2026-07-08 | TS 7 (nach 6.0.3 vom 2026-04-16); Nuxt UI peer erlaubt `^5.6.3 \|\| ^6 \|\| ^7`; `vue-tsc@3.3.11` peer nur `>=5.0.0` → **TS-7-Kompatibilität von vue-tsc NICHT VERIFIZIERT**, konservativ mit TS 6.0.3 starten. |
| `vue` | **3.5.42** | 2026-08-27 | Nuxt 4.5.2 verlangt `^3.5.40`. |
| `vue-tsc` | **3.3.11** | 2026-08-21 | Typecheck-Backend für `nuxt typecheck`. |
| `pnpm` | **12.4.1** | 2026-09-10 | `engines: node >=18`. |
| Node | **24.21.0** (Active LTS) / 26.8.2 (LTS ab 2026-10-28) | | Nuxt 4.5.2 fordert `^22.19 \|\| ^24.11 \|\| >=26` → **Node 24.11+ ist die richtige Wahl.** |
| PostgreSQL | **18.6** (Major 18, EOL 2030-11-14) | | Unser `>= 14` bleibt gültig; für Neuaufsetzung 17 oder 18. |

---

## 9. Nuxt-Bordmittel-Check

| Bedarf | Bordmittel (Nuxt / Nuxt UI / Nitro) | Fremdpaket nötig? |
|---|---|---|
| **Routing** | Datei-Routing `app/pages/**`, `definePageMeta`, `navigateTo`, `<NuxtLink>`, Route-Middleware (`vue-router 5`) | **Nein** |
| **Data Fetching** | `useFetch` / `useAsyncData` / `$fetch`, `getCachedData`, `watch`, `refresh`, reaktive Keys | **Nein** (kein TanStack Query nötig) |
| **State** | `useState(key, init)` + Composables, `clearNuxtState` | **Nein** (Pinia 4.0.3 / `@pinia/nuxt` 1.0.2 optional) |
| **Server-Routen** | `server/api/**` + `defineEventHandler`, `server/middleware`, `server/utils` (auto-import) | **Nein** |
| **Validierung** | h3 `readValidatedBody`/`getValidatedQuery`/`getValidatedRouterParams` — **nur `ValidateFunction`, kein Standard Schema** | **Ja: `valibot` 1.5.0** (+ optional `@valibot/i18n` für deutsche Default-Meldungen) |
| **Bilder** | — | `@nuxt/image` 2.1.0 (+ `sharp` 0.35.4) — optional |
| **SEO** | `useHead` / `useSeoMeta` (unhead 3) | **Nein** |
| **Transitions** | `app.pageTransition` / `layoutTransition`, `experimental.viewTransition` (respektiert `prefers-reduced-motion`) | **Nein** |
| **Loading-Indicator** | `<NuxtLoadingIndicator>` + `useLoadingIndicator()`; `UButton loading-auto` für Buttons | **Nein** — der globale `busy`-Store entfällt weitgehend |
| **Toasts** | `useToast()` + `<UApp :toaster>` | **Nein** (Nuxt UI) |
| **Modals / Dialoge** | `UModal`/`USlideover`/`UDrawer` + `useOverlay()` (promise-basiert, Focus-Trap eingebaut) | **Nein** (Nuxt UI) |
| **Tabellen** | `UTable` (TanStack Table v8 eingebaut) | **Nein** (Nuxt UI; `@tanstack/vue-table` kommt mit) |
| **Pagination** | `UPagination` (`items-per-page` default 10 → auf 25 setzen) | **Nein** |
| **Formulare** | `UForm`/`UFormField` mit **Standard Schema** (`:schema` = Valibot direkt), `form.dirty`, `@error` | **Ja: `valibot`** (Schema-Lib ist nicht enthalten) |
| **Icons** | `@nuxt/icon` (von `@nuxt/ui` auto-registriert), `i-lucide-*` | `@iconify-json/lucide` 1.2.131 (devDep) |
| **Fonts** | `@nuxt/fonts` (von `@nuxt/ui` auto-registriert) | **Nein** |
| **Cron / Tasks** | Nitro Tasks (`experimental.tasks`) + `scheduledTasks` — **`node_server` wird unterstützt**; `runTask()` für den „Jetzt prüfen"-Button | **Nein** (kein externer Cron nötig) |
| **File-Storage** | Nitro `useStorage()` (unstorage) — fs-Driver für PDF-Cache | **Nein** (Mount-Config prüfen) |
| **Session / Cookies** | `useCookie`, `getCookie`/`setCookie` (h3), `event.context` in `server/middleware` | **Ja für Auth-Logik**: better-auth (o. Ä.) bleibt Fremdpaket — Nuxt hat kein Auth-Bordmittel |
| **Locale `de`** | `import { de } from '@nuxt/ui/locale'` → `<UApp :locale="de">`; Datumsformat folgt dem Locale-Code | **Nein** (`@nuxtjs/i18n` nur bei Mehrsprachigkeit) |
| **Testing** | `@nuxt/test-utils` 4.3.2 (Runtime + E2E + Playwright-Runner + Browser-Mode) | **Ja (devDeps)**: `vitest` 5, `@vue/test-utils` 2.5.0, `happy-dom` 20.14.5, `@playwright/test` 1.63.0, `@vitest/coverage-v8` 5.0.0, für DB-Tests `@electric-sql/pglite` 0.5.8 oder `@testcontainers/postgresql` 12.1.0 |
| **Lint / Format** | `@nuxt/eslint` 1.17.0 mit `stylistic` (Formatierung via `eslint --fix`) + optional `formatters` für md/css/json | **Nein für JS/TS/Vue** — Prettier kann entfallen; für Nicht-Code `eslint-plugin-format` |

---

## Quellen

Alle abgerufen am **2026-09-12**.

**npm-Registry (dist-tags, `time`, `engines`, `peerDependencies`):**
- `https://registry.npmjs.org/nuxt`, `/@nuxt%2Fui`, `/@nuxt%2Fnitro-server`, `/nitropack`, `/h3`, `/drizzle-orm`, `/drizzle-kit`, `/drizzle-valibot`, `/drizzle-zod`, `/valibot`, `/@nuxt%2Ftest-utils`, `/vitest`, `/@vitest%2Fcoverage-v8`, `/@vitest%2Fbrowser-playwright`, `/@vitest%2Fbrowser`, `/eslint`, `/@nuxt%2Feslint`, `/@stylistic%2Feslint-plugin`, `/typescript-eslint`, `/eslint-plugin-vue`, `/semantic-release`, `/@semantic-release%2F{changelog,git,github,exec,npm}`, `/conventional-changelog-conventionalcommits`, `/@commitlint%2F{cli,config-conventional}`, `/husky`, `/lint-staged`, `/@pinia%2Fnuxt`, `/pinia`, `/@nuxt%2Fimage`, `/@nuxt%2Ffonts`, `/@nuxt%2Ficon`, `/@iconify-json%2Flucide`, `/reka-ui`, `/tailwindcss`, `/happy-dom`, `/@vue%2Ftest-utils`, `/playwright-core`, `/@playwright%2Ftest`, `/nodemailer`, `/pdf-lib`, `/qrcode`, `/csv-parse`, `/nanoid`, `/postgres`, `/pg`, `/@electric-sql%2Fpglite`, `/@testcontainers%2Fpostgresql`, `/sharp`, `/@internationalized%2Fdate`, `/typescript`, `/vue`, `/vue-tsc`, `/pnpm`, `/@nuxt%2Fui-pro`, `/nitro`

**GitHub API (Releases / Raw-Quellcode):**
- `https://api.github.com/repos/nuxt/nuxt/releases`
- `https://api.github.com/repos/nuxt/ui/releases`
- `https://api.github.com/repos/drizzle-team/drizzle-orm/releases`
- `https://api.github.com/repos/nuxt/eslint/git/trees/main?recursive=1`
- `https://raw.githubusercontent.com/h3js/h3/v1.15.11/src/utils/body.ts`
- `https://raw.githubusercontent.com/h3js/h3/v1.15.11/src/utils/request.ts`
- `https://raw.githubusercontent.com/h3js/h3/v1.15.11/src/utils/internal/validate.ts`
- `https://raw.githubusercontent.com/nuxt/eslint/main/packages/eslint-config/src/configs/stylistic.ts`
- `https://raw.githubusercontent.com/nuxt/eslint/main/packages/eslint-config/src/types.ts`
- `https://raw.githubusercontent.com/eslint-stylistic/eslint-stylistic/main/packages/eslint-plugin/configs/customize.ts`

**Nuxt-Doku (nuxt.com):**
- `/docs/4.x/getting-started/testing`
- `/docs/4.x/getting-started/data-fetching`
- `/docs/4.x/getting-started/error-handling`
- `/docs/4.x/getting-started/state-management`
- `/docs/4.x/getting-started/transitions`
- `/docs/4.x/getting-started/deployment`
- `/docs/4.x/getting-started/upgrade`
- `/docs/4.x/guide/directory-structure/server`
- `/docs/4.x/guide/directory-structure/app/app-config`
- `/docs/4.x/guide/going-further/runtime-config`
- `/docs/4.x/api/commands/typecheck`
- `/docs/4.x/api/components/nuxt-loading-indicator`

**Nuxt UI (ui.nuxt.com):**
- `/docs/getting-started`, `/docs/getting-started/installation/nuxt`, `/docs/getting-started/theme`, `/docs/getting-started/i18n/nuxt`
- `/docs/components` (Komponentenindex), `/docs/components/form`, `/table`, `/pagination`, `/modal`, `/select-menu`, `/button`, `/command-palette`, `/file-upload`, `/input-date`, `/dashboard-group`
- `/docs/composables/use-toast`, `/docs/composables/use-overlay`, `/docs/composables/define-shortcuts`

**Weitere:**
- `https://orm.drizzle.team/docs/get-started-postgresql`, `/docs/migrations`, `/docs/valibot`, `/docs/rqb-v2`
- `https://valibot.dev/guides/introduction/`, `/guides/internationalization/`, `/api/`
- `https://vitest.dev/guide/projects`, `https://vitest.dev/config/coverage`
- `https://eslint.nuxt.com/packages/module`
- `https://eslint.style/guide/config-presets`
- `https://nitro.build/docs/tasks`
- `https://semantic-release.gitbook.io/semantic-release/usage/configuration` (Seite selbst weist auf semantic-release.org als aktuelle Doku hin)
- `https://endoflife.date/api/nodejs.json`, `https://endoflife.date/api/postgresql.json`

---

## Nicht verifiziert

1. **h3 v2 (`2.0.1-rc.31`) Standard-Schema-Support** in `readValidatedBody` & Co. — nicht geprüft, für Nuxt 4.5 (h3 1.15.11) irrelevant.
2. **`defineCachedEventHandler`** (Nitro-Route-Caching) — Optionen/Verhalten nicht abgerufen.
3. **Nitro `useStorage()` Mount-/Driver-Konfiguration** (`nitro.storage`, fs-Driver) — nicht abgerufen.
4. **Upload-Größenlimit in Nitro/node-server** (Äquivalent zu adapter-nodes `BODY_SIZE_LIMIT`) — nicht gefunden. Kritisch für den ~25 MB MDB-Import.
5. **`useLoadingIndicator()`** — Existenz belegt, Methoden `start/finish/clear/isLoading/progress` nicht einzeln verifiziert.
6. **`useHead` / `useSeoMeta`** Detailoptionen — nicht abgerufen.
7. **Route-Middleware-Signatur** (`defineNuxtRouteMiddleware`, `.global.ts`, `definePageMeta({ middleware })`) — nicht abgerufen.
8. **Offizielles Docker-Rezept für Nuxt/node-server** — in der Deployment-Doku nicht enthalten.
9. **`nuxt.config` `typescript.typeCheck`-Option** — auf der `typecheck`-Command-Seite nicht dokumentiert.
10. **Benötigte Nuxt-Mindestversion für `@nuxt/ui@4.11.1`** — in der Installationsdoku nicht genannt (nur indirekt über `@nuxt/kit ^4.5.2`).
11. **Nuxt UI Slot-/Variant-Syntax pro Komponente** (`:ui`-Prop-Keys, `app.config`-Komponenten-Overrides) — nur das Prinzip verifiziert, nicht die konkreten Slot-Namen.
12. **`UTable` manuelle Server-Pagination/-Sortierung**: `pagination-options` / `sorting-options` / `manualPagination` — erwähnt, aber Defaults und exakte Schreibweise nicht verifiziert.
13. **`UDashboardPanel/Navbar/Toolbar/Search/ResizeHandle/SidebarCollapse/SidebarToggle`** — Existenz aus dem Komponentenindex belegt, Props/Slots nicht abgerufen.
14. **Nuxt UI und `prefers-reduced-motion`** — keine explizite Aussage gefunden.
15. **`USelectMenu` `create-item` + Redirect zu einer Full-Page-Anlage** — kein dokumentierter Hook gefunden; unser Creation-Flow bleibt Eigenbau.
16. **`UApp`-Props außer `toaster` / `locale` / `tooltip` / `portal`** — nicht vollständig abgerufen.
17. **Valibot Issue-Objektstruktur Feld für Feld** (`kind`, `type`, `input`, `expected`, `received`, `path`-Elemente) — nur `flatten`/`getDotPath`/`summarize`-Existenz verifiziert.
18. **`@valibot/i18n` Paketversion** — nicht abgefragt.
19. **Valibot Env-Validierungs-Muster** — kein offizielles Rezept abgerufen.
20. **`drizzle-valibot@0.4.2` Funktionsumfang** — ob `createUpdateSchema` und `createSchemaFactory` bereits in 0.4.2 enthalten sind (Doku beschreibt den 1.0-RC-Stand).
21. **`drizzle-orm/pglite`-Treiber in 0.45.2** — Existenz nicht direkt verifiziert.
22. **Drizzle-in-Nitro-Muster (`server/utils/db.ts`)** — kein offizielles Rezept abgerufen; das gezeigte Snippet ist eine Ableitung.
23. **Bevorzugter PG-Treiber** — Drizzle spricht keine Empfehlung zwischen `pg` und `postgres.js` aus.
24. **`@nuxt/test-utils` `setup({ env })`-Option** — in der abgerufenen Fassung nicht aufgeführt.
25. **`@semantic-release/npm` mit `npmPublish: false`** und **`GITHUB_TOKEN`/`GH_TOKEN`** — Plugin-Dokus nicht einzeln abgerufen; CI-Aufruf (Checkout-Flags, Token-Scopes) ebenfalls nicht.
26. **`vue-tsc@3.3.11` + TypeScript 7** — Peer sagt nur `>=5.0.0`; tatsächliche TS-7-Kompatibilität ungeprüft.
27. **`pdf-lib`-Alternativen** (`@cantoo/pdf-lib` o. Ä.) — nicht recherchiert.
28. **`@nuxt/image` / `@nuxt/fonts` / `@nuxt/icon` Detail-APIs** — nur Versionen und die Auto-Registrierung durch `@nuxt/ui` verifiziert.
