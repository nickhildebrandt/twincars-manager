---
title: Recherche Authentifizierung im Nuxt-Ökosystem
teil_von: docs/rewrite/03-architektur.md
stand: 2026-09-12, gegen offizielle Quellen geprüft
---

> Recherchegrundlage für [03-architektur.md](../03-architektur.md).
> Aussagen ohne Beleg sind ausdrücklich als **NICHT VERIFIZIERT** markiert.

# Research: Auth-Stack für den Nuxt-Rewrite (TwinCarsManager)

Stand: 2026-09-12. Alle Versions- und Datumsangaben wurden am Abrufdatum gegen npm-Registry, GitHub-API, Projekt-Doku bzw. Quellcode geprüft (siehe `## Quellen`). Zielplattform: **Nuxt 4.5.2** (npm `latest`, 2026-08-05; kein 5.x-dist-tag vorhanden) mit **Nitro 2.13.4 / h3 1.15.11** (h3 2.x ist weiterhin `2.0.1-rc.31`, nicht in Nuxt 4 stable).

---

## 1. Ist-Zustand (verifiziert aus dem Repo)

| Aspekt | Befund |
|---|---|
| Bibliothek | `better-auth` `^1.6.11` in `package.json`, installiert **1.6.20**; `username`-Plugin; Drizzle-Adapter (`better-auth/adapters/drizzle`, `provider: 'pg'`, `usePlural: false`, Tabellen explizit gemappt) |
| Tabellen | `users` (+ `username`, `display_username`, `active` seit Migration 0027), `sessions` (`token` unique, `expires_at`, `ip_address`, `user_agent`), `accounts` (`provider_id='credential'`, `password`), `verifications`; RBAC: `roles`, `user_roles`, `role_permissions` (`permission varchar(100)`, Wildcard `*`) — `drizzle/0010_auth_better_auth_and_rbac.sql` |
| Identität | Nur Username + Passwort, `disableSignUp: true`, synthetische E-Mail `<username>@twincars.local`; Nutzer werden per `createUserWithCredential` **direkt via Drizzle** eingefügt, Hash über `ctx.password.hash` (`auth-users.ts`) |
| Session | `expiresIn` 7 d, `updateAge` 1 d, `cookieCache` 5 min, `cookiePrefix: 'tcm'`, Secret = `APP_SECRET` |
| Request-Pipeline | `hooks.server.ts`: `rateLimitSignIn` (10/min je IP auf `POST /api/auth/sign-in/*`) → `blockDeactivatedSignIn` → better-auth-Handler → `populateAuthLocals` (`getSession` + `isUserActive` **pro Request** + `loadUserPermissions`) → `requireAuthHandle` |
| Guards | `requireUser()`, `requirePermission(key)`, `requireAnyPermission(...keys)` über `getRequestEvent().locals` (`auth-guards.ts`); Permission-Modell in `src/lib/permissions.ts` (ein Key je Modul, Ausnahme `hours:write_own`) |
| Deaktivierung | `users.active=false` + `deleteUserSessions(userId)`; Sign-in-POST wird vorher mit 403 abgewiesen (keine Enumeration für unbekannte Namen) |
| Idle-Logout | Rein clientseitig, 60 min (`idle-logout.svelte.ts`), ruft `authClient.signOut()` |

**Korrektur an der Bestandsdoku:** `docs/architecture/auth-and-permissions.md` behauptet „bcrypt in `accounts.password`". Das ist falsch — better-auth hasht mit **scrypt** (siehe 2.1). Bei der Migration die Doku mitziehen.

### 1.1 Das better-auth-Passwort-Hash-Format (Quelle: `@better-auth/utils@0.4.2`, `dist/password.node.mjs` — installiert; identisch in 1.7.4, das weiterhin `@better-auth/utils` 0.4.2 pinnt)

```
<salt>:<key>
  salt = 16 zufällige Bytes, HEX-kodiert (32 ASCII-Zeichen)
  key  = scrypt(password.normalize('NFKC'), salt, dkLen=64) HEX-kodiert (128 Zeichen)
  Parameter: N=16384, r=16, p=1, dkLen=64, maxmem = 128*N*r*2 = 67 108 864 Byte (64 MiB)
```

Wichtige Details für jede Re-Implementierung:

1. Als scrypt-Salt wird der **Hex-String selbst** (32 ASCII-Bytes) übergeben, nicht die 16 Rohbytes.
2. Das Passwort wird vor dem Hashen **NFKC-normalisiert**.
3. `r=16` (nicht der übliche Default 8) → Speicherbedarf ≈ 128·r·(N+2)+128·r·p ≈ 33,56 MB, also **über** Nodes/OpenSSLs Default-`maxmem` von 32 MiB. Wer diesen Hash mit `node:crypto.scrypt` nachrechnet, **muss `maxmem` ≥ 64 MiB** setzen, sonst wirft Node.
4. Implementierung: unter Node `node:crypto.scrypt` (libuv-Threadpool), sonst `@noble/hashes`. Der Vergleich erfolgt mit `===` auf Hex-Strings (nicht constant-time) — ein (kleiner) Kritikpunkt, den better-auth selbst mitbringt.
5. Verifikation ist trivial nachbaubar (≈ 15 Zeilen), siehe 5.5 / Alternative.

---

## 2. Kandidaten

### 2.1 nuxt-auth-utils (Atinux / Nuxt-Team)

| | |
|---|---|
| Version | **0.5.30** (2026-08-04, Security-Fix: OAuth-Login-CSRF durch fehlende `state`-Validierung); davor 0.5.29 (2026-02-17) — Releases in ~halbjährlichen Abständen |
| Maintainer | Sébastien Chopin (@atinux, NuxtLabs); npm-Maintainer `atinux`, `danielroe` |
| GitHub | 1 598 Stars, **107 offene Issues** (142 inkl. PRs), letzter Push 2026-08-04 |
| Lizenz | MIT |
| Nuxt 4 | Ja — Dependency `@nuxt/kit ^4.3.1`, `h3 ^1.15.4`; keine `meta.compatibility`-Angabe im Modul (implizit Nuxt 4) |
| Abhängigkeiten | `@adonisjs/hash`, `h3`, `jose`, `openid-client`, `hookable`, `ofetch`, `uncrypto`, `defu`, `pathe`, `scule`; Peer (optional) `@simplewebauthn/server|browser ^11` (aktuell ist **14.0.1** → Versionsrückstand), `@atproto/*` |

**Session-Modell:** Reine **versiegelte Cookie-Session** über h3 `useSession` (iron-webcrypto `seal`/`unseal`). Defaults: `name: 'nuxt-session'`, `password: NUXT_SESSION_PASSWORD` (≥ 32 Zeichen, im Dev automatisch in `.env` erzeugt), `cookie.sameSite: 'lax'`; h3-Defaults `httpOnly: true, secure: true, path: '/'`. `maxAge` ist **nicht** vorbelegt (README-Beispiel: 7 Tage). **Ablauf ist absolut** ab `createdAt` (h3 `unsealSession`: `Date.now() - createdAt > maxAge*1000` → „Session expired"; Cookie-`expires = createdAt + maxAge`); ein gleitendes/idle-Fenster gibt es nicht, außer man erzeugt die Session neu (`replaceUserSession`). 4096-Byte-Cookie-Limit (README-Hinweis). Kein Server-Store, **kein Revoke**: Der Autor bestätigt in Issue #203 (2024-10), dass der `fetch`-Hook **nur** vom Endpoint `/api/_auth/session` (SSR-Plugin/`useUserSession().fetch()`) aufgerufen wird, **nicht** von `requireUserSession(event)` in eigenen Server-Routen — empfohlener Workaround ist ein eigener Wrapper `requireValidUserSession(event)` plus eigene Session-ID in der Session (`session.id` wird mit `getUserSession` zurückgegeben) und ein DB-/KV-Lookup. Issue #68 („block/suspend users") → gleiches Muster über `sessionHooks.hook('fetch')` + `clearUserSession`.

**API:** Server `setUserSession`, `replaceUserSession`, `getUserSession`, `requireUserSession` (401 „Unauthorized"), `clearUserSession`, `sessionHooks` (`fetch`, `clear`), `hashPassword`/`verifyPassword`/`passwordNeedsRehash`; Client `useUserSession()` → `loggedIn`, `user`, `session`, `ready`, `fetch()`, `clear()`, `openInPopup()`; SSR-Plugin `session-fetch-plugin` (enforce `pre`) lädt die Session serverseitig über `useRequestFetch()('/api/_auth/session')` (`loadStrategy: 'server-first' | 'client-only' | 'none'`).

**Passwort-Hashing:** `@adonisjs/hash` Scrypt-Treiber, PHC-Format
`$scrypt$n=16384,r=8,p=1$<salt base64 ohne Padding>$<hash base64 ohne Padding>`; Defaults `cost 16384, blockSize 8, parallelization 1, saltSize 16, keyLength 64, maxMemory 32 MiB`; `verify()` liest `n/r/p` **aus dem PHC-String**, `maxmem` aber **aus der Konfiguration**; constant-time `safeEqual`; konfigurierbar unter `runtimeConfig.hash.scrypt` (`ScryptConfig`). **Nicht kompatibel** mit dem better-auth-Format `salt:hex` — `verifyPassword` wirft „Invalid id". Zwei Wege (Details 5.5): (a) Dual-Verify-Shim mit Rehash beim Login (empfohlen, 0 Datenmigration), (b) Re-Kodierung in PHC mit `r=16` + `maxMemory ≥ 64 MiB` (funktioniert, weil `verify` die Parameter aus dem String nimmt; NFKC-Kante bleibt).

**Rollen/Rechte:** Nichts eingebaut. Companion `nuxt-authorization` (barbapapazes) 0.3.5, letzter Release 2025-07-16 — optional, unser eigenes Modell ist ohnehin schlanker.

**Sicherheit:** Cookie-Defaults gut; kein Rate-Limit, kein CSRF-Token (Schutz = `sameSite: lax` + eigene Disziplin), Enumeration-Schutz und Brute-Force komplett selbst. WebAuthn/Passkeys eingebaut (`auth.webAuthn: true`, `defineWebAuthnRegisterEventHandler`/`...AuthenticateEventHandler`, `useWebAuthn()`), 2FA nicht.

### 2.2 better-auth (mit Nuxt-Integration)

| | |
|---|---|
| Version | **1.7.4** (2026-09-10); parallel gepflegte Linie **1.6.31** (ebenfalls 2026-09-10) und `release-1.4` (1.4.22). 1.7.0 erschien 2026-08-18 |
| Maintainer | Organisation `better-auth` (Bereket Engida u. a.; VC-finanziertes Unternehmen); npm-Maintainer `bekacru` |
| GitHub | 29 908 Stars, **319 offene Issues** (722 inkl. PRs), letzter Push 2026-09-12 |
| Lizenz | MIT |
| Nuxt 4 | Ja — offizielle Integrationsdoku (`/docs/integrations/nuxt`) mit `server/api/auth/[...all].ts`, Client `better-auth/vue`, Route-Middleware-Beispiel; Package-Export `./vue` in 1.7.4 verifiziert. **Kein** offizielles `@better-auth/nuxt` (npm 404). Community-Modul `nuxt-better-auth` 0.6.1 (aa900031, 2026-08-26, Peer `@nuxt/kit ^3.19.3 \|\| ^4.0.0`, `better-auth ^1.2`) — optional, nicht nötig |
| Abhängigkeiten | `zod ^4.5.4`, `kysely`, `better-call 1.4.0`, `jose`, `@noble/hashes|ciphers`, `nanostores`, `@better-fetch/fetch`, `@better-auth/core|utils|telemetry`, **fünf Adapter-Pakete als harte Dependencies** (drizzle, kysely, prisma, mongo, memory). Peer `drizzle-orm ^0.45.2 \|\| >=1.0.0-rc.1 <2` (Projekt: `^0.45.2`; drizzle `latest` ist weiterhin 0.45.2, `rc` 1.0.0-rc.4) |

**Nuxt-Integration (offizielle Doku):**
- `server/api/auth/[...all].ts`: `export default defineEventHandler((event) => auth.handler(toWebRequest(event)))`
- Client: `import { createAuthClient } from 'better-auth/vue'`; SSR-Session: `await authClient.useSession(useFetch)` (leitet Cookies weiter), im Client nur `authClient.useSession()`; für sonstige Aufrufe während SSR entweder `<ClientOnly>` oder Client mit `useRequestHeaders(['cookie'])`.
- Server-Routen: `await auth.api.getSession({ headers: event.headers })` → 401 via `createError`.
- Route-Middleware (`app/middleware/auth.ts`) mit `navigateTo({ path: '/login', query: { redirect: to.fullPath } })`.

**Session-Management (verifiziert in Doku + `packages/core/src/types/init-options.ts` @v1.7.4):** DB-Sessions (Tabelle `session`, `token` = Cookie-Wert), **gleitender Ablauf** (`expiresIn` Default 7 d, `updateAge` Default 1 d, `updateAge: 0` = bei jeder Nutzung), `freshAge` (Default 1 d), `disableSessionRefresh`, `deferSessionRefresh` (GET read-only), `cookieCache` (`enabled`, `maxAge`, `strategy: 'compact' | 'jwt' | 'jwe'`, `refreshCache`, `version`), `secondaryStorage` (+ `storeSessionInDatabase`, `preserveSessionInDatabase`). Revoke: `listSessions`, `revokeSession`, `revokeSessions`, `revokeOtherSessions`, `changePassword({ revokeOtherSessions })`; `auth.api.getSession({ headers, query: { disableCookieCache: true } })`. **Doku-Warnung:** Bei aktivem Cookie-Cache bleiben widerrufene Sessions bis `cookieCache.maxAge` auf anderen Geräten gültig → für „Admin deaktiviert → sofort raus" Cache aus oder `disableCookieCache` im Server-Middleware (siehe 4).

**Plugins:** `username` (Default max 30 Zeichen — Projekt setzt 64; Regex `^[a-zA-Z0-9_.]+$`; lowercase-Normalizer; Sign-in liefert für unbekannte Namen **denselben Fehler** `INVALID_USERNAME_OR_PASSWORD` und hasht trotzdem gegen Timing-Enumeration; **definiert keine eigene Rate-Limit-Regel** — Quelle `plugins/username/index.ts` @v1.7.4). `admin` (Spalten `user.role`, `banned`, `banReason`, `banExpires`, `session.impersonatedBy`; `banUser` revoked sofort alle Sessions; `databaseHooks.session.create.before` wirft `FORBIDDEN/BANNED_USER` für gebannte Nutzer; `listUsers`, `setUserPassword`, `revokeUserSessions`, `impersonateUser`; Access-Control-Statements via `createAccessControl`, Rollen als kommaseparierter String). `organization`, `two-factor` (TOTP/OTP/Backup-Codes, Trust-Device 30 d; **Erzwingung explizit auch für `/sign-in/username`**), **`@better-auth/passkey` 1.7.4** (eigenes Paket, `@simplewebauthn/server ^13.3.1`, Option `createSession`), `custom-session` (Session-Antwort um berechnete Felder erweitern), `multi-session`, `haveibeenpwned`.

**Rate-Limit (eingebaut):** Default nur in Production aktiv, `window 60`, `max 100`, Spezialregel `/sign-in/email` 3/10 s; `customRules` je Pfad (statisch, async oder `false`); `storage: 'memory' | 'database' | 'secondary-storage'` + `customStorage`; `ipAddressHeaders` (Default `x-forwarded-for`), `trustedProxies`, `ipv6Subnet`. Für `/sign-in/username` **muss** eine `customRules`-Regel gesetzt werden.

**Hooks/Erweiterung:** `user.additionalFields` (`type`, `required`, `defaultValue`, `input: false` für server-eigene Felder wie `active`, `returned`), `databaseHooks.{user,session,account}.{create,update,delete}.{before,after}` (Abbruch per `APIError` oder `return false`), `hooks.before/after` mit `createAuthMiddleware` (`ctx.path`, `ctx.body`, `ctx.context.newSession`, `ctx.context.password.hash/verify`).

**1.6 → 1.7 (Upgrade-Guide `/docs/guides/1-7-upgrade-guide`):** Für Credential-only-Apps **keine Schemaänderung**; die in 1.7.0–1.7.2 eingeführte `account.issuer`-Spalte wurde in **1.7.3 wieder entfernt** → direkt auf ≥ 1.7.3 gehen (1.7.4). Umbenennung `experimental.joins` → `advanced.database.joins` (Projekt nutzt es nicht). Captcha-Pfade `/sign-in` → `/sign-in/*` (nicht genutzt). Drizzle-Adapter in der Doku jetzt `@better-auth/drizzle-adapter` (+ `/relations-v2`), der Export `better-auth/adapters/drizzle` existiert in 1.7.4 aber weiterhin. Telemetrie: seit 1.3.5, **opt-in, standardmäßig aus** (`telemetry: { enabled: false }` / `BETTER_AUTH_TELEMETRY=0` trotzdem explizit setzen).

### 2.3 @sidebase/nuxt-auth

| | |
|---|---|
| Version | **1.3.1** (2026-06-30); 1.3.0 (2026-06-12), 1.2.0 (2026-02-06) |
| Maintainer | sidebase (SIDESTREAM GmbH; npm `zoey-kaiser`, `phoenix-ru`/`fervid`, `bracketjohn`, `valiafetisov`) |
| GitHub | 1 551 Stars, **76 offene Issues**, letzter Push 2026-09-04 |
| Lizenz | MIT |
| Nuxt 4 | **Issue #1043 „Add support for Nuxt 4" seit 2025-07-28 offen** (Labels `enhancement`, `breaking-change`, 17 Kommentare; Maintainer: „works generally", Nutzer melden `next-auth/core`-Resolve-Fehler; letzter „bump" 2026-08-14). Dependencies `@nuxt/kit ^3.20.2`, Peer **`next-auth ~4.21.1`** (authjs-Provider nur mit next-auth < 4.23; Issue #1095 zur gepatchten 4.24.15 wegen GHSA geschlossen 2026-07-27) |

**`local`-Provider:** Reiner **Client-Token-Halter**: erwartet eigene Endpoints (`signIn`, `signOut`, `signUp`, `getSession` — letzterer nicht abschaltbar), extrahiert per JSON-Pointer (`signInResponseTokenPointer: '/token'`) einen Token, legt ihn im Cookie `auth.token` (Default `maxAgeInSeconds: 1800`, `sameSiteAttribute`, `secureCookieAttribute`, `httpOnlyCookieAttribute` konfigurierbar) ab und sendet ihn als `Authorization: Bearer`. Refresh-Token-Flow (`refresh.isEnabled`, `refresh.endpoint`, `refresh.token.*`). **Kein** Passwort-Hashing, **keine** DB, **keine** Server-Session, **kein** Revoke, **keine** Rollen (Doku: Page-Protection nur nach Auth-Status; `globalAppMiddleware`, `definePageMeta({ auth: false | 'guest' | { unauthenticatedOnly, navigateAuthenticatedTo, navigateUnauthenticatedTo } })`). Man baut also den kompletten Auth-Kern selbst und bekommt nur `useAuth()` + Page-Middleware — für Username/Passwort ohne OAuth ist der Mehrwert gering, das Nuxt-4-Risiko real.

### 2.4 Kurz: Lucia (DIY) und nuxt-oidc-auth

- **Lucia** ist seit **März 2025 deprecated** (Site aktualisiert Juli 2026); es bleibt ein Leitfaden mit Single-File-Referenz (`auth_session.ts`). Muster: opake Session-Tokens, SHA-256-gehasht in der DB, gleitender Ablauf, eigene Cookie-Attribute. Mit h3 `useSession` **oder** eigener `sessions`-Tabelle + Drizzle in ~200 Zeilen umsetzbar; Passwort-Verify gegen das better-auth-Format ist trivial (1.1). Vorteil: null Fremdcode; Nachteil: alles (Rate-Limit, Enumeration, Passkeys, 2FA, Tests) selbst.
- **nuxt-oidc-auth** 1.0.0-beta.12 (2026-08-25, 165 Stars, MIT, itpropro) → benötigt einen IdP (Keycloak/Entra). Für eine Werkstatt-App mit ~10 lokalen Konten Overkill: zusätzlicher Betrieb (Keycloak-Container, Realm, Backups), Nutzerverwaltung wandert aus der App heraus. Nur relevant, falls später Firmen-SSO Pflicht wird.

---

## 3. Bewertungsmatrix (1 = schlecht, 5 = sehr gut)

| Kriterium | nuxt-auth-utils 0.5.30 | better-auth 1.7.4 | @sidebase/nuxt-auth 1.3.1 (`local`) | DIY (Lucia-Muster) |
|---|:-:|:-:|:-:|:-:|
| Wartungsstand | 4 (Nuxt-Team, aber 0.x, halbjährliche Releases, 107 Issues) | 4 (sehr aktiv, zwei gepflegte Linien; hoher Churn, 319 Issues) | 3 (regelmäßig, aber next-auth-v4-Pin, Nuxt-4-Issue offen) | 3 (eigener Code = eigene Wartung) |
| Nuxt-Integration / DX | 5 | 4 (offizielle Doku, kein Modul, SSR-Muster mit `useSession(useFetch)`) | 3 | 3 |
| Session-Handling (serverseitig, Revoke, Idle/Absolut) | 2 (Cookie-only, absolut, kein Revoke ohne Eigenbau) | 5 (DB-Sessions, Revoke-APIs, gleitend, Cookie-Cache, secondaryStorage) | 2 (Token im Cookie, Refresh selbst, kein Revoke) | 4 (alles möglich, alles selbst) |
| Rollen / Rechte | 2 (selbst; `nuxt-authorization` optional) | 4 (eigenes RBAC 1:1 übertragbar; `admin`-Plugin für Ban/Revoke/Impersonation optional) | 1 | 3 (bestehendes RBAC übernehmen) |
| Migrationsaufwand Bestand (Daten + Hashes) | 3 (Tabellen `users`/`accounts` bleiben; Hash-Shim; `sessions` neu bauen) | 5 (Tabellen, Hashes, Cookie-Präfix, Secret **unverändert**) | 2 (Endpoints, Hashing, Sessions komplett neu + Shim) | 4 (Tabellen bleiben, Hash-Verify nachbauen) |
| Sicherheitsdefaults (CSRF, Cookies, Rate-Limit, Enumeration) | 3 (Cookies gut; Rate-Limit/Enumeration selbst; frischer OAuth-CSRF-Fix) | 5 (trustedOrigins-CSRF, Cookies httpOnly/secure/lax, Rate-Limit eingebaut, enumerationssicherer Username-Login) | 2 | 3 |
| Testbarkeit mit `@nuxt/test-utils` | 4 | 4 (`auth.api.*` direkt aufrufbar, Memory-Adapter, `registerEndpoint` für Client) | 3 | 4 |
| Zukunftsfähigkeit (Passkeys / 2FA) | 3 (WebAuthn drin, aber `@simplewebauthn` v11 vs. 14; 2FA selbst) | 5 (`@better-auth/passkey`, `two-factor` auf `/sign-in/username`, `organization`) | 2 | 2 |
| Abhängigkeits-Fußabdruck | 4 (klein, aber `openid-client`/`jose` für 40 ungenutzte OAuth-Provider) | 2 (zod 4, kysely, better-call, 5 Adapter-Pakete, telemetry) | 3 | 5 |
| **Summe (max 45)** | **30** | **38** | **21** | **31** |

---

## 4. Empfehlung: **better-auth ≥ 1.7.3 (aktuell 1.7.4) weiterverwenden**, eigenes RBAC beibehalten

**Begründung:** Der Bestand *ist* bereits better-auth. Tabellen, Passwort-Hashes, Cookie-Präfix `tcm`, `APP_SECRET`, das Username-Plugin und das gesamte Guard-Modell wandern **ohne Datenmigration und ohne Passwort-Reset** nach Nuxt — sogar laufende Sessions bleiben gültig, wenn Secret und Cookie-Präfix beibehalten werden. Die harten Anforderungen (serverseitige Sessions mit Revoke, Rate-Limit, Enumeration-Schutz, spätere Passkeys/2FA) sind eingebaut und in der Doku verifiziert. nuxt-auth-utils wäre schlanker, verlangt aber genau für Revoke, Idle-Timeout, Rate-Limit und Hash-Kompatibilität Eigenbau, der im Ergebnis dem heutigen `hooks.server.ts` in Nuxt-Form entspricht — ohne die Vorteile. sidebase scheidet wegen offener Nuxt-4-Frage und fehlendem Serverkern aus.

**Bewusst nicht** übernehmen: das `admin`-Plugin als Permission-Modell (Rollen als CSV-String in `user.role`, Access-Control-Statements). Das bestehende Ein-Key-je-Modul-RBAC mit `roles`/`user_roles`/`role_permissions` bleibt; das `admin`-Plugin ist optional nur für `revokeUserSessions`/`listUserSessions`/Impersonation interessant (Kosten: 5 zusätzliche Spalten). Empfehlung: `active`-Flag + eigener Session-Delete wie heute.

### 4.1 Dateistruktur (Nuxt 4, `app/`-Verzeichnis, `shared/` für isomorphen Code)

```
shared/permissions.ts                 MODULE_PERMISSIONS, hasPermission, WILDCARD (1:1 aus src/lib/permissions.ts)
server/utils/auth.ts                  betterAuth({...}) — Instanz (Skizze unten)
server/utils/auth-permissions.ts      loadUserPermissions(userId) via Drizzle (1:1)
server/utils/auth-guards.ts           requireUser(event), requirePermission(event, key), requireAnyPermission(event, ...keys)
server/utils/auth-users.ts            createUserWithCredential, isUserActive, deleteUserSessions (1:1)
server/middleware/01.auth.ts          Session + active-Check + Permissions → event.context.auth (kein return!)
server/middleware/02.api-guard.ts     401 für nicht-öffentliche /api/* ohne Session (Pages regelt Route-Middleware)
server/api/auth/[...all].ts           auth.handler(toWebRequest(event))
server/api/me.get.ts                  { user, permissions } aus event.context.auth (für SSR-Hydration)
server/api/<modul>/*.ts               Handler beginnen mit requirePermission(event, '<modul>')
app/utils/auth-client.ts              createAuthClient({ plugins: [usernameClient()] }) aus 'better-auth/vue'
app/composables/useAuth.ts            useState('auth') + useRequestFetch()('/api/me'); user, permissions, can(), signIn(), signOut(), refresh()
app/plugins/01.auth.ts                universal, lädt /api/me einmal beim SSR (Vorbild: nuxt-auth-utils session.server.ts)
app/plugins/idle-logout.client.ts     Port von idle-logout.svelte.ts → authClient.signOut() + navigateTo('/login?reason=idle')
app/middleware/auth.global.ts         Whitelist (/login, /setup), Redirect mit redirectTo, optional definePageMeta({ permission })
types/h3.d.ts                         declare module 'h3' { interface H3EventContext { auth: AuthContext } }
```

### 4.2 `server/utils/auth.ts` (Skizze)

```ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter' // oder 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins'
import { APIError } from 'better-auth/api'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', usePlural: false,
    schema: { user: users, session: sessions, account: accounts, verification: verifications } }),
  secret: env.APP_SECRET,                       // unverändert → bestehende Cookies bleiben gültig
  baseURL: env.BETTER_AUTH_URL ?? env.ORIGIN,
  trustedOrigins: [env.ORIGIN],                 // CSRF-Origin-Check
  emailAndPassword: { enabled: true, disableSignUp: true, autoSignIn: false, minPasswordLength: 8, maxPasswordLength: 128 },
  emailVerification: { sendOnSignUp: false, autoSignInAfterVerification: false },
  plugins: [username({ minUsernameLength: 3, maxUsernameLength: 64 })],
  user: { additionalFields: { active: { type: 'boolean', required: false, defaultValue: true, input: false } } },
  databaseHooks: { session: { create: { before: async (session) => {
    if (!(await isUserActive(session.userId)))
      throw new APIError('FORBIDDEN', { message: 'Dieses Konto ist deaktiviert.' })
  } } } },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
  rateLimit: { enabled: true, window: 60, max: 100,
    customRules: { '/sign-in/username': { window: 60, max: 10 } }, // Plugin hat KEINE Default-Regel
    ipAddressHeaders: ['x-forwarded-for'] },
  advanced: { cookiePrefix: 'tcm', database: { joins: true } },
  telemetry: { enabled: false }
})
export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>
```

Der `session.create.before`-Hook ersetzt das heutige `blockDeactivatedSignIn`: Unbekannte Namen laufen weiter in `INVALID_USERNAME_OR_PASSWORD` (keine Enumeration); deaktivierte Konten bekommen 403 **bevor** eine Session entsteht (genau das Muster, das das `admin`-Plugin intern für Bans nutzt).

### 4.3 Permissions pro Request laden und cachen — `server/middleware/01.auth.ts`

```ts
export default defineEventHandler(async (event) => {
  if (isPublicPath(event.path)) return                 // /api/auth, /api/public, /api/ebay/account-deletion, /_nuxt, /login, /setup
  const s = await auth.api.getSession({ headers: event.headers }) // cookieCache aus → 1 Query (join user)
  if (s && s.user.active !== false) {
    event.context.auth = { session: s.session, user: s.user, permissions: await getPermissionsCached(s.user.id) }
  } else {
    event.context.auth = { session: null, user: null, permissions: new Set() }
  }
})
```

- **Request-Cache:** `event.context.auth` ist die einzige Wahrheit für die Dauer des Requests (entspricht `event.locals`). Alle Nitro-Handler und `server/api/me.get.ts` lesen nur daraus.
- **Prozess-Cache (optional):** `getPermissionsCached` = `Map<userId, { set, expires }>` mit 60 s TTL in `server/utils`, invalidiert durch `permissionsCache.delete(userId)`/`clear()` in den Rollen-Mutationen (`/settings/users`). Bei ~10 Nutzern ist auch der ungecachte Doppel-Select (heute: 2 Queries) unkritisch — Cache erst einführen, wenn gemessen.
- **Cookie-Cache bewusst aus** (oder `query: { disableCookieCache: true }` im Middleware): Sonst gilt die Doku-Warnung, dass widerrufene Sessions bis `maxAge` weiterleben. Für die Werkstatt ist ein DB-Read pro Request billiger als die Sicherheitslücke.

### 4.4 `requirePermission('x')` in Nitro-Handlern — `server/utils/auth-guards.ts`

```ts
export function requireUser(event: H3Event) {
  const u = event.context.auth?.user
  if (!u) throw createError({ statusCode: 401, statusMessage: 'Bitte melden Sie sich an.' })
  return u
}
export function requirePermission(event: H3Event, key: string) {
  const u = requireUser(event)
  if (!hasPermission(event.context.auth.permissions, key))
    throw createError({ statusCode: 403, statusMessage: 'Keine Berechtigung für diese Aktion.' })
  return u
}
export function requireAnyPermission(event: H3Event, ...keys: string[]) { /* analog, some() */ }

// server/api/customers/index.get.ts
export default defineEventHandler(async (event) => {
  requirePermission(event, 'customers')          // erste Anweisung, wie heute in jeder remote function
  return listCustomers(await getValidatedQuery(event, listSchema))
})
```

Unterschied zu heute: Der Guard bekommt `event` explizit (Nitro hat kein `getRequestEvent()`-Äquivalent ohne `experimental.asyncContext`). Die deutschen Fehlertexte laufen über `statusMessage` und werden in einem `server/plugins/error-handler.ts` bzw. `app/error.vue` genau wie heute in `handleError` kuratiert.

### 4.5 Admin deaktiviert Nutzer → Sitzung endet

```ts
// server/api/settings/users/[id]/deactivate.post.ts
requirePermission(event, 'users')
await db.update(users).set({ active: false }).where(eq(users.id, id))
await db.delete(sessions).where(eq(sessions.userId, id))     // = heutiges deleteUserSessions
// Alternative mit admin-Plugin: await auth.api.revokeUserSessions({ body: { userId: id }, headers: event.headers })
```

Wirkung: nächster Request des Betroffenen → `getSession` findet kein Session-Row → `event.context.auth.user = null` → 401 (API) bzw. Redirect (Route-Middleware). Sign-in bleibt durch den `session.create.before`-Hook gesperrt. Schutzregel „letzter `*`-Inhaber nicht deaktivierbar" bleibt Applikationslogik.

### 4.6 Idle-Logout und absolute Sitzungsdauer

| Ziel | Mechanismus |
|---|---|
| Idle (serverseitig) | better-auth ist gleitend: `expiresIn` = maximale Inaktivität, `updateAge` = Schreibintervall. Beispiel: `expiresIn: 8 h, updateAge: 15 min` → eine 8 h ungenutzte Session ist tot; jede Nutzung innerhalb 15 min nach dem letzten Refresh kostet keinen Write. Alternativ heutiges 7-d-Fenster beibehalten |
| Idle (UX, 60 min) | Port von `startIdleLogout` als `app/plugins/idle-logout.client.ts` (Events mousemove/keydown/click/scroll/touchstart) → `authClient.signOut()` + `navigateTo('/login?reason=idle')` |
| Absolut (z. B. 12 h) | **Nicht nativ** (better-auth kennt nur gleitend). Im Middleware 01.auth: `if (Date.now() - session.createdAt.getTime() > ABSOLUTE_MAX_MS) { await db.delete(sessions).where(eq(sessions.token, session.token)); event.context.auth = anonymous }`. Alternativ `databaseHooks.session.update.before` → `{ data: { expiresAt: min(expiresAt, createdAt + ABS) } }` (Feldverfügbarkeit im Hook nicht verifiziert, siehe unten) |
| Frische Aktionen | `session.freshAge` (Default 1 d) für sensible Endpunkte (Passwort setzen) — better-auth prüft es intern bei `changePassword`/`deleteUser` |

### 4.7 Migration der bestehenden Nutzer und Passwort-Hashes — Schritt für Schritt

1. **Version:** `better-auth` auf `^1.7.4` (nicht 1.7.0–1.7.2, wegen der temporären `issuer`-Spalte). `npx auth generate` gegen die Drizzle-Schema-Datei laufen lassen — für Credential + Username + `additionalFields.active` muss der Diff **leer** sein (alle Spalten existieren seit 0010/0027). Falls doch etwas erscheint, ist es ein Mapping-Fehler in `schema:` des Adapters, keine Datenmigration.
2. **Schema/Tabellen:** Drizzle-Definitionen für `users`, `sessions`, `accounts`, `verifications`, `roles`, `user_roles`, `role_permissions` unverändert übernehmen; Migrations-Historie (`drizzle/`) mitnehmen, `scripts/migrate.js`-Muster beibehalten.
3. **Passwort-Hashes:** `accounts.password` bleibt byte-identisch — 1.7.4 pinnt weiterhin `@better-auth/utils@0.4.2`, also exakt derselbe Hasher (1.1). **Kein Reset nötig.** `createUserWithCredential` weiter über `(await auth.$context).password.hash` hashen.
4. **Sessions/Cookies:** `secret` = `APP_SECRET`, `advanced.cookiePrefix: 'tcm'`, gleiche `baseURL`/Domain → bestehende `tcm.session_token`-Cookies und `sessions`-Rows werden nach dem Deploy weiter akzeptiert. Wer das nicht will: `DELETE FROM sessions` beim Cutover.
5. **Pipeline-Port:** `rateLimitSignIn` → `rateLimit.customRules['/sign-in/username']` (in-memory, Single-Replica wie heute; `storage: 'database'` bei Skalierung); `blockDeactivatedSignIn` → `databaseHooks.session.create.before`; `populateAuthLocals` → `server/middleware/01.auth.ts`; `requireAuthHandle` → `app/middleware/auth.global.ts` + `02.api-guard.ts`; die IP-Ermittlung (`x-forwarded-for` erster Eintrag) deckt `ipAddressHeaders` ab.
6. **Client:** `authClient.signIn.username({ username, password })` / `signOut()` aus `better-auth/vue` + `usernameClient()`; Login-Formular wie heute mit deutschem Fehlertext für `INVALID_USERNAME_OR_PASSWORD`, 403 „deaktiviert", 429 „zu viele Versuche".
7. **Doku:** `auth-and-permissions.md` („bcrypt" → scrypt, Pipeline-Reihenfolge), ADR-013 ergänzen („bestätigt für Nuxt-Rewrite").

### 4.8 Tests mit `@nuxt/test-utils` 4.3.2 (2026-09-07; Peer `vitest ^4 || ^5`, `@playwright/test ^1.43`)

- **Unit (Node-Umgebung, ohne Nuxt):** `auth-guards.test.ts` mit handgebautem `H3Event`-Stub (`{ context: { auth: { user, permissions: new Set(['customers']) } } }`) → 401/403/OK; `auth-permissions.test.ts` gegen `pg-mem` wie heute; Hash-Kompatibilität: Fixture-Hash aus der aktuellen DB (`salt:hex`) → `ctx.password.verify` muss `true` liefern (schützt Schritt 3).
- **Unit (Nuxt-Umgebung, `environment: 'nuxt'`):** Komponenten mit `mountSuspended`/`renderSuspended`; `useAuth` per `mockNuxtImport('useAuth', () => () => ({ user, permissions, can }))` oder realistischer `registerEndpoint('/api/me', () => ({ user, permissions: ['customers'] }))`, damit das Plugin/Composable echt läuft.
- **Integration/E2E (`setup({ server: true, build: true })`):** Login-Helfer
  ```ts
  export async function loginAs(username: string, password: string) {
    const res = await fetch('/api/auth/sign-in/username', { method: 'POST',
      headers: { 'content-type': 'application/json', origin: url('/') },   // trustedOrigins!
      body: JSON.stringify({ username, password }) })
    return res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
  }
  const cookie = await loginAs('admin', 'secret')
  await $fetch('/api/customers', { headers: { cookie } })                 // 200
  await expect($fetch('/api/settings/users', { headers: { cookie: mitarbeiterCookie } })).rejects.toMatchObject({ statusCode: 403 })
  ```
  Deaktivierungs-Test: Login → `deactivate` → derselbe Cookie liefert 401. Rate-Limit-Test: 11× Sign-in → 429 (Rate-Limit in Tests explizit `enabled: true`, da Default nur Production).
- **Browser-E2E:** `@nuxt/test-utils/playwright` (`goto('/login', { waitUntil: 'hydration' })`) gegen den Fixture-Dump `e2e/fixtures/seed.sql.gz` — die 55 bestehenden Specs lassen sich nach Selektor-Anpassung übernehmen. `scripts/e2e-smoke.mjs` bleibt als Smoke-Check.

### 4.9 Risiken

1. **Churn/Breaking Changes bei better-auth** — 1.7 hat innerhalb von drei Patch-Releases eine Spalte eingeführt und wieder entfernt; Major-Features (SCIM, MCP, DPoP) sind für uns Ballast. Gegenmaßnahme: exakte Pinnung (`1.7.4`, Renovate-Review), `npx auth generate`-Diff als CI-Check, Adapter-Import auf `@better-auth/drizzle-adapter` umstellen (Doku-Pfad).
2. **Abhängigkeits-Fußabdruck** (zod 4, kysely, 5 Adapter-Pakete, telemetry) — akzeptiert, weil bereits heute im Build; Telemetrie explizit deaktivieren.
3. **Cookie-Cache vs. Revoke** — bewusst aus; Kosten: 1 Query/Request.
4. **SSR-Muster** — `authClient.useSession(useFetch)` ist nicht dasselbe wie `event.locals`; die Empfehlung setzt deshalb auf ein eigenes `/api/me` + `useState` (deterministische Hydration, keine doppelte Session-Query). `useRequestFetch()` (Doku: leitet Request-Header bei SSR weiter, im Client = `$fetch`) ist Pflicht für jeden internen SSR-Call.
5. **Rate-Limiter in-memory** — wie heute Single-Replica-Annahme; bei Skalierung `storage: 'database'` (Tabelle `rateLimit`) oder Redis via `secondary-storage`.
6. **`===`-Hash-Vergleich** in `@better-auth/utils` (nicht constant-time) — theoretisches Timing-Risiko auf 128-stelligen Hex-Strings, gegen das das Rate-Limit praktisch schützt; Upstream-Issue beobachten.
7. **Drizzle 1.0** — better-auth-Peer erlaubt `>=1.0.0-rc.1`; Projekt bleibt auf 0.45.2 bis Drizzle 1.0 stable ist (Relations-v2-Adapter dann verfügbar).

### 4.10 Alternativen, falls die Empfehlung kippt

- **nuxt-auth-utils + eigene `sessions`-Tabelle + Dual-Verify-Shim** (wenn minimaler Fußabdruck wichtiger ist als eingebaute Sicherheit): Session-Cookie enthält nur `{ user: { id }, sessionId }`; `server/utils/session.ts` wrappt `requireUserSession` → DB-Lookup `sessions.id` + `users.active` → Revoke = Row löschen; Idle = eigenes `lastSeenAt` + `replaceUserSession`; Rate-Limit = Port von `rate-limit.ts`; Enumeration = Dummy-Hash bei unbekanntem Namen. **Hash-Shim:**
  ```ts
  async function verifyCredential(stored: string, plain: string) {
    if (stored.startsWith('$scrypt$')) return verifyPassword(stored, plain)          // adonis/PHC
    const [saltHex, keyHex] = stored.split(':')                                       // better-auth legacy
    const key = await scrypt(plain.normalize('NFKC'), saltHex, 64, { N: 16384, r: 16, p: 1, maxmem: 64 * 1024 * 1024 })
    const ok = timingSafeEqual(key, Buffer.from(keyHex, 'hex'))
    if (ok) await db.update(accounts).set({ password: await hashPassword(plain) })   // Rehash beim Login
    return ok
  }
  ```
  Alternativ Re-Kodierung in PHC (`$scrypt$n=16384,r=16,p=1$` + base64(ASCII-Bytes des Hex-Salts) + `$` + base64(Hash)) mit `runtimeConfig.hash.scrypt.maxMemory: 64*1024*1024`; `passwordNeedsRehash` würde wegen `r=16≠8` anschließend automatisch auf Default-Parameter rehashen. NFKC-Kante: adonis normalisiert nicht — für decomposed Unicode-Eingaben (selten, Browser liefern precomposed) schlägt die Verifikation fehl → daher Shim bevorzugen.
- **DIY nach Lucia-Leitfaden** mit h3 `useSession` als Cookie-Transport und derselben Shim-Logik — nur sinnvoll, wenn Fremdcode grundsätzlich vermieden werden soll.

---

## Quellen (abgerufen 2026-09-12)

**Repo (read-only):** `src/lib/server/auth.ts`, `auth-guards.ts`, `auth-users.ts`, `auth-permissions.ts`, `rate-limit.ts`, `src/lib/permissions.ts`, `src/hooks.server.ts`, `src/lib/stores/idle-logout.svelte.ts`, `drizzle/0010_auth_better_auth_and_rbac.sql`, `docs/architecture/auth-and-permissions.md`, `docs/decisions/adr-013-username-only-auth.md`, `package.json`, `node_modules/better-auth/package.json` (1.6.20), `node_modules/better-auth/dist/crypto/password.mjs`, `node_modules/.pnpm/@better-auth+utils@0.4.2/.../dist/password.mjs` + `password.node.mjs`

**npm-Registry:** https://registry.npmjs.org/nuxt-auth-utils · /better-auth · /better-auth/1.7.4 (exports) · /@sidebase%2Fnuxt-auth · /nuxt · /@nuxt%2Ftest-utils · /@better-auth%2Fnuxt (404) · /@better-auth%2Futils · /@better-auth%2Fdrizzle-adapter/1.7.4 · /@better-auth%2Fpasskey · /@nuxt%2Fnitro-server/4.5.2 · /nitropack · /h3 · /iron-webcrypto · /nuxt-oidc-auth · /@auth%2Fcore · /@adonisjs%2Fhash · /@noble%2Fhashes · /@simplewebauthn%2Fserver · /drizzle-orm · /nuxt-better-auth · /nuxt-authorization · Suche `-/v1/search?text=nuxt better-auth`

**GitHub-API:** `repos/atinux/nuxt-auth-utils`, `repos/better-auth/better-auth`, `repos/sidebase/nuxt-auth`, `repos/itpropro/nuxt-oidc-auth`, `repos/nuxt/nuxt`, `repos/nuxt/test-utils` (+ `/releases`); `search/issues` (offene Issues ohne PRs); Issues `atinux/nuxt-auth-utils#68`, `#203`, `sidebase/nuxt-auth#1043`

**Quellcode:** https://raw.githubusercontent.com/atinux/nuxt-auth-utils/main/{README.md, src/module.ts, src/runtime/server/utils/session.ts, src/runtime/server/utils/password.ts, src/runtime/server/api/session.get.ts, src/runtime/app/plugins/session.server.ts, src/runtime/app/composables/session.ts, package.json} · https://raw.githubusercontent.com/h3js/h3/v1/src/utils/session.ts · https://raw.githubusercontent.com/adonisjs/hash/develop/src/drivers/scrypt.ts · https://raw.githubusercontent.com/better-auth/better-auth/v1.7.4/packages/{better-auth/src/crypto/password.ts, better-auth/src/plugins/username/index.ts, better-auth/src/plugins/admin/admin.ts, better-auth/src/plugins/custom-session/index.ts, core/src/types/init-options.ts} · https://raw.githubusercontent.com/better-auth/utils/main/src/password.ts · https://raw.githubusercontent.com/sidebase/nuxt-auth/main/README.md

**Doku:** https://www.better-auth.com/docs/integrations/nuxt · /docs/concepts/session-management · /docs/plugins/admin · /docs/concepts/rate-limit · /docs/concepts/database · /docs/concepts/hooks · /docs/adapters/drizzle · /docs/plugins/passkey · /docs/plugins/2fa · /docs/reference/telemetry · /docs/guides/1-7-upgrade-guide · https://better-auth.com/blog/1-7 · https://github.com/better-auth/better-auth/releases/tag/v1.7.0 · https://auth.sidebase.io/guide/local/quick-start · /guide/authjs/quick-start · /guide/application-side/protecting-pages · https://nuxt.com/docs/4.x/getting-started/testing · /docs/4.x/guide/directory-structure/server · /docs/4.x/guide/directory-structure/app/middleware · /docs/4.x/api/composables/use-request-fetch · https://lucia-auth.com/

## Nicht verifiziert

- Ob `databaseHooks.session.update.before` in 1.7.4 `createdAt` im Payload liefert (für die Hook-Variante der absoluten Sitzungsdauer); die Middleware-Variante hängt nicht davon ab.
- Exakte Anzahl/Namen der Spalten, die `npx auth generate` für dieses Schema ausgibt — Erwartung „leerer Diff" ist aus Doku + Migration 0010/0027 abgeleitet, nicht ausgeführt.
- `@sidebase/nuxt-auth`: Default von `httpOnlyCookieAttribute` im `local`-Provider und tatsächlicher Laufzeitstand unter Nuxt 4.5 (Issue #1043 widersprüchlich).
- Ob better-auth 1.7.4 `event.headers` (h3 1.15 `H3Event.headers`) in jedem Nitro-Preset korrekt liest — Doku-Beispiel nutzt es; Node-Preset ist unser Ziel.
- Verhalten des better-auth-Rate-Limiters hinter dem Pod-Ingress bezüglich `trustedProxies` (heute: erster `x-forwarded-for`-Eintrag ohne Proxy-Whitelist).
- Performance des `advanced.database.joins: true`-Pfads mit `pg-mem` in Tests (heute läuft der Adapter ohne Joins).
- Lucia-Leitfaden-Details (SHA-256-Token, Sliding-Window) nur aus Vorwissen; die Startseite bestätigt lediglich Deprecation (März 2025) und Single-File-Referenz.
