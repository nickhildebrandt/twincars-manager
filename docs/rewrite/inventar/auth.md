---
title: Inventar Auth & Benutzer (AUTH)
teil_von: docs/rewrite/01-inventar.md
stand: Bestand (SvelteKit) vor dem Rewrite
---

> **Detail-Inventar des Bestands.** Erhoben durch vollständiges Lesen der in
> Abschnitt „Gelesene Dateien" genannten Dateien. Die IDs wurden auf die
> globalen IDs aus [01-inventar.md](../01-inventar.md) umgestellt
> (76 IDs). Zurück: [01-inventar.md](../01-inventar.md) ·
> [02-befunde.md](../02-befunde.md)

# Modul: Authentifizierung, Berechtigungen, Benutzer- und Rollenverwaltung, Konto   (Kürzel: AUTH)

Sprache: Deutsch für Fließtext/Tabellen; Code-Bezeichner, Dateipfade, Tabellen-/Spaltennamen bleiben englisch und exakt wie im Code.
Alles muss aus dem tatsächlich gelesenen Code stammen. Keine Vermutungen. Bei Unsicherheit "unklar" schreiben und Fundstelle nennen.
Fundstellen immer als `pfad/datei.ts:zeile`.

Stand: Repo-Branch `twincast-production-readiness` (v1.4.0). better-auth installiert in Version **1.6.20** (`node_modules/better-auth/package.json`), `package.json:68` pinnt `^1.6.11`. SvelteKit 2.58.0, Svelte 5.56.4.

## 0. Kurzüberblick der Architektur

- **Identität**: better-auth mit `username`-Plugin, ausschließlich Benutzername + Passwort (`src/lib/server/auth.ts:26-68`). Kein Self-Signup (`disableSignUp: true`, Zeile 52), keine E-Mail-Flows, kein OAuth. E-Mail wird als `<username>@twincars.local` synthetisiert (`src/lib/server/auth-users.ts:71`).
- **Session**: DB-Sessions (Tabelle `sessions`), Cookie `tcm.session_token` (+ Cache-Cookie `tcm.session_data`), 7 Tage, `updateAge` 1 Tag, Cookie-Cache 5 Minuten (`auth.ts:62-67`).
- **Request-Pipeline** (`src/hooks.server.ts:231-255`): `ensureSeeded` → `rateLimitSignIn` → `rateLimitPublicApi` → `blockDeactivatedSignIn` → better-auth `svelteKitHandler` → `populateAuthLocals` → `requireAuthHandle`.
- **Autorisierung**: RBAC-Overlay in eigenen Tabellen `roles`, `user_roles`, `role_permissions`; ein Schlüssel pro Modul, Wildcard `*`, einzige Sub-Berechtigung `hours:write_own` (`src/lib/permissions.ts:27-48`). Guards `requireUser` / `requirePermission` / `requireAnyPermission` (`src/lib/server/auth-guards.ts`).
- **Externe Konsumenten**: Bearer-Tokens aus `API_TOKENS` (`src/lib/server/api-tokens.ts`), kein DB-Bezug zu `users`.
- **Client**: `authClient` (better-auth Client + `usernameClient`) nur für Login und Logout (`src/lib/client/auth-client.ts:15-17`); 60-Minuten-Idle-Logout (`src/lib/stores/idle-logout.svelte.ts`, verdrahtet in `src/lib/components/layout/AppShell.svelte:119-133`).

## 1. Routen und Seiten

| Route | Datei | Parameter | Guard / Permission | Layout | Datenabhängigkeiten (Remote-Queries, Reihenfolge) | Zweck |
|---|---|---|---|---|---|---|
| `/login` | `src/routes/login/+page.svelte` | `?redirectTo=<pfad>` (Default `/`, nur same-origin-Pfade, `+page.svelte:64,100-105`), `?reason=idle` (Info-Alert, `:66-71`) | öffentlich (Whitelist `src/hooks.server.ts:61-72`) | Root-Layout rendert ohne `AppShell` (`src/routes/+layout.svelte:24,78-81`) | keine Remote-Query; Client-Aufruf `authClient.signIn.username` (`+page.svelte:86-89`); Root-Layout lädt vorher `getLayoutContext()` und `getCurrentUserRemote()` (`+layout.svelte:20-21`) | Anmeldung |
| `/` (Start) | `src/routes/+page.svelte` (nicht Teil von AUTH) | – | `requireUser()` in `dashboard.remote.ts` | AppShell | – | einziger Nav-Eintrag ohne Permission (`navigation.ts:76`) |
| `/settings/users` | `src/routes/settings/users/+page.svelte` | keine URL-Parameter; Suche `q` und `pageNum` nur im Komponentenstate (`:39-45`). `?tab=roles` wird von den Rollenseiten angesteuert, aber **nicht ausgewertet** (siehe B-059) | Remotes: `requirePermission('users')`; Settings-Tab „Benutzer & Rollen" nur mit `users` sichtbar (`src/routes/settings/+layout.svelte:51-56`) | AppShell + Settings-`TabGroup` (nav-Modus, `settings/+layout.svelte:110-115`) | 1. `await untrack(() => listUsersRemote({page, size: 25, q?}))` (`:47`), 2. `await untrack(() => listRolesRemote())` (`:68`) – sequentiell; danach `$derived.by` Re-Reads + `$effect` für `lastResult`/Fehler (`:53-64, 70-76`) | Benutzerliste + Rollenliste (zwei gestapelte Karten) |
| `/settings/users/new` | `src/routes/settings/users/new/+page.svelte` | – | `requirePermission('users')` (Remotes) | AppShell + Settings-TabGroup (Tab `users` matcht per Prefix, `settings/+layout.svelte:101-107`) | `await untrack(() => listRolesRemote())` (`:17`) | Benutzer anlegen; nach Erfolg `goto('/settings/users', { replaceState: true })` (`:76`) |
| `/settings/users/[id]/edit` | `src/routes/settings/users/[id]/edit/+page.svelte` | `id` (Pfad, `:21`) | `requirePermission('users')` | AppShell + Settings-TabGroup | `Promise.all([getUserRemote({id}), listRolesRemote()])` (`:24-27`); 404 aus `getUserRemote` → `+error.svelte` | Anzeigename/Rollen bearbeiten, Passwort zurücksetzen, Benutzer löschen; Rücksprung `/settings/users` (`:73,107`) |
| `/settings/users/roles/new` | `src/routes/settings/users/roles/new/+page.svelte` | – | `requirePermission('users')` | AppShell + Settings-TabGroup | keine (RoleForm ohne Daten) | Rolle anlegen; Rücksprung `/settings/users?tab=roles` (`:19,26,30`) |
| `/settings/users/roles/[id]/edit` | `src/routes/settings/users/roles/[id]/edit/+page.svelte` | `id` (`:21`) | `requirePermission('users')` | AppShell + Settings-TabGroup | `await listRolesRemote()` → `find(id)`; fehlt → `error(404, 'Rolle nicht gefunden.')` (`:29-31`) | Rolle bearbeiten/löschen; Admin-Rolle `locked` (`:33`) |
| `/settings/account` | `src/routes/settings/account/+page.svelte` | – | Remote: `requireUser()`; Tab „Konto" mit `permission: null` für jeden Angemeldeten sichtbar (`settings/+layout.svelte:87-92`) | AppShell + Settings-TabGroup; bei nur einem sichtbaren Tab werden children ohne TabGroup gerendert (`settings/+layout.svelte:110-118`) | keine Query; Command `changeOwnPasswordRemote` | Eigenes Passwort ändern („Profil") |
| `/setup` (Schritt 7 „Administrator") | `src/routes/setup/+page.svelte:763-833` | Wizard-State | öffentlich (Whitelist); serverseitig „nur solange kein Benutzer existiert" (`setup.remote.ts:210-213`) | Root-Layout ohne AppShell (`+layout.svelte:23,78`) | `createInitialAdmin` (Command) | Erst-Admin anlegen |
| `/api/auth/[...all]` | `src/routes/api/auth/[...all]/+server.ts:10-16` | better-auth-Pfade (`/sign-in/username`, `/sign-out`, `/get-session`, …) | öffentlich (Whitelist `/api/auth`); einzelne Endpunkte mit better-auth-Session-Middleware | – | – | better-auth-Katalog (GET/POST/PUT/PATCH/DELETE/OPTIONS) |
| Root-`+error.svelte` | `src/routes/+error.svelte:22-40` | `page.status` | – | – | – | 403 → „Zugriff nicht erlaubt" / „Sie haben keine Berechtigung, diese Seite aufzurufen."; 401 hat **keinen** eigenen Zweig (fällt auf „Es ist ein Fehler aufgetreten") |

Redirect-Regeln (serverseitig, nur bei Dokument-Requests, nicht bei Remote-Aufrufen unter `/_app/remote/*`, weil `/_app` Whitelist-Präfix ist, `hooks.server.ts:70`):
- nicht angemeldet + nicht-öffentliche Route → `303 /login?redirectTo=<encodeURIComponent(pathname+search)>` (`hooks.server.ts:221-229`).
- `setupCompleted=false` + nicht `/setup` → clientseitiges `goto('/setup')` im Root-Layout (`+layout.svelte:26-30`).
- Legacy `/settings?tab=mail|reminders|smtp` → Redirects (`src/routes/settings/+page.svelte:36-45`); für `?tab=roles` existiert **kein** Mapping.

## 2. Remote Functions und Endpoints

### 2.1 `src/routes/settings/users/users.remote.ts`

Gemeinsame Schemas (`:65-122`):
- `usernameSchema`: `string → trim → minLength(3,'Benutzername zu kurz (mind. 3 Zeichen).') → maxLength(64,'Benutzername zu lang.') → regex(/^[a-zA-Z0-9_.]+$/, 'Benutzername darf nur Buchstaben, Ziffern, Punkt und Unterstrich enthalten.')`.
- `passwordSchema`: `string → minLength(8,'Passwort zu kurz (mind. 8 Zeichen).') → maxLength(128,'Passwort zu lang.')`.
- `permissionSchema`: `string → trim → check(v === '*' || ALL_PERMISSIONS.includes(v), 'Unbekannte Berechtigung.')`.
- `nameSchema` aus `src/lib/server/db/validation.ts:30-35`: `string('Bitte geben Sie einen Namen ein.') → trim → minLength(1,'Der Name darf nicht leer sein.') → maxLength(100,'Der Name darf maximal 100 Zeichen lang sein.')`.
- `idSchema` (`validation.ts:28`): `string → minLength(1) → maxLength(64) → trim` (ohne deutsche Meldungen).

- **listUsersRemote** — query — `users.remote.ts:130-136`
  - Guard: `requirePermission('users')`
  - Argumente: `page: number()` (keine Meldung, kein Minimum), `size: picklist([10,25,50,100])` (Client sendet immer 25), `q?: string → trim → maxLength(200)` (keine deutsche Meldung)
  - Rückgabe: `{ items: [{id, username, name, email, active, roles: [{id,name}], createdAt}], total, page, size, pageCount }`; Sortierung `createdAt DESC` (`user-admin-service.ts:56`)
  - Fehlerfälle: 401 `Bitte melden Sie sich an.` / 403 `Keine Berechtigung für diese Aktion.` (Guards)
  - Nebenwirkungen: keine. Transaktion: nein.
- **getUserRemote** — query — `:144-149`
  - Guard: `requirePermission('users')`; Arg `{ id: idSchema }`
  - Rückgabe: `{id, username, name, email, active, createdAt, roleIds: string[]}`
  - Fehler: 404 `Benutzer nicht gefunden.`
- **createUserRemote** — command — `:163-185`
  - Guard: `requirePermission('users')`
  - Payload: `username: usernameSchema`, `name: nameSchema`, `password: passwordSchema`, `roleIds: array(idSchema)` (Pflicht, darf leer sein)
  - Ablauf: `createUserWithCredential` (Insert `users` + `accounts`), **danach** Rollen-Existenzprüfung; bei fehlender Rolle 400 `Mindestens eine Rolle wurde nicht gefunden.` (Benutzer bleibt angelegt, B-047); `assignRolesToUser`; `requested(listUsersRemote, 4).refreshAll()`
  - Rückgabe: `{ id }`
  - Weitere Fehler: doppelter Benutzername → Unique-Index `users_username_idx`/`users_email_idx` → unkuratierter 500 `Ein interner Fehler ist aufgetreten.` (B-046); Plain-`Error` aus `createUserWithCredential` (`auth-users.ts:57,60-62`) → ebenfalls 500 generisch (nur erreichbar unter Umgehung des Valibot-Schemas)
  - Transaktion: nein.
- **updateUserRemote** — command — `:199-246`
  - Guard: `requirePermission('users')`
  - Payload: `id: idSchema`, `name?: nameSchema`, `password?: passwordSchema`, `roleIds?: array(idSchema)`; nur gelieferte Felder werden geändert
  - Fehler: 404 `Benutzer nicht gefunden.`; 400 `Mindestens eine Rolle wurde nicht gefunden.`; 409 `Dem letzten Administrator kann die Administrator-Rolle nicht entzogen werden.` (nur wenn `roleIds` gesetzt, neuer Satz kein `*` enthält und der Benutzer der einzige Wildcard-Inhaber ist, `:230-239`)
  - Nebenwirkungen: Passwort-Hash via `auth.$context.password.hash` und `setUserCredentialPassword` (legt `credential`-Account an, falls fehlt, `user-admin-service.ts:176-203`); **keine** Session-Revokation des Zielbenutzers (B-049); `getUserRemote({id}).refresh()` + `refreshUserLists()`
  - Transaktion: nein (Name, Passwort, Rollen sind getrennte Statements; `replaceUserRoles` = DELETE + INSERT).
- **deleteUserRemote** — command — `:256-274`
  - Guard: `requirePermission('users')`; Arg `{ id }`
  - Fehler: 404; 409 `Der letzte Administrator kann nicht gelöscht werden.` (wenn der Benutzer `*` hält und `hasOtherWildcardHolder(id)` false; `active` wird dabei ignoriert, B-064)
  - Nebenwirkungen: Hard-Delete `users` → Cascade `sessions`, `accounts`, `user_roles` (Schema-FKs `onDelete: 'cascade'`); `refreshUserLists()`
- **setUserActiveRemote** — command — `:286-309`
  - Guard: `requirePermission('users')`; Payload `{ id: idSchema, active: boolean() }`
  - Fehler: 404; 409 `Der letzte Administrator kann nicht deaktiviert werden.` (nur bei `active=false`)
  - Nebenwirkungen: `updateUserActive`; bei Deaktivierung `deleteUserSessions(id)` (`auth-users.ts:140-142`); Refresh `getUserRemote({id})` + Listen
- **listRolesRemote** — query — `:321-324`
  - Guard: `requirePermission('users')`; keine Args
  - Rückgabe: `[{ id, name, description, permissions: string[] }]`, Sortierung `name ASC`, keine Pagination (Rollen sind wenige)
- **createRoleRemote** — command — `:332-350`
  - Guard: `requirePermission('users')`
  - Payload: `name: nameSchema`, `description?: string → trim → maxLength(500)` (keine Meldung), `permissions: array(permissionSchema)`
  - Fehler: 409 `Eine Rolle mit diesem Namen existiert bereits.` (Vorab-Check `getRoleIdByName`, exakter Vergleich, case-sensitiv); 500 `Rolle konnte nicht angelegt werden.` (Insert liefert keine Zeile)
  - Nebenwirkungen: `listRolesRemote().refresh()`; Rückgabe `{ id }`; Transaktion: nein (Rolle, dann Permissions)
- **updateRoleRemote** — command — `:359-403`
  - Guard: `requirePermission('users')`
  - Payload: `id`, `name?`, `description?`, `permissions?` (wenn gesetzt: kompletter Ersatz)
  - Fehler: 404 `Rolle nicht gefunden.`; für Rolle „Administrator": 409 `Die Administrator-Rolle kann nicht umbenannt werden.` (bei `name !== 'Administrator'`), 409 `Der Administrator-Rolle kann der Vollzugriff (*) nicht entzogen werden.` (wenn `permissions` ohne `*`); 409 `Eine Rolle mit diesem Namen existiert bereits.` bei Namenskollision mit anderer Rolle
  - Nebenwirkungen: `updateRoleFields`, `replaceRolePermissions` (DELETE + INSERT), `listRolesRemote().refresh()`; Transaktion: nein
  - Hinweis: Die Beschreibung der Admin-Rolle darf geändert werden (kein Guard dafür).
- **deleteRoleRemote** — command — `:413-427`
  - Guard: `requirePermission('users')`
  - Fehler: 404; 409 `Die Administrator-Rolle kann nicht gelöscht werden.` (Namensvergleich `ADMIN_ROLE_NAME`)
  - Nebenwirkungen: Hard-Delete → Cascade `user_roles`, `role_permissions`; Refresh Rollen + Benutzerlisten

### 2.2 `src/routes/settings/account/account.remote.ts`

- **changeOwnPasswordRemote** — command — `:68-99`
  - Guard: `requireUser()` (bewusst keine Modul-Permission, `:15-17`)
  - Payload (`:23-47`): `currentPassword: string('Bitte das aktuelle Passwort eingeben.') → minLength(1, dieselbe Meldung) → maxLength(256,'Eingabe zu lang.')`; `newPassword`, `newPasswordConfirm`: `string('Bitte ein Passwort eingeben.') → minLength(8,'Passwort zu kurz (mind. 8 Zeichen).') → maxLength(128,'Passwort zu lang.')`; Objekt-Checks `newPassword === newPasswordConfirm` (`Die neuen Passwörter stimmen nicht überein.`), `newPassword !== currentPassword` (`Das neue Passwort muss sich vom aktuellen unterscheiden.`)
  - Ablauf: `credential`-Account laden; 400 `Für dieses Konto ist kein Passwort hinterlegt.`; `ctx.password.verify` → 400 `Das aktuelle Passwort ist nicht korrekt.`; neuen Hash schreiben (`accounts.password`, `updatedAt`)
  - Rückgabe: void. Nebenwirkungen: keine Session-Revokation (B-050). Transaktion: nein.

### 2.3 `src/routes/layout.remote.ts`

- **getLayoutContext** — query — `:18-24` — kein Guard (öffentlich) — `{ setupCompleted, companyName }`.
- **getCurrentUserRemote** — query — `:37-47` — kein Guard (dokumentierte Ausnahme) — `null` anonym, sonst `{ id, username: string|null, name, permissions: string[] }` aus `event.locals`.

### 2.4 `src/routes/setup/setup.remote.ts` (nur Auth-Anteil)

- **createInitialAdmin** — command — `:207-234`
  - Guard: keiner. Schutz: 409 `Es existiert bereits ein Benutzerkonto.` sobald `users` eine Zeile hat (`:210-213`); **nicht** über `refuseAfterSetup()` (`:276-284`) abgesichert – faktisch aber gleichwertig, weil `completeSetup` einen Benutzer voraussetzt (`:332-335`).
  - Payload (`adminSchema`, `:174-196`): `username` (trim, 3..64, Regex wie oben, gleiche deutsche Meldungen), `name` (trim, `minLength(1,'Anzeigename darf nicht leer sein.')`, `maxLength(200,'Anzeigename zu lang.')` – **200**, während `nameSchema` der Benutzerverwaltung 100 erlaubt), `password` (8..128)
  - Ablauf: `createUserWithCredential`, Rolle `Administrator` per Name suchen (500 `Standard-Rolle „Administrator" fehlt.`), `user_roles` mit `onConflictDoNothing`
  - Transaktion: nein.

### 2.5 HTTP-Endpunkte

- **`/api/auth/*`** — GET/POST/PUT/PATCH/DELETE/OPTIONS — `src/routes/api/auth/[...all]/+server.ts:10-16` → `auth.handler(request)`. Damit sind **alle** better-auth-Core- und Plugin-Endpunkte erreichbar (Liste aus `node_modules/better-auth/dist/api/routes/*.mjs` und `plugins/username/index.mjs`):
  - genutzt von der App: `POST /sign-in/username` (Login), `POST /sign-out` (Logout, Idle-Logout), `GET /get-session` (indirekt via `auth.api.getSession` in `populateAuthLocals`).
  - erreichbar, aber ungenutzt: `POST /update-user` (Session-Middleware; Body `name`, `image` und – über den Plugin-Hook – `username`/`displayUsername`, `plugins/username/index.mjs:250-276`) → B-051; `POST /change-password` (Session; hat `revokeOtherSessions`-Option); `POST /is-username-available` (**ohne Session**, `plugins/username/index.mjs:225-244`) → B-052; `GET /list-sessions`, `POST /revoke-session`, `/revoke-sessions`, `/revoke-other-sessions`; `POST /sign-up/email` (durch `disableSignUp: true` gesperrt); `/request-password-reset`, `/reset-password` (kein `sendResetPassword` konfiguriert → kein Mailversand; Verhalten „unklar", nicht getestet); `/change-email`, `/delete-user` (better-auth-Default deaktiviert, in `auth.ts` nicht aktiviert); `/verify-password`, `/list-accounts`, `/account-info`, `/update-session`, `/ok`, `/error`.
  - Sign-in-spezifische Hooks davor: Rate-Limit 10 POST/min/IP → `429 {message:'Zu viele Anmeldeversuche, bitte warten Sie eine Minute.'}` + `Retry-After` (`hooks.server.ts:111-132`); deaktiviertes Konto → `403 {message:'Dieses Konto ist deaktiviert. Bitte wenden Sie sich an die Administration.'}` (`:178-202`; Body wird per `request.clone().json()` gelesen, Feld `username`).
- **`/api/public/*`, `/api/ebay/account-deletion`** — Bearer-Token-Auth über `authenticateRequest` (`src/lib/server/api-tokens.ts:101-113`, Header-Regex `^Bearer\s+([A-Za-z0-9._\-=:+/]+)$`, case-insensitiv); Rate-Limit 120/min + 60 Burst je `token:<8 Zeichen-Präfix>` bzw. `ip:<ip>` (`hooks.server.ts:141-167`). Die Endpunkte selbst gehören zum Public-API-Modul.

### 2.6 Cross-Module: alle `requireAnyPermission`-Kombinationen im Repo

| Kombination | Fundstelle | Zweck |
|---|---|---|
| `('customers', 'orders')` | `src/routes/customers/customers.remote.ts:197` | Kundendetail für Auftrags-Bearbeiter |
| `('vehicles', 'orders')` | `src/routes/vehicles/vehicles.remote.ts:273` | Fahrzeugdetail für Auftrags-Bearbeiter |
| `('employees', 'orders')` | `src/routes/pickers.remote.ts:314` | `pickEmployeesRemote` (Zuweisung) |
| `('items', 'orders')` | `src/routes/pickers.remote.ts:367` | `pickItemsRemote` (Katalogpositionen) |
| `('invoices', 'offers')` | `src/routes/pickers.remote.ts:572` | Dokument-Picker |
| `('invoices', 'offers')` | `src/routes/pdfs.remote.ts:28`, `:54` | PDF-Meta/Bytes für Angebote/Rechnungen |
| `('invoices', 'offers', 'reminders')` | `src/routes/sent/sent.remote.ts:35`, `:90` | Gesendet-Liste |
| `('hours', 'hours:write_own')` | `src/routes/hours/hours.remote.ts:151, 197, 220, 252, 288` | Stunden: Liste/Detail/Create/Update/Delete; bei nur `hours:write_own` Scoping auf eigenen Mitarbeiter (`callerCanReadAll()` `:88-91`, `resolveCurrentEmployeeId()` `:69-81` über `employees.privateEmail = users.email`) |

Nur-`requireUser()`-Remotes (ohne Modul-Permission): `src/routes/dashboard.remote.ts`, `src/routes/search.remote.ts`, `src/routes/settings/account/account.remote.ts`, Teile von `src/routes/hours/hours.remote.ts` (grep-Ergebnis; Inhalte der ersten beiden nicht Teil dieses Inventars).

Guard-Audit (Zählung `query|command` vs. Guard-Aufrufe pro `*.remote.ts`): einzige Dateien ohne 1:1-Abdeckung sind `layout.remote.ts` (2 Remotes, 0 Guards – dokumentierte Ausnahme) und `setup.remote.ts` (7 Remotes, 0 Guards – Pre-Login-Wizard; 6 davon über `refuseAfterSetup`, `createInitialAdmin` über „kein Benutzer vorhanden").

## 3. Services (Server-Layer)

### 3.1 `src/lib/permissions.ts` (client- und serverseitig)
- `WILDCARD_PERMISSION = '*'` (`:7`).
- `hasPermission(permissions: Set<string>, required: string): boolean` (`:9-14`) — `*` oder exakter Schlüssel. Keine Präfix-Logik (`hours` impliziert **nicht** `hours:write_own` und umgekehrt).
- `MODULE_PERMISSIONS` (`:27-48`): `customers`, `vehicles`, `suppliers`, `employees`, `items`, `offers`, `invoices`, `orders`, `reminders`, `ledger`, `calendar`, `inventory`, `hours` → `['hours','hours:write_own']`, `mailings`, `import`, `settings`, `users`, `tires`, `posts`. UI-Labels dazu in `RoleForm.svelte:101-121` (Kunden, Fahrzeuge, Lieferanten, Mitarbeiter, Leistungen / Artikel, Angebote, Rechnungen, Aufträge, Offene Rechnungen, Kassenbuch, Kalender, Lager, Stunden, Serienbriefe, Import, Einstellungen, Benutzer & Rollen, Reifenlager, Aktuelle Informationen); Checkbox-Label `Zugriff`, für hours `Alle Stunden` / `Nur eigene Stunden` (`:128-137`). Eine Beschreibung je Modul existiert im Code **nicht** (nur das Label).
- `ALL_PERMISSIONS` (`:52-53`): flache Liste (20 Schlüssel), ohne `*`.

### 3.2 `src/lib/server/auth.ts`
- `auth = betterAuth({...})` (`:26-68`):
  - `database: drizzleAdapter(db, { provider:'pg', schema: { user: schema.users, session: schema.sessions, account: schema.accounts, verification: schema.verifications }, usePlural: false })` (`:27-36`).
  - `secret: env.APP_SECRET ?? 'dev-only-fallback-secret-do-not-use-prod'` (`:37`) – kein Hard-Fail in Produktion (B-071).
  - `baseURL: env.BETTER_AUTH_URL ?? env.ORIGIN ?? 'http://localhost:5173'` (`:46`); `trustedOrigins: env.ORIGIN ? [env.ORIGIN] : undefined` (`:47`).
  - `emailAndPassword: { enabled: true, autoSignIn: false, disableSignUp: true, minPasswordLength: 8, maxPasswordLength: 128 }` (`:48-55`).
  - `emailVerification: { sendOnSignUp: false, autoSignInAfterVerification: false }` (`:57-60`).
  - `plugins: [username({ minUsernameLength: 3, maxUsernameLength: 64 })]` (`:61`); Plugin-Default-Validator `/^[a-zA-Z0-9_.]+$/`, Normalizer `toLowerCase()` (`plugins/username/index.mjs:12-13, 23-26`).
  - `session: { expiresIn: 604800 (7 d), updateAge: 86400 (1 d), cookieCache: { enabled: true, maxAge: 300 } }` (`:62-66`).
  - `advanced: { cookiePrefix: 'tcm' }` (`:67`) → Cookie-Namen `tcm.session_token` (maxAge = expiresIn), `tcm.session_data` (maxAge 300), `tcm.dont_remember`, `tcm.account_data`; Attribute (better-auth-Default, `node_modules/better-auth/dist/cookies/index.mjs:19-43`): `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure` + Präfix `__Secure-` nur wenn `baseURL` mit `https://` beginnt (sonst `isProduction`). Kein `domain` (kein crossSubDomainCookies).
  - Passwort-Hashing: better-auth-Default = **scrypt** (kein bcrypt); Format `<saltHex(32)>:<keyHex(128)>` (bestätigt durch `src/lib/server/auth-users.test.ts:85-90`). Parameter (N/r/p) sind im Repo nicht sichtbar → „unklar" (Library-Default).
  - Kein eigenes better-auth-`rateLimit` konfiguriert (App-eigenes Limit in Hooks).
- Typen `AuthInstance`, `AuthSession` (`:70-71`); `App.Locals` in `src/app.d.ts:9-17` (`session`, `user`, `permissions: Set<string>`).

### 3.3 `src/lib/server/auth-users.ts`
- `normaliseUsername(input): string` (`:27-29`) — `trim().toLowerCase()`.
- `createUserWithCredential({ username, name, password }): Promise<{ id }>` (`:50-99`) — Länge 3..64 (`throw Error('Benutzername muss zwischen 3 und 64 Zeichen lang sein.')`), Pattern (`Error('Benutzername darf nur Buchstaben, Ziffern, Punkt und Unterstrich enthalten.')`), `displayUsername = input.username.trim()`, Hash über `auth.$context.password.hash`, Insert `users` (`id = randomUUID()`, `email = <username>@twincars.local`, `emailVerified=false`), Insert `accounts` (`providerId='credential'`, `accountId=userId`). Zwei Inserts **ohne Transaktion**; Duplikate → DB-Fehler (kein Vorab-Check).
- `isUserActive(userId): Promise<boolean>` (`:107-114`) — fail-closed für unbekannte IDs.
- `isUsernameDeactivated(username): Promise<boolean>` (`:124-133`) — normalisiert, `false` für unbekannt.
- `deleteUserSessions(userId)` (`:140-142`).

### 3.4 `src/lib/server/auth-guards.ts`
- `requireUser(): LocalsUser` (`:23-29`) → `error(401, 'Bitte melden Sie sich an.')`.
- `requirePermission(permission): LocalsUser` (`:36-43`) → `error(403, 'Keine Berechtigung für diese Aktion.')`.
- `requireAnyPermission(...permissions): LocalsUser` (`:50-60`) → 403 wie oben. Alle über `getRequestEvent()`.

### 3.5 `src/lib/server/auth-permissions.ts`
- Re-Exports aus `$lib/permissions` (`:5-11`).
- `loadUserPermissions(userId): Promise<Set<string>>` (`:17-35`) — 2 Queries (`user_roles` → `role_permissions IN roleIds`); leeres Set für unbekannte Nutzer. Wird **pro Request** aufgerufen (`hooks.server.ts:212`).

### 3.6 `src/lib/server/api-tokens.ts`
- `readEnv` (`:12-14`, `process.env` vor `$env/dynamic/private`), `configuredTokens()` (`:47-54`, Split an `,`/`\n`/`\r`/`;`, Einträge < 8 Zeichen verworfen, bei jedem Aufruf neu gelesen), `safeEqual` (`:62-67`, `timingSafeEqual` nach Längencheck), `verifyApiToken(candidate)` (`:75-85`, Schleife über alle Tokens ohne Early-Exit), `authenticateRequest(request): Promise<{ tokenPrefix } | null>` (`:101-113`).

### 3.7 `src/lib/server/rate-limit.ts`
- `rateLimit(key, { perMinute, burst? }): { allowed, retryAfter? }` (`:98-118`) — Fixed Window 60 s, In-Memory `Map`, abgelehnte Aufrufe zählen nicht; Sweep alle 5 min (`:50-69`, `unref`). `resetRateLimit()` (`:124-126`), `_rateLimitCountForTests` (`:132-137`). Nur für eine Replika geeignet (`:16-25`).

### 3.8 `src/lib/server/services/user-admin-service.ts` (reine Drizzle-Aufrufe)
| Funktion | Zeilen | DB | Anmerkung |
|---|---|---|---|
| `listUsersWithRoles({page,size,q?})` | 26-95 | `users` (ILIKE `%q%` auf `username`,`name`,`email`), `count(*)`, dann `user_roles ⋈ roles IN userIds` | 3 Queries; ILIKE ohne Index (irrelevant bei wenigen Nutzern) |
| `getUserWithRoleIds(id)` | 98-119 | `users`, `user_roles` | 2 Queries |
| `userExists(id)` | 122-129 | `users` | |
| `allRoleIdsExist(roleIds)` | 132-139 | `roles IN` | Zählvergleich; Duplikate in `roleIds` würden fälschlich als „fehlend" gelten (Client-MultiSelect liefert keine Duplikate) |
| `assignRolesToUser(userId, roleIds)` | 142-151 | `user_roles` Insert `onConflictDoNothing` | |
| `replaceUserRoles(userId, roleIds)` | 154-160 | DELETE + INSERT | keine Transaktion |
| `updateUserName(id, name)` | 163-168 | `users` | setzt `updatedAt` |
| `setUserCredentialPassword(userId, hash)` | 176-203 | `accounts` (Update oder Insert `credential`) | |
| `updateUserActive(id, active)` | 206-214 | `users` | |
| `deleteUserById(id)` | 217-219 | `users` (Cascade) | |
| `rolesGrantWildcard(roleIds)` | 229-236 | `role_permissions IN` | |
| `listWildcardHolderIds()` | 242-249 | `user_roles ⋈ role_permissions` (`permission='*'`) | ignoriert `users.active` (B-064) |
| `hasOtherWildcardHolder(excludeUserId)` | 256-270 | dito, `ne(userId)` | ignoriert `users.active` |
| `listRolesWithPermissions()` | 277-307 | `roles` + `role_permissions IN` | 2 Queries |
| `getRoleById(id)` | 310-319 | `roles` | |
| `getRoleIdByName(name)` | 326-333 | `roles` (exakt, case-sensitiv) | |
| `createRoleWithPermissions({name,description?,permissions})` | 340-360 | INSERT `roles` RETURNING, INSERT `role_permissions` (dedupliziert) | keine Transaktion |
| `updateRoleFields(id, {name?,description?})` | 363-371 | `roles` | setzt `updatedAt` **nicht** |
| `replaceRolePermissions(roleId, permissions)` | 374-388 | DELETE + INSERT | keine Transaktion |
| `deleteRoleById(id)` | 391-393 | `roles` (Cascade) | |

### 3.9 `src/lib/server/db/seed-defaults.ts` (Rollen-Anteil)
- `seedDefaults()` (`:197-236`) ruft `seedDefaultRoles()` (`:328-357`): `ensureRole('Administrator','Voller Zugriff auf alle Module.',['*'])`; `ensureRole('Werkstattleiter','Vollzugriff auf alle Module außer Einstellungen / Benutzer.', flatMap aller MODULE_PERMISSIONS außer settings/users)` (enthält damit `hours` **und** `hours:write_own`); `ensureRole('Mitarbeiter','Operativer Zugriff auf die wichtigsten Module; Stunden nur für sich selbst.', ['customers','vehicles','suppliers','items','offers','invoices','orders','reminders','calendar','inventory','tires','hours:write_own'])`.
- `ensureRole` (`:359-376`): Rolle per Name suchen/anlegen; Permissions per `onConflictDoNothing` **hinzufügen** (nie entfernen → operator-seitig entfernte Seeds kommen beim nächsten Start zurück, entfernte Module bleiben als tote Keys stehen). Läuft beim ersten Request jedes Prozessstarts (`hooks.server.ts:41-53`).

### 3.10 Hooks (`src/hooks.server.ts`)
- `resolveClientIp(event)` (`:88-99`) — erstes `x-forwarded-for`-Element, sonst `getClientAddress()`, sonst `'unknown'`.
- `rateLimitSignIn` (`:111-132`) — nur `POST` + Pfad-Präfix `/api/auth/sign-in`; Bucket `signin:<ip>`; 10/min.
- `rateLimitPublicApi` (`:141-167`).
- `blockDeactivatedSignIn` (`:178-202`).
- `populateAuthLocals` (`:204-219`) — `auth.api.getSession({ headers })`; nur wenn `isUserActive` → Locals + `loadUserPermissions`; sonst alles `null`/leer. Damit pro authentifiziertem Request mindestens 3 zusätzliche Queries (`isUserActive` + 2×`loadUserPermissions`) plus better-auth-Session-Lookup, sofern der 5-min-Cookie-Cache nicht greift.
- `requireAuthHandle` (`:221-229`).
- `handleValidationError` (`:423-446`) — nur erste Issue; Feldlabel via `FIELD_LABELS` (`:264-375`; Auth-relevante Einträge: `name`, `email`, `username`, `password`, `description`, `q`, `page`, `size`, `status`; **fehlend**: `roleIds`, `permissions`, `currentPassword`, `newPassword`, `newPasswordConfirm`, `active`, `id` → B-077).
- `handleError` (`:459-470`) — 5xx → `Ein interner Fehler ist aufgetreten.`

## 4. Komponenten (modul-lokal)

| Komponente | Datei | Zweck | Props (Name: Typ, default) | Events/Callbacks | Snippets/Slots | Interner State | Verwendete Shared-Komponenten |
|---|---|---|---|---|---|---|---|
| Login-Seite | `src/routes/login/+page.svelte` | Anmeldeformular | – (Route) | `onsubmit=handleSubmit` | – | `username`, `password`, `errorMessage`, `gradient` (zufällig in `onMount`, `:27-38`), `fv` (`useFormValidation`, `:58`) | `FormField`, `validationClasses`, `busy`, `pageTitle` |
| Benutzer & Rollen (Liste) | `src/routes/settings/users/+page.svelte` | zwei Karten (Benutzer, Rollen), Tabelle ≥`lg`, Kartenliste darunter | – | Row-Click `goto(...edit)`; Aktionsspalten mit `stopPropagation` (`:267,459`) | – | `pageNum`, `q`, `lastUsersResult`, `lastRoles`, `confirmOpen`, `confirmKind`, `toDeleteId`, `toDeleteLabel` | `PageHeader` (title „Benutzer & Rollen", back `/settings`, primaryAction „Neuer Benutzer"), `Toolbar` (Placeholder „Benutzer suchen: Benutzername, Name ...", `onQuery` → `pageNum=1`), `Pagination`, `EmptyState`, `ConfirmDialog`, Lucide-Icons |
| Benutzer anlegen | `src/routes/settings/users/new/+page.svelte` | Formular Konto + Rollen | – | `onsubmit=submit`, `oninput/onchange=markDirty` | – | `username`, `name`, `password`, `passwordConfirm`, `roleIds`, `errorMsg` | `PageHeader`, `MultiSelect` (Options aus Rollen, Sublabel = Beschreibung, `emptyHint` „Noch keine Rollen vorhanden. Legen Sie zuerst eine Rolle an."), `busy`, `formDirty` |
| Benutzer bearbeiten | `src/routes/settings/users/[id]/edit/+page.svelte` | zwei Formulare (Stammdaten, Passwort-Reset) + Löschen | – | `submit`, `submitPasswordReset`, `performDelete` | – | `name`, `roleIds`, `resetPassword`, `resetPasswordConfirm`, `resetError`, `errorMsg`, `confirmOpen` | `PageHeader`, `MultiSelect`, `ConfirmDialog`, `busy`, `formDirty` |
| `RoleForm` | `src/routes/settings/users/roles/RoleForm.svelte` | Rollen-Editor mit Berechtigungsmatrix | `initial?: { name?, description?, permissions? }` (`{}`), `locked?: boolean` (`false`), `onSave: (values: RoleFormValues) => Promise<void>|void` (Pflicht), `onCancel?`, `onDelete?` | `onSave`, `onCancel`, `onDelete` | – | `name`, `description`, `wildcard`, `selected: Set<string>`, `errorMsg`, `fv` (Schema `name minLength(2, 'Bitte einen Rollennamen mit mindestens 2 Zeichen angeben.')`, `:8-14`) | `FormField`, `validationClasses`, `busy`, `formDirty` |
| Rolle neu | `src/routes/settings/users/roles/new/+page.svelte` | Host für RoleForm | – | `handleSave` | – | – | `PageHeader`, `RoleForm` |
| Rolle bearbeiten | `src/routes/settings/users/roles/[id]/edit/+page.svelte` | Host für RoleForm + Delete | – | `handleSave`, `performDelete` | – | `confirmOpen` | `PageHeader`, `RoleForm`, `ConfirmDialog` |
| Konto / Profil | `src/routes/settings/account/+page.svelte` | Passwort ändern | – | `submit` | – | `currentPassword`, `newPassword`, `newPasswordConfirm`, `errorMsg`, `fv` (Client-Schema `:20-41`, Meldungen `Bitte aktuelles Passwort eingeben.`, `Neues Passwort zu kurz (mind. 8 Zeichen).`, `Neues Passwort zu lang.`, `Pflichtfeld.`, `Die neuen Passwörter stimmen nicht überein.`, `Das neue Passwort muss sich vom aktuellen unterscheiden.`) | `PageHeader` (title „Profil"), `FormField`, `busy`, `formDirty` |
| `EditUserHost`, `NewUserHost` | `.../[id]/edit/EditUserHost.svelte`, `.../new/NewUserHost.svelte` | reine Test-Hosts (`<svelte:boundary>` mit `pending`-Snippet `data-testid="page-pending"`), nicht in Produktion importiert | – | – | `pending` | – | – |
| AppShell (Auth-Anteile) | `src/lib/components/layout/AppShell.svelte` | Benutzermenü, Logout, Idle-Logout, Nav-Filter | `currentUser?: {id, username, name, permissions[]} \| null` (`null`), `companyName?` | `handleLogout` (`:99-111`) | `children` | `permissionSet`, `visibleNavigation` (`:94-97`) | `ConfirmDialog` (Unsaved), `GlobalSearch`, `Loader`; `data-testid="user-menu"` (`:453`), Menüpunkte „Profil" → `/settings/account`, „Abmelden" (`:478-489`), Titelzeile „Angemeldet als {username ?? name}" |
| Idle-Logout-Store | `src/lib/stores/idle-logout.svelte.ts` | Timer-Helper | `startIdleLogout({ timeoutMs, onLogout, events? })` → Cleanup-Fn (`:50-89`) | `onLogout` | – | `timer`, `firing` (einmalig) | – |
| Settings-Layout | `src/routes/settings/+layout.svelte` | permission-gefilterte Tab-Leiste | – | – | `content` | `visibleTabs`, `hasActiveTab` | `TabGroup` (nav-Modus, `name="settings_nav_tabs"`) |

## 5. Tabellen

Alle Definitionen in `src/lib/server/db/schema.ts`; Erst-Migration `drizzle/0010_auth_better_auth_and_rbac.sql`, `active`-Spalte in `drizzle/0027_user_active_flag.sql`.

**`users`** (`schema.ts:1788-1816`)
| Spalte | Typ | Constraints / Default |
|---|---|---|
| `id` | `text` | PK; App setzt `randomUUID()` |
| `name` | `text` | NOT NULL (Anzeigename) |
| `email` | `text` | NOT NULL; Unique-Index `users_email_idx`; synthetisiert `<username>@twincars.local` |
| `email_verified` | `boolean` | NOT NULL DEFAULT false (ungenutzt) |
| `image` | `text` | NULL (ungenutzt) |
| `username` | `text` | NULL-fähig; Unique-Index `users_username_idx`; Login-Handle, lowercase |
| `display_username` | `text` | NULL-fähig; Original-Schreibweise (wird nirgends angezeigt) |
| `active` | `boolean` | NOT NULL DEFAULT true (0027) |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT now() |

**`sessions`** (`:1818-1840`): `id text PK`, `user_id text NOT NULL FK users(id) ON DELETE CASCADE`, `token text NOT NULL` (Unique `sessions_token_idx`), `expires_at timestamptz NOT NULL`, `ip_address text`, `user_agent text`, `created_at`, `updated_at`; Index `sessions_user_id_idx`.

**`accounts`** (`:1842-1871`): `id text PK`, `user_id text NOT NULL FK CASCADE`, `account_id text NOT NULL` (= user_id bei credential), `provider_id text NOT NULL` (`'credential'`), `access_token`, `refresh_token`, `id_token` (`text`, ungenutzt), `access_token_expires_at`, `refresh_token_expires_at` (`timestamptz`, ungenutzt), `scope text`, `password text` (scrypt-Hash; Kommentar `:1861` sagt fälschlich „bcrypt"), `created_at`, `updated_at`; Index `accounts_user_id_idx`.

**`verifications`** (`:1873-1888`): `id text PK`, `identifier text NOT NULL`, `value text NOT NULL`, `expires_at timestamptz NOT NULL`, `created_at`, `updated_at`; Index `verifications_identifier_idx`. **Fachlich ungenutzt** (keine E-Mail-Flows), nur vom Adapter gefordert.

**`roles`** (`:1894-1908`): `id uuid PK DEFAULT gen_random_uuid()`, `name varchar(100) NOT NULL` (Unique `roles_name_idx`), `description text`, `created_at`, `updated_at`.

**`user_roles`** (`:1911-1922`): `user_id text FK users CASCADE`, `role_id uuid FK roles CASCADE`, PK `(user_id, role_id)`.

**`role_permissions`** (`:1931-1940`): `role_id uuid FK roles CASCADE`, `permission varchar(100) NOT NULL`, PK `(role_id, permission)`. Werte: Modul-Keys, `hours:write_own`, `*`. Kein CHECK auf gültige Keys (Validierung nur im Remote).

Berührte Fremdtabellen: `employees.private_email` (Bridge für `hours:write_own`, `hours.remote.ts:69-81`), `company_settings.setup_completed` (Setup-Gate).

## 6. Flows (durchgängig, Start bis Ende)

- **Anmeldung** — Einstieg `/login` (auch via 303-Redirect mit `redirectTo`) → Client-Validierung bei Klick (`fv.markAllTouched`, `login/+page.svelte:76-83`) → `authClient.signIn.username({ username: trim, password })` → POST `/api/auth/sign-in/username` (Hooks: Rate-Limit, Deaktiviert-Check, better-auth) → bei Erfolg **Full-Document-Load** `window.location.href = target` (Ziel = `redirectTo`, wenn es mit `/` und nicht `//` beginnt, sonst `/`) → Ende: Zielseite in AppShell; kein Toast.
  - Leerzustand: leeres Formular, Hinweis „Bitte melden Sie sich mit Ihrem Benutzernamen und Passwort an."
  - Ladezustand: Button `disabled={busy.active}` + Spinner (`:185-194`).
  - Validierungsfehler (Client, `:44-56`): Benutzername `Bitte einen Benutzernamen eingeben.` / `Benutzername zu kurz (mind. 3 Zeichen).` / `Benutzername zu lang.`; Passwort `Bitte ein Passwort eingeben.` / `Passwort zu kurz (mind. 8 Zeichen).` / `Passwort zu lang.`; erste Meldung zusätzlich im `role="alert"`-Block, Feldfehler nach `touched`.
  - Fehlerzustand (Server, `sign-in-error.ts:17-34`): 429 → Server-Body oder `Zu viele Anmeldeversuche, bitte warten Sie eine Minute.`; 401/403 → `Benutzername oder Passwort ist falsch.`, außer Body enthält `deaktiviert` → Body (`Dieses Konto ist deaktiviert. Bitte wenden Sie sich an die Administration.`); sonst `Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.`; Netzwerk-Exception → Toast `Anmeldung fehlgeschlagen.: …` via `handleClientError`.
  - Abbruchpfade: keine (kein Passwort-vergessen-Link).
  - Berechtigungs-Verweigerung: n/a.
  - Bestätigungsdialoge: keine.
- **Abmeldung** — Benutzermenü (Sidebar unten, `data-testid="user-menu"`) → „Abmelden" → `busy.run(authClient.signOut())` → POST `/api/auth/sign-out` (Session-Zeile gelöscht, Cookies geleert) → `window.location.href = '/login'` (`AppShell.svelte:99-111`). Fehler → Toast `Abmeldung fehlgeschlagen.: …`. Kein Bestätigungsdialog. Dirty-Formular: `beforeunload`-Prompt des Browsers kann erscheinen (`AppShell.svelte:62-74`).
- **Idle-Logout** — nach 60 min ohne `mousemove|keydown|click|scroll|touchstart` (`idle-logout.svelte.ts:42-48`, `AppShell.svelte:25`) → `authClient.signOut()` (Fehler verschluckt) → `window.location.href='/login?reason=idle'` → Login zeigt Info-Alert `Sie wurden wegen einer Stunde Inaktivität automatisch abgemeldet. Bitte melden Sie sich erneut an.` Timer nur bei `currentUser` aktiv; pro Tab (B-080).
- **Zugriff ohne Session (Dokument-Request)** — `requireAuthHandle` → 303 `/login?redirectTo=…` → nach Login Rücksprung.
- **Zugriff ohne Session (Remote-Aufruf in laufender SPA)** — Guard wirft 401 `Bitte melden Sie sich an.` → Seiten-Query: `+error.svelte` (Headline generisch, Detail „Bitte melden Sie sich an."); Mutation/Effect: Toast über `handleClientError`. **Keine automatische Weiterleitung** (B-057).
- **Zugriff ohne Berechtigung** — Sidebar/Tabs blenden aus (`filterNavigationByPermissions`, `settings/+layout.svelte:94`); Direktaufruf → Guard 403 → `+error.svelte`: „Fehler 403 / Zugriff nicht erlaubt / Sie haben keine Berechtigung, diese Seite aufzurufen." + Detail `Keine Berechtigung für diese Aktion.` + Buttons „Zurück"/„Zum Dashboard" (e2e `users.spec.ts:92-97`).
- **Deaktiviertes Konto meldet sich an** — POST wird vor better-auth mit 403 + kuratierter Meldung beantwortet (`hooks.server.ts:178-202`); bestehende Sessions wurden bei Deaktivierung gelöscht; im Cookie-Cache-Fenster greift zusätzlich `isUserActive` pro Request → Locals leer → Redirect auf `/login`.
- **Brute-Force** — ab dem 11. Sign-in-POST pro IP und Minute 429 mit `Retry-After`; Formular zeigt Server-Meldung.
- **Erst-Admin im Setup** — `/setup` Schritt 7 (`setup/+page.svelte:763-833`): Felder Benutzername*, Name*, Passwort*, Passwort wiederholen*; Client-Meldungen `Bitte Benutzernamen (mind. 3 Zeichen) für den Admin angeben.`, `Benutzername darf nur Buchstaben, Ziffern, Punkt und Unterstrich enthalten (keine Leerzeichen).`, `Bitte den Namen des Administrators angeben.`, `Admin-Passwort muss mindestens 8 Zeichen lang sein.`, `Die beiden Passwort-Eingaben stimmen nicht überein.` (`:190-200`) → `createInitialAdmin` (`:275-283`) → Bestätigungskarte „Administrator-Konto „<username lowercase>" wurde …" und Hinweis „Benutzername wird beim Anmelden klein geschrieben behandelt." (`:821-832`); Felder danach `disabled`; Weiter-Button erst nach `adminCreated` (`:1136`).
- **Benutzer anlegen** — `/settings/users` → Header-Primary „Neuer Benutzer" → `/settings/users/new` → Klick „Speichern": Client-Reihenfolge `Benutzername zu kurz (mind. 3 Zeichen).` → `Bitte einen Anzeigenamen angeben.` → `Passwort zu kurz (mind. 8 Zeichen).` → `Passwörter stimmen nicht überein.` (jeweils nur erste Meldung im `alert`, keine Feldfehler, `new/+page.svelte:43-63`) → `createUserRemote(...).updates(listUsersRemote({page:1,size:25}))` → Toast `Benutzer angelegt.` → `goto('/settings/users', {replaceState:true})`.
  - Leerzustand Rollen: MultiSelect-Hinweis „Noch keine Rollen vorhanden. Legen Sie zuerst eine Rolle an."
  - Fehlerzustand: Toast `Benutzer konnte nicht angelegt werden: <Server-Meldung>`; bei Duplikat generisch (B-046).
  - Abbruch: „Abbrechen" → `goto('/settings/users')`; Unsaved-Guard-Dialog „Ungespeicherte Änderungen / Es gibt ungespeicherte Änderungen. Sollen sie verworfen werden?" (Verwerfen/Bleiben) bei Dirty.
- **Benutzer bearbeiten (Name/Rollen)** — Zeile oder Stift-Icon → `/settings/users/[id]/edit` → Benutzername read-only mit Hinweis „Der Benutzername kann nicht geändert werden." → Speichern: Client `Bitte einen Anzeigenamen angeben.` → `updateUserRemote({id, name, roleIds})` → `formDirty.clear()` → Toast `Benutzer gespeichert.` → `goto('/settings/users')`. Fehler: Toast `Benutzer konnte nicht gespeichert werden: …` (z. B. 409 letzter Admin).
- **Passwort-Reset durch Admin** — zweites Formular auf der Edit-Seite („Passwort zurücksetzen", Hinweis „…Der Benutzer wird darüber nicht automatisch informiert."): Client `Passwort zu kurz (mind. 8 Zeichen).` / `Passwörter stimmen nicht überein.` → `updateUserRemote({id, password})` → Toast `Passwort zurückgesetzt.`, Felder geleert. Kein Bestätigungsdialog, keine Session-Revokation.
- **Benutzer deaktivieren/reaktivieren** — Icon-Button in Liste (aria-label `Deaktivieren`/`Aktivieren`, kein Dialog) → optimistisches Override der Liste → `setUserActiveRemote` → Toast `Benutzer „<name>" deaktiviert.` / `… aktiviert.`; Fehler-Toast `Benutzer konnte nicht deaktiviert werden: Der letzte Administrator kann nicht deaktiviert werden.` Status-Badges `Aktiv` (success) / `Deaktiviert` (error).
- **Benutzer löschen** — Liste (Papierkorb) oder Edit-Seite („Löschen") → `ConfirmDialog` „Benutzer löschen?" / „Soll der Benutzer „<name>" wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden." / Button „Löschen" (danger) → `deleteUserRemote` mit optimistischem Listen-Override → Toast `Benutzer „<name>" gelöscht.` (Liste) bzw. `Benutzer gelöscht.` (Edit, dann `goto('/settings/users', {replaceState:true})`).
- **Rolle anlegen** — Rollenkarte „Neue Rolle" → `/settings/users/roles/new` → RoleForm: Name (Client ≥ 2 Zeichen, Fehler nach Blur/Submit auch am Feld), Beschreibung, „Voller Zugriff (*)"-Checkbox (graut Matrix aus, `opacity-50`, Checkboxen `disabled`), Matrix je Modul → `createRoleRemote(values).updates(listRolesRemote())` → Toast `Rolle angelegt.` → `goto('/settings/users?tab=roles', {replaceState:true})`. Fehler: `Rolle konnte nicht angelegt werden: Eine Rolle mit diesem Namen existiert bereits.`
- **Rolle bearbeiten** — Zeile/Stift → `/settings/users/roles/[id]/edit`; Admin-Rolle: Info-Alert „Die Administrator-Rolle ist systemgeschützt - Name und Berechtigungen können nicht geändert werden.", alle Inputs + Speichern + Löschen `disabled` (Mode-Gate) → sonst `updateRoleRemote({id, ...values})` → Toast `Rolle gespeichert.` → `goto('/settings/users?tab=roles')`.
- **Rolle löschen** — Liste (Papierkorb, für Admin-Rolle `disabled`) oder Edit-Seite → `ConfirmDialog` „Rolle löschen?" / „Soll die Rolle „<name>" wirklich gelöscht werden? …" → `deleteRoleRemote` → Toast `Rolle „<name>" gelöscht.` bzw. `Rolle gelöscht.`. Betroffene Benutzer verlieren die Rolle sofort (Cascade); kein Hinweis auf Anzahl betroffener Benutzer.
- **Eigenes Passwort ändern** — Benutzermenü „Profil" oder Settings-Tab „Konto" → `/settings/account` → Klick „Passwort ändern": Client-Validierung (alle Felder touched, erste Meldung im Alert, Feldfehler; `_form`-Fehler am Bestätigungsfeld) → `changeOwnPasswordRemote` → Toast `Passwort aktualisiert.`, Felder geleert, `fv.resetTouched()`. Server-Fehler-Toast `Passwort konnte nicht geändert werden: Das aktuelle Passwort ist nicht korrekt.` Kein Re-Login, andere Sessions bleiben gültig.

## 7. Nebenwirkungen

- **E-Mails**: keine (keine Reset-/Verifikations-Mails; Admin-Reset informiert den Benutzer nicht).
- **PDFs, Uploads, Exporte**: keine.
- **Cookies**: `tcm.session_token` (7 d), `tcm.session_data` (5 min Cache), gesetzt/gelöscht ausschließlich von better-auth über `/api/auth/*`.
- **DB-Sessions**: `sessions`-Zeilen werden bei Sign-in erzeugt (better-auth; `ip_address`/`user_agent` befüllt), bei Sign-out gelöscht, bei Deaktivierung (`deleteUserSessions`) und Benutzer-Löschung (Cascade) entfernt. Abgelaufene Sessions werden nicht aktiv aufgeräumt (kein Cron, `CLAUDE.md`).
- **Rate-Limit-State**: prozesslokal (`rate-limit.ts:47`), geht bei Neustart verloren.
- **Seeds**: `seedDefaults()` beim ersten Request (Rollen, s. 3.9).
- **Externe APIs / Webhooks / Nummernkreise**: keine.
- **Env-Variablen**: `APP_SECRET`, `BETTER_AUTH_URL`, `ORIGIN`, `API_TOKENS` (`.env.example:2,11,20,54`).

## 8. Vorhandene Tests

| Testdatei | Art | Was wird abgedeckt (1 Zeile) |
|---|---|---|
| `src/routes/settings/users/users.remote.test.ts` (782) | integration (pg-mem, gemocktes `$app/server` + `$lib/server/auth`) | 401/403 für alle 9 Remotes, Create+Rollen, Listen-Suche/Pagination, Update-Rollenersatz, Delete/Deaktivieren inkl. Letzter-Admin-Guards und Session-Kill, Rollen-CRUD, Duplikat-409, Admin-Rolle-Schutz, unbekannte Permission |
| `src/routes/settings/account/account.remote.test.ts` (291) | integration | 401, falsches aktuelles Passwort, Mismatch, zu kurz, identisch, Happy-Path, fehlender Credential-Account |
| `src/lib/server/auth-users.test.ts` (214) | integration (echtes better-auth `$context`) | Lowercase/Trim, E-Mail-Synthese, scrypt-Format, Hash-Roundtrip, Username-Regeln, Case-insensitive Duplikat wirft, `isUserActive`, `isUsernameDeactivated`, `deleteUserSessions` |
| `src/lib/server/auth-permissions.test.ts` (135) | unit + integration | `hasPermission`, `ALL_PERMISSIONS`, `loadUserPermissions` (leer, Rolle, Union, Wildcard) |
| `src/hooks.server.test.ts` (328) | integration (Hook-Kette mit Mocks) | Sign-in-Rate-Limit (10/min/IP, 429, GET/andere POSTs frei), Public-API-Limit (180, Token-Bucket, IP-Fallback), `resolveClientIp`, `handleValidationError`-Labels. **Nicht** getestet: `blockDeactivatedSignIn`, `populateAuthLocals`, `requireAuthHandle` |
| `src/lib/server/api-tokens.test.ts` (172) | unit | Fail-closed, Separatoren, Mindestlänge, Case/Länge, Re-Read, Header-Parsing |
| `src/lib/server/rate-limit.test.ts` (107) | unit (Fake-Timer) | Fenster, Burst, Reset, Key-Isolation, Denied zählt nicht, `retryAfter` |
| `src/routes/login/page.test.ts` (64) | component | Button nie disabled, Client-Meldungen Benutzername/Passwort |
| `src/routes/login/sign-in-error.test.ts` (54) | unit | Status→deutsche Meldung inkl. deaktiviert/429 |
| `src/routes/settings/users/new/page.test.ts` (79) | component | Klick-Validierung Reihenfolge |
| `src/routes/settings/users/[id]/edit/page.test.ts` (95) | component | Leerer Name, kurzes Reset-Passwort |
| `src/routes/settings/users/roles/RoleForm.test.ts` (238) | component | Name ≥2, Wildcard-Payload, Subset, locked-Zustand, Dirty-Contract, Delete/Cancel, Trim |
| `src/routes/settings/account/page.test.ts` (63) | component | Button nie disabled, leere Felder, Mismatch |
| `src/lib/stores/idle-logout.svelte.test.ts` (98) | unit | Timeout, Reset, Stop, einmaliges Feuern, Fehler geschluckt, Event-Liste, SSR-No-op |
| `src/lib/components/layout/navigation.test.ts` (128) | unit | Nav-Filter (kein Perm → nur Start, Wildcard, Modul-Filter, Labels) |
| `src/lib/components/layout/AppShell.test.ts` (373, Auth-Teile `:167-227`) | component | Nav-Filter, kein user-menu ohne User, Idle-Logout mit 3 600 000 ms, Abmelden ruft `signOut`, Fehler → `handleClientError` |
| `src/routes/setup/setup.remote.test.ts` (`:230-287`) | integration | `createInitialAdmin`: Lowercase + Admin-Rolle, zweiter Aufruf 409, ungültiger Username |
| `src/routes/setup/wizard.test.ts` (`:219,232`) | component | Admin-Schritt: Leerzeichen-Regression, gültiger Submit ruft `createInitialAdmin` einmal |
| `e2e/auth.spec.ts` (49) | e2e | falsches Passwort → Meldung; Login landet in Shell (`user-menu` zeigt Username); Logout + `/customers` bounced auf `/login` |
| `e2e/users.spec.ts` (112) | e2e (serial) | Benutzer anlegen mit Rolle Mitarbeiter (Klick-Validierung), Login als dieser Nutzer: gefilterte Sidebar (Kunden/Aufträge sichtbar; Einstellungen/Mitarbeiter/Buchhaltung/Rundschreiben/Aktuelle Informationen fehlen), 403-Seite auf `/settings/users`; Cleanup-Löschung |
| `e2e/global-setup.ts` (`:90-109`) | e2e-Infra | Login über echtes Formular, `storageState` → `e2e/.auth/admin.json` |

Lücken (Tests): kein e2e für Passwort ändern/zurücksetzen, Deaktivierung, Rollen-CRUD, `redirectTo`-Roundtrip, Idle-Logout, 429; keine Unit-Tests für `blockDeactivatedSignIn`/`populateAuthLocals`; `users.remote.test.ts:85-130` mockt `auth.api.signUpEmail`, das im Produktivpfad nicht mehr verwendet wird (toter Mock).

## 9. Feature-Matrix

| ID | Feature | Routen | Endpoints/Remotes | Tabellen | Erwartetes Verhalten |
|---|---|---|---|---|---|
| F-055 | Login mit Benutzername + Passwort | `/login` | POST `/api/auth/sign-in/username` | `users`, `accounts`, `sessions` | Client-Validierung bei Klick (3..64 / 8..128), Username getrimmt, serverseitig lowercase-Lookup; Erfolg = Session-Cookie + Full-Reload auf `redirectTo` (nur Pfade mit `/`, nicht `//`) sonst `/`; Button nur bei `busy.active` disabled |
| F-056 | Deutsche Login-Fehlermeldungen | `/login` | – | – | 401/403 → „Benutzername oder Passwort ist falsch." (kein Unterschied unbekannt/falsch), 403 mit „deaktiviert" → Server-Text, 429 → Server-Text/Default, sonst generisch |
| F-057 | Hinweis nach Idle-Logout | `/login?reason=idle` | – | – | Info-Alert mit Ein-Stunden-Text |
| F-058 | Brute-Force-Schutz Login | `/api/auth/sign-in/*` | Hook `rateLimitSignIn` | – | 10 POST/min/IP (XFF-first), 429 + `Retry-After`, GET und andere Auth-Pfade unlimitiert |
| F-059 | Sign-in-Sperre für deaktivierte Konten | `/api/auth/sign-in/*` | Hook `blockDeactivatedSignIn` | `users.active` | 403 mit kuratierter Meldung vor Credential-Prüfung; unbekannte Namen fallen durch |
| F-060 | Session-Lebenszyklus | alle | better-auth | `sessions` | 7 Tage, Verlängerung nach 1 Tag Aktivität, Cookie-Cache 5 min, Cookies `tcm.*` httpOnly/lax/secure(https) |
| F-061 | Auth-Gate für Seiten | alle nicht-öffentlichen | Hook `requireAuthHandle` | – | 303 → `/login?redirectTo=…`; Whitelist `/login`, `/api/auth`, `/api/public`, `/api/ebay/account-deletion`, `/setup`, `/_app`, `/favicon` |
| F-062 | Request-Kontext (`locals`) | alle | Hook `populateAuthLocals` | `users`, `user_roles`, `role_permissions` | pro Request Session + `active`-Recheck + Permission-Union; deaktivierte Nutzer sofort anonym |
| F-063 | Logout | AppShell-Benutzermenü | POST `/api/auth/sign-out` | `sessions` | Session gelöscht, Full-Reload `/login`; Fehler-Toast |
| F-064 | Idle-Logout | AppShell | `signOut` | `sessions` | 60 min ohne Aktivität (5 Event-Typen), einmaliges Feuern, Reload auf `/login?reason=idle`, nur für angemeldete Nutzer |
| F-065 | Server-Guards | alle Remotes | `requireUser`/`requirePermission`/`requireAnyPermission` | – | 401 „Bitte melden Sie sich an." / 403 „Keine Berechtigung für diese Aktion."; erste Anweisung jedes Remote-Bodys (Ausnahmen: layout, setup) |
| F-066 | Permission-Modell | – | – | `role_permissions` | 19 Module × 1 Key, `hours` zusätzlich `hours:write_own`, Wildcard `*`; keine Vererbung/Hierarchie |
| F-067 | Sidebar-Filter | AppShell | `getCurrentUserRemote` | – | Items mit `permission` nur bei exaktem Key oder `*`; leere Gruppen fallen weg; ohne Rechte nur „Start"; „Stunden" hängt an `hours:write_own` |
| F-068 | Settings-Tab-Filter | `/settings/*` | `getCurrentUserRemote` | – | Tabs nach Modul-Key; „Konto" immer; bei nur einem sichtbaren Tab keine Tab-Leiste |
| F-069 | 403-Fehlerseite | beliebig | – | – | Kuratierte deutsche Seite mit Zurück/Dashboard |
| F-070 | Seed-Rollen | – | `seedDefaults` | `roles`, `role_permissions` | Administrator(`*`), Werkstattleiter (alles außer settings/users, inkl. beider hours-Keys), Mitarbeiter (kuratierte Liste + `hours:write_own`); idempotent, nur additiv |
| F-071 | Erst-Admin im Setup | `/setup` Schritt 7 | `createInitialAdmin` | `users`, `accounts`, `user_roles` | nur solange kein Benutzer existiert; Rolle Administrator automatisch; Username lowercase |
| F-072 | Benutzerliste | `/settings/users` | `listUsersRemote` | `users`, `user_roles`, `roles` | Suche über username/name/email (ILIKE), 25/Seite serverseitig, `createdAt DESC`, Spalten Benutzername/Name/Rollen/Status/Erstellt/Aktion, Rollen-Badges („keine"), Status-Badge, Zeile klickbar, Kartenliste < lg, Zähler „N Einträge", Leerzustand mit CTA |
| F-073 | Benutzer anlegen | `/settings/users/new` | `createUserRemote` | `users`, `accounts`, `user_roles` | Username 3..64 `[A-Za-z0-9_.]`, gespeichert lowercase (+`displayUsername` original), E-Mail `<username>@twincars.local`, Passwort 8..128 + Bestätigung, Rollen via MultiSelect (optional), Toast, Rücksprung |
| F-074 | Benutzer bearbeiten | `/settings/users/[id]/edit` | `getUserRemote`, `updateUserRemote` | `users`, `user_roles` | Anzeigename (Pflicht) + Rollen (kompletter Ersatz); Username read-only; Toast „Benutzer gespeichert." |
| F-075 | Passwort-Reset durch Admin | `/settings/users/[id]/edit` | `updateUserRemote({password})` | `accounts` | eigenes Sub-Formular, 8..128 + Bestätigung, Hash via better-auth, legt Credential-Zeile bei Bedarf an; keine Benachrichtigung, keine Session-Revokation |
| F-076 | Benutzer deaktivieren/reaktivieren | `/settings/users` | `setUserActiveRemote` | `users`, `sessions` | Toggle ohne Dialog, optimistisch; Deaktivierung löscht Sessions; letzter Wildcard-Inhaber nicht deaktivierbar (409) |
| F-077 | Benutzer löschen | `/settings/users`, `/settings/users/[id]/edit` | `deleteUserRemote` | `users` (+Cascade) | ConfirmDialog; letzter Wildcard-Inhaber nicht löschbar (409); optimistischer Listen-Override |
| F-078 | Letzter-Admin-Guard bei Rollenentzug | Edit-Seite | `updateUserRemote({roleIds})` | `user_roles`, `role_permissions` | 409, wenn neuer Rollensatz kein `*` mehr ergibt und kein anderer Wildcard-Inhaber existiert |
| F-079 | Rollenliste | `/settings/users` | `listRolesRemote` | `roles`, `role_permissions` | Name (+Badge „System" für Administrator), Beschreibung, Badges: „Voller Zugriff (*)" oder max. 3 Keys + „+N" oder „keine"; Löschen-Button für Admin-Rolle disabled; Leerzustand |
| F-080 | Rolle anlegen | `/settings/users/roles/new` | `createRoleRemote` | `roles`, `role_permissions` | Name (Client ≥2, Server 1..100, eindeutig/409), Beschreibung ≤500, Permissions nur bekannte Keys, Wildcard ersetzt Auswahl; Toast „Rolle angelegt." |
| F-081 | Rolle bearbeiten | `/settings/users/roles/[id]/edit` | `updateRoleRemote` | `roles`, `role_permissions` | Admin-Rolle: UI gesperrt + Server verbietet Rename und `*`-Entzug (Beschreibung änderbar); Namenskollision 409; 404 bei unbekannter ID |
| F-082 | Rolle löschen | Liste, Edit | `deleteRoleRemote` | `roles` (+Cascade) | ConfirmDialog; Admin-Rolle 409; Zuweisungen fallen weg |
| F-083 | Berechtigungsmatrix-UI | RoleForm | – | – | Modul-Karten in Deklarationsreihenfolge, Checkbox „Zugriff" (hours: „Alle Stunden"/„Nur eigene Stunden"), Key als Monospace-Subtext; Wildcard-Checkbox deaktiviert Matrix |
| F-084 | Eigenes Passwort ändern | `/settings/account` | `changeOwnPasswordRemote` | `accounts` | jeder Angemeldete; aktuelles Passwort wird verifiziert; neu ≠ alt, 8..128, Bestätigung; Toast „Passwort aktualisiert."; Sessions bleiben |
| F-085 | Benutzermenü | AppShell | – | – | Name + Username, „Angemeldet als …", Links „Profil", „Abmelden"; nur bei `currentUser` |
| F-086 | Aktueller Benutzer für Layout | alle | `getCurrentUserRemote` | – | `null` anonym; sonst id/username/name/permissions[] |
| F-087 | Unsaved-Changes-Guard auf Auth-Formularen | new/edit/roles/account | – | – | `formDirty` bei Input; Clear erst nach Erfolg vor `goto`; Dialog „Ungespeicherte Änderungen" |
| F-088 | Public-API-Token-Auth | `/api/public/*` | `authenticateRequest` | – | Bearer aus `API_TOKENS`, konstante Zeit, fail-closed, nur 8-Zeichen-Präfix downstream |
| F-089 | Public-API-Rate-Limit | `/api/public/*`, eBay-Endpoint | Hook `rateLimitPublicApi` | – | 120/min + 60 Burst je Token-Präfix, sonst IP; 429 + Meldung |
| F-090 | `hours:write_own`-Scoping | `/hours` | hours-Remotes | `employees` | Nutzer ↔ Mitarbeiter über `employees.privateEmail == users.email`; ohne Treffer leere Liste bzw. 403 „Kein Mitarbeiterprofil verknüpft." |
| F-091 | Passwort-Hashing | – | `auth.$context.password` | `accounts.password` | scrypt (better-auth-Default), `salt:key` hex; Verify im Login und Konto-Flow |
| F-092 | Berechtigungs-Union über mehrere Rollen | – | `loadUserPermissions` | `user_roles`, `role_permissions` | Set-Vereinigung aller Rollen; `*` dominiert |
| F-093 | better-auth-Zusatzendpunkte (technisch) | `/api/auth/*` | update-user, change-password, list/revoke-sessions, is-username-available … | `users`, `sessions`, `accounts` | von der App nicht genutzt, aber erreichbar (siehe B-051/07) |
| F-094 | Setup-Gate | alle | `getLayoutContext` | `company_settings` | bis `setupCompleted` Client-Redirect `/setup`; Setup-Remotes anonym erreichbar bis Abschluss |

## 10. Befunde

| ID | Beschreibung | Fundstelle | Auswirkung | Empfehlung | Einordnung | Betroffene Features |
|---|---|---|---|---|---|---|
| B-046 | Doppelter Benutzername (oder gleiche synthetisierte E-Mail) wird nicht vorab geprüft; Unique-Index-Verletzung wird zum generischen 500 „Ein interner Fehler ist aufgetreten." | `src/lib/server/auth-users.ts:73-84`, `src/routes/settings/users/users.remote.ts:168-172` | Admin erhält unverständliche Meldung; Server-Log-Rauschen | Vorab-Lookup (normalisiert) + 409 „Benutzername bereits vergeben." | im Rewrite beheben | F-073, F-071 |
| B-047 | `createUserRemote` legt den Benutzer an, bevor `roleIds` validiert werden; bei ungültiger Rolle bleibt ein Benutzer ohne Rollen zurück (400). Kein `db.transaction`. | `users.remote.ts:168-180` | inkonsistenter Datenstand, verwirrende Wiederholung („Benutzername bereits vergeben") | Rollen zuerst prüfen; User+Account+Rollen in einer Transaktion | im Rewrite beheben | F-073 |
| B-048 | `createUserWithCredential` wirft plain `Error` mit deutscher Meldung (nicht `error(400,…)`), die `handleError` als 500 verschluckt | `auth-users.ts:56-63` | Meldung erreicht den Nutzer nie (nur bei Schema-Umgehung relevant) | Als `error(400, …)` werfen oder Validierung ausschließlich im Schema | im Rewrite beheben | F-073 |
| B-049 | Admin-Passwort-Reset lässt bestehende Sessions des Zielbenutzers bestehen | `users.remote.ts:210-220` | kompromittierte Session bleibt nach Reset gültig (bis 7 Tage) | `deleteUserSessions(id)` nach Reset | im Rewrite beheben | F-075 |
| B-050 | Eigene Passwortänderung revoziert andere Sessions nicht; better-auth-`/change-password` böte `revokeOtherSessions` | `account.remote.ts:93-97` | fremde Sitzung überlebt Passwortwechsel | Andere Sessions löschen (aktuelle behalten) | im Rewrite beheben | F-084 |
| B-051 | Catch-all exponiert `POST /api/auth/update-user`: ein angemeldeter Nutzer kann `name`, `image`, **`username`/`displayUsername`** selbst ändern (Plugin-Hook prüft nur Eindeutigkeit). Widerspricht der UI-Regel „Der Benutzername kann nicht geändert werden."; `users.email` bleibt alt → `hours`-Bridge und Listen-Suche laufen auseinander. Ebenso `/change-password` ohne App-Regeln, `/list-sessions`, `/revoke-*`. | `src/routes/api/auth/[...all]/+server.ts:10-16`, `node_modules/better-auth/dist/plugins/username/index.mjs:250-276`, `[id]/edit/+page.svelte:143` | Integritäts-/Autorisierungsumgehung durch normale Nutzer | In der Zielplattform nur benötigte Auth-Routen registrieren bzw. `update-user` per Hook auf `name` beschränken / Username-Feld `input:false` | im Rewrite beheben | F-074, F-090, F-093 |
| B-052 | `POST /api/auth/is-username-available` ist ohne Session erreichbar → Benutzernamen-Enumeration, obwohl ADR-013 „keine Enumeration" zusichert | `plugins/username/index.mjs:225-244`, `docs/decisions/adr-013-username-only-auth.md:31-32` | Angreifer kann gültige Logins ermitteln, Rate-Limit greift dort nicht (nur `/sign-in`) | Endpoint sperren/entfernen oder authentifizieren; Rate-Limit auf `/api/auth/*` ausweiten | im Rewrite beheben | F-055, F-093 |
| B-053 | Deaktivierte Konten antworten mit eigener 403-Meldung → unterscheidet „deaktiviert" von „unbekannt/falsch" (bewusste UX-Entscheidung, dokumentiert) | `hooks.server.ts:178-202`, `CONTRIBUTING.md:157-162` | begrenzte Enumeration deaktivierter Namen | Beibehalten oder auf generische Meldung + Admin-Hinweis wechseln | Entscheidung nötig | F-059 |
| B-054 | `x-forwarded-for` wird bedingungslos vertraut; ohne vorgeschalteten Proxy, der den Header überschreibt, ist das Sign-in-Rate-Limit per Header-Spoofing umgehbar | `hooks.server.ts:88-99` | Brute-Force-Schutz aushebelbar | Nur bei konfiguriertem Trusted-Proxy XFF nutzen (z. B. Env-Flag), sonst Socket-IP | im Rewrite beheben | F-058, F-089 |
| B-055 | Rate-Limiter ist In-Memory und prozesslokal (dokumentiert für Single-Replica) | `rate-limit.ts:16-25, 47` | Reset bei Neustart; bei Skalierung unwirksam | In Nuxt/Nitro `unstorage`-basiert (Redis/DB) auslegen | Entscheidung nötig | F-058, F-089 |
| B-056 | Open-Redirect-Guard prüft nur `startsWith('/')` und nicht `'//'`; `/\evil.example` wird von Browsern zu `//evil.example` normalisiert (Backslash ≙ Slash) | `src/routes/login/+page.svelte:100-105` | potenzieller Open Redirect nach Login | `new URL(redirectTo, location.origin).origin === location.origin` prüfen, Backslash ablehnen | im Rewrite beheben | F-055 |
| B-057 | Bei abgelaufener/gelöschter Session während SPA-Nutzung liefern Remote-Aufrufe 401 (Toast/Fehlerseite), aber es erfolgt keine automatische Weiterleitung zu `/login`; `/_app` (inkl. `/_app/remote/*`) ist Whitelist-Präfix | `hooks.server.ts:70,221-229`, `auth-guards.ts:26`, `client-error.ts:61-69`, `+error.svelte:22-40` (kein 401-Zweig) | Nutzer sieht Fehler statt Login-Maske; Formulareingaben können verloren gehen | Zentrale 401-Behandlung im Client (Redirect mit `redirectTo`), 401-Zweig in Fehlerseite | im Rewrite beheben | F-061, F-065 |
| B-058 | Sidebar-Item „Stunden" verlangt exakt `hours:write_own`; eine Rolle mit nur `hours` (Vollzugriff) sieht den Eintrag nicht (`hasPermission` kennt keine Implikation). Seed-Rollen sind zufällig nicht betroffen (Werkstattleiter hat beide Keys). | `navigation.ts:188-192`, `navigation.ts:62-64`, `permissions.ts:9-14` | Custom-Rollen mit Vollzugriff ohne Self-Service-Key verlieren die Navigation | Nav-Filter mit Any-of-Liste oder `hours` ⇒ `hours:write_own` implizieren | im Rewrite beheben | F-067, F-066 |
| B-059 | Rollen-Seiten navigieren zu `/settings/users?tab=roles`; die Benutzerseite hat keine Tabs mehr, Parameter wird ignoriert (toter Deep-Link) | `roles/new/+page.svelte:19,26,30`, `roles/[id]/edit/+page.svelte:45,56,63,69` | harmlos, aber irreführend; Back-Ziel ohne Anker zur Rollenkarte | Auf `/settings/users` (ggf. `#roles`-Anker) vereinheitlichen | im Rewrite beheben | F-080, F-081 |
| B-060 | `listUsersSchema.size` erlaubt `10\|25\|50\|100`, obwohl Pagination fix 25 ist (ADR-003) | `users.remote.ts:93` | Inkonsistenz zur Regel, tote Optionen | `literal(25)` oder Konstante | im Rewrite beheben | F-072 |
| B-061 | Schema-Pipes ohne deutsche Meldung: `page: number()`, `size: picklist`, `q maxLength(200)`, `description maxLength(500)` (users/roles), `idSchema` | `users.remote.ts:92-94,113,120`, `validation.ts:28` | englische Valibot-Texte werden durch generisches „Bitte prüfen Sie Ihre Eingabe." ersetzt – Verstoß gegen CONTRIBUTING §12 | Meldungen ergänzen | im Rewrite beheben | F-072, F-080 |
| B-062 | Dokumentation/Schema-Kommentar nennen „bcrypt", tatsächlich scrypt (better-auth-Default, Test bestätigt `salt:key`-Format) | `schema.ts:1861`, `docs/architecture/auth-and-permissions.md:17`, `account.remote.ts:55` | Fehlplanung der Hash-Migration im Rewrite | Hash-Format als scrypt (better-auth-Parameter) dokumentieren; Migrationsstrategie festlegen (Verifier portieren oder Zwangs-Reset) | Entscheidung nötig | F-091 |
| B-063 | Nutzer↔Mitarbeiter-Verknüpfung nur implizit über `employees.privateEmail === users.email` (`<username>@twincars.local`); `privateEmail` ist im Mitarbeiterformular frei editierbar | `src/routes/hours/hours.remote.ts:61-81`, `src/routes/employees/EmployeeForm.svelte:323` | fragil; wer `employees` bearbeiten darf, kann Stunden-Identitäten umhängen; Admin muss Konvention kennen | Explizite Spalte `employees.user_id` (FK) + Picker in der Benutzerverwaltung | Entscheidung nötig | F-090 |
| B-064 | Letzter-Admin-Guards zählen **deaktivierte** Wildcard-Inhaber als „anderen Admin" (`active` wird nicht gefiltert) → der letzte aktive Admin kann gelöscht/deaktiviert bzw. seiner Rolle beraubt werden | `user-admin-service.ts:242-270`, `users.remote.ts:230-239, 263-268, 293-300` | vollständiger Lockout aus Benutzer-/Rollenverwaltung möglich | Guards auf `users.active = true` einschränken | im Rewrite beheben | F-076, F-077, F-078 |
| B-065 | Kein Schutz gegen Selbst-Deaktivierung/-Löschung/-Rollenentzug des aufrufenden Admins (weder UI noch Server), sobald ein zweiter Wildcard-Inhaber existiert | `users/+page.svelte:136-166, 85-133`, `users.remote.ts:256-309` | Admin sperrt sich versehentlich mitten in der Sitzung aus | Eigenes Konto in Liste markieren, Aktionen auf sich selbst mit Bestätigung/Verbot | im Rewrite beheben | F-076, F-077 |
| B-066 | Rollen- und Berechtigungsersatz ohne Transaktion (`DELETE` + `INSERT`); Abbruch dazwischen hinterlässt Nutzer/Rolle ohne Rechte | `user-admin-service.ts:154-160, 340-360, 374-388` | Inkonsistenz bei Fehlern | `db.transaction` | im Rewrite beheben | F-074, F-080, F-081 |
| B-067 | `updateRoleFields` setzt `roles.updated_at` nicht | `user-admin-service.ts:363-371` | Audit-Spalte unbrauchbar | `updatedAt: new Date()` | im Rewrite beheben | F-081 |
| B-068 | Kein Audit-Trail für sicherheitsrelevante Admin-Aktionen (Passwort-Reset, Deaktivierung, Rollenänderung, Löschung) | gesamtes Modul (kein Logging außer `console.error` bei 5xx) | Nachvollziehbarkeit fehlt (Kfz-Betrieb mit Rechnungsdaten) | Audit-Tabelle oder strukturiertes Log mit Akteur/Ziel/Aktion | Entscheidung nötig | F-074…F-078, F-082 |
| B-069 | `sessions.ip_address/user_agent` werden gespeichert, aber es gibt keine UI zum Anzeigen/Revozieren von Sitzungen; keine Aufräumung abgelaufener Sessions | `schema.ts:1827-1828`, kein Aufrufer von `/list-sessions`/`/revoke-*` | Tabelle wächst; Nutzer können Fremdsitzungen nicht beenden | Session-Liste im Konto + periodische Bereinigung (externer Cron-Pfad) | bewusst später | F-060, F-084 |
| B-070 | Passwort-Policy nur Länge 8..128; keine Komplexität, keine Breach-Prüfung, kein Account-Lockout (Rate-Limit ist rein IP-basiert), kein 2FA | `auth.ts:53-54`, `users.remote.ts:76-80` | schwache Passwörter möglich; verteilte Angriffe umgehen IP-Limit | Policy festlegen (mind. Länge 12 oder zxcvbn), Per-Account-Backoff | Entscheidung nötig | F-055, F-073, F-075, F-084 |
| B-071 | `APP_SECRET`-Fallback `'dev-only-fallback-secret-do-not-use-prod'` ohne Hard-Fail in Produktion; `trustedOrigins` nur aus `ORIGIN`, nicht aus `BETTER_AUTH_URL` | `auth.ts:37, 46-47` | Fehlkonfiguration bleibt unbemerkt; Cookie-Signaturen mit bekanntem Secret | Beim Boot in `NODE_ENV=production` abbrechen, wenn Secret fehlt; Origins konsistent ableiten | im Rewrite beheben | F-060 |
| B-072 | Idle-Logout ist pro Browser-Tab; ein inaktiver Tab meldet den Nutzer serverseitig ab, während er in einem anderen Tab aktiv arbeitet; bei dirty Formular blockiert der `beforeunload`-Prompt den Reload, obwohl `signOut` bereits lief | `AppShell.svelte:62-74, 119-133`, `idle-logout.svelte.ts:57-71` | Datenverlust/inkonsistenter Zustand | Aktivität tab-übergreifend (BroadcastChannel/`localStorage`), `formDirty` vor Idle-Redirect leeren | im Rewrite beheben | F-064 |
| B-073 | `FIELD_LABELS` fehlen Auth-Schlüssel (`roleIds`, `permissions`, `currentPassword`, `newPassword`, `newPasswordConfirm`, `active`, `id`) → Validierungsfehler zeigen Rohschlüssel („Ungültige Eingabe für „newPassword“") | `hooks.server.ts:264-375` | englische Bezeichner in Meldungen | Labels ergänzen | im Rewrite beheben | F-073, F-080, F-084 |
| B-074 | Pro authentifiziertem Request 3 zusätzliche DB-Queries (`isUserActive`, 2× in `loadUserPermissions`) zusätzlich zum Session-Lookup; kein Caching | `hooks.server.ts:205-212`, `auth-permissions.ts:17-35` | bei kleinem Nutzerkreis unkritisch, aber pro Remote-Aufruf | Eine Query mit Join; Permissions in Session-Cache versionieren | bewusst später | F-062 |
| B-075 | `verifications`-Tabelle sowie `users.image`, `users.email_verified`, `accounts.*token*`-Spalten sind fachlich tot (nur Adapter-Pflicht) | `schema.ts:1873-1888, 1794-1795, 1851-1860` | Migrationsballast | Im Zieldatenmodell weglassen, falls neue Auth-Lösung sie nicht braucht | Entscheidung nötig | – |
| B-076 | `display_username` wird gespeichert, aber nirgends angezeigt (Liste und Menü zeigen `username` lowercase) | `auth-users.ts:64,81`, `users/+page.svelte:245`, `AppShell.svelte:465` | tote Spalte oder verpasste Anzeige | Entscheiden: anzeigen oder entfernen | Entscheidung nötig | F-072, F-085 |
| B-077 | Erst-Admin-Schema erlaubt `name` bis 200 Zeichen, Benutzerverwaltung (`nameSchema`) nur 100; HTML-`maxlength="200"` auf den Namensfeldern in new/edit widerspricht Server-Limit 100 | `setup.remote.ts:189`, `validation.ts:34`, `new/+page.svelte:117`, `[id]/edit/+page.svelte:150` | Nutzer kann 101–200 Zeichen eingeben und bekommt erst Server-Fehler | Limits vereinheitlichen | im Rewrite beheben | F-071, F-073, F-074 |
| B-078 | Rollennamen-Duplikatprüfung ist case-sensitiv (`eq(roles.name, name)`), Unique-Index ebenfalls → „Mitarbeiter" und „mitarbeiter" koexistieren; Admin-Schutz hängt am exakten String `'Administrator'` (umbenennbar? nein – aber eine zweite Rolle „administrator" ist möglich und nicht geschützt) | `user-admin-service.ts:326-333`, `users.remote.ts:63, 370, 420` | Verwechslungsgefahr; Schutzlogik an Namensstring statt an Flag gebunden | `roles.is_system`-Flag statt Namensvergleich; case-insensitive Unique | im Rewrite beheben | F-080, F-081, F-082 |
| B-079 | Seed `ensureRole` fügt Permissions nur hinzu; vom Admin bewusst entfernte Seed-Rechte (z. B. `orders` bei Mitarbeiter) kehren beim nächsten Prozessstart zurück | `seed-defaults.ts:359-376` | Admin-Anpassungen an Seed-Rollen sind nicht dauerhaft | Seeds nur bei Neuanlage der Rolle vollständig schreiben | im Rewrite beheben | F-070 |
| B-080 | Test-Lücken: keine Tests für `blockDeactivatedSignIn`, `populateAuthLocals`, `requireAuthHandle`; kein e2e für Passwortwechsel/-reset, Deaktivierung, Rollen-CRUD, Idle-Logout, `redirectTo`; toter `signUpEmail`-Mock | `hooks.server.test.ts:5-9`, `users.remote.test.ts:85-130`, `e2e/*.spec.ts` | Regressionen in Kernpfaden unentdeckt | Testplan im Rewrite entsprechend erweitern | im Rewrite beheben | F-059, F-061, F-075, F-076, F-084 |
| B-081 | CSRF-Lage nur implizit: Remote-Functions sind JSON-POSTs (SvelteKit-Origin-Check greift nur für Form-Content-Types), Schutz beruht auf `SameSite=Lax`-Cookie + CORS; better-auth prüft `trustedOrigins`. Im Code keine explizite Absicherung für App-Mutationen | `svelte.config.js:8-10` (kein `csrf`-Eintrag), `auth.ts:47` | „unklar", framework-abhängig; muss im Nuxt-Ziel bewusst nachgebaut werden (Origin-Check für alle Mutationen) | Origin/Fetch-Metadata-Check als Nitro-Middleware | Entscheidung nötig | F-060, F-065 |

## 11. Offene Fragen an den Architekten

1. **Auth-Bibliothek im Nuxt-Ziel**: better-auth (hat Nuxt-Integration) beibehalten – dann können `sessions`/`accounts`/scrypt-Hashes 1:1 übernommen werden – oder Wechsel (z. B. `nuxt-auth-utils` mit eigenem Session-Store)? Bei Wechsel: scrypt-Verifier portieren oder Zwangs-Passwort-Reset für alle Nutzer (B-062)?
2. Sollen Benutzernamen änderbar sein (aktuell UI: nein, better-auth-Endpoint: ja, B-051)? Wenn nein, muss die E-Mail-Synthese als Bridge zu `employees` fallen (B-063) – explizite `employees.user_id`?
3. Passwort-Policy, Account-Lockout pro Benutzer, 2FA – gewünscht? (B-070)
4. Enumerations-Trade-off: Bleibt die explizite „Konto deaktiviert"-Meldung (B-053)? Soll `is-username-available` überhaupt existieren (B-052)?
5. Audit-Log für Admin-Aktionen und Login-Ereignisse (B-068) – Umfang, Aufbewahrung?
6. Sitzungsverwaltung für Endnutzer (eigene Sessions sehen/beenden) und Bereinigung abgelaufener Sessions über den geplanten externen Cron (B-069)?
7. Idle-Timeout: 60 min beibehalten? Tab-übergreifend? Serverseitige absolute Sitzungsdauer (7 Tage) beibehalten?
8. Zählen deaktivierte Administratoren als „vorhandener Admin" (B-064)? Selbst-Aktionen des Admins erlauben (B-065)?
9. Permission-Modell: bleibt es bei „ein Key pro Modul + `hours:write_own`" (ADR-002), oder soll das Rewrite Read/Write-Trennung bzw. weitere Self-Service-Keys vorsehen? Soll `hours` `hours:write_own` implizieren (B-058)?
10. System-Rollen: Flag `is_system` statt Namensvergleich; sollen Werkstattleiter/Mitarbeiter ebenfalls geschützt/bearbeitbar sein? Seeds nur einmalig (B-079)?
11. Public-API-Tokens: weiterhin Env-basiert (ADR-010) oder Token-Verwaltung im Admin-UI?
12. Rate-Limit-Speicher und Trusted-Proxy-Konfiguration im Nitro-Deployment (B-054/10).
13. `display_username`: anzeigen oder entfernen (B-076)?

## 12. Gelesene Dateien

| Datei | Zeilen |
|---|---|
| `src/lib/permissions.ts` | 53 |
| `src/lib/server/auth.ts` | 71 |
| `src/lib/server/auth-users.ts` | 142 |
| `src/lib/server/auth-guards.ts` | 60 |
| `src/lib/server/auth-permissions.ts` | 35 |
| `src/lib/server/api-tokens.ts` | 113 |
| `src/lib/server/rate-limit.ts` | 137 |
| `src/lib/client/auth-client.ts` | 17 |
| `src/routes/api/auth/[...all]/+server.ts` | 17 |
| `src/hooks.server.ts` | 470 |
| `src/lib/server/services/user-admin-service.ts` | 393 |
| `src/routes/settings/users/+page.svelte` | 551 |
| `src/routes/settings/users/users.remote.ts` | 427 |
| `src/routes/settings/users/[id]/edit/+page.svelte` | 262 |
| `src/routes/settings/users/[id]/edit/EditUserHost.svelte` | 15 |
| `src/routes/settings/users/new/+page.svelte` | 178 |
| `src/routes/settings/users/new/NewUserHost.svelte` | 15 |
| `src/routes/settings/users/roles/RoleForm.svelte` | 323 |
| `src/routes/settings/users/roles/new/+page.svelte` | 31 |
| `src/routes/settings/users/roles/[id]/edit/+page.svelte` | 81 |
| `src/routes/settings/account/+page.svelte` | 183 |
| `src/routes/settings/account/account.remote.ts` | 99 |
| `src/lib/stores/idle-logout.svelte.ts` | 89 |
| `src/lib/server/db/schema.ts` (Auth-Abschnitt `:1770-2025`, Rest nur per grep) | 2025 |
| `src/lib/server/db/seed-defaults.ts` (`:195-376` vollständig, Rest per grep) | 376 |
| `drizzle/0010_auth_better_auth_and_rbac.sql` | 138 |
| `drizzle/0027_user_active_flag.sql` | 4 |
| `e2e/auth.spec.ts` | 49 |
| `e2e/users.spec.ts` | 112 |
| `e2e/global-setup.ts` | 133 |
| `src/routes/settings/users/users.remote.test.ts` | 782 |
| `src/routes/settings/account/account.remote.test.ts` | 291 |
| `src/hooks.server.test.ts` | 328 |
| `src/lib/server/auth-users.test.ts` | 214 |
| `src/lib/server/api-tokens.test.ts` | 172 |
| `src/lib/server/auth-permissions.test.ts` | 135 |
| `src/lib/server/rate-limit.test.ts` | 107 |
| `src/routes/settings/users/new/page.test.ts` | 79 |
| `src/routes/settings/users/[id]/edit/page.test.ts` | 95 |
| `src/routes/settings/account/page.test.ts` | 63 |
| `src/lib/stores/idle-logout.svelte.test.ts` | 98 |
| `src/routes/login/page.test.ts` | 64 |
| `src/routes/login/sign-in-error.test.ts` | 54 |
| `src/routes/settings/users/roles/RoleForm.test.ts` | 238 |
| `src/lib/components/layout/navigation.test.ts` | 128 |
| `src/lib/components/layout/AppShell.test.ts` (Auth-Abschnitte `:1-100, 160-230`, Rest per grep) | 373 |
| `src/routes/setup/setup.remote.test.ts` (`:230-287` vollständig, Rest per grep) | 380 |
| `docs/architecture/auth-and-permissions.md` | 89 |
| `docs/decisions/adr-002-per-module-permissions.md` | 35 |
| `docs/decisions/adr-010-api-tokens-in-env.md` | 31 |
| `docs/decisions/adr-013-username-only-auth.md` | 33 |
| `docs/modules/settings.md` | 104 |
| `docs/modules/dashboard-and-login.md` | 42 |
| `CONTRIBUTING.md` (`:79-165` vollständig; Rest per grep nach auth/401/403/session) | 1474 |
| `src/routes/login/+page.svelte` | 202 |
| `src/routes/login/sign-in-error.ts` | 34 |
| `src/routes/layout.remote.ts` | 47 |
| `src/routes/+layout.svelte` | 88 |
| `src/lib/components/layout/AppShell.svelte` | 511 |
| `src/lib/components/layout/navigation.ts` | 247 |
| `src/routes/settings/+layout.svelte` | 118 |
| `src/routes/setup/setup.remote.ts` | 350 |
| `src/routes/setup/+page.svelte` (Admin-Schritt per grep, `:122-130, 190-200, 275-283, 763-833`) | 1148 |
| `src/lib/utils/client-error.ts` | 69 |
| `src/app.d.ts` | 21 |
| `src/routes/+error.svelte` | 77 |
| `src/routes/hours/hours.remote.ts` (`:55-91, 130-300`) | 369 |
| `src/routes/settings/+page.svelte` (Legacy-Tab-Redirect `:31-45` per grep) | – |
| `src/lib/server/db/validation.ts` (`:28-35` per grep) | – |
| `svelte.config.js` | 22 |
| `.env.example` | 58 |
| `node_modules/better-auth/dist/cookies/index.mjs` (`:1-80`) | – |
| `node_modules/better-auth/dist/plugins/username/index.mjs` (Endpunkte/Hooks `:11-60, 225-296`) | – |
| `node_modules/better-auth/dist/api/routes/update-user.mjs` (`:12-42`) | – |
