---
title: Inventar Plattform & Shell (SHELL)
teil_von: docs/rewrite/01-inventar.md
stand: Bestand (SvelteKit) vor dem Rewrite
---

> **Detail-Inventar des Bestands.** Erhoben durch vollständiges Lesen der in
> Abschnitt „Gelesene Dateien" genannten Dateien. Die IDs wurden auf die
> globalen IDs aus [01-inventar.md](../01-inventar.md) umgestellt
> (99 IDs). Zurück: [01-inventar.md](../01-inventar.md) ·
> [02-befunde.md](../02-befunde.md)

# Modul: Plattform, Shell, Login, Dashboard, Suche   (Kürzel: SHELL)

Sprache: Deutsch für Fließtext/Tabellen; Code-Bezeichner, Dateipfade, Tabellen-/Spaltennamen bleiben englisch und exakt wie im Code.
Alles muss aus dem tatsächlich gelesenen Code stammen. Keine Vermutungen. Bei Unsicherheit "unklar" schreiben und Fundstelle nennen.
Fundstellen immer als `pfad/datei.ts:zeile`.

Alle Pfade relativ zu `/home/nick/tc/twincars-manager`. App-Version im Stand: `package.json` `1.4.0`.

## 1. Routen und Seiten

| Route | Datei | Parameter | Guard / Permission | Layout | Datenabhängigkeiten (Remote-Queries, Reihenfolge) | Zweck |
|---|---|---|---|---|---|---|
| (alle) | `src/routes/+layout.svelte` | — | Auth-Gate serverseitig in `src/hooks.server.ts:221-229` (303 → `/login?redirectTo=<enc(pathname+search)>`); Setup-Gate **nur clientseitig** (`$effect` → `goto('/setup')`, `src/routes/+layout.svelte:26-30`) | Root; Branch: `/setup*`, `/login` oder `!setupCompleted` → nackter `<div class="min-h-dvh">`; sonst `AppShell` (`+layout.svelte:78-86`) | 1. `await getLayoutContext()` (`+layout.svelte:20`) 2. `await getCurrentUserRemote()` (`:21`) — beide top-level, SSR-dehydriert | Root-Layout: Shell-Umschaltung, Busy-Verdrahtung für Navigation (`beforeNavigate`/`afterNavigate`, `:38-52`), SW-Registrierung nur in Prod / Unregister in Dev (`:62-71`), `<title>TwinCarsManager</title>` statisch (`:74-76`), `<ToastTray />` (`:88`) |
| `/` | `src/routes/+page.svelte` | — | `requireUser()` in beiden Queries (`src/routes/dashboard.remote.ts:18,30`); Nav-Item „Start“ ohne Permission (`navigation.ts:76`) | AppShell | 1. `getDashboardKpis()` als `$derived`-Proxy mit `.current/.loading/.error` (`+page.svelte:23-25`, **kein** top-level await) 2. `await untrack(() => getUpcomingRemote())` top-level (`:26`) | Dashboard „Start“: 8 KPI-Kacheln, „Schnelle Aktionen“, „Anstehende Termine“ |
| `/login` | `src/routes/login/+page.svelte` | `?redirectTo=<path>` (Default `/`, `login/+page.svelte:64`), `?reason=idle` (Info-Alert, `:66-71`) | öffentlich (`PUBLIC_PREFIXES`, `hooks.server.ts:61-72`); kein Redirect für bereits Angemeldete | ohne AppShell (Root-Branch `isLoginRoute`) | keine Remote-Query; `authClient.signIn.username(...)` → `POST /api/auth/sign-in/username` (`:86-89`) | Anmeldeformular (Benutzername + Passwort), zufälliger Hintergrund-Gradient (`:27-38`), Versionsanzeige `Version {__APP_VERSION__}` (`:198-200`) |
| (Fehlerseite) | `src/routes/+error.svelte` | `page.status`, `page.error.message` | — | rendert innerhalb des Root-Layouts (also im AppShell-Slot, wenn angemeldet) | keine | Status-abhängige deutsche Fehlerseite mit „Zurück“ (`history.back()` wenn `history.length > 1`, sonst `goto('/')`) und „Zum Dashboard“ (`+error.svelte:42-48, 67-74`) |
| `/setup` | (anderes Modul; hier nur als Gate relevant) | — | öffentlich (`hooks.server.ts:69`) | eigener Branch ohne AppShell | `setup.remote.ts` (nicht Teil dieses Inventars) | 6-Schritte-Wizard; `completeSetup` weigert sich bei `setupCompleted=true` (`src/routes/setup/setup.remote.ts:278`, nur gegrept) |
| `/api/auth/[...all]` | (Auth-Modul; better-auth catch-all) | — | öffentlich; `POST /api/auth/sign-in/*` rate-limited 10/min/IP (`hooks.server.ts:111-132`) + Deaktivierungs-Check (`:178-202`) | — | — | Session-Plumbing; vom Login/Logout/Idle-Logout genutzt |
| `/settings/account` | (Settings-Modul) | — | — | — | — | Ziel des „Profil“-Links im Benutzermenü (`AppShell.svelte:479`); Route existiert (`src/routes/settings/account/`) |
| `/settings/inquiries` | (Settings/Mailings-Modul) | — | Nav-Permission `mailings` (`navigation.ts:226-230`) | — | — | Nav-Item „Anfragen“ unter „Kommunikation“, physisch unter `/settings` |

Deep-Links/Redirects der Plattform:
- Unauthentifiziert auf nicht-öffentliche Route → `303 /login?redirectTo=<encodeURIComponent(pathname + search)>` (`hooks.server.ts:224-226`).
- Nach Login: `window.location.href = redirectTo` nur wenn `startsWith('/') && !startsWith('//')`, sonst `/` — Full-Document-Load, kein `goto` (`login/+page.svelte:95-105`).
- Idle-Logout: `window.location.href = '/login?reason=idle'` (`AppShell.svelte:130`).
- Logout: `window.location.href = '/login'` (`AppShell.svelte:106`).
- Setup unvollständig: clientseitiges `goto('/setup')` aus jedem Layout-Render außer auf `/setup*` (`+layout.svelte:26-30`).
- Öffentliche Präfixe (exakt oder `prefix/`): `/login`, `/api/auth`, `/api/public`, `/api/ebay/account-deletion`, `/setup`, `/_app`, `/favicon` (`hooks.server.ts:61-75`). Hinweis: `/_app` deckt auch die Remote-Function-Endpoints `/_app/remote/*` ab (Kit-Pfad `node_modules/@sveltejs/kit/src/runtime/server/remote.js:339`), d. h. der Auth-Hook leitet Remote-Calls **nicht** um; Schutz liegt allein bei den Guards in jeder Remote-Funktion.

### 1a. Navigation (vollständig, `src/lib/components/layout/navigation.ts:72-247`)

Filterregel `filterNavigationByPermissions` (`:54-67`): `*` → komplette Liste; sonst Items ohne `permission` immer sichtbar, Items mit `permission` nur wenn im Set; leere Gruppen entfallen. Ohne jede Permission bleibt exakt `['Start']` (`navigation.test.ts:81-87`).

| Gruppe | Label | Icon (`@lucide/svelte`) | Route | `exact` | Permission-Key |
|---|---|---|---|---|---|
| Übersicht | Start | `LayoutDashboard` | `/` | ja | — (immer sichtbar) |
| Übersicht | Kalender | `CalendarDays` | `/calendar` | — | `calendar` |
| Kunden & Fahrzeuge | Kunden | `Users` | `/customers` | — | `customers` |
| Kunden & Fahrzeuge | Fahrzeuge | `Car` | `/vehicles` | — | `vehicles` |
| Kunden & Fahrzeuge | Zu verkaufende Fahrzeuge | `Warehouse` | `/inventory` | — | `inventory` |
| Kunden & Fahrzeuge | Reifenlager | `Disc3` | `/tire-storage` | — | `tires` |
| Aufträge & Rechnungen | Aufträge | `ClipboardList` | `/orders` | — | `orders` |
| Aufträge & Rechnungen | Angebote / Kostenvoranschläge | `FileText` | `/offers` | — | `offers` |
| Aufträge & Rechnungen | Rechnungen | `Receipt` | `/invoices` | — | `invoices` |
| Aufträge & Rechnungen | Offene Rechnungen | `AlertTriangle` | `/reminders` | — | `reminders` |
| Aufträge & Rechnungen | Rechnungsausgangsbuch | `BookOpen` | `/sales-ledger` | — | `ledger` |
| Stammdaten | Leistungen, Material, Artikel | `Package` | `/items` | — | `items` |
| Stammdaten | Reifenkatalog | `CircleDot` | `/tires` | — | `tires` |
| Stammdaten | Lieferanten | `Truck` | `/suppliers` | — | `suppliers` |
| Personal | Mitarbeiter | `Users2` | `/employees` | — | `employees` |
| Personal | Stunden | `Wallet` | `/hours` | — | `hours:write_own` |
| Finanzen | Buchhaltung | `Calculator` | `/ledger` | — | `ledger` |
| Kommunikation | Rundschreiben | `Mail` | `/mailings` | — | `mailings` |
| Kommunikation | Gesendet | `Send` | `/sent` | — | `invoices` |
| Kommunikation | Aktuelle Informationen | `Newspaper` | `/posts` | — | `posts` |
| Kommunikation | Anfragen | `Inbox` | `/settings/inquiries` | — | `mailings` |
| System | Einstellungen | `Settings` | `/settings` | — | `settings` |

Ungenutzte Icon-Importe in `navigation.ts:7,20`: `CalendarClock`, `Gift` (tot). Aktiv-Markierung: `isActive(href, exact)` = `pathname === href || pathname.startsWith(href + '/')` (`AppShell.svelte:135-139`); auf `/settings/inquiries` sind damit „Einstellungen“ **und** „Anfragen“ aktiv. Header-Titel ohne `PageHeader`: exakter Treffer, sonst längstes Präfix über die **ungefilterte** Navigation, Fallback `TwinCarsManager` (`AppShell.svelte:141-154`). Permission-Modell: `src/lib/permissions.ts:27-48` (`MODULE_PERMISSIONS`: customers, vehicles, suppliers, employees, items, offers, invoices, orders, reminders, ledger, calendar, inventory, hours + hours:write_own, mailings, import, settings, users, tires, posts; Wildcard `*`).

## 2. Remote Functions und Endpoints

- **`getLayoutContext`** — query (ohne Schema) — `src/routes/layout.remote.ts:18-24`
  - Guard: **keiner** (dokumentierte Ausnahme, dient Pre-Login-State)
  - Argumente: keine
  - Rückgabe: `{ setupCompleted: boolean, companyName: string }`; `companyName` Fallback `'TwinCarsManager'` bei leerem Wert
  - Fehlerfälle: keine kuratierten
  - Nebenwirkungen: `getSettings()` **legt bei leerer Tabelle eine `company_settings`-Zeile an** (`src/lib/server/services/settings-service.ts:7-14`) — Schreibzugriff in einer anonymen Query
  - Transaktion: nein
- **`getCurrentUserRemote`** — query — `src/routes/layout.remote.ts:37-47`
  - Guard: keiner; liefert `null` für anonyme Aufrufer
  - Rückgabe: `{ id, username: string|null, name, permissions: string[] }` aus `event.locals`
  - Fehlerfälle/Nebenwirkungen: keine; Transaktion: nein
- **`getDashboardKpis`** — query — `src/routes/dashboard.remote.ts:17-20`
  - Guard: `requireUser()` (401 „Bitte melden Sie sich an.“, `src/lib/server/auth-guards.ts:26`) — **keine Modul-Permission**
  - Argumente: keine
  - Rückgabe: `DashboardKpis` `{ customers, vehicles, monthlyIncome, monthlyExpense, monthlyBalance, openInvoices, openReminders, appointmentsToday }` (alle `number`)
  - Fehlerfälle: 401 anonym; sonst 5xx → „Ein interner Fehler ist aufgetreten.“
  - Nebenwirkungen: keine; Transaktion: nein (7 parallele Selects)
- **`getUpcomingRemote`** — query — `src/routes/dashboard.remote.ts:29-32`
  - Guard: `requireUser()`; Rückgabe `UpcomingItem[]` (max. 10): `{ kind:'hu_due', dateIso, title, vehicleId } | { kind:'appointment', dateIso, title, entryId }`
  - Nebenwirkungen: keine; Transaktion: nein
- **`globalSearchRemote`** — query — `src/routes/search.remote.ts:29-49`
  - Guard: `requireUser()` als erste Anweisung; danach Bucket-Filter über `hasPermission(event.locals.permissions, …)`
  - Argumente: `{ q: string }` — `pipe(string('Bitte einen Suchbegriff eingeben.'), trim(), maxLength(200, 'Suchbegriff zu lang.'))` (`:7-13`); Pflicht; keine Mindestlänge im Schema (Service erzwingt ≥ 2 Zeichen)
  - Rückgabe: `GlobalSearchResult` mit 9 immer vorhandenen Arrays: `customers, vehicles, items, tires, tireStorage, suppliers, employees, documents, posts`; `SearchHit = { id, label, sublabel?, type? }`
  - Permission-Mapping (`:34-47`): customers→`customers`, vehicles→`vehicles`, items→`items`, tires+tireStorage→`tires`, suppliers→`suppliers`, employees→`employees`, documents→`invoices` **oder** `offers`, posts→`posts`; nicht erlaubte Buckets werden **leer** zurückgegeben (kein Fehler)
  - Fehlerfälle: 401 anonym; 400 via `handleValidationError` bei > 200 Zeichen (Meldung „Suchbegriff zu lang.“ hat **kein Umlaut** → wird durch die Heuristik zu „Ungültige Eingabe für „Suchbegriff“: Bitte prüfen Sie Ihre Eingabe.“, `hooks.server.ts:439-440`)
  - Nebenwirkungen: keine; Transaktion: nein. Der Service fragt **alle** 9 Buckets ab, gefiltert wird erst danach.

HTTP-Verhalten der Hook-Pipeline (`src/hooks.server.ts:231-255`, Reihenfolge: `ensureSeeded` → `rateLimitSignIn` → `rateLimitPublicApi` → `blockDeactivatedSignIn` → `svelteKitHandler` (better-auth) → `populateAuthLocals` → `requireAuthHandle`):
- `POST /api/auth/sign-in/*` > 10/min pro IP → `429 { message: 'Zu viele Anmeldeversuche, bitte warten Sie eine Minute.' }`, Header `Retry-After` (`:111-132`).
- `/api/public/*` und `/api/ebay/account-deletion*` > 120 + 60 Burst pro Minute pro Bucket (`token:<erste 8 Zeichen>` oder `ip:<ip>`) → `429 { message: 'Zu viele Anfragen. Bitte reduzieren Sie die Aufrufrate.' }` (`:141-167`).
- `POST /api/auth/sign-in/*` mit JSON-Body `username`, dessen Konto `users.active=false` → `403 { message: 'Dieses Konto ist deaktiviert. Bitte wenden Sie sich an die Administration.' }` (`:178-202`); unbekannte Namen fallen an better-auth durch (keine Enumeration).
- Jede Anfrage: `auth.api.getSession` + `isUserActive(userId)` (DB) + `loadUserPermissions(userId)` (2 DB-Queries) → `locals.{session,user,permissions}` (`:204-219`; `src/lib/server/auth-permissions.ts:17-35`).
- Client-IP: erster Eintrag aus `x-forwarded-for`, sonst `getClientAddress()`, sonst `'unknown'` (`:88-99`).

## 3. Services (Server-Layer)

### `src/lib/server/services/dashboard-service.ts`
- `getDashboardKpis(): Promise<DashboardKpis>` (`:44-125`) — 7 parallele Zählungen/Summen: `customers` (`archived=false`), `vehicles` (`archived=false`), `ledger_entries` `sum(amount_gross)` je `direction in ('income','expense')` im aktuellen **UTC**-Monat (`entry_date` zwischen `YYYY-MM-01` und Monatsletztem, `:47-56`), `documents` mit `type='invoice' AND status='sent'` („Offen“ wie Rechnungsliste, `:90-93`), `reminders` mit `status='open'` (`:96-99`), `calendar_entries` `kind='appointment'`, `starts_at` im heutigen **UTC**-Tag, `status != 'cancelled'` (`:101-111`). `monthlyBalance = income - expense`. Keine Joins, kein N+1; Full-Scans auf `ledger_entries`/`documents` über Datums-/Statusfilter (Index-Frage → Datenmodell-Agent).
- `getUpcoming(): Promise<UpcomingItem[]>` (`:142-209`) — parallel: bis 20 nicht-archivierte Fahrzeuge mit `next_hu >= heute` (Left-Join `latestPlateSubquery()` aus `vehicle-service.ts:55-67` für das aktuelle Kennzeichen), aufsteigend nach `next_hu`; bis 20 `calendar_entries` `kind='appointment'`, `starts_at >= heute 00:00Z`, aufsteigend — **`status='cancelled'` wird erst in JS ausgefiltert (`:199`)**, also nach dem LIMIT. Merge, Sortierung `dateIso.localeCompare`, `slice(0, 10)`. Titel `HU fällig: <make model | plate | 'Fahrzeug'> · <plate>`.

### `src/lib/server/services/search-service.ts`
- `globalSearch(q, perBucket = 8): Promise<GlobalSearchResult>` (`:88-128`) — `trim()`, `< 2` Zeichen → leere Buckets (`MIN_QUERY = 2`, `:65`); Term `%<q>%`; 9 Bucket-Queries parallel, jede mit `.limit(perBucket)`. Kein Relevanz-Ranking, nur deterministische Sortierung je Bucket. Kein Escaping von `%`/`_` im Term (ILIKE-Wildcards des Nutzers wirken).
- `searchCustomers` (`:130-169`): `archived=false`; ILIKE auf `company, last_name, first_name, customer_number, email, phone, mobile`; Order `last_name asc, company asc`; Label Firma | „Vorname Nachname“ | Nummer; Sublabel `Nummer · E-Mail · Ort`.
- `searchVehicles` (`:171-244`): 1) Kennzeichen-Treffer aus `vehicle_license_plate_versions` (**ohne LIMIT**, `:177-181`), 2) `selectDistinct` auf `vehicles` (`archived=false`, ILIKE `vin, make, model, hsn, tsn` OR `id IN (plateMatches)`), Order `make, model`, 3) Nachlade-Query aller Kennzeichenversionen der Treffer, aktuelles = neueste mit `valid_from <= heute` (`:213-230`). Label `make model` | `-`; Sublabel `plate · vin`. Keine Holder-Suche.
- `searchItems` (`:246-263`): ILIKE `article_number, description`; Order `article_number`; Label `<nr> - <desc>`; Sublabel nur `'Leistung'` (kind=service) sonst `'Artikel'` (material/pass_through/vehicle falsch beschriftet).
- `searchTires` (`:274-309`): ILIKE `article_number, brand, model, ean`; Order `brand, model`; Sublabel `nr · W/AR RD · Saison` (Map `seasonLabel` `:265-272`).
- `searchTireStorage` (`:311-355`): Left-Join `customers`; ILIKE `storage_number, brand, size, customers.company, customers.last_name, customers.customer_number`; Order `stored_at desc`; Label `Einlagerung <nr>`; Sublabel `Kunde · Marke · Größe · 'ausgelagert'` (wenn `retrieved_at`).
- `searchSuppliers` (`:357-395`): `archived=false`; ILIKE `name, legacy_supplier_number, city, email, phone`; Order `name`.
- `searchEmployees` (`:397-434`): `archived=false`; ILIKE `first_name, last_name, personnel_number, private_email, private_phone, mobile`; Order `last_name, first_name`; Sublabel `Personalnr · Position`.
- `searchDocuments` (`:436-481`): Left-Join `customers`; `type IN ('invoice','offer','cost_estimate','order_confirmation','credit_note')`; ILIKE `document_number, customers.company, customers.last_name, customers.customer_number`; Order `issue_date desc, created_at desc`; Label `<typeLabel> <nr>` mit eigener Map `typeLabel` (`:67-73`: invoice→Rechnung, offer→Angebot, cost_estimate→Kostenvoranschlag, order_confirmation→**Auftrag**, credit_note→Gutschrift); `type` wird mitgegeben. Keine Status-Filter (auch stornierte).
- `searchPosts` (`:483-500`): ILIKE `title, excerpt`; Order `created_at desc`; Sublabel `'Veröffentlicht'|'Entwurf' · excerpt`.

### `src/lib/server/rate-limit.ts`
- `rateLimit(key, { perMinute, burst? }): { allowed, retryAfter? }` (`:98-118`) — In-Memory Fixed-Window 60 s pro Key; erster Call startet Fenster (`count=1`); Limit `perMinute + burst`; abgelehnte Calls erhöhen den Zähler **nicht**; `retryAfter` = Restsekunden (min. 1). Lazy-Sweep alle 5 min für Buckets mit `windowStart` älter als 5 min (`setInterval` + `unref`, `:50-69`). Single-Replica-Annahme dokumentiert (`:16-25`).
- `resetRateLimit()` (`:124-126`), `_rateLimitCountForTests(key)` (`:132-137`) — Test-Helfer.

### `src/lib/server/crypto.ts`
- `encryptSecret(plain): string` (`:41-55`) — AES-256-GCM, Key = SHA-256(`APP_ENCRYPTION_KEY` || `APP_SECRET`), 12-Byte-IV zufällig, Wire-Format `v1:<b64 iv>:<b64 tag>:<b64 data>`. Wirft `Error('Weder APP_ENCRYPTION_KEY noch APP_SECRET ist gesetzt - Verschlüsselung nicht möglich.')` (`:32-36`).
- `isEncryptedSecret(value)` (`:58-60`) — `startsWith('v1:') && split(':').length === 4`.
- `decryptSecretIfNeeded(stored)` (`:68-70`) — Legacy-Klartext wird durchgereicht.
- `decryptSecret(stored)` (`:76-92`) — wirft `Error('Unbekanntes Chiffrat-Format.')` bei falscher Form; GCM-Tag-Fehler propagiert als Node-Error.

### `src/lib/server/otel-noop.ts` (`:1-75`)
- Inertes `@opentelemetry/api`-Shim (`trace.getTracer().startActiveSpan` ruft das Callback mit No-op-Span; `context.with(ctx, fn)` ruft `fn`; `SpanStatusCode`, `SpanKind`). Per `resolve.alias` in `vite.config.ts:20-27` eingehängt, weil better-auth ≥ 1.6 sonst im Prod-Bundle mit `trace` = `undefined` jede Anfrage 500t (ADR-018).

### Unterstützend (gelesen, anderes Modul)
- `src/lib/server/auth-guards.ts`: `requireUser()` → `error(401, 'Bitte melden Sie sich an.')`; `requirePermission(p)` / `requireAnyPermission(...p)` → `error(403, 'Keine Berechtigung für diese Aktion.')` (`:23-60`).
- `src/lib/server/auth.ts`: better-auth mit `username`-Plugin (3–64 Zeichen), Passwort 8–128, `disableSignUp: true`, Session 7 Tage, `updateAge` 1 Tag, Cookie-Cache 5 min, Cookie-Präfix `tcm`; Secret-Fallback `'dev-only-fallback-secret-do-not-use-prod'` wenn `APP_SECRET` fehlt (`:37`).
- `src/lib/server/auth-users.ts`: `isUserActive`, `isUsernameDeactivated` (`:107-133`), `createUserWithCredential`, `deleteUserSessions`.

## 4. Komponenten (modul-lokal)

| Komponente | Datei | Zweck | Props (Name: Typ, default) | Events/Callbacks | Snippets/Slots | Interner State | Verwendete Shared-Komponenten |
|---|---|---|---|---|---|---|---|
| AppShell | `src/lib/components/layout/AppShell.svelte` | Drawer-Layout (Sidebar `w-72`, `lg:drawer-open`), Sticky-Header `h-[68px]` mit Zurück-Button, Suchtrigger (`md+`: Input-Look mit `⌘K`/`Strg+K`-Kbd; `<md`: Icon-Button), Seitentitel (`<md`), Primary-Action (Link oder Button, Label nur `lg+`), **einziger** Ladebalken (`<progress>` absolut am Header-Boden, Opacity-Toggle, `data-testid="global-loading-bar"`), `<main>` mit `aria-busy`/`inert` + `Loader overlay` bei `busy.slow`, Sidebar-Logo (`/icon.png` 38 px, `companyName`, „Werkstatt-Manager“), permission-gefilterte Navigation, Benutzermenü (Dropdown: „Angemeldet als …“, „Profil“ → `/settings/account`, „Abmelden“), Unsaved-Changes-Guard, Idle-Logout, Cmd/Ctrl+K | `children?: Snippet`; `companyName?: string = 'TwinCarsManager'`; `currentUser?: {id, username, name, permissions[]} \| null = null` | `handleLogout` (`busy.run(signOut) → location '/login'`, Fehler → `handleClientError(err, 'Abmeldung fehlgeschlagen.')`), `handleBack` (`history.back()` wenn `hasInAppHistory`, sonst `backTarget` (Funktion/String), sonst `history.back()` wenn `history.length > 1`), `handlePrimary`, `discardAndNavigate` | `children` | `unsavedOpen`, `pendingTarget`, `hasInAppHistory`, `searchOpen`, `isMac` (`navigator.platform`) | `Loader`, `ConfirmDialog`, `GlobalSearch`; Stores `pageHeader`, `busy`, `formDirty`; `startIdleLogout`; `authClient`; **`$app/stores` (`page` Store, deprecated)** |
| PageHeader | `src/lib/components/layout/PageHeader.svelte` | Schreibt Titel/Back/PrimaryAction in `pageHeader`-Store (Effect, Reset bei Unmount); rendert selbst nur optionalen Toolbar-Snippet in `<div class="mb-4">` | `title: string`; `back?: BackTarget`; `primaryAction?: PrimaryAction`; `subtitle?: string` (**akzeptiert, nicht gerendert**); `toolbar?: Snippet` | — | `toolbar` | — | — |
| GlobalSearch | `src/lib/components/ui/GlobalSearch.svelte` | Modal (`dialog.modal.modal-open`, `modal-box h-[80dvh] max-h-[640px] max-w-2xl`), Suchfeld (Placeholder „Suchen…“, `maxlength=200`), Ergebnis-Buckets mit Sticky-Headern `<Label> (<n>)`, Footer mit Tastenhinweisen („↑ ↓ Navigieren“, „↵ Öffnen“, „Esc Schließen“), Backdrop-Button „Dialog schließen“, X-Button „Schließen“ | `open: boolean` (`$bindable`, default `false`) | `oninput` → 250 ms Debounce → `globalSearchRemote({ q }).run()`; `onmouseenter` setzt `activeIndex`; Klick/Enter → `goto(routeFor(...))` nach `close()` | — | `q`, `input`, `results`, `loading`, `activeIndex`, `searchTimer`; `buckets` (nur nicht-leere, feste Reihenfolge Kunden→Fahrzeuge→Artikel→Reifen→Reifeneinlagerungen→Lieferanten→Mitarbeiter→Belege→Aktuelle Informationen), `flatHits`, `totalHits` | importiert `../../../routes/search.remote` (Layering-Inversion) |
| ToastTray | `src/lib/components/ui/ToastTray.svelte` | Rendert `toast.current` als `toast toast-top toast-end z-[60]` + `alert` (Variante → `alert-success/-warning/-error/-info`), Icon je Variante, `role="status" aria-live="polite"`, Schließen-Button „Benachrichtigung schließen“ | — | `toast.dismiss()` | — | — | Store `toast` |
| Loader | `src/lib/components/ui/Loader.svelte` | Spinner-Varianten `block` (Default, `h-32`, `role=status`), `inline`, `overlay` (`absolute inset-0 z-20 bg-base-100/70 backdrop-blur-sm`, `aria-busy=true`); kein `bar` | `size?: 'sm'\|'md'\|'lg' = 'md'`; `label?: string = 'Inhalte werden geladen'`; `variant?: 'block'\|'inline'\|'overlay' = 'block'` | — | — | — | — |
| Fehlerseite | `src/routes/+error.svelte` | Karte mit Badge `Fehler {status}`, Headline/Subline nach Status (404 „Seite nicht gefunden“/„Die angeforderte Seite oder der Datensatz existiert nicht (mehr).“; 403 „Zugriff nicht erlaubt“/„Sie haben keine Berechtigung, diese Seite aufzurufen.“; 400 „Ungültige Eingabe“/„Bitte prüfen Sie Ihre Eingaben und versuchen Sie es erneut.“; sonst „Es ist ein Fehler aufgetreten“/„Das tut uns leid. Bitte versuchen Sie es in einem Moment erneut.“), `alert-error` mit `page.error.message` falls vorhanden | — | „Zurück“, „Zum Dashboard“ | — | — | — |
| Login-Seite | `src/routes/login/+page.svelte` | Formular `novalidate`, `FormField` Benutzername (`autocomplete=username`, `minlength=3`, `maxlength=64`) und Passwort (`autocomplete=current-password`, `minlength=8`), Fehler-Alert `role=alert`, Info-Alert bei `?reason=idle`, Submit „Anmelden“ nur durch `busy.active` deaktiviert (Spinner) | — | `handleSubmit` | — | `username`, `password`, `errorMessage`, `gradient`, `fv` (`useFormValidation`) | `FormField`; Utils `useFormValidation`, `validationClasses`, `handleClientError`, `signInErrorMessage`; Store `busy`, `pageTitle` (Alias) |
| StatCard (shared, gelesen) | `src/lib/components/ui/StatCard.svelte` | KPI-Kachel (Titel uppercase, Wert `truncate tabular-nums`, optional `desc`, Icon-Box in `color`) — nicht klickbar | `title`, `value: string\|number`, `desc?`, `icon?: Component`, `color?: 'primary'\|'success'\|'warning'\|'error'\|'info'` | — | — | — | — |

### 4a. Stores (`src/lib/stores/*.svelte.ts`) — exakte Semantik

- **`busy`** (`busy.svelte.ts:29-94`): Zählsemaphor `#count` (→ `active`) und `#slowCount` (→ `slow`). `begin()` inkrementiert, startet 250-ms-Timer (`SLOW_AFTER_MS`), liefert idempotenten `end()` (zweiter Aufruf no-op; dekrementiert `slow` nur, wenn dieser Slot die Schwelle überschritten hat). `run(fn)` = `begin` + `try/finally end`. Navigation: `+layout.svelte:38-52` beendet den Slot über `afterNavigate` **und** `nav.complete.finally` (abgebrochene Navigation leakt nicht). Alle Modal-/Submit-Buttons lesen `busy.active`.
- **`creationFlow`** (`creation-flow.svelte.ts:102-223`): Stack von `CreationFlowFrame { entity:'customer'|'vehicle'|'employee', returnUrl, originField, draft, createdAt, leafInitial? {customerId?, customerLabel?} }` + `pending: CreationFlowReturn { returnUrl, originField, draft, result: {id,label,holder?}|null }`. API: `top`, `depth`, `start(frame)` (push+persist), `finish(result)` / `cancel()` (pop → `pending`, gibt `returnUrl` oder `null` bei leerem Stack), `pendingReturnFor(url)` (nur bei **byte-identischer** URL; konsumiert genau einmal), `activeEntities()` (Set aller Entities im Stack = Zyklus-Guard), `reset()`. Persistenz: `sessionStorage['twincars.creation-flow']` als `{ stack, pending }` (`STORAGE_KEY`, `:76`); Laden im Konstruktor, SSR-sicher; Stale-Regel: ist das **oberste** Frame älter als `MAX_AGE_MS = 1 h` (`:79`), wird der gesamte Stack (und `pending`) verworfen (`:193-197`); korrupter JSON → leer; Quota-Fehler beim Schreiben werden geschluckt (`:215-218`). `currentUrl()` = `pathname + search` (leer bei SSR).
- **`formDirty`** (`form-dirty.svelte.ts:26-38`): globales Boolean `dirty`, `set(v)`, `clear()`. Konsumenten: AppShell `beforeNavigate` (cancelt außer `type==='leave'`, öffnet `ConfirmDialog`), `beforeunload` (`e.preventDefault(); e.returnValue=''`). Kommentar im Store (deutsch) behauptet „per `confirm`“ — tatsächlich `ConfirmDialog`.
- **`startIdleLogout`** (`idle-logout.svelte.ts:50-89`): Events `mousemove, keydown, click, scroll, touchstart` (passive) auf `document`; `setTimeout(timeoutMs)`; jedes Event plant neu (ungedrosselt); nach dem Feuern `firing=true` → keine Re-Arm; `onLogout` sync/async-Fehler werden geschluckt; SSR → no-op. Konfiguration in AppShell: `IDLE_LOGOUT_MS = 60 min` (`AppShell.svelte:25`), nur bei `currentUser`; `onLogout`: `signOut()` (Fehler ignoriert) → `location '/login?reason=idle'`. **Keine Vorwarnung, kein Countdown, keine Tab-übergreifende Synchronisation.**
- **`pageHeader` / `pageTitle`** (`page-title.svelte.ts:17-62`): `title|null`, `backTarget: string|()=>void|null`, `primaryAction {label, href?, onClick?, icon?}|null`; `set()` / `reset()`. `pageTitle` = Legacy-Alias (nur Login-Seite + alter Test).
- **`toast`** (`toast.svelte.ts:21-72`): genau **ein** Toast (`current`), `push(message, variant='info', timeout=4500)` ersetzt sofort und cancelt den alten Timer; `success/warning/info` 4500 ms, `error` 6000 ms; `timeout <= 0` = kein Auto-Dismiss; `dismiss()`; IDs via `nanoid(8)`.

### 4b. Utilities (`src/lib/utils/*`, `src/lib/payment-methods.ts`) — jede exportierte Funktion

- `client-error.ts`: `handleClientError(error, baseMessage?)` (`:61-69`) — `isHttpError(error)` mit nicht-leerem `body.message` → dieser Text, sonst `GENERIC_FALLBACK = 'Es ist leider ein Fehler aufgetreten.'`; Toast-Text `${baseMessage}: ${detail}` bzw. `detail`; immer `console.error('[client-error]', msg, error)`; `toast.error(msg)`. Kein Redirect bei 401.
- `ebay-detection.ts`: `isEbayCustomerName(fields[])` (`:32-34`) — `true` wenn ein Feld (case-insensitiv) den Substring `ebay` enthält; Felder werden nicht kombiniert; `null/undefined/''` nie. (Import-Modul; hier nur inventarisiert.)
- `form-validation.svelte.ts`: `useFormValidation(schema | () => schema, values: () => T)` (`:73-156`) → `{ valid, errors (erste Issue pro Feld, Root-`check` unter `_form`; Meldungen, die mit `Invalid|Expected|Missing` beginnen, werden durch `'Bitte prüfen Sie Ihre Eingabe.'` ersetzt), touched, markTouched(f), markAllTouched(), resetTouched() }`; `validationClasses(error, touched, base='input input-bordered w-full')`, `selectValidationClasses(…,'select select-bordered w-full')`, `textareaValidationClasses(…,'textarea textarea-bordered w-full')` → hängen `input-error`/`select-error`/`textarea-error` nur bei `error && touched` an (`:168-201`). Header-Kommentar (`:6-9`) behauptet „Submit disabled until valid“ — veraltet gegenüber CONTRIBUTING §11.
- `iban.ts`: `normalizeBankCode(v)` = Whitespace entfernen + Upper-Case (`:24-25`); `isValidIban(iban)` = Pattern `^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$` + ISO-13616-mod-97 (iterativ, Rest muss 1 sein; `:35-49`), keine länderspezifischen Längen; `isValidBic(bic)` = `^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$` (`:58`).
- `money.ts`: `roundMoney(v)` = `sign * Math.round(|v|*100)/100` (kaufmännisch „half away from zero“, aber Float-Artefakte, z. B. `1.005 → 1`), `grossFromNet(net, rate)` = round(net*(1+rate)), `netFromGross(gross, rate)` = round(gross/(1+rate)), `taxFromNet(net, rate)` = round(net*rate), `applyDiscount(amount, pct)` = round(amount*(1-pct/100)), `formatEuro(v)` = `Intl.NumberFormat('de-DE', currency EUR, 2 Nachkommastellen)` (z. B. `1.234,56 €`) (`:11-51`). Raten als 0..1, Rabatt 0..100.
- `numbering.ts`: `renderNumber(template, sequence, now = new Date())` (`:12-26`) — ersetzt `{YYYY}`, `{YY}`, `{MM}` (lokale Zeit des Prozesses, nicht UTC) und `{N…N}` (Zero-Padding auf Anzahl der N; längere Sequenzen werden nicht gekürzt).
- `pagination.ts`: `clampPagination(page, size)` (`:5-15`) — `size` nur aus `[10,25,50,100]`, sonst 25; `page` = `floor(Number(page)||1)` geklemmt auf 1..100000 — **ohne Verwender im Code (tot)**; `paginationButtons(page, pageCount, visible=5)` (`:21-43`) — Sliding-Window mit `null` als Ellipsen-Marker, erste/letzte Seite immer, `pageCount<=1 → [1]`; genutzt von `Pagination.svelte:23,25` (Fenster 5 Desktop, 3 Phone).
- `pdf-download.ts`: `base64ToBytes(b64)` (`atob`), `openPdfInNewTab({ base64|data, filename?, mime='application/pdf' })` → Blob-URL, `window.open(url,'_blank','noopener')`, Revoke nach 60 s; `downloadBase64File({...mime='application/octet-stream', filename='download'})` → verstecktes `<a download>` + Klick, Revoke nach 60 s (`:40-91`).
- `picker-labels.ts`: `customerDisplayName(r)` = `company || 'first last'.trim() || customerNumber || null`; `customerPickerLabel(r)` = Name + ` · city`; `vehiclePickerLabel(r, holder?)` = `<plate|-> · <make model|-> [· holder]` (`:37-61`).
- `status-labels.ts`: `documentStatusLabel/Badge` (draft/created→Angelegt/`badge-warning`, sent→Versendet/`info`, open→Offen/`info`, paid→Bezahlt/`success`, cancelled→Storniert/`ghost`, storno→Stornorechnung/`error`, converted→In Rechnung überführt/`success`, overdue→Überfällig/`error`; unbekannt → `'-'`/`badge-warning`), `paymentStatusLabel/Badge` (paid/open/partial → Bezahlt/Offen/Teilweise gezahlt), `appointmentStatusLabel/Badge` (scheduled/completed/cancelled → Geplant/Abgeschlossen/Abgesagt), `workOrderStatusLabel/Badge` (open/in_progress/done → Offen/In Bearbeitung/Abgeschlossen), `sentMessageStatusLabel/Badge` (sent/failed/pending → Gesendet/Fehlgeschlagen/In Warteschlange), `reminderLevelLabel(n)` (0→„Noch keine Zahlungserinnerung“, 1→„Zahlungserinnerung“, n→„n. Zahlungserinnerung“), `reminderLevelBadge`, `documentTypeLabel` (invoice/offer/cost_estimate/order_confirmation/reminder*/customer_letter|mailing → Rechnung/Angebot/Kostenvoranschlag/Auftragsbestätigung/Zahlungserinnerung/Serienbrief; **`credit_note` fehlt → Rohwert**), `itemKindLabel` (service/material/pass_through/article/vehicle → Leistung/Material/Durchlaufposten/Artikel/Fahrzeug) (`:27-269`).
- `payment-methods.ts`: `PAYMENT_METHODS = ['Überweisung','Bar','Lastschrift','Karte']` — der deutsche Text **ist** der gespeicherte DB-Wert (`:13-18`).

### 4c. Plattform-Dateien
- `src/app.html`: `lang="de"`, `data-theme="corporate"`, Manifest-Link, Favicon `/icon.png` (1.143.050 Bytes) + `/icons/icon-192.png`, `-512.png`, Apple-Touch `-180.png`, `theme-color #1d4ed8`, `data-sveltekit-preload-data="hover"`, Wrapper `style="display: contents"` (Inline-Style).
- `src/app.css`: nur `@import 'tailwindcss'` + `@plugin 'daisyui' { themes: corporate --default; logs: false }`; **keine** `scrollbar-gutter`-Regel (bewusst entfernt, `:7-14`).
- `src/app.d.ts`: `__APP_VERSION__` (Vite `define`), `App.Locals { session, user, permissions: Set<string> }`.
- `src/hooks.ts`: `export const transport = {}` (Pflicht-Leerdatei).
- `src/service-worker.ts`: Cache `twincars-cache-<version>`; Install: `build` + `files` (ohne `/.svelte-kit/`, `/node_modules/`) + `/` einzeln per `cache.add().catch(() => {})`, dann `skipWaiting()`; Activate: alle anderen Caches löschen, `clients.claim()`; Fetch: **jeder** same-origin GET → `networkFirst` (Netz; bei `ok && type==='basic'` `cache.put`; bei Fehler Cache-Treffer, für `mode==='navigate'` Fallback auf gecachtes `/`). Registrierung: `svelte.config.js:11-18` `register:false`; `+layout.svelte:62-71` registriert nur in Prod (`/service-worker.js`) und **unregistriert** in Dev.
- `static/`: `icon.png` (1,1 MB), `icons/apple-touch-icon-180.png`, `icon-128.webp`, `icon-192.png`, `icon-256.png/.webp`, `icon-384.png`, `icon-512.png/.webp`, `icon-512-maskable.png`, `icon-64.webp`, `manifest.webmanifest` (name „TwinCars Manager“, short_name „TwinCars“, description „Werkstatt- und Kunden-Manager“, `start_url /`, `scope /`, `display standalone`, `background_color #ffffff`, `theme_color #1d4ed8`, `lang de`, Icons 192/256/384/512 + 512 maskable), `robots.txt` (`User-agent: *` / `Disallow:` = alles erlaubt).
- `vite.config.ts`: Plugins `tailwindcss, sveltekit, svelteTesting`; `define __APP_VERSION__`; Alias `@opentelemetry/api → otel-noop.ts`; `ssr.noExternal ['daisyui']`; `optimizeDeps.exclude ['@lucide/svelte']`; `build.target esnext`; Vitest `jsdom`, `globals`, Setup `vitest.setup.ts` (`@testing-library/jest-dom/vitest`), Coverage v8.
- `svelte.config.js`: `adapter-node`, `runes: true`, `experimental.async`, `kit.experimental.remoteFunctions`, `serviceWorker.register: false`.

## 5. Tabellen

Gelesen (über Service-/Hook-Code): `company_settings` (`setup_completed`, `company_name`; wird bei leerer Tabelle angelegt), `users` (`active`, `username`), `sessions`, `accounts`, `user_roles`, `role_permissions` (`permission`), `customers` (`archived`, `customer_number`, `company`, `first_name`, `last_name`, `email`, `phone`, `mobile`, `city`), `vehicles` (`archived`, `vin`, `make`, `model`, `hsn`, `tsn`, `next_hu`), `vehicle_license_plate_versions` (`vehicle_id`, `license_plate`, `valid_from`), `ledger_entries` (`direction in income|expense`, `entry_date`, `amount_gross`), `documents` (`type in invoice|offer|cost_estimate|order_confirmation|credit_note`, `status` u. a. `sent`, `document_number`, `issue_date`, `created_at`, `customer_id`), `reminders` (`status='open'`), `calendar_entries` (`kind='appointment'`, `starts_at`, `status != 'cancelled'`, `title`), `items` (`article_number`, `description`, `kind`), `tires` (`article_number`, `brand`, `model`, `width`, `aspect_ratio`, `diameter_inch`, `season`, `ean`), `tire_storage` (`storage_number`, `brand`, `size`, `season`, `stored_at`, `retrieved_at`, `customer_id`), `suppliers` (`archived`, `name`, `legacy_supplier_number`, `city`, `email`, `phone`), `employees` (`archived`, `personnel_number`, `first_name`, `last_name`, `position`, `private_email`, `private_phone`, `mobile`), `posts` (`title`, `excerpt`, `published`, `created_at`). Keine Schreibzugriffe aus diesem Modul außer `company_settings`-Anlage und `seedDefaults()` (Mail-Templates, Ledger-Kategorien, Nummernkreise; `src/lib/server/db/seed-defaults.ts:197`).

## 6. Flows (durchgängig, Start bis Ende)

- **Anmeldung** — `/login` → Felder → „Anmelden“ → `POST /api/auth/sign-in/username` → Full-Document-Load auf `redirectTo` (nur `/…`, nicht `//…`) bzw. `/` (`login/+page.svelte:73-110`).
  - Leerzustand: leeres Formular, Hinweistext „Bitte melden Sie sich mit Ihrem Benutzernamen und Passwort an.“; Gradient wird erst nach Mount eingeblendet (Hydration-sicher).
  - Ladezustand: Button `disabled={busy.active}` + Spinner; kein Ladebalken (kein AppShell).
  - Validierungsfehler (Klickzeit, `markAllTouched`): Benutzername „Bitte einen Benutzernamen eingeben.“ / „Benutzername zu kurz (mind. 3 Zeichen).“ / „Benutzername zu lang.“ (>64); Passwort „Bitte ein Passwort eingeben.“ / „Passwort zu kurz (mind. 8 Zeichen).“ / „Passwort zu lang.“ (>128); Summary-Alert (`role=alert`) zeigt die erste Feldmeldung, Fallback „Bitte prüfen Sie Ihre Eingaben.“; Felder rot nur wenn `touched`.
  - Fehlerzustand (`signInErrorMessage`, `sign-in-error.ts:17-34`): 429 → Server-Body oder „Zu viele Anmeldeversuche, bitte warten Sie eine Minute.“; 401/403 → „Benutzername oder Passwort ist falsch.“ außer Body enthält „deaktiviert“ (dann „Dieses Konto ist deaktiviert. Bitte wenden Sie sich an die Administration.“); sonst „Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.“; Netzwerk-/Wurf-Fehler → Toast „Anmeldung fehlgeschlagen.: Es ist leider ein Fehler aufgetreten.“ (Doppelpunkt nach dem Punkt, `client-error.ts:66` + `login/+page.svelte:108`).
  - Abbruch: keiner (kein Abbrechen-Button). Berechtigung: n/a. Bestätigungsdialoge: keine.
  - Rate-Limit: 11. POST innerhalb 60 s je IP → 429 (auch erfolgreiche Logins zählen). `?reason=idle` → Info „Sie wurden wegen einer Stunde Inaktivität automatisch abgemeldet. Bitte melden Sie sich erneut an.“
- **Auth-Gate / Redirect** — Aufruf nicht-öffentlicher Route ohne Session → 303 `/login?redirectTo=…` → nach Login zurück. Remote-Calls (`/_app/remote/*`) sind vom Gate ausgenommen; dort 401 „Bitte melden Sie sich an.“ als Toast (kein Redirect).
- **Setup-Gate** — `getLayoutContext().setupCompleted=false` → Root-Layout rendert ohne Shell und `goto('/setup')` im Effect (nur Browser). Serverseitig kein Redirect; `/setup` bleibt dauerhaft öffentlich; Wiederholung wird durch `completeSetup` abgewehrt (`setup.remote.ts:278`).
- **Abmelden** — Benutzermenü → „Abmelden“ → `busy.run(signOut)` → `location '/login'`; Fehler → Toast „Abmeldung fehlgeschlagen.: …“. Kein Bestätigungsdialog.
- **Idle-Logout** — 60 min ohne `mousemove/keydown/click/scroll/touchstart` im Tab → `signOut` (Fehler ignoriert) → `location '/login?reason=idle'`. Keine Vorwarnung.
- **Deaktiviertes Konto** — Sign-in-POST → 403 mit deutschem Body vor better-auth; bestehende Sessions verlieren beim nächsten Request `locals.user` (`isUserActive` pro Request) → Redirect `/login`.
- **Dashboard** — `/` → Header-Titel „Start“ (`PageHeader`), 8 `StatCard`s: Kunden (`primary`), Fahrzeuge (`info`), Monatsumsatz (`success`, `formatEuro`), Monatsausgaben (`error`), Offene Rechnungen (`warning`), Zahlungserinnerungen (`error`), Termine heute (ohne Farbe), Monatssaldo (`success` wenn ≥ 0 sonst `error`) (`+page.svelte:40-90`); Karte „Schnelle Aktionen“ mit 8 Links: Neuer Kunde `/customers/new`, Neues Fahrzeug `/vehicles/new`, Neuer Mitarbeiter `/employees/new`, Neuer Artikel `/items/new`, Neuer Lieferant `/suppliers/new`, Neue Buchung `/ledger/new`, Neuer Kostenvoranschlag `/offers/new`, Import starten `/settings/import` (nicht permission-gefiltert); Karte „Anstehende Termine“ mit Link „Kalender öffnen →“ und Liste (HU → `/vehicles/<id>` mit `Wrench`-Icon, Termin → `/calendar` mit `CalendarClock`), Datum `TT.MM.JJJJ`.
  - Leerzustand: KPI-Werte `0` bzw. `0,00 €`; Liste „Aktuell keine anstehenden HU-Termine oder Werkstatt-Termine.“
  - Ladezustand: KPI-Werte `…` solange `kpisQ.loading` (Client-Fetch, nicht SSR); Termine SSR via top-level await.
  - Fehlerzustand: `kpisQ.error` → `handleClientError` (Toast); Termine-Fehler → `+error.svelte`.
  - Berechtigung: nur Login nötig; alle Kacheln für jeden Nutzer sichtbar.
- **Globale Suche** — Trigger im Header (`data-testid="global-search-trigger"`, nur `md+`), Icon-Button (`<md`) oder `Cmd/Ctrl+K` (`AppShell.svelte:226-236`) → Modal, Input autofokussiert (`queueMicrotask`) → Tippen → 250 ms Debounce → ab 2 Zeichen `globalSearchRemote({q}).run()` → Buckets → `↓/↑` (zyklisch), Maus-Hover, `Enter`/Klick → `close()` + `goto` (`/customers/<id>`, `/vehicles/<id>`, `/items/<id>`, `/tires/<id>`, `/tire-storage/<id>`, `/suppliers/<id>`, `/employees/<id>`, `/posts/<id>`, documents: `invoice|credit_note` → `/invoices/<id>`, sonst `/offers/<id>`; `GlobalSearch.svelte:131-158`). `Esc`, X, Backdrop → `close()` (setzt `q`, `results`, `activeIndex`, `loading` zurück).
  - Leerzustand: < 2 Zeichen „Mindestens 2 Zeichen eingeben.“; keine Treffer „Keine Treffer.“
  - Ladezustand: „Suche läuft…“ nur wenn noch keine Treffer angezeigt; kein `busy` (bewusst lokal).
  - Fehlerzustand: **nicht behandelt** (`try/finally` ohne `catch`, `GlobalSearch.svelte:180-188`) → unhandled rejection, kein Toast.
  - Limits: 8 Treffer je Bucket, max. 200 Zeichen (Server), keine Pagination; Berechtigungsfilter serverseitig je Bucket.
- **Unsaved-Changes-Guard** — Form setzt `formDirty` → In-App-Navigation wird gecancelt, `ConfirmDialog` „Ungespeicherte Änderungen“ / „Es gibt ungespeicherte Änderungen. Sollen sie verworfen werden?“ / „Verwerfen“ (danger) / „Bleiben“; Verwerfen → `formDirty.clear()` **vor** `goto(pendingTarget)`; Bleiben/Close → `pendingTarget=null`. Tab-Schließen/Reload → native `beforeunload`-Warnung.
- **Navigation/Busy** — jede Navigation: Ladebalken sofort, Overlay „Inhalte werden geladen“ + `inert` ab 250 ms; Sidebar/Header bleiben bedienbar.
- **Creation-Flow (Rundreise)** — Host-Form: `creationFlow.start({...draft})` → `goto('/customers/new'|'/vehicles/new'|'/employees/new')` → Leaf speichert → `finish({id,label,holder?})`/`cancel()` → `goto(returnUrl)` → Host: `pendingReturnFor(currentUrl())` → Draft wiederherstellen, Picker vorbelegen. Abbruch nach 1 h Inaktivität (Stack verworfen). Leaf-Seiten selbst gehören zu anderen Modulen.
- **Fehlerseite** — geworfener Route-Fehler (top-level await, `error(status, …)`) → `+error.svelte`; „Zurück“ / „Zum Dashboard“.
- **PWA** — Prod: SW-Registrierung beim Mount; Install-Banner via Manifest; Update: neuer SW `skipWaiting` + `claim` sofort, alte Caches gelöscht, kein Reload-Hinweis; Offline: gecachte Assets bzw. bei Navigation das gecachte `/`-HTML, alle anderen Fehler propagieren.

## 7. Nebenwirkungen

Keine E-Mails, PDFs, Uploads, Exporte oder externen APIs in diesem Modul. Nebenwirkungen: `seedDefaults()` einmalig pro Prozess beim ersten Request (`hooks.server.ts:41-53, 232`); `company_settings`-Zeile wird bei Bedarf angelegt (`settings-service.ts:9-12`); Service-Worker-Cache (alle same-origin GET-Antworten, inkl. Remote-Query-Antworten und `/api/auth/get-session`); `sessionStorage['twincars.creation-flow']`; `console.error('[client-error]'…)` im Browser und `console.error('[server-error]'…)` auf dem Server (`hooks.server.ts:461`); In-Memory-Rate-Limit-Buckets mit 5-min-Sweep.

## 8. Vorhandene Tests

| Testdatei | Art | Was wird abgedeckt (1 Zeile) |
|---|---|---|
| `src/hooks.server.test.ts` (328 Z.) | integration (node) | Sign-in-Rate-Limit 10/min/IP inkl. 429-Body/Retry-After, IP-Buckets, kein Limit für GET/andere POSTs; Public-API-Limit 180/min pro Token-Bucket bzw. IP; `resolveClientIp`; `handleValidationError` (Labels, `values`-Wrapper, „(Position N)“, unbekannte Keys, englische Defaults, ohne Pfad) |
| `src/service-worker.test.ts` (311) | unit (jsdom, gemockter `$service-worker`) | Pre-Cache build+files+`/`, Filter `.svelte-kit`/`node_modules`, Install trotz 404, `skipWaiting`, Activate löscht alte Caches + `claim`, Network-first + `cache.put`, Cache-Fallback, Navigations-Fallback auf `/`, Skip von POST/cross-origin |
| `src/routes/dashboard.remote.test.ts` (310) | integration (pg-mem) | 401 anonym, Null-KPIs, nur nicht-archivierte Kunden/Fahrzeuge, Monats-Summen/Saldo, nur `invoice`+`sent`, nur `reminders.status=open`, Termine heute (ohne cancelled/andere Tage/closure) |
| `src/routes/search.remote.test.ts` (402) | integration (pg-mem) | 401 anonym, Bucket-Leerung je fehlender Permission (customers/vehicles/items/documents via invoices∨offers/tires+tireStorage/suppliers/employees/posts), Wildcard sieht alles, `users` allein leert alles, < 2 Zeichen und Whitespace leer, > 200 Zeichen wirft |
| `src/lib/server/services/search-service.test.ts` (674) | integration (pg-mem) | Alle 9 Buckets: Trefferspalten, Labels/Sublabels, Archiv-Ausschluss, Case-Insensitivity, Kennzeichen/HSN/TSN, `type` auf Dokumenten, `perBucket`-Limit, „ausgelagert“, Entwurf/Veröffentlicht |
| `src/routes/login/page.test.ts` (64) | component | „Anmelden“ nie durch Validierung disabled; Klick mit leeren/kurzen Feldern zeigt deutsche Meldungen ohne `signIn`-Aufruf |
| `src/routes/login/sign-in-error.test.ts` (54) | unit | Mapping 401/403/429/sonstige → deutsche Texte, deaktiviert-Body durchgereicht, englische 403-Strings blockiert |
| `src/lib/components/layout/AppShell.test.ts` (373) | component | Ladebalken-Opacity/aria-hidden, Overlay+inert nach 250 ms, Nav-Filterung, Wildcard, „Start“-Fallback ohne User, Firmenname/User/Profil-Link, Idle-Logout 1 h nur bei User, Abmelden-Fehlerpfad, Suchtrigger + Ctrl+K, Unsaved-Guard (Verwerfen/Bleiben), Titel aus Route/Store, Zurück, Primary-Action Link/Button |
| `src/lib/components/layout/navigation.test.ts` (128) | unit | `filterNavigationByPermissions` (ohne Perm, granted, leere Gruppen, Wildcard, Immutabilität) + reale Navigation (nur „Start“, Admin sieht alles, „Offene Rechnungen“, System = nur Einstellungen, „Anfragen“ unter Kommunikation mit `mailings`) |
| `src/lib/components/layout/PageHeader.test.ts` (72) | component | Schreibt title/back/primaryAction in Store, rendert Titel nicht selbst, Toolbar-Snippet |
| `src/lib/components/ui/GlobalSearch.test.ts` (309) | component | Geschlossen rendert nichts, Debounce → Remote, < 2 Zeichen kein Call, Esc/Backdrop/X schließen, Pfeiltasten, Enter → goto, Routing je Bucket/Typ, „Keine Treffer“, responsive Klassen |
| `src/lib/components/ui/ToastTray.test.ts` (82) | component | Leer, Varianten-Klassen, border+shadow-md, `aria-live=polite`, Dismiss-Button |
| `src/lib/components/ui/Loader.test.ts` (57) | component | Default-Label, custom Label, Varianten (block/inline/overlay) + a11y, Größenklassen |
| `src/lib/stores/busy.svelte.test.ts` (119) | unit | active/slow-Timing 250 ms, Semaphor, `run` bei Erfolg/Fehler, idempotentes `end`, Doppel-End stiehlt keinen Slot |
| `src/lib/stores/creation-flow.svelte.test.ts` (276) | unit | start/finish/cancel, Pending-URL-Match, Einmal-Konsum, 2-stufige Kette, `leafInitial`/`holder`, `activeEntities`, reset, sessionStorage-Roundtrip, 1-h-Stale-Drop, korrupter Storage, `currentUrl` |
| `src/lib/stores/form-dirty.svelte.test.ts` (35) | unit | set/clear |
| `src/lib/stores/idle-logout.svelte.test.ts` (98) | unit | Timeout, Reset durch Event, stop, einmaliges Feuern, Fehler geschluckt, Custom-Events, SSR-no-op |
| `src/lib/stores/page-title.svelte.test.ts` (29) | unit | Legacy-Alias `pageTitle` set/reset |
| `src/lib/stores/toast.svelte.test.ts` (64) | unit | push/replace/auto-dismiss/dismiss/Varianten-Helfer |
| `src/lib/utils/client-error.test.ts` (63) | unit | Nie Roh-Message, console.error, baseMessage-Präfix, Fallback für undefined/Objekte |
| `src/lib/utils/ebay-detection.test.ts` (76) | unit | Substring-Regel inkl. „Ebayer“/„Sebayn“/„Bayer“-Kanten |
| `src/lib/utils/form-validation.svelte.test.ts` (243) | unit (runes via `$effect.root`) | valid/errors/touched, markTouched/All, resetTouched, englische Defaults → Fallback, Klassen-Helfer |
| `src/lib/utils/iban.test.ts` (50) | unit | Normalisierung, gültige IBANs (DE/AT/CH), Prüfziffer-Fehler, BIC-Formen |
| `src/lib/utils/money.test.ts` (74) | unit | Rundung ±, Brutto/Netto/Steuer/Rabatt, `formatEuro` |
| `src/lib/utils/numbering.test.ts` (50) | unit | Platzhalter YYYY/YY/MM/N…, Padding, Default `now` |
| `src/lib/utils/pagination.test.ts` (57) | unit | `clampPagination` (obwohl im Code ungenutzt), `paginationButtons` Ellipsen |
| `src/lib/utils/pdf-download.test.ts` (208) | unit | base64→Bytes, Blob-URL + `window.open`, `data`-Key, Mime-Fallback, Revoke nach 60 s, Download-Anchor (XML/CSV) |
| `src/lib/utils/picker-labels.test.ts` (120) | unit | Kunden-Displayname/Label, Fahrzeug-Label inkl. Holder |
| `src/lib/utils/status-labels.test.ts` (119) | unit | Alle Label/Badge-Maps außer `credit_note` |
| `src/lib/server/crypto.test.ts` (109) | unit (node) | Roundtrip, frischer IV, Tamper-Erkennung, Formatfehler, APP_SECRET-Fallback, fail-closed, Cross-Key, `isEncryptedSecret`/`IfNeeded` |
| `src/lib/server/rate-limit.test.ts` (107) | integration (fake timers) | Limit, Deny+retryAfter, Burst, Fensterreset 60 s, Key-Isolation, Denied zählt nicht, Hammering, retryAfter-Näherung |
| `e2e/auth.spec.ts` (49) | e2e (Playwright) | Falsches Passwort → deutscher Alert; Login landet im Shell mit User-Menü; Logout → `/login`, geschützte Route bounced |
| `e2e/navigation.spec.ts` (Z. 65-140 gelesen) | e2e | Jeder Sidebar-Eintrag navigiert + Titel; Dashboard-Kacheln/Schnellaktionen/Termine sichtbar; globale Suche findet Kunde (Trigger) und Fahrzeug per Kennzeichen (Ctrl+K) |
| `e2e/smoke.spec.ts` (Titel gelesen) | e2e | Listen-Baseline, Offene-Rechnungen-Batch, Mailings-Klickvalidierung, create-validate-cancel je Modul |
| Nachbar-Tests, **nicht gelesen** (anderes Modul): `src/routes/pickers.remote.test.ts` (393), `src/lib/server/api-tokens.test.ts` (172), `src/lib/server/auth-permissions.test.ts` (135), `src/lib/server/auth-users.test.ts` (214) | — | — |

Nicht abgedeckt: Setup-Gate-Redirect, `requireAuthHandle`-Redirect (nur e2e indirekt), `blockDeactivatedSignIn` (nur über `sign-in-error`), `handleError`, `+error.svelte`, `+layout.svelte` (Busy-Verdrahtung, SW-Registrierung), Dashboard `getUpcoming`, `otel-noop`, `GlobalSearch`-Race/Fehlerpfad, Idle-Logout-Integration im Browser, PWA-Install.

## 9. Feature-Matrix

| ID | Feature | Routen | Endpoints/Remotes | Tabellen | Erwartetes Verhalten |
|---|---|---|---|---|---|
| F-001 | Auth-Gate für alle nicht-öffentlichen Routen | alle | Hook `requireAuthHandle` | `sessions`, `users` | Ohne Session 303 auf `/login?redirectTo=<pfad+query>`; öffentlich: `/login`, `/api/auth`, `/api/public`, `/api/ebay/account-deletion`, `/setup`, `/_app`, `/favicon` |
| F-002 | Session-Populierung + sofortige Deaktivierungs-Sperre | alle | Hook `populateAuthLocals` | `sessions`, `users.active`, `user_roles`, `role_permissions` | `locals.user/permissions` pro Request; `active=false` → wie anonym (Cookie-Cache 5 min wird umgangen) |
| F-003 | Brute-Force-Schutz Login | `/api/auth/sign-in/*` | Hook `rateLimitSignIn` | — | 10 POST/min/IP (XFF bevorzugt), danach 429 + `Retry-After` + „Zu viele Anmeldeversuche, bitte warten Sie eine Minute.“ |
| F-004 | Drossel Public-API + eBay-Compliance | `/api/public/*`, `/api/ebay/account-deletion` | Hook `rateLimitPublicApi` | — | 120/min + 60 Burst je `token:<8>`/`ip:<ip>`; 429 „Zu viele Anfragen. Bitte reduzieren Sie die Aufrufrate.“ |
| F-005 | Deaktiviertes Konto beim Login abweisen | `/api/auth/sign-in/*` | Hook `blockDeactivatedSignIn` | `users` | 403 mit deutschem Body vor Credential-Prüfung; unbekannte Namen unauffällig |
| F-006 | Erst-Request-Seeding | alle | `seedDefaults()` | Mail-Templates, Ledger-Kategorien, Nummernkreise | Einmal pro Prozess, idempotent; jeder Request wartet auf das Seed-Promise |
| F-007 | Validierungsfehler-Übersetzung | alle Remotes | `handleValidationError` + `FIELD_LABELS` | — | Nur erste Issue; `Ungültige Eingabe für „<Label>“: <Meldung>`; `values`-Wrapper übersprungen; Array-Index → „(Position N)“ 1-basiert; Meldungen ohne Umlaut → „Bitte prüfen Sie Ihre Eingabe.“ |
| F-008 | Serverfehler-Funnel | alle | `handleError` | — | ≥ 500: Log + „Ein interner Fehler ist aufgetreten.“; 4xx mit Text: durchreichen; sonst „Die Anfrage konnte nicht bearbeitet werden.“ |
| F-009 | Client-Fehler-Funnel (Toast) | alle Seiten | `handleClientError` | — | Nur kuratierte `HttpError.body.message`, sonst „Es ist leider ein Fehler aufgetreten.“; optionaler Präfix `<base>: `; `console.error` |
| F-010 | Kuratierte Fehlerseite | alle | `+error.svelte` | — | Status-abhängige Headline/Subline, Detail-Alert, „Zurück“, „Zum Dashboard“ |
| F-011 | Login-Formular mit Klickzeit-Validierung | `/login` | `authClient.signIn.username` | `users`, `accounts`, `sessions` | Benutzername 3–64 (trim), Passwort 8–128; Button nur bei `busy.active` disabled; deutsche Fehlermeldungen; `novalidate` |
| F-012 | Post-Login-Redirect mit Open-Redirect-Guard | `/login?redirectTo=` | — | — | Full-Document-Load auf `redirectTo` wenn `startsWith('/')` und nicht `//`, sonst `/` |
| F-013 | Idle-Hinweis auf Login | `/login?reason=idle` | — | — | Info-Alert „Sie wurden wegen einer Stunde Inaktivität automatisch abgemeldet. …“ |
| F-014 | Versionsanzeige | `/login` | `__APP_VERSION__` | — | „TwinCarsManager · Version 1.4.0“ aus `package.json` zur Build-Zeit |
| F-015 | Abmelden | Benutzermenü | `authClient.signOut` | `sessions` | `busy.run` → Full-Load `/login`; Fehler-Toast „Abmeldung fehlgeschlagen.: …“ |
| F-016 | Idle-Logout 60 min | AppShell | `authClient.signOut` | `sessions` | Events mousemove/keydown/click/scroll/touchstart; nach 60 min Inaktivität Logout + `/login?reason=idle`; pro Tab; keine Vorwarnung |
| F-017 | Setup-Gate | alle | `getLayoutContext` | `company_settings` | `setupCompleted=false` → Shell-los rendern + clientseitig `goto('/setup')` |
| F-018 | Layout-Kontext (Firmenname) | alle | `getLayoutContext` | `company_settings` | Sidebar zeigt `companyName` oder „TwinCarsManager“; legt Settings-Zeile an, falls fehlend |
| F-019 | Aktueller Nutzer + Permissions im Client | alle | `getCurrentUserRemote` | `users`, Rollen | `null` anonym; sonst `{id, username, name, permissions[]}` |
| F-020 | Permission-gefilterte Sidebar (22 Items, 7 Gruppen) | AppShell | — | — | Filterregeln §1a; `*` → alles; ohne Rechte nur „Start“; Aktiv-Markierung per Präfix |
| F-021 | Header: Titel, Zurück, Primary-Action | AppShell + `PageHeader` | — | — | Titel aus Store, sonst Route-Label, sonst „TwinCarsManager“; Zurück nur bei `backTarget` (history.back bevorzugt nach In-App-Navigation); Primary als `<a>` oder `<button>`, Icon Default `Plus` |
| F-022 | Einziger Ladebalken + Overlay-Tier | AppShell | Store `busy` | — | `active` → Balken-Opacity; `slow` (≥ 250 ms) → Overlay „Inhalte werden geladen“, `<main inert aria-busy>` |
| F-023 | Navigations-Busy | Root-Layout | `beforeNavigate`/`afterNavigate` | — | Jede Navigation belegt einen Busy-Slot; abgebrochene Navigation beendet ihn über `nav.complete` |
| F-024 | Unsaved-Changes-Guard (In-App + beforeunload) | AppShell | Store `formDirty` | — | ConfirmDialog „Ungespeicherte Änderungen“ … „Verwerfen“/„Bleiben“; `clear()` vor Retarget-`goto` |
| F-025 | Mobile Drawer | AppShell | — | — | Checkbox-Drawer `< lg`, Menü-Button „Navigation öffnen“, Overlay „Navigation schließen“ |
| F-026 | Benutzermenü | AppShell | — | — | Dropdown oben: „Angemeldet als <username|name>“, „Profil“ → `/settings/account`, „Abmelden“ |
| F-027 | Globale Suche öffnen | AppShell | — | — | Trigger (`md+`), Icon (`<md`), `Cmd/Ctrl+K`; Kbd-Hinweis `⌘K` (Mac) / `Strg+K` |
| F-028 | Globale Suche: Abfrage + Berechtigungsfilter | Modal | `globalSearchRemote` | 10 Tabellen (§5) | ≥ 2 Zeichen, ≤ 200, 250 ms Debounce, 8/Bucket, Buckets ohne Modulrecht leer |
| F-029 | Globale Suche: Ergebnisdarstellung + Tastatur | Modal | — | — | Feste Bucket-Reihenfolge mit Zähler, Label/Sublabel, `↑/↓` zyklisch, Enter/Klick → Detailroute je Bucket/Typ, Esc/X/Backdrop schließen und resetten |
| F-030 | Suche Kunden | — | `searchCustomers` | `customers` | Firma/Nachname/Vorname/Nummer/E-Mail/Telefon/Mobil, nicht archiviert, Sortierung Nachname/Firma |
| F-031 | Suche Fahrzeuge inkl. Kennzeichen | — | `searchVehicles` | `vehicles`, `vehicle_license_plate_versions` | VIN/Marke/Modell/HSN/TSN + jedes Kennzeichen (auch historische), nicht archiviert; Sublabel aktuelles Kennzeichen · VIN |
| F-032 | Suche Artikel/Leistungen | — | `searchItems` | `items` | Artikelnummer/Beschreibung; Sublabel Leistung/Artikel |
| F-033 | Suche Reifenkatalog | — | `searchTires` | `tires` | Nummer/Marke/Modell/EAN; Sublabel Nummer · Größe · Saison |
| F-034 | Suche Reifeneinlagerungen | — | `searchTireStorage` | `tire_storage`, `customers` | Nummer/Marke/Größe/Kundenname/-nummer; „ausgelagert“-Marker; neueste zuerst |
| F-035 | Suche Lieferanten | — | `searchSuppliers` | `suppliers` | Name/Legacy-Nr/Ort/E-Mail/Telefon, nicht archiviert |
| F-036 | Suche Mitarbeiter | — | `searchEmployees` | `employees` | Vor-/Nachname/Personalnr/private E-Mail/Telefon/Mobil, nicht archiviert |
| F-037 | Suche Belege | — | `searchDocuments` | `documents`, `customers` | Belegnummer/Kundenfirma/-nachname/-nummer für invoice/offer/cost_estimate/order_confirmation/credit_note; `type` steuert Route |
| F-038 | Suche Aktuelle Informationen | — | `searchPosts` | `posts` | Titel/Excerpt, Entwürfe markiert |
| F-039 | Dashboard-KPIs (8 Kacheln) | `/` | `getDashboardKpis` | `customers`, `vehicles`, `ledger_entries`, `documents`, `reminders`, `calendar_entries` | Definitionen §3; Anzeige `de-DE`-Zahlen / `formatEuro`; `…` während Client-Load; nicht klickbar |
| F-040 | Dashboard „Schnelle Aktionen“ | `/` | — | — | 8 feste Links (§6), keine Permission-Filterung |
| F-041 | Dashboard „Anstehende Termine“ | `/` | `getUpcomingRemote` | `vehicles`, `vehicle_license_plate_versions`, `calendar_entries` | Top 10 aus HU-Fälligkeiten (≥ heute) + Terminen (≥ heute, nicht storniert), datumssortiert; HU → Fahrzeug, Termin → `/calendar`; Leertext |
| F-042 | Toast-System | global | Store `toast` + `ToastTray` | — | Ein Toast, Ersetzen, 4,5 s (Fehler 6 s), manuell schließbar, `aria-live=polite` |
| F-043 | Creation-Flow-Store (Rundreise-Infrastruktur) | Host-Forms ↔ `/customers/new`, `/vehicles/new`, `/employees/new` | — | — | Stack, sessionStorage-Spiegel, 1-h-Verfall, URL-genaue Einmal-Rückgabe, Zyklus-Guard, `leafInitial`/`holder` |
| F-044 | Form-Validierungs-Primitive | alle Forms | `useFormValidation` | — | Erste Issue je Feld, touched-Gating der Anzeige, englische Defaults → generischer Text, Klassen-Helfer |
| F-045 | Geld-/IBAN-/Nummernkreis-/Pagination-Helfer | global | `money.ts`, `iban.ts`, `numbering.ts`, `pagination.ts` | — | Verhalten §4b |
| F-046 | Statuslabel-Katalog (deutsch) | global | `status-labels.ts` | — | Label+Badge je Status-Domäne; unbekannt → „-“ |
| F-047 | PDF öffnen / Datei herunterladen (Client) | global | `pdf-download.ts` | — | Blob-URL in neuem Tab (`noopener`) bzw. `<a download>`; Revoke nach 60 s |
| F-048 | Secrets-at-rest-Cipher | Server | `crypto.ts` | — | AES-256-GCM `v1:iv:tag:data`; Legacy-Klartext durchreichen; fail-closed ohne Secret |
| F-049 | In-Memory-Rate-Limiter | Server | `rate-limit.ts` | — | Fixed-Window 60 s, Burst, Sweep, Single-Replica |
| F-050 | PWA: Manifest + Icons + Installierbarkeit | `/manifest.webmanifest` | — | — | standalone, `#1d4ed8`, Icons 192–512 + maskable |
| F-051 | Service Worker: Pre-Cache + Network-first + Offline-Shell | alle GET | `service-worker.ts` | — | Cache-Version pro Deploy, sofortige Übernahme, Navigation-Fallback `/`, nur Prod registriert, Dev unregistriert |
| F-052 | OTel-No-op-Shim | Build | `otel-noop.ts` | — | Verhindert 500 in Prod durch better-auth-Tracing |
| F-053 | Zahlungsarten-Konstante | global | `payment-methods.ts` | `documents.payment_method`, `ledger_entries.payment_method` | Vier deutsche Klartextwerte als Picklist |
| F-054 | eBay-Namenserkennung (Import-Helfer) | Import | `ebay-detection.ts` | `customers.kind` | Substring „ebay“ in einem Namensfeld |

## 10. Befunde

| ID | Beschreibung | Fundstelle | Auswirkung | Empfehlung | Einordnung | Betroffene Features |
|---|---|---|---|---|---|---|
| B-001 | Setup-Gate existiert nur clientseitig (`$effect` → `goto('/setup')`); `hooks.server.ts` hat keinen Setup-Redirect, obwohl CLAUDE.md „every route redirects to /setup“ behauptet. Bei deaktiviertem JS/SSR-Direktzugriff wird die Zielseite ohne Shell gerendert; `/setup` bleibt dauerhaft öffentlich | `src/routes/+layout.svelte:26-30`; `src/hooks.server.ts:61-72` | Inkonsistentes Verhalten, Gate umgehbar für SSR-Inhalte | Serverseitiges Gate in der Nuxt-Middleware (`setupCompleted` gecacht), `/setup` nach Abschluss auf 404/Redirect | im Rewrite beheben | F-017 |
| B-002 | Open-Redirect-Guard prüft nur `/` und `//`; `/\evil.com` wird von Browsern (WHATWG-URL, Backslash = Slash) als `//evil.com` interpretiert | `src/routes/login/+page.svelte:101-104` | Phishing-Redirect nach erfolgreichem Login | Ziel mit `new URL(target, location.origin)` parsen und `origin` vergleichen bzw. Backslash verbieten | im Rewrite beheben | F-012 |
| B-003 | `x-forwarded-for` wird bedingungslos als Client-IP genommen → ohne vertrauenswürdigen Proxy kann ein Angreifer per beliebigem XFF-Wert das Sign-in-Rate-Limit umgehen (jede Anfrage neuer Bucket) | `src/hooks.server.ts:88-99` | Brute-Force-Schutz wirkungslos, wenn direkt exponiert | XFF nur bei konfiguriertem `TRUST_PROXY`/bekannten Proxy-IPs auswerten | im Rewrite beheben | F-003, F-004 |
| B-004 | Service Worker cacht **jede** same-origin-GET-Antwort (`cache.put`) – also auch Remote-Query-Antworten `/_app/remote/*` (Geschäftsdaten, pro Argument neuer Eintrag) und `/api/auth/get-session`; das gecachte `/`-HTML wird offline auch nach Logout ausgeliefert. Widerspricht dem eigenen Kommentar „Offline caching of API data is explicitly out of scope“ | `src/service-worker.ts:82-118` | Datenschutz auf geteilten Werkstatt-PCs, unbegrenztes Cache-Wachstum, veraltete Daten offline | Nur Build-Assets/Icons cachen (Allowlist), API/Remote/HTML vom `cache.put` ausschließen; Offline-Seite statt gecachtem Dashboard | im Rewrite beheben | F-051 |
| B-005 | SW-Update-Strategie: `skipWaiting` + `clients.claim` + Löschen aller alten Caches ohne Reload-Hinweis; kein `kit.version.pollInterval` → laufende Tabs können nach Deploy Chunks nicht mehr nachladen | `src/service-worker.ts:65,70-80`; `svelte.config.js:8-19` | Sporadische Fehler nach Deploys bis Reload | Update-Banner „Neue Version verfügbar“ + Version-Polling; alte Caches erst nach Reload räumen | Entscheidung nötig | F-051 |
| B-006 | Dashboard-KPIs und Termin-Feed nur mit `requireUser()` — Monatsumsatz/-ausgaben/-saldo, Kunden-/Fahrzeugzahlen, offene Rechnungen, Termine sind für jeden angemeldeten Nutzer sichtbar (z. B. nur `hours:write_own`) | `src/routes/dashboard.remote.ts:17-32` | Verstoß gegen das Modul-Rechtemodell, Finanzdaten-Leak | Kacheln je Modulrecht ausliefern/ausblenden (ledger → Finanz-KPIs, invoices/reminders, calendar, customers, vehicles) | im Rewrite beheben | F-039, F-041 |
| B-007 | „Schnelle Aktionen“ nicht permission-gefiltert (u. a. „Import starten“ → `/settings/import`, „Neuer Mitarbeiter“) | `src/routes/+page.svelte:97-120` | Klick endet auf 403-Fehlerseite | Links nach `permissions` filtern (dieselbe Regel wie Sidebar) | im Rewrite beheben | F-040 |
| B-008 | Dashboard memoisiert den Query-Proxy (`const kpisQ = $derived(getDashboardKpis())`) und rendert `…` als Client-Ladezustand statt SSR-top-level-await; direkter Verstoß gegen CONTRIBUTING §5 („Never memoize the remote-query proxy“) und §6 (kein Loader-Swap) | `src/routes/+page.svelte:23-25, 43-89` | Inkonsistente Ladeerfahrung, Regelbruch im Referenzcode | Beide Queries top-level awaiten | im Rewrite beheben | F-039 |
| B-009 | `globalSearch` führt immer alle 9 Bucket-Queries (11 SQL-Statements) aus; Berechtigungsfilter greift erst danach | `src/routes/search.remote.ts:33-48`; `src/lib/server/services/search-service.ts:96-116` | Unnötige DB-Last, Daten werden serverseitig geladen, die der Nutzer nicht sehen darf | Erlaubte Buckets vor dem Query bestimmen und nur diese ausführen | im Rewrite beheben | F-028 |
| B-010 | GlobalSearch: keine Abbruch-/Sequenzkontrolle – eine langsamere ältere Antwort überschreibt neuere Ergebnisse; `runSearch` hat `try/finally` ohne `catch` → unhandled rejection, kein `handleClientError` (Verstoß CONTRIBUTING §12.5 „silent catch/uncaught“) | `src/lib/components/ui/GlobalSearch.svelte:172-196` | Falsche Treffer nach schnellem Tippen; Fehler unsichtbar | Request-Sequenznummer/AbortController; `catch` → `handleClientError` | im Rewrite beheben | F-028, F-029 |
| B-011 | Duplizierte, inkonsistente Label-Maps: `search-service.typeLabel` (order_confirmation → „Auftrag“, credit_note → „Gutschrift“) vs. `status-labels.documentTypeLabel` (order_confirmation → „Auftragsbestätigung“, `credit_note` fehlt → englischer Rohwert); `searchItems`-Sublabel kennt nur Leistung/Artikel (Material, Durchlaufposten, Fahrzeug werden „Artikel“); `seasonLabel` lokal statt zentral | `src/lib/server/services/search-service.ts:67-73, 258-262, 265-272`; `src/lib/utils/status-labels.ts:230-251` | Uneinheitliche deutsche Begriffe, englischer Leak bei Gutschriften außerhalb der Suche | Eine zentrale Label-Quelle (status-labels) inkl. `credit_note`, in der Suche `itemKindLabel` verwenden | im Rewrite beheben | F-032, F-037, F-046 |
| B-012 | Für unbekannte Routen liefert SvelteKit `message: 'Not Found'`; `handleError` reicht nicht-leere Texte unverändert durch, `+error.svelte` zeigt sie im Alert → englischer Text auf der 404-Seite (zu verifizieren im Browser) | `src/hooks.server.ts:464-468`; `src/routes/+error.svelte:62-65` | i18n-Leak | In `handleError` bekannte Framework-Defaults („Not Found“) auf deutsche Texte mappen; 404 ohne Detail-Alert | im Rewrite beheben | F-008, F-010 |
| B-013 | Idle-Logout läuft pro Tab ohne Vorwarnung und ohne Tab-Synchronisation: Aktivität in Tab B verhindert nicht, dass Tab A nach 60 min `signOut` ausführt und damit die Session **aller** Tabs beendet | `src/lib/stores/idle-logout.svelte.ts:50-89`; `src/lib/components/layout/AppShell.svelte:119-133` | Datenverlust in offenen Formularen, Nutzer wird mitten in der Arbeit ausgeloggt | Letzte Aktivität in `localStorage`/`BroadcastChannel` teilen; Vorwarn-Dialog (z. B. 2 min) mit „Angemeldet bleiben“ | im Rewrite beheben (Dauer/Warnung: Entscheidung nötig) | F-016 |
| B-014 | 401 aus Remote-Funktionen (Session abgelaufen, Konto deaktiviert) erzeugt nur einen Toast „Bitte melden Sie sich an.“ – kein Redirect zum Login, der Nutzer bleibt in einer toten Shell | `src/lib/utils/client-error.ts:24-39`; `src/lib/server/auth-guards.ts:23-29` | Verwirrende UX, wiederholte Fehl-Toasts | Client-Fehlerfunnel: bei 401 → `location.href = '/login?redirectTo=…'` | im Rewrite beheben | F-009, F-001 |
| B-015 | `ensureSeeded`: schlägt `seedDefaults()` einmal fehl, bleibt `seedPromise` dauerhaft rejected und `seeded=false` → jede weitere Anfrage wirft dieselbe Rejection (500) bis zum Prozessneustart | `src/hooks.server.ts:41-53` | Kompletter Ausfall nach transientem DB-Fehler beim Start | `seedPromise = null` im `catch`, Retry; oder Seeding in den Migrations-/Startschritt verlagern | im Rewrite beheben | F-006 |
| B-016 | Pro Request 4 DB-Roundtrips für Auth (`getSession`, `isUserActive`, `user_roles`, `role_permissions`) – auch für jeden Remote-Call und jede Navigation | `src/hooks.server.ts:204-219`; `src/lib/server/auth-permissions.ts:17-35` | Latenz und DB-Last skalieren mit jeder Interaktion | Eine Join-Query oder kurzer In-Memory-Cache (mit Invalidierung bei Rollen-/Deaktivierungsänderung) | bewusst später | F-002 |
| B-017 | `/icon.png` (1.143.050 Bytes) dient als Favicon und als 38-px-Sidebar-Logo, obwohl `icon-64.webp`/`icon-128.webp` existieren | `src/app.html:8`; `src/lib/components/layout/AppShell.svelte:404-411`; `static/icon.png` | 1,1 MB Download beim ersten Shell-Load (Mobilfunk) | Kleine WebP-Varianten verwenden, `icon.png` aus `static/` entfernen | im Rewrite beheben | F-020, F-050 |
| B-018 | `auth.ts` fällt ohne `APP_SECRET` still auf ein festes Dev-Secret zurück (Cookie-Signatur fälschbar), während `crypto.ts` fail-closed wirft – inkonsistent | `src/lib/server/auth.ts:37`; `src/lib/server/crypto.ts:31-36` | Produktivbetrieb mit bekanntem Secret möglich | In Produktion beim Start hart abbrechen, wenn `APP_SECRET` fehlt | im Rewrite beheben | F-002, F-048 |
| B-019 | Mobile Drawer: `#app-drawer`-Checkbox wird bei Client-Navigation nie zurückgesetzt → Drawer bleibt nach Tippen auf einen Nav-Link vermutlich offen (nicht im Browser verifiziert) | `src/lib/components/layout/AppShell.svelte:240-260, 419-443` | Mobile Navigation braucht zusätzlichen Tap | Drawer in `afterNavigate` schließen | im Rewrite beheben (verifizieren) | F-025 |
| B-020 | AppShell nutzt den deprecated `$app/stores`-`page`-Store; der Rest der App nutzt `$app/state` | `src/lib/components/layout/AppShell.svelte:3` | Inkonsistenz, Deprecation | Einheitliche Page-State-API | im Rewrite beheben | F-020, F-021 |
| B-021 | Deutsche Code-Kommentare (Regel: englisch) und veraltete Aussagen („fragt zurück per `confirm`“ – tatsächlich ConfirmDialog) | `src/lib/stores/form-dirty.svelte.ts:1-25`; `src/lib/components/layout/AppShell.svelte:27-38`; `src/lib/server/services/dashboard-service.ts:131-141`, `vehicle-service.ts:69-73` | Verstoß gegen Sprachregel, irreführende Doku | Kommentare im Rewrite englisch und korrekt | im Rewrite beheben | — |
| B-022 | `form-validation.svelte.ts` Header-Kommentar und Test-Titel behaupten „Submit disabled until valid“; CONTRIBUTING §11 verbietet genau das | `src/lib/utils/form-validation.svelte.ts:6-9`; `src/lib/utils/form-validation.svelte.test.ts:158` | Irreführende Doku für Nachnutzer | Kommentar/Test-Titel korrigieren | im Rewrite beheben | F-044 |
| B-023 | CONTRIBUTING §7 und CLAUDE.md nennen eine `scrollbar-gutter: stable`-Regel in `app.css` auf `html, body`; der Code hat sie bewusst entfernt (Chrome-Weißstreifen) und trägt sie inline am Scroll-Container | `src/app.css:7-14`; `CONTRIBUTING.md:507-509`; `CLAUDE.md:88` | Regelwerk widerspricht Code | Regelwerk aktualisieren; im Rewrite Scroll-Container-Gutter beibehalten | Entscheidung nötig (Doku) | — |
| B-024 | CONTRIBUTING §7 verlangt einen Versions-Footer „nur unten in der Sidebar“; AppShell hat keinen, die Version steht nur auf `/login` | `CONTRIBUTING.md:540-542`; `src/lib/components/layout/AppShell.svelte:445-493`; `src/routes/login/+page.svelte:198-200` | Regelwerk widerspricht Code | Entscheiden, wo die Version angezeigt wird (Sidebar/Profil/Login) | Entscheidung nötig | F-014 |
| B-025 | CONTRIBUTING §4 nennt nur 3 `+server.ts`-Ausnahmen (OAuth-Callback fehlt) und in der Permission-Liste fehlen `orders` und `posts` | `CONTRIBUTING.md:85-90, 138-142`; `src/lib/permissions.ts:27-48` | Regelwerk unvollständig | Regelwerk mit `permissions.ts` synchronisieren | bewusst später (Doku) | F-020 |
| B-026 | `clampPagination` ist toter Code und erlaubt Seitengrößen 10/50/100 entgegen der „fixed 25“-Regel; `Pagination.svelte` akzeptiert ungenutzte `size`/`onSize`-Props | `src/lib/utils/pagination.ts:5-15`; `src/lib/components/ui/Pagination.svelte:14-19` | Toter Code, Verwirrung | Im Rewrite weglassen bzw. auf 25 fixieren | im Rewrite beheben | F-045 |
| B-027 | `roundMoney` arbeitet auf Float (`Math.round(\|v\|*100)/100`) → klassische Artefakte (`1.005 → 1.00`, `1.255 → 1.25`); Geldbeträge laufen als `number` durch die App, DB liefert Strings (`'100.00'`) | `src/lib/utils/money.ts:11-14`; `src/lib/server/services/dashboard-service.ts:113-114` | Rundungsfehler in Cent-Beträgen möglich (Rechnungen) | Integer-Cents oder Decimal-Bibliothek; Rundung mit Epsilon-Korrektur | Entscheidung nötig | F-045 |
| B-028 | Zeitzonen-Inkonsistenz: `renderNumber` nutzt lokale Prozesszeit, Dashboard nutzt UTC für „aktueller Monat“/„heute“ → für Europe/Berlin zeigt das Dashboard in den ersten 1–2 Stunden eines Monats/Tages noch den Vortag/Vormonat; Kalender-„heute“ ebenfalls UTC | `src/lib/utils/numbering.ts:17-19`; `src/lib/server/services/dashboard-service.ts:47-61, 143-144` | Falsche KPIs um Mitternacht/Monatswechsel, Nummernkreis-Jahr abhängig von Container-TZ | Eine Geschäfts-Zeitzone (Europe/Berlin) zentral definieren und überall verwenden | im Rewrite beheben | F-039, F-041, F-045 |
| B-029 | `getUpcoming`: `status='cancelled'` wird erst nach `LIMIT 20` in JS gefiltert (20 stornierte Termine verdrängen gültige); Termin-Einträge verlinken nur auf `/calendar`, `entryId` ungenutzt; mehrtägige laufende Termine (Start vor heute) fehlen | `src/lib/server/services/dashboard-service.ts:167-183, 198-206`; `src/routes/+page.svelte:149-151` | Unvollständiger/irreführender Feed, kein Deep-Link | Filter in SQL (`ne(status,'cancelled')` wie im KPI-Query), Link auf Termin-Detail/`?date=` | im Rewrite beheben | F-041 |
| B-030 | Kennzeichen-Vorabfrage in `searchVehicles` hat kein LIMIT; kurze Terme („B-“) liefern große `inArray`-Listen; keine Trigram-Indizes für `%term%`-ILIKE (laut Doku bekannt) | `src/lib/server/services/search-service.ts:177-181`; `docs/architecture/remote-functions.md:125-129` | Langsame Suche bei wachsendem Bestand | Kennzeichen als Join/EXISTS in die Hauptquery ziehen; `pg_trgm`-GIN-Indizes | bewusst später | F-031 |
| B-031 | `openPdfInNewTab` ruft `window.open` nach einem `await` (außerhalb der User-Geste) → Popup-Blocker können den Tab blockieren; kein Fallback | `src/lib/utils/pdf-download.ts:52-64` | PDF öffnet nicht in restriktiven Browsern | Tab synchron im Click-Handler öffnen und später `location` setzen, oder inline `PdfViewer` | im Rewrite beheben | F-047 |
| B-032 | Sign-in-Limit 10/min pro IP zählt auch erfolgreiche Logins; ein Büro hinter einer NAT-IP kann sich morgens gegenseitig aussperren | `src/hooks.server.ts:17, 111-132` | Legitime Nutzer blockiert | Bucket pro IP+Benutzername oder nur Fehlversuche zählen; höheres Limit | Entscheidung nötig | F-003 |
| B-033 | `getLayoutContext` (ohne Guard, anonym erreichbar) löst über `getSettings()` einen INSERT in `company_settings` aus, wenn die Tabelle leer ist – Schreibzugriff in einer Query | `src/routes/layout.remote.ts:18-24`; `src/lib/server/services/settings-service.ts:7-14` | Seiteneffekt in Read-Pfad, Race bei parallelen Erstanfragen möglich | Settings-Zeile beim Seeding/Migration anlegen; Query rein lesend | im Rewrite beheben | F-018 |
| B-034 | Dokumenttitel `<title>` ist überall statisch „TwinCarsManager“; `pageHeader.title` wird nur im Header gerendert; `pageTitle.set('Anmelden')` auf der Login-Seite ist wirkungslos (kein Shell) | `src/routes/+layout.svelte:74-76`; `src/routes/login/+page.svelte:16-19` | Browser-Tabs/History nicht unterscheidbar, a11y | `<title>` aus `pageHeader.title` ableiten (`<Seite> · TwinCarsManager`) | im Rewrite beheben | F-021 |
| B-035 | a11y: GlobalSearch-Dialog ohne Fokus-Trap (`modal-open`-Klasse statt `showModal()`), Input ohne `aria-label`, Trefferliste ohne `role=listbox`/`aria-activedescendant`; ToastTray nutzt `role=status`/`polite` auch für Fehler | `src/lib/components/ui/GlobalSearch.svelte:246-262, 309-335`; `src/lib/components/ui/ToastTray.svelte:24-27` | Screenreader-Nutzer erhalten Fehler/Trefferwechsel nicht zuverlässig | Native `<dialog>.showModal()`, Combobox-Pattern, `role=alert` für Fehler-Toasts | im Rewrite beheben | F-029, F-042 |
| B-036 | Layering-Inversion: `$lib`-Komponente importiert aus `routes` (`../../../routes/search.remote`) | `src/lib/components/ui/GlobalSearch.svelte:16` | Kopplung Komponente ↔ Route | Remote-Import per Prop/Callback injizieren oder Remote nach `$lib` | im Rewrite beheben | F-028 |
| B-037 | Tote/ungenutzte Oberflächen: `PageHeader.subtitle` (nicht gerendert), `pageTitle`-Alias, ungenutzte Icon-Importe (`CalendarClock`, `Gift`), `login`-`pageTitle`-Effect | `src/lib/components/layout/PageHeader.svelte:17-18`; `src/lib/stores/page-title.svelte.ts:55-62`; `src/lib/components/layout/navigation.ts:7,20` | Wartungsballast | Im Rewrite nicht übernehmen | im Rewrite beheben | — |
| B-038 | Unsaved-Guard bei Browser-Zurück (`popstate`): Navigation wird gecancelt und nach „Verwerfen“ per `goto(target)` neu angesteuert → History erhält einen zusätzlichen Vorwärts-Eintrag statt zurückzugehen | `src/lib/components/layout/AppShell.svelte:42-60` | Verwirrender Verlauf nach Verwerfen | Bei `nav.type === 'popstate'` `history.back()`/`nav.delta` verwenden | im Rewrite beheben | F-024 |
| B-039 | `robots.txt` erlaubt Crawling für eine reine Login-Anwendung; Manifest-Name „TwinCars Manager“ weicht vom App-Titel „TwinCarsManager“ ab | `static/robots.txt`; `static/manifest.webmanifest:2-3` | Login-Seite indexierbar; uneinheitliche Benennung | `Disallow: /`; Namen vereinheitlichen | Entscheidung nötig | F-050 |
| B-040 | Zahlungsart wird als deutscher Klartext gespeichert (`'Überweisung'`…); Datenmodell an UI-Sprache gekoppelt | `src/lib/payment-methods.ts:13-18` | Umbenennung/Übersetzung erfordert Datenmigration | Codes (`bank_transfer`, `cash`, …) + Label-Map | Entscheidung nötig (Datenmodell) | F-053 |
| B-041 | `/_app` ist Public-Prefix, damit auch `/_app/remote/*`: der Auth-Hook schützt Remote-Calls nicht; Sicherheit hängt vollständig von der Guard-Disziplin jeder einzelnen Remote-Funktion ab (kein Defense-in-Depth); `layout.remote.ts` ist bewusst guardlos | `src/hooks.server.ts:61-75`; `src/routes/layout.remote.ts` | Ein vergessener Guard = offener Datenzugriff | In Nuxt: Server-Middleware, die `/api/**` außer expliziter Allowlist zentral authentifiziert, Guards zusätzlich | im Rewrite beheben | F-001 |
| B-042 | Umlaut-Heuristik in `handleValidationError`: deutsche Meldungen ohne Umlaut werden als „englisch“ verworfen und durch „Bitte prüfen Sie Ihre Eingabe.“ ersetzt – konkret betroffen im Modul: „Suchbegriff zu lang.“, „Bitte einen Suchbegriff eingeben.“ | `src/hooks.server.ts:434-440`; `src/routes/search.remote.ts:9-11` | Kuratierte Meldungen gehen verloren | Sprache nicht heuristisch raten: eigene Schemas markieren oder Valibot-Default-Präfixe (`Invalid\|Expected\|Missing`) erkennen wie im Client-Helper | im Rewrite beheben | F-007, F-028 |
| B-043 | Header-Aktivmarkierung per Präfix: auf `/settings/inquiries` sind „Einstellungen“ und „Anfragen“ gleichzeitig aktiv; Route-Titel „Anfragen“ nur wegen Längst-Präfix-Regel | `src/lib/components/layout/AppShell.svelte:135-154` | Doppelte Hervorhebung | Aktivmarkierung über längsten Treffer, nicht über alle Präfixe | im Rewrite beheben | F-020 |
| B-044 | `useFormValidation`-Heuristik verwirft Meldungen, die mit `Invalid\|Expected\|Missing` beginnen, akzeptiert aber sonstige englische Texte; Server-Heuristik (Umlaut) und Client-Heuristik (Präfix) sind unterschiedlich → dieselbe Meldung kann client- und serverseitig unterschiedlich erscheinen | `src/lib/utils/form-validation.svelte.ts:110-122`; `src/hooks.server.ts:439` | Inkonsistente Texte | Eine gemeinsame Regel/i18n-Quelle für beide Seiten | im Rewrite beheben | F-007, F-044 |
| B-045 | ILIKE-Suchterm wird nicht escaped (`%`, `_` des Nutzers wirken als Wildcards) | `src/lib/server/services/search-service.ts:94` | Unerwartete Treffer, teure Scans mit „%“ | `%`/`_`/`\` escapen | im Rewrite beheben | F-028 |

## 11. Offene Fragen an den Architekten

1. Idle-Logout: bleibt 60 min? Soll eine Vorwarnung (Countdown, „Angemeldet bleiben“) kommen, und soll Aktivität tab-übergreifend zählen (B-013)?
2. Welche Dashboard-Kacheln/Schnellaktionen sollen welchem Modulrecht folgen, und sollen Kacheln zu ihren Listen verlinken (B-006/07)?
3. PWA-Umfang im Rewrite: nur Installierbarkeit + Asset-Cache, oder gezielte Offline-Fähigkeit? Update-Banner gewünscht (B-004/05)?
4. Globale Suche: bleibt es bei 8 Treffern je Bucket ohne Pagination, oder soll ein „Alle Treffer in <Modul> anzeigen“-Sprung in die Listen-Suche kommen? Relevanz-Ranking (Prefix vor Infix) gewünscht?
5. Rate-Limits: Sign-in pro IP (NAT-Problem) oder pro Benutzername+IP? Wird die App hinter einem Proxy betrieben (XFF-Vertrauen, B-003/32)?
6. Geschäfts-Zeitzone (Europe/Berlin) als feste Konstante oder pro Firma konfigurierbar (B-028)?
7. Geldrepräsentation im Rewrite: Integer-Cents vs. Decimal-Strings (B-027)?
8. Soll `/setup` nach Abschluss serverseitig gesperrt und das Setup-Gate serverseitig erzwungen werden (B-001)?
9. Versionsanzeige: Login, Sidebar-Footer (laut CONTRIBUTING) oder Profil-Seite (B-024)?
10. Sollen Zahlungsarten als Codes migriert werden (B-040)?
11. Session-Lebensdauer (7 Tage, `updateAge` 1 Tag, Cookie-Cache 5 min) beibehalten? Soll Rollenänderung weiterhin pro Request wirken (B-016 vs. Cache)?
12. Bleibt „Anfragen“ physisch unter `/settings` (Nav zeigt es unter Kommunikation) oder bekommt es eine eigene Route?

## 12. Gelesene Dateien

Vollständig gelesen (Zeilen laut `wc -l`):

| Datei | Zeilen |
|---|---|
| `src/hooks.server.ts` | 471 |
| `src/hooks.ts` | 5 |
| `src/app.html` | 37 |
| `src/app.css` | 19 |
| `src/app.d.ts` | 21 |
| `src/service-worker.ts` | 118 |
| `src/routes/+layout.svelte` | 88 |
| `src/routes/+error.svelte` | 77 |
| `src/routes/layout.remote.ts` | 47 |
| `src/lib/components/layout/AppShell.svelte` | 511 |
| `src/lib/components/layout/navigation.ts` | 247 |
| `src/lib/components/layout/PageHeader.svelte` | 33 |
| `src/lib/stores/busy.svelte.ts` | 94 |
| `src/lib/stores/creation-flow.svelte.ts` | 223 |
| `src/lib/stores/form-dirty.svelte.ts` | 38 |
| `src/lib/stores/idle-logout.svelte.ts` | 89 |
| `src/lib/stores/page-title.svelte.ts` | 62 |
| `src/lib/stores/toast.svelte.ts` | 72 |
| `src/lib/utils/client-error.ts` | 69 |
| `src/lib/utils/ebay-detection.ts` | 34 |
| `src/lib/utils/form-validation.svelte.ts` | 201 |
| `src/lib/utils/iban.ts` | 58 |
| `src/lib/utils/money.ts` | 51 |
| `src/lib/utils/numbering.ts` | 26 |
| `src/lib/utils/pagination.ts` | 43 |
| `src/lib/utils/pdf-download.ts` | 91 |
| `src/lib/utils/picker-labels.ts` | 61 |
| `src/lib/utils/status-labels.ts` | 269 |
| `src/lib/payment-methods.ts` | 20 |
| `src/lib/server/rate-limit.ts` | 137 |
| `src/lib/server/otel-noop.ts` | 75 |
| `src/lib/server/crypto.ts` | 92 |
| `src/routes/login/+page.svelte` | 202 |
| `src/routes/login/sign-in-error.ts` | 34 |
| `src/lib/client/auth-client.ts` | 17 |
| `src/routes/+page.svelte` | 171 |
| `src/routes/dashboard.remote.ts` | 32 |
| `src/lib/server/services/dashboard-service.ts` | 209 |
| `src/routes/search.remote.ts` | 49 |
| `src/lib/server/services/search-service.ts` | 500 |
| `src/lib/components/ui/GlobalSearch.svelte` | 366 |
| `src/lib/components/ui/ToastTray.svelte` | 46 |
| `src/lib/components/ui/Loader.svelte` | 61 |
| `static/manifest.webmanifest` | 23 |
| `static/robots.txt` | 3 |
| `static/` Dateiliste (13 Dateien, Größen erfasst) | — |
| `vite.config.ts` | 50 |
| `svelte.config.js` | 22 |
| `vitest.setup.ts` | 1 |
| `src/lib/server/auth-guards.ts` (unterstützend) | 60 |
| `src/lib/permissions.ts` (unterstützend) | 53 |
| `src/lib/server/auth-permissions.ts` (unterstützend) | 35 |
| `src/lib/components/ui/StatCard.svelte` (unterstützend) | 60 |
| `src/lib/server/auth.ts` (unterstützend) | 71 |
| `src/lib/server/auth-users.ts` (unterstützend) | 142 |
| `src/hooks.server.test.ts` | 328 |
| `src/service-worker.test.ts` | 311 |
| `src/routes/dashboard.remote.test.ts` | 310 |
| `src/routes/search.remote.test.ts` | 402 |
| `src/routes/login/page.test.ts` | 64 |
| `src/routes/login/sign-in-error.test.ts` | 54 |
| `src/lib/components/layout/AppShell.test.ts` | 373 |
| `src/lib/components/layout/navigation.test.ts` | 128 |
| `src/lib/components/layout/PageHeader.test.ts` | 72 |
| `src/lib/stores/busy.svelte.test.ts` | 119 |
| `src/lib/stores/creation-flow.svelte.test.ts` | 276 |
| `src/lib/stores/form-dirty.svelte.test.ts` | 35 |
| `src/lib/stores/idle-logout.svelte.test.ts` | 98 |
| `src/lib/stores/page-title.svelte.test.ts` | 29 |
| `src/lib/stores/toast.svelte.test.ts` | 64 |
| `src/lib/utils/client-error.test.ts` | 63 |
| `src/lib/utils/ebay-detection.test.ts` | 76 |
| `src/lib/utils/form-validation.svelte.test.ts` | 243 |
| `src/lib/utils/iban.test.ts` | 50 |
| `src/lib/utils/money.test.ts` | 74 |
| `src/lib/utils/numbering.test.ts` | 50 |
| `src/lib/utils/pagination.test.ts` | 57 |
| `src/lib/utils/pdf-download.test.ts` | 208 |
| `src/lib/utils/picker-labels.test.ts` | 120 |
| `src/lib/utils/status-labels.test.ts` | 119 |
| `src/lib/server/crypto.test.ts` | 109 |
| `src/lib/server/rate-limit.test.ts` | 107 |
| `src/lib/server/services/search-service.test.ts` | 674 |
| `src/lib/components/ui/GlobalSearch.test.ts` | 309 |
| `src/lib/components/ui/ToastTray.test.ts` | 82 |
| `src/lib/components/ui/Loader.test.ts` | 57 |
| `e2e/auth.spec.ts` | 49 |
| `CONTRIBUTING.md` | 1474 |
| `docs/architecture/loading-and-busy.md` | 75 |
| `docs/architecture/pwa-service-worker.md` | 38 |
| `docs/architecture/validation-and-errors.md` | 88 |
| `docs/architecture/remote-functions.md` | 141 |
| `docs/architecture/creation-flow.md` | 93 |
| `docs/architecture/known-constraints.md` | 74 |
| `docs/modules/dashboard-and-login.md` | 42 |
| `docs/modules/search.md` | 27 |
| `docs/decisions/adr-001-remote-functions-only.md` | 36 |
| `docs/decisions/adr-008-single-busy-store.md` | 30 |
| `docs/decisions/adr-018-otel-noop-shim.md` | 31 |

Teilweise gelesen (nur per `grep`/`sed` geprüfte Ausschnitte): `src/lib/components/ui/Pagination.svelte` (Zeilen 1–80), `src/lib/server/services/settings-service.ts` (`getSettings`, Z. 7–14), `src/lib/server/services/vehicle-service.ts` (`latestPlateSubquery`, Z. 55–75), `src/routes/setup/setup.remote.ts` (nur Treffer zu `setupCompleted`), `src/lib/server/db/seed-defaults.ts` (nur Export-Zeile 197), `src/lib/server/db/validation.ts` (nur Meldungs-Grep), `e2e/navigation.spec.ts` (Z. 65–140), `e2e/smoke.spec.ts` (nur Test-Titel), `e2e/helpers.ts` (Z. 161–180), `node_modules/@sveltejs/kit/src/runtime/server/remote.js` (Z. 339–340, Remote-URL-Präfix), `package.json` (Version). Nicht gelesen: `src/routes/pickers.remote.test.ts`, `src/lib/server/api-tokens.test.ts`, `src/lib/server/auth-permissions.test.ts`, `src/lib/server/auth-users.test.ts` (andere Module).

### Anhang A — vollständige `FIELD_LABELS`-Map (`src/hooks.server.ts:264-375`, 104 Einträge)

| Feldschlüssel | Deutsches Label |
|---|---|
| `company` | Firma |
| `salutation` | Anrede |
| `title` | Titel |
| `firstName` | Vorname |
| `lastName` | Nachname |
| `name` | Name |
| `street` | Straße |
| `zip` | PLZ |
| `city` | Ort |
| `country` | Land |
| `phone` | Telefon |
| `privatePhone` | Telefon (privat) |
| `mobile` | Mobilnummer |
| `fax` | Fax |
| `email` | E-Mail |
| `privateEmail` | E-Mail (privat) |
| `website` | Website |
| `notes` | Notiz |
| `paymentTermDays` | Zahlungsziel (Tage) |
| `vatId` | USt-IdNr. |
| `taxNumber` | Steuernummer |
| `bankIban` | IBAN |
| `iban` | IBAN |
| `bankBic` | BIC |
| `bic` | BIC |
| `bankName` | Bank |
| `bankAccountHolder` | Kontoinhaber |
| `amount` | Betrag |
| `taxRate` | Steuersatz |
| `discountPercent` | Rabatt (%) |
| `customerNumber` | Kundennummer |
| `ebayHandle` | eBay-Name |
| `customerId` | Kunde |
| `vehicleId` | Fahrzeug |
| `employeeId` | Mitarbeiter |
| `supplierId` | Lieferant |
| `licensePlate` | Kennzeichen |
| `vin` | FIN |
| `hsn` | HSN |
| `tsn` | TSN |
| `make` | Marke |
| `model` | Modell |
| `firstRegistration` | Erstzulassung |
| `mileageKm` | km-Stand |
| `nextHu` | Nächste HU |
| `nextAu` | Nächste AU |
| `displacementCcm` | Hubraum (ccm) |
| `powerKw` | Leistung (kW) |
| `colorCode` | Farbcode |
| `engineNumber` | Motornummer |
| `fuelType` | Kraftstoff |
| `gearbox` | Getriebe |
| `bodyType` | Aufbau |
| `purchasePrice` | Ankaufspreis |
| `purchaseDate` | Ankaufsdatum |
| `personnelNumber` | Personalnummer |
| `birthday` | Geburtstag |
| `birthplace` | Geburtsort |
| `nationality` | Staatsangehörigkeit |
| `hireDate` | Eintrittsdatum |
| `terminationDate` | Austrittsdatum |
| `position` | Position |
| `department` | Abteilung |
| `employmentType` | Beschäftigungsart |
| `weeklyHours` | Wochenstunden |
| `monthlySalary` | Monatsgehalt |
| `hourlyWage` | Stundenlohn |
| `vacationDaysPerYear` | Urlaubstage pro Jahr |
| `halfDay` | Halber Tag |
| `taxId` | Steuer-ID |
| `taxClass` | Steuerklasse |
| `socialInsuranceNumber` | Sozialversicherungsnummer |
| `healthInsurance` | Krankenkasse |
| `documentNumber` | Belegnummer |
| `issueDate` | Belegdatum |
| `serviceDate` | Leistungsdatum |
| `dueDate` | Fälligkeitsdatum |
| `validFrom` | Gültig ab |
| `dateFrom` | Datum von |
| `dateTo` | Datum bis |
| `from` | Von |
| `to` | Bis |
| `items` | Positionen |
| `quantity` | Menge |
| `unit` | Einheit |
| `unitPriceNet` | Einzelpreis (netto) |
| `purchasePriceNet` | Einkaufspreis (netto) |
| `description` | Beschreibung |
| `articleNumber` | Artikelnummer |
| `brand` | Hersteller |
| `stockOnHand` | Bestand |
| `subject` | Betreff |
| `body` | Nachricht |
| `filename` | Dateiname |
| `attachments` | Anhänge |
| `username` | Benutzername |
| `password` | Passwort |
| `host` | Server |
| `port` | Port |
| `fromName` | Absendername |
| `q` | Suchbegriff |
| `page` | Seite |
| `size` | Seitengröße |
| `status` | Status |

Pfad-Regeln (`fieldLabelForPath`, `hooks.server.ts:385-405`): Segment `values` wird entfernt; endet der Pfad auf einen Index, wird das Elternfeld mit „(Position N)“ beschriftet; `items.0.quantity` → „Menge (Position 1)“; unbekannte Keys erscheinen roh.

### Anhang B — Katalog aller Fehler-/Hinweistexte der Plattform

| Quelle | Text |
|---|---|
| `hooks.server.ts:123` | Zu viele Anmeldeversuche, bitte warten Sie eine Minute. |
| `hooks.server.ts:158` | Zu viele Anfragen. Bitte reduzieren Sie die Aufrufrate. |
| `hooks.server.ts:195` | Dieses Konto ist deaktiviert. Bitte wenden Sie sich an die Administration. |
| `hooks.server.ts:440-444` | Ungültige Eingabe für „<Label>“: <Meldung> / Ungültige Eingabe: <Meldung> / Bitte prüfen Sie Ihre Eingabe. |
| `hooks.server.ts:462` | Ein interner Fehler ist aufgetreten. |
| `hooks.server.ts:469` | Die Anfrage konnte nicht bearbeitet werden. |
| `auth-guards.ts:26` | Bitte melden Sie sich an. |
| `auth-guards.ts:40,57` | Keine Berechtigung für diese Aktion. |
| `client-error.ts:9` | Es ist leider ein Fehler aufgetreten. |
| `crypto.ts:34,79` | Weder APP_ENCRYPTION_KEY noch APP_SECRET ist gesetzt - Verschlüsselung nicht möglich. / Unbekanntes Chiffrat-Format. |
| `sign-in-error.ts:22,31,33` | Zu viele Anmeldeversuche, bitte warten Sie eine Minute. / Benutzername oder Passwort ist falsch. / Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut. |
| `login/+page.svelte:46-55,69,81,108,137` | Bitte einen Benutzernamen eingeben. / Benutzername zu kurz (mind. 3 Zeichen). / Benutzername zu lang. / Bitte ein Passwort eingeben. / Passwort zu kurz (mind. 8 Zeichen). / Passwort zu lang. / Sie wurden wegen einer Stunde Inaktivität automatisch abgemeldet. Bitte melden Sie sich erneut an. / Bitte prüfen Sie Ihre Eingaben. / Anmeldung fehlgeschlagen. / Bitte melden Sie sich mit Ihrem Benutzernamen und Passwort an. |
| `AppShell.svelte:109,502-505` | Abmeldung fehlgeschlagen. / Ungespeicherte Änderungen / Es gibt ungespeicherte Änderungen. Sollen sie verworfen werden? / Verwerfen / Bleiben |
| `+error.svelte:22-40` | Seite nicht gefunden / Zugriff nicht erlaubt / Ungültige Eingabe / Es ist ein Fehler aufgetreten / (Sublines s. §4) / Fehler {status} / Zurück / Zum Dashboard |
| `GlobalSearch.svelte:282,288,294` | Mindestens 2 Zeichen eingeben. / Suche läuft… / Keine Treffer. |
| `+page.svelte:137` | Aktuell keine anstehenden HU-Termine oder Werkstatt-Termine. |
| `Loader.svelte:28` | Inhalte werden geladen |
| `search.remote.ts:9,11` | Bitte einen Suchbegriff eingeben. / Suchbegriff zu lang. |
| `form-validation.svelte.ts:121` | Bitte prüfen Sie Ihre Eingabe. |
