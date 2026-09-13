---
title: Inventar Setup & Einstellungen (SET)
teil_von: docs/rewrite/01-inventar.md
stand: Bestand (SvelteKit) vor dem Rewrite
---

> **Detail-Inventar des Bestands.** Erhoben durch vollständiges Lesen der in
> Abschnitt „Gelesene Dateien" genannten Dateien. Die IDs wurden auf die
> globalen IDs aus [01-inventar.md](../01-inventar.md) umgestellt
> (76 IDs). Zurück: [01-inventar.md](../01-inventar.md) ·
> [02-befunde.md](../02-befunde.md)

# Modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise, Settings-Shell   (Kürzel: SET)

Sprache: Deutsch für Fließtext/Tabellen; Code-Bezeichner, Dateipfade, Tabellen-/Spaltennamen bleiben englisch und exakt wie im Code.
Alles stammt aus dem tatsächlich gelesenen Code. Fundstellen als `pfad/datei.ts:zeile`.

Abgrenzung (nur Verweise, keine eigenen Feature-IDs): Benutzer/Rollen/Konto → AUTH (`/settings/users`, `/settings/account`), Mail-Vorlagen/SMTP/Zahlungserinnerungs-Einstellungen → MAIL (`/settings/mail`, `/settings/smtp`, `/settings/reminders`, `SmtpTestSend.svelte`), eBay/Import → EXT (`/settings/ebay`, `/settings/import`), Anfragen → PUB (`/settings/inquiries`), Reifen-Erinnerungen → ITEM (`/settings/tire-reminders`), Werkstatt-Öffnungszeiten → EMP (`/settings/workshop-hours`, `workshop-hours-service.ts`; hier nur der Wizard-Schritt 6).

---

## 1. Routen und Seiten

| Route | Datei | Parameter | Guard / Permission | Layout | Datenabhängigkeiten (Remote-Queries, Reihenfolge) | Zweck |
|---|---|---|---|---|---|---|
| `/setup` | `src/routes/setup/+page.svelte` (1148 Z.) | keine (kein `?step=`) | **öffentlich** (Whitelist `hooks.server.ts:61-72` enthält `/setup`); serverseitig nur `refuseAfterSetup()` in den Remotes | Root-Layout rendert bei `isSetupRoute` bare `<div class="min-h-dvh">` ohne AppShell (`src/routes/+layout.svelte:78-81`) | 1. Root: `getLayoutContext()` + `getCurrentUserRemote()` (`+layout.svelte:20-21`); 2. Seite: Top-Level `await listWorkshopHoursForSetup()` (`setup/+page.svelte:92`) — wirft 403 nach Abschluss → `+error.svelte` | 8-stufiger First-Run-Wizard (nicht 6 wie in CLAUDE.md/README, siehe B-117) |
| `/settings` (Layout) | `src/routes/settings/+layout.svelte` (118 Z.) | — | authentifiziert (hooks); Tabs permission-gefiltert; kein eigener Guard | AppShell → Settings-Layout: eine `TabGroup` im Nav-Modus (`name="settings_nav_tabs"`) über 11 Tabs | Top-Level `await getCurrentUserRemote()` (`+layout.svelte:18`) | Settings-Shell; Tabs (id → href → permission): `general`→`/settings` (`settings`, `exact`), `mail`→`/settings/mail` (`settings`), `reminders`→`/settings/reminders` (`settings`), `smtp`→`/settings/smtp` (`settings`), `users`→`/settings/users` (`users`), `workshop-hours`→`/settings/workshop-hours` (`settings`), `tire-reminders`→`/settings/tire-reminders` (`settings`), `inquiries`→`/settings/inquiries` (`mailings`), `ebay`→`/settings/ebay` (`settings`), `import`→`/settings/import` (`import`), `account`→`/settings/account` (`null` = immer) (`+layout.svelte:25-93`). Tab-Leiste nur wenn `visibleTabs.length > 1 && hasActiveTab`, sonst Children bare (`:110-118`) |
| `/settings` (Allgemein) | `src/routes/settings/+page.svelte` (486 Z.) | Legacy `?tab=mail|reminders|smtp` → `goto('/settings/<tab>', {replaceState:true})` im `$effect` (`:36-45`); andere `?tab=`-Werte werden ignoriert | `requirePermission('settings')` in allen genutzten Remotes | AppShell + Settings-Tab `Allgemein` | `getAllSettingsRemote()` als `$derived.by(... .current)` **ohne** Top-Level-await (`:50`); `getLaborRateSettingRemote()` ebenso (`:135`); Fehler nur per `$effect` → `handleClientError` (`:52-55`, `:137-140`) | Firmenstammdaten-Formular, Logo-Uploader, PDF-Endtext, Stundensatz, Link-Karte Reifenwechsel-Erinnerungen |
| `/` und alle Nicht-Setup-Routen (Gate) | `src/routes/+layout.svelte:23-30` | — | — | — | `getLayoutContext()` liefert `setupCompleted` | Client-`$effect`: `if (!data.setupCompleted && !isSetupRoute) goto('/setup')` — **nur im Browser** (`typeof window`-Check), kein Server-Redirect |
| Sidebar | `src/lib/components/layout/navigation.ts:236-243` | — | Eintrag „Einstellungen" mit `permission: 'settings'`, Gruppe System; „Anfragen" (`/settings/inquiries`) in Gruppe Kommunikation (`:224-227`) | — | — | Navigation |

Redirects/Deep-Links:
- Frische Installation: `/` → hooks `requireAuthHandle` → `303 /login?redirectTo=%2F` (`hooks.server.ts:221-229`) → Login-Seite rendert (Root-Layout bare wegen `!data.setupCompleted`) → Client-`$effect` `goto('/setup')`. Bekannter Flash (`docs/modules/setup.md:32-33`).
- Setup-Abschluss: `window.location.href = '/login'` (Full-Load, `setup/+page.svelte:321`).
- Login danach: `window.location.href = redirectTo` (same-origin Guard, `src/routes/login/+page.svelte:101-105`).
- `/setup` nach Abschluss: Seite wirft 403 aus `listWorkshopHoursForSetup` → `+error.svelte` mit Headline „Zugriff nicht erlaubt" + Detail „Setup ist bereits abgeschlossen. Bitte die regulären Einstellungen verwenden." (`src/routes/+error.svelte:22-40`).

---

## 2. Remote Functions und Endpoints

### 2.1 `src/routes/setup/setup.remote.ts` (350 Z.) — alle anonym erreichbar (Whitelist `/_app` in hooks, keine `requireUser`)

- **`getSetupStatus`** — query (ohne Schema) — `setup.remote.ts:101-104`
  - Guard: keiner
  - Rückgabe: `{ setupCompleted: boolean }`
  - Nebenwirkungen: `getSettings()` legt Singleton-Zeile lazy an
  - Verwendung: **nirgends** außer `completeSetup` → `void getSetupStatus().refresh()` (`:349`) — toter Code (B-144)

- **`saveCompanyData`** — command(`companyDataSchema`) — `setup.remote.ts:112-143`
  - Guard: `refuseAfterSetup()` (`:116`; 403 wenn `setupCompleted`)
  - Argumente (`companyDataSchema` `:52-82`):

    | Feld | Schema | Pflicht | Regel / deutsche Meldung |
    |---|---|---|---|
    | `companyName` | `nameSchema` | ja | trim, 1..100 „Der Name darf nicht leer sein." / „Der Name darf maximal 100 Zeichen lang sein." (**Input erlaubt 200**, B-124) |
    | `owner` | `optional(pipe(string(), trim(), maxLength(200)))` | nein | **ohne deutsche Meldung** |
    | `street` | `addressLineSchema` | ja (Key), Wert darf leer sein | max 200 „Die Anschrift darf maximal 200 Zeichen lang sein." |
    | `zip` | `zipSchema` | ja (Key) | max 10 „Die PLZ darf maximal 10 Zeichen lang sein." — kein Format |
    | `city` | `citySchema` | ja (Key) | max 150 |
    | `state` | `pipe(string(), trim(), maxLength(50,'Bundesland zu lang'))` | ja (Key) | keine Picklist-Prüfung |
    | `phone` | `phoneSchema` | ja (Key), leer erlaubt | max 30 |
    | `mobile`, `fax` | `optional(phoneSchema)` | nein | `fax` hat **kein UI-Feld** |
    | `email` | `emailSchema` | ja | max 254 + `email()` „Bitte geben Sie eine gültige E-Mail-Adresse ein." |
    | `website` | `optional(urlSchema)` | nein | max 2048, kein URL-Format |
    | `vatId` | `optional(pipe(string(), trim(), maxLength(30)))` | nein | keine USt-IdNr-Prüfung, keine dt. Meldung |
    | `taxNumber` | string/trim/minLength(1)/maxLength(30) | **ja** | „Bitte die Steuernummer angeben." / „Steuernummer zu lang." |
    | `bankName` | string/trim/minLength(1)/maxLength(100) | **ja** | „Bitte den Bank-Namen angeben." / „Bank-Name zu lang." |
    | `iban` | `ibanSchema` | ja (Key), leer erlaubt | normalize + mod-97 (s. §3 validation) |
    | `bic` | `bicSchema` | ja (Key), leer erlaubt | ISO-9362-Form |
    | `salutationStyle` | `picklist(['Sie','Du'])` | ja | ohne dt. Meldung |
    | `logoMime` | `optional(pipe(string(), maxLength(50)))` | nein | kein MIME-Check |
    | `logoData` | `optional(pipe(string(), maxLength(7_000_000)))` | nein | Data-URL ≤ 7 Mio Zeichen |
  - Rückgabe: `void` (JSDoc sagt „Returns the saved row id" — falsch)
  - Fehler: 403 „Setup ist bereits abgeschlossen. Bitte die regulären Einstellungen verwenden."; Valibot → `handleValidationError`
  - Nebenwirkungen: `UPDATE company_settings SET … , updatedAt` auf Zeile aus `getSettings()`; **überschreibt `logoMime/logoData` mit `null`** wenn nicht gesendet (`:137-141`); kein refresh
  - Transaktion: nein

- **`saveSmtp`** — command(`smtpSchema` `:84-93`) — `setup.remote.ts:153-172` (→ MAIL für Semantik; hier nur Wizard-Nutzung)
  - Guard: `refuseAfterSetup()`
  - Argumente: `host` string/trim/max255, `port` **string**/trim/max5, `secure` picklist none|STARTTLS|TLS, `username` max200, `password` max200 (kein trim), `fromAddress` `emailSchema`, `fromName` max200, `replyTo` `optionalEmailSchema` — alle außer E-Mail **ohne deutsche Meldung**
  - Fehler: 400 „Ungültiger SMTP-Port." wenn `Number(port)` nicht int 1..65535 (`:158-161`); 403 s. o.
  - Nebenwirkungen: `upsertSmtpSettings(...)` (AES-256-GCM, `verified=false`) (`smtp-settings-service.ts:37-76`)
  - Transaktion: nein

- **`createInitialAdmin`** — command(`adminSchema` `:174-196`) — `setup.remote.ts:207-234`
  - Guard: **kein** `refuseAfterSetup`; nur „keine `users`-Zeile vorhanden" (`:210-213`)
  - Argumente: `username` trim, minLength 3 „Benutzername zu kurz (mind. 3 Zeichen).", maxLength 64 „Benutzername zu lang.", regex `^[a-zA-Z0-9_.]+$` „Benutzername darf nur Buchstaben, Ziffern, Punkt und Unterstrich enthalten."; `name` trim, 1..200 „Anzeigename darf nicht leer sein." / „Anzeigename zu lang."; `password` 8..128 „Passwort zu kurz (mind. 8 Zeichen)." / „Passwort zu lang."
  - Fehler: 409 „Es existiert bereits ein Benutzerkonto."; 500 „Standard-Rolle „Administrator" fehlt."
  - Nebenwirkungen: `createUserWithCredential` (`src/lib/server/auth-users.ts:50-90`: username lower-case-normalisiert, `displayUsername` = getrimmte Eingabe, `email = <username>@twincars.local`, Passwort-Hash via better-auth `ctx.password.hash`, Insert `users` + `accounts` providerId `credential`), danach `INSERT user_roles (userId, roleId Administrator) ON CONFLICT DO NOTHING`
  - Transaktion: **nein** (User kann ohne Rolle zurückbleiben, B-142)

- **`listWorkshopHoursForSetup`** — query — `setup.remote.ts:294-297` (EMP-Service)
  - Guard: `refuseAfterSetup()`
  - Rückgabe: 7 `WorkshopHour`-Zeilen (`weekday 0..6`, `opensAt/closesAt` `HH:MM`, `closed`, `updatedAt`), fehlende Wochentage werden lazy angelegt (`workshop-hours-service.ts:46-66`)

- **`saveWorkshopHoursForSetup`** — command(`setupWorkshopHoursSchema` `:246-274`) — `setup.remote.ts:307-321`
  - Guard: `refuseAfterSetup()`
  - Argumente: `rows: array({ weekday: number 0..6 „Wochentag muss zwischen 0 und 6 liegen." + integer „Wochentag muss ganzzahlig sein.", opensAt/closesAt: string „Bitte eine Uhrzeit eingeben." + trim + regex HH:MM „Bitte eine gültige Uhrzeit im Format HH:MM eingeben.", closed: boolean })`
  - Nebenwirkungen: pro Zeile `updateWorkshopHours(weekday, …)` sequentiell (`workshop-hours-service.ts:78-100`); **kein** `opensAt < closesAt`-Check serverseitig, keine Vollständigkeits-/Duplikatsprüfung (B-143)
  - Transaktion: nein

- **`completeSetup`** — command (ohne Schema) — `setup.remote.ts:330-350`
  - Guard: `refuseAfterSetup()`
  - Fehler: 400 „Bitte zuerst ein Administrator-Konto anlegen." (keine `users`-Zeile, `:332-335`); 400 „Bitte zuerst die Firmendaten vollständig ausfüllen." wenn `companyName|street|city|email` leer (`:336-344`) — `zip`, `phone`, `taxNumber`, Bank werden **nicht** geprüft
  - Nebenwirkungen: `UPDATE company_settings SET setup_completed=true, updated_at`; `void getSetupStatus().refresh()`; **kein Seeding** (Seeds laufen in hooks, s. §7)
  - Transaktion: nein

- Hilfsfunktion **`refuseAfterSetup`** (`:276-284`): `getSettings()` → `error(403, 'Setup ist bereits abgeschlossen. Bitte die regulären Einstellungen verwenden.')`.

### 2.2 `src/routes/settings/settings.remote.ts` (450 Z.) — alle Funktionen

| Name | Art | Zeile | Guard | Modul |
|---|---|---|---|---|
| `getAllSettingsRemote` | query | 111-136 | `requirePermission('settings')` | **SET** (vollständig unten) |
| `updateCompanyRemote` | command(`companyDataSchema`) | 141-174 | `settings` | **SET** |
| `updateReminderSettingsRemote` | command(`reminderSettingsSchema` 71-86) | 182-199 | `settings` | MAIL — schreibt `reminderAutoEnabled`, `smallBusinessExempt`, `reminderDays1` (0..365), `reminderRecurEveryDays` (1..365) in `company_settings`; ein Satz: §19-Flag wird hier (Tab „Zahlungserinnerung") gepflegt, nicht auf „Allgemein" (B-119/17) |
| `getLaborRateSettingRemote` | query | 213-216 | `settings` | **SET** |
| `updateLaborRateRemote` | command(`{priceNet: moneySchema}`) | 226-244 | `settings` | **SET** |
| `updateLogoRemote` | command(`logoSchema` 250-255) | 265-277 | `settings` | **SET** |
| `removeLogoRemote` | command | 285-293 | `settings` | **SET** |
| `listMailTemplatesRemote` | query | 305-318 | `settings` | MAIL — listet `mail_templates` nach `key` |
| `updateMailTemplateRemote` | command(`mailTemplateUpdateSchema` 320-324) | 333-349 | `settings` | MAIL — setzt `isCustom=true`; 404 „Mailvorlage „<key>" wurde nicht gefunden." |
| `resetMailTemplateRemote` | command(`{key}`) | 359-376 | `settings` | MAIL — stellt Default aus `defaultMailTemplates` her; 404 „Standardvorlage für „<key>" nicht hinterlegt." |
| `updateSmtpRemote` | command(`smtpUpdateSchema` 88-97) | 382-400 | `settings` | MAIL — `port: number()`, leeres Passwort = behalten; 400 „Ungültiger SMTP-Port." |
| `sendSmtpTestMailRemote` | command(`{recipient: emailSchema}`) | 428-450 | `settings` | MAIL — modulweiter In-Flight-Guard + 5 s Cooldown → 429 „Ein Testversand läuft bereits oder wurde soeben gestartet. Bitte warten Sie einen Moment." |

Details der SET-Funktionen:

- **`getAllSettingsRemote`** — `settings.remote.ts:111-136`
  - Rückgabe: `{ company: CompanySettings (komplette Zeile inkl. `logoData`, `geoLat/Lon`, `laborItemId`, reminder-Felder), smtp: { host, port, secure, username, hasPassword: boolean, fromAddress, fromName, replyTo, verified } | null }` — SMTP-Passwort verlässt den Server nie (`:125-128`)
  - DB: `getSettings()` + `SELECT * FROM smtp_settings LIMIT 1` parallel (`Promise.all`)
  - Anmerkung: das Logo (bis ~7 MB Data-URL) reist in **jedem** Aufruf mit — auch für die SMTP-/Reminders-Seiten, die dieselbe Query nutzen (B-129)

- **`updateCompanyRemote`** — command(`companyDataSchema` `:42-63`) — `settings.remote.ts:141-174`
  - Argumente wie im Setup, aber: `taxNumber`/`bankName` **optional** (`:55-56`), `iban`/`bic` `optional(...)`, `state` maxLength(50) **ohne Meldung**, zusätzlich `defaultPaymentTermDays: optional(number())`, `defaultVatRate: optional(number())` (**ohne Grenzen**, UI sendet sie nie), `pdfFooter: optional(pipe(string(), trim(), maxLength(10000)))`; **kein** `logoMime/logoData` (Logo separat)
  - Nebenwirkungen: UPDATE aller Felder; `defaultPaymentTermDays ?? settings.…`; `defaultVatRate ? String(...) : settings.defaultVatRate` (0 wird als falsy ignoriert, B-132); `pdfFooter ?? ''`; `void getAllSettingsRemote().refresh()`
  - Transaktion: nein

- **`getLaborRateSettingRemote`** — `settings.remote.ts:213-216` → `getLaborRate()` (`work-order-service.ts:974-989`): `{ itemId, articleNumber, unitPriceNet: string|null } | null` (null wenn `laborItemId` NULL oder Item fehlt)

- **`updateLaborRateRemote`** — `settings.remote.ts:226-244`
  - Argumente: `priceNet: moneySchema` (number „Bitte geben Sie einen Betrag ein.", ±1e9)
  - Fehler: 400 „Der Stundensatz muss größer als 0 sein."; 409 „Es ist kein Arbeitszeit-Artikel hinterlegt."
  - Nebenwirkungen: `upsertItemPrice({ itemId, validFrom: heute (ISO), unitPriceNet: toFixed(2) })` (`item-service.ts:183-213`: gleiches Datum → UPDATE, sonst INSERT neue Preisversion); `void getLaborRateSettingRemote().refresh()`

- **`updateLogoRemote`** — `settings.remote.ts:265-277`
  - Argumente: `logoMime` trim/max50, `logoData` max 7_000_000 — **kein** MIME-/Inhalts-Check (B-128); ohne dt. Meldungen
  - Nebenwirkungen: UPDATE `logo_mime`, `logo_data`, `updated_at`; `void getAllSettingsRemote().refresh()`

- **`removeLogoRemote`** — `settings.remote.ts:285-293`: setzt beide Logo-Spalten auf `null`; refresh wie oben.

### 2.3 `src/routes/layout.remote.ts` (47 Z.)
- **`getLayoutContext`** — query — `:18-24` — kein Guard — `{ setupCompleted, companyName: s.companyName || 'TwinCarsManager' }` — treibt Setup-Gate + Sidebar-Header.
- **`getCurrentUserRemote`** — query — `:37-47` — `null` für anonym; `{ id, username, name, permissions[] }` — Settings-Layout filtert Tabs damit.

### 2.4 HTTP-Endpunkte
Keine im Modul. Relevanter Konsument: `GET /api/public/company` (`src/routes/api/public/company/endpoint.ts:55-89`) liest `getSettings()` + `listWorkshopHours()` und exponiert `legalName/brandName = companyName`, Adresse, Kontakt, `geo` (nur wenn `geoLat` und `geoLon` gesetzt), Öffnungszeiten (→ PUB).

---

## 3. Services (Server-Layer)

### 3.1 `src/lib/server/services/settings-service.ts` (14 Z.)
- **`getSettings(): Promise<CompanySettings>`** (`:7-14`) — `SELECT * FROM company_settings LIMIT 1` (**ohne ORDER BY**); bei 0 Zeilen `INSERT … VALUES ({}) RETURNING`. Kein Cache, kein Lock: select-then-insert-Race kann zwei Zeilen erzeugen (B-139). Wird von praktisch jedem Modul pro Request aufgerufen (Layout, PDFs, Mail, Public API).

### 3.2 `src/lib/server/services/number-range-service.ts` (122 Z.)
- **`allocateNumber(kind: string): Promise<string>`** (`:102-122`)
  - `bumpCounter(kind)` (`:68-88`): **ein** atomares `UPDATE number_ranges SET next_value = next_value + 1 WHERE kind = $1 RETURNING next_value, format_template`; vergebene Sequenz = `next_value − 1`. Postgres-Row-Lock innerhalb des Statements → keine Duplikate unter Konkurrenz; bewusst **keine** Transaktion / `FOR UPDATE` (pg-proxy-Testtreiber unterstützt `transaction()` nicht, JSDoc `:22-31`).
  - Fehlt die Zeile: `INSERT … ON CONFLICT (kind) DO NOTHING` mit `DEFAULT_TEMPLATES[kind] ?? '{N}'` (`:47-61`, enthält zusätzlich `tire: '{N}'`), dann erneuter Bump; wenn wieder `null` → `throw new Error('number range allocation failed for kind "…"')` (500).
  - Rendering über `renderNumber(template, seq)` (`src/lib/utils/numbering.ts:12-26`): Platzhalter `{YYYY}`, `{YY}`, `{MM}`, `{N…}` (Zero-Padding auf Anzahl der N). **Kein Jahreswechsel-Reset** — Zähler läuft über Jahre weiter (B-136).
  - Konsumenten: `document-service.ts:180-182` (`nextDocumentNumber`), `numberKindFor` (`:228-235`: invoice/offer/cost_estimate/order_confirmation/reminder, sonst `invoice`), Storno `:451` (`'storno'`), `customer-service.ts:126` (`'customer'`), `tire-service.ts:147` (`'tire'`), `tire-storage-service.ts:151` (`'tire_storage'`), `work-order-service.ts:523,600` (`'work_order'`), `reminder-service.ts:111` (`'reminder'`).
  - Allokation und anschließender Beleg-INSERT sind **nicht** in einer Transaktion → Nummernlücke bei Insert-Fehler (B-138).
  - Nachträgliche Anpassung nur durch den MDB-Import: `import-service.ts:1490-1522` setzt `next_value = legacyMax+1`, `format_template='{N}'` für `customer`, `invoice`, `offer`, `cost_estimate`, `order_confirmation` (→ EXT). **Keine Admin-UI** (B-135).

### 3.3 `src/lib/server/services/smtp-settings-service.ts` (76 Z.) — nur Setup-Verwendung
- **`upsertSmtpSettings(input: SmtpSettingsInput): Promise<void>`** (`:37-76`): `SELECT … LIMIT 1`; Insert-Pfad speichert `encryptSecret(password)` bzw. `''`; Update-Pfad behält gespeicherte Chiffre bei leerem Passwort; setzt immer `verified=false`, `updatedAt`. Im Wizard immer mit Klartext-Passwort aufgerufen (Schritt 5 verlangt Passwort). → MAIL.

### 3.4 `src/lib/server/db/seed-defaults.ts` (376 Z.)
- **`seedDefaults()`** (`:197-236`) — idempotent, sequentielle Einzel-Statements, keine Transaktion:
  1. `company_settings`: wenn leer → INSERT `{ pdfFooter: defaultPdfFooter }` (`:198-201`; Text `:190-191`: „Vielen Dank für Ihren Auftrag. Es gelten unsere allgemeinen Geschäftsbedingungen.\nZahlbar innerhalb des angegebenen Zahlungsziels ohne Abzug.")
  2. `smtp_settings`: wenn leer → INSERT `{}` (Defaults host `''`, port 587, STARTTLS) (`:203-206`)
  3. `number_ranges` (9 kinds, `ON CONFLICT (kind) DO NOTHING`) (`:208-213`)
  4. `mail_templates` (8, `ON CONFLICT (key)`) (`:215-220`)
  5. `ledger_categories` (13, `ON CONFLICT (name)`) (`:222-227`)
  6. `seedDefaultRoles()` (`:328-357`), `seedDefaultWorkshopHours()` (`:290-311`), `seedLaborItem()` (`:249-281`)
- **`seedLaborItem()`**: Item `articleNumber='ARBEIT'`, `description='Arbeitszeit'`, `kind='service'`, `unit='Std.'` + Preisversion `0` (nur bei Neuanlage); `company_settings.labor_item_id` nur gesetzt, wenn NULL. Liest `company_settings LIMIT 1`.
- **`ensureRole(name, description, permissions)`** (`:359-376`): select-or-insert Rolle, dann pro Permission `INSERT role_permissions ON CONFLICT DO NOTHING`.
- Trigger: `src/hooks.server.ts:41-53` `ensureSeeded()` — einmal pro Prozess vor der ersten Anfrage; `seedPromise` wird bei Fehler **nicht** zurückgesetzt (B-140). Migrationen laufen separat (`scripts/migrate.js`).

Seed-Tabellen:

**Nummernkreise** (`seed-defaults.ts:157-172`, alle `next_value = 1`):

| kind | format_template | Herkunft | Konsument |
|---|---|---|---|
| `invoice` | `{N}` | Seed | Rechnungen (Legacy-Anschluss, z. B. 19087) |
| `offer` | `{N}` | Seed | Angebote |
| `cost_estimate` | `{N}` | Seed | Kostenvoranschläge |
| `order_confirmation` | `{N}` | Seed | Auftragsbestätigungen |
| `reminder` | `ZE-{YYYY}-{NNNN}` | Seed (Migration 0024 benennt `MA-…` um) | Zahlungserinnerungen |
| `customer` | `{N}` | Seed | Kundennummern |
| `tire_storage` | `L-{YYYY}-{NNNN}` | Seed | Reifeneinlagerung |
| `work_order` | `AU-{YYYY}-{NNNN}` | Seed + Migration 0033:223 | Aufträge |
| `storno` | `S-{N}` | Seed + Migration 0020:65 | Storno-Rechnungen |
| `tire` | `{N}` | **nur** Migration 0022:138 + `DEFAULT_TEMPLATES` (`number-range-service.ts:54`) — fehlt im Seed | Reifen-Artikelnummern |

**Mail-Vorlagen** (`seed-defaults.ts:20-147`, `isCustom=false`; Inhalte → MAIL):

| key | subject |
|---|---|
| `invoice` | Ihre Rechnung {rechnungNummer} vom {rechnungDatum} |
| `cost_estimate` | Ihr Kostenvoranschlag {angebotNummer} - {fahrzeugKennzeichen} |
| `offer` | Unser Angebot {angebotNummer} |
| `order_confirmation` | Auftragsbestätigung {angebotNummer} |
| `reminder_1` | Freundliche Zahlungserinnerung zu Rechnung {rechnungNummer} |
| `tire_reminder` | Termin für den Reifenwechsel buchen - {firma} |
| `appointment_confirmation` | Ihre Terminbestätigung bei {firma} |
| `mailing` | Information von {firma} |

**Ledger-Kategorien** (`seed-defaults.ts:174-188`, `default_tax_rate` NULL):

| direction | name |
|---|---|
| income | Werkstatterlöse, Fahrzeugverkauf, Sonstige Einnahmen |
| expense | Material, Werkzeug, Miete, Strom, Internet, Reisekosten, Lohnaufwand, Fahrzeug-Einkauf, Inzahlungnahme, Sonstiges |

**Rollen** (`seed-defaults.ts:328-357`, `MODULE_PERMISSIONS` aus `src/lib/permissions.ts:27-48`):

| Rolle | description | Permissions |
|---|---|---|
| Administrator | Voller Zugriff auf alle Module. | `*` |
| Werkstattleiter | Vollzugriff auf alle Module außer Einstellungen / Benutzer. | alle Keys aus `MODULE_PERMISSIONS` außer `settings`, `users`: customers, vehicles, suppliers, employees, items, offers, invoices, orders, reminders, ledger, calendar, inventory, hours, hours:write_own, mailings, import, tires, posts |
| Mitarbeiter | Operativer Zugriff auf die wichtigsten Module; Stunden nur für sich selbst. | customers, vehicles, suppliers, items, offers, invoices, orders, reminders, calendar, inventory, tires, hours:write_own |

**Öffnungszeiten** (`seed-defaults.ts:290-311`): weekday 0 (So) und 6 (Sa) `closed=true`, 1–5 `08:00–17:00` offen; alle Zeilen `opensAt='08:00'`, `closesAt='17:00'`.

**Arbeitszeit-Artikel**: `ARBEIT` / „Arbeitszeit" / service / „Std." / Preis `0` ab heute; `company_settings.labor_item_id` verlinkt.

### 3.5 Validierungsschemas `src/lib/server/db/validation.ts` (315 Z.) — vollständig

| Export | Zeile | Pipe / Regel | Deutsche Meldung(en) |
|---|---|---|---|
| `idSchema` | 28 | string, minLength 1, maxLength 64, trim | **keine** |
| `nameSchema` | 30-35 | string, trim, minLength 1, maxLength 100 | „Bitte geben Sie einen Namen ein." / „Der Name darf nicht leer sein." / „Der Name darf maximal 100 Zeichen lang sein." |
| `optionalNameSchema` | 37-41 | string, trim, maxLength 100 | „Der Name darf maximal 100 Zeichen lang sein." |
| `addressLineSchema` | 43-47 | string, trim, maxLength 200 | „Die Anschrift darf maximal 200 Zeichen lang sein." |
| `zipSchema` | 49-53 | string, trim, maxLength 10 | „Die PLZ darf maximal 10 Zeichen lang sein." |
| `citySchema` | 55-59 | string, trim, maxLength 150 | „Der Ort darf maximal 150 Zeichen lang sein." |
| `phoneSchema` | 61-65 | string, trim, maxLength 30 | „Die Telefonnummer darf maximal 30 Zeichen lang sein." |
| `emailSchema` | 67-72 | string, trim, maxLength 254, `email()` | „Die E-Mail darf maximal 254 Zeichen lang sein." / „Bitte geben Sie eine gültige E-Mail-Adresse ein." |
| `optionalEmailSchema` | 74-84 | optional(string, trim, maxLength 254, check leer ∨ Regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`) | wie oben |
| `urlSchema` | 86-90 | string, trim, maxLength 2048 | „Die URL darf maximal 2048 Zeichen lang sein." |
| `ibanSchema` | 97-106 | string, trim, `transform(normalizeBankCode)` (Whitespace raus, Upper-Case), maxLength 34, check leer ∨ `isValidIban` (Regex `^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$` + mod-97 = 1, `src/lib/utils/iban.ts:14,35-49`) | „Die IBAN darf maximal 34 Zeichen lang sein." / „Bitte geben Sie eine gültige IBAN ein." |
| `bicSchema` | 112-121 | string, trim, transform normalize, maxLength 11, check leer ∨ `isValidBic` (`^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$`, `iban.ts:10,58`) | „Der BIC darf maximal 11 Zeichen lang sein." / „Bitte geben Sie einen gültigen BIC ein (8 oder 11 Zeichen)." |
| `notesSchema` | 123-127 | string, trim, maxLength 2000 | „Die Notiz darf maximal 2000 Zeichen lang sein." |
| `longTextSchema` | 129-133 | string, trim, maxLength 10000 | „Der Text darf maximal 10.000 Zeichen lang sein." |
| `subjectSchema` | 135-139 | string, trim, maxLength 200 | „Der Betreff darf maximal 200 Zeichen lang sein." |
| `numberRangeKindSchema` | 141-148 | picklist invoice, offer, cost_estimate, order_confirmation, reminder, customer | keine — **unbenutzt**, unvollständig (B-137) |
| `documentTypeSchema` | 150-157 | picklist offer, cost_estimate, order_confirmation, invoice, reminder, customer_letter | keine |
| `paymentMethodSchema` | 164-166 | optional(picklist `PAYMENT_METHODS`) | „Bitte eine gültige Zahlungsart wählen." |
| `dateStringSchema` | 168-176 | string, trim, check `^\d{4}-\d{2}-\d{2}$` + gültiges Datum | „Bitte geben Sie ein gültiges Datum ein (YYYY-MM-DD)." |
| `dateFromStringSchema` | 178-185 | string, transform → Date, check gültig | „Bitte geben Sie ein gültiges Datum ein." |
| `moneySchema` | 187-191 | number, minValue −1e9, maxValue 1e9 | „Bitte geben Sie einen Betrag ein." / „Der Betrag ist zu klein." / „Der Betrag ist zu groß." |
| `percentSchema` | 193-197 | number, 0..100 | „Der Prozentwert darf nicht negativ sein." / „Der Prozentwert darf maximal 100 sein." |
| `positiveIntegerSchema` | 199-204 | number, 0..1e9, integer | „Der Wert darf nicht negativ sein." / „Der Wert ist zu groß." / „Bitte geben Sie eine ganze Zahl ein." |
| `licensePlateSchema` | 213-223 | string, trim, toUpperCase, 1..12, regex `^[A-ZÄÖÜ0-9 -]+$` | „Bitte ein Kennzeichen eingeben." / „Das Kennzeichen darf nicht leer sein." / „Das Kennzeichen darf maximal 12 Zeichen lang sein." / „Bitte ein gültiges Kennzeichen eingeben (z. B. B-XY 123)." |
| `vinSchema` | 230-238 | string, trim, toUpperCase, regex `^[A-HJ-NPR-Z0-9]{17}$` | „Bitte eine Fahrgestellnummer eingeben." / „Bitte eine gültige Fahrgestellnummer eingeben (17 Zeichen, ohne I, O und Q)." |
| `hsnSchema` | 241-245 | string, trim, regex `^\d{4}$` | „Bitte eine HSN eingeben." / „Die HSN muss aus genau 4 Ziffern bestehen." |
| `tsnSchema` | 251-259 | string, trim, toUpperCase, regex `^[A-Z0-9]{3}$` | „Bitte eine TSN eingeben." / „Die TSN muss aus genau 3 Zeichen (Buchstaben oder Ziffern) bestehen." |
| `timeHHMMSchema` | 262-269 | string, trim, regex `^([01]\d|2[0-3]):[0-5]\d$` | „Bitte eine Uhrzeit eingeben." / „Bitte eine gültige Uhrzeit (HH:MM) angeben." |
| `personnelNumberSchema` | 272-277 | string, trim, 1..20 | „Bitte eine Personalnummer eingeben." / „Die Personalnummer darf nicht leer sein." / „Die Personalnummer darf maximal 20 Zeichen lang sein." |
| `searchQuerySchema` | 279-283 | string, trim, maxLength 200 | „Der Suchbegriff darf maximal 200 Zeichen lang sein." |
| `listParamsSchema` | 288-297 | object { page: number ≥1 ≤100000, size: picklist [10,25,50,100], q?: searchQuerySchema, sort?: string ≤50 } | „Seite muss mindestens 1 sein." (maxValue/size ohne Meldung; **size-Picklist widerspricht „Pagination fix 25"**) |
| Typen `ListParams`, `ListResult<T>` | 299-315 | `{ items, total, page, size, pageCount }` | — |

Fehlerrendering (`src/hooks.server.ts:423-446`): nur das erste Issue; Feldpfad → `FIELD_LABELS` (`:264-375`); Meldungen ohne Umlaut gelten als „englisch" und werden durch „Bitte prüfen Sie Ihre Eingabe." ersetzt (`:439-440`); Ausgabe `Ungültige Eingabe für „<Label>“: <Detail>`.

---

## 4. Komponenten (modul-lokal)

| Komponente | Datei | Zweck | Props | Events/Callbacks | Snippets/Slots | Interner State | Verwendete Shared-Komponenten |
|---|---|---|---|---|---|---|---|
| Setup-Wizard (Page) | `src/routes/setup/+page.svelte` | 8-Schritte-Wizard | — | — | — | `step` (1..8), `totalSteps=8`, `steps[]` (`:38-47`), 16 Firmen-/Bank-Felder, `salutation`, `logoData/logoMime`, 7 SMTP-Felder + `smtpSkip`, `hoursRows[]` (aus `initialHours`), 4 Admin-Felder + `adminCreated`, `attemptedSteps[]`, `currentError` (`$derived(validateStep(step))`), `showError` | `busy` (Store), `toast`, `handleClientError`, `isValidIban/isValidBic/normalizeBankCode`, Lucide-Icons; DaisyUI `steps`, `progress`, `card`, `alert-error`, `file-input`, `table`, `toggle` |
| `WizardHost` | `src/routes/setup/WizardHost.svelte` (19 Z.) | **Nur Test-Host**: `<svelte:boundary>` um die Page mit `pending`-Snippet `data-testid="wizard-pending"` | — | — | — | — | nicht im Produktionscode importiert |
| Settings-Layout | `src/routes/settings/+layout.svelte` | Tab-Shell | `children` | — | `content` → `{@render children?.()}` | `tabs[]`, `visibleTabs`, `hasActiveTab` (`$derived`, exact/prefix-Match) | `TabGroup` (Nav-Modus: `href` auf jedem Tab, `exact` bei `general`; aktive Tab aus `page.url.pathname`, Auswahl → `goto`, abgebrochene Navigation schnappt zurück; `src/lib/components/ui/TabGroup.svelte:90-121`) |
| Allgemein (Page) | `src/routes/settings/+page.svelte` | Firmenformular, Logo, Stundensatz | — | — | — | 16 Formularfelder + `pdfFooter`, `initialised`, `laborRateInput`, `laborRateInitialised`, `legacyTarget` | `PageHeader` (Titel „Einstellungen"), `ImageUploader` (Props: `title="Logo"`, `hint="Wird im Briefkopf jedes PDFs dargestellt. Empfohlen: PNG oder SVG mit transparentem Hintergrund, max. 5 MB."`, `single=true`, `allowSetMain=false`, `maxBytes=5 MB`, `images` aus `data.company.logoData`, `onUpload`, `onDelete` nur wenn Logo vorhanden), `formDirty` (Store), `busy`, `toast`, Lucide `Disc3` |

`ImageUploader` (shared, `src/lib/components/ui/ImageUploader.svelte`): akzeptiert `image/*` (Regex `^image\//`), Toasts „„<name>" ist keine Bilddatei." / „„<name>" ist größer als <mb> MB.", Drag&Drop (Overlay „Dateien hier ablegen"), liest als Data-URL, wickelt `onUpload`/`onDelete` in `busy.run`, Platzhalter „Kein Bild hinterlegt / Bilder hierher ziehen oder Datei auswählen", Vorschau `alt="Vorschau"`; Löschen ohne Bestätigungsdialog.

---

## 5. Tabellen

| Tabelle | Fachlich relevante Spalten (Schema `src/lib/server/db/schema.ts`) | Anmerkungen |
|---|---|---|
| `company_settings` (`:33-123`) | `id uuid PK`, `setup_completed bool default false`, `company_name varchar(200) NOT NULL default ''`, `owner varchar(200)`, `street varchar(200) NN ''`, `zip varchar(10) NN ''`, `city varchar(150) NN ''`, `state varchar(50) NN ''`, `phone varchar(30) NN ''`, `mobile varchar(30)`, `fax varchar(30)`, `email varchar(254) NN ''`, `website varchar(2048)`, `vat_id varchar(30)`, `tax_number varchar(30)`, `bank_name varchar(100)`, `iban varchar(34)`, `bic varchar(11)`, `default_payment_term_days int NN 14`, `default_currency varchar(3) NN 'EUR'`, `default_vat_rate numeric(5,2) NN '19.00'`, `salutation_style varchar(10) NN 'Sie'`, `logo_mime varchar(50)`, `logo_data text` (Data-URL inline), `pdf_footer text NN ''`, `small_business_exempt bool NN false` (§19 UStG), `reminder_auto_enabled bool NN true`, `reminder_days_1 int NN 3`, `reminder_recur_every_days int NN 14`, `geo_lat numeric(9,6)`, `geo_lon numeric(9,6)` (Migration 0018), `labor_item_id uuid FK items ON DELETE SET NULL` (0033), `created_at`, `updated_at` | Singleton **ohne** DB-Constraint. Historie: 0001 fügte reminder_days_2..4/fee_1..4/interest_rate hinzu, 0024 entfernte sie; 0006/0015 payroll_generation_day rein/raus; 0014 `reminder_recur_every_days` (Default 7 → 0024 Default 14). Kein Leitweg-ID-Feld, keine Öffnungszeiten (eigene Tabelle). |
| `number_ranges` (`:141-146`) | `id uuid PK`, `kind varchar(30) UNIQUE NN`, `format_template varchar(50) NN`, `next_value int NN default 1` | Kein Präfix-/Startwert-/Jahresfeld; alles im Template. |
| `smtp_settings` (`:125-139`) | `host`, `port int 587`, `secure varchar(10) 'STARTTLS'`, `username`, `password text` (0000: `password_encrypted`, 0021 umbenannt zu `password`; Verschlüsselung seitdem im Service), `from_address`, `from_name`, `reply_to`, `verified bool`, `updated_at` | → MAIL; Seed legt Leerzeile an. |
| `mail_templates` (`:148-161`) | `key` (unique idx), `subject varchar(200)`, `body text`, `is_custom`, `updated_at` | → MAIL; Seed. |
| `ledger_categories` (`:988-993`) | `direction varchar(10)`, `name varchar(100) UNIQUE`, `default_tax_rate numeric(5,2)` | Seed. |
| `workshop_hours` (`:1761-1770`) | `weekday int PK (0=So..6=Sa)`, `opens_at text '08:00'`, `closes_at text '17:00'`, `closed bool`, `updated_at` | → EMP; Wizard-Schritt 6; Migration 0011 legte `time`-Typ an, Service schneidet auf `HH:MM` (`workshop-hours-service.ts:34-40`). |
| `roles` / `role_permissions` / `user_roles` (`:1894-1940`) | `roles.name UNIQUE`, `role_permissions (role_id, permission) PK`, `user_roles (user_id, role_id) PK` | Seed + Erst-Admin-Zuordnung; → AUTH. |
| `users` / `accounts` (`:1788-…`) | `username`, `display_username`, `email` synthetisiert | Erst-Admin; → AUTH. |
| `items` / `item_price_versions` | `article_number='ARBEIT'`, `valid_from`, `unit_price_net` | Stundensatz. |

---

## 6. Flows (durchgängig, Start bis Ende)

### 6.1 Erst-Setup (Wizard)
- **Einstieg**: frische DB → `/` → `/login?redirectTo=%2F` → Client-Redirect `/setup` (Schritt 1). Kopf: Icon `/icons/icon-128.webp`, „TwinCarsManager einrichten", Subline „Wir benötigen nur die Kerndaten, alles weitere können Sie später in den Einstellungen anpassen." Schrittanzeige „Schritt {n} von 8" + Titel; `<progress>` unter md, `ul.steps` mit Kurzlabels Start/Firma/Bank/Logo/SMTP/Zeiten/Admin/Prüfen ab md (`setup/+page.svelte:356-380`).
- **Navigation**: „Zurück" (`btn-ghost`, disabled bei Schritt 1 oder `busy.active`), „Weiter" (`btn-primary`, disabled nur bei `busy.active`; auf Schritt 7 vor Kontoanlage beschriftet „Konto anlegen"), auf Schritt 8 „Setup abschließen" (disabled bei `busy.active || !adminCreated`) (`:1108-1144`). `next()`: markiert Schritt als versucht, validiert client-seitig, persistiert „leaving step", erhöht `step` (`:293-303`). `prev()` persistiert nichts. `jumpTo(n)` aus der Verifikation (`:309-311`).
- **Schritt 1 Willkommen**: Infotext + Liste benötigter Daten; Hinweis „Alle weiteren Optionen (Mailvorlagen, PDF-Layout, Nummernkreise, Kfz-Freifelder usw.) sind mit deutschen Standardwerten vorbelegt und können später unter „Einstellungen" geändert werden." (`:384-402`; für Nummernkreise gibt es keine UI, B-135).
- **Schritt 2 Firmendaten** (`:403-506`): Firmenname* (maxlength 200), Inhaber, Straße + Hausnummer* (200), PLZ* (10), Ort* (150), Bundesland* (Select mit 16 Ländern, Default „Berlin"), Telefon* (30), Mobil (30), E-Mail* (type email, 254), Website (2048). Client-Validierung `validateStep(2)` (`:150-158`), Reihenfolge der Meldungen: „Bitte Firmenname eingeben." → „Bitte Straße eingeben." → „Bitte PLZ eingeben." → „Bitte Ort eingeben." → „Bitte gültige E-Mail eingeben." (Regex) → „Bitte Telefonnummer eingeben.". Keine Persistenz beim Verlassen.
- **Schritt 3 Steuer und Bank** (`:507-553`): USt-IdNr. (30), Steuernummer* (30), Bankname* (100), IBAN* (34), BIC* (11). Validierung (`:159-168`): „Bitte Steuernummer eingeben." → „Bitte IBAN eingeben." → „Bitte eine gültige IBAN eingeben." (mod-97) → „Bitte BIC eingeben." → „Bitte einen gültigen BIC eingeben (8 oder 11 Zeichen)." → „Bitte Bankname eingeben.". Keine Persistenz.
- **Schritt 4 Logo und Anrede** (`:554-614`): Hinweis „Das Logo erscheint auf jedem PDF (Rechnung, Angebot, Verkaufsschild). Optional…"; `file-input` `accept="image/png,image/jpeg,image/svg+xml"`, `handleLogoUpload` (`:132-147`): > 5 MB → Toast „Logo darf maximal 5 MB groß sein." + Input geleert; sonst FileReader → Data-URL in `logoData`, `logoMime = file.type` (kein MIME-Check über `accept` hinaus). Vorschau (`alt="Logo Vorschau"`) oder Platzhalter „Vorschau". Radio Anrede-Stil „Sie (Standard, professionell)" / „Du (persönlich)". Schritt blockiert nie. **Beim Verlassen** (`persistLeavingStep(4)`, `:225-253`): `busy.run(saveCompanyData({...alle Felder der Schritte 2–4, leere Optionale → undefined}))`.
- **Schritt 5 E-Mail-Versand (SMTP)** (`:615-707`): Checkbox „Später einrichten (überspringen)" (`smtpSkip`, Felder disabled + `opacity-50`); Absenderadresse* (email, 254), Absendername* (200), SMTP-Server (Host)* (255), Port* (`type="number"`, 1..65535, Default '587'), Verschlüsselung* (STARTTLS/TLS/Keine), Benutzername* (200), Passwort* (password, 200). Validierung wenn nicht übersprungen (`:171-177`): „Bitte SMTP-Server eingeben." → „Bitte SMTP-Benutzer eingeben." → „Bitte SMTP-Passwort eingeben." → „Bitte Absender-Adresse eingeben." → „Bitte Absender-Name eingeben.". Beim Verlassen: `saveSmtp({ …, port: smtpPort.trim(), replyTo: undefined })` — **`smtpPort` wird durch `bind:value` auf `type=number` zur Zahl, `.trim()` wirft** (B-122); übersprungen → nichts.
- **Schritt 6 Werkstatt-Öffnungszeiten** (`:708-759`): Tabelle Wochentag/Öffnet/Schließt/Geschlossen für die 7 geladenen Zeilen (Reihenfolge wie DB: So, Mo, …, Sa), `type="time"`-Inputs (disabled bei geschlossen), Toggle. Validierung (`:178-188`): pro offenem Tag „Bitte eine gültige Öffnungszeit für <Tag> eingeben." / „Bitte eine gültige Schließzeit für <Tag> eingeben." / „Schließzeit muss nach Öffnungszeit liegen (<Tag>).". Beim Verlassen: `saveWorkshopHoursForSetup({ rows })`.
- **Schritt 7 Administrator-Konto** (`:760-834`): Benutzername* (3..64), Anzeigename* (200), Passwort* (min 8), Passwort wiederholen*; Hinweistext „Erlaubte Zeichen: Buchstaben, Ziffern, Punkt und Unterstrich. Der Benutzername wird beim Anmelden klein geschrieben behandelt." Validierung (`:189-201`): „Bitte Benutzernamen (mind. 3 Zeichen) für den Admin angeben." → „Benutzername darf nur Buchstaben, Ziffern, Punkt und Unterstrich enthalten (keine Leerzeichen)." → „Bitte den Namen des Administrators angeben." → „Admin-Passwort muss mindestens 8 Zeichen lang sein." → „Die beiden Passwort-Eingaben stimmen nicht überein.". Primäraktion „Konto anlegen" → `createInitialAdmin` → `adminCreated=true`, Felder disabled, `alert-success` „Administrator-Konto „<username lower>" wurde angelegt. Es lässt sich in diesem Wizard nicht mehr ändern." Erneutes Verlassen persistiert nicht mehr (`:275-285`).
- **Schritt 8 Verifikation & Abschluss** (`:835-1092`): Karten Firma / Steuer & Bank / Logo & Anrede / E-Mail (SMTP) (bei Skip: „Übersprungen - kann später unter Einstellungen → E-Mail/SMTP eingerichtet werden."; Passwort als „••••••••") / Öffnungszeiten (Mo..So, „geschlossen" oder „HH:MM - HH:MM") / Administrator (Badge „Konto angelegt" bzw. `badge-warning` „noch nicht angelegt"); je Karte „Bearbeiten" → `jumpTo`, Administrator-Bearbeiten disabled wenn `adminCreated`. Hinweis: von dort führt „Weiter" wieder Schritt für Schritt bis zur Übersicht (erneute Persistenz der Schritte 4–6, Admin übersprungen).
- **Abschluss** (`finishSetup`, `:313-325`): `busy.run(completeSetup())` → Toast „Setup abgeschlossen!" → `window.location.href='/login'`. Fehler → `handleClientError(e, 'Setup konnte nicht abgeschlossen werden')`.
- **Ende**: `/login`; Login mit Admin → `/`.
- Leerzustand: —. Ladezustand: `busy.active` → Spinner im Primärbutton, Buttons disabled, globaler Progress-Bar; Alert wird während `busy.active` ausgeblendet (`:1102`).
- Validierungsfehler: `alert alert-error role="alert"` unter dem Schritt, erst nach erstem „Weiter" auf diesem Schritt, dann live (`:212-216`, `:1094-1106`); nur die erste Meldung; keine Feldmarkierung.
- Fehlerzustand: Speichern schlägt fehl → `handleClientError(e, 'Schritt konnte nicht gespeichert werden')`, Schritt bleibt (`:287-290`); Seite selbst wirft bei 403 in `+error.svelte`.
- Abbruchpfade: kein Abbrechen-Button; Tab schließen verliert alle nicht persistierten Eingaben; **kein** sessionStorage/DB-Restore — nach Reload beginnt der Wizard leer bei Schritt 1 (nur Öffnungszeiten kommen aus der DB). Ist der Admin bereits angelegt, endet Schritt 7 in 409 → Setup nicht abschließbar (B-120).
- Berechtigungs-Verweigerung: nach `setupCompleted` alle Setup-Remotes 403.
- Bestätigungsdialoge: keine.
- Idempotenz: Wizard erneut aufrufbar nur bis Abschluss; danach dauerhaft gesperrt (`refuseAfterSetup`), kein „Setup zurücksetzen" außer SQL (`docs/operations/fresh-db-reset.md`).

### 6.2 Firmeneinstellungen speichern (`/settings`)
- Einstieg: Sidebar „Einstellungen" (Permission `settings`) → Tab Allgemein. Header „Einstellungen".
- Formular (`settings/+page.svelte:219-423`), Fieldsets: **Firma** (Firmenname* `required`, Inhaber, E-Mail* `required`), **Anschrift** (Straße*, PLZ*, Ort*, Bundesland Select), **Kontakt** (Telefon*, Mobil, Website), **Anrede-Stil** (Sie (formell, Standard) / Du (persönlich)), **Steuer** (USt-IdNr., Steuernummer — optional), **Bank** (Bankname, IBAN, BIC — optional), **PDF-Endtext** (Textarea 10000, Hinweis „Erscheint unter der Summe auf jedem Beleg-PDF. Ideal für Werbe-/Schlusstext oder Hinweise zur Zahlungsweise."), Button „Speichern" (disabled nur `busy.active`).
- Initialisierung: Felder werden einmalig aus `data.company` befüllt (`initialised`, `:78-98`), Bundesland-Fallback „Berlin".
- Submit `saveCompany` (`:100-131`): `busy.run(updateCompanyRemote({...}))` → `formDirty.clear()` → Toast „Einstellungen gespeichert."; Fehler → `handleClientError(err)` (Toast, Formular bleibt dirty).
- Validierung: **keine Client-Validierung**, Formular ohne `novalidate` + `required` → Browser-Bubbles (B-130); Serverfehler als Toast `Ungültige Eingabe für „…“: …`.
- Ladezustand: SSR mit leeren Feldern, Befüllung nach Query (B-131); Leerzustand: —.
- Abbruch: In-App-Navigation mit dirty Form → `ConfirmDialog` in AppShell (`AppShell.svelte:41-58`), Reload → Browser-`beforeunload`.
- Berechtigung: ohne `settings` → Query 403 → Toast; Tab nicht sichtbar.

### 6.3 Logo hochladen / entfernen
- ImageUploader-Karte „Logo" oben auf Allgemein: Datei wählen oder Drag&Drop → Client-Check (image/*, ≤ 5 MB, Toasts) → `busy.run(onUpload)` → `updateLogoRemote({logoMime, logoData})` → Toast „Logo aktualisiert." (`:182-190`); Fehler → `handleClientError(err, 'Logo konnte nicht gespeichert werden')` + rethrow.
- Entfernen: Papierkorb (nur wenn Logo vorhanden) → `removeLogoRemote()` → Toast „Logo entfernt." (`:192-200`). **Kein** Bestätigungsdialog.
- Aktualisierung der Vorschau: hängt am serverseitigen `getAllSettingsRemote().refresh()`; Client deklariert kein `.updates(...)` → ob die Vorschau ohne Reload umschaltet ist **unklar** (B-147).
- Verwendung: PDF-Briefkopf (`pdf-service.ts:580-600`: nur PNG/JPEG eingebettet, SVG/WebP stiller Fallback ohne Logo), Logo-Hash geht in den Render-Cache-Key ein (`:232-242`).

### 6.4 Stundensatz setzen
- Fieldset „Stundensatz" (`:430-463`): Hinweis „Netto pro Stunde; wird beim Abschließen von Aufträgen als Arbeitszeit-Position berechnet."; wenn `laborRate` vorhanden: Zahlfeld (min 0.01, step 0.01, `required`), Text „Aktuell: <x,xx €>" oder „nicht gesetzt", Button „Speichern"; wenn `laborRate === null`: „Es ist kein Arbeitszeit-Artikel hinterlegt." (kein Button, keine Anlage-Möglichkeit).
- Submit (`:158-173`): Wert ≤ 0 / NaN → Toast „Bitte einen Stundensatz größer als 0 eingeben." (kein Inline-Alert); sonst `busy.run(updateLaborRateRemote({priceNet}))` → `formDirty.clear()` → Toast „Stundensatz aktualisiert."; Fehler → `handleClientError(err, 'Stundensatz konnte nicht gespeichert werden')`.

### 6.5 Settings-Shell / Tab-Navigation
- Tab-Klick (Radio) → `goto(href)`; abgebrochene Navigation (dirty Form) → Radio springt zurück (`TabGroup.svelte:113-120`). Aktiver Tab aus Pfad (Allgemein exakt, sonst Prefix). Nutzer ohne passende Permission sieht Tab nicht; Route direkt aufgerufen → Seite bare ohne Tab-Leiste (`+layout.svelte:110-118`), deren eigene Remotes werfen 403 → Fehlerseite/Toast.
- Legacy-Deep-Link `/settings?tab=smtp` → `replaceState` nach `/settings/smtp` (e2e `settings.spec.ts:70-76`).

### 6.6 Setup-Gate (laufender Betrieb)
- Jede Route: Root-Layout lädt `getLayoutContext()`; `!setupCompleted` → Client-`goto('/setup')`. `/setup`, `/login`, `/api/auth`, `/api/public`, `/api/ebay/account-deletion`, `/_app`, `/favicon` sind ohne Session erreichbar (`hooks.server.ts:61-75`). Seed läuft vor der ersten Anfrage.

---

## 7. Nebenwirkungen

- **E-Mails**: keine im Modul (SMTP-Speicherung → MAIL; Testversand → MAIL).
- **PDFs**: `company_settings` (Name, Adresse, Steuer, Bank, Logo, `pdfFooter`, `smallBusinessExempt`) fließen in jeden Beleg (`pdf-service.ts:585-600`, `1148-1160` Kleinunternehmer-Summenblock, `1253-1263` Footer + Hinweis „Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.", `1988-1990`); XRechnung: `smallBusinessExempt` → `TaxCategory E` (`xrechnung-service.ts:19-24, 291-298, 370-373, 496-498`). Mail-Platzhalter `{firma}`, `{firmaIban}`, `{firmaBic}`, Anrede Du/Sie aus `salutationStyle` (`mail-service.ts:99-120`).
- **Uploads**: Logo — Client ≤ 5 MB (Wizard: PNG/JPG/SVG per `accept`; Settings: `image/*`), Server ≤ 7 000 000 Zeichen Data-URL, kein MIME-Check; Speicherort `company_settings.logo_data` (text, inline in DB). Pre-Setup anonym hochladbar. `BODY_SIZE_LIMIT=64M` (CLAUDE.md).
- **Exporte**: keine.
- **Externe APIs / Webhooks**: keine. Konsument `GET /api/public/company` (PUB) liest Firmendaten + Geo + Öffnungszeiten.
- **Nummernkreise**: Seed (9 kinds) + Migrationen (storno 0020, tire 0022, work_order 0033); Allokation atomar; Import setzt Zähler (EXT). Keine UI.
- **Seeds beim ersten Request** (nicht beim Setup-Abschluss): company_settings-Zeile, smtp_settings-Zeile, Nummernkreise, 8 Mail-Vorlagen, 13 Ledger-Kategorien, 3 Rollen + Permissions, 7 Öffnungszeiten, Arbeitszeit-Artikel + Preis 0 + `labor_item_id`.
- **Audit**: keine Audit-Spuren für Settings-Änderungen (nur `updated_at`).
- **Verschlüsselung**: SMTP-Passwort AES-256-GCM (Service); Firmendaten unverschlüsselt (bewusst).

---

## 8. Vorhandene Tests

| Testdatei | Art | Was wird abgedeckt |
|---|---|---|
| `src/routes/setup/setup.remote.test.ts` (380 Z.) | integration (pg-mem, gemocktes `$app/server`) | Wizard-Öffnungszeiten (7 Zeilen, Persistenz, HH:MM-Reject, 403 nach Abschluss), `createInitialAdmin` (lowercase username, Rolle, 409 bei zweitem Aufruf, Regex-Reject), `saveCompanyData` (Persistenz, Pflicht Steuernummer/Bank), `saveSmtp` (verschlüsselt, leeres Passwort behält), `completeSetup` (400 ohne Admin, 400 ohne Firmendaten, Erfolg) |
| `src/routes/setup/wizard.test.ts` (296 Z.) | component (Testing-Library über `WizardHost`) | 8-Schritt-Indikator ohne Import, pristine-Step ohne Alert + Live-Update, Leerzeichen im Admin-Username, „Konto anlegen" blockiert ungültig / ruft `createInitialAdmin` mit korrektem Payload, Verifikationskarte + Bearbeiten-Sprung, `completeSetup` nur per CTA |
| `src/routes/settings/settings.remote.test.ts` (387 Z.) | integration | Stundensatz: 401/403-Gates, Lesen inkl. Preisversion, `null` ohne Item, neue Preisversion + Same-Day-Update, 400 bei ≤ 0, 409 ohne Item; SMTP-Testversand (→ MAIL) |
| `src/lib/server/services/settings-service.test.ts` (56 Z.) | integration | `getSettings` lazy-create mit Defaults (EUR, 14 Tage), keine Duplikate, Updates sichtbar |
| `src/lib/server/services/number-range-service.test.ts` (133 Z.) | integration | sequenzielle Vergabe, Persistenz, `ZE-{YYYY}-{NNNN}`-Rendering, unabhängige Zähler, Self-Seed (Default-/Fallback-Template), 10 parallele Aufrufe ohne Duplikat (pg-mem sequentiell, kein echter Lock-Test) |
| `src/lib/server/services/smtp-settings-service.test.ts` (128 Z.) | integration | Insert verschlüsselt, leeres Passwort `''`, Update statt zweiter Zeile, Passwort behalten/neu verschlüsseln, `verified` Reset |
| `src/lib/server/db/seed-defaults.test.ts` (136 Z.) | integration | **nur** Work-Order-Anteile: `work_order`-Range, Arbeitszeit-Artikel + Link, Idempotenz, kein Relink, `orders` in Rollen — Mail-Vorlagen/Ledger-Kategorien/Öffnungszeiten/Rollen-Inhalte ungetestet |
| `src/lib/server/db/smtp-settings.test.ts` (85 Z.) | integration | Spalte `password` round-trip, Default `''`, Update |
| `src/lib/server/db/validation.test.ts` (262 Z.) | unit | name, email, zip, iban (mod-97, Normalisierung, leer), bic, money, notes, listParams, paymentMethod, licensePlate, vin, hsn, tsn, timeHHMM, personnelNumber — **nicht**: url, address, city, phone, optionalEmail, date*, percent, positiveInteger, numberRangeKind, documentType |
| `src/lib/utils/numbering.test.ts` (50 Z.) | unit | `renderNumber` Platzhalter/Padding |
| `src/lib/utils/iban.test.ts` (50 Z.) | unit | normalize, IBAN gültig/ungültig, BIC |
| `src/hooks.server.test.ts` (328 Z.) | integration | Sign-in-Rate-Limit, Public-API-Rate-Limit, `resolveClientIp`, `handleValidationError`-Labels — **nicht**: Setup-Gate/Whitelist, `ensureSeeded`-Fehlerpfad |
| `e2e/settings.spec.ts` (152 Z.) | e2e | alle 11 Tabs erreichbar mit genau einer Tablist, Firmenformular „Inhaber" speichern + Toast, Legacy `?tab=smtp`-Redirect, SMTP-Testversand-Validierung (MAIL), Import-Dateigate (EXT), eBay disconnected (EXT) |
| `e2e/smoke.spec.ts` (134 Z.) | e2e | Modul-Smoke anderer Module; nichts zu SET |
| `e2e/navigation.spec.ts` (143 Z.) | e2e | Sidebar-Walk inkl. „Einstellungen" → Titel „Einstellungen" und „Anfragen" → `/settings/inquiries`; Dashboard; Global Search |
| — | e2e | **kein** E2E für den Setup-Wizard (Fixture-DB ist bereits eingerichtet) |

---

## 9. Feature-Matrix

| ID | Feature | Routen | Endpoints/Remotes | Tabellen | Erwartetes Verhalten |
|---|---|---|---|---|---|
| F-138 | Setup-Gate: App bis Abschluss auf `/setup` umleiten | alle | `getLayoutContext` | company_settings | Solange `setup_completed=false`: Root-Layout rendert ohne AppShell und leitet **clientseitig** per `goto('/setup')` um (`+layout.svelte:26-30`); Server leitet Anonyme nur nach `/login` (Flash `/`→`/login`→`/setup`). |
| F-139 | `/setup` und `/_app` ohne Session erreichbar | `/setup` | — | — | Whitelist in `hooks.server.ts:61-72`; Setup-Remotes sind anonym erreichbar und schützen sich nur über `refuseAfterSetup` bzw. „kein User vorhanden". |
| F-140 | Setup dauerhaft gesperrt nach Abschluss | `/setup` | alle Setup-Remotes | company_settings | 403 „Setup ist bereits abgeschlossen. Bitte die regulären Einstellungen verwenden."; Seite zeigt `+error.svelte` „Zugriff nicht erlaubt" + Detail; kein Reset über UI. |
| F-141 | Wizard-Rahmen mit 8 Schritten, Indikator, Zurück/Weiter | `/setup` | — | — | Schritte Willkommen/Firmendaten/Steuer & Bank/Logo & Anrede/E-Mail (SMTP)/Öffnungszeiten/Administrator/Verifikation; Progress < md, Pill-Steps ≥ md (Kurzlabels); Zurück nie persistierend; Weiter validiert, persistiert den verlassenen Schritt, dann +1. |
| F-142 | Schritt 1 Willkommen | `/setup` | — | — | Statischer Text mit Liste der benötigten Daten; immer passierbar. |
| F-143 | Schritt 2 Firmendaten mit Pflichtfeld-Validierung | `/setup` | (persistiert erst in Schritt 4) | — | 10 Felder, Bundesland-Select (16, Default Berlin); Client-Pflicht: Firmenname, Straße, PLZ, Ort, E-Mail (Regex), Telefon; Meldungen s. §6.1; keine PLZ-/Telefon-Formatprüfung. |
| F-144 | Schritt 3 Steuer & Bank mit IBAN/BIC-Prüfung | `/setup` | — | — | Client-Pflicht: Steuernummer, IBAN (normalisiert + mod-97), BIC (8/11), Bankname; USt-IdNr. optional ohne Format; Server spiegelt Pflicht für taxNumber/bankName, IBAN/BIC nur Form (leer erlaubt). |
| F-145 | Schritt 4 Logo & Anrede + Persistenz Firmendaten | `/setup` | `saveCompanyData` | company_settings | Logo optional (PNG/JPG/SVG, ≤ 5 MB, Toast bei Überschreitung, Vorschau); Anrede Sie/Du (Default Sie); beim Verlassen ein `UPDATE` mit allen Feldern der Schritte 2–4; leere Optionale → NULL; fehlendes Logo → NULL. |
| F-146 | Schritt 5 SMTP optional (Überspringen) | `/setup` | `saveSmtp` | smtp_settings | Checkbox „Später einrichten (überspringen)" deaktiviert Felder und Persistenz; sonst alle 7 Felder Pflicht (Client), Port 1..65535 (Server), Passwort AES-256-GCM, `verified=false`. |
| F-147 | Schritt 6 Öffnungszeiten (7 Wochentage) | `/setup` | `listWorkshopHoursForSetup`, `saveWorkshopHoursForSetup` | workshop_hours | Zeilen aus DB (Seed Mo–Fr 08–17, Sa/So geschlossen); Toggle geschlossen; Client prüft HH:MM und Schließen > Öffnen; Server nur HH:MM; alle 7 Zeilen sequentiell upsert. |
| F-148 | Schritt 7 ersten Administrator anlegen | `/setup` | `createInitialAdmin` | users, accounts, user_roles, roles | Nur wenn `users` leer (sonst 409); Username lower-case, `displayUsername` original, E-Mail `<user>@twincars.local`, Rolle Administrator; danach Felder gesperrt, Erfolgs-Alert, „Weiter" persistiert nichts mehr. |
| F-149 | Schritt 8 Verifikation mit Bearbeiten-Sprüngen | `/setup` | — | — | 6 Karten mit allen erfassten Werten; „Bearbeiten" springt zum Schritt (Admin-Karte gesperrt nach Anlage); Rückweg über „Weiter" persistiert 4–6 erneut. |
| F-150 | Setup abschließen | `/setup` → `/login` | `completeSetup` | company_settings | Guards: User vorhanden (400 „Bitte zuerst ein Administrator-Konto anlegen."), Firmenname/Straße/Ort/E-Mail nicht leer (400 „Bitte zuerst die Firmendaten vollständig ausfüllen."); setzt `setup_completed=true`; Toast „Setup abgeschlossen!"; Full-Load `/login`. Button erst aktiv, wenn `adminCreated`. |
| F-151 | Click-Time-Validierungs-UX im Wizard | `/setup` | — | — | Pristine Schritt zeigt nichts; nach erstem „Weiter" Alert (`role="alert"`) mit erster Meldung, live aktualisiert; pro Schritt gemerkt (`attemptedSteps`); Buttons nie wegen Validierung disabled. |
| F-152 | Fehlerbehandlung beim Schritt-Speichern | `/setup` | alle Setup-Commands | — | Toast über `handleClientError(e, 'Schritt konnte nicht gespeichert werden')`; Schritt bleibt; Abschlussfehler „Setup konnte nicht abgeschlossen werden". |
| F-153 | Seed Singleton-Zeilen beim ersten Request | alle | `seedDefaults` (hooks) | company_settings, smtp_settings | Leere `company_settings` (mit Default-`pdfFooter`) und leere `smtp_settings` angelegt, falls keine Zeile existiert; `getSettings()` legt zusätzlich lazy an. |
| F-154 | Seed Nummernkreise | — | `seedDefaults`, Migrationen 0020/0022/0033 | number_ranges | 9 kinds per Seed (Tabelle §3.4) + `tire` nur per Migration/Service-Default; alle bei 1; Import verschiebt Zähler. |
| F-155 | Seed Mail-Vorlagen (8) | — | `seedDefaults` | mail_templates | Keys invoice, cost_estimate, offer, order_confirmation, reminder_1, tire_reminder, appointment_confirmation, mailing; `is_custom=false`; nie überschrieben (ON CONFLICT DO NOTHING). |
| F-156 | Seed Ledger-Kategorien (13) | — | `seedDefaults` | ledger_categories | 3 income, 10 expense (Namen §3.4); unique `name`. |
| F-157 | Seed Rollen + Permissions | — | `seedDefaultRoles` | roles, role_permissions | Administrator `*`, Werkstattleiter alle außer settings/users (dynamisch aus `MODULE_PERMISSIONS`), Mitarbeiter kuratierte 12 Keys; nur fehlende Permissions ergänzt, nie entfernt. |
| F-158 | Seed Öffnungszeiten | — | `seedDefaultWorkshopHours` | workshop_hours | 7 Zeilen, Mo–Fr offen 08:00–17:00, Sa/So geschlossen; Operator-Änderungen bleiben. |
| F-159 | Seed Arbeitszeit-Artikel und Verknüpfung | — | `seedLaborItem` | items, item_price_versions, company_settings | Item `ARBEIT`/„Arbeitszeit"/service/„Std." + Preis 0 (nur neu); `labor_item_id` nur gesetzt wenn NULL. |
| F-160 | Settings-Shell: permission-gefilterte Tab-Leiste | `/settings/*` | `getCurrentUserRemote` | — | 11 Tabs (§1); `*` oder Modul-Key sichtbar, Konto immer; Nav-Modus (Radio → goto), Allgemein exakt, andere Prefix; Leiste nur bei >1 Tab und passender Route, sonst Inhalt bare. |
| F-161 | Legacy-Deep-Link-Redirect `?tab=` | `/settings?tab=…` | — | — | `mail`→`/settings/mail`, `reminders`→`/settings/reminders`, `smtp`→`/settings/smtp` per `replaceState`; andere Werte ignoriert; nur clientseitig im `$effect`. |
| F-162 | Firmenstammdaten bearbeiten (Allgemein) | `/settings` | `getAllSettingsRemote`, `updateCompanyRemote` | company_settings | 15 Felder + Anrede (§6.2); Steuer/Bank optional; IBAN/BIC serverseitig normalisiert/geprüft; Erfolg „Einstellungen gespeichert."; `formDirty` erst nach Erfolg gelöscht. |
| F-163 | PDF-Endtext pflegen | `/settings` | `updateCompanyRemote` | company_settings.pdf_footer | Textarea ≤ 10000; Default aus Seed; erscheint unter der Summe jedes Beleg-PDFs (Dokument-`footer` hat Vorrang, `pdf-service.ts:1253`). |
| F-164 | Logo hochladen (Settings) | `/settings` | `updateLogoRemote` | company_settings.logo_mime/logo_data | ImageUploader single-mode, Drag&Drop, `image/*` ≤ 5 MB; Data-URL in DB; Toast „Logo aktualisiert."; Hinweis empfiehlt PNG/SVG. |
| F-165 | Logo entfernen | `/settings` | `removeLogoRemote` | company_settings | Papierkorb ohne Rückfrage; beide Spalten NULL; Toast „Logo entfernt."; PDFs fallen auf Text-Kopf zurück. |
| F-166 | Stundensatz anzeigen/setzen | `/settings` | `getLaborRateSettingRemote`, `updateLaborRateRemote` | items, item_price_versions, company_settings.labor_item_id | Anzeige „Aktuell: x,xx €"/„nicht gesetzt"; Save schreibt Preisversion `valid_from=heute` (Same-Day-Update); ≤ 0 → Toast; ohne Item: Hinweis „Es ist kein Arbeitszeit-Artikel hinterlegt." (Server 409). |
| F-167 | Link-Karte „Reifenwechsel-Erinnerungen" | `/settings` → `/settings/tire-reminders` | — | — | Karte mit Text „Twice-yearly Mailings an Kunden mit eingelagerten Reifen." (Denglisch) und Button „Öffnen" (→ ITEM). |
| F-168 | Unsaved-Changes-Guard auf Allgemein | `/settings` | — | — | `oninput/onchange` → `formDirty.set(true)`; Sidebar-/Tab-Navigation öffnet ConfirmDialog (AppShell), Reload Browser-Warnung; beim Verlassen `formDirty.clear()` im Effect-Cleanup. |
| F-169 | Kombinierte Settings-Query | `/settings*` | `getAllSettingsRemote` | company_settings, smtp_settings | Komplette Firmenzeile inkl. Logo + SMTP-Metadaten (`hasPassword`, nie das Passwort). |
| F-170 | Atomare Nummernvergabe mit Self-Seed | — | `allocateNumber` | number_ranges | Ein `UPDATE … RETURNING`; fehlende Zeile wird mit Default-Template angelegt; Rendering `{YYYY}/{YY}/{MM}/{N…}`; kein Jahresreset; unbekannter kind → `{N}`. |
| F-171 | Nummernkreis-Konsumenten und Import-Anschluss | — | `nextDocumentNumber`, Import | number_ranges | Belege/Storno/Kunden/Reifen/Einlagerung/Aufträge/Erinnerungen ziehen aus je eigenem kind; MDB-Import setzt customer/invoice/offer/cost_estimate/order_confirmation auf Legacy-Max+1 mit `{N}`. |
| F-172 | Firmendaten-Konsumenten | — | — | company_settings | PDF (Kopf, Bank, Footer, §19-Hinweis), XRechnung (§19 → Kategorie E), Mail (`{firma}`, `{firmaIban}`, `{firmaBic}`, Du/Sie-Anrede), Public API `/api/public/company` (Adresse, Kontakt, Geo, Öffnungszeiten), Aufträge/Public Orders (`default_vat_rate`, `default_payment_term_days`). |
| F-173 | Sidebar-Eintrag Einstellungen | alle | — | — | Gruppe System, Permission `settings`, Icon `Settings`; „Anfragen" separat in Kommunikation (`mailings`). |
| F-174 | Firmenname als Shell-Titel | alle | `getLayoutContext` | company_settings | AppShell zeigt `companyName`, Fallback „TwinCarsManager". |
| F-175 | Öffentliche Firmen-/Geo-Daten | `/api/public/company` | (PUB) | company_settings | Geo nur, wenn beide Koordinaten gesetzt — **keine UI dafür** (nur SQL). |
| F-176 | Kleinunternehmer-Regelung (§19 UStG) | `/settings/reminders` (MAIL) | `updateReminderSettingsRemote` | company_settings.small_business_exempt | Flag steuert PDF-Summenblock/Hinweistext und XRechnung; nicht die MwSt-Berechnung von Aufträgen/Public Orders. |
| F-177 | Standard-MwSt., Zahlungsziel, Währung | — | `updateCompanyRemote` (Schema-Felder) | company_settings | Defaults 19.00 / 14 Tage / EUR; **nirgends editierbar** (Schema akzeptiert `defaultVatRate`/`defaultPaymentTermDays`, UI sendet sie nicht; Währung fest). |

---

## 10. Befunde

| ID | Beschreibung | Fundstelle | Auswirkung | Empfehlung | Einordnung | Betroffene Features |
|---|---|---|---|---|---|---|
| B-117 | Doku widerspricht Code: CLAUDE.md „6-step wizard", README „6 Schritte" mit Import als Schritt 6 und „Logo-Upload Pflicht"; Code hat 8 Schritte, kein Import, Logo optional | `CLAUDE.md:118`, `README.md:231-238`, `setup/+page.svelte:29-47,169-170` | Falsche Anforderungsbasis fürs Rewrite | Code als Wahrheit übernehmen (8 Schritte), Doku korrigieren | im Rewrite beheben | F-141..12 |
| B-118 | Doku behauptet Seeding „beim Abschluss"; tatsächlich seedet `ensureSeeded()` vor der ersten Anfrage, `completeSetup` setzt nur das Flag | `README.md:240-241`, `CLAUDE.md:118-119`, `docs/modules/setup.md:29-31`, `setup.remote.ts:330-350`, `hooks.server.ts:41-53` | Falsches mentales Modell; Nuxt-Rewrite braucht expliziten Seed-Hook (Nitro-Plugin) | Seed als Boot-Schritt spezifizieren, nicht als Setup-Abschluss | im Rewrite beheben | F-150, 16-22 |
| B-119 | `docs/modules/settings.md` nennt Geo-Koordinaten und §19-Flag auf „Allgemein"; Code: keine Geo-UI existiert, §19 liegt auf `/settings/reminders` | `docs/modules/settings.md:37-40`, `settings/+page.svelte` (kein geo/smallBusiness), `settings/reminders/+page.svelte:142`, `schema.ts:99-106` (Kommentar „setup wizard treats them as optional" ebenfalls falsch) | Feature fehlt faktisch; Steuer-Flag fachlich falsch platziert | Geo-Felder + §19 unter Firmendaten (Steuer) einplanen | Entscheidung nötig | F-175, 39 |
| B-120 | **Setup-Deadlock nach Reload**: Wizard hält alles in `$state`; nach Reload (z. B. nach Schritt 7) ist `adminCreated=false`, `createInitialAdmin` antwortet 409, „Setup abschließen" bleibt disabled → Setup per UI unvollendbar | `setup/+page.svelte:126-130,275-285,1136`, `setup.remote.ts:210-213` | Blocker für echte Ersteinrichtung bei jedem Netz-/Browserproblem; nur per SQL lösbar | Wizard-Status serverseitig ableiten (`users` count, `company_settings` gefüllt, `smtp_settings` gefüllt) und Wizard initialisieren; Abschluss auch bei bestehendem Admin erlauben | im Rewrite beheben | F-148, 12, 13 |
| B-121 | Keine Zwischenspeicherung/Wiederaufnahme: Reload verliert Schritte 2–5 (obwohl `company_settings`/`smtp_settings` bereits geschrieben wurden); kein sessionStorage, keine DB-Vorbelegung | `setup/+page.svelte:49-82` (kein Load außer `initialHours`) | Doppelte Eingabe, Frust | Vorbelegung aus DB (`getSettings`, SMTP-Metadaten) + optional sessionStorage-Draft | im Rewrite beheben | F-143..09 |
| B-122 | **Bug**: `smtpPort` ist `$state('587')`, aber `<input type="number" bind:value>` schreibt eine Zahl zurück (Svelte `to_number`); `smtpPort.trim()` wirft `TypeError` sobald der Port editiert wurde → Toast „Schritt konnte nicht gespeichert werden", SMTP nicht speicherbar | `setup/+page.svelte:71,261,668-674`; `node_modules/svelte/src/internal/client/dom/elements/bindings/input.js:74,281-287` | SMTP-Schritt nur mit unverändertem Port 587 nutzbar | Port als number führen, Schema `number()` | im Rewrite beheben | F-146 |
| B-123 | Server-Pflichtfelder schwächer als kommentiert: `street/zip/city/phone` haben nur maxLength (leer erlaubt), `completeSetup` prüft nur name/street/city/email; API-Bypass mit leerer PLZ/Telefon möglich | `setup.remote.ts:43-50,52-82,336-344`, `validation.ts:43-65` | Unvollständige Stammdaten auf Rechnungen (Pflichtangaben) | `minLength(1)`-Varianten (z. B. `requiredAddressLineSchema`) im Rewrite | im Rewrite beheben | F-143, 13, 25 |
| B-124 | `companyName` nutzt `nameSchema` (max 100), Inputs erlauben 200, DB `varchar(200)` | `setup.remote.ts:53`, `settings.remote.ts:43`, `setup/+page.svelte:413`, `settings/+page.svelte:232`, `schema.ts:36` | Firmennamen 101–200 Zeichen werden serverseitig mit „Der Name darf maximal 100 Zeichen…" abgelehnt | eigenes `companyNameSchema` (200) | im Rewrite beheben | F-143, 25 |
| B-125 | Viele Pipe-Schritte ohne deutsche Meldung (CONTRIBUTING-Verstoß): `owner`, `vatId`, `state` (Settings), `taxNumber`/`bankName` (Settings), `pdfFooter`, `logoSchema`, `smtpSchema` (host/port/username/password/fromName), `salutationStyle`, `idSchema`, `listParamsSchema.size` | `setup.remote.ts:54,64,80-81,84-93`, `settings.remote.ts:44,48,54-56,62,250-255`, `validation.ts:28,294` | Nutzer sieht generisch „Bitte prüfen Sie Ihre Eingabe." | Jede Pipe mit Meldung | im Rewrite beheben | F-145, 09, 25, 27 |
| B-126 | `FIELD_LABELS` fehlen Keys des Moduls: `companyName`, `state`, `salutationStyle`, `logoMime`, `logoData`, `pdfFooter`, `fromAddress`, `replyTo`, `secure`, `priceNet`, `recipient`, `key`, `rows`, `weekday`, `opensAt`, `closesAt`, `closed`, `reminderDays1`, `reminderRecurEveryDays` | `hooks.server.ts:264-375` | Fehlermeldungen wie `Ungültige Eingabe für „state“` | Labels ergänzen bzw. im Rewrite i18n-Map pro Schema | im Rewrite beheben | F-143..10, 25 |
| B-127 | SVG-Logo: Wizard-`accept` erlaubt SVG, Settings-Hint empfiehlt „PNG oder SVG", PDF bettet nur PNG/JPEG ein (SVG/WebP/GIF stiller Fallback ohne Logo, ohne Rückmeldung) | `setup/+page.svelte:567-571`, `settings/+page.svelte:208`, `ImageUploader.svelte` (`image/*`), `pdf-service.ts:580-600` | Nutzer lädt SVG hoch, PDFs bleiben ohne Logo | Nur PNG/JPEG zulassen oder SVG serverseitig rastern; Hint korrigieren | Entscheidung nötig | F-145, 27 |
| B-128 | Kein serverseitiger MIME-/Inhalts-Check für Logo (`logoMime` beliebiger String ≤ 50, `logoData` beliebig ≤ 7 MB); pre-setup anonym | `setup.remote.ts:80-81`, `settings.remote.ts:250-255` | Beliebige Blobs in DB; PDF-Embed try/catch fängt nur Render | Data-URL-Prefix + Magic-Bytes prüfen, Größe serverseitig | im Rewrite beheben | F-145, 27 |
| B-129 | Logo inline in `company_settings.logo_data` (text) und in **jedem** `getAllSettingsRemote`-Payload (auch SMTP-/Reminders-Seiten, Layout nutzt `getSettings` serverseitig) — bis ~7 MB pro Seitenaufruf; PDF-Service hasht das Logo bei jedem Render | `settings.remote.ts:99-136`, `pdf-service.ts:232-242` | Langsame Settings-Seiten, große SSR-Payloads | Logo als Asset/Blob mit eigener URL + ETag, Settings-Query ohne Bytes | im Rewrite beheben | F-164, 32 |
| B-130 | Settings-Formulare ohne `novalidate`, Inputs mit `required` → native (Browser-)Validierungsbubbles; keine Click-Time-Zusammenfassung; Stundensatz-Fehler als Toast statt Inline-Alert (CONTRIBUTING §11) | `settings/+page.svelte:219-224,233,251,264,274,283,313,430,446,158-164` | Inkonsistente UX, englische Bubbles je nach Browser | Click-Time-Validierung mit deutschem Summary | im Rewrite beheben | F-162, 29 |
| B-131 | Allgemein lädt Daten ohne Top-Level-await (`.current`), SSR liefert leeres Formular, Befüllung per `$effect`; nach Save keine Rücksynchronisation (normalisierte IBAN erst nach Reload sichtbar); Query-Fehler nur Toast, Formular bleibt leer | `settings/+page.svelte:50-55,76-98` | Flackern, „leere Einstellungen" bei Fehler | Formular aus awaited Daten initialisieren, nach Save Serverwerte übernehmen | im Rewrite beheben | F-162 |
| B-132 | `defaultVatRate`/`defaultPaymentTermDays` im Schema ohne Grenzen, UI sendet sie nie; `defaultVatRate` 0 wird als falsy ignoriert; `default_currency` nie editierbar; keine UI für Standard-MwSt./Zahlungsziel/Geo | `settings.remote.ts:59-60,163-167`, `schema.ts:52-60` | Tote Schema-Felder; Kleinunternehmer kann 0 % nicht als Default setzen | Felder entweder mit UI + Bounds ausstatten oder entfernen | Entscheidung nötig | F-177 |
| B-133 | §19-Flag wirkt nur auf PDF-/XRechnung-Ausweis; Aufträge und Public Orders rechnen weiter mit `default_vat_rate` 19 % | `work-order-service.ts:1047`, `api/public/orders/endpoint.ts:208`, `pdf-service.ts:1148,1257` | Kleinunternehmer-Rechnungen mit Steuerbeträgen in Summen möglich | Semantik festlegen (Flag → VAT 0 überall) | Entscheidung nötig | F-176, 40 |
| B-134 | Steuernummer im Setup Pflicht, in Settings optional → nach Setup löschbar; keine Formatprüfung für USt-IdNr (DE+9 Ziffern), Steuernummer, PLZ (5 Ziffern) | `setup.remote.ts:65-70`, `settings.remote.ts:55`, `validation.ts:49-53` | Ungültige Pflichtangaben auf Rechnungen | Einheitliche Pflicht + Formatschemas | Entscheidung nötig | F-144, 25 |
| B-135 | Nummernkreise haben **keine Admin-UI** (Präfix/Format/Startwert nur via Seed, Migration, Import, SQL); Wizard-Text verspricht Änderbarkeit „später unter Einstellungen" | `setup/+page.svelte:399-401`, grep `src/routes` ohne Treffer | Betrieb kann Nummern nicht anpassen (z. B. Startwert nach manueller Übernahme) | Settings-Tab „Nummernkreise" mit Vorschau, Sperre des Startwerts unterhalb `next_value` | Entscheidung nötig | F-154, 33 |
| B-136 | Kein Jahreswechsel-Reset für `{YYYY}`-Templates (`reminder`, `tire_storage`, `work_order`): Zähler läuft durch → `AU-2027-0153` statt `-0001`; `{NNNN}` läuft bei > 9999 über die Breite hinaus | `number-range-service.ts:47-58,102-122`, `numbering.ts:12-26` | Optisch falsche Nummern, kein per-Jahr-Zähler | `last_reset_year`/Jahres-Scope pro kind einführen | Entscheidung nötig | F-170 |
| B-137 | Nummernkreis-Defaults dreifach gepflegt (Seed, Service `DEFAULT_TEMPLATES`, Migrationen); `tire` fehlt im Seed; `numberRangeKindSchema` unbenutzt und unvollständig (ohne tire, tire_storage, storno, work_order) | `seed-defaults.ts:157-172`, `number-range-service.ts:47-58`, `validation.ts:141-148`, `drizzle/0022:138` | Drift-Risiko | Eine Quelle (`NUMBER_RANGE_KINDS` const) | im Rewrite beheben | F-154, 33 |
| B-138 | Nummernvergabe und Beleg-Insert nicht transaktional → Nummernlücken bei Insert-Fehler (GoBD: Lücken müssen erklärbar sein); pg-mem-Testtreiber verhindert Transaktionen | `number-range-service.ts:22-31`, `document-service.ts:239` | Lückenhafte Rechnungsnummern möglich | Im Rewrite Allokation innerhalb der Beleg-Transaktion (Test-Harness mit echtem Postgres/Testcontainer) | Entscheidung nötig | F-170, 34 |
| B-139 | Singleton `company_settings`/`smtp_settings` ohne DB-Constraint; `getSettings`/`seedDefaults` select-then-insert ohne Lock; `LIMIT 1` ohne `ORDER BY` | `settings-service.ts:7-14`, `seed-defaults.ts:198-206`, `schema.ts:33-35` | Bei paralleler Erstanfrage zwei Zeilen, nichtdeterministische Auswahl | `CHECK (id = 1)`/Unique-Konstante, `INSERT … ON CONFLICT` | im Rewrite beheben | F-153 |
| B-140 | `ensureSeeded`: schlägt `seedDefaults()` fehl (DB kurz nicht erreichbar), bleibt `seedPromise` rejected → jede Folge-Anfrage 500 bis Prozessneustart | `hooks.server.ts:41-53` | Selbstheilung unmöglich | Promise bei Fehler zurücksetzen / Seed als Boot-Task mit Retry | im Rewrite beheben | F-153..22 |
| B-141 | Setup-Gate nur clientseitig (`$effect` + `goto`); Server leitet nie nach `/setup`; ohne JS sieht Frischinstallation Login; `/api/public/*` liefert vor Setup leere Firmendaten | `+layout.svelte:26-30`, `hooks.server.ts:221-229`, `docs/modules/setup.md:32-33` | Flash, inkonsistent, SEO-/No-JS-Fall | Server-Middleware: `!setupCompleted` → 302 `/setup` (außer Assets/Auth) | im Rewrite beheben | F-138 |
| B-142 | `createInitialAdmin` nicht transaktional und ohne `refuseAfterSetup`; fehlt die Admin-Rolle, existiert der User ohne Rolle und jeder Retry liefert 409; `completeSetup` prüft keine Rollenzuordnung | `setup.remote.ts:207-234,330-335` | Admin ohne Rechte, Setup blockiert | Transaktion + Rollenprüfung in `completeSetup` | im Rewrite beheben | F-148, 13 |
| B-143 | `saveWorkshopHoursForSetup` ohne `opensAt < closesAt`, ohne Vollständigkeits-/Duplikatsprüfung, 7 sequentielle Writes ohne Transaktion (Settings-Variante hat laut Doku den Cross-Field-Check) | `setup.remote.ts:246-274,307-321`, `docs/modules/settings.md:64-68` | Inkonsistente Zeiten per API | Gemeinsames Schema mit Cross-Check (EMP) | im Rewrite beheben | F-147 |
| B-144 | Toter/irreführender Code: `getSetupStatus` nirgends genutzt; `WizardHost.svelte` test-only im Routen-Ordner, Doku nennt es als Seite; JSDoc „Returns the saved row id" falsch | `setup.remote.ts:101-104,349`, `WizardHost.svelte:1-10`, `docs/modules/setup.md:12`, `setup.remote.ts:107` | Verwirrung | Entfernen/korrigieren | im Rewrite beheben | F-150 |
| B-145 | Legacy-Redirect nur für `mail/reminders/smtp`, ausschließlich clientseitig im `$effect` (Allgemein wird erst gerendert; Nicht-`settings`-Nutzer bekommen zuerst 403-Toast) | `settings/+page.svelte:36-45` | Flash, Toast-Rauschen | Server-Redirect (Nuxt `defineNuxtRouteMiddleware`) oder Legacy-Links ganz streichen | bewusst später | F-161 |
| B-146 | Testlücken: keine Tests für `updateCompanyRemote`, `updateLogoRemote`, `removeLogoRemote`, `getAllSettingsRemote`; keine Komponententests für Allgemein/Settings-Layout; kein E2E des Setup-Wizards; Seed-Tests nur Work-Order-Anteile; hooks-Test deckt Setup-Gate/Seed nicht; `validation.test.ts` deckt url/address/city/phone/date/percent nicht | `settings.remote.test.ts`, `seed-defaults.test.ts`, `hooks.server.test.ts`, `e2e/*` | Regressionen unbemerkt | Testplan fürs Rewrite: Wizard-E2E gegen leere DB, Settings-Remotes, Seed-Inhalte | im Rewrite beheben | alle |
| B-147 | Single-Flight-Regel (CLAUDE.md: beide Hälften nötig): `updateLogoRemote`/`removeLogoRemote`/`updateCompanyRemote`/`updateLaborRateRemote` werden ohne `.updates(getAllSettingsRemote())` aufgerufen; ob Logo-Vorschau/„Aktuell:"-Wert ohne Reload aktualisieren, ist **unklar** (nicht live geprüft) | `settings/+page.svelte:104,166,184,194`, `settings.remote.ts:173,242,276,292` | Möglicherweise veraltete Anzeige nach Save | Im Rewrite explizites Query-Invalidieren nach Mutation | Entscheidung nötig (live prüfen) | F-162, 27, 28, 29 |
| B-148 | Wizard-Client-Regeln weichen vom Server ab: E-Mail-Regex vs. valibot `email()`; `fax` nur im Schema; `state` clientseitig Select, serverseitig Freitext; PLZ/Telefon clientseitig Pflicht, serverseitig nicht | `setup/+page.svelte:155,149-158`, `setup.remote.ts:52-82` | Doppelte, driftende Regeln | Ein Schema (Valibot/Zod) client+server teilen | im Rewrite beheben | F-143, 07 |
| B-149 | `listParamsSchema.size` erlaubt 10/25/50/100, obwohl Pagination fix 25 ist (CLAUDE.md) | `validation.ts:294` | Unnötige Oberfläche | `size` entfernen/fixieren | im Rewrite beheben | — (Querschnitt) |
| B-150 | Doku-Drift Nummernkreise: `database-schema.md` listet kinds ohne `tire`; Wizard-Willkommenstext nennt „Kfz-Freifelder" (existieren nicht) | `docs/architecture/database-schema.md:26-28`, `setup/+page.svelte:399-400` | Falsche Erwartungen | Korrigieren | im Rewrite beheben | F-142, 17 |
| B-151 | Anonyme Pre-Setup-Writes (`saveCompanyData`, `saveSmtp`, Logo bis 7 MB) ohne Rate-Limit; Angreifer mit Netzzugriff vor Abschluss kann SMTP/Firmendaten setzen (im Code als bewusstes Risiko dokumentiert) | `setup.remote.ts:113-116,154-157`, `hooks.server.ts:111-167` (Limits nur Sign-in/Public-API) | Setup-Fenster angreifbar | Setup-Token (Env/Konsole) oder Netzwerkbindung beim Rewrite erwägen | Entscheidung nötig | F-139, 08, 09 |
| B-152 | Logo-Löschen ohne Bestätigung; Denglisch „Twice-yearly Mailings" auf Allgemein; `alt="Vorschau"` generisch | `settings/+page.svelte:192-200,480`, `ImageUploader.svelte` | Kleinere UX-Mängel | ConfirmDialog, deutschen Text | im Rewrite beheben | F-165, 30 |

---

## 11. Offene Fragen an den Architekten

1. **Setup-Wiederaufnahme**: Soll der Nuxt-Wizard seinen Fortschritt serverseitig ableiten (empfohlen, B-120) oder zusätzlich einen Draft im sessionStorage halten? Soll ein „Setup zurücksetzen" (Admin-only) existieren?
2. **Setup-Gate serverseitig**: Route-Middleware mit 302 auf `/setup` (auch für No-JS) — gewünscht? Soll `/api/public/*` vor Abschluss 503 liefern statt leerer Firmendaten?
3. **Nummernkreise**: Admin-UI gewünscht (Template, Startwert, Vorschau, Sperre unter `next_value`)? Jahresreset für `{YYYY}`-Kreise? Allokation in der Beleg-Transaktion (erfordert Test-DB mit echten Transaktionen)?
4. **Logo-Speicherung**: weiterhin inline in der DB (einfaches Backup) oder Blob/Datei mit URL? Zulässige Formate (SVG rastern?) und Maximalgröße?
5. **Steuerdaten**: Steuernummer und USt-IdNr. — Pflicht/Format (DE-Muster) im Rewrite? Kleinunternehmer-Flag unter „Firma/Steuer" statt „Zahlungserinnerung" und soll es die MwSt.-Berechnung (0 %) überall steuern (B-133)?
6. **Standard-MwSt., Zahlungsziel, Währung, Geo**: editierbar machen (mit welchen Grenzen) oder Felder streichen?
7. **SMTP-Schritt im Wizard** beibehalten (optional) oder komplett in die Settings verlagern?
8. **Setup-Sicherheit**: Setup-Token/Netzwerk-Beschränkung für das anonyme Setup-Fenster (B-151)?
9. **Seeding-Strategie** im Nuxt-Rewrite: Boot-Task (Nitro-Plugin) vs. Migration-Seed vs. expliziter CLI-Schritt; Verhalten bei Seed-Fehler.
10. **Legacy `?tab=`-Redirects** beibehalten oder entfallen lassen (keine externen Links bekannt)?
11. **Rollen-Seed**: Werkstattleiter erhält automatisch jedes neue Modul — gewünscht? Soll `Mitarbeiter`-Liste im Rewrite identisch bleiben?
12. **Bundesland**: als feste Picklist (16) serverseitig validieren?

---

## 12. Gelesene Dateien

| Datei | Zeilen | Umfang |
|---|---|---|
| `src/routes/setup/+page.svelte` | 1148 | vollständig |
| `src/routes/setup/WizardHost.svelte` | 19 | vollständig |
| `src/routes/setup/setup.remote.ts` | 350 | vollständig |
| `src/routes/setup/setup.remote.test.ts` | 380 | vollständig |
| `src/routes/setup/wizard.test.ts` | 296 | vollständig |
| `src/routes/settings/+layout.svelte` | 118 | vollständig |
| `src/routes/settings/+page.svelte` | 486 | vollständig |
| `src/routes/settings/settings.remote.ts` | 450 | vollständig |
| `src/routes/settings/settings.remote.test.ts` | 387 | vollständig |
| `src/lib/server/services/settings-service.ts` | 14 | vollständig |
| `src/lib/server/services/settings-service.test.ts` | 56 | vollständig |
| `src/lib/server/services/number-range-service.ts` | 122 | vollständig |
| `src/lib/server/services/number-range-service.test.ts` | 133 | vollständig |
| `src/lib/server/services/smtp-settings-service.ts` | 76 | vollständig |
| `src/lib/server/services/smtp-settings-service.test.ts` | 128 | vollständig |
| `src/lib/server/db/seed-defaults.ts` | 376 | vollständig |
| `src/lib/server/db/seed-defaults.test.ts` | 136 | vollständig |
| `src/lib/server/db/smtp-settings.test.ts` | 85 | Kopf + Testnamen |
| `src/lib/server/db/validation.ts` | 315 | vollständig |
| `src/lib/server/db/validation.test.ts` | 262 | Testnamen |
| `src/hooks.server.ts` | 470 | vollständig |
| `src/hooks.server.test.ts` | 328 | vollständig |
| `src/lib/server/db/schema.ts` | 2025 | Auszüge 1-170, 988-1002, 1755-1800, 1885-1995 |
| `drizzle/0000_lying_tyger_tiger.sql` | 474 | Settings-Tabellen (company_settings, number_ranges, smtp_settings, mail_templates) |
| `drizzle/0018_company_geo.sql` | 12 | vollständig |
| `drizzle/0001, 0006, 0014, 0015, 0020, 0021, 0022, 0024, 0033` | — | grep/Auszüge zu company_settings/number_ranges/smtp_settings |
| `src/lib/utils/numbering.ts` / `numbering.test.ts` | 26 / 50 | vollständig / Testnamen |
| `src/lib/utils/iban.ts` / `iban.test.ts` | 58 / 50 | vollständig / Testnamen |
| `src/routes/layout.remote.ts` | 47 | vollständig |
| `src/routes/+layout.svelte` | 88 | vollständig |
| `src/routes/+error.svelte` | 77 | vollständig |
| `src/lib/components/ui/ImageUploader.svelte` | — | Auszug 1-260 (Props, Ingest, Markup single-mode) |
| `src/lib/components/ui/TabGroup.svelte` | — | Auszug 1-200 (Props, Nav-Modus, Markup) |
| `src/lib/components/layout/AppShell.svelte` | — | Auszug 25-75 (Unsaved-Changes-Guard) |
| `src/lib/components/layout/navigation.ts` | — | grep settings/setup |
| `src/lib/permissions.ts` | 53 | vollständig |
| `src/lib/server/auth-users.ts` | — | Auszug 50-90 (`createUserWithCredential`) |
| `src/lib/server/services/work-order-service.ts` | — | Auszug 974-997 (`getLaborRate`), grep defaultVatRate |
| `src/lib/server/services/item-service.ts` | — | Auszug 183-213 (`upsertItemPrice`) |
| `src/lib/server/services/workshop-hours-service.ts` | — | Auszug 1-100 |
| `src/lib/server/services/pdf-service.ts` | — | Auszüge 232-242, 575-625, 1146-1160, 1253-1263, 1988-1990 |
| `src/lib/server/services/xrechnung-service.ts` | — | grep smallBusinessExempt |
| `src/lib/server/services/mail-service.ts` | — | Auszug 95-120 |
| `src/lib/server/services/import-service.ts` | — | Auszug 1490-1522 |
| `src/lib/server/services/document-service.ts` | — | Auszug 170-245 |
| `src/routes/api/public/company/endpoint.ts` | — | Auszug 30-90 |
| `src/routes/login/+page.svelte` | — | Auszug 95-110 |
| `src/routes/settings/reminders/+page.svelte` | — | grep smallBusinessExempt |
| `e2e/settings.spec.ts` | 152 | vollständig |
| `e2e/smoke.spec.ts` | 134 | vollständig |
| `e2e/navigation.spec.ts` | 143 | vollständig |
| `docs/modules/setup.md` | 34 | vollständig |
| `docs/modules/settings.md` | 104 | vollständig |
| `docs/architecture/database-schema.md` | 196 | Auszüge 15-35, 80-90, 110-120 |
| `docs/operations/fresh-db-reset.md` | 39 | vollständig |
| `README.md` | — | Auszüge 226-248, 285-296 |
| `CLAUDE.md` | — | Setup-Gate-Abschnitt |
| `CONTRIBUTING.md` | — | Auszug 850-880 (§11 Forms) |
| `node_modules/svelte/src/internal/client/dom/elements/bindings/input.js` | — | grep `to_number` (Bestätigung B-122) |
