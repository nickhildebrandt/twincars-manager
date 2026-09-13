# 03 — Zielarchitektur

> Teil des Rewrite-Plans. Siehe [00-uebersicht.md](00-uebersicht.md) ·
> [01-inventar.md](01-inventar.md) · [02-befunde.md](02-befunde.md) ·
> [04-ux.md](04-ux.md) · [05-teststrategie.md](05-teststrategie.md) ·
> [06-arbeitsplan.md](06-arbeitsplan.md) · [07-ausfuehrung.md](07-ausfuehrung.md) ·
> [08-entscheidungen.md](08-entscheidungen.md)

Dieses Dokument ist für die Umsetzung **verbindlich**. Wo es mit vorgefundenem
Code kollidiert, gewinnt dieses Dokument. Wo es mit dem alten
`CONTRIBUTING.md` kollidiert, gewinnt dieses Dokument — das alte Regelwerk
beschreibt SvelteKit und gilt nur noch als Quelle für fachliche Regeln.

---

## 1. Ziel in einem Absatz

TwinCarsManager wird von SvelteKit auf **Nuxt** umgestellt. Die Anwendung
bleibt eine einzelne, serverseitig gerenderte Node-Anwendung mit PostgreSQL,
die ein kleiner Kfz-Betrieb im Alltag bedient. Fachlicher Umfang, Routen,
Informationsarchitektur und Bedienlogik bleiben erkennbar dieselben
([04-ux.md](04-ux.md)); geändert wird die technische Grundlage, und es werden
die in [02-befunde.md](02-befunde.md) belegten Fehler behoben. Der Rewrite ist
fertig, wenn jede Feature-ID aus [01-inventar.md](01-inventar.md) umgesetzt,
getestet und dokumentiert ist.

### Nicht-Ziele

- Kein neuer fachlicher Umfang. Neue Wünsche kommen nach dem Rewrite.
- Keine Neuerfindung der Bedienung. Abweichungen nur mit Befund-Beleg.
- Keine Microservices, kein Queue-System, kein zweiter Datenspeicher.
- Keine Mehrmandantenfähigkeit, kein HA-Setup. Eine Instanz, ein Betrieb.

---

## 2. Stack (verbindlich, mit geprüften Versionen)

Alle Versionen am **2026-09-12** gegen die npm-Registry geprüft
(`pnpm view <paket> version`). Details und Quellen:
[`inventar/research-stack.md`](inventar/research-stack.md),
[`inventar/research-auth.md`](inventar/research-auth.md).

| Schicht       | Wahl                                                 | Version                                     | Begründung                                                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework     | **Nuxt**                                             | `4.5.2`                                     | Vorgabe. Node `^22.19 \|\| ^24.11 \|\| >=26`                                                                                                                                                                                        |
| UI            | **Nuxt UI**                                          | `4.11.1`                                    | Vorgabe. Bringt Tailwind v4, `@nuxt/icon`, `@nuxt/fonts`, `@nuxtjs/color-mode`, TanStack Table mit                                                                                                                                  |
| Sprache       | **TypeScript**                                       | `^6.0.3`                                    | Nuxt UI erlaubt `^5.6.3 \|\| ^6 \|\| ^7`. TS 7.0.2 existiert, aber die Eignung von `vue-tsc 3.3.11` dafür ist **nicht belegt** — bewusst konservativ. Aufstieg auf 7 erst, wenn `pnpm typecheck` in einem Versuch sauber durchläuft |
| Server        | **Nitro** (in Nuxt enthalten)                        | —                                           | Preset `node-server`, wie heute adapter-node                                                                                                                                                                                        |
| ORM           | **Drizzle**                                          | `drizzle-orm 0.45.2`, `drizzle-kit 0.31.10` | Vorgabe; Schema wird übernommen                                                                                                                                                                                                     |
| Treiber       | **postgres** (postgres.js)                           | `3.4.9`                                     | wie im Bestand                                                                                                                                                                                                                      |
| Validierung   | **Valibot**                                          | `1.5.0`                                     | Vorgabe A. Nuxt UI führt `valibot ^1` als Peer → `UForm` nimmt Valibot direkt                                                                                                                                                       |
| Meldungen     | **@valibot/i18n** (`de`)                             | aktuell                                     | deutsche Standardmeldungen zentral statt an jedem Pipe-Schritt (§6.2)                                                                                                                                                               |
| Datum im UI   | **@internationalized/date**                          | `3.12.4`                                    | Pflicht-Peer von `UCalendar`/`UInputDate` (§8.4)                                                                                                                                                                                    |
| Auth          | **better-auth**                                      | `1.7.4`                                     | [`inventar/research-auth.md`](inventar/research-auth.md): null Datenmigration, keine Passwort-Resets                                                                                                                                |
| Tests         | **Vitest** + **@nuxt/test-utils**                    | `vitest 5.0.0`, `@nuxt/test-utils 4.3.2`    | Peer erlaubt `vitest ^4 \|\| ^5`                                                                                                                                                                                                    |
| Browsertests  | **@vitest/browser-playwright** + **playwright-core** | `5.0.0`, `1.63.0`                           | Browser-Mode für echtes Fokus- und Tastaturverhalten. In Vitest 5 sind die Provider eigene Pakete                                                                                                                                   |
| E2E           | **@playwright/test**                                 | `1.63.0`                                    | Golden Flows                                                                                                                                                                                                                        |
| Coverage      | **@vitest/coverage-v8**                              | `5.0.0`                                     | Bordmittel, keine Fremdwerkzeuge                                                                                                                                                                                                    |
| Lint + Format | **ESLint** + **@nuxt/eslint**                        | `eslint 10.10.0`, `@nuxt/eslint 1.17.0`     | Stylistic formatiert; **Prettier kommt nicht vor**                                                                                                                                                                                  |
| Release       | **semantic-release**                                 | `25.0.9`                                    | mit `@commitlint/cli 21.2.2`, `husky 9.1.7`                                                                                                                                                                                         |
| Mail          | **nodemailer**                                       | `10.0.9`                                    | unverändert, SMTP-only                                                                                                                                                                                                              |
| PDF           | **pdf-lib**                                          | `1.17.1`                                    | bleibt (§12)                                                                                                                                                                                                                        |
| QR            | **qrcode**                                           | `1.5.4`                                     | bleibt                                                                                                                                                                                                                              |
| CSV           | **csv-parse**                                        | `7.0.2`                                     | Legacy-Import                                                                                                                                                                                                                       |
| Bilder        | **sharp**                                            | `0.35.4`                                    | **neu** — serverseitiges Resize (B-247, B-127)                                                                                                                                                                                      |
| Icons         | **@iconify-json/lucide**                             | `1.2.131`                                   | gleiche Icon-Sprache wie heute                                                                                                                                                                                                      |
| Paketmanager  | **pnpm**                                             | `12.4.1` über corepack                      | ausschließlich. Fällt corepack offline aus, bleibt `11.8.0` zulässig                                                                                                                                                                |
| Laufzeit      | **Node**                                             | `24.11+` (lokal 24.18.0)                    | Nuxt verlangt `^22.19 \|\| ^24.11 \|\| >=26`                                                                                                                                                                                        |
| Datenbank     | **PostgreSQL**                                       | `18` (Prod), `17.11` (lokal)                | unverändert                                                                                                                                                                                                                         |

### 2.1 Was aus dem Bestand entfällt

| Paket                                                                                 | Warum                                                       |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `@sveltejs/*`, `svelte`, `svelte-check`                                               | Framework-Wechsel                                           |
| `daisyui`, `tailwindcss` (direkt)                                                     | Nuxt UI bringt Tailwind v4 mit; DaisyUI entfällt ersatzlos  |
| `@lucide/svelte`                                                                      | ersetzt durch `@nuxt/icon` + `@iconify-json/lucide`         |
| `prettier`, `prettier-plugin-*`                                                       | **ESLint Stylistic übernimmt die Formatierung**             |
| `@testing-library/svelte`, `@testing-library/jest-dom`, `@testing-library/user-event` | ersetzt durch `@nuxt/test-utils` + `@vue/test-utils`        |
| `jsdom`                                                                               | ersetzt durch `happy-dom`                                   |
| `pg-mem`                                                                              | ersetzt durch echtes PostgreSQL im Test (§6.5, B-575)       |
| `nanoid`                                                                              | Nitro/`crypto.randomUUID()` reicht                          |
| `@sveltejs/adapter-node`                                                              | Nitro-Preset `node-server`                                  |
| OTel-No-op-Shim (`src/lib/server/otel-noop.ts`)                                       | Vite-spezifischer Workaround; in Nitro neu bewerten (§15.3) |

### 2.2 Lint und Formatierung (Prettier entfällt)

```ts
// nuxt.config.ts
eslint: { config: { stylistic: true, formatters: true } }
```

```js
// eslint.config.mjs
import withNuxt from './.nuxt/eslint.config.mjs'
export default withNuxt(/* eigene Flat-Configs */)
```

- **`stylistic: true`** aktiviert `@stylistic/eslint-plugin`. Dessen Vorgaben
  decken sich fast vollständig mit der alten Prettier-Konfiguration:
  `semi: false`, `quotes: 'single'`, `indent: 2`, `quoteProps:
'consistent-as-needed'`, `braceStyle: 'stroustrup'`, `arrowParens: false`.
- **Eine bewusste Änderung:** `commaDangle` steht auf `always-multiline`
  (Prettier stand auf „nie"). Wir übernehmen die Vorgabe, statt sie zu
  überschreiben — weniger Sonderregeln, Standard des Ökosystems.
- **`formatters: true`** (benötigt `eslint-plugin-format`) deckt Markdown,
  CSS, JSON und YAML ab. Ohne diese Option formatiert Stylistic nur
  JS/TS/Vue, und Prettier käme durch die Hintertür zurück.
- `lint-staged` ruft für `*.{js,ts,vue,md,json,yaml,yml}` nur noch
  `eslint --fix` auf.
- **Prettier taucht nirgends auf**: nicht als Abhängigkeit, nicht als
  Konfigurationsdatei, nicht als Editor-Empfehlung.

### 2.3 Nuxt-Bordmittel vor Fremdpaketen

Verbindliche Prüfreihenfolge: **Nuxt/Nitro → Nuxt UI → eigenes kleines Modul →
erst dann ein Fremdpaket.** Jedes neue Fremdpaket braucht einen Eintrag in
[08-entscheidungen.md](08-entscheidungen.md).

| Bedarf                | Bordmittel                                         | Fremdpaket nötig?                        |
| --------------------- | -------------------------------------------------- | ---------------------------------------- |
| Routing, Layouts      | Nuxt Pages/Layouts                                 | nein                                     |
| Datenabruf            | `useFetch` / `useAsyncData` / `$fetch`             | nein                                     |
| Geteilter Zustand     | `useState` + Composables                           | nein — **kein Pinia**                    |
| Server-Routen         | Nitro `server/api/**`                              | nein                                     |
| Validierung           | —                                                  | **ja: Valibot** (Vorgabe A)              |
| Bilder                | `@nuxt/image` (via Nuxt UI ohnehin im Baum)        | nur `sharp` serverseitig                 |
| SEO / `<head>`        | `useHead` / `useSeoMeta`                           | nein                                     |
| Seitenübergänge       | `pageTransition` / `layoutTransition`              | nein                                     |
| Ladeanzeige           | `<NuxtLoadingIndicator>`                           | nein                                     |
| Toasts                | Nuxt UI `useToast()` + `<UApp>`                    | nein                                     |
| Modale                | Nuxt UI `UModal` / `useOverlay()`                  | nein                                     |
| Tabellen              | Nuxt UI `UTable` (TanStack)                        | nein                                     |
| Formulare             | Nuxt UI `UForm` + Valibot                          | nein                                     |
| Icons, Fonts          | `@nuxt/icon`, `@nuxt/fonts` (in Nuxt UI enthalten) | nur Icon-Sammlung                        |
| Schlüssel-Wert-Ablage | Nitro `useStorage()`                               | nein                                     |
| Geplante Jobs         | Nitro `scheduledTasks` + `runTask()` (§9.4)        | nein                                     |
| Session / Cookies     | better-auth                                        | ja (begründet)                           |
| Sprache `de`          | Nuxt UI `locale` + eigenes Textmodul               | nein — **kein i18n-Modul** (einsprachig) |
| Tests                 | `@nuxt/test-utils`                                 | nein                                     |
| Lint + Format         | `@nuxt/eslint`                                     | nein                                     |

---

## 3. Repository-Layout

Der Altbestand bleibt unangetastet. Die neue Anwendung entsteht in
**`nuxt/`** im selben Repository.

```
twincars-manager/
├─ src/ …                    ← Altbestand (SvelteKit), READ-ONLY bis zum Cutover
├─ drizzle/ …                ← alte Migrationen, Quelle für die Baseline
├─ docs/                     ← Dokumentation (Vorgabe B) — gemeinsam genutzt
│  ├─ index.md               ← neuer Einstieg
│  ├─ features/  api/  data/  ui/  architecture/  decisions/  guides/
│  └─ rewrite/               ← DIESER Plan (nicht Teil der Produktdoku)
└─ nuxt/                     ← die neue Anwendung
```

**Annahme A-01:** Die neue Anwendung liegt in `nuxt/`, weil der Altbestand
laut Auftrag nicht verändert werden darf und `package.json`, `tsconfig.json`
usw. im Repo-Root bereits belegt sind. Beim Cutover (T-042) wandert der Inhalt
von `nuxt/` ins Repo-Root und `src/` wird entfernt. Bis dahin trägt `nuxt/`
ein eigenes `pnpm-workspace.yaml`, damit pnpm dort einen eigenen
Workspace-Root sieht und nicht in den Altbestand greift.

### 3.1 Innerer Aufbau von `nuxt/`

```
nuxt/
├─ app/                       Client (Nuxt 4 srcDir)
│  ├─ app.vue                 <UApp> + <NuxtLayout> + <NuxtPage>
│  ├─ error.vue               kuratierte Fehlerseite (404/403/422/5xx)
│  ├─ app.config.ts           Nuxt-UI-Theme: Farben, Radius, Komponenten-Defaults
│  ├─ assets/css/main.css     EINZIGE CSS-Datei: @import "tailwindcss"; @import "@nuxt/ui";
│  ├─ components/             eigene Komponenten (§8)
│  │  ├─ app/                 AppShell-Teile: Sidebar, Header, UserMenu, GlobalSearch
│  │  ├─ form/                FormPage, FieldGrid, DirtyGuard
│  │  ├─ data/                DataTable, ListPage, FilterBar, EmptyState, Pagination
│  │  ├─ picker/              EntityPicker, MultiEntityPicker
│  │  └─ <domäne>/            modulspezifisch, z. B. customer/CustomerForm.vue
│  ├─ composables/            useApi, useBusy, useNotify, useListQuery,
│  │                          useFormDirty, useCreationFlow, useAuth, usePermissions
│  ├─ layouts/                default.vue (Shell), blank.vue (Login/Setup)
│  ├─ middleware/             auth.global.ts, permission.ts, setup.global.ts
│  ├─ pages/                  Routen — 1:1 zu den alten Pfaden (04-ux.md §2)
│  ├─ plugins/                idle-logout.client.ts, error-handler.client.ts
│  └─ utils/                  reine Client-Helfer (Formatierung, Labels)
├─ server/
│  ├─ api/                    HTTP-Schicht, dünn (§5.2)
│  ├─ database/
│  │  ├─ schema/              Drizzle-Tabellen, je Domäne eine Datei
│  │  ├─ migrations/          SQL-Migrationen (Baseline 0000 + Folgen)
│  │  └─ seed/                seedDefaults (idempotent)
│  ├─ middleware/             01.auth.ts, 02.api-guard.ts
│  ├─ plugins/                00.env.ts (Env-Validierung), 10.error.ts
│  ├─ services/               Fachlogik, je Domäne eine Datei (§5.3)
│  └─ utils/                  db, guards, errors, pagination, crypto, money, …
├─ shared/                    isomorph (Client + Server + Tests)
│  ├─ schemas/                ALLE Valibot-Schemata (§6)
│  ├─ permissions.ts          MODULE_PERMISSIONS, hasPermission
│  └─ types/                  aus Schemata abgeleitete Typen
├─ test/
│  ├─ unit/                   Node-Umgebung
│  ├─ nuxt/                   Nuxt-Runtime (Komponenten)
│  ├─ browser/                Vitest Browser Mode
│  ├─ integration/            Endpoints gegen echte Test-DB
│  ├─ e2e/                    Playwright Golden Flows
│  ├─ factories/              Testdaten-Factories
│  └─ setup/                  globale Setups
├─ scripts/                   migrate.mjs, seed.mjs, docs-coverage.mjs, …
├─ nuxt.config.ts   eslint.config.mjs   vitest.config.ts   drizzle.config.ts
├─ playwright.config.ts   package.json   pnpm-workspace.yaml   tsconfig.json
└─ .env.example   .env.test.example
```

### 3.2 Namenskonventionen

| Gegenstand             | Konvention                                            | Beispiel                                     |
| ---------------------- | ----------------------------------------------------- | -------------------------------------------- |
| Vue-Komponente         | `PascalCase.vue`, Ordner nach Domäne                  | `customer/CustomerForm.vue`                  |
| Komponente im Template | mit Ordnerpräfix (Nuxt-Auto-Import)                   | `<CustomerForm>`, `<DataTable>`              |
| Composable             | `useXxx.ts`, ein Export                               | `useListQuery.ts`                            |
| Server-Route           | `server/api/<modul>/<ressource>.<methode>.ts`         | `server/api/customers/index.get.ts`          |
| Dynamische Route       | `[id].get.ts`                                         | `server/api/customers/[id].get.ts`           |
| Aktion auf Ressource   | `[id]/<verb>.post.ts`                                 | `server/api/invoices/[id]/cancel.post.ts`    |
| Service                | `<domäne>-service.ts`, benannte Exporte               | `customer-service.ts` → `listCustomers`      |
| Valibot-Schema         | `shared/schemas/<domäne>.ts`, Suffix `Schema`         | `customerCreateSchema`                       |
| Abgeleiteter Typ       | ohne Suffix, `InferOutput`                            | `type CustomerCreate`                        |
| Drizzle-Tabelle        | `snake_case` in der DB, `camelCase`-Export            | `customers`, `vehicleLicensePlateVersions`   |
| Test                   | `<gegenstand>.test.ts` im passenden `test/<projekt>/` | `test/unit/money.test.ts`                    |
| Regressionstest        | Befund-ID im Namen                                    | `it('B-183: leeres Feld wird geleert', …)`   |
| `data-testid`          | `<bereich>-<gegenstand>[-<zustand>]`, kebab-case      | `customer-list-row`, `confirm-dialog-accept` |

**Sprache:** Code, Bezeichner, Kommentare, Commits, Doku-Dateinamen in
**Englisch**; Oberflächentexte, Fehlermeldungen für Nutzer und die Doku-Inhalte
unter `docs/` in **Deutsch** (wie im Bestand).

---

## 4. Rendering, Datenfluss, Caching

### 4.1 Grundmodell

- **SSR an**, Nitro-Preset `node-server`. Erster Aufruf liefert vollständiges
  HTML, danach arbeitet die App als SPA — genau wie heute.
- **Kein statisches Prerendering** für Anwendungsseiten (alles ist
  sitzungsabhängig). `routeRules` setzt für `/**` `ssr: true`, für
  `/api/public/**` eigene Header (§9.3).
- Seiten holen Daten mit `useFetch` / `useAsyncData`. **Direkte `$fetch`-Aufrufe
  im Setup einer Seite sind verboten** (doppelter Abruf bei Hydration); `$fetch`
  ist für Mutationen und Ereignishandler da.

### 4.2 Listen (Kernmuster, gilt für jede Liste)

Das alte Muster (nur-gesetzte Query-Keys, `lastResult`-Fallback,
Seitenreset beim Filterwechsel) wird als **ein** Composable umgesetzt:

```ts
// app/composables/useListQuery.ts  (Skizze, verbindlich im Verhalten)
const {
  rows,
  total,
  page,
  pageCount,
  pending,
  error,
  setFilter,
  setPage,
  refresh
} = useListQuery('/api/customers', {
  filters: { q: '', kind: 'all', archived: 'active' }
})
```

Verbindliche Eigenschaften:

1. **Serverseitige Pagination, fix 25.** Kein Größenwähler. Der Client sendet
   `page`, das Schema erzwingt `size = 25` (B-060).
2. **Filterwechsel setzt `page` auf 1.** Im Composable erzwungen, nicht je Seite.
3. **Stale-while-revalidate:** Beim Wechsel von Filter oder Seite bleiben die
   alten Zeilen sichtbar, bis die neuen da sind. Die Tabelle wird nie leer.
   Ein Browsertest sichert das ab ([05](05-teststrategie.md) §4.3).
4. **Filter stehen in der URL** (`?q=&kind=&page=`), damit Zustände teilbar und
   per Zurück-Taste erreichbar sind. Das behebt B-196 und ist die einzige
   bewusste Abweichung im Listenverhalten ([04-ux.md](04-ux.md) §5.1).
5. **Ein Abruf pro Zustand.** Kein zweiter Zählabruf; der Endpoint liefert
   `{ items, total, page, size, pageCount }`.

### 4.3 Detailseiten

- `useFetch('/api/customers/' + id)` mit `key` auf der id. Kein
  Skelett-dann-Daten-Wechsel; die Seite rendert serverseitig fertig.
- Der alte SvelteKit-Sonderfall „Detail-zu-Detail braucht ein keyed Layout"
  entfällt: Vue rendert die Seite bei Parameterwechsel neu, wenn der
  `useFetch`-Key den Parameter enthält. Ein E2E-Test sichert den Wechsel
  Rechnung → Stornorechnung ab (alter Bugklassiker).
- **Nebenkarten laden tolerant.** Eine Karte, für die dem Nutzer das Recht
  fehlt, darf die Seite nicht in den Fehlerzustand ziehen (B-337). Jede
  Nebenkarte holt ihre Daten in einer eigenen `useAsyncData` mit eigenem
  Fehlerzustand.

### 4.4 Mutationen

```ts
const { run } = useBusy()
await run(async () => {
  await $fetch(`/api/customers/${id}`, { method: 'DELETE' })
  notify.success('Kunde archiviert.')
  await refresh()
})
```

- Jede Mutation läuft durch `useBusy().run()` (globale Ladeanzeige, Schutz
  gegen Doppel-Submit) und meldet Erfolg **und** Fehler per Toast
  ([04-ux.md](04-ux.md) §3).
- **Optimistische Updates** für Löschen und Statuswechsel in Listen: die Zeile
  verschwindet sofort, der Abruf bestätigt. Bei Fehler wird zurückgerollt und
  der Fehler-Toast gezeigt.
- Kein „stiller Erfolg", kein „stiller Fehlschlag" — durch Lint-Regel nicht
  erzwingbar, daher **Testpflicht**: jeder Mutations-Endpoint hat einen
  Komponententest, der den Toast prüft.

### 4.5 Caching

- `useFetch`-Ergebnisse leben im Nuxt-Payload und werden bei Navigation
  wiederverwendet. Schlüssel sind explizit (`key:`), damit Refreshs gezielt
  treffen.
- **Serverseitig kein Response-Cache für Anwendungsdaten.** Gecacht wird nur,
  was teuer und unveränderlich ist: gerenderte PDFs (in der Datenbank, wie
  heute), berechnete Feiertage (`useStorage('cache')`, Schlüssel
  `holidays:<bundesland>:<jahr>`).
- `/api/public/**` bekommt `Cache-Control: public, max-age=60` plus `ETag`
  (B-505 — heute fehlen Cache-Header vollständig).

---

## 5. Server-Schicht

### 5.1 Drei Ebenen, klare Zuständigkeit

| Ebene             | Ort                  | Darf                                           | Darf nicht                          |
| ----------------- | -------------------- | ---------------------------------------------- | ----------------------------------- |
| **HTTP**          | `server/api/**`      | Guard, Validierung, Service-Aufruf, Statuscode | Fachlogik, direkte DB-Zugriffe      |
| **Fachlogik**     | `server/services/**` | Drizzle, Transaktionen, Regeln, Fehler werfen  | `H3Event` kennen, HTTP-Codes kennen |
| **Infrastruktur** | `server/utils/**`    | DB-Verbindung, Krypto, Mail, PDF, Guards       | Fachregeln                          |

Services bekommen **einfache Argumente**, keinen `event`. Das macht sie ohne
HTTP testbar und ist die Grundlage für die Unit-Tests in
[05-teststrategie.md](05-teststrategie.md) §4.1.

### 5.2 Aufbau eines Endpoints (verbindliche Reihenfolge)

```ts
// server/api/customers/index.get.ts
export default defineEventHandler(async (event) => {
  requirePermission(event, 'customers') // 1. Guard — IMMER zuerst
  const query = await useValidatedQuery(event, customerListSchema) // 2. Valibot
  return listCustomers(query) // 3. Service
})
```

Regeln:

1. **Guard ist die erste Anweisung.** `requireUser`, `requirePermission` oder
   `requireAnyPermission` aus `server/utils/guards.ts`. Kein Endpoint ohne
   Guard, Ausnahmen nur die drei öffentlichen Bereiche aus §9.
2. **Jede Eingabe wird validiert** — Body, Query, Routenparameter, relevante
   Header, Upload-Metadaten (§6.2).
3. **Der Handler enthält keine Fachlogik.** Mehr als ~15 Zeilen heißt: ab in
   den Service.
4. **Antwortform ist festgelegt**: Listen `{ items, total, page, size, pageCount }`,
   Einzelressourcen das Objekt selbst, Mutationen das geänderte Objekt oder
   `{ ok: true }`. Keine Umschläge wie `{ data, success }`.
5. **Mehrschrittige Schreibvorgänge laufen in einer Transaktion.** Der
   Bestand hat _null_ Transaktionen (B-545) — das ist die Ursache mehrerer
   Befunde (Nummernlücken, halbe Stornos, verwaiste Zeilen). `withTransaction`
   in `server/utils/db.ts` ist Pflicht, sobald mehr als eine Tabelle oder mehr
   als eine Anweisung schreibt.

### 5.3 Services

- Eine Datei je Domäne, benannte Exporte, keine Klassen.
- Fehler werden als **Fachfehler** geworfen (`notFound('Kunde')`,
  `conflict('…')`), nie als rohe Postgres-Fehler durchgelassen.
- Jede Funktion, die Geld, Zeit oder Nummern berechnet, hat einen Unit-Test.

### 5.4 Fehler-Trichter (eine Stelle, ein Format)

`server/utils/errors.ts` erzeugt jeden Fehler:

| Helfer                     | Status | Nutzer sieht (Deutsch)                             | `data.code`                         |
| -------------------------- | ------ | -------------------------------------------------- | ----------------------------------- |
| `badRequest(msg)`          | 400    | `msg`                                              | `BAD_REQUEST`                       |
| `unauthorized()`           | 401    | `Bitte melden Sie sich an.`                        | `UNAUTHORIZED`                      |
| `forbidden()`              | 403    | `Sie haben keine Berechtigung für diesen Bereich.` | `FORBIDDEN`                         |
| `notFound(entity)`         | 404    | `<Entity> nicht gefunden.`                         | `NOT_FOUND`                         |
| `conflict(msg)`            | 409    | `msg`                                              | `CONFLICT`                          |
| `validationFailed(issues)` | 422    | `Bitte prüfen Sie Ihre Eingaben.`                  | `VALIDATION_FAILED` + `data.fields` |
| `tooManyRequests()`        | 429    | `Zu viele Anfragen. Bitte kurz warten.`            | `RATE_LIMITED`                      |
| (alles andere)             | 500    | `Ein interner Fehler ist aufgetreten.`             | `INTERNAL`                          |

- **422** trägt zusätzlich `data.fields: Record<string, string>` — Pfad →
  deutsche Meldung. Der Client hängt sie direkt an die Formularfelder (§6.5).
- **5xx geben nie Interna preis.** Ein Nitro-Error-Plugin loggt das Original
  mit Request-Id und ersetzt die Nachricht.
- Der Bestand benutzt zwei unterschiedliche Heuristiken, um „englische"
  Meldungen zu erkennen und zu verwerfen (B-042, B-044). Beide entfallen:
  **jede** Meldung, die den Nutzer erreicht, stammt aus einem Valibot-Schema
  oder einem Fehler-Helfer und ist per Konstruktion deutsch. Ein Test prüft,
  dass kein Schema ohne deutsche Meldung existiert ([05](05-teststrategie.md) §4.6).

### 5.5 Was nicht mehr existiert

- Keine Remote Functions. Jeder Server-Zugriff ist ein HTTP-Endpoint unter
  `/api/**`, auch der interne. Damit entfällt die gesamte Fehlerklasse rund um
  „Query im Event-Handler braucht `.run()`" (7+ Bugs im Bestand).
- Kein `hooks.ts`-Transportkniff, kein Setup-Gate im Client-Effekt
  (B-001 → Server-Middleware, §9.1).

---

## 6. Validierung mit Valibot (Vorgabe A)

**Valibot ist die einzige Validierungsbibliothek.** Keine `zod`, keine
`yup`, keine handgeschriebenen `if`-Prüfungen neben einem Schema.

### 6.1 Ein Ort pro Schema

Alle Schemata liegen unter **`nuxt/shared/schemas/`** und werden von Client,
Server und Tests importiert.

```
shared/schemas/
├─ primitives.ts     nameSchema, emailSchema, phoneSchema, ibanSchema, bicSchema,
│                    zipSchema, citySchema, moneySchema, percentSchema,
│                    dateSchema, timeSchema, licensePlateSchema, vinSchema,
│                    hsnSchema, tsnSchema, notesSchema, uuidSchema, …
├─ pagination.ts     listQuerySchema (page ≥ 1, size = 25), sortSchema, searchSchema
├─ env.ts            envSchema (§6.6)
├─ upload.ts         imageUploadSchema, documentUploadSchema (§6.7)
├─ field-labels.ts   Pfad → deutsches Label (Nachfolger von FIELD_LABELS)
├─ customer.ts  vehicle.ts  item.ts  tire.ts  document.ts  order.ts …
└─ external/         ebay.ts (Antworten der eBay-API), webhooks.ts
```

Regeln:

- **Keine Duplikate.** Ein Feld hat genau ein Schema. `customerCreateSchema`
  und `customerUpdateSchema` entstehen per `v.partial` / `v.omit` /
  `v.required` aus einer gemeinsamen Basis, nicht durch Abschreiben.
- **Jeder Pipe-Schritt trägt eine deutsche Meldung.** Ohne Ausnahme. Die
  Primitives tragen sie einmal, alle Module erben sie.
- **Typen werden abgeleitet**, nie parallel gepflegt:
  ```ts
  export const customerCreateSchema = v.object({ … })
  export type CustomerCreate = v.InferOutput<typeof customerCreateSchema>
  ```
  Eine Lint-Regel verbietet `interface`/`type`-Deklarationen in
  `shared/schemas/**`, die nicht `InferOutput`/`InferInput` benutzen.

### 6.2 Wo validiert wird — jede Grenze

| Grenze                  | Mechanismus                               | Schema                               |
| ----------------------- | ----------------------------------------- | ------------------------------------ |
| Request-Body            | `useValidatedBody(event, schema)`         | `<domäne>CreateSchema` u. a.         |
| Query-Parameter         | `useValidatedQuery(event, schema)`        | `listQuerySchema` + Modulfilter      |
| Routenparameter         | `useValidatedParams(event, schema)`       | `v.object({ id: uuidSchema })`       |
| Header (wo relevant)    | `useValidatedHeader(event, name, schema)` | Bearer-Token, eBay-Signaturen        |
| Formulare               | `<UForm :schema="…">`                     | **dasselbe** Schema wie der Endpoint |
| Umgebungsvariablen      | Nitro-Plugin beim Start                   | `envSchema`                          |
| Antworten externer APIs | `v.parse` direkt nach dem Abruf           | `shared/schemas/external/*`          |
| Webhook-Payloads        | `v.safeParse` vor jeder Verarbeitung      | `webhooks.ts`                        |
| Datei-Uploads           | Typ, Größe, Anzahl vor dem Schreiben      | `upload.ts`                          |

Die vier `useValidated*`-Helfer liegen in `server/utils/validate.ts`. Sie
kapseln `v.safeParse`, erzeugen bei Misserfolg `validationFailed(issues)` und
sind der **einzige** Weg, Eingaben zu lesen. `readBody`/`getQuery` direkt
aufzurufen ist verboten und wird durch eine ESLint-`no-restricted-imports`-artige
Regel (`no-restricted-globals` auf die Nitro-Auto-Imports) verhindert.

**Warum eigene Helfer statt `readValidatedBody`?** Zwei Gründe, beide belegt:

1. **h3 kann es nicht.** In der h3-Version, die Nuxt 4.5 mitbringt, erwarten
   `readValidatedBody`, `getValidatedQuery` und `getValidatedRouterParams` eine
   Funktion `(data: unknown) => T`. Sie erkennen **kein** Standard Schema —
   ein Valibot-Schema direkt zu übergeben funktioniert nicht, auch wenn die
   JSDoc-Beispiele das nahelegen. Man müsste ohnehin überall
   `readValidatedBody(event, d => v.parse(Schema, d))` schreiben.
2. **Das Fehlerformat muss an genau einer Stelle entstehen** (§5.4) und darf
   nicht davon abhängen, wie eine künftige h3-Version Validierungsfehler
   verpackt.

### 6.2.1 Deutsche Meldungen zentral

Valibot erlaubt, die Standardmeldungen global zu setzen:

```ts
import * as v from 'valibot'
import '@valibot/i18n/de'
v.setGlobalConfig({ lang: 'de' })
```

Damit sind **alle** eingebauten Meldungen deutsch, ohne dass jeder Pipe-Schritt
einen Text mitschleppt. Die alte Regel „jeder Pipe-Schritt braucht eine
deutsche Meldung" wird dadurch abgelöst durch:

- **Standardfälle** (Typ, Länge, Format) nutzen die deutschen Vorgaben.
- **Fachliche Meldungen** werden ausgeschrieben, wenn der Standardtext dem
  Nutzer nicht weiterhilft — z. B. „Die IBAN ist ungültig. Bitte ohne
  Leerzeichen eingeben." statt „Ungültiges Format".
- Der Querschnittstest aus [05-teststrategie.md](05-teststrategie.md) §4.6
  prüft, dass keine Meldung englisch beim Nutzer ankommt.

### 6.3 Dasselbe Schema auf beiden Seiten

Nuxt UI 4 führt `valibot` als Peer-Dependency und akzeptiert Standard-Schema-
Validatoren direkt:

```vue
<UForm :schema="customerCreateSchema" :state="state" @submit="save">
  <UFormField label="Nachname" name="lastName" required>
    <UInput v-model="state.lastName" data-testid="customer-last-name" />
  </UFormField>
</UForm>
```

- Der Client prüft beim Absenden (`validate-on="submit"`), zeigt Feldfehler und
  eine deutsche Fehlerzusammenfassung. Das entspricht der alten Regel
  „Validierung zum Klickzeitpunkt".
- **Der Server prüft immer erneut.** Die Clientprüfung ist Komfort, nie
  Sicherheit.
- **Speichern-Buttons werden nie wegen fehlender Eingaben deaktiviert** — nur
  wegen laufender Anfrage (`useBusy`). Übernommen aus dem Bestand.

### 6.4 Verhältnis zu Drizzle (bewusste Entscheidung)

> **Drizzle ist die Wahrheit über das Datenbankschema. Valibot ist die Wahrheit
> über Ein- und Ausgaben. Keins wird aus dem anderen generiert.**

Geprüft wurde die Alternative, Schemata mit `drizzle-valibot`
(`createInsertSchema`) aus den Tabellen abzuleiten. **Das Paket scheidet schon
an seinem Zustand aus**: letztes stabiles Release 0.4.2 vom 2025-05-20, die
zugehörige Dokumentation beschreibt bereits Drizzle 1.0, das es als stabile
Version nicht gibt. Unabhängig davon spricht fachlich dagegen:

- API-Eingaben sind **nicht** tabellenförmig: Serverfelder (`id`,
  `customerNumber`, `createdAt`) dürfen nicht vom Client kommen (B-182),
  Belege nehmen verschachtelte Positionen entgegen, Formulare bündeln mehrere
  Tabellen.
- Generierte Schemata tragen **keine deutschen Meldungen**. Jedes Feld müsste
  ohnehin einzeln verfeinert werden — dann ist die Ableitung nur noch
  Umweg und versteckt, was gilt.
- Datenbankgrenzen (`varchar(200)`) sind nicht automatisch fachliche Grenzen.

**Stattdessen sichert ein eigener Drift-Test die Kopplung** (T-005). Er liest
die Tabellenmetadaten direkt aus Drizzle (`getTableColumns(table)`) — ohne
Zusatzpaket — und prüft für jede Tabelle:

- Jede Spalte, die über die API beschreibbar ist, kommt in einem Schema vor.
- Jedes Schemafeld entspricht einer Spalte (oder ist ausdrücklich als
  abgeleitet markiert).
- Kein `maxLength` eines Schemas ist größer als die Spaltenbreite — damit
  können Postgres-Fehler wegen zu langer Werte nicht mehr auftreten (B-556).
- Jede `notNull`-Spalte ohne Vorgabewert ist im Anlege-Schema Pflicht.

### 6.5 Vom Valibot-Fehler zur Anzeige (eine Stelle)

```
v.safeParse  →  issues[]  →  toFieldErrors(issues)  →  422 { fields: { "items.0.quantity": "Menge (Position 1): Pflichtfeld." } }
                                                             │
                                    useApi() fängt 422  ─────┴──→ UForm-Feldfehler + Toast „Bitte prüfen Sie Ihre Eingaben."
```

- `toFieldErrors` (in `server/utils/validate.ts`) übersetzt den Issue-Pfad über
  `shared/schemas/field-labels.ts` ins Deutsche. Array-Indizes werden zu
  „(Position N)" — wie im Bestand.
- **Jeder neue Schema-Feldschlüssel braucht ein Label.** Ein Test läuft über
  alle Schemata und schlägt fehl, wenn ein Schlüssel ohne Label existiert
  ([05](05-teststrategie.md) §4.6). Das behebt die schleichende Lücke des
  Bestands.
- Interne Details (Schemaname, erwarteter Typ, empfangener Wert) verlassen den
  Server nie.

### 6.6 Umgebungsvariablen

`shared/schemas/env.ts` beschreibt jede Variable. Ein Nitro-Plugin
(`server/plugins/00.env.ts`) validiert beim Start und **bricht ab**, wenn
etwas fehlt oder unplausibel ist.

| Variable             | Pflicht          | Regel                                                                                                       |
| -------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | ja               | `postgres(ql)?://…`, **kein Default** (B-559)                                                               |
| `APP_SECRET`         | ja               | ≥ 32 Zeichen, **kein Fallback** — heute läuft die Produktion womöglich mit dem Entwicklungs-Secret (B-558)  |
| `APP_ENCRYPTION_KEY` | in Produktion ja | ≥ 32 Zeichen; in der Entwicklung Ableitung aus `APP_SECRET` erlaubt                                         |
| `ORIGIN`             | in Produktion ja | absolute URL                                                                                                |
| `API_TOKENS`         | nein             | kommagetrennt, je ≥ 16 Zeichen; leer ⇒ öffentliche API antwortet 503 statt stillschweigend alles abzulehnen |
| `EBAY_*`             | nein             | nur gemeinsam gültig; teilweise gesetzt ⇒ Startfehler                                                       |
| `TZ`                 | ja               | fest `Europe/Berlin` (B-512 — Slot-Berechnung hängt heute an der Container-Zeitzone)                        |
| `SMTP_*`             | —                | nicht in der Umgebung; SMTP lebt in der Datenbank (verschlüsselt)                                           |

Die Meldung nennt die fehlende Variable, nie ihren Wert.

### 6.7 Uploads

- Übertragung als **`multipart/form-data`**, nicht mehr als Base64 in JSON
  (B-112: +33 % Last, ganze Datei im Speicher, kein Fortschritt).
- `upload.ts` prüft **Anzahl, Größe je Datei, Gesamtgröße und MIME-Typ**;
  zusätzlich prüft der Server die **Magic Bytes**, weil der Client-MIME-Typ
  lügen darf (B-248).
- Bilder werden serverseitig mit `sharp` auf eine Maximalkante verkleinert und
  als WebP gespeichert; das Original wird verworfen. Grenzwerte stehen in
  [04-ux.md](04-ux.md) §7.

---

## 7. Datenhaltung

### 7.1 Schema

Das Schema des Bestands (53 Tabellen) wird **fachlich unverändert übernommen**
und dabei nach `nuxt/server/database/schema/` aufgeteilt (eine Datei je
Domäne statt einer Datei mit 2 025 Zeilen). Vollständiger Katalog:
[`inventar/datamodel.md`](inventar/datamodel.md).

Verbindliche Bereinigungen (jede mit Befund-Beleg, Details in
[06-arbeitsplan.md](06-arbeitsplan.md) T-005):

1. **Echte Enums bzw. CHECK-Constraints** für alle Diskriminatoren
   (heute `varchar` ohne Prüfung).
2. **Indizes** auf allen Fremdschlüsseln und auf allen Spalten, nach denen
   sortiert oder gefiltert wird.
3. **Fehlende Unique-Constraints** ergänzen (Personalnummer, ein Inserat je
   Fahrzeug, Legacy-Nummern partiell).
4. **Fehlende Fremdschlüssel** deklarieren.
5. **Tote Tabellen und Spalten entfernen** (`public_holidays`,
   `recurring_entries`, …).
6. **`updatedAt` per `$onUpdate`** statt 45 manueller Zuweisungen.
7. **`ON DELETE RESTRICT`** für GoBD-relevante Kindtabellen.
8. **Zeittypen korrigieren** (`workshop_hours` als `time`).

9. **Geldbeträge sind Ganzzahlen in Cent** statt `numeric(12,2)` (B-027,
   entschieden in [08-entscheidungen.md](08-entscheidungen.md) E-10). Betroffen
   sind 22 Spalten: Belegsummen, Positionen, Preise, Einkaufspreise, Gehälter,
   Stundenlohn, Buchungsbeträge, Zahlungen. Umgerechnet wird ausschließlich an
   der Oberfläche. Prozentsätze, Mengen, Stunden, Profiltiefen und
   Geokoordinaten bleiben `numeric` — das sind keine Geldbeträge.
10. **Kundenart wird ein ausdrückliches Feld** (`privat | firma | ebay`) statt
    einer Ableitung aus dem Firmenfeld (B-200, E-16).
11. **Löschregeln nach E-11**: Kaskade für alles, was zu einem Kunden gehört;
    Sperre für alles Belegnahe. Kein stilles Entkoppeln auf `NULL`.

**Nach der Modelldurchsicht kommen hinzu**
([09-modellaenderungen.md](09-modellaenderungen.md), gewinnt im Zweifel):

12. **Ein Ereignisprotokoll** ersetzt weitere Versionstabellen (M-01). Es
    bleiben genau drei: Reifenpreis, Artikelpreis, Gehaltsstand — Werte, die
    **ab einem Datum** gelten und in der Zukunft liegen dürfen.
13. **Der Beleg friert beim Ausstellen ein** (M-03): Firmendaten, Kundenname
    und -anschrift, Steuernummer, Bezeichnungen, Preise und Steuersatz werden
    hineinkopiert. Die Firmeneinstellung wird **nicht** versioniert.
14. **Das Fahrzeug überlebt den Kunden** (M-05). Der Halter-Verweis sperrt;
    ein Statusfeld unterscheidet Kundenfahrzeug, Bestand und verkauft. Dazu
    eine **Halter-Historie** (M-06).
15. **Gestrichen:** die Tabelle `time_entries` (M-10), der Verweis
    `work_orders.invoice_id` (M-08), der sperrende Einzelverweis
    `work_order_items.employee_id` (M-11), die Belegarten Angebot und
    Auftragsbestätigung (M-15), `tire_storage` in seiner alten Form (M-17).
16. **Der Radsatz** gehört zum Fahrzeug, kennt montiert und eingelagert, und
    trägt die Wechsel-Erinnerung (M-17, M-19).
17. **Die Belegnummer** wird erst beim Ausstellen gezogen, in einer
    Transaktion mit Zeilensperre (M-14, P-02).
18. **Der Kassenbuch-Saldo ist kein Feld** (M-23, P-09), jede Buchung nennt
    ihre Herkunft (M-25) und kann einen Beleganhang tragen (M-27).
19. **Das Versandprotokoll** verweist allgemein auf Art und Kennung eines
    Vorgangs, nicht mehr nur auf einen Beleg (M-34).
20. **Importierte Belege** behalten ihre Originalnummer in einem eigenen Feld
    und sind unveränderlich (M-29, M-30, P-08).

### 7.2 Migrationen

- **Eine Baseline.** Sie entsteht aus dem bereinigten Schema und ist der
  Ausgangspunkt jeder Installation. Grund: die Snapshot-Kette des Bestands ist
  seit Migration 0007 gebrochen, `drizzle-kit generate` war dort unbrauchbar
  (B-543). Da die Anwendung mit **leerer Datenbank** startet
  ([08-entscheidungen.md](08-entscheidungen.md) E-20), gibt es keine
  Bestandsdaten abzugleichen und keine Migrationstabelle zu reparieren.
- Migrationen laufen **nie im Request**. `node scripts/migrate.mjs` läuft vor
  dem Serverstart, wie heute.
- Jede Migration ist **idempotent** (`IF NOT EXISTS`, `DO $$ … EXCEPTION`).
- Datenmigrationen (Statuscodes, Zahlungsarten, ggf. Cents) sind eigene,
  nummerierte Schritte mit Rückrollpfad in der Release-Notiz.

### 7.3 Seeds

`seedDefaults()` bleibt idempotent (Rollen, Mailvorlagen, Buchungskategorien,
Nummernkreise, Öffnungszeiten, Arbeitszeit-Artikel) — aber **nicht mehr im
ersten Request**. Es läuft als Nitro-Startaufgabe nach der Migration. Der
Bestand blockiert nach einem einmaligen Seed-Fehler dauerhaft alle Requests
(B-015).

### 7.4 Transaktionen

`withTransaction(async (tx) => …)` in `server/utils/db.ts`. Pflicht für:
Nummernvergabe + Insert, Beleg + Positionen + PDF, Storno, Auftragsabschluss,
Ankauf/Verkauf, Import, Rollenänderungen, jede Löschung mit Guard-Zählung.

---

## 8. Oberfläche

### 8.1 Kein eigenes CSS

- Genau **eine** CSS-Datei: `app/assets/css/main.css` mit
  `@import "tailwindcss";` und `@import "@nuxt/ui";` sowie dem `@theme`-Block
  für die Design-Tokens. Sonst nichts.
- **Keine `<style>`-Blöcke** in Komponenten. Durch ESLint-Regel
  (`vue/no-restricted-block`) erzwungen.
- Aussehen, Abstände und Varianten kommen aus **`app/app.config.ts`**
  (`ui`-Schlüssel: Farben, Radius, Defaults je Komponente). Wiederkehrende
  Abweichungen werden dort als Variante definiert, nicht am Einsatzort
  wiederholt.
- **Tailwind-Utilities nur für Layout** (`grid`, `flex`, `gap-*`) und nur,
  wenn Nuxt UI nichts anbietet. Mehr als drei Utility-Klassen an einer
  Nuxt-UI-Komponente gilt als Hinweis auf die falsche Komponente oder eine
  fehlende Variante in `app.config.ts`.

### 8.2 Eigene Komponenten

Eigene Komponenten sind **dünne Schalen um Nuxt UI**, die ein Muster
festschreiben. Vollständiger Katalog und Zuordnung zum Bestand:
[04-ux.md](04-ux.md) §4.

| Eigene Komponente   | Basiert auf                                 | Ersetzt im Bestand                                |
| ------------------- | ------------------------------------------- | ------------------------------------------------- |
| `ListPage`          | `UDashboardPanel`, `UCard`                  | Kopf + Toolbar + Tabelle + Pagination je Liste    |
| `DataTable`         | `UTable`                                    | `<table class="table">` mit klickbaren Zeilen     |
| `FilterBar`         | `UInput`, `UTabs`, `USelect`                | `Toolbar.svelte`                                  |
| `EntityPicker`      | `UModal`, `UInput`, `UTable`, `UPagination` | `SearchablePicker.svelte`                         |
| `MultiEntityPicker` | dito + Auswahlspalte                        | `MultiSearchablePicker.svelte`                    |
| `ConfirmDialog`     | `UModal`                                    | `ConfirmDialog.svelte`                            |
| `FormPage`          | `UForm`, `UCard`                            | Formularseiten-Rahmen inkl. Dirty-Guard           |
| `EmptyState`        | `UCard`                                     | `EmptyState.svelte`                               |
| `PdfViewer`         | `<iframe>` + Blob-URL                       | `PdfViewer.svelte`                                |
| `FileDropzone`      | `UFileUpload`                               | `ImageUploader.svelte`, `VehicleDocuments.svelte` |

### 8.3 Datum und Uhrzeit im Formular

Nuxt UI hat **keinen fertigen Datepicker**. `UInputDate` ist ein segmentiertes
Datumsfeld, `UCalendar` ein Monatsraster, und beide arbeiten **ausschließlich**
mit Objekten aus `@internationalized/date` (`CalendarDate`,
`CalendarDateTime`) — nicht mit `string` und nicht mit `Date`. Der Datepicker
entsteht aus `UInputDate` + `UPopover` + `UCalendar`.

Daraus folgt eine verbindliche Umrechnungsschicht in
`shared/utils/date.ts`:

| Ebene             | Darstellung                                                             |
| ----------------- | ----------------------------------------------------------------------- |
| Datenbank und API | ISO-Zeichenkette `YYYY-MM-DD` (fachliche Tage) bzw. `timestamptz`       |
| Valibot-Schema    | `dateSchema` prüft die ISO-Zeichenkette                                 |
| Formularzustand   | `CalendarDate`                                                          |
| Umrechnung        | `toCalendarDate(iso)` / `toIsoDate(calendarDate)`, beide mit Unit-Tests |

Eine eigene Komponente `DateField` kapselt das Trio, sodass die Umrechnung an
genau einer Stelle passiert und Formulare weiterhin mit ISO-Zeichenketten
arbeiten. Zeitzone ist fest `Europe/Berlin` (§6.6).

### 8.4 Zustand

- **`useState`** für sitzungsweiten Zustand (Benutzer, Rechte, Busy-Zähler,
  Creation-Flow-Stapel). Kein Pinia.
- **Keine lokalen `busy`-Flags.** `useBusy()` ist die einzige Quelle; sie
  speist `<NuxtLoadingIndicator>`, den Ladezustand der Buttons und das
  Overlay ab 250 ms.
- **Toasts** kommen ausschließlich aus `useNotify()` (dünne Schale um
  `useToast()`), damit Dauer, Farbe und Wortlaut einheitlich bleiben.

---

## 9. Auth, Berechtigungen, öffentliche Bereiche

Vollständige Begründung und Migrationsschritte:
[`inventar/research-auth.md`](inventar/research-auth.md).

### 9.1 Sitzung

- **better-auth 1.7.4** mit dem `username`-Plugin, Drizzle-Adapter, Tabellen
  `users`/`sessions`/`accounts`/`verifications` **unverändert**. Gleiches
  `APP_SECRET`, gleicher Cookie-Präfix `tcm` ⇒ keine Datenmigration, keine
  Passwort-Zurücksetzung, bestehende Sitzungen bleiben gültig.
- `server/middleware/01.auth.ts` füllt `event.context.auth`
  (`{ session, user, permissions }`) für jeden Request. Deaktivierte Konten
  werden pro Request geprüft und beim Anmelden über einen
  `session.create.before`-Hook abgewiesen.
- **Setup-Gate und Auth-Gate laufen serverseitig** (Middleware), nicht wie
  heute in einem Client-Effekt (B-001).
- Idle-Logout (60 min) als Client-Plugin, jetzt mit **Vorwarnung** und
  Synchronisierung zwischen Tabs über `BroadcastChannel` (B-013).

### 9.2 Rechte

`shared/permissions.ts` übernimmt `MODULE_PERMISSIONS` unverändert: ein
Schlüssel je Modul, Platzhalter `*`, Sonderfall `hours:write_own`. Geprüft
wird an drei Stellen:

1. **Server**: `requirePermission(event, 'customers')` als erste Anweisung.
2. **Route**: `definePageMeta({ permission: 'customers' })` +
   globale Middleware → Weiterleitung auf eine 403-Seite statt eines leeren
   Bildschirms.
3. **Navigation**: Sidebar filtert Einträge und leere Gruppen.

Die Anzeige ist **Komfort**, der Server ist die Autorität. Für jeden Endpoint
gibt es einen Integrationstest, der den Verweigerungsfall prüft.

### 9.3 Öffentliche Bereiche (die einzigen Ausnahmen vom Auth-Gate)

| Pfad                         | Zweck                | Schutz                                                                                                                                      |
| ---------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/auth/**`               | better-auth          | eigener Rate-Limit, Origin-Prüfung                                                                                                          |
| `/api/public/**`             | REST-API der Website | Bearer-Token aus `API_TOKENS`, `timingSafeEqual`, Rate-Limit je Token-Präfix, **CORS auf die Website-Herkunft begrenzt** (heute `*`, B-505) |
| `/api/ebay/account-deletion` | eBay-Pflichtendpunkt | Challenge-Hash mit `EBAY_VERIFICATION_TOKEN`                                                                                                |
| `/login`, `/setup`           | Seiten               | —                                                                                                                                           |

### 9.4 Wiederkehrende Arbeit

Der Bestand hat bewusst keinen Scheduler: Zahlungserinnerungen und
Reifen-Erinnerungen laufen nur, wenn jemand „Jetzt prüfen" drückt. Grund war,
dass SvelteKit dafür nichts mitbrachte.

**Nitro bringt es mit.** `scheduledTasks` funktioniert im Preset
`node-server`, und `runTask()` erlaubt es, dieselbe Aufgabe manuell
auszulösen. Deshalb:

- Die fachliche Arbeit lebt in `server/tasks/<name>.ts` — **eine** Umsetzung.
- Der Knopf „Jetzt prüfen" ruft `runTask('<name>')` über einen bewachten
  Endpoint auf und bleibt erhalten.
- **Der Zeitplan ist eingeschaltet**: werktags 7:30 Uhr (Europe/Berlin) für
  Zahlungserinnerungen und Reifen-Erinnerungen
  ([08-entscheidungen.md](08-entscheidungen.md) E-12). Über `runtimeConfig`
  abschaltbar.
- Jede Aufgabe ist **wiederholsicher**: zweimal ausgeführt verschickt sie
  nichts doppelt. Bei einem eingeschalteten Zeitplan ist das keine Kür, sondern
  Voraussetzung.

---

## 10. Konfiguration

- `runtimeConfig` in `nuxt.config.ts` ist die **einzige** Stelle, an der
  Umgebungswerte in die Anwendung kommen. `process.env` direkt zu lesen ist
  außerhalb von `server/plugins/00.env.ts` verboten.
- Secrets stehen nur in `runtimeConfig` (serverseitig), nie in
  `runtimeConfig.public`.
- Geheimnisse in der Datenbank (SMTP-Passwort, eBay-Token) bleiben
  AES-256-GCM-verschlüsselt (`server/utils/crypto.ts`, Format `v1:iv:tag:data`
  wie heute, inklusive Weiterleitung alter Klartextzeilen).

---

## 11. Fehlerbehandlung im Client

- `useApi()` kapselt `$fetch` und ist der einzige erlaubte Weg zu `/api/**`
  aus dem Client. Es:
  1. hängt Anmeldedaten an,
  2. übersetzt 401 in eine Weiterleitung zum Login (heute nur ein Toast, B-014),
  3. reicht 422-Feldfehler an das Formular zurück,
  4. erzeugt bei allen anderen Fehlern einen Fehler-Toast mit dem kuratierten
     deutschen Text,
  5. protokolliert das Original in der Konsole.
- `app/error.vue` rendert Seitenfehler mit statusabhängigem Text und zwei
  Aktionen („Zurück", „Zum Dashboard").
- **Kein stiller `catch`.** ESLint verbietet leere Catch-Blöcke.

---

## 12. PDF, XRechnung, DATEV

- **pdf-lib bleibt.** Es ist seit Jahren unverändert, aber vollständig, ohne
  Systemabhängigkeiten und ohne Browser. Der Renderer wird portiert, nicht neu
  erfunden; die 16 committeten Pixel-Vergleichsbilder dienen als
  Abnahmekriterium für den Port (T-023).
- Rendern bleibt **byte-deterministisch** (Datum aus `updatedAt`), PDFs bleiben
  in der Datenbank zwischengespeichert, ausgeliefert über
  `/api/pdf/<typ>/<id>`; Metadaten und Bytes sind getrennte Endpoints.
- XRechnung und DATEV bleiben eigene Dienste; die in
  [02-befunde.md](02-befunde.md) belegten Formatfehler werden dabei behoben.

---

## 13. Tests

Vollständig in [05-teststrategie.md](05-teststrategie.md). Kurz:
Vitest-Projekte `unit` (Node), `nuxt` (Nuxt-Runtime), `browser`
(Vitest Browser Mode), `integration` (echte Test-Datenbank), `e2e`
(Playwright über `@nuxt/test-utils/playwright`). Coverage mit V8, Schwellwerte
steigen nur. Jeder behobene Befund bekommt einen Regressionstest mit der
Befund-ID im Namen.

---

## 14. CI und Release

### 14.1 Pipeline (GitHub Actions, `origin` ist GitHub)

| Job         | Läuft           | Inhalt                                                                                                       |
| ----------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| `lint`      | jeder Push/PR   | `pnpm lint` (ESLint inkl. Formatprüfung)                                                                     |
| `typecheck` | jeder Push/PR   | `pnpm typecheck` (`nuxt typecheck`)                                                                          |
| `test`      | jeder Push/PR   | `pnpm test:unit`, `test:nuxt`, `test:integration` gegen einen Postgres-Service-Container, Coverage-Schwellen |
| `browser`   | jeder Push/PR   | `pnpm test:browser` (Chromium)                                                                               |
| `e2e`       | jeder Push/PR   | Produktionsbuild + Fixture-DB + Golden Flows                                                                 |
| `docs`      | jeder Push/PR   | `pnpm docs:check` — jede Feature-ID hat eine Seite, jeder Endpoint einen Eintrag, keine toten Links          |
| `release`   | Push auf `main` | `semantic-release`                                                                                           |

Ein PR ist nur mergebar, wenn alle Jobs grün sind. Das schließt die größte
Betriebslücke des Bestands (gar keine CI, B-556).

### 14.2 Commits und Releases

- **Conventional Commits**, erzwungen durch `commitlint` im
  `commit-msg`-Hook. Erlaubte Typen: `feat`, `fix`, `perf`, `refactor`,
  `docs`, `test`, `build`, `ci`, `chore`, `revert`.
- **Scope = Arbeitspaket oder Modul**, z. B. `feat(customers): …`.
- `semantic-release` auf `main` mit:
  `@semantic-release/commit-analyzer`, `release-notes-generator`
  (Preset `conventionalcommits`), `@semantic-release/changelog`,
  `@semantic-release/npm` (`npmPublish: false`, nur Versionsstand),
  `@semantic-release/git`, `@semantic-release/github`.
- Der Container wird mit `nextRelease.version` getaggt
  (`@semantic-release/exec`), damit Image-Tag und CHANGELOG übereinstimmen.
- Husky-Hooks: `pre-commit` → `lint-staged` (`eslint --fix`),
  `commit-msg` → `commitlint`, `pre-push` → `pnpm test:unit`.

---

## 15. Deployment

### 15.1 Ziel

Unverändert: ein Podman-Pod auf einem Debian-Server, Caddy davor, PostgreSQL
daneben, Update per Registry-Push und `podman auto-update`
([`inventar/ops.md`](inventar/ops.md) §4). Der Rewrite ändert nur den Inhalt des
Images.

### 15.2 Image

- Mehrstufiger Build auf `node:24-slim` (Nuxt verlangt ≥ 22.19/24.11).
- Laufzeit enthält nur `.output/`, `node_modules` der Produktion,
  `server/database/migrations/`, `scripts/migrate.mjs` und `mdbtools`.
- `CMD ["sh","-c","node scripts/migrate.mjs && node .output/server/index.mjs"]` —
  gleiche Absicherung wie heute.
- **Nicht als `root`** laufen (heute ungeprüft), Healthcheck auf
  `/api/health`, `TZ=Europe/Berlin` gesetzt.
- Multipart-Uploads machen `BODY_SIZE_LIMIT` überflüssig; die Obergrenze
  steht in Nitro (`routeRules`) und im Upload-Schema.

### 15.3 Risiken beim Umzug

| Risiko                                         | Umgang                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| OTel-Shim für better-auth war im Bestand nötig | Im ersten Produktionsbuild gezielt prüfen (T-007), Shim nur wenn belegt nötig          |
| Squash-Baseline trifft die Migrationstabelle   | Cutover-Skript + Vorab-Backup, in T-042 beschrieben                                    |
| Alte Cookies müssen gültig bleiben             | `APP_SECRET` und Cookie-Präfix unverändert; E2E prüft Anmeldung mit bestehendem Nutzer |

---

## 16. Dokumentation (Vorgabe B)

Die Dokumentation ist **Teil der Definition of Done jedes Arbeitspakets**, nicht
eine Aufgabe am Ende. Aufbau, Vorlagen und Prüfungen stehen in
[06-arbeitsplan.md](06-arbeitsplan.md) T-003; die Regeln:

```
docs/
├─ index.md            Einstieg; alles in höchstens zwei Klicks erreichbar
├─ features/           EINE Seite je Feature-ID: F-001-….md
├─ api/                EIN Eintrag je Endpoint: Methode, Pfad, Schemata, Rechte, Fehler, Beispiel
├─ data/               Datenmodell, Tabellen, Relationen, Indizes, Migrationsstrategie
├─ ui/                 Komponentenkatalog: Props, Events, Slots, Beispiel, Nuxt-UI-Basis
├─ architecture/       Systemüberblick, Ordner, Datenfluss, Rendering, Auth, Fehler
├─ decisions/          je Entscheidung eine Seite: Kontext, Optionen, Entscheidung, Folgen
└─ guides/             Umgebung, Tests, Release, Deployment, Betrieb, Fehlersuche
```

Verbindlich:

- **Einheitliches Frontmatter** je Kategorie (`title`, `id`, `status`,
  `updated`, `permission`, `routes`, `endpoints`, `tables`, `schemas`,
  `tests`) — damit die Seiten maschinell prüfbar bleiben.
- **Dicht verlinkt**: Feature → Endpoints → Schemata → Tabellen → Komponenten
  → Tests. Relative Links.
- **Nur was stimmt.** Nicht Umgesetztes trägt `status: geplant`.
- **Generiert, wo es geht**: `docs/api/` wird aus den Endpoint-Dateien und
  ihren Valibot-Schemata erzeugt (`pnpm docs:api`), `docs/data/` aus dem
  Drizzle-Schema (`pnpm docs:data`). Handgeschrieben bleibt, was Bedeutung
  trägt: Features, Architektur, Entscheidungen, Anleitungen.
- **`pnpm docs:check`** bricht ab bei: Feature-ID ohne Seite, Endpoint ohne
  Eintrag, totem Link, fehlendem Frontmatter-Feld, Seite ohne `updated`.
- Die vorhandene Wissensbasis des Bestands (`docs/architecture/`,
  `docs/modules/`, `docs/decisions/`, `docs/integrations/`, `docs/domain/`,
  `docs/operations/`) wird **übernommen und ausgebaut**: fachliche Inhalte
  (Geschäftsregeln, Belegarten, GoBD, Feiertage, Import-Eigenheiten) wandern in
  die neue Struktur; technisch überholte Seiten werden beim Cutover entfernt,
  bis dahin bleiben sie als Referenz für die Umsetzung liegen und sind in
  `docs/index.md` als „Bestand (alt)" gekennzeichnet.

---

## 17. Zusammenfassung der harten Regeln

1. **pnpm** ausschließlich — kein npm, kein yarn, keine `package-lock.json`.
2. **ESLint formatiert.** Prettier existiert nicht, auch nicht als Abhängigkeit.
3. **Kein eigenes CSS.** Eine `main.css`, Rest über Nuxt UI und `app.config.ts`.
4. **Nuxt-Bordmittel vor Fremdpaketen.**
5. **Valibot an jeder Grenze**, ein Schema pro Sache, Typen abgeleitet.
6. **Guard als erste Anweisung** in jedem Endpoint.
7. **Serverseitige Pagination, fix 25**, in jeder Liste.
8. **Toast bei jeder Mutation**, Erfolg wie Fehler.
9. **Mehrfachauswahl im modalen Dialog.**
10. **Animationen mit `prefers-reduced-motion`.**
11. **`data-testid` oder Rolle** als Testselektor — nie interne Nuxt-UI-Klassen.
12. **Transaktion**, sobald mehr als eine Anweisung schreibt.
13. **Doku und Tests gehören zum Paket.** Ohne sie ist es nicht fertig.
14. **Altbestand nur lesen.**
