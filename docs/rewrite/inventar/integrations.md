---
title: Inventar Integrationen (EXT)
teil_von: docs/rewrite/01-inventar.md
stand: Bestand (SvelteKit) vor dem Rewrite
---

> **Detail-Inventar des Bestands.** Erhoben durch vollständiges Lesen der in
> Abschnitt „Gelesene Dateien" genannten Dateien. Die IDs wurden auf die
> globalen IDs aus [01-inventar.md](../01-inventar.md) umgestellt
> (83 IDs). Zurück: [01-inventar.md](../01-inventar.md) ·
> [02-befunde.md](../02-befunde.md)

# Modul: eBay-Anbindung (OAuth, Listing-Import, Account-Deletion-Compliance) und Legacy-Import KFZ-Kaufmann (.mdb)   (Kürzel: EXT)

Sprache: Deutsch für Fließtext/Tabellen; Code-Bezeichner, Dateipfade, Tabellen-/Spaltennamen bleiben englisch und exakt wie im Code.
Alles muss aus dem tatsächlich gelesenen Code stammen. Keine Vermutungen. Bei Unsicherheit "unklar" schreiben und Fundstelle nennen.
Fundstellen immer als `pfad/datei.ts:zeile`.

Alle Pfade relativ zu `/home/nick/tc/twincars-manager`, außer `Daten/…` (= `/home/nick/tc/Daten`).

## 1. Routen und Seiten

| Route | Datei | Parameter | Guard / Permission | Layout | Datenabhängigkeiten (Remote-Queries, Reihenfolge) | Zweck |
| --- | --- | --- | --- | --- | --- | --- |
| `/settings/ebay` | `src/routes/settings/ebay/+page.svelte` | Query-Flags vom OAuth-Callback: `?connected=1`, `?error=declined`, `?error=state`, `?error=exchange` (gelesen aus `window.location` in deferred `onMount` +150 ms, danach `replaceState('/settings/ebay', {})`, `+page.svelte:46-66`) | Session via `hooks.server.ts:221-229`; Tab nur sichtbar mit `settings` (`src/routes/settings/+layout.svelte:75-80`); alle Remotes `requirePermission('settings')` | `src/routes/settings/+layout.svelte` (nav-mode `TabGroup`, Tab-ID `ebay`, Label „eBay") | 1. `await getEbayStatusRemote()` (`+page.svelte:30-32`), 2. `await getEbayImportInfoRemote()` (`:93-95`), 3. `await untrack(() => listEbayListingsRemote(queryArgs))` mit `{page, size:25, q?, status?}` (`:105-113`); danach reaktiv `listEbayListingsRemote(queryArgs).current ?? lastResult` (`:120-131`) | Verkäuferkonto verbinden/trennen, Angebots-Import starten, importierte Angebote suchen/filtern/paginieren |
| `/settings/import` | `src/routes/settings/import/+page.svelte` | keine | Session; Tab mit `import` (`+layout.svelte:81-86`); Remotes `requirePermission('import')` | Settings-Layout (Tab-ID `import`, Label „Import") | keine Query beim Laden; `runMdbImportRemote` (command) auf Klick; `getImportProgressRemote().run()` im 1-s-Poll während des echten Imports (`+page.svelte:42-64`) | `.mdb` hochladen, Vorschau (Dry-Run), destruktiver Import mit Fortschritt und Ergebnis-Modal |
| `GET /api/ebay/oauth/callback` | `src/routes/api/ebay/oauth/callback/+server.ts` → `endpoint.ts` | `?code=…&state=…(&expires_in=…)` | Session-gated (NICHT in `PUBLIC_PREFIXES`, `hooks.server.ts:61-72`); CSRF über HMAC-`state` | – | `verifyOauthState` → `exchangeAuthCode` (`endpoint.ts:33-51`) | eBay „Auth Accepted URL" (RuName); alle Ausgänge → `303 /settings/ebay?<flag>` |
| `GET /api/ebay/account-deletion` | `src/routes/api/ebay/account-deletion/+server.ts` → `endpoint.ts` | `?challenge_code=…` | öffentlich (Whitelist `hooks.server.ts:68`), Rate-Limit `hooks.server.ts:141-167` | – | keine DB | eBay Challenge-Handshake |
| `POST /api/ebay/account-deletion` | dito | JSON-Body (Notification) | öffentlich, Rate-Limit | – | keine DB | eBay Marketplace-Account-Deletion-Notification (nur Log) |
| Sidebar | `src/lib/components/layout/navigation.ts:233-246` | – | `settings` | – | – | Gruppe „System" enthält nur „Einstellungen"; eBay/Import ausschließlich als Settings-Tabs (`:236-238`) |

Legacy-Redirects: `/settings?tab=mail|reminders|smtp` → eigene Routen (`src/routes/settings/+page.svelte:36-45`); für `ebay`/`import` gibt es keinen Legacy-Deep-Link (kein `?tab=`-Eintrag). Ein früheres Top-Level `/import` existiert nicht mehr (`docs/modules/import.md:12-14`; Dockerfile-Kommentar `Dockerfile:39` nennt es noch, siehe B-549).

## 2. Remote Functions und Endpoints

### eBay (`src/routes/settings/ebay/ebay.remote.ts`)

- **getEbayStatusRemote** — query (ohne Args) — `ebay.remote.ts:32-35`
  - Guard: `requirePermission('settings')`
  - Argumente: keine
  - Rückgabe: `EbayConnectionStatus` = `{ configured, missingConfig: string[], environment: 'production'|'sandbox', connected, ebayUsername, connectedAt, accessTokenExpiresAt, refreshTokenExpiresAt }` (`ebay-auth-service.ts:269-293`). Kein Token-Material.
  - Fehlerfälle: 401 „Bitte melden Sie sich an." / 403 „Keine Berechtigung für diese Aktion." (`src/lib/server/auth-guards.ts:26,40`)
  - Nebenwirkungen: keine. Transaktion: nein.

- **startEbayConnectRemote** — command (ohne Args) — `ebay.remote.ts:45-49`
  - Guard: `requirePermission('settings')`
  - Rückgabe: `{ url }` – Consent-URL mit frischem HMAC-`state` (`buildAuthorizeUrl`, `ebay-auth-service.ts:120-131`)
  - Fehlerfälle: plain `Error('eBay ist nicht konfiguriert - fehlende Umgebungsvariablen: …')` (`ebay-auth-service.ts:76-78`), `Error('APP_SECRET ist nicht gesetzt.')` (`:93`) – KEIN `error(status)`; siehe B-532.
  - Nebenwirkungen: keine DB. Transaktion: nein.

- **disconnectEbayRemote** — command (ohne Args) — `ebay.remote.ts:58-62`
  - Guard: `requirePermission('settings')`
  - Nebenwirkungen: `DELETE FROM ebay_credentials` (alle Zeilen, `ebay-auth-service.ts:300-302`); `await getEbayStatusRemote().refresh()` (single-flight). Keine Revocation bei eBay (Kommentar `:295-299`). Transaktion: nein.

- **listEbayListingsRemote** — query(schema) — `ebay.remote.ts:84-90`
  - Guard: `requirePermission('settings')`
  - Argumente (`listListingsSchema`, `:66-75`): `page: number` („Bitte eine Seite angeben."), `minValue(1, 'Seite muss mindestens 1 sein.')`, `maxValue(100_000, 'Seite ist zu groß.')`; `size: picklist([10,25,50,100])` (ohne deutsche Meldung); `q?: searchQuerySchema` (trim, `maxLength(200, 'Der Suchbegriff darf maximal 200 Zeichen lang sein.')`, `src/lib/server/db/validation.ts:279-283`); `status?: picklist(['active','ended'])` (ohne Meldung).
  - Rückgabe: `ListResult<EbayListing>` = `{ items, total, page, size, pageCount }`
  - Nebenwirkungen: keine. Transaktion: nein.

- **getEbayImportInfoRemote** — query (ohne Args) — `ebay.remote.ts:98-101`
  - Guard: `requirePermission('settings')`
  - Rückgabe: `{ lastRun: EbayImportRun|null, listingCount, activeCount }` (`ebay-listing-service.ts:520-549`)

- **importEbayListingsRemote** — command (ohne Args) — `ebay.remote.ts:113-122`
  - Guard: `requirePermission('settings')`
  - Rückgabe: `EbayImportResult = { runId, imported, updated, ended, failed, totalActive }`
  - Fehlerfälle (kuratiert, `ebay-listing-service.ts:46-58`): 409 `notConnected` „Kein eBay-Konto verbunden. Bitte zuerst unter Einstellungen → eBay verbinden."; 409 `tokenExpired` (HTTP 401 oder Trading-`ErrorCode` ∈ {931, 932, 17470, 21916984}, `:186,241-243,269-271`); 502 `refreshFailed` (Refresh-Grant scheitert, `:307-311`); 502 `unreachable` (HTTP ≠ 200 oder Transport-Exception/Timeout 30 s, `:245-250,359-366`); 502 `rejected` (Ack ≠ Success/Warning ohne Token-Code, `:272`); 502 `malformed` (Body ohne `<GetMyeBaySellingResponse`, `:252-258`).
  - Nebenwirkungen: externe Calls Trading API (+ ggf. Token-Refresh); Insert `ebay_import_runs`; Upsert `ebay_listings`; `requested(listEbayListingsRemote, 4).refreshAll()` im Erfolgsfall; `finally: getEbayImportInfoRemote().refresh()`. Transaktion: nein (siehe B-555).

### Import (`src/routes/settings/import/import.remote.ts`)

- **runMdbImportRemote** — command(schema) — `import.remote.ts:18-48`
  - Guard: `requirePermission('import')` (`:34`)
  - Argumente: `fileBase64: pipe(string(), maxLength(60_000_000))` – Data-URL oder reines base64, KEINE deutsche Meldung an beiden Pipe-Schritten (`:24`); `dryRun?: boolean` (`:31`). Kein `FIELD_LABELS`-Eintrag für `fileBase64`/`dryRun` in `hooks.server.ts` (grep leer).
  - Verarbeitung: alles nach dem ersten `,` ist base64 (`:35-36`); `Buffer.from(b64,'base64')` (wirft praktisch nie; catch → 400 „Datei konnte nicht gelesen werden.", `:38-42`); `< 1024 Bytes` → 400 „Datei ist zu klein für eine gültige Access-Datenbank." (`:43-45`). Keine Magic-Byte-/MIME-Prüfung.
  - Rückgabe: `ImportSummary` (`import-service.ts:68-127`)
  - Fehlerfälle: alle Fehler aus `importMdb` (mdb-export-Exit, DB-Fehler) sind plain Errors → generische 500-Meldung über `handleError`; kein kuratierter Grund (B-548).
  - Nebenwirkungen: siehe §3 `importMdb`. Keine `refreshAll`-Ziele (Listen anderer Module werden nicht invalidiert – nach dem Import zeigen offene Listen ggf. `lastResult`-Stände, bis neu geladen wird). Transaktion: nein.

- **getImportProgressRemote** — query (ohne Args) — `import.remote.ts:59-74`
  - Guard: `requirePermission('import')`
  - Rückgabe: neueste Zeile aus `access_import_jobs` (`ORDER BY started_at DESC LIMIT 1`): `{ id, status, progress, progressLabel, startedAt, finishedAt } | null` – unabhängig vom Status (auch `completed`/`failed`).

### HTTP-Endpoints (dokumentierte `+server.ts`-Ausnahmen #3 und #4)

- **GET /api/ebay/account-deletion** — `account-deletion/endpoint.ts:74-121`
  - Guard: öffentlich (Whitelist `hooks.server.ts:68`), Rate-Limit `public-api:*` 120/min + 60 Burst, Bucket = Bearer-Prefix oder IP (`hooks.server.ts:141-167`) → 429 `{ message: 'Zu viele Anfragen. Bitte reduzieren Sie die Aufrufrate.' }`.
  - Verhalten: `EBAY_VERIFICATION_TOKEN` fehlt → 503 `{ error: 'EBAY_VERIFICATION_TOKEN is not configured.' }` (`:76-85`); `challenge_code` fehlt → 400 (`:87-94`); `endpointUrl = EBAY_DELETION_ENDPOINT_URL.trim() || origin+pathname` (`:101-103`); Antwort 200 `{ challengeResponse: hex(sha256(challengeCode ‖ verificationToken ‖ endpointUrl)) }` (`computeChallengeResponse`, `:61-71`); `console.info('[ebay] account-deletion challenge served (endpoint=…)')` (`:107-109`).

- **POST /api/ebay/account-deletion** — `account-deletion/endpoint.ts:134-159`
  - Immer `200` (auch bei unparsebarem Body, `:153-158`). Liest `metadata.topic`, `notification.notificationId`, `data.username`, `data.userId` und loggt sie (`:144-148`). **Keine Datenlöschung**, keine Signaturprüfung (`X-EBAY-SIGNATURE`) – siehe B-521/02.

- **GET /api/ebay/oauth/callback** — `oauth/callback/endpoint.ts:30-52`
  - Guard: Session (Redirect `/login?redirectTo=…` falls anonym, `hooks.server.ts:223-227`). Kein Permission-Check auf `settings` im Endpoint selbst (B-531).
  - `!code` → `303 /settings/ebay?error=declined` (`:36-39`); `!state || !verifyOauthState(state)` → `?error=state` + `console.warn` (`:40-43`); `exchangeAuthCode` wirft → `?error=exchange` + `console.error('[ebay] OAuth code exchange failed:', err)` (`:45-50`); sonst `?connected=1` (`:51`).

## 3. Services (Server-Layer)

### `src/lib/server/services/ebay-auth-service.ts` (302 Zeilen)

| Funktion | Signatur | Beschreibung / DB | Fehler |
| --- | --- | --- | --- |
| `ebayEnvironment()` | `(): 'production'\|'sandbox'` | `EBAY_ENV === 'sandbox'` sonst production (`:42-43`); Hosts `auth.ebay.com`/`auth.sandbox.ebay.com`, `api.ebay.com`/`api.sandbox.ebay.com`, `apiz.ebay.com`/`apiz.sandbox.ebay.com` (`:45-57`) | – |
| `EBAY_SCOPES` | const | `sell.inventory` + `commerce.identity.readonly` (`:59-62`) | – |
| `missingEbayConfig()` | `(): string[]` | fehlende von `EBAY_CLIENT_ID`, `EBAY_CERT_ID`, `EBAY_RU_NAME` (`:67-71`); `readEnv` = `process.env` vor `$env/dynamic/private` (`:35-36`) | – |
| `createOauthState(now?)` | `(now=Date.now()): string` | `<ts>.<16 Byte hex nonce>.<hmac-sha256(APP_SECRET, ts.nonce) hex>` (`:97-103`) | `APP_SECRET ist nicht gesetzt.` (`:93`) |
| `verifyOauthState(state, now?)` | `(): boolean` | 3 Teile, `timingSafeEqual` auf Signatur, `0 ≤ now-ts ≤ 10 min` (`:105-115`) | – |
| `buildAuthorizeUrl()` | `(): { url, state }` | `GET {AUTH_HOST}/oauth2/authorize?client_id&redirect_uri=<RuName>&response_type=code&scope&state&locale=de-DE` (`:120-131`) | `requireConfig` (`:73-85`) |
| `exchangeAuthCode(code)` | `(code): Promise<void>` | `POST {API_HOST}/identity/v1/oauth2/token` (Basic `client_id:cert_id`, `grant_type=authorization_code&code&redirect_uri=<RuName>`, `:143-166,189-200`); ohne `refresh_token` → Error (`:201-203`); Username best-effort `GET {APIZ_HOST}/commerce/identity/v1/user/` (`:169-181`, nie werfend); `DELETE ebay_credentials` dann `INSERT` (Single-Row, `:208-221`): Tokens `encryptSecret(...)`, `accessTokenExpiresAt = now + expires_in`, `refreshTokenExpiresAt = now + refresh_token_expires_in` (oder null), `scopes = EBAY_SCOPES`, `environment` | `eBay-Token-Endpunkt antwortete mit <status>: <≤300 Zeichen Body>` (`:159-163`); `eBay lieferte keinen Refresh-Token.` |
| `getValidAccessToken()` | `(): Promise<string>` | `SELECT … LIMIT 1` (`:224-227`); gültig wenn `accessTokenExpiresAt - 60 s > now` (`:241-247`); sonst `grant_type=refresh_token` (`:252-257`), `UPDATE` access-Token-Spalten + `updatedAt` (`:258-265`). Prüft NICHT `refreshTokenExpiresAt` und NICHT `row.environment === ebayEnvironment()` (B-524/05). Keine Timeouts an `fetch` (B-554). | `Kein eBay-Konto verbunden. Bitte unter Einstellungen → eBay verbinden.` (`:237-239`) |
| `getConnectionStatus()` | `(): Promise<EbayConnectionStatus>` | Status ohne Token-Material (`:281-293`) | – |
| `disconnectEbay()` | `(): Promise<void>` | `DELETE ebay_credentials` (`:300-302`) | – |

Performance: Single-Row-Tabelle, unkritisch. Hinweis: `delete` + `insert` in `exchangeAuthCode` sind zwei Statements ohne Transaktion (`:208-221`).

### `src/lib/server/services/ebay-listing-service.ts` (549 Zeilen)

| Funktion | Signatur | Beschreibung / DB | Fehler |
| --- | --- | --- | --- |
| `importEbayListings(opts?)` | `({ transport?: EbayTradingTransport }): Promise<EbayImportResult>` (`:330-478`) | 1) Token via `requireAccessToken` (`:298-312`, Mapping auf 409/502). 2) `INSERT ebay_import_runs { environment }` (`:337-340`). 3) Schleife `POST {TRADING_URL}` (`api.ebay.com/ws/api.dll` bzw. sandbox, `:75-78`) Header `Content-Type: text/xml`, `X-EBAY-API-COMPATIBILITY-LEVEL: 1193`, `X-EBAY-API-CALL-NAME: GetMyeBaySelling`, `X-EBAY-API-SITEID: 77`, `X-EBAY-API-IAF-TOKEN: <access token>` (`:349-358`); Body `GetMyeBaySellingRequest/ActiveList/Include=true, Pagination EntriesPerPage=200, PageNumber` (`:167-180`); bis `page ≥ TotalNumberOfPages` oder `MAX_PAGES=50` (`:371`); Timeout 30 s pro Request (`:84,98`). 4) `SELECT * FROM ebay_listings WHERE environment=…` (Full-Scan pro Env, `:376-380`), pro Item UPDATE (existiert) oder INSERT, `status='active'`, `lastSeenAt/updatedAt=now` (`:385-433`); Dedupe über `seen`-Set. 5) Vorher aktive, nicht gesehene → `UPDATE … status='ended'` (`:436-444`). 6) `UPDATE ebay_import_runs` success + Zähler (`:454-465`); im catch `status='failed', error=<kuratiert oder 'Der Import ist unerwartet fehlgeschlagen.'>` (`:467-477`) und rethrow. | siehe §2 |
| `parseItem(block)` | intern (`:212-233`) | Mapping `<Item>`: `ItemID` (Pflicht), `Title` (Pflicht, `slice(0,255)`), `SKU`, `CurrentPrice` (Text → `toFixed(2)`, Attribut `currencyID`), `QuantityAvailable ?? Quantity`, `QuantitySold`, `ListingType`, `ViewItemURL`, `GalleryURL`, alle `PictureURL`, `StartTime`, `EndTime`. Fehlt ItemID/Title → `null` → zählt als `failed`/„übersprungen". XML per Regex (`textOf`/`blockOf`/`allTextsOf`/`attrOf`, `:105-145`), Entity-Decoding exakt einmal (`:105-115,275-278`). | – |
| `listEbayListings(params)` | `(ListParams & { status? }): Promise<ListResult<EbayListing>>` (`:488-518`) | `WHERE environment = ebayEnvironment()` [+ `ilike` auf `title`/`sku`/`ebayItemId` mit `%q%`] [+ `status`]; `ORDER BY status ASC, title ASC` (aktiv vor beendet); `LIMIT/OFFSET`; `count()` parallel. Kein Index auf `title`/`sku` (nur `ebay_listings_status_idx`, `schema.ts:1645`). | – |
| `getEbayImportInfo()` | `(): Promise<EbayImportInfo>` (`:527-549`) | letzter Run (`ORDER BY startedAt DESC LIMIT 1`, per Env), `count(*)` gesamt und `status='active'` (3 Roundtrips) | – |

### `src/lib/server/crypto.ts` (92 Zeilen)

| Funktion | Beschreibung |
| --- | --- |
| `encryptSecret(plain)` | AES-256-GCM, Key = `sha256(APP_ENCRYPTION_KEY || APP_SECRET)` (`:30-38`), IV 12 Byte random, Format `v1:<b64 iv>:<b64 tag>:<b64 data>` (`:41-55`). Wirft `Weder APP_ENCRYPTION_KEY noch APP_SECRET ist gesetzt - Verschlüsselung nicht möglich.` |
| `decryptSecret(stored)` | Gegenstück; `Unbekanntes Chiffrat-Format.` bei ≠ 4 Teilen / falscher Version (`:76-92`); GCM-Tag-Fehler wirft Node-Error |
| `isEncryptedSecret(v)` / `decryptSecretIfNeeded(v)` | Erkennung `v1:` + 4 Teile; Plaintext-Passthrough für Legacy-Zeilen (`:58-70`) |

### `src/lib/utils/ebay-detection.ts` (34 Zeilen)

`isEbayCustomerName(fields)` – true, wenn irgendein Feld (case-insensitive) den Substring `ebay` enthält; Felder werden nicht kombiniert; `null/undefined/''` nie (`:23-34`). Nur zur Import-Zeit verwendet (`import-service.ts:611-618`).

### `src/lib/server/services/import-service.ts` (1591 Zeilen)

| Funktion | Signatur | Beschreibung |
| --- | --- | --- |
| `importMdb(buffer, opts?)` | `(Buffer, { dryRun?: boolean }): Promise<ImportSummary>` (`:406-418`) | `mkdtemp(os.tmpdir()/tc-import-)` → `writeFile(<dir>/kfz-kaufmann.mdb)` → `runImport` → `finally rm -rf dir`. |
| `runImport(mdbPath, dryRun)` | intern (`:420-536`) | Dry-Run: nur `runImportSteps(…, true, noop)`, KEINE Audit-Zeile (`:468-471`). Echt: `INSERT access_import_jobs { status:'running', progressLabel:'Datei wird gelesen …' }` (`:476-479`); `onProgress(pct,label)` schreibt gedrosselt bei ganzzahliger Änderung, geclamped 0–99 (`:484-492`); bei Throw `status='failed', finishedAt, notes='Import fehlgeschlagen: <err.message>'` (`:496-506`) + rethrow; Erfolg: `status='completed', progress=100, progressLabel='Abgeschlossen', tablesProcessed=13, rowsImported, rowsSkipped, notes='Kunden …, Fahrzeuge …, Artikel …, Belege …, übersprungen …'` (`:522-534`). |
| `runImportSteps(...)` | intern (`:538-1591`) | Die eigentliche Pipeline, Schritte 1–14 (siehe §6 Flow „Import" und §9). `insertRows` ist im Dry-Run ein No-op (`:548-553`). |
| `dumpTable(mdbPath, table)` | intern (`:137-156`) | `exec("mdb-export -d ';' -D '%Y-%m-%d %H:%M:%S' -T '%Y-%m-%d %H:%M:%S' '<path>' '<table>'")`, `maxBuffer 256 MB`; Shell-Quoting via `shellQuote` (`:134`); CSV-Parse `csv-parse/sync` (`columns:true, delimiter:';', quote/escape '"', relax_column_count, skip_empty_lines, bom`). Tabellen-Namen sind Konstanten, Pfad kommt aus `mkdtemp` → kein Injection-Vektor gefunden (B-547 zu `exec` vs `execFile`). |
| `wipeData()` | intern (`:357-389`) | 25 `DELETE`-Statements in FK-Reihenfolge, **ohne Transaktion**: `reminder_pdfs, reminders, document_pdfs, document_payments, document_items, documents, employee_salary_versions, employee_absences, employees, tire_storage, vehicle_photos, vehicle_sales, vehicle_listings, vehicle_purchases, vehicle_license_plate_versions, vehicles, item_price_versions, items, suppliers, customers, calendar_entries, recurring_entries, ledger_entries, sent_messages`. NICHT geleert: `work_orders(+assignees/items)`, `time_entries`, `customer_inquiries`, `tires(+versions/photos)`, `tire_reminder_log`, `posts`, `vehicle_documents` (cascade über vehicles), Settings/Templates/Number-Ranges/Ledger-Categories/Users. |
| `insertInBatches(rows, fn)` | intern (`:393-402`) | Chunks à 1000 Zeilen. |
| `__transforms` | export (`:337-353`) | Reine Helfer für Tests: `trim, clip, toInt, toFloat, toBool, isValidYmd, isoDate, isoTimestamp, parseLooseDate, splitMakeModel, mapArtToKind, mapInvoiceStatus, mapOfferStatus, mapOfferType, mapStorageSeason`. |

Feldregeln der Transformer (`:158-328`):
- `trim`: leer → `null`. `clip(v, n)`: hartes Abschneiden auf Schema-Länge.
- `toInt` (`parseInt`), `toFloat` (`parseFloat`, Punkt-Dezimal wie von mdb-export), `toBool` (`'1'`/`'true'`).
- `isValidYmd`: Jahr 1900–2100, Monat 1–12, Tag 1–31 (kein Kalender-Check).
- `isoDate`: `^YYYY-MM-DD` aus mdb-export-Timestamp, plausibilisiert, sonst `null`.
- `isoTimestamp`: `'YYYY-MM-DD HH:MM:SS'` → `new Date(… 'T' … 'Z')` = **als UTC** interpretiert (`:212-217`).
- `parseLooseDate` (EZ/HU): ISO, `MM.YYYY`, `MM/YY` (yy ≥ 70 → 19yy sonst 20yy), `DD.MM.YYYY`; sonst `null` (`:227-265`). Doc nennt `MM-YY` (B-549).
- `splitMakeModel`: Split am ersten Leerzeichen (`:268-276`).
- `mapArtToKind`: `leistung*`→`service`, `material*`→`material`, `durchlauf*`→`pass_through`, sonst `article`.
- `mapInvoiceStatus`: enthält `storniert` → `cancelled`; sonst **immer** `paid` (`:288-298`).
- `mapOfferStatus`: `storniert` → `cancelled`, sonst `sent`. `mapOfferType`: enthält `kostenvoranschlag`/`kv` → `cost_estimate`; `auftrag`/`ab` → `order_confirmation`; sonst `offer` (`:308-314`).
- `mapStorageSeason`: `winter`/`sommer`/`ganzjahr|allseason|allwetter` → `winter|summer|allseason`, sonst `null`.

Performance-Anmerkungen: 13 `mdb-export`-Prozesse **parallel** (`Promise.all`, `:572-586`), jeder mit bis zu 256 MB stdout-Puffer; alle Zeilen aller Tabellen gleichzeitig im Speicher; PDF-Vorab-Rendering mit `PARALLEL = 8` Worker (`:1564-1579`), Mahnungs-PDFs sequenziell (`:1581-1590`); Fortschritts-UPDATE pro Prozent (max. ~100 Writes). Keine Transaktion (ADR-004).

## 4. Komponenten (modul-lokal)

| Komponente | Datei | Zweck | Props | Events/Callbacks | Snippets/Slots | Interner State | Verwendete Shared-Komponenten |
| --- | --- | --- | --- | --- | --- | --- | --- |
| eBay-Settings-Seite | `src/routes/settings/ebay/+page.svelte` | Status-Karte, Import-Karte, Angebotstabelle | – (Page) | `connect`, `disconnect`, `runImport`, `onSearchInput` (250 ms Debounce, setzt `pageNum=1`), `openListing` (`window.open(url,'_blank','noopener')`) | – | `confirmOpen`, `pageNum`, `q`, `statusFilter: 'all'\|'active'\|'ended'`, `lastResult`, `searchTimer` | `PageHeader` (`back="/settings"`), `ConfirmDialog`, `EmptyState`, `Pagination`, Lucide `Store, Link2, Unlink, CircleCheck, CircleAlert, CloudDownload, PackageSearch, Search`; `busy`, `toast`, `handleClientError` |
| `EbayHost` | `src/routes/settings/ebay/EbayHost.svelte` | Test-Host: wickelt die Page in `<svelte:boundary>` mit `pending`-Snippet (`data-testid="ebay-pending"`) | – | – | `pending` | – | – (nur Tests) |
| Import-Seite | `src/routes/settings/import/+page.svelte` | Upload-Karte, Hinweise-Karte, Fortschrittsbalken, Confirm, Ergebnis-Modal | – (Page) | `onPicked` (Endung `/\.mdb$/i`, sonst Toast „Bitte eine .mdb-Datei auswählen."), `runImport(dryRun)`, `requireFile()` (Click-Time: „Bitte zuerst eine .mdb-Datei auswählen.") | – | `fileInput`, `pickedFile`, `confirmOpen`, `resultOpen`, `summary`, `errorMsg`, `liveProgress {pct,label}`, `pollTimer` (1 s) | `PageHeader`, `ConfirmDialog`, Lucide `Database, Upload, AlertTriangle, Info`; `busy`, `toast`, `handleClientError`. Ergebnis-Modal ist handgebautes DaisyUI-`modal modal-open` (kein Shared-Dialog). |

## 5. Tabellen

| Tabelle | Relevante Spalten / Status | Fundstelle |
| --- | --- | --- |
| `ebay_credentials` | Single-Row: `ebay_username`, `access_token` (verschlüsselt, nullable), `access_token_expires_at`, `refresh_token` (verschlüsselt, NOT NULL), `refresh_token_expires_at`, `scopes`, `environment` (`production`\|`sandbox`, default production), `connected_at`, `updated_at` | `schema.ts:1561-1584`, `drizzle/0030_ebay_credentials.sql` |
| `ebay_listings` | `ebay_item_id` varchar(30), `sku` varchar(80), `title` varchar(255), `price_value` numeric(12,2), `price_currency` varchar(3), `quantity_available`, `quantity_sold`, `listing_type` varchar(30), `status` (`active`\|`ended`), `view_item_url`, `gallery_url`, `picture_urls` jsonb string[], `start_time`, `end_time`, `environment`, `tire_id` FK `tires` ON DELETE SET NULL (**unbenutzt**), `first_imported_at`, `last_seen_at`, `updated_at`; Unique `(environment, ebay_item_id)`, Index `status` | `schema.ts:1597-1647`, `drizzle/0036_ebay_listings.sql` |
| `ebay_import_runs` | `started_at`, `finished_at`, `status` (`running`→`success`\|`failed`), `imported`, `updated`, `ended`, `failed`, `total_active`, `error` (nur kuratiert), `environment` | `schema.ts:1655-1678`, `0036` |
| `access_import_jobs` | `started_at`, `finished_at`, `status` (`running`\|`completed`\|`failed`), `progress` 0–100, `progress_label` varchar(200), `tables_processed`, `rows_imported`, `rows_skipped`, `notes` | `schema.ts:1103-1118`, `drizzle/0000_lying_tyger_tiger.sql:1-10`, `0031_import_job_progress.sql` |
| Legacy-ID-Spalten | `customers.legacy_customer_number` (`:172`), `customers.kind` (`regular`\|`ebay`, `:201`), `customers.ebay_handle` (`:203`, vom Import NICHT befüllt), `vehicles.legacy_vehicle_id` (`:259`), `items.legacy_item_number` (`:441`), `suppliers.legacy_supplier_number` (`:513`), `documents.legacy_document_number` (`:549`), `tires.legacy_article_number` (`:1332`, vom Import NICHT befüllt) | `src/lib/server/db/schema.ts` |
| Import-Zieltabellen | `customers`, `vehicles`, `vehicle_license_plate_versions`, `suppliers`, `items`, `item_price_versions`, `documents`, `document_items`, `document_payments`, `reminders`, `tire_storage`, `employees`, `calendar_entries`, `number_ranges` (UPDATE), `document_pdfs`/`reminder_pdfs` (über pdf-service) | `import-service.ts:594-1591` |
| Unique-Indizes mit Kollisionsrisiko | `customers_customer_number_idx` (`:228`), `items_article_number_idx` (`:475`), `documents_document_number_idx` (`:640`), `reminders_invoice_level_idx (invoice_id, level)` (`:784`), `tire_storage_storage_number_idx` (`:1727`) | `schema.ts` |
| `number_ranges` | `kind` unique, `format_template`, `next_value` | `schema.ts:141-146` |

Migrationen `0002_gigantic_leopardon.sql` / `0003_daily_shocker.sql`: grep auf `import|legacy` liefert nichts – nicht import-bezogen. `0004_steady_redwing.sql` legt nur `payslip_pdfs` an (Payroll, inzwischen entfernt) – nicht import-bezogen.

## 6. Flows (durchgängig, Start bis Ende)

- **eBay verbinden** — `/settings/ebay` → Button „Mit eBay verbinden" (`+page.svelte:233-244`, nur wenn `configured && !connected`) → `busy.run(startEbayConnectRemote)` → `window.location.href = url` (`:73-80`) → eBay-Consent → eBay redirectet auf die RuName-Accept-URL = `GET /api/ebay/oauth/callback?code&state` → `303 /settings/ebay?connected=1` → Toast „eBay-Konto erfolgreich verbunden." (`:51-52`) → URL bereinigt.
  - Leerzustand: `!configured` → `alert-warning` „Die eBay-Anbindung ist serverseitig noch nicht vollständig konfiguriert. Fehlende Umgebungsvariablen: <Liste>. …" (`:187-197`), kein Connect-Button.
  - Ladezustand: globaler `busy`; Spinner im Button (`:239-241`).
  - Validierungsfehler: keine Formulareingaben.
  - Fehlerzustand: `startEbayConnectRemote` wirft → `handleClientError(err, 'Verbindung konnte nicht gestartet werden')` (`:78`); Callback-Flags: `declined` → „Die Verbindung wurde bei eBay abgelehnt."; `state` → „Die Anfrage war abgelaufen oder ungültig. Bitte erneut verbinden."; `exchange` → „Der Token-Austausch mit eBay ist fehlgeschlagen." (`:53-61`).
  - Abbruchpfade: Consent bei eBay verweigern → `?error=declined`. Session während Consent abgelaufen → Callback landet auf `/login?redirectTo=/api/ebay/oauth/callback?…`.
  - Berechtigungs-Verweigerung: ohne `settings` kein Tab; Remote → 403 „Keine Berechtigung für diese Aktion.".
  - Bestätigungsdialoge: keine.

- **eBay-Verbindung trennen** — Button „Verbindung trennen" (`:217-224`) → `ConfirmDialog` Titel „eBay-Verbindung trennen?", Text „Die gespeicherten Zugriffstoken werden gelöscht. Die Synchronisation stoppt, bis das Konto erneut verbunden wird.", Confirm „Trennen", `variant="danger"` (`:425-433`) → `disconnectEbayRemote` → Toast „eBay-Verbindung getrennt." (`:85`) → Status-Karte wechselt (Query-Refresh serverseitig).
  - Fehler: `handleClientError(err)`.

- **eBay-Angebote importieren** — Karte „eBay-Angebote" → Button „Angebote importieren" (immer klickbar, nur `busy.active` disabled, `:298-308`) → `busy.run(importEbayListingsRemote)` → Toast „Import abgeschlossen: N neu, N aktualisiert, N beendet[, N übersprungen]." (`:145-151`).
  - Leerzustand: `!status.connected` → Hinweis `role="note"` „Noch kein eBay-Konto verbunden — der Import setzt eine bestehende Verbindung voraus." (`:268-276`); Info „Noch kein Import durchgeführt." (`:280-281`).
  - Fehlerzustand: `handleClientError(err, 'Der Angebots-Import ist fehlgeschlagen')` → Toast „Der Angebots-Import ist fehlgeschlagen: <kuratierte Meldung>"; Karte zeigt „Letzter Import am <Datum> fehlgeschlagen: <error>" in `text-error` (`:282-288`).
  - Erfolgsanzeige: „Letzter Import: <Datum> – N neu, N aktualisiert, N beendet[, N übersprungen]." + Badge „N aktiv / N gesamt" (`:255-259,289-296`).
  - Bestätigungsdialoge: keine.

- **Importierte Angebote durchsuchen** — Karte „Importierte Angebote": Suchfeld (Platzhalter „Titel, SKU, Artikelnr. …", `maxlength=200`, 250 ms Debounce, setzt Seite 1), `<select>` „Alle Status / Aktiv / Beendet" (Änderung → Seite 1), Tabelle (Angebot mit Thumbnail `galleryUrl` + Titel + „SKU …", eBay-Artikelnr., Preis `de-DE` currency, Verfügbar, Verkauft, Status-Badge, Läuft bis), Row-Click öffnet `viewItemUrl` in neuem Tab, `Pagination` mit `size=25` (`:314-422`).
  - Leerzustand: `EmptyState` „Noch keine Angebote importiert" / „Nach dem Verbinden des Verkäuferkontos können die aktiven Angebote importiert werden."; bei Suche/Filter „Keine Angebote gefunden" / „Für die aktuelle Suche bzw. den Filter gibt es keine Treffer." (`:345-354`).
  - Fehler: Query-`error` → `handleClientError` (`:130`).

- **Compliance-Challenge (eBay → App)** — eBay ruft `GET /api/ebay/account-deletion?challenge_code=…` → 200 JSON mit Hash; ohne Token 503, ohne Code 400. Keine UI.

- **Account-Deletion-Notification (eBay → App)** — `POST` → 200, Logzeile. Keine UI, keine Datenänderung.

- **KFZ-Kaufmann-Vorschau (Dry-Run)** — `/settings/import` → Datei wählen (`accept=".mdb,application/vnd.ms-access,application/x-msaccess"`, `:153-160`) → „Vorschau (ohne Speichern)" (`:197-206`) → `requireFile()` → `readAsDataUrl` → `runMdbImportRemote({ fileBase64, dryRun:true })` → Ergebnis-Modal „Vorschau des Imports" mit Info-Banner „Es wurde nichts gespeichert. …" (`:276-286`), Zähltabelle, ggf. Bestandskorrektur-Hinweis, Skip-Zusammenfassung, Drop-Detailtabelle, Warnbox, Buttons „Schließen" / „Jetzt wirklich importieren" (öffnet ConfirmDialog, `:476-489`). Datei bleibt ausgewählt.
  - Leerzustand: keine Datei → `alert-error` „Bitte zuerst eine .mdb-Datei auswählen." (`:24-31,190-194`).
  - Ladezustand: nur globaler `busy` (kein Fortschrittsbalken im Dry-Run, `:102`).
  - Fehler: `handleClientError(err, 'Vorschau fehlgeschlagen')`.

- **KFZ-Kaufmann-Import (destruktiv)** — „Import starten" (`:207-217`) → `requireFile()` → `ConfirmDialog` Titel „Import jetzt starten?", Text „Bestehende Stammdaten und Belege werden vorher gelöscht. Der Vorgang kann je nach Datenmenge eine Minute dauern.", Confirm „Jetzt importieren", Cancel „Abbrechen", `variant="danger"` (`:259-268`) → `startProgressPolling()` (1 s, `getImportProgressRemote().run()`, ignoriert Jobs mit `startedAt < clientNow − 60 s`, `:42-64`) → `runMdbImportRemote({ fileBase64, dryRun:false })` → Serverpipeline (§3): 1 Lesen aller 13 Tabellen (`Kunden, Autos, Lieferanten, Artikel, Rechnungen, RechnungDetails, Angebote, AngebotDetails, Mahnungen, Teilzahlungen, reifenlager, mitarbeiter, termine`, `import-service.ts:572-586`) → 10 % „Tabellen gelesen" → Wipe → 12 % „Alte Daten geleert" → 16 % Kunden → 20 % Fahrzeuge → 22 % Lieferanten → 26 % Artikel → 34 % Rechnungen → 36 % Zahlungen → 40 % Angebote → 42 % Mahnungen → 44 % Reifenlager → 46 % Mitarbeiter → 48 % Termine → Nummernkreise → 50–99 % „PDFs erzeugen (n/N) …" → 100 % „Abgeschlossen" → Modal „Import abgeschlossen" mit „Insgesamt N Datensätze übernommen." (`:288-291`); Datei-Input geleert (`:108-111`).
  - Fehler: `handleClientError(err, 'Import fehlgeschlagen')` (generische Meldung, da plain Error → `handleError`); Job-Zeile `failed` mit `notes`.
  - Abbruchpfade: ConfirmDialog „Abbrechen"; **kein** Abbrechen eines laufenden Imports (kein Cancel-Endpoint); Seite verlassen stoppt nur das Polling (`$effect`-Cleanup `:70`), Server läuft weiter.
  - Berechtigungs-Verweigerung: ohne `import` kein Tab; Remote 403.
  - Wiederholung: erneuter Lauf wischt vollständig und importiert neu (Idempotenz durch Wipe, ADR-004).

## 7. Nebenwirkungen

- **E-Mails:** keine in diesem Modul.
- **PDFs:** Import rendert nach dem Einfügen ALLE Belege (`documents` invoice + offer inkl. Sammel-Angebot? – nein: `allDocIds` = `invoiceDocRows` + `offerDocRows`, das Sammel-Angebot aus `orphanOfferRows` wird NICHT vorab gerendert, `import-service.ts:1534-1537`) via `renderAndPersistDocumentPdf(id)` (`pdf-service.ts:1473`) mit 8 parallelen Workern, danach alle importierten Mahnungen via `renderAndPersistReminderPdf(id)` (`pdf-service.ts:2062`) sequenziell; Fehler werden gezählt (`skipped.pdfRenders`) und `console.error`-geloggt, brechen nicht ab (`:1564-1590`). Ergebnis in `document_pdfs`/`reminder_pdfs`. Im Dry-Run nur Zählung (`:1541-1544`).
- **Uploads:** `.mdb` als base64-Data-URL im JSON-Body des Commands; Client-Check nur Dateiendung; Server: `maxLength(60_000_000)` Zeichen (≈ 45 MB binär), `≥ 1024 Bytes`; `BODY_SIZE_LIMIT=64M` (`Dockerfile:48`; Produktion `67108864`, `.env.example:55`); Speicherort temporär `os.tmpdir()/tc-import-*/kfz-kaufmann.mdb`, nach dem Lauf gelöscht (`:410-417`). Kein persistenter Upload.
- **Exporte:** keine.
- **Externe APIs:** eBay OAuth (`/identity/v1/oauth2/token`), eBay Identity (`/commerce/identity/v1/user/`), eBay Trading API (`/ws/api.dll`, `GetMyeBaySelling`, Compat-Level 1193, Site 77). Kein eBay-Rate-Limit-Handling im Code (nur `MAX_PAGES=50`, Timeout 30 s).
- **Webhooks (eingehend):** `GET/POST /api/ebay/account-deletion` (nur Log).
- **Nummernkreise:** Import setzt `number_ranges.next_value = max(legacy)+1` und **`format_template = '{N}'`** für `customer`, `invoice`, `offer`, `cost_estimate`, `order_confirmation` (`:1491-1522`); Reminders bekommen feste Nummern `LEG-MA-<n>` (`:1286`), Sammel-Angebot `AN-IMPORT-SAMMEL-<Jahr>` (`:1128`), Offers `AN-<legacyNr>` (`:1078`), Rechnungen `<legacyNr>` unverändert (`:871`).
- **Externe Prozesse:** `mdb-export` (mdbtools, `Dockerfile:39-43`), 13 parallele Aufrufe.
- **Audit:** `access_import_jobs` (echter Lauf), `ebay_import_runs` (jeder Listing-Import). Konsole: `[ebay] …`, `[ebay-import] …`, `[import] …`.

## 8. Vorhandene Tests

| Testdatei | Art | Was wird abgedeckt |
| --- | --- | --- |
| `src/lib/server/services/ebay-auth-service.test.ts` (264) | integration (pg-mem, fetch-Mock) | Config-Gating, Consent-URL (alle Params, Sandbox-Host), HMAC-State (Roundtrip, manipuliert, abgelaufen, Zukunft), Code-Exchange (Request-Shape, verschlüsselte Ablage, Single-Row-Ersatz, Identity-Fehler toleriert, 400 → Error), Token gültig ohne Refresh, Refresh bei Ablauf, Status ohne Token-Leak, Disconnect |
| `src/lib/server/services/ebay-listing-service.test.ts` (508) | integration (pg-mem, Transport-Mock) | Feld-Mapping inkl. Entity-Decoding, Header (IAF-Token, Site 77), Pagination, Upsert/Update, ended/revive, unmappbare Items, Fehlerklassen (not connected, 932, 401, Ack=Failure, 500, Timeout, malformed), Run-Log ohne Token, List (Suche, Status-Filter, Paging), Import-Info |
| `src/lib/server/crypto.test.ts` (109) | unit | Roundtrip, frischer IV, Tamper-Erkennung, Formatversion, Fallback `APP_SECRET`, fail-closed, Cross-Key, `isEncryptedSecret`/`decryptSecretIfNeeded` |
| `src/lib/utils/ebay-detection.test.ts` (76) | unit | Positive/negative Substring-Fälle inkl. „Ebayer"/„Sebayn"/„Bayer", keine Feldkombination, leere Felder |
| `src/routes/api/ebay/account-deletion/endpoint.test.ts` (146) | integration (node) | Hash-Reihenfolge, Challenge 200/400/503, `EBAY_DELETION_ENDPOINT_URL`-Override und leer, Notification-Ack inkl. unparsebar |
| `src/routes/api/ebay/oauth/callback/endpoint.test.ts` (82) | integration (Service-Mock) | Redirect-Flags declined/state/exchange/connected, Code-Passthrough |
| `src/routes/settings/ebay/ebay.remote.test.ts` (178) | integration (pg-mem, `$app/server`-Mock) | 401/403 auf allen 6 Remotes, Status unkonfiguriert, „nicht konfiguriert"-Fehler, leere Listenform, Info leer, Import 409 ohne Token/Englisch |
| `src/routes/settings/ebay/ebay-page.test.ts` (461) | component (Testing-Library, `EbayHost`) | drei Zustände + ARIA-Rollen, Connect navigiert, Disconnect via Confirm, Sandbox-Badge, Callback-Flag-Toasts + `replaceState`, Import-Button nie disabled, Erfolgs-Toast, Fehler-Toast, Last-Run + Tabelle, fehlgeschlagener Lauf, Row-Click `window.open`, Leerzustand |
| `src/routes/settings/import/page.test.ts` (125) | component | Buttons ohne Datei enabled, Click-Time-Meldung (Vorschau/Import), kein Confirm ohne Datei, Live-Progress aus gepolltem Job (`.run()`) |
| `src/lib/server/services/import-service.test.ts` (394) | unit + integration (pg-mem, `exec`-Mock) | alle `__transforms`; Pipeline: Kunden/Fahrzeuge/Artikel mit Skips, Zero-Header-Backfill Rechnungen (Header gewinnt) und Angebote, Dry-Run schreibt nichts, eBay-`kind`-Erkennung |
| `e2e/settings.spec.ts:108-151` | e2e (Playwright) | Import: Click-Time-Fehler ohne Datei, Nicht-MDB → Toast; eBay: Disconnected-State, Import-Klick → 409-Toast |

Nicht getestet: echte `mdb-export`-Ausführung, Teilzahlungen/Mahnungen/Reifenlager/Mitarbeiter/Termine-Mapping in der Pipeline, Nummernkreis-Update, PDF-Vorab-Rendering, `access_import_jobs`-Audit, Unique-Kollisionen, Import-`+page` Ergebnis-Modal, `hooks`-Whitelist/Rate-Limit für den Compliance-Endpoint, Callback-Session-Gate.

## 9. Feature-Matrix

| ID | Feature | Routen | Endpoints/Remotes | Tabellen | Erwartetes Verhalten |
| --- | --- | --- | --- | --- | --- |
| F-588 | eBay-Status-Karte mit drei Zuständen (nicht konfiguriert / getrennt / verbunden) | `/settings/ebay` | `getEbayStatusRemote` | `ebay_credentials` | Nicht konfiguriert → Warn-Alert mit fehlenden Env-Keys, kein Button; getrennt → Erklärtext + „Mit eBay verbinden"; verbunden → Success-Alert „Verbunden als <username> seit <Datum>", `dl` mit „Access-Token gültig bis … (wird automatisch erneuert)" und „Verbindung läuft ab <refreshTokenExpiresAt>", Button „Verbindung trennen". Datumsformat `toLocaleString('de-DE')`, `-` bei null (`+page.svelte:70-71,177-247`) |
| F-589 | Sandbox-Kennzeichnung | `/settings/ebay` | `getEbayStatusRemote` | – | Badge „Sandbox" (`badge-warning`) neben dem Kartentitel, wenn `EBAY_ENV=sandbox` (`:182-184`); alle Hosts/URLs wechseln auf `*.sandbox.ebay.com` (`ebay-auth-service.ts:45-57`, `ebay-listing-service.ts:75-78`) |
| F-590 | Konfigurationsprüfung über Env | – | `missingEbayConfig` | – | `EBAY_CLIENT_ID`, `EBAY_CERT_ID`, `EBAY_RU_NAME` (getrimmt) müssen gesetzt sein; sonst `configured=false`, `missingConfig` = Liste; `buildAuthorizeUrl` wirft „eBay ist nicht konfiguriert - fehlende Umgebungsvariablen: …" (`ebay-auth-service.ts:67-85`) |
| F-591 | Mit eBay verbinden (Consent-URL) | `/settings/ebay` | `startEbayConnectRemote` | – | Command mintet je Klick frischen `state` (`<ts>.<nonce>.<hmac>`, 10 min TTL); URL `https://auth[.sandbox].ebay.com/oauth2/authorize` mit `client_id`, `redirect_uri=<RuName>`, `response_type=code`, `scope="…sell.inventory …commerce.identity.readonly"`, `state`, `locale=de-DE`; Client setzt `window.location.href` |
| F-592 | OAuth-Callback verarbeiten | `GET /api/ebay/oauth/callback` | `handleOauthCallback` | `ebay_credentials` | Session-pflichtig; Reihenfolge: kein `code` → `declined`; `state` fehlt/ungültig/abgelaufen → `state`; Exchange wirft → `exchange`; sonst `connected=1`; immer `303 /settings/ebay?<flag>`; Details nur im Server-Log |
| F-593 | Token-Austausch und verschlüsselte Ablage (Single-Row) | – | `exchangeAuthCode` | `ebay_credentials` | `POST /identity/v1/oauth2/token` Basic-Auth; `refresh_token` Pflicht; Username best-effort; `DELETE` + `INSERT`; Access/Refresh AES-256-GCM `v1:iv:tag:data`; Ablaufzeiten aus `expires_in`/`refresh_token_expires_in`; `scopes=EBAY_SCOPES`; `environment` aktuell |
| F-594 | Automatischer Access-Token-Refresh | – | `getValidAccessToken` | `ebay_credentials` | Token gilt bis `accessTokenExpiresAt − 60 s`; sonst `grant_type=refresh_token`, nur Access-Spalten + `updatedAt` aktualisiert (Refresh-Token wird nicht rotiert); kein Konto → „Kein eBay-Konto verbunden. …" |
| F-595 | Callback-Flags als Toasts + URL-Bereinigung | `/settings/ebay?connected=1\|error=…` | – | – | Deferred `onMount` (+150 ms) liest `window.location.search`; Success-Toast „eBay-Konto erfolgreich verbunden."; Fehler-Toasts für `declined`/`state`/sonst; `replaceState('/settings/ebay', {})` verhindert Re-Toast bei Reload |
| F-596 | Verbindung trennen | `/settings/ebay` | `disconnectEbayRemote` | `ebay_credentials` | ConfirmDialog (Texte §6) → alle Credential-Zeilen gelöscht → Toast „eBay-Verbindung getrennt." → Status-Query serverseitig refreshed; keine Revocation bei eBay |
| F-597 | Listing-Import (Trading API `GetMyeBaySelling`) | `/settings/ebay` | `importEbayListingsRemote` → `importEbayListings` | `ebay_listings`, `ebay_import_runs`, `ebay_credentials` | ActiveList, 200/Seite, max. 50 Seiten, Site 77, Timeout 30 s; Run-Zeile `running` → `success`/`failed`; Upsert keyed `(environment, ebay_item_id)`; neu → `imported`, vorhanden → `updated` (alle Felder überschrieben, `status='active'`, `lastSeenAt=now`); vorher `active` und nicht gesehen → `status='ended'` (nie gelöscht); wieder auftauchend → `active`; Items ohne `ItemID`/`Title` → `failed`; `totalActive` = `TotalNumberOfEntries` (Fallback Item-Anzahl) |
| F-598 | Listing-Feldmapping | – | `parseItem` | `ebay_listings` | `ItemID`→`ebayItemId`; `SKU`; `Title` (≤255); `CurrentPrice`→`priceValue` (2 Nachkommastellen) + `currencyID`→`priceCurrency`; `QuantityAvailable ?? Quantity`; `QuantitySold`; `ListingType`; `ViewItemURL`; `GalleryURL`; alle `PictureURL` → `pictureUrls` (nur URLs, keine Bytes); `StartTime`/`EndTime` → Date; Entities einmal dekodiert. **Kein** Mapping auf `tires`/`items`/Fahrzeuge (`tire_id` bleibt null) |
| F-599 | Kuratierte Fehlerklassen des Listing-Imports | `/settings/ebay` | `importEbayListingsRemote` | `ebay_import_runs.error` | 409 notConnected / 409 tokenExpired (HTTP 401, ErrorCodes 931/932/17470/21916984) / 502 refreshFailed / 502 unreachable / 502 rejected / 502 malformed – nur diese Texte erreichen Client und Run-Log; Rohantworten (≤500 Zeichen) nur `console.error` |
| F-600 | Import-Info-Karte | `/settings/ebay` | `getEbayImportInfoRemote` | `ebay_import_runs`, `ebay_listings` | Badge „N aktiv / N gesamt" (nur wenn `listingCount>0`); Text „Noch kein Import durchgeführt." / Erfolgstext / Fehlertext in rot; Button „Angebote importieren" immer klickbar (nur `busy`), Spinner während `busy`; Erfolgs-Toast mit Zählern; Info-Query wird auch bei Fehler refreshed (`finally`) |
| F-601 | Tabelle „Importierte Angebote" mit Suche, Status-Filter, Pagination 25, Row-Click | `/settings/ebay` | `listEbayListingsRemote` | `ebay_listings` | Suche `ilike %q%` auf `title`/`sku`/`ebay_item_id` (Debounce 250 ms, max 200 Zeichen); Filter Alle/Aktiv/Beendet; Filteränderung → Seite 1; Sortierung `status ASC, title ASC`; nur aktuelles `environment`; Spalten Angebot (Thumbnail+Titel+SKU), eBay-Artikelnr., Preis, Verfügbar, Verkauft, Status-Badge (`badge-success` Aktiv / `badge-ghost` Beendet), Läuft bis; Row-Click `window.open(viewItemUrl,'_blank','noopener')`; stale-while-revalidate über `lastResult`; EmptyState-Varianten |
| F-602 | Compliance: Challenge-Handshake | `GET /api/ebay/account-deletion` | `handleDeletionChallenge` | – | `challengeResponse = hex(sha256(challengeCode ‖ EBAY_VERIFICATION_TOKEN ‖ endpointUrl))`; `endpointUrl` = `EBAY_DELETION_ENDPOINT_URL` (getrimmt, leer = unset) sonst `origin+pathname`; 503 ohne Token, 400 ohne Code; Info-Log |
| F-603 | Compliance: Notification-Empfang | `POST /api/ebay/account-deletion` | `handleDeletionNotification` | – | Immer 200; JSON best-effort geparst; Log `topic/id/username/userId`; unparsebar → `console.warn`; keine Datenverarbeitung |
| F-604 | Whitelist + Rate-Limit für den Compliance-Endpoint | – | `hooks.server.ts` | – | Nur exakt `/api/ebay/account-deletion` (+ Subpfade) ohne Session; Bucket `public-api:token:<8 Zeichen>` oder `ip:<x-forwarded-for erste IP>`; 120/min + 60 Burst; 429 mit `Retry-After` |
| F-605 | Secrets-at-rest-Helfer | – | `crypto.ts` | `ebay_credentials`, (`smtp_settings.password` via `smtp-settings-service`) | Key = SHA-256(`APP_ENCRYPTION_KEY` ‖ Fallback `APP_SECRET`); fail-closed ohne beides; `decryptSecretIfNeeded` lässt Plaintext-Altbestand durch |
| F-606 | Settings-Tabs „eBay" (`settings`) und „Import" (`import`) | `/settings/*` | – | – | Tab-Bar filtert nach Permission; Sidebar zeigt nur „Einstellungen"; Route ohne passenden Tab rendert Kinder ohne Tab-Bar (`+layout.svelte:101-118`) |
| F-607 | Import-Seite: Datei wählen + Hinweise | `/settings/import` | – | – | `accept=".mdb,…"`; Nicht-`.mdb` → Toast „Bitte eine .mdb-Datei auswählen." (Datei wird verworfen); Anzeige „Ausgewählt: <name> (<MB> MB)"; Hinweise-Karte mit 5 Punkten (Wipe-Umfang, Settings bleiben, Belege abgeschlossen + PDFs, kein Fahrzeugbezug, Nummern 1:1 / max+1) |
| F-608 | Click-Time-Validierung ohne Datei | `/settings/import` | – | – | Beide Buttons nie disabled (außer `busy`); Klick ohne Datei → Inline-Alert „Bitte zuerst eine .mdb-Datei auswählen.", kein Confirm, kein Remote-Call |
| F-609 | Vorschau (Dry-Run) | `/settings/import` | `runMdbImportRemote{dryRun:true}` | keine Writes | Parst, mappt, validiert; gleiche Zähler/Skip-Report wie echter Lauf; kein Wipe, keine Inserts, keine Nummernkreise, keine PDFs (nur Anzahl), keine Job-Zeile, kein Fortschritt; Modal „Vorschau des Imports" mit Info-Banner; Datei bleibt gewählt; Button „Jetzt wirklich importieren" → Confirm |
| F-610 | Echter Import mit Bestätigung | `/settings/import` | `runMdbImportRemote{dryRun:false}` | alle Zieltabellen | ConfirmDialog (Texte §6, danger) → Pipeline → Modal „Import abgeschlossen"; Datei-Input geleert; Toast keiner (nur Modal) |
| F-611 | Live-Fortschritt | `/settings/import` | `getImportProgressRemote().run()` | `access_import_jobs` | 1-s-Poll; Box `role="status" aria-live="polite"` mit Label + `n %` + `<progress>`; Startwert „Import wird gestartet …" 0 %; Jobs älter als 60 s vor Klick ignoriert; Poll-Fehler ignoriert; Stop im `finally` und bei Unmount |
| F-612 | Ergebnis-Modal | `/settings/import` | – | – | Tabelle Kategorie/Importiert (Kunden, Fahrzeuge, Lieferanten, Artikel / Leistungen, Rechnungen, Rechnungspositionen, Teilzahlungen, Angebote / KV / AB, Angebotspositionen, Zahlungserinnerungen, Reifeneinlagerungen, Mitarbeiter, Termine, PDFs gerendert); Alert „N Bestandskorrektur-Rechnungen" mit ersten 20 Nummern; Zeile „Übersprungen (Gründe siehe Detailliste): …" wenn Summe > 0; Collapse „N nicht importierte Datensätze - Details anzeigen" mit Tabelle Tabelle/Schlüssel/Grund (max. 1000, Hinweis bei Kürzung); Warnbox (Belege abgeschlossen, PDFs im Cache, kein Fahrzeugbezug); Backdrop-Klick schließt |
| F-613 | Upload-Transport | – | `runMdbImportRemote` | – | base64-Data-URL im Command-Body, max. 60 000 000 Zeichen, min. 1024 Bytes dekodiert, `BODY_SIZE_LIMIT=64M`; temporäre Datei, nach Lauf gelöscht |
| F-614 | Read-before-wipe | – | `runImportSteps` | – | Alle 13 `mdb-export`-Aufrufe (parallel) müssen erfolgreich sein, bevor `wipeData()` läuft; Fehler → Job `failed`, DB unverändert (ADR-004) |
| F-615 | Wipe-Semantik | – | `wipeData` | 25 Tabellen (§3) | Reihenfolge Kinder→Eltern; Settings, Templates, Number-Ranges, Ledger-Kategorien, Users, Work-Orders, Time-Entries, Inquiries, Tires, Posts bleiben (Letztere teils mit genullten FKs, B-535) |
| F-616 | Mapping `Kunden` → `customers` | – | – | `customers` | `Kunden-Nr` Pflicht (sonst Skip „Datensatz ohne Kunden-Nr.") → `customerNumber` = `legacyCustomerNumber`; `kind='ebay'` wenn `Name\|Firma\|Vorname\|Nachname` „ebay" enthält, sonst `regular`; `Firma`(200), `Vorname`(100), `Nachname`(100), `Anrede`(30), `Strasse`(200), `Postleitzahl`(10), `Ort`(150), `Telefonnummer`→`phone`(30), `Natel ?? Telefon2`→`mobile`(30), `Faxnummer`(30), `Email`(254), `Geboren`→`birthday`, `Website`(2048), `UID`→`vatId`(30), `IBAN`(34), `BIC`(11), `BANK`(100), `zahlungsziel`→`paymentTermDays`; `notes` = `Anmerkungen` + „Kto: <KtoInhaber>" + `Auftragsarbeiten` (mit Leerzeilen); `country` bleibt Default „Deutschland"; `ebayHandle` nicht gesetzt |
| F-617 | Mapping `Autos` → `vehicles` + Kennzeichen-Version | – | – | `vehicles`, `vehicle_license_plate_versions` | Halter über `Kunden-Nr` Pflicht (Skip „Halter (Kunden-Nr X) nicht gefunden." / „Fahrzeug ohne Kunden-Nr."); `KFZ-Typ` → `make`/`model` (Split am 1. Leerzeichen); `Fahrgestellnr`→`vin`(25); `EZ`→`firstRegistration` (loose); `km-Stand`→`mileageKm`; `HU`→`nextHu` (loose); `ff1`→`hsn`(10), `ff2`→`tsn`(10), `ff3`→`engineNumber`(50), `ff4`→`fuelType`(30), `ff5`→`bodyType`(50); `Freifeld1`→`notes`; `Archiv==1`→`archived`; `legacyVehicleId=ID_Auto`; Kennzeichen → eine Version `validFrom = EZ ?? '1900-01-01'`; alle Fahrzeuge sind Kundenfahrzeuge (kein Bestand) |
| F-618 | Mapping `Lieferanten` → `suppliers` | – | – | `suppliers` | `Lieferantennummer` Pflicht (Skip) → `legacySupplierNumber`; `Firma`→`name` (Fallback `-`); `Kontaktperson`, `Strasse`, `PLZ`, `Ort`, `Land`, `Telefon`, `Fax`, `Email`, `Website`, `Kundennummer`→`customerNumberAtSupplier`, `IBAN`, `BIC`, `BANK`; kein eigener Nummernkreis-Update |
| F-619 | Mapping `Artikel` → `items` + `item_price_versions` | – | – | `items`, `item_price_versions` | `Artikel-Nr` Pflicht (Skip) → `legacyItemNumber`; `articleNumber = Artikelnummer ?? Artikel-Nr` (unique!); `description = Artikelbeschreibung ?? articleNumber`; `Art`→`kind`; `Me`→`unit`; `Bestand`→`stockOnHand` (≥0, gerundet); `Anmerkung`→`notes`; `Einzelpreis` → Preisversion `validFrom='2000-01-01'`, `unitPriceNet=String(price)`; Reifen landen ebenfalls in `items` (nicht `tires`) |
| F-620 | Mapping `Rechnungen` → `documents(type='invoice')` | – | – | `documents` | `Rechnungsnummer` Pflicht (Skip) → `documentNumber` = `legacyDocumentNumber`; `customerId` über `Kunden-Nr` (fehlend → null, kein Skip); `status`: `storniert`→`cancelled`, sonst `paid`; `taxRate = MWSteuer ?? 19`; `issueDate = Rechnungsdatum ?? Bezahldatum ?? '1900-01-01'` (+ Note „[Importiert ohne Datum]"); `dueDate = Bezahldatum`; Summen: `Inkl=true` → brutto gegeben, netto rückgerechnet; sonst `RgGesamtbetrag` = netto; `grossTotal==0` → Backfill aus Positionssummen (Header gewinnt, wenn ≠ 0); `footer = Endtext ?? Werbetext`; `notes` = „[Bestandskorrektur]" / „[Importiert ohne Datum]" / „Sachbearbeiter: …"; `vehicleId=null`; `Bestandskorrektur=true` → Nummer in `inventoryAdjustmentInvoiceNumbers` |
| F-621 | Mapping `RechnungDetails` → `document_items` | – | – | `document_items` | `Rechnungsnummer` Pflicht und auflösbar (Skip mit Grund, zählt in `skipped.invoiceItems`); `positionNumber` 1..n je Beleg (Legacy `pos` global ignoriert); `Artikel-Nr` ≠ `0` → `itemId` über Map (sonst null); `Anzahl ?? 1`; `Einzelpreis ?? 0` als `unitPriceNet` (unabhängig von `Inkl`); `Rabatt ?? 0`; `taxRate` = Header-Satz; `lineTotalNet = round(qty·price·(1−rabatt/100))`, `lineTotalGross = round(net·(1+rate/100))`; `Art`→`kind`; `Artikelnummer ?? Artikel-Nr`; `Artikelbeschreibung ?? '-'`; `Mengeneinheit`→`unit` |
| F-622 | Mapping `Teilzahlungen` → `document_payments` | – | – | `document_payments` | Spalten `RGNR`, `Betrag`, `Bezahldatum`, `BezahlArt` (Großschreibung!); `RGNR` Pflicht und auflösbar; Datum + Betrag Pflicht (sonst Skip „Zahlung ohne gültiges Datum oder Betrag."); `method = BezahlArt` |
| F-623 | Mapping `Angebote`/`AngebotDetails` → `documents` + `document_items` + Sammel-Angebot | – | – | `documents`, `document_items` | `Angebotsnummer` Pflicht → `documentNumber='AN-<nr>'`; `Formulartyp`→`type` (`offer`/`cost_estimate`/`order_confirmation`); `Status`→`sent`/`cancelled`; `Angebotsdatum ?? '1900-01-01'` (+Note); Summen wie Rechnung (`AgGesamtbetrag`, `Inkl`, Backfill); Positionen: ohne `Angebotsnummer` → lazy `AN-IMPORT-SAMMEL-<Jahr>` (`type=offer`, `status=sent`, `customerId=null`, `issueDate=1900-01-01`, `taxRate=19`, Summen aus Positionen); nicht auflösbare Nummer → Skip `skipped.offerItems`; Sammel-Angebot zählt in `summary.offers`, wird nicht vorab als PDF gerendert |
| F-624 | Mapping `Mahnungen` → `reminders` | – | – | `reminders` | `Rechnungsnummer` Pflicht + auflösbar; `Mahnung` (Datum) Pflicht; `level = NrMahnung ?? 1`; `dueDate = issueDate + 14 Tage`; `documentNumber='LEG-MA-<laufende Nr>'`; `status='sent'`; `Gebuehr` ignoriert; Unique `(invoiceId, level)` nicht abgesichert (B-533) |
| F-625 | Mapping `reifenlager` → `tire_storage` | – | – | `tire_storage` | `IDKunde` = Kunden-Nr, Pflicht + auflösbar (Skip); `Nummer`→`storageNumber` (fehlend → `RL-IMPORT-<Id\|uuid8>` + Note; Duplikat → Suffix `-2`, `-3`… + Note); `ID_Auto`→`vehicleId` (optional); `Eingelagert=true` → `retrievedAt=null`, sonst `Abholdatum ?? storedAt`; `Annahmedatum ?? '1900-01-01'`→`storedAt`; `RMarke`→`brand`(80); `Grösse`→`size`(40); `min(VL,VR,HL,HR)`→`profileMm`; `Art`→`season`; `Menge ?? 4`→`quantity`; `notes` = Dup-Note, `Notiz`, „Zustand: …", „Felge: <FMarke>", `AluStahlLose`, „Lagerort: …", „Profil VL/VR/HL/HR: … mm", „DOT: …" |
| F-626 | Mapping `mitarbeiter` → `employees` | – | – | `employees` | Keine Pflichtfelder/Skips; `personnelNumber = Kuerzel ?? 'MA-<n>'`(30); `Vorname`/`Nachname` Fallback `-`; `Geboren`→`birthday`; sonst nichts |
| F-627 | Mapping `termine` → `calendar_entries(kind='appointment')` | – | – | `calendar_entries` | `Datum` Pflicht (Skip „Termin ohne gültiges Datum."); `Uhrzeit` → Start (UTC-Stunden/Minuten aus `isoTimestamp`), fehlend → `allDay`, Start 00:00Z; `UhrzeitBis` → Ende, sonst +1 h bzw. 23:59Z; `ends<starts` → `ends=starts`; `title = TerminText ?? Name ?? 'Importierter Termin'`(200); `notes` = „Name: …" (wenn ≠ Text), „Mitarbeiter: …", „Intervall: …"; `status = completed` wenn Start < jetzt, sonst `scheduled` |
| F-628 | Nummernkreise nach Import | – | – | `number_ranges` | `customer` = max(numerische `customerNumber`)+1; `invoice` = max(numerische `legacyDocumentNumber`)+1; `offer`/`cost_estimate`/`order_confirmation` = max(Angebotsnr)+1; jeweils `formatTemplate='{N}'`; nicht im Dry-Run; `reminder`, `tire_storage`, `work_order` unverändert |
| F-629 | PDF-Vorab-Rendering | – | – | `document_pdfs`, `reminder_pdfs` | Alle Rechnungen + Angebote (ohne Sammel-Angebot) mit 8 Workern, dann Mahnungen sequenziell; Fehler zählen als `skipped.pdfRenders`, Import läuft weiter; Fortschritt 50–99 % proportional |
| F-630 | Audit-Job und Skip-Report | – | – | `access_import_jobs` | Echter Lauf: Zeile `running` → `completed` (Zähler, `tablesProcessed=13`, `notes`) oder `failed` (`notes='Import fehlgeschlagen: …'`); Skip-Report: jede verworfene Zeile mit `table`, `legacyKey`, deutschem `reason`, max. 1000 Details, `skippedTotal` exakt, `skippedDetailTruncated` |
| F-631 | Container-Voraussetzungen | – | – | – | `mdbtools` via `apt-get` in `node:lts-slim`; `BODY_SIZE_LIMIT=64M`; Env-Vorlage `.env.example:22-42` (eBay-Block) |

## 10. Befunde

| ID | Beschreibung | Fundstelle | Auswirkung | Empfehlung | Einordnung | Betroffene Features |
| --- | --- | --- | --- | --- | --- | --- |
| B-521 | Account-Deletion-Notification löscht/anonymisiert nichts, obwohl inzwischen eBay-bezogene Daten persistiert werden (`ebay_credentials` seit 0030, `ebay_listings` seit 0036, `customers.kind='ebay'`). Kommentar und Doku behaupten „no per-eBay-user data persisted yet". | `src/routes/api/ebay/account-deletion/endpoint.ts:20-25,149-153`; `docs/integrations/ebay.md:41-43` | Compliance-Lücke (eBay verlangt Löschung binnen 30 Tagen); veraltete Doku | Im Rewrite definieren, welche Daten bei `MARKETPLACE_ACCOUNT_DELETION` (Käufer-`username`/`userId`) betroffen sind (vermutlich `customers` mit `ebayHandle`), Löschung/Anonymisierung + Audit implementieren | Entscheidung nötig | F-603 |
| B-522 | Keine Verifikation der `X-EBAY-SIGNATURE` auf dem öffentlichen POST; jeder kann Notifications senden. Heute folgenlos (nur Log), kritisch sobald B-521 umgesetzt ist. | `endpoint.ts:134-159`; Spec `docs/archive/ebay-integration-spec.md:35-37` | Spoofing-Risiko bei echter Löschlogik | ECDSA-Prüfung via Notification API `getPublicKey` im Rewrite mitbauen | im Rewrite beheben | F-603 |
| B-523 | `importEbayListingsRemote` ruft `requested(listEbayListingsRemote, 4).refreshAll()`, die Seite deklariert aber kein `.updates(listEbayListingsRemote(queryArgs))` – laut CLAUDE.md ist serverseitiges `refreshAll()` ohne Client-`.updates` ein No-op (bekannte Bug-Klasse). Die Angebotstabelle aktualisiert sich nach dem Import vermutlich nicht. | `src/routes/settings/ebay/ebay.remote.ts:117`; `+page.svelte:144` (kein `.updates`) | Nutzer sieht neue Angebote erst nach Reload | Im Rewrite: Import-Ergebnis invalidiert die Listen-Query explizit (Nuxt `refresh()`/`refreshNuxtData`) | im Rewrite beheben | F-597, F-601 |
| B-524 | Environment-Konsistenz nicht geprüft: `getValidAccessToken` nutzt die gespeicherte Zeile unabhängig von `row.environment`; wechselt `EBAY_ENV`, wird ein Sandbox-Token gegen Production-Hosts geschickt (→ 401/„tokenExpired"). `listEbayListings`/`getEbayImportInfo` filtern hingegen per aktuellem Env, Status-Karte zeigt „verbunden". | `ebay-auth-service.ts:234-267,281-293` vs. `ebay-listing-service.ts:493,528-534` | Irreführender Status, unklare Fehler nach Env-Wechsel | Status = `connected && row.environment === ebayEnvironment()`; Token-Abruf bei Mismatch mit kuratiertem Fehler abweisen | im Rewrite beheben | F-588, F-594, F-597 |
| B-525 | `refreshTokenExpiresAt` wird nie geprüft; nach ~18 Monaten schlägt der Refresh-Grant fehl → 502 „konnte nicht erneuert werden" statt klarer 409-„neu verbinden"-Hinweis. Kein proaktiver Hinweis in der UI vor Ablauf. | `ebay-auth-service.ts:241-257`; `ebay-listing-service.ts:307-311` | Verwirrende Fehlerklasse | Ablauf vorab prüfen → `tokenExpired`; UI-Warnung z. B. 30 Tage vor Ablauf | im Rewrite beheben | F-588, F-594 |
| B-526 | Keine Nebenläufigkeitssperre: zwei gleichzeitige Listing-Importe erzeugen zwei Run-Zeilen und können auf dem Unique-Index `(environment, ebay_item_id)` kollidieren (→ unbehandelter DB-Fehler, Run „unerwartet fehlgeschlagen"). Gleiches beim MDB-Import: zwei parallele Läufe = zwei verschachtelte Wipes. | `ebay-listing-service.ts:337-433`; `import-service.ts:476-536` | Datenkorruption bzw. 500 | Job-Lock (DB-Advisory-Lock oder `running`-Zeile prüfen) | im Rewrite beheben | F-597, F-610 |
| B-527 | Trading-API-XML wird per Regex geparst (kein XML-Parser). Fragil bei CDATA, Namespaces/Präfixen, `<Item>`-ähnlichen Tags in Unterelementen; `textOf(block,'SKU')` nimmt das erste `SKU` (bei Variations-Listings ggf. Item-Level, unklar); `QuantityAvailable`-Fallback auf `Quantity` (= Gesamtmenge, nicht verfügbar). | `ebay-listing-service.ts:105-145,212-233,281-283` | Falsche/ausgelassene Felder bei ungewöhnlichen Listings | Echter XML-Parser (z. B. `fast-xml-parser`) im Rewrite; Variations explizit behandeln | im Rewrite beheben | F-597, F-598 |
| B-528 | Phase 3 (Zwei-Wege-Sync, Listing↔Reifen-Matching) nicht gebaut; `ebay_listings.tire_id` und Scope `sell.inventory` sind tote Vorbereitung. UI-Texte versprechen Sync: „um den Reifenbestand mit eBay zu synchronisieren", „Die Synchronisation stoppt, …". | `schema.ts:1629-1631`; `ebay-auth-service.ts:59-62`; `+page.svelte:227-231,428`; ADR-014 | Erwartung ≠ Funktion | UI-Texte auf Ist-Stand (Import) reduzieren oder Phase 3 in Rewrite-Scope aufnehmen | Entscheidung nötig | F-588, F-596, F-598 |
| B-529 | `listListingsSchema` erlaubt `size ∈ {10,25,50,100}` und `page ≤ 100 000`, obwohl Pagination projektweit fix 25 ist; `size`/`status`-Picklists ohne deutsche Meldung (Regel: jede Pipe-Stufe deutsch). | `ebay.remote.ts:66-75` | Abweichung von CONTRIBUTING (Meldungen), unnötige Fläche | Im Rewrite `size` serverseitig fixieren, deutsche Meldungen | im Rewrite beheben | F-601 |
| B-530 | Callback ist session-gated; läuft die Session während des eBay-Consents ab, landet der Nutzer auf `/login?redirectTo=/api/ebay/oauth/callback?code=…` – nach dem Login wird der (ca. 5 min gültige, einmalige) Code erneut eingelöst → meist `error=exchange`. | `hooks.server.ts:223-227`; `oauth/callback/endpoint.ts:30-52` | Verwirrender Fehler, erneutes Verbinden nötig | Akzeptabel; im Rewrite Fehlertext „Bitte erneut verbinden" für `exchange` | bewusst später | F-592 |
| B-531 | Callback prüft nur Session, nicht `settings`-Permission; `state` ist nicht an Nutzer/Session gebunden – jeder eingeloggte Nutzer könnte einen laufenden Connect abschließen (Single-Tenant, geringes Risiko). | `oauth/callback/endpoint.ts:30-52`; `ebay-auth-service.ts:100-115` | Geringes Autorisierungs-Gap | Im Rewrite `requirePermission('settings')` im Callback + Session-ID in den HMAC-Payload aufnehmen | im Rewrite beheben | F-592 |
| B-532 | `ebay-auth-service` wirft plain `Error` (nicht `error(status, …)`) für „nicht konfiguriert", „APP_SECRET fehlt", Token-Endpunkt-Antworten (inkl. bis 300 Zeichen Roh-Body). Über `startEbayConnectRemote` erreicht das `handleError` → vermutlich generische Meldung; Test prüft nur Service-Ebene. Der Callback loggt das komplette Error-Objekt (`console.error(err)`), Body-Auszug des eBay-Fehlers landet im Log (kein Token-Material erkennbar, aber ungefiltert). | `ebay-auth-service.ts:76-78,93,159-163,201-203`; `oauth/callback/endpoint.ts:47`; `ebay.remote.test.ts:118-121` | Unkuratierte Fehler; Log-Hygiene | Kuratierte `error(409/502,…)` wie im Listing-Service; Roh-Body nur gekürzt/redigiert loggen | im Rewrite beheben | F-590, F-591, F-593 |
| B-533 | Unique-Kollisionen brechen den Import NACH dem Wipe ab und sind im Dry-Run unsichtbar (Dry-Run schreibt nichts): `items.articleNumber = Artikelnummer ?? Artikel-Nr` (Legacy `artikelnummer` ist nicht unique, `Daten/access-schema-kfz-kaufmann.sql:66`), `reminders (invoice_id, level)` (Legacy `mahnungen` ohne PK, mehrere Mahnungen gleicher Stufe möglich, `:242-248`). Nur `tire_storage.storageNumber` wird dedupliziert. | `import-service.ts:778-788,1276-1291`; `schema.ts:475,784` | Leere Datenbank bis zum erfolgreichen Re-Run; Ursache nur in `access_import_jobs.notes` | Dedupe/Suffix wie bei Reifenlager; Dry-Run muss Unique-Verletzungen simulieren; Import in Transaktion/Staging | im Rewrite beheben | F-609, F-619, F-624 |
| B-534 | Wipe löscht `ledger_entries`, `recurring_entries`, `calendar_entries`, `sent_messages`, `employees` (+Absences/Salary) – Buchhaltung und Abwesenheiten haben keine Legacy-Quelle und gehen bei jedem Re-Import verloren (UI-Hinweis nennt das, aber die Konsequenz für einen späteren Re-Import ist hart). | `import-service.ts:357-389`; `+page.svelte:229-234` (Import) | Datenverlust bei Wiederholung nach Produktivbetrieb | Wipe-Umfang auf tatsächlich importierte Tabellen begrenzen bzw. konfigurierbar machen; Re-Import nach Go-Live blockieren | Entscheidung nötig | F-615 |
| B-535 | Wipe lässt referenzierende Tabellen zurück: `work_orders` (customer/vehicle/invoice → NULL), `customer_inquiries.customer_id` → NULL, `time_entries.document_id/customer_id` → NULL, `tire_reminder_log.customer_id` (kein FK) dangling, `tires` unberührt. Nach dem Import existieren verwaiste Aufträge/Zeiteinträge. | `schema.ts:1208-1221,1140-1144,1468-1469,1745`; `import-service.ts:357-389` | Inkonsistente Daten nach Import | Wipe-Scope vollständig definieren (auch `work_orders`, `tire_reminder_log`) oder Import nur auf leerer DB erlauben | im Rewrite beheben | F-615 |
| B-536 | Kein transaktionaler Import (ADR-004): Wipe + Inserts + Nummernkreise + PDFs laufen als Einzelstatements; Fehler mittendrin hinterlassen Teilzustand; Recovery = Re-Run. | `import-service.ts:357-389,538-1591`; ADR-004 | Teilimporte möglich | Im Rewrite: Staging-Schema + Swap oder eine Transaktion für Wipe+Inserts, PDF-Phase danach | Entscheidung nötig | F-610, F-614 |
| B-537 | Import läuft synchron im HTTP-Request (Minuten bei ~10 k PDFs laut Doku); Reverse-Proxy/Adapter-Timeouts können die Antwort kappen, der Server importiert weiter, der Client zeigt „Import fehlgeschlagen"; kein Cancel, kein Resume; Ergebnis-Modal geht verloren. | `import.remote.ts:18-48`; `+page.svelte:97-120`; `docs/integrations/kfz-kaufmann-import.md:24` | Falsche Fehlermeldung, kein Ergebnis | Im Rewrite: Hintergrund-Job (Queue/Worker), UI pollt Job inkl. Ergebnis-Summary aus DB; Abbruch-Flag | im Rewrite beheben | F-610, F-611, F-612 |
| B-538 | Upload als base64 im JSON-Command: 25 MB MDB → ~33 MB String im Body + Buffer; dann 13 parallele `mdb-export` mit je 256 MB `maxBuffer`; Speicherspitzen im Single-Replica-Container. `fileBase64`-Schema ohne deutsche Meldungen, keine `FIELD_LABELS`. Keine Magic-Byte-Prüfung (Standard-ACE/JET-Header). | `import.remote.ts:24`; `import-service.ts:137-156,572-586`; `Dockerfile:45-48` | Speicher/Zeit; Regelverstoß | Multipart/Streaming-Upload, sequenzielle oder begrenzt parallele Exporte, Header-Check | im Rewrite beheben | F-613, F-614 |
| B-539 | `documents.dueDate = Bezahldatum` (Zahl- statt Fälligkeitsdatum); Legacy kennt kein Fälligkeitsdatum. | `import-service.ts:878` | Semantisch falsches Feld | `dueDate = issueDate + paymentTermDays` oder null | Entscheidung nötig | F-620 |
| B-540 | Positionen ignorieren `Inkl`: `unitPriceNet = Einzelpreis` auch bei Brutto-Rechnungen; Zeilensummen ≠ Kopfsummen; Zero-Header-Backfill für `Inkl=true`-Belege überhöht Netto um die MwSt. Kommentar dokumentiert die Vereinfachung. | `import-service.ts:937-948,973-986,1175-1182` | Falsche Beträge auf Positions-Ebene / PDFs | Bei `Inkl` Positionspreise netto rückrechnen | Entscheidung nötig | F-620, F-621, F-623 |
| B-541 | Alle nicht stornierten Rechnungen werden `paid` – auch ohne `Bezahldatum`/Status „offen" („per User-Vorgabe"). Offene Legacy-Forderungen verschwinden aus „Offene Rechnungen"; importierte Mahnungen hängen an bezahlten Rechnungen. | `import-service.ts:288-298`; Test `import-service.test.ts:183-192` | Fachlich riskant | Regel bestätigen oder `open` bei fehlendem Bezahldatum | Entscheidung nötig | F-620, F-624 |
| B-542 | `mapOfferType` matcht per `includes('ab')`/`includes('kv')` – jedes Formulartyp-Wort mit „ab" (z. B. „Rabatt…") wird Auftragsbestätigung. | `import-service.ts:308-314` | Fehlklassifikation möglich | Exakte Legacy-Werte ermitteln (Dry-Run-Statistik) und Whitelist mappen | im Rewrite beheben | F-623 |
| B-543 | Stillschweigend nicht importiert (kein Skip-Eintrag): Felder `Rechnungen.Kilometerstand/Formulartyp/ldatum/Teilzahlung/ausag`, `Angebote.Kilometerstand/Fertigstellungstermin`, `Kunden.Freifeld/zahlungszielzusatz/zz/smssperre/lastschrift`, `Autos.Inspektion/zu2/zu3`, `Artikel.Lieferantennummer/Auslaufartikel/BestandMin/Max/Meld/Gewicht/Lagerort`, `Mahnungen.Gebuehr`, `*.at/herkunft`; ganze Tabellen `artikellieferanten`, `bestellungen(+details)`, `serienbrief`, `dateianhang`, `betriebsdaten`, `todoliste`, `titel`, `rgvariablen`, `sms`. | `Daten/access-schema-kfz-kaufmann.sql` vs. `import-service.ts:594-1489` | Datenverlust ohne Sichtbarkeit | Liste mit Auftraggeber abstimmen; mindestens Artikel↔Lieferant und Bestellungen prüfen | Entscheidung nötig | F-616–F-627 |
| B-544 | Nummernkreise: `format_template` wird hart auf `{N}` gesetzt und überschreibt Operator-Konfiguration; `next_value` aus `Number(...)` (nicht-numerische Legacy-Nummern → 0). | `import-service.ts:1491-1522` | Verlust von Formatvorgaben | Nur `next_value` setzen, Template nur bei Bedarf (Entscheidung) | Entscheidung nötig | F-628 |
| B-545 | Fortschritts-Poll verwirft Jobs mit `startedAt < clientNow − 60 s`; bei Browser/Server-Uhrabweichung > 60 s bleibt die Anzeige bei 0 %. `getImportProgressRemote` liefert auch abgeschlossene/fehlgeschlagene Jobs ohne Kennzeichnung für die UI. | `+page.svelte:53-55` (Import); `import.remote.ts:59-74` | Kosmetisch | Job-ID vom Server zurückgeben und gezielt pollen | im Rewrite beheben | F-611 |
| B-546 | Dry-Run zeigt keinen Fortschritt und schreibt keine Audit-Zeile; bei großer MDB wirkt die Vorschau eingefroren (nur Busy-Overlay). | `import-service.ts:468-471`; `+page.svelte:102` | UX | Dry-Run ebenfalls als Job mit Fortschritt | im Rewrite beheben | F-609 |
| B-547 | `mdb-export` via `exec` (Shell) statt `execFile`; Eingaben sind shell-quoted und Tabellennamen konstant (kein Injection-Pfad gefunden). Temp-Datei mit vollständigen Kundendaten liegt in `os.tmpdir()` (Rechte nach Prozess-umask), wird im `finally` gelöscht. | `import-service.ts:134-146,410-417` | Geringes Restrisiko | `execFile` mit Argument-Array, `mkdtemp` mit `0o700`, Datei `0o600` | im Rewrite beheben | F-614 |
| B-548 | Fehlgeschlagener Import liefert dem Nutzer nur eine generische Meldung (plain Error → `handleError`); der wahre Grund steht nur in `access_import_jobs.notes` (nicht in der UI abrufbar). | `import.remote.ts:46`; `import-service.ts:496-506`; `+page.svelte:113-116` | Diagnose nur per DB | Kuratierte Fehlerklassen (mdbtools fehlt, Tabelle fehlt, Unique-Kollision) + Anzeige der letzten fehlgeschlagenen Jobs | im Rewrite beheben | F-610, F-630 |
| B-549 | Doku/Kommentar-Konflikte: (a) Doku `MM-YY`, Code parst `MM/YY` (`docs/integrations/kfz-kaufmann-import.md:59` vs. `import-service.ts:247`); (b) Service-Header „`apk add mdbtools` im Container" vs. `apt-get` in `node:lts-slim` (`import-service.ts:24-25` vs. `Dockerfile:41-43`); (c) Dockerfile nennt Route `/import` (`Dockerfile:39`), real `/settings/import`; (d) Endpoint-Kommentar/Doku „no per-eBay-user data" (siehe B-521); (e) `ebay-auth-service.ts:4` verweist auf `docs/ebay-integration.md` (existiert nicht; heute `docs/integrations/ebay.md`). | s. o. | Irreführung beim Rewrite | Im neuen Repo Doku aus Code ableiten | im Rewrite beheben | – |
| B-550 | OAuth-Flag-Handling per `setTimeout(150)` + `window.location` als Workaround für Hydration-Probleme async Seiten (Kommentar). Framework-spezifischer Hack. | `+page.svelte:34-66` (eBay) | Fragil | In Nuxt über Route-Query + `router.replace` lösen | im Rewrite beheben | F-595 |
| B-551 | `EBAY_VERIFICATION_TOKEN`-Format (32–80 Zeichen, `[A-Za-z0-9_-]`) wird nicht validiert; Challenge wird mit jedem Wert beantwortet. Kein Startup-Check der eBay-Env. | `endpoint.ts:76-85`; `.env.example:25` | Fehlkonfiguration erst im Portal sichtbar | Env-Schema beim Boot validieren | im Rewrite beheben | F-602 |
| B-552 | `fetch` im Auth-Service (Token-Endpunkt, Identity API) ohne Timeout/AbortSignal; der Callback-Request kann hängen. Listing-Transport hat 30 s. | `ebay-auth-service.ts:148-158,171-174` | Hängende Requests | Einheitlicher Timeout | im Rewrite beheben | F-592, F-593, F-594 |
| B-553 | Listing-Import lädt alle Listings des Env in den Speicher und schreibt pro Item ein eigenes UPDATE/INSERT ohne Transaktion; bei Abbruch mitten in der Schleife wird `ended` nicht berechnet, `updated`-Zähler geht verloren. Kein Index auf `title`/`sku` für die `ilike`-Suche. | `ebay-listing-service.ts:376-444,493-503`; `schema.ts:1643-1646` | Skalierung/Atomarität | Batch-Upsert (`ON CONFLICT`) in Transaktion; trigram/`lower()`-Index bei Bedarf | im Rewrite beheben | F-597, F-601 |
| B-554 | Termine: Legacy-Wanduhrzeiten werden als UTC interpretiert (`isoTimestamp` hängt `Z` an, `startsAt` wird mit `Z` gebaut) → Verschiebung um 1–2 h gegenüber Europe/Berlin in der Kalenderanzeige. | `import-service.ts:212-217,1432-1457` | Falsche Uhrzeiten | Zeitzone `Europe/Berlin` beim Zusammensetzen verwenden | im Rewrite beheben | F-627 |
| B-555 | `splitMakeModel` trennt am ersten Leerzeichen („Alfa Romeo 156" → `Alfa`/`Romeo 156`, „Mercedes Benz C" → `Mercedes`/`Benz C`); `ff1..ff5` werden als HSN/TSN/Motor-Nr/Kraftstoff/Aufbau interpretiert, ohne Beleg im Legacy-Schema (freie Felder `VARCHAR(20)`). | `import-service.ts:268-276,698-701`; `Daten/access-schema-kfz-kaufmann.sql:109-113` | Datenqualität | Markenliste für Mehrwort-Marken; Bedeutung von `ff1..ff5` mit Auftraggeber klären | Entscheidung nötig | F-617 |
| B-556 | Reifen-Artikel aus `Artikel` landen in `items`, nicht in `tires` (`tires.legacy_article_number` bleibt leer); Doku nennt es Backlog. | `import-service.ts:765-806`; `docs/integrations/kfz-kaufmann-import.md:38` | Reifen-Modul nach Import leer | Erkennungsregel (Art/Beschreibung/Größe) definieren und nach `tires` routen | Entscheidung nötig | F-619 |
| B-557 | Kunden ohne Kunden-Nr, Rechnungen/Angebote mit unbekanntem Kunden (→ `customerId=null`, kein Skip-Eintrag), Fahrzeuge ohne Halter → unterschiedliche Strenge; Belege ohne Kunde sind im neuen System evtl. nicht anlegbar (PDF-Rendering ohne Kunde?). Unklar, ob `renderAndPersistDocumentPdf` mit `customerId=null` durchläuft (wird als `pdfRenders`-Skip gezählt). | `import-service.ts:826-827,1054-1055,1564-1579` | Belege ohne Kunde | Regel vereinheitlichen; Dry-Run zählt Belege ohne Kunde | Entscheidung nötig | F-620, F-623, F-629 |
| B-558 | Sammel-Angebot `AN-IMPORT-SAMMEL-<Jahr>` wird nicht vorab als PDF gerendert (nur `invoiceDocRows`+`offerDocRows`), obwohl das Modal „Alle PDFs wurden bereits beim Import gerendert" behauptet. | `import-service.ts:1534-1537`; `+page.svelte:459-463` (Import) | Aussage falsch; Detail-View rendert ggf. nach | `orphanOfferRows` in `allDocIds` aufnehmen | im Rewrite beheben | F-623, F-629 |
| B-559 | `Kunden.Name` wird defensiv geprüft, existiert in dieser MDB-Version nicht (Schema: `firma/vorname/nachname`). Kein Bug, aber Mapping-Kommentar suggeriert Versionsvielfalt – Rewrite muss Spaltensatz explizit versionieren. | `import-service.ts:606-616`; `Daten/access-schema-kfz-kaufmann.sql:176-206` | – | Spaltenschema der MDB im Dry-Run validieren und melden | im Rewrite beheben | F-616 |

## 11. Offene Fragen an den Architekten

1. **Zukunft der eBay-Anbindung:** Bleibt es beim reinen Listing-Import (Phase 2) oder wird der Zwei-Wege-Sync (Phase 3, ADR-014) im Rewrite gebaut? Davon hängen Datenmodell (`ebay_listings.tire_id`, `ebay_sync_log`), Scopes, Hintergrund-Job-Infrastruktur und die UI-Texte ab (B-528).
2. **Account-Deletion-Semantik:** Welche Daten sind bei einer eBay-Löschanfrage betroffen (nur `customers` mit `kind='ebay'`/`ebayHandle`? Belege bleiben aus steuerlichen Gründen?). Anonymisierung vs. Löschung (B-521).
3. **Import: einmalig oder wiederholbar?** Wenn einmalige Migration: Import als CLI/Admin-Skript auf leerer DB statt UI-Feature? Wenn wiederholbar: Wipe-Umfang (Ledger, Kalender, Aufträge, Reifen) und Sperre nach Go-Live (B-534/15).
4. **Job-Infrastruktur in Nuxt:** Gibt es einen Worker/Queue (Nitro Tasks, BullMQ, pg-boss) für langlaufende Imports, PDF-Rendering und späteren eBay-Sync, oder bleibt „operator-triggered in-request"? (B-537, ADR-009)
5. **Upload-Weg:** Multipart-Upload mit Streaming zur Platte statt base64-JSON; Größenlimit (aktuell ~45 MB); Dateiablage temporär vs. persistent für Re-Run (B-538).
6. **mdbtools-Abhängigkeit:** Weiterhin `mdb-export` im Container (native Abhängigkeit) oder JS-Parser? Beeinflusst Docker-Image und Testbarkeit.
7. **Fachliche Import-Regeln bestätigen:** alle Rechnungen `paid` (B-541), `Inkl`-Preise auf Positionsebene (B-540), `dueDate` (B-539), Sammel-Angebot für Waisen-Positionen, Mahn-Fälligkeit +14 Tage, `stockOnHand`-Übernahme.
8. **Nicht importierte Legacy-Tabellen/Felder:** Bestellungen, Artikel-Lieferanten, Serienbriefe, Dateianhänge, `Kilometerstand` auf Belegen – benötigt? (B-543)
9. **Reifen-Routing:** Sollen Legacy-Artikel als Reifen erkannt und in `tires` importiert werden? Welche Regel? (B-556)
10. **Nummernkreis-Formate:** Darf der Import `format_template` überschreiben oder nur `next_value` fortschreiben? (B-544)
11. **Sandbox-Betrieb:** Wird `EBAY_ENV=sandbox` im Rewrite weiter benötigt (Tests/Abnahme)? Falls ja: Env-Bindung der Credentials erzwingen (B-524).
12. **Zeitzone der Termine** und Bedeutung von `Autos.ff1..ff5` (B-554/35) – nur der Auftraggeber kennt die Legacy-Belegung.
13. **Fehler-Transparenz:** Sollen fehlgeschlagene Import-Jobs (inkl. `notes`) und eBay-Runs in der UI als Historie sichtbar sein (aktuell nur „letzter Lauf" bzw. gar nicht)?

## 12. Gelesene Dateien

| Datei | Zeilen |
| --- | --- |
| `src/lib/server/services/ebay-auth-service.ts` | 302 (vollständig) |
| `src/lib/server/services/ebay-listing-service.ts` | 549 (vollständig) |
| `src/routes/settings/ebay/+page.svelte` | 433 (vollständig) |
| `src/routes/settings/ebay/EbayHost.svelte` | 16 (vollständig) |
| `src/routes/settings/ebay/ebay.remote.ts` | 122 (vollständig) |
| `src/routes/api/ebay/account-deletion/endpoint.ts` | 159 (vollständig) |
| `src/routes/api/ebay/account-deletion/+server.ts` | 16 (vollständig) |
| `src/routes/api/ebay/oauth/callback/endpoint.ts` | 52 (vollständig) |
| `src/routes/api/ebay/oauth/callback/+server.ts` | 15 (vollständig) |
| `src/hooks.server.ts` | 470 (Auszüge 55–80, 130–170, 215–245 + grep auf ebay/rate/FIELD_LABELS) |
| `src/lib/server/crypto.ts` | 92 (vollständig) |
| `src/lib/server/services/import-service.ts` | 1591 (vollständig, in vier Abschnitten) |
| `src/routes/settings/import/+page.svelte` | 499 (vollständig) |
| `src/routes/settings/import/import.remote.ts` | 74 (vollständig) |
| `Dockerfile` | 65 (vollständig) |
| `svelte.config.js` | 22 (vollständig) |
| `.env.example` | 58 (vollständig) |
| `package.json` | Auszug 1–65 (scripts/devDependencies) |
| `src/lib/utils/ebay-detection.ts` | 34 (vollständig) |
| `src/lib/server/db/schema.ts` | ≥ 2025 (Auszüge 141–147, 165–240, 470–488, 820–832, 1095–1135, 1199–1225, 1327–1345, 1545–1680, 1692–1760 + greps auf ebay/import/legacy/references/uniqueIndex/pgTable) |
| `drizzle/0030_ebay_credentials.sql` | 15 (vollständig) |
| `drizzle/0031_import_job_progress.sql` | 5 (vollständig) |
| `drizzle/0036_ebay_listings.sql` | 68 (vollständig) |
| `drizzle/0004_steady_redwing.sql` | 12 (vollständig, nicht import-bezogen) |
| `drizzle/0000_lying_tyger_tiger.sql` | Auszug 1–13 (`access_import_jobs`) |
| `drizzle/0002_gigantic_leopardon.sql`, `drizzle/0003_daily_shocker.sql` | grep `import|legacy` – keine Treffer |
| `src/lib/server/services/ebay-auth-service.test.ts` | 264 (vollständig) |
| `src/lib/server/services/ebay-listing-service.test.ts` | 508 (vollständig) |
| `src/lib/server/crypto.test.ts` | 109 (vollständig) |
| `src/lib/utils/ebay-detection.test.ts` | 76 (vollständig) |
| `src/routes/api/ebay/account-deletion/endpoint.test.ts` | 146 (vollständig) |
| `src/routes/api/ebay/oauth/callback/endpoint.test.ts` | 82 (vollständig) |
| `src/routes/settings/ebay/ebay.remote.test.ts` | 178 (vollständig) |
| `src/routes/settings/ebay/ebay-page.test.ts` | 461 (vollständig) |
| `src/routes/settings/import/page.test.ts` | 125 (vollständig) |
| `src/lib/server/services/import-service.test.ts` | 394 (vollständig) |
| `e2e/settings.spec.ts` | Auszüge 1–52, 106–152 |
| `src/routes/settings/+layout.svelte` | 118 (vollständig) |
| `src/routes/settings/+page.svelte` | Auszug 1–80 (Legacy-`?tab=`-Redirects) |
| `src/lib/components/layout/navigation.ts` | Auszug 225–247 + grep |
| `src/lib/permissions.ts` | 53 (vollständig) |
| `src/lib/server/auth-guards.ts` | 60 (vollständig) |
| `src/lib/server/db/validation.ts` | Auszug 279–315 |
| `src/lib/server/db/test-db.ts` | Auszug 1–40 |
| `src/lib/server/services/pdf-service.ts` | nur grep (`renderAndPersistDocumentPdf` :1473, `renderAndPersistReminderPdf` :2062) |
| `src/lib/server/rate-limit.ts` | Auszug 98–104 |
| `docs/integrations/ebay.md` | 140 (vollständig) |
| `docs/integrations/kfz-kaufmann-import.md` | 91 (vollständig) |
| `docs/modules/import.md` | 34 (vollständig) |
| `docs/modules/settings.md` | 104 (Auszüge 1–40, 55–63, 85–104 + grep) |
| `docs/decisions/adr-004-import-wipe-first-read-before-wipe.md` | 40 (vollständig) |
| `docs/decisions/adr-005-encryption-scope.md` | 41 (vollständig) |
| `docs/decisions/adr-014-ebay-two-way-sync-deferred.md` | 42 (vollständig) |
| `docs/archive/ebay-integration-spec.md` | 168 (vollständig) |
| `/home/nick/tc/Daten/access-schema-kfz-kaufmann.sql` | 475 (vollständig; Legacy-Spaltennamen) |
| `/home/nick/tc/Daten/` (`ls -la`) | Verzeichnisliste: `kfz-kaufmann-test.mdb` 19 161 088 Bytes (nicht geöffnet), Schema-SQL, Beispiel-PDFs, Logos, 10 Screenshots |
| `scripts/*.mjs` | `grep mdb|import-service` – keine import-bezogenen Skripte (nur E2E/Seed-Skripte) |
