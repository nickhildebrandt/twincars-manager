---
title: Inventar Öffentliche API (PUB)
teil_von: docs/rewrite/01-inventar.md
stand: Bestand (SvelteKit) vor dem Rewrite
---

> **Detail-Inventar des Bestands.** Erhoben durch vollständiges Lesen der in
> Abschnitt „Gelesene Dateien" genannten Dateien. Die IDs wurden auf die
> globalen IDs aus [01-inventar.md](../01-inventar.md) umgestellt
> (66 IDs). Zurück: [01-inventar.md](../01-inventar.md) ·
> [02-befunde.md](../02-befunde.md)

# Modul: Öffentliche REST-API (für die Website), Aktuelle Informationen (Posts), Kundenanfragen (Inquiries)   (Kürzel: PUB)

Sprache: Deutsch für Fließtext/Tabellen; Code-Bezeichner, Dateipfade, Tabellen-/Spaltennamen bleiben englisch und exakt wie im Code.
Alles muss aus dem tatsächlich gelesenen Code stammen. Keine Vermutungen. Bei Unsicherheit "unklar" schreiben und Fundstelle nennen.
Fundstellen immer als `pfad/datei.ts:zeile`.

Alle Pfade relativ zu `/home/nick/tc/twincars-manager`.

## 1. Routen und Seiten

### 1a. Interne Seiten (Session-authentifiziert)

| Route | Datei | Parameter | Guard / Permission | Layout | Datenabhängigkeiten (Remote-Queries, Reihenfolge) | Zweck |
|---|---|---|---|---|---|---|
| `/posts` | `src/routes/posts/+page.svelte` | keine URL-Parameter; interner State `pageNum` (Reset auf 1 bei Suche), `q` (Toolbar) | `requirePermission('posts')` in `listPostsRemote` (`src/routes/posts/posts.remote.ts:89`); Sidebar-Eintrag nur mit `posts` | AppShell (Gruppe „Kommunikation", `src/lib/components/layout/navigation.ts:216-221`) | 1. `await untrack(() => listPostsRemote({ page, size: 25, q?, published: 'all' }))` (`+page.svelte:28`), 2. `$derived.by(() => listPostsRemote(queryArgs).current ?? lastResult)` (`:35-37`), 3. `$effect` synct `lastResult` + `handleClientError(query.error)` (`:42-46`) | Liste „Aktuelle Informationen": Titel, Status-Badge, Veröffentlicht am, Aktionen (Bearbeiten/Löschen); Desktop-Tabelle (`lg:block`) + Mobile-Kartenliste (`lg:hidden`) |
| `/posts/new` | `src/routes/posts/new/+page.svelte` | keine | über `createPostRemote` (`posts.remote.ts:119`) | AppShell | keine Query; Command `createPostRemote(values)` in `busy.run` (`new/+page.svelte:13`) | Neuen Beitrag anlegen; nach Erfolg `formDirty.clear()` → Toast „Beitrag angelegt." → `goto('/posts/<id>', { replaceState: true })`; Abbrechen → `goto('/posts')` |
| `/posts/[id]` | `src/routes/posts/[id]/+page.svelte` | `id` (aus `page.params.id`, mit `untrack` eingefroren, `:17`) | `requirePermission('posts')` in `getPostRemote` (`posts.remote.ts:106`) | AppShell; kein keyed `[id]/+layout.svelte` (keine Detail-zu-Detail-Links vorhanden) | 1. `const query = getPostRemote({ id })`, 2. `await query` (Top-Level), 3. `post = $derived(query.current ?? initial)` (`:19-23`) | Detail: Badge Veröffentlicht/Entwurf, „Veröffentlicht am", Titelbild, Teaser, Inhalt (`whitespace-pre-wrap`), Slug, Erstellt, Geändert; Buttons Veröffentlichen/Verbergen (optimistisch), Löschen (ConfirmDialog), Primäraktion Bearbeiten; `back="/posts"` |
| `/posts/[id]/edit` | `src/routes/posts/[id]/edit/+page.svelte` | `id` | `getPostRemote` + `updatePostRemote` (`posts.remote.ts:137`) | AppShell | 1. `await getPostRemote({ id })` (`:15`), 2. Command `updatePostRemote({ id, values })` (`:19`) | Bearbeiten; Erfolg → `formDirty.clear()` → Toast „Beitrag gespeichert." → `goto('/posts/<id>')`; Abbrechen → `goto('/posts/<id>')` |
| `/settings/inquiries` | `src/routes/settings/inquiries/+page.svelte` | keine URL-Parameter; interner State `pageNum`, `status` (`'all'|'pending'|'sent'|'failed'`, Reset `pageNum=1` bei Wechsel, `:54-57`) | `requirePermission('mailings')` in `listInquiriesRemote` (`src/routes/settings/inquiries.remote.ts:44`); Settings-Tab `inquiries` mit `permission: 'mailings'` (`src/routes/settings/+layout.svelte:69-74`); Sidebar-Eintrag „Anfragen" in Gruppe „Kommunikation" (`navigation.ts:222-229`) | AppShell + Settings-`TabGroup` im Nav-Modus (`src/routes/settings/+layout.svelte`) | 1. `await untrack(() => listInquiriesRemote({ page, size: 25, status? }))` (`:29`), 2. `$derived.by(... .current ?? lastResult)` (`:41-43`), 3. `$effect` sync (`:48-52`) | Posteingang der Website-Kontaktanfragen mit Benachrichtigungsstatus und „Erneut senden"; `PageHeader back="/settings"` |

Hinweis: Es gibt keine `?tab=`/`?page=`/`?q=`-Deep-Links in diesen Seiten; Suchbegriff und Seite leben nur im Komponentenstate.

### 1b. Öffentliche HTTP-Endpoints (`+server.ts`, dokumentierte Ausnahme Nr. 2)

Alle unter `/api/public/*`; Session-Whitelist in `src/hooks.server.ts:61-72` (`'/api/public'`), d. h. kein Login-Redirect. Jeder Endpoint exportiert `GET`/`POST` **und** `OPTIONS`, beide über `publicApi(handler)` (`src/lib/server/public-api.ts:41`). Kein Setup-Gate: `hooks.server.ts` prüft `company_settings.setupCompleted` nicht; die Endpoints antworten auch vor Setup-Abschluss (siehe B-515).

| Methode + Pfad | Datei (`+server.ts` → `endpoint.ts`) | Handler |
|---|---|---|
| GET `/api/public/used-cars` | `src/routes/api/public/used-cars/+server.ts:12` → `used-cars/endpoint.ts:11` | `handlePublicUsedCars` |
| GET `/api/public/used-cars/[id]` | `used-cars/[id]/+server.ts:12` → `used-cars/[id]/endpoint.ts:20` | `handlePublicUsedCarDetail` |
| GET `/api/public/tires` | `tires/+server.ts:12` → `tires/endpoint.ts:106` | `handlePublicTires` |
| GET `/api/public/tires/[id]` | `tires/[id]/+server.ts:12` → `tires/[id]/endpoint.ts:19` | `handlePublicTireDetail` |
| GET `/api/public/services` | `services/+server.ts:14` → `services/endpoint.ts:29` | `handlePublicServices` |
| GET `/api/public/services/[id]` | `services/[id]/+server.ts:12` → `services/[id]/endpoint.ts:19` | `handlePublicServiceDetail` |
| GET `/api/public/free-slots` | `free-slots/+server.ts:12` → `free-slots/endpoint.ts:42` | `handlePublicFreeSlots` |
| POST `/api/public/appointments` | `appointments/+server.ts:12` → `appointments/endpoint.ts:87` | `handleBookAppointment` |
| POST `/api/public/orders` | `orders/+server.ts:12` → `orders/endpoint.ts:117` | `handlePublicOrder` |
| POST `/api/public/contact` | `contact/+server.ts:12` → `contact/endpoint.ts:80` | `handleContactInquiry` |
| GET `/api/public/company` | `company/+server.ts:12` → `company/endpoint.ts:54` | `handlePublicCompany` |
| GET `/api/public/posts` | `posts/+server.ts:14` → `posts/endpoint.ts:62` | `handlePublicPosts` |
| GET `/api/public/posts/[slug]` | `posts/[slug]/+server.ts:13` → `posts/[slug]/endpoint.ts:32` | `handlePublicPostDetail` |

## 2. Remote Functions und Endpoints

### 2a. Querschnitt der öffentlichen API (gilt für alle 13 Endpoints)

- **Wrapper `publicApi(handler)`** — `src/lib/server/public-api.ts:41-130`
  - `OPTIONS` → sofort `204` mit CORS-Headern, **ohne** Auth (`:45-47`).
  - Auth: `authenticateRequest(request)` (`src/lib/server/api-tokens.ts:101-113`): Header `Authorization` muss `/^Bearer\s+([A-Za-z0-9._\-=:+/]+)$/i` matchen; Token via `verifyApiToken` (`:75-85`) gegen `API_TOKENS` (env; `process.env` vor `$env/dynamic/private`, `:12-14`); Liste getrennt durch `,` `\n` `\r` `;`, Einträge < 8 Zeichen ignoriert (`:47-54`); Kandidat < 8 Zeichen sofort abgelehnt; Vergleich `timingSafeEqual` nach Längencheck (`:62-67`), Schleife läuft immer vollständig (`:78-83`); leer/unset → alles 401 (fail-closed). Ergebnis nur `{ tokenPrefix: token.slice(0, 8) }`.
  - Fehlschlag → `401 { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Bearer token.' } }` (`public-api.ts:49-59`) — keine Unterscheidung „unbekannt" vs. „fehlerhaft".
  - Rate-Limit **nach** Auth: Bucket `public:<tokenPrefix>`, `perMinute: 120`, kein Burst (`:65-67`); bei Überschreitung `429 { error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded. Please retry later.' } }` + Header `Retry-After: <s>` (`:68-80`).
  - `event.locals.apiToken = { tokenPrefix }` (untypisiert, `:85`).
  - Erfolgsantwort des Handlers wird neu verpackt und mit CORS-Headern versehen (`:88-97`).
  - Fehlerbehandlung (`:98-128`): geworfene SvelteKit-`HttpError` (`status` numerisch) → `{ error: { code: codeForStatus(status), message: body.message ?? 'Request could not be processed.' } }` mit gleichem Status; alles andere → `console.error('[public-api]', err)` und `500 { error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred.' } }`.
  - `codeForStatus` (`:143-160`): 400 `BAD_REQUEST`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `CONFLICT`, 422 `UNPROCESSABLE_ENTITY`, ≥500 `INTERNAL_ERROR`, sonst `ERROR`.
  - Helfer: `ok(data, init?)` → `json({ data }, init)` (`:163-165`); `fail(status, message)` → `error(status, message)` (`:171-173`).
  - **CORS** (`:132-141`): `Access-Control-Allow-Origin: *`, `Allow-Methods: GET, POST, OPTIONS`, `Allow-Headers: Authorization, Content-Type`, `Max-Age: 600`. Kommentar „Tighten via env config in production" — es existiert **keine** Env-Konfiguration dafür.
  - **Keine** Cache-Header (kein `Cache-Control`, `ETag`, `Last-Modified`) auf irgendeinem GET.
- **Vorgeschalteter Hook-Rate-Limiter** — `src/hooks.server.ts:141-167` (`rateLimitPublicApi`), läuft für `pathname.startsWith('/api/public/')` und `/api/ebay/account-deletion` **vor** Auth und auch für `OPTIONS`: Bucket `public-api:token:<erste 8 Zeichen>` (Regex `/^Bearer\s+(\S+)/i`) oder `public-api:ip:<resolveClientIp>` (X-Forwarded-For erstes Element, sonst `getClientAddress()`, sonst `'unknown'`, `:88-99`); `perMinute: 120`, `burst: 60` (= 180/Fenster, `:25-26`); Ablehnung `429 { message: 'Zu viele Anfragen. Bitte reduzieren Sie die Aufrufrate.' }` + `Retry-After` — **nicht** im `{ error }`-Envelope, deutsch, ohne CORS-Header (siehe B-488).
- **Rate-Limiter-Algorithmus** — `src/lib/server/rate-limit.ts:98-118`: fixed window 60 s in Prozessspeicher (`Map`), erster Call startet Fenster, abgelehnte Calls zählen nicht; `retryAfter = ceil(Restfenster/1000)`, min 1; Sweep alle 5 min für Buckets > 5 min alt (`:50-69`, `unref`). Single-Replica-Annahme dokumentiert (`:16-25`).
- **Reihenfolge der Hooks** (`hooks.server.ts:231-255`): `ensureSeeded()` → `rateLimitSignIn` → `rateLimitPublicApi` → `blockDeactivatedSignIn` → better-auth → `populateAuthLocals` → `requireAuthHandle` (Whitelist).
- **Validierungsfehler-Format** in POST-Endpoints (identisch in appointments/orders/contact): Body nicht parsebar → `fail(400, 'Request body must be valid JSON.')`; Valibot-`ValiError` → `fail(400, 'Invalid "<path.joined>": <first.message>')` — die Meldung stammt aus den **deutschen** Shared-Schemas (`src/lib/server/db/validation.ts`) oder englischen Inline-Meldungen (Sprachmix, B-497). `object()` strippt unbekannte Keys (kein Fehler).
- **Datenformate nach außen**: Preise als JSON-Zahl in Euro mit Dezimalstellen (`Number(numeric)`), nicht Cent; Zeitstempel ISO-8601 UTC (`toISOString()`); Kalenderdaten als `YYYY-MM-DD`-String; Bilder **inline als Base64-Data-URL** (kein separater Bild-Endpoint).

### 2b. GET-Endpoints

- **GET `/api/public/used-cars`** — `src/routes/api/public/used-cars/endpoint.ts:11-16`
  - Guard: Bearer. Query-Parameter: **keine** (ein `?q=` wird ignoriert). Keine Pagination.
  - Rückgabe `{ data: { vehicles: PublicUsedCar[] } }`, `PublicUsedCar` (`src/lib/server/services/vehicle-service.ts:713-725`): `id`, `make`, `model`, `firstRegistration` (Datum-String|null), `mileageKm` (number|null), `priceGross` (number|null, aus `vehicle_listings.sales_price_gross`), `fuel` (= `vehicles.fuel_type`), `transmission` (= `vehicles.gearbox`), `description` (= `vehicle_listings.highlights`), `photos: [{ mime, dataUrl }]` (max. 7: Hauptbild zuerst, dann `sort_order`, `created_at`).
  - Auswahl: `vehicles.archived = false AND vehicles.customer_id IS NULL` (Bestand = kundenlos), Sortierung `vehicles.created_at DESC`, `LEFT JOIN vehicle_listings` (`:737-756`). `vehicle_listings.status` wird selektiert, aber **nicht** gefiltert (`:750`, B-520). Fahrzeuge ohne Listing erscheinen mit `priceGross: null`.
  - Bewusst nicht exponiert: Kennzeichen, FIN, HSN/TSN, Ankaufspreis/-datum, Notizen, Kunde, Listing-Status, Fahrzeug-interne IDs außer `id`.
  - Fehler: nur 401/429/500.
- **GET `/api/public/used-cars/[id]`** — `used-cars/[id]/endpoint.ts:20-37`
  - Pfadparameter `id`: `pipe(string(), trim(), uuid('id must be a valid UUID.'))` → sonst `400 BAD_REQUEST`.
  - `getPublicUsedCar(id)` (`vehicle-service.ts:809-858`): gleiche Filter wie Liste; `null` → `404 'Vehicle not found.'`. Rückgabe `{ data: { vehicle: PublicUsedCar } }`, Fotos `slice(0, 7)`.
- **GET `/api/public/tires`** — `tires/endpoint.ts:106-120`
  - Query (alle optional): `q` (ILIKE `%q%` auf `article_number|brand|model`), `size` (Slash-Form, geparst durch `parseTireSize`, `tire-service.ts:396-421`: `^(\d{2,3})\s*/\s*(\d{2,3})\s*(Z?R|D)?\s*(\d{2,3})$`, `ZR`→`R`, fehlende Bauart → `R`; **unparsebar → leere Liste, kein 400**, `:475-479`), `season` (exakt, case-sensitiv, Werte `Sommer|Winter|Ganzjahres`), `brand` (exakt), `maxPriceNet` (Zahl ≥ 0; sonst `400 'maxPriceNet must be a non-negative number.'`, `tires/endpoint.ts:61-68`; Filter in JS **nach** Vollabruf, Reifen ohne Preis fallen dann raus, `tire-service.ts:509-516`). `speedIndex` u. ä. werden ignoriert. Keine Pagination.
  - Grundfilter `tires.online_sellable = true`, Sortierung `created_at DESC` (`:460-497`).
  - Rückgabe `{ data: { tires: PublicTire[] } }` (`tires/endpoint.ts:31-59`): `id, articleNumber, description|null, brand, model, width, aspectRatio, construction, diameterInch, sizeLabel` (`<w>/<ar><constr><d>`), `loadIndex, speedIndex, season, ean, manufacturerPartNumber, fuelEfficiency, wetGrip, noiseClass, noiseDb, runFlat, reinforced, studdedWinter, mSMarking, snowFlake, evCertified, currentPriceNet` (number|null, jüngste `tire_price_versions.valid_from <= heute`), `photos: [{ mime, url }]` (Data-URL, max. 7).
  - Bewusst nicht exponiert: `purchasePriceNet`, `stockOnHand`, `notes`, `legacyArticleNumber`, `onlineSellable`, Zeitstempel.
- **GET `/api/public/tires/[id]`** — `tires/[id]/endpoint.ts:19-37`: `id` UUID-validiert (400), `getPublicTire(id)` (`tire-service.ts:528-543`, `online_sellable = true`), sonst `404 'Tire not found.'`; `{ data: { tire: PublicTire } }`.
- **GET `/api/public/services`** — `services/endpoint.ts:29-43`
  - Keine Parameter, keine Pagination. `listPublicServices()` (`src/lib/server/services/item-service.ts:136-149`): **alle** `items.kind = 'service'`, `created_at DESC`, Preis je Zeile via `getCurrentItemPrice` (N+1). Enthält damit auch das geseedete Item `ARBEIT`/„Arbeitszeit" (`src/lib/server/db/seed-defaults.ts:256-263`, `kind: 'service'`) — der interne Stundensatz wird öffentlich (B-494).
  - Rückgabe `{ data: { services: [{ id, articleNumber, description, unit|null, currentPriceNet|null, onlineBookable, attributes: {} }] } }` — `attributes` ist ein leeres Altlast-Feld (Migration 0022 hat JSONB entfernt, `:5-9`).
- **GET `/api/public/services/[id]`** — `services/[id]/endpoint.ts:19-45`: `id` UUID (400); `getItem(id)`; `!row || row.kind !== 'service'` → `404 'Service not found.'`; `{ data: { service } }` gleiche Projektion. Kein `onlineBookable`-Filter.
- **GET `/api/public/free-slots`** — `free-slots/endpoint.ts:42-92`
  - Query: `from`, `to` (Pflicht; `new Date(value)`; fehlend → `400 'Query parameter "from" is required.'`, ungültig → `400 '… is not a valid ISO datetime.'`; Strings ohne Offset werden in **Server-Lokalzeit** interpretiert), `durationMinutes` (Default 30; ganzzahlig > 0 sonst `400 'durationMinutes must be a positive integer.'`; > 480 → `400 'durationMinutes may not exceed 480.'`; Dateikommentar `:7` nennt fälschlich `[5..480]`), `service` (optional; `getItem(serviceId)` **ohne** UUID-Validierung → Nicht-UUID erzeugt DB-Fehler → 500, B-495; nicht gefunden/kein Service → `404 'Service not found.'`; `!onlineBookable` → `400 'This service is not available for online booking; please arrange it by phone.'`; hat sonst **keinen** Effekt auf die Berechnung).
  - `findFreeSlots({ from, to, durationMinutes })` (siehe §3); Service-Fehler werden per Regex auf Meldungen gemappt: `/60 days/` → `400 'Range may not exceed 60 days.'`, `/>= from/` → `400 '"to" must be greater than or equal to "from".'`, `/positive/` → 400; sonst rethrow → 500.
  - Rückgabe `{ data: { slots: [{ startsAt, endsAt }] } }` (ISO UTC).
- **GET `/api/public/company`** — `company/endpoint.ts:54-89`
  - Quelle: `getSettings()` (`src/lib/server/services/settings-service.ts:7-14`, legt Singleton-Zeile lazy an) + `listWorkshopHours()` (`workshop-hours-service.ts:46-66`, legt fehlende Wochentage lazy mit Mo–Fr 08:00–17:00 / Sa+So geschlossen an, normalisiert `HH:MM`).
  - Rückgabe `{ data: { company: { legalName, brandName, tagline: null, address: { street, zip, city, state }, contact: { phone, mobile|null, email, website|null }, geo: { lat, lon } | null, openingHours: [{ weekday: 'sunday'…'saturday', opensAt|null, closesAt|null, closed }] } } }`. `legalName === brandName === company_settings.company_name`, `tagline` immer `null` (B-505). `geo` nur wenn `geo_lat` **und** `geo_lon` gesetzt (`:65-68`). `state` = Rohwert `company_settings.state` (Bundesland-Kürzel).
  - Bewusst nicht exponiert: `owner`, `fax`, `vatId`, `taxNumber`, Bank, `defaultVatRate`, Logo, PDF-Footer, Reminder-Settings, `laborItemId`.
- **GET `/api/public/posts`** — `posts/endpoint.ts:62-82`
  - Query: `page` (Default 1), `pageSize` (Default 10, **Maximum 50 — größere Werte werden still auf 50 geklemmt**, `:72`); nicht-positive Ganzzahl → `400 '<page|pageSize> must be a positive integer.'` (`:35-46`).
  - `listPublicPosts(page, size)` (`post-service.ts:196-227`): `published = true`, Sortierung `published_at DESC, created_at DESC`.
  - Rückgabe `{ data: { posts: PublicPost[], total, page, pageSize, pageCount } }` (`pageCount = max(1, ceil(total/size))`); `PublicPost` (`:21-29`): `id, slug, title, excerpt|null, body, publishedAt` (ISO|null), `coverImage: { mime, url } | null` (`url` = Data-URL aus `posts.cover_image.data`, `:56-58`). Body ist Rohtext ohne definiertes Format (B-509).
  - Bewusst nicht exponiert: `published`, `createdAt`, `updatedAt`.
- **GET `/api/public/posts/[slug]`** — `posts/[slug]/endpoint.ts:32-49`: `slug` `pipe(string(), trim(), minLength(1,'slug must not be empty.'), maxLength(220,'slug is too long.'))` → 400; `getPublicPostBySlug` (`post-service.ts:231-248`, `slug = ? AND published = true`) → `null` → `404 'Post not found.'` (Entwürfe ununterscheidbar von unbekannt); `{ data: { post } }`.

### 2c. POST-Endpoints

- **POST `/api/public/appointments`** — `appointments/endpoint.ts:87-240`
  - Body-Schema (`:60-75`): `customerEmail` (`emailSchema`: trim, max 254 „Die E-Mail darf maximal 254 Zeichen lang sein.", `email('Bitte geben Sie eine gültige E-Mail-Adresse ein.')`), `customerName` (`nameSchema`: `string('Bitte geben Sie einen Namen ein.')`, trim, min 1 „Der Name darf nicht leer sein.", max 100), `customerPhone?` (`phoneSchema`: trim, max 30), `serviceId?` (`pipe(string(), trim())` — **keine UUID-Prüfung**, im Schema optional, in der Logik Pflicht), `startsAt` (`dateFromStringSchema`: `string` → `new Date`, check gültig „Bitte geben Sie ein gültiges Datum ein."), `durationMinutes?` (`number`, `integer('durationMinutes must be an integer.')`, `minValue(1,'durationMinutes must be positive.')`, `maxValue(480,'durationMinutes is too large.')`; in der Logik Pflicht), `notes?` (`notesSchema`: trim, max 2000).
  - Ablauf: (1) `!serviceId` → `400 'Only online-bookable services (tire change) can be booked online; please arrange other appointments by phone.'` (`:117-122`); (2) `getItem(serviceId)`; `!service || kind !== 'service'` → `404 'Service not found.'`; `!onlineBookable` → `400 'This service is not available for online booking; …'`; `title = service.description` (Default `'Online-Termin'` `:115` unerreichbar); (3) `!durationMinutes` → `400 'durationMinutes is required.'`; (4) `startsAt <= now` → `400 'Appointment must be in the future.'`; (5) `findFreeSlots({ from: startsAt, to: slotEnd + 60 s, durationMinutes })`, verfügbar nur wenn ein Slot **exakt** `startsAt` entspricht (15-Minuten-Raster ab `opensAt`), sonst `409 'Termin ist nicht mehr verfügbar.'` (deutsch, `:146-158`); (6) Kunde per `customers.email = customerEmail` (erste Zeile, kein `archived`-Filter, `:161-165`), sonst Insert: `customerNumber = nextCustomerNumber()` (Nummernkreis `customer`), `kind: 'regular'`, `wantsBroadcast: false`, `firstName`/`lastName` = Split am ersten Leerzeichen, `email`, `phone` (`:169-188`); (7) Insert `calendar_entries` `{ kind: 'appointment', title, startsAt, endsAt, allDay: false, status: 'scheduled', customerId, notes: '<notes>\nconfirmation:<uuid>' }` (`:191-210`); (8) `sendAppointmentConfirmation(...)` best-effort in try/catch (`:217-232`).
  - Rückgabe `{ data: { appointmentId, startsAt (ISO), endsAt (ISO), confirmationToken (UUID v4) } }`. Kunden-ID verlässt den Server nicht.
  - Nebenwirkungen: Nummernkreis `customer`, Tabelle `customers`, `calendar_entries`, Mail (`sent_messages` mit `document_type = 'appointment_confirmation'`). **Keine Transaktion** (Kunde und Termin getrennt), keine DB-seitige Kollisionssperre (Race zwischen Prüfung und Insert).
- **POST `/api/public/orders`** — `orders/endpoint.ts:117-260`
  - Body-Schema (`:69-92`): `customerEmail`, `customerName`, `customerPhone?` (wie oben), `deliveryAddress: { street (addressLineSchema max 200 + minLength 1 'street may not be empty.'), zip (zipSchema max 10 + min 1 'zip may not be empty.'), city (citySchema max 150 + min 1 'city may not be empty.') }`, `lines: array(min 1 'lines must not be empty.')` mit `{ tireId: uuid('tireId must be a valid UUID.'), quantity: integer 1..10000 ('quantity must be an integer.'/'quantity must be at least 1.'/'quantity is too large.') }`, `notes?` (max 2000). Legacy-Key `shippingOptionId` wird still gestrippt (`:19-23`).
  - Ablauf: je Zeile `tires` per `id` laden (`:152-178`): fehlt → `404 'Tire <id> not found.'`; `!onlineSellable` → `400 'Mindestens ein Artikel ist kein Online-Reifen.'` (deutsch); kein aktueller Preis → `409 'Tire <articleNumber> has no current price.'`; Beschreibung = `tires.description ?? '<brand> <model> <w>/<ar><constr><d>'`. Kunde find-or-create wie bei appointments, beim Anlegen zusätzlich `street/zip/city` aus `deliveryAddress` via `createCustomer` (`:181-205`); bestehender Kunde wird **nicht** aktualisiert. `vatRate = Number(company_settings.default_vat_rate)` (`:207-208`); `smallBusinessExempt` wird ignoriert. `totalNet = round2(Σ qty×price)`, `totalGross = round2(totalNet × (1+vat/100))` (`:210-213`). `createDocument({ type: 'invoice', customerId, issueDate: heute (UTC-Datum), notes: 'Online-Bestellung\nLieferadresse: <street>, <zip> <city>\n<notes>', items: [{ description, quantity, unit: 'Stk', unitPriceNet, discountPercent: 0, taxRate: vatRate, kind: 'article', articleNumber }] })` (`:227-239`) — vergibt Rechnungsnummer (Nummernkreis `invoice`), berechnet Summen zeilenweise, rendert und persistiert das PDF (`document-service.ts:236-318`); danach `setDocumentStatus(id, 'draft')` (`:243`).
  - Rückgabe `{ data: { orderId, orderNumber, totalNet, totalGross, shippingNet: 0 (Wire-Kompat), estimatedDelivery: 'YYYY-MM-DD' (heute + 7 Tage) } }`.
  - Fachlich: eine **Reifenbestellung aus dem Web-Shop**, die als **Rechnungsentwurf** (`documents.type='invoice'`, `status='draft'`) mit Positionen landet — kein Werkstattauftrag (`work_orders`), kein Lagerabgang, keine Bestätigungsmail an den Kunden, kein eigener Bestell-Datensatz. Keine Transaktion.
- **POST `/api/public/contact`** — `contact/endpoint.ts:80-158`
  - Body-Schema (`:48-68`): `customerEmail`, `customerName`, `customerPhone?` (wie oben), `subject` (`subjectSchema`: trim, max 200 — **kein minLength**, leerer Betreff möglich), `message` (`longTextSchema`: trim, max 10 000 — **kein minLength**), `referenceId?` (trim, min 1 'referenceId may not be empty.', max 64 'referenceId is too long.'), `referenceType?` (`picklist(['used-car','article','tire','general'])`, Meldung 'referenceType must be one of …').
  - Ablauf: Insert `customer_inquiries` **zuerst** (`customerId: null`, Felder 1:1, `status` DB-Default `'new'`, `notification_status` Default `'pending'`, `:107-122`); dann `sendContactNotification(...)` und `recordInquiryNotificationResult(row.id, result)` (`:128-155`); jede Mail-Ausnahme wird gefangen und als `failed` verbucht; Antwort **immer** 200.
  - Rückgabe `{ data: { inquiryId, receivedAt (ISO) } }`.
  - Spam-Schutz: nur Bearer-Token + Rate-Limits; kein Honeypot/Captcha/Duplikatcheck (B-503).

### 2d. Interne Remote Functions

- **`listPostsRemote`** — query — `src/routes/posts/posts.remote.ts:88-97`
  - Guard: `requirePermission('posts')`.
  - Argumente (`listSchema` `:75-80`): `page: number()`, `size: picklist([10,25,50,100])`, `q?: pipe(string(), trim(), maxLength(200))` (keine deutsche Meldung), `published?: picklist(['published','draft','all'])`.
  - Rückgabe `ListResult<Post>` `{ items, total, page, size, pageCount }` (volle `posts`-Zeilen inkl. Base64-Cover).
  - Fehler: 401/403 aus Guard; Validierung → `handleValidationError`.
- **`getPostRemote`** — query — `:105-110`; Arg `{ id: idSchema }` (min 1, max 64, trim); `null` → `error(404, 'Beitrag nicht gefunden.')`.
- **`createPostRemote`** — command — `:118-126`; Arg `postInputSchema` (`:52-73`): `title` (`string('Bitte einen Titel eingeben.')`, trim, min 1 „Der Titel darf nicht leer sein.", max 200 „Der Titel darf maximal 200 Zeichen lang sein."), `excerpt?` (trim, max 500 „Der Teaser darf maximal 500 Zeichen lang sein."), `body` (`string('Bitte einen Inhalt eingeben.')`, min 1 „Der Inhalt darf nicht leer sein.", max 50 000 „Der Inhalt darf maximal 50.000 Zeichen lang sein."; **kein trim** im Schema, Form trimmt selbst), `coverImage?: nullable({ mime: check ∈ ['image/png','image/jpeg','image/webp'] „Nur PNG-, JPEG- oder WebP-Bilder sind erlaubt.", data: min 1 „Bilddaten dürfen nicht leer sein.", max 7 000 000 Zeichen „Das Bild ist zu groß (maximal ca. 5 MB)." })`, `published: boolean()`. Nebenwirkung: `requested(listPostsRemote, 4).refreshAll()`. Rückgabe: erzeugte `Post`-Zeile. Keine Transaktion (Slug-Lookup + Insert getrennt).
- **`updatePostRemote`** — command — `:134-148`; Arg `{ id: idSchema, values: postInputSchema }`; ruft `updatePost` (wirft bei unbekannter id `new Error('Beitrag nicht gefunden.')` → 500, B-506); refresh `getPostRemote({id}).refresh()` + `requested(listPostsRemote, 4).refreshAll()`.
- **`setPostPublishedRemote`** — command — `:157-168`; Arg `{ id, published: boolean() }`; `setPostPublished`; refresh wie oben; Client nutzt `.updates(getPostRemote({id}).withOverride(...))` (`[id]/+page.svelte:32-39`).
- **`deletePostRemote`** — command — `:176-183`; Arg `{ id }`; Hard-Delete ohne Guard; refresh Liste; Client-Override in `/posts` (`+page.svelte:58-66`).
- **`listInquiriesRemote`** — query — `src/routes/settings/inquiries.remote.ts:43-69`
  - Guard: `requirePermission('mailings')`.
  - Arg: `page: number()`, `size: picklist([10,25,50,100])`, `status?: picklist(['pending','sent','failed'])` (Filter auf `notification_status`, **nicht** auf `status`).
  - Rückgabe `{ items: CustomerInquiry[] (volle Zeilen inkl. message), total, page, size, pageCount }`, Sortierung `created_at DESC`.
- **`retryInquiryNotificationRemote`** — command — `:78-112`; Guard `mailings`; Arg `{ id: idSchema }`; unbekannt → `error(404, 'Anfrage nicht gefunden.')`; ruft `sendContactNotification` mit den Zeilenfeldern erneut auf (auch bei Status `sent` → bewusst erneuter Versand, `:5-12`), `recordInquiryNotificationResult`, `requested(listInquiriesRemote, 4).refreshAll()`; Rückgabe `{ ok: true } | { ok: false, error }` (Fehlertext = roher SMTP-Fehler). Client zeigt Toast „Benachrichtigung erneut gesendet." bzw. `Versand fehlgeschlagen: <error>` (`inquiries/+page.svelte:59-73`) — der Client deklariert **kein** `.updates(...)`; Aktualisierung des Status in der Liste hängt damit am `refreshAll()` allein (laut CLAUDE.md wirkungslos ohne Client-`.updates`; B-PUB-36).

## 3. Services (Server-Layer)

### `src/lib/server/services/post-service.ts`
- `slugify(input: string): string` (`:14-27`) — lowercase, `ä→ae ö→oe ü→ue ß→ss`, NFKD + Diakritika weg, Nicht-`[a-z0-9]` → `-`, Rand-Bindestriche weg, max 200, Fallback `'beitrag'`. Rein.
- `uniqueSlug(base, excludeId?)` (`:33-52`, nicht exportiert) — Schleife mit je einem `SELECT id FROM posts WHERE slug = ? [AND id <> ?] LIMIT 1`, Suffix `-2`, `-3`, …, `slice(0, 220)`. Unbegrenzte Schleife, nicht transaktional (Race → Unique-Index-Verstoß `posts_slug_idx` → 500).
- `listPosts(params: ListParams & { published?: boolean })` (`:67-98`) — `ILIKE` auf `title`/`excerpt` (nicht `body`), Filter `published`, `ORDER BY created_at DESC`, `LIMIT/OFFSET`, zweiter `COUNT`-Query. Liefert volle Zeilen inkl. `cover_image` (Base64) — Listenpayload schwer.
- `getPost(id)` (`:100-103`).
- `createPost(input: PostInput)` (`:105-118`) — `publishedAt = published ? now : null`.
- `updatePost(id, input)` (`:120-153`) — Slug bleibt nur bei **unverändertem Titel**; sonst `uniqueSlug(slugify(title), id)`; `publishedAt` wird nur beim ersten Live-Gang gestempelt und bleibt beim Unpublish erhalten; wirft `Error('Beitrag nicht gefunden.')` (kein HttpError).
- `setPostPublished(id, published)` (`:160-173`) — wie oben nur Flag + `publishedAt`.
- `deletePost(id)` (`:176-178`) — `DELETE`, kein Ergebnis-Check.
- `listPublicPosts(page, size)` (`:196-227`), `getPublicPostBySlug(slug)` (`:231-248`) — nur `published = true`; Projektion `PublicPostRow` ohne `published/createdAt/updatedAt`. Index `posts_published_idx (published, published_at)` vorhanden (`schema.ts:1544`).

### `src/lib/server/services/public-api-service.ts`
- `findFreeSlots({ from, to, durationMinutes }): Promise<FreeSlot[]>` (`:60-196`) — Vorprüfungen werfen `Error` (`durationMinutes must be positive`, `to must be >= from`, `range exceeds 60 days`). DB: `SELECT * FROM workshop_hours` (ohne Lazy-Create — fehlende Tage → `defaultHoursFor`, `:199-206`), `calendar_entries` `kind='appointment'` und `kind='closure'` im Fenster ±1 Tag (zwei Queries parallel), `getCompanyHolidayState()` (Bundesland aus `company_settings`), Feiertage algorithmisch (`holiday-service.ts:235`). Stornierte Termine (`status='cancelled'`) werden in JS herausgefiltert. Raster: pro **lokalem** Kalendertag (`setHours(0,0,0,0)`, `getDay()`), 15-Minuten-Schritte ab `opensAt`, Slot muss vollständig in `[from, to]` und in den Öffnungszeiten liegen, `O(Slots × Blocker)`. Zeitzone = Prozess-TZ (B-498).

### `src/lib/server/api-tokens.ts` / `src/lib/server/rate-limit.ts` / `src/lib/server/public-api.ts`
Siehe §2a. Exporte: `verifyApiToken`, `authenticateRequest`, Typ `AuthenticatedApiToken`; `rateLimit`, `resetRateLimit`, `_rateLimitCountForTests`; `publicApi`, `ok`, `fail`, Typen `PublicApiOk`, `PublicApiErr`. Kein DB-Zugriff.

### `src/lib/server/services/mail-service.ts` (Anteile dieses Moduls)
- `sendAppointmentConfirmation(input: SendAppointmentConfirmationInput)` (`:662-745`) — Template `appointment_confirmation` (`loadTemplate`; Fehler → `{ ok: false }`), Platzhalter `kundeVorname`, `terminDatum` (DD.MM.YYYY **Europe/Berlin**), `terminUhrzeit` (HH:MM Europe/Berlin), `terminDauer`, `leistung` („Leistung:    <title>\n" oder leer), `bestaetigungsCode`; SMTP aus `smtp_settings`; Insert `sent_messages` `{ documentId: null, documentType: 'appointment_confirmation', recipientEmail, recipientName, subject, bodyText, attachmentMeta: [], status: 'pending' }` → `sent`/`failed`. Rückgabe `SendDocumentResult`.
- `sendContactNotification(input: ContactNotificationInput)` (`:995-1055`) — Empfänger `company_settings.email` (leer → `{ ok: false, error: 'Keine Empfänger-Adresse hinterlegt - bitte „E-Mail" in den Firmen-Einstellungen ausfüllen.' }`), `resolveReference` (`:792-935`: `general` → null; Nicht-UUID → Warnung + null; `used-car` → `vehicles` + `getEffectiveLicensePlate` + `vehicle_listings` (Fahrzeug, Erstzulassung, Kennzeichen, Preis brutto, URL `/vehicles/<id>`); `tire` → `tires` + `tire_price_versions` (Reifen, Größe, Saison, Artikel-Nr., Preis netto, URL `/tires/<id>`); `article` → `items` + `item_price_versions` (Artikel-Nr., Beschreibung, Preis netto, URL `/items/<id>`)), Betreff `[Anfrage] <subject>` (max 200), Body `buildContactBody` (`:944-982`: „Eine neue Anfrage über das Kontaktformular ist eingegangen." / Anfrage von / Betreff / Nachricht / Bezogen auf + Detailseite (relative URL) / Anfrage-ID / Eingegangen am via `formatTimestampDe` = Server-Lokalzeit), `Reply-To = customerEmail`, `sent_messages` mit `documentType: 'mailing'`.
- `recordInquiryNotificationResult(inquiryId, result)` (`:1217-1236`) — `sent` + `notification_sent_at = now` + `notification_error = null` bzw. `failed` + `notification_error = result.error`.

### Fremd-Services, die die Endpoints nutzen
- `vehicle-service.ts`: `listPublicUsedCars()` (`:737-798`; 2 Queries: Fahrzeuge + alle Fotos via `inArray`, Bucketing max 7), `getPublicUsedCar(id)` (`:809-858`).
- `tire-service.ts`: `listPublicTires(filters)` (`:460-522`; 1 Query Reifen + **N** Preis-Queries + 1 Foto-Query), `getPublicTire(id)` (`:528-543`), `parseTireSize` (`:396-421`), `getCurrentTirePrice` (`:215` → `getTirePriceAt`, `:200-213`).
- `item-service.ts`: `getItem(id)` (`:119-124`, 2 Queries), `listPublicServices()` (`:136-149`, 1 + N Queries).
- `workshop-hours-service.ts`: `listWorkshopHours()` (`:46-66`, Lazy-Insert fehlender Wochentage).
- `settings-service.ts`: `getSettings()` (`:7-14`, Lazy-Insert der Singleton-Zeile).
- `customer-service.ts`: `nextCustomerNumber()` (`:125-127`, `allocateNumber('customer')`), `createCustomer(values)` (`:132-141`).
- `document-service.ts`: `createDocument(input)` (`:236-318`; Nummer via `nextDocumentNumber('invoice')`, Summen zeilenweise gerundet, `status: 'created'`, PDF-Render in try/catch), `setDocumentStatus(id, status)` (`:586-594`).

## 4. Komponenten (modul-lokal)

| Komponente | Datei | Zweck | Props (Name: Typ, default) | Events/Callbacks | Snippets/Slots | Interner State | Verwendete Shared-Komponenten |
|---|---|---|---|---|---|---|---|
| `PostForm` | `src/routes/posts/PostForm.svelte` | Anlege-/Bearbeitungsformular für Beiträge | `initial?: { title?, excerpt?, body?, coverImage?, published? }` (default `{}`), `onSave: (values: PostFormValues) => Promise<void> \| void`, `onCancel?: () => void` | `onSave` mit `{ title: trim, excerpt: trim\|undefined, body: trim, coverImage, published }` (`:107-113`); `onCancel` | keine | `title`, `excerpt`, `body`, `coverImage` (`{ mime, data }\|null`), `published`, `errorMsg`; `useFormValidation(postSchema)` nur für `title`/`body` (deutsche Meldungen „Bitte einen Titel eingeben."/„Bitte einen Inhalt eingeben."/max-Längen, `:59-71`); `formDirty.set(true)` bei `oninput`/`onchange`/Bild-Upload, `formDirty.clear()` beim Unmount (`:116-117`) | `FormField`, `ImageUploader` (`single`, `allowSetMain={false}`, `maxBytes = 5 MiB`, Hint „Optional. PNG, JPEG oder WebP, max. 5 MB."), `busy` (Submit/Abbrechen `disabled={busy.active}`) |

Form-Verhalten: `novalidate`; Klick-Zeit-Validierung (`fv.markAllTouched()`), Fehlerzusammenfassung als `alert alert-error` (erster Feldfehler oder „Bitte prüfen Sie Ihre Eingabe."), Feldfehler nur nach `touched`; Speichern-Button nie wegen fehlender Eingabe deaktiviert (Test `PostForm.test.ts:42-47`). Native `maxlength`-Attribute 200/500/50000.

Weitere in diesem Modul genutzte Shared-Komponenten: `PageHeader` (Primäraktion, `back`, `toolbar`-Snippet), `Toolbar` (`bind:query`, `onQuery` → `pageNum = 1`), `Pagination` (`page`, `pageCount`, `total`, `size`, `onPage`), `EmptyState` (Icon `Newspaper` bzw. `Inbox`), `ConfirmDialog` (`variant="danger"`), `TabGroup` (Settings-Layout).

## 5. Tabellen

| Tabelle | Relevante Spalten / Enums | Fundstelle |
|---|---|---|
| `posts` | `id uuid`, `title varchar(200)`, `slug varchar(220)` (unique `posts_slug_idx`), `excerpt varchar(500)`, `body text`, `cover_image jsonb {mime,data}`, `published boolean default false`, `published_at timestamptz` (erste Veröffentlichung, bleibt bei Unpublish), `created_at`, `updated_at`; Index `posts_published_idx (published, published_at)` | `src/lib/server/db/schema.ts:1521-1546`, `drizzle/0029_posts.sql` |
| `customer_inquiries` | `id`, `customer_id uuid null` (FK `customers` `ON DELETE SET NULL`, **nie gesetzt**), `customer_email varchar(254)`, `customer_name varchar(200)`, `customer_phone varchar(30)`, `subject varchar(200)`, `message text`, `reference_id varchar(64)`, `reference_type varchar(20)` (`used-car\|article\|tire\|general`), `status varchar(20) default 'new'` (Migration nennt `new/read/archived`; **nirgends gelesen/geschrieben**), `notification_status varchar(20) default 'pending'` (`pending\|sent\|failed`), `notification_sent_at`, `notification_error text`, `created_at`; Indizes `created_at`, `status`, `notification_status` | `schema.ts:1464-1505`, `drizzle/0016_customer_inquiries.sql`, `drizzle/0023_inquiry_notification_status.sql` |
| `company_settings` (öffentliche Felder) | `company_name`, `street`, `zip`, `city`, `state varchar(50)`, `phone`, `mobile`, `email`, `website`, `geo_lat numeric(9,6)`, `geo_lon numeric(9,6)` (Migration 0018), `default_vat_rate numeric(5,2)` (für Orders), `small_business_exempt` (ignoriert) | `schema.ts:33-116`, `drizzle/0018_company_geo.sql` |
| `workshop_hours` | `weekday int PK (0=So…6=Sa)`, `opens_at text 'HH:MM'` (in DB als `time`, wird auf 5 Zeichen normalisiert), `closes_at`, `closed boolean` | `schema.ts:1761-1770` |
| `calendar_entries` | `kind varchar(20)` (`appointment`/`closure`), `title`, `starts_at`, `ends_at`, `all_day`, `status varchar(20)` (`scheduled\|completed\|cancelled`, `src/routes/calendar/calendar.remote.ts:53`), `customer_id`, `notes text` (enthält `confirmation:<uuid>`) | `schema.ts:947-975` |
| `customers` | `customer_number`, `kind`, `wants_broadcast`, `first_name`, `last_name`, `email` (nicht unique), `phone`, `street`, `zip`, `city`, `archived` | `schema.ts:170-225` (Auszug) |
| `documents` / `document_items` | `type='invoice'`, `status` (`created` → `draft`), `document_number`, `notes`, Summen; Positionen `kind='article'`, `unit='Stk'` | `document-service.ts:236-318` |
| `tires` / `tire_price_versions` / `tire_photos` | `online_sellable boolean` (Index `tires_online_sellable_idx`), EU-Label-Spalten, `season varchar(20)`; Preise `valid_from`/`unit_price_net`; Fotos `mime`, `data` (Data-URL), `is_main`, `sort_order` | `schema.ts:1327-1460` |
| `items` / `item_price_versions` | `kind` (`article\|service`), `online_bookable boolean` | `schema.ts:437-475` |
| `vehicles` / `vehicle_listings` / `vehicle_photos` | `archived`, `customer_id`, `make`, `model`, `first_registration`, `mileage_km`, `fuel_type`, `gearbox`; Listing `status` (default `'available'`), `sales_price_gross`, `highlights`; Fotos `mime`, `data_url`, `is_main`, `sort_order` | `schema.ts:243-400` |
| `sent_messages` | `document_type` (`appointment_confirmation` bzw. `mailing`), `recipient_email`, `subject`, `body_text`, `status`, `smtp_message_id`, `error_message` | `schema.ts:1073-1100` |
| `mail_templates` | Key `appointment_confirmation` (Seed `seed-defaults.ts:116-131`) | — |
| `number_ranges` | Kinds `customer`, `invoice` | `schema.ts:139-144` |
| `api_tokens` (Historie) | Angelegt in `drizzle/0013_public_api_tokens.sql` (`token_hash`, `token_prefix`, `expires_at`, `revoked_at`, `last_used_at`), **gedroppt** in `drizzle/0025_drop_api_tokens.sql`; Schema enthält nur noch einen leeren Kommentarblock (`schema.ts:1772-1774`) | ADR-010 |

## 6. Flows (durchgängig, Start bis Ende)

- **Beitrag anlegen** — Sidebar „Aktuelle Informationen" → `/posts` → Button „Neuer Beitrag" (Header oder EmptyState) → `/posts/new` → Titel, Teaser, Inhalt, optional Titelbild (ImageUploader), Checkbox „Veröffentlicht" → „Speichern" → `createPostRemote` → Toast „Beitrag angelegt." → `/posts/<id>` (replaceState).
  - Leerzustand Liste: EmptyState „Noch keine Beiträge" / „Veröffentlichen Sie Neuigkeiten für Ihre Website." + Button „Neuer Beitrag".
  - Ladezustand: globaler `busy`-Balken/Overlay; Speichern-Button zeigt Spinner bei `busy.active`.
  - Validierungsfehler: Titel leer → „Bitte einen Titel eingeben."; Inhalt leer → „Bitte einen Inhalt eingeben."; > 200/50 000 Zeichen → Max-Meldungen; angezeigt als `alert-error` oben plus Feldfehler nach Touch. Serverseitig zusätzlich Cover-MIME/-Größe (`handleValidationError` → „Ungültige Eingabe für „…": …").
  - Fehlerzustand: `handleClientError(err)` → Toast; Formular bleibt dirty.
  - Abbruchpfade: „Abbrechen" → `/posts` (Unsaved-Changes-Guard über `formDirty`).
  - Berechtigungs-Verweigerung: ohne `posts` kein Sidebar-Eintrag; Direktaufruf → Remote wirft 403 → `+error.svelte`.
  - Bestätigungsdialoge: keine.
- **Beitrag bearbeiten** — `/posts/<id>` → „Bearbeiten" (oder Stift-Icon in Liste) → `/posts/<id>/edit` → Formular vorbefüllt → Speichern → `updatePostRemote` → Toast „Beitrag gespeichert." → `/posts/<id>`. Titeländerung erzeugt neuen Slug (B-508). Abbrechen → `/posts/<id>`.
- **Beitrag veröffentlichen/verbergen** — Detail → Button „Veröffentlichen" (Icon Eye) bzw. „Verbergen" (EyeOff) → optimistischer Override von `getPostRemote` → Toast „Beitrag veröffentlicht." / „Beitrag verborgen."; `publishedAt` beim ersten Mal gestempelt. Kein Bestätigungsdialog.
- **Beitrag löschen** — (a) Liste: Papierkorb-Icon (Aktionszelle mit `stopPropagation`) → `ConfirmDialog` „Beitrag löschen?" / „Soll der Beitrag "<Titel>" wirklich gelöscht werden?" / „Löschen" (danger) → optimistisches Entfernen aus Liste → Toast „Beitrag „<Titel>" gelöscht."; (b) Detail: Button „Löschen" → gleicher Dialog → Toast „Beitrag gelöscht." → `/posts` (replaceState). Kein Löschguard (Website-Links brechen).
- **Anfragen sichten und Benachrichtigung erneut senden** — Sidebar „Anfragen" (Kommunikation) oder Settings-Tab → `/settings/inquiries` → Filterbuttons Alle/Ausstehend/Versendet/Fehlgeschlagen → Tabelle (Eingegangen, Von = Name + E-Mail, Betreff (truncate), Bezug = `referenceType`-Rohwert, Benachrichtigung-Badge „Versendet"/„Fehlgeschlagen"/„Ausstehend" + Fehlertext + Sendezeit, Aktion „Erneut senden") → `retryInquiryNotificationRemote` → Toast „Benachrichtigung erneut gesendet." bzw. `Versand fehlgeschlagen: <SMTP-Fehler>`.
  - Leerzustand: EmptyState „Keine Anfragen" / „Sobald Besucher der Webseite das Kontaktformular nutzen, erscheinen die Anfragen hier."
  - Validierungsfehler: keine Eingaben.
  - Fehlerzustand: `handleClientError(err, 'Benachrichtigung konnte nicht erneut gesendet werden')`.
  - Der **Nachrichtentext wird nirgends angezeigt**, es gibt kein Detail, keine Statusänderung, keine Zuweisung, kein „Erledigen", kein „Kunde anlegen", keine Zeile ist klickbar (B-486/02).
- **Website → Kontaktanfrage** — Website POST `/api/public/contact` (Bearer) → Validierung → Insert `customer_inquiries` → interne Mail an `company_settings.email` (Reply-To = Absender) → Status `sent`/`failed` → Antwort 200 `{ inquiryId, receivedAt }`; Operator sieht Zeile unter Anfragen.
- **Website → Terminbuchung** — Website GET `/api/public/services` (filtert clientseitig `onlineBookable`) → GET `/api/public/free-slots?from&to&durationMinutes&service` → POST `/api/public/appointments` → Kunde find-or-create → `calendar_entries` (scheduled) → Bestätigungsmail an Kunden (Template „Ihre Terminbestätigung bei {firma}") → Antwort `{ appointmentId, startsAt, endsAt, confirmationToken }`. Der Termin erscheint im Kalender-Modul; das Token hat keine weitere Verwendung.
- **Website → Reifenbestellung** — GET `/api/public/tires` → POST `/api/public/orders` → Kunde find-or-create (mit Adresse) → Rechnungsentwurf (`invoice`/`draft`) inkl. PDF + Rechnungsnummer → Antwort mit Summen und `estimatedDelivery`. Operator findet den Entwurf im Rechnungsmodul; keine Kundenmail.
- **Website → Katalog/Firmendaten/News** — GET `/used-cars[/id]`, `/tires[/id]`, `/services[/id]`, `/company`, `/posts[/slug]`; 401 ohne Token, 429 bei Überlast, 404 mit `NOT_FOUND`.

## 7. Nebenwirkungen

- **E-Mails**:
  - `appointment_confirmation` (Vorlage aus `mail_templates`, Seed `seed-defaults.ts:116-131`: Betreff „Ihre Terminbestätigung bei {firma}", Body mit `{kundeVorname}`, `{terminDatum}`, `{terminUhrzeit} Uhr`, `{terminDauer} Minuten`, `{leistung}`, `{bestaetigungsCode}`, `{firmaTelefon}`, `{firmaMail}`, `{firma}`) — Empfänger: Kunde; Trigger: erfolgreiche Buchung über `POST /api/public/appointments`; best-effort; Audit in `sent_messages` (`document_type='appointment_confirmation'`).
  - Interne Anfrage-Benachrichtigung (kein Template, fest kodierter Body `buildContactBody`) — Empfänger `company_settings.email`, `Reply-To` = Kunde; Trigger: `POST /api/public/contact` und Retry aus `/settings/inquiries`; Audit `sent_messages` (`document_type='mailing'`); Ergebnis auf `customer_inquiries.notification_*`.
- **PDFs**: `POST /api/public/orders` → `createDocument` rendert und persistiert das Rechnungs-PDF sofort (`document-service.ts:302-313`), obwohl der Status danach `draft` ist.
- **Uploads**: Titelbild des Beitrags — clientseitig `ImageUploader` `maxBytes = 5 MiB`, serverseitig `data` ≤ 7 000 000 Zeichen, MIME `image/png|jpeg|webp`; Speicherort `posts.cover_image` (JSONB, Base64-Data-URL). Keine Dateiablage.
- **Exporte**: keine.
- **Externe APIs / Webhooks**: keine (die Website ist Konsument, nicht Ziel).
- **Nummernkreise**: `customer` (bei Neukunde via appointments/orders), `invoice` (bei jeder Bestellung, auch für Entwürfe).
- **Weitere Schreibzugriffe**: `calendar_entries` (appointments), `customers` (appointments/orders), `documents`/`document_items` (orders), `customer_inquiries` (contact), `sent_messages` (Mails), Lazy-Inserts in `company_settings` (`getSettings`) und `workshop_hours` (`listWorkshopHours`) bei GET `/company`.

## 8. Vorhandene Tests

| Testdatei | Art | Was wird abgedeckt (1 Zeile) |
|---|---|---|
| `src/routes/api/public/public-api.test.ts` (1479 Z.) | integration (pg-mem, Mail gemockt) | Auth-Wrapper (401 ohne/mit fremdem/malformed Token, OPTIONS 204+CORS); services (nur kind=service, Preis, `attributes:{}`); tires (nur onlineSellable, EU-Label, Filter size/season/maxPriceNet/q, negatives maxPriceNet 400); used-cars Liste + Detail (401/400/404/200, Fotos); free-slots (fehlende Parameter 400, 35 Slots Mo 08–17 bei 30 min, >60 Tage 400); appointments (Buchung + Kundenanlage + Mail-Payload, nicht buchbarer Service 400, belegter Slot 409, Vergangenheit 400, Kunden-Reuse per E-Mail, fehlender serviceId 400); services/:id (401/400/200/404 bei article); contact (401, persistiert + `sent`, SMTP-Fehler → 200 + `failed`, ungültige E-Mail/referenceType 400); orders (401/400, Rechnungsentwurf mit Summen, `shippingNet:0`, Legacy `shippingOptionId` toleriert); company (Identitätskarte, geo, 7 Öffnungszeiten); posts Liste (nur published, Sortierung, page/pageSize, page=0 → 400) und Detail (published/draft 404/unbekannt 404) |
| `src/routes/api/public/public-api-security.test.ts` (416 Z.) | integration | SQLi-artige Query-Parameter/IDs/Body-Felder → nie 500, Daten als Literal gespeichert; orders `quantity` 0/negativ/10 Mio/1.5 → 400, leere `lines` → 400, Nicht-UUID → 400 |
| `src/lib/server/api-tokens.test.ts` (172 Z.) | unit | `verifyApiToken` (unset/leer, Einzel-/Mehrfach-Token, Separatoren, <8 Zeichen ignoriert, Case-/Längen-Unterschiede, Env-Re-Read) und `authenticateRequest` (Präfix, `bearer` lowercase, Whitespace, fehlender Header, fremdes Schema, leerer Bearer, fail-closed) |
| `src/lib/server/rate-limit.test.ts` (107 Z.) | unit | Fenster, Burst, Reset nach 60 s, Keys unabhängig, abgelehnte Calls zählen nicht, `retryAfter` |
| `src/hooks.server.test.ts` (328 Z., Public-Anteil `:156-232`) | unit | Public-API-Hook-Limiter: Limit je Token-Bucket → 429, Bucket per Token nicht IP, IP-Fallback ohne Bearer, keine Drosselung außerhalb `/api/public`; `resolveClientIp` |
| `src/lib/server/services/public-api-service.test.ts` (256 Z.) | unit (pg-mem) | `findFreeSlots`: geschlossene Tage, 15-min-Raster, Termin-Überlappung, stornierte Termine blockieren nicht, closures, Feiertage (beweglich, Bundesland-abhängig), Mehrtagesbereich, >60 Tage / Dauer ≤0 / umgekehrter Bereich werfen, Wochentags-Öffnungszeiten |
| `src/lib/server/services/post-service.test.ts` (181 Z.) | unit (pg-mem) | `slugify` (Umlaute, Kollaps, Fallback); CRUD (Slug bei Create, publishedAt, Suffix bei Kollision, Slug-Stabilität, publishedAt bleibt bei Unpublish, delete, Admin-Liste Filter); Public-Read (nur published, Sortierung, Draft versteckt) |
| `src/routes/posts/posts.remote.test.ts` (185 Z.) | integration (Remote-Shim) | 401 anonym, 403 ohne `posts`, Create mit `posts`/`*`, PNG-Cover ok, SVG-MIME und >7 Mio Zeichen abgelehnt, Publish-Flip stempelt publishedAt, Liste gated |
| `src/routes/posts/PostForm.test.ts` (85 Z.) | component | Labels + Hilfetext, `whitespace-normal` am Label, Speichern nie disabled, Submit ohne Inhalt → deutsche Meldung, getrimmter Payload + published, onCancel |
| `src/routes/settings/inquiries.remote.test.ts` (287 Z.) | integration (Remote-Shim, Mail gemockt) | 401 anonym, 403 ohne `mailings`, Liste newest-first mit Status, Filter `status`, Retry auch bei `sent`, fehlgeschlagener Retry → `failed` + Fehlertext, 404 unbekannt |
| `src/lib/server/services/mail-service.test.ts` (Anteil `:1114-1348`) | unit (pg-mem, nodemailer gemockt) | `sendContactNotification`: Empfänger + `[Anfrage]`-Betreff, Referenzauflösung used-car/tire, unauflösbare Referenz, Reply-To, Fehler in `sent_messages`, fehlende Firmen-E-Mail; `recordInquiryNotificationResult` |
| `e2e/navigation.spec.ts` (`:56-61`), `e2e/settings.spec.ts` (`:25`), `e2e/smoke.spec.ts` (`:92-96`), `e2e/users.spec.ts` (`:80-86`) | e2e | Sidebar-Links „Aktuelle Informationen"/„Anfragen" erreichbar, Settings-Tab „Anfragen", `/posts/new` Klick-Zeit-Validierung „Bitte einen Titel eingeben.", Sidebar-Eintrag für eingeschränkte Rolle verborgen |

Nicht abgedeckt: `GET /api/public/tires` ohne Preis, Posts-Listenseite/Detailseite als Komponente, `PostForm`-Bildupload, Inquiries-Page-Komponente, `GET /free-slots?service=<nicht-UUID>` (500-Pfad), Zeitzonenverhalten, CORS-Header auf Erfolgsantworten, Doppel-Rate-Limit-Zusammenspiel.

## 9. Feature-Matrix

| ID | Feature | Routen | Endpoints/Remotes | Tabellen | Erwartetes Verhalten |
|---|---|---|---|---|---|
| F-557 | Bearer-Token-Authentifizierung aus `API_TOKENS` | `/api/public/*` | `publicApi`, `authenticateRequest`, `verifyApiToken` | — | Token aus Env (`,`/`;`/Newline getrennt, Einträge < 8 Zeichen ignoriert), Vergleich zeitkonstant, leer/unset = alles 401; `OPTIONS` ohne Auth; nur 8-Zeichen-Präfix nach innen; keine Rotation ohne Neustart, keine Scopes |
| F-558 | Einheitliches JSON-Envelope und Fehlercodes | `/api/public/*` | `ok`, `fail`, `codeForStatus` | — | Erfolg `{ data }`, Fehler `{ error: { code, message } }` mit `BAD_REQUEST/UNAUTHORIZED/FORBIDDEN/NOT_FOUND/CONFLICT/UNPROCESSABLE_ENTITY/RATE_LIMITED/INTERNAL_ERROR`; unerwartete Fehler → 500 ohne Details; Meldungen überwiegend Englisch |
| F-559 | CORS für die Website | `/api/public/*` | `corsHeaders` | — | `Allow-Origin: *`, `GET, POST, OPTIONS`, `Authorization, Content-Type`, `Max-Age 600`; Preflight `204` |
| F-560 | Rate-Limiting | `/api/public/*` | `rateLimitPublicApi` (Hook), `publicApi` | — | Hook: 180/min je Token-Präfix bzw. IP vor Auth (deutsche `{message}`-Antwort); Wrapper: 120/min je Token-Präfix nach Auth (`RATE_LIMITED`-Envelope); beide `Retry-After`; In-Memory, Fenster 60 s |
| F-561 | Session-Whitelist für die API | `/api/public/*` | `hooks.server.ts` `PUBLIC_PREFIXES` | — | Kein Login-Redirect; kein Setup-Gate für Endpoints |
| F-562 | Gebrauchtwagen-Liste | GET `/api/public/used-cars` | `handlePublicUsedCars` → `listPublicUsedCars` | `vehicles`, `vehicle_listings`, `vehicle_photos` | Bestand = `archived=false AND customer_id IS NULL`, neueste zuerst, ohne Pagination/Filter; Felder make/model/firstRegistration/mileageKm/priceGross/fuel/transmission/description + bis 7 Fotos als Data-URL; Listing-Status ignoriert |
| F-563 | Gebrauchtwagen-Detail | GET `/api/public/used-cars/[id]` | `handlePublicUsedCarDetail` → `getPublicUsedCar` | wie F-06 | UUID-Prüfung (400), gleiche Sichtbarkeitsregel, 404 sonst |
| F-564 | Reifenkatalog mit Filtern | GET `/api/public/tires` | `handlePublicTires` → `listPublicTires` | `tires`, `tire_price_versions`, `tire_photos` | Nur `online_sellable`; Filter `q` (ILIKE Artikelnr/Marke/Modell), `size` (Slash-Form; unparsebar → leere Liste), `season` (exakt, case-sensitiv), `brand` (exakt), `maxPriceNet` (≥0 sonst 400; Reifen ohne Preis fallen raus); Sortierung `created_at DESC`; keine Pagination; volle EU-Label-Felder, `sizeLabel`, `currentPriceNet`, bis 7 Fotos als Data-URL |
| F-565 | Reifen-Detail | GET `/api/public/tires/[id]` | `handlePublicTireDetail` → `getPublicTire` | wie F-08 | UUID (400), 404 wenn unbekannt oder nicht `online_sellable` |
| F-566 | Leistungskatalog | GET `/api/public/services` | `handlePublicServices` → `listPublicServices` | `items`, `item_price_versions` | Alle `kind='service'` (inkl. Arbeitszeit-Item), `created_at DESC`, `currentPriceNet`, `onlineBookable`, `unit`, `attributes: {}` (Altlast) |
| F-567 | Leistungs-Detail | GET `/api/public/services/[id]` | `handlePublicServiceDetail` → `getItem` | wie F-10 | UUID (400), 404 wenn unbekannt oder `kind !== 'service'` |
| F-568 | Freie Terminslots | GET `/api/public/free-slots` | `handlePublicFreeSlots` → `findFreeSlots` | `workshop_hours`, `calendar_entries`, `company_settings` (Bundesland) | `from`/`to` Pflicht (ISO), `durationMinutes` Default 30, 1..480; `service` optional (404/400-Prüfung, sonst ohne Wirkung); Bereich ≤ 60 Tage; 15-min-Raster innerhalb Öffnungszeiten (Default Mo–Fr 08–17), abzüglich nicht-stornierter Termine, Schließzeiten, gesetzlicher Feiertage des Bundeslands; Slot voll im Bereich; Zeitzone = Server-Prozess |
| F-569 | Online-Terminbuchung | POST `/api/public/appointments` | `handleBookAppointment` | `items`, `customers`, `number_ranges`, `calendar_entries`, `sent_messages`, `mail_templates`, `smtp_settings` | Nur `onlineBookable`-Service (Pflicht), `durationMinutes` Pflicht, Start in Zukunft, Slot muss exakt im freien Raster liegen (sonst 409), Kunde per E-Mail wiederverwendet oder neu (Nummernkreis, Name-Split), Termin `scheduled` mit Servicetitel und `confirmation:<uuid>` in `notes`, Bestätigungsmail best-effort; Antwort mit ID, Zeitraum, Token |
| F-570 | Online-Reifenbestellung | POST `/api/public/orders` | `handlePublicOrder` → `createDocument`, `setDocumentStatus` | `tires`, `tire_price_versions`, `customers`, `company_settings`, `documents`, `document_items`, `number_ranges` | Positionen nur `online_sellable`-Reifen mit aktuellem Preis (404/400/409), Menge 1..10 000, Lieferadresse Pflicht; Kunde find-or-create (Adresse nur bei Neuanlage); Rechnungsentwurf (`invoice`/`draft`) mit Rechnungsnummer + PDF, Notiz „Online-Bestellung / Lieferadresse …"; MwSt aus `default_vat_rate`; Antwort `orderId`, `orderNumber`, `totalNet`, `totalGross`, `shippingNet: 0`, `estimatedDelivery` = +7 Tage; kein Lagerabgang, keine Kundenmail |
| F-571 | Kontaktformular-Eingang | POST `/api/public/contact` | `handleContactInquiry` → `sendContactNotification`, `recordInquiryNotificationResult` | `customer_inquiries`, `sent_messages`, `company_settings`, `smtp_settings`, (Referenz: `vehicles`, `tires`, `items` + Preise) | Persistieren zuerst, dann interne Mail an Firmen-E-Mail mit Reply-To Kunde und aufgelöstem Bezug (used-car/tire/article), Status `sent`/`failed` auf der Zeile; immer 200 |
| F-572 | Firmendaten-Endpoint | GET `/api/public/company` | `handlePublicCompany` → `getSettings`, `listWorkshopHours` | `company_settings`, `workshop_hours` | Name (2×), `tagline: null`, Adresse inkl. Bundesland-Rohwert, Kontakt, Geo (nur wenn beide Koordinaten), 7 Öffnungszeiten mit englischen Wochentagsnamen, `opensAt/closesAt` `HH:MM` oder `null` bei `closed`; Lazy-Inserts fehlender Zeilen |
| F-573 | Öffentliche News-Liste | GET `/api/public/posts` | `handlePublicPosts` → `listPublicPosts` | `posts` | Nur `published`, `published_at DESC, created_at DESC`; `page` ≥1 (Default 1), `pageSize` 1..50 (Default 10, größere Werte geklemmt), nicht-positive Werte 400; Envelope `posts/total/page/pageSize/pageCount`; Cover als Data-URL |
| F-574 | Öffentliches News-Detail per Slug | GET `/api/public/posts/[slug]` | `handlePublicPostDetail` → `getPublicPostBySlug` | `posts` | Slug 1..220 Zeichen (400), Entwurf/unbekannt → 404 |
| F-575 | Beitragsliste intern | `/posts` | `listPostsRemote` | `posts` | Suche (Titel/Teaser, ILIKE), Pagination 25, `created_at DESC`, Status-Badge Veröffentlicht/Entwurf, „Veröffentlicht am" (de-DE), Zeile klickbar → Detail, Aktionen Bearbeiten/Löschen; Desktop-Tabelle + Mobil-Kartenliste; stale-while-revalidate; kein Status-Filter in der UI |
| F-576 | Beitrag anlegen | `/posts/new` | `createPostRemote` | `posts` | Pflicht Titel (≤200) + Inhalt (≤50 000), optional Teaser (≤500), Titelbild (PNG/JPEG/WebP ≤ 5 MB), Checkbox Veröffentlicht; Slug automatisch; Toast „Beitrag angelegt."; `formDirty` vor `goto` gelöscht |
| F-577 | Beitrag-Detail mit Publish-Toggle | `/posts/[id]` | `getPostRemote`, `setPostPublishedRemote`, `deletePostRemote` | `posts` | Anzeige aller Felder inkl. Slug/Erstellt/Geändert, Titelbild, Inhalt mit Zeilenumbrüchen; optimistisches Veröffentlichen/Verbergen mit Toast; Löschen mit ConfirmDialog → `/posts` |
| F-578 | Beitrag bearbeiten | `/posts/[id]/edit` | `getPostRemote`, `updatePostRemote` | `posts` | Vorbefüllt; Slug bleibt bei unverändertem Titel, sonst neu (mit Suffix bei Kollision); `publishedAt` nur beim ersten Live-Gang; Toast „Beitrag gespeichert." |
| F-579 | Beitrag löschen aus der Liste | `/posts` | `deletePostRemote` mit `withOverride` | `posts` | ConfirmDialog, optimistisches Entfernen + `total-1`, Toast „Beitrag „<Titel>" gelöscht."; Hard-Delete ohne Guard |
| F-580 | Slug-Regeln | — | `slugify`, `uniqueSlug` | `posts` | Kleinbuchstaben, `ä→ae ö→oe ü→ue ß→ss`, Diakritika entfernt, Nicht-Alnum → `-`, max 200, Fallback `beitrag`, Kollision → `-2`, `-3`, …, eindeutig per Unique-Index |
| F-581 | Titelbild-Verwaltung | `/posts/new`, `/posts/[id]/edit` | `postInputSchema.coverImage` | `posts.cover_image` | Ein Bild, Upload/Entfernen im Formular ohne eigenen Roundtrip, Base64 im JSONB, Server-Allowlist + 7-Mio-Zeichen-Kappe; Anzeige im Detail (`max-h-72 object-cover`) und öffentlich als `coverImage.url` |
| F-582 | Anfragen-Posteingang | `/settings/inquiries` | `listInquiriesRemote` | `customer_inquiries` | Filter Alle/Ausstehend/Versendet/Fehlgeschlagen (auf `notification_status`), Pagination 25, `created_at DESC`; Spalten Eingegangen/Von/Betreff/Bezug/Benachrichtigung/Aktion; Fehlertext + Sendezeit; kein Detail, keine Statuspflege, keine Suche |
| F-583 | Benachrichtigung erneut senden | `/settings/inquiries` | `retryInquiryNotificationRemote` | `customer_inquiries`, `sent_messages` | Erneuter Versand unabhängig vom bisherigen Status, Ergebnis überschreibt `notification_*`, Toasts „Benachrichtigung erneut gesendet." / „Versand fehlgeschlagen: …"; 404 „Anfrage nicht gefunden." |
| F-584 | Interne Benachrichtigungsmail mit Bezugsauflösung | — | `sendContactNotification`, `resolveReference`, `buildContactBody` | s. F-15 | Betreff `[Anfrage] <subject>`, Absender aus SMTP-Settings, Reply-To Kunde, Blöcke Anfrage von/Betreff/Nachricht/Bezogen auf (Fahrzeug, Reifen, Artikel mit Preis + relativer Detail-URL)/Anfrage-ID/Eingegangen am; Fehlen der Firmen-E-Mail → kuratierter Fehler |
| F-585 | Terminbestätigung an den Kunden | — | `sendAppointmentConfirmation` | `mail_templates`, `sent_messages`, `smtp_settings` | Vorlage `appointment_confirmation` mit Platzhaltern; Datum/Uhrzeit in Europe/Berlin; Audit als `appointment_confirmation` |
| F-586 | Berechtigungen und Navigation | Sidebar, `/settings`-Tabs | `MODULE_PERMISSIONS.posts`, `mailings` | — | Modul-Permission `posts` für alle Post-Remotes und den Sidebar-Eintrag „Aktuelle Informationen" (Gruppe Kommunikation); „Anfragen" unter Kommunikation und als Settings-Tab, beide mit `mailings`; kein Read/Write-Split |
| F-587 | Öffnungszeiten-Defaults und Feiertage | GET `/company`, `/free-slots` | `listWorkshopHours`, `defaultHoursFor`, `getCompanyHolidayState` | `workshop_hours`, `company_settings` | Fehlende Wochentage → Mo–Fr 08:00–17:00 offen, Sa/So geschlossen (Lazy-Insert nur bei `/company`, im Slot-Finder nur in-memory); Feiertage algorithmisch je Bundesland |

## 10. Befunde

| ID | Beschreibung | Fundstelle | Auswirkung | Empfehlung | Einordnung | Betroffene Features |
|---|---|---|---|---|---|---|
| B-486 | Der Nachrichtentext einer Anfrage wird in der UI nirgends angezeigt (nur Betreff, truncated); keine Detailansicht, keine klickbare Zeile. Der Operator kann Anfragen nur über die Benachrichtigungsmail lesen — bei `failed` gar nicht. | `src/routes/settings/inquiries/+page.svelte:147-205` | Fachlich unbrauchbarer Posteingang bei SMTP-Ausfall; Datenlage vorhanden, aber nicht sichtbar | Detailansicht/Aufklappzeile mit Nachricht, Telefon, Bezug (aufgelöst), Aktionen | im Rewrite beheben | F-582 |
| B-487 | `customer_inquiries.status` (`new/read/archived` laut Migration) und `customer_id` werden nie geschrieben/gelesen; kein Workflow (gelesen/erledigt/archiviert, Zuweisung, Kunde anlegen/verknüpfen, Löschen). | `drizzle/0016_customer_inquiries.sql:10-12`, `schema.ts:1484`, `inquiries.remote.ts` (kein Zugriff) | Halbfertiges Feature; toter Index `customer_inquiries_status_idx` | Status-Enum + Übergänge, Kundenverknüpfung, Erledigen definieren | Entscheidung nötig | F-582 |
| B-488 | Zwei gestapelte Rate-Limiter: Hook (180/min vor Auth, Body `{ message }` deutsch, ohne CORS-Header, zählt auch OPTIONS) und Wrapper (120/min nach Auth, `RATE_LIMITED`-Envelope). Doku nennt nur 120/min nach Auth. Zudem unterschiedliche Bearer-Regexe (`\S+` vs. Zeichenklasse). | `src/hooks.server.ts:141-167`, `src/lib/server/public-api.ts:60-80`, `docs/integrations/public-rest-api.md:23-25` | Inkonsistente 429-Antworten für Konsumenten; doppelte Buchführung | Ein Limiter, ein Envelope, Doku korrigieren | im Rewrite beheben | F-560 |
| B-489 | CORS `Access-Control-Allow-Origin: *` bei Bearer-Auth; Kommentar verspricht Env-Konfiguration, die nicht existiert. Token in Browser-Code der Website wäre von jeder Origin nutzbar. | `src/lib/server/public-api.ts:132-141` | Token-Leak-Risiko bei clientseitiger Nutzung | Origin-Allowlist per Env oder API nur serverseitig konsumieren | Entscheidung nötig | F-557, F-559 |
| B-490 | Keine Cache-Header (`Cache-Control`, `ETag`) auf GET-Endpoints; jede Website-Anfrage erzeugt volle DB-Last inkl. Base64-Bildern. | alle `endpoint.ts` (GET), `public-api.ts:88-97` | Unnötige Last, keine CDN-Fähigkeit | `Cache-Control`/`ETag`/`Last-Modified` pro Endpoint | im Rewrite beheben | F-562…F-568, F-572…18 |
| B-491 | Bilder werden inline als Base64-Data-URLs ausgeliefert (used-cars bis 7 Fotos/Fahrzeug, tires bis 7, Posts-Cover bis 7 Mio Zeichen bei `pageSize` bis 50) — Listen-Payloads potenziell zig MB; kein Bild-Endpoint, keine Größenvarianten. | `vehicle-service.ts:761-782`, `tire-service.ts:424-451`, `posts/endpoint.ts:56-58`, `posts.remote.ts:45-49` | Performance/Traffic, Website kann Bilder nicht cachen | Eigene Bild-Endpoints (`/api/public/images/<id>`) oder Objektspeicher + URLs; Thumbnails | im Rewrite beheben | F-562…09, F-573, F-581 |
| B-492 | Listen ohne Pagination/Filter: `GET /used-cars` (ignoriert `?q=`), `GET /tires`, `GET /services`; Security-Tests senden ignorierte Parameter (`used-cars?q=`, `services?q=`, `tires?speedIndex=`). | `used-cars/endpoint.ts:11-16`, `tires/endpoint.ts:106-120`, `services/endpoint.ts:29-43`, `public-api-security.test.ts:136-172,214-225` | Unbegrenzte Antworten; Tests dokumentieren Nicht-Features | Einheitliches `page/pageSize` + Filter für alle Listen; Tests bereinigen | im Rewrite beheben | F-562, F-564, F-566 |
| B-493 | N+1-Preisabfragen in `listPublicTires` und `listPublicServices` (ein Query je Zeile); `maxPriceNet` wird erst in JS nach dem Vollabruf gefiltert. | `tire-service.ts:498-516`, `item-service.ts:143-148` | Skaliert linear mit Katalogen | Preis per Lateral-Join/Window-Function, Filter in SQL | im Rewrite beheben | F-564, F-566 |
| B-494 | `GET /services` liefert **alle** `kind='service'`-Items, inklusive des geseedeten `ARBEIT`/„Arbeitszeit"-Items mit dem internen Stundensatz; es gibt kein Sichtbarkeitsflag außer `onlineBookable` (das nicht gefiltert wird). | `item-service.ts:136-149`, `seed-defaults.ts:256-263` | Interner Stundensatz und interne Leistungen öffentlich | Öffentlichkeits-Flag (`publicVisible`) oder nur `onlineBookable` exponieren | Entscheidung nötig | F-566, F-567 |
| B-495 | `free-slots?service=` und `appointments.serviceId` werden nicht als UUID validiert; `getItem()` mit Nicht-UUID führt in Postgres zu `invalid input syntax for type uuid` → 500 `INTERNAL_ERROR` statt 400 (pg-mem-Tests fangen das nicht). | `free-slots/endpoint.ts:54-57`, `appointments/endpoint.ts:64,123` | Falscher Statuscode, Log-Rauschen | `uuid()`-Pipe wie bei den Detail-Endpoints | im Rewrite beheben | F-568, F-569 |
| B-496 | Schema/Logik-Inkonsistenz in appointments: `serviceId` und `durationMinutes` im Schema optional, in der Logik Pflicht; `title = 'Online-Termin'` unerreichbar; free-slots-Kommentar nennt `[5..480]`, Code erlaubt ≥ 1. | `appointments/endpoint.ts:64-73,115-138`, `free-slots/endpoint.ts:7,30-40` | Irreführende Doku/Fehlermeldungen, toter Code | Schema = Vertrag (`serviceId: uuid`, `durationMinutes` Pflicht, `minValue(5)` falls gewollt) | im Rewrite beheben | F-568, F-569 |
| B-497 | Sprachmix in API-Fehlermeldungen: Shared-Schemas liefern Deutsch (`Invalid "customerEmail": Bitte geben Sie eine gültige E-Mail-Adresse ein.`), Inline-Schemas Englisch, einzelne `fail()` deutsch (`'Termin ist nicht mehr verfügbar.'`, `'Mindestens ein Artikel ist kein Online-Reifen.'`), Hook-429 deutsch. | `appointments/endpoint.ts:157`, `orders/endpoint.ts:162`, `contact/endpoint.ts:96-99`, `validation.ts:30-139` | Website kann Meldungen nicht zuverlässig anzeigen/übersetzen | Sprache festlegen (empfohlen: stabile `code`s + optional `field`, Text englisch, Website übersetzt) | Entscheidung nötig | F-558, F-569…15 |
| B-498 | Zeitzonenabhängigkeit: Slot-Raster nutzt Prozess-Lokalzeit (`setHours`, `getDay`), `from`/`to` ohne Offset werden lokal interpretiert; Dockerfile setzt kein `TZ` (→ UTC in Produktion), während Bestätigungsmail Europe/Berlin formatiert. Öffnungszeiten würden im Container um 1–2 h verschoben. `new Date('1')`-artige Eingaben werden akzeptiert. | `public-api-service.ts:36-41,165-179`, `free-slots/endpoint.ts:21-28`, `Dockerfile:37-48`, `mail-service.ts:622-645` | Falsche Slots/Buchungen in Produktion je nach TZ | Explizite Zeitzone (Europe/Berlin) in Slot-Logik, strikte ISO-Parser, `TZ` im Container setzen | im Rewrite beheben | F-568, F-569, F-585 |
| B-499 | Buchung ist nicht atomar und nicht kollisionssicher: Kunde und Termin ohne Transaktion; Verfügbarkeitsprüfung und Insert ohne Sperre (Race → Doppelbuchung); Off-Grid-Start (z. B. 09:05) liefert 409 „nicht mehr verfügbar" statt 400. | `appointments/endpoint.ts:146-210` | Doppelbuchungen möglich; irreführende Meldung | Transaktion + Exclusion-Constraint/Advisory-Lock; Rasterprüfung als 400 | im Rewrite beheben | F-569 |
| B-500 | `confirmationToken` wird nur in `calendar_entries.notes` als `confirmation:<uuid>` abgelegt („future-proofing"); kein Endpoint zum Bestätigen/Stornieren; Token ist im Kalender-Modul für Mitarbeiter sichtbar. | `appointments/endpoint.ts:190-209`, `mail-service.ts:114-131` (Seed) | Totes Konzept; Notizfeld zweckentfremdet | Entweder Bestätigungs-/Storno-Endpoint bauen und Token in eigener Spalte speichern oder Token entfernen | Entscheidung nötig | F-569, F-585 |
| B-501 | Kunden-Find-or-Create per E-Mail: `customers.email` nicht unique (erste Zeile gewinnt), archivierte Kunden werden gematcht, Name-Split am ersten Leerzeichen („Dr. Max Mustermann" → Vorname „Dr."); bestehende Kunden bekommen bei Bestellungen weder Telefon noch Lieferadresse aktualisiert (Adresse nur im Notiztext). | `appointments/endpoint.ts:161-188`, `orders/endpoint.ts:105-115,181-205` | Datenqualität, Buchungen an archivierte/duplizierte Kunden | Explizite Vor-/Nachname-Felder im Payload, `archived=false`-Filter, definierte Update-Regeln, Lieferadresse als strukturierte Daten | im Rewrite beheben | F-569, F-570 |
| B-502 | Bestellprozess fachlich dünn: Rechnungsnummer wird für einen `draft` verbraucht (Lücken bei Verwerfen; GoBD-Sicht), PDF wird für den Entwurf gerendert, `smallBusinessExempt` (§19 UStG) ignoriert, `totalGross` im Response (Gesamt × MwSt) kann von der zeilenweise gerundeten Dokumentsumme abweichen, kein Lagerabgang (`stock_on_hand`), `estimatedDelivery` hart +7 Tage, keine Bestellbestätigung an den Kunden, kein eigener Bestell-Datensatz/Status. | `orders/endpoint.ts:207-259`, `document-service.ts:236-318` | Buchhalterische und fachliche Risiken; Website zeigt evtl. andere Summe als Rechnung | Eigene `orders`-Entität (Status neu/bestätigt/versendet), Rechnungsnummer erst bei Finalisierung, Summen aus Dokument übernehmen, §19 berücksichtigen | Entscheidung nötig | F-570 |
| B-503 | Kontakt-Endpoint: kein Spamschutz (Honeypot/Captcha/Duplikat-Fenster) jenseits Token + Rate-Limit; `subject` und `message` dürfen leer sein (kein `minLength`); `referenceId` wird nicht gegen `referenceType` geprüft; roher SMTP-Fehlertext landet in `notification_error` und wird in der UI angezeigt (anders als der kuratierte SMTP-Testversand). | `contact/endpoint.ts:60-68`, `validation.ts:129-139`, `inquiries/+page.svelte:175-182`, `mail-service.ts:1052` | Leere/Spam-Anfragen; Hostnamen/Server-Banner in der UI | `minLength` für subject/message, Honeypot-Feld + Zeitfenster-Dedupe, Fehlermapping wie `mapSmtpTestError` | im Rewrite beheben | F-571, F-582 |
| B-504 | „Eingegangen am" in der Benachrichtigung nutzt Server-Lokalzeit (`formatTimestampDe`), Terminbestätigung Europe/Berlin — inkonsistent; die relativen Detail-URLs (`/vehicles/<id>`) in der Mail sind ohne Host nicht klickbar. | `mail-service.ts:780-784,858,905,927`, `:965-968` | Falsche Uhrzeit im Container, unbrauchbare Links | `Intl` mit Europe/Berlin; absolute URL aus `BETTER_AUTH_URL`/Base-URL | im Rewrite beheben | F-584 |
| B-505 | `GET /company`: `legalName` = `brandName` = `company_name`, `tagline` immer `null` (tote Felder ohne Datenquelle); `state` als Rohwert (Kürzel). | `company/endpoint.ts:69-87` | API-Vertrag verspricht Felder, die nie befüllt werden | Felder streichen oder Datenquelle (Settings) ergänzen; Bundesland als Name + Code | Entscheidung nötig | F-572 |
| B-506 | `updatePost`/`setPostPublished` werfen bei unbekannter ID `new Error('Beitrag nicht gefunden.')` → 500 statt 404; `deletePost` bei unbekannter ID stiller Erfolg. | `post-service.ts:122,165,176-178`, `posts.remote.ts:138,161` | Falscher Status, generischer Fehlertoast | `error(404, …)` im Remote vor dem Service-Aufruf | im Rewrite beheben | F-577, F-578 |
| B-507 | Posts-Liste: Remote kann nach `published/draft` filtern, UI sendet immer `'all'` (keine Status-Tabs); Suche greift auf Titel + Teaser (Kommentar sagt „title/body"). | `posts/+page.svelte:21-26`, `post-service.ts:63-75` | Kein Entwurfs-Filter für Redakteure | Filter-Tabs Alle/Veröffentlicht/Entwurf (CONTRIBUTING §7-konform) | bewusst später | F-575 |
| B-508 | Slug ändert sich bei jeder Titeländerung (neuer `uniqueSlug`), Hard-Delete ohne Guard — Website-Permalinks (`/aktuelles/<slug>`) brechen ohne Redirect; Doku formuliert „slug stays stable on edit" ohne die Titel-Einschränkung. `uniqueSlug` ist nicht transaktional (Race → Unique-Verstoß → 500). | `post-service.ts:33-52,124-130`, `docs/modules/posts.md:16-17` | SEO/Links | Slug editierbar, aber standardmäßig stabil; Slug-Historie/Redirects; Soft-Delete/Archiv | Entscheidung nötig | F-578, F-579, F-580 |
| B-509 | Inhaltsformat der Posts undefiniert: intern Plain-Text (`whitespace-pre-wrap`), API liefert Rohtext; kein Markdown/HTML-Vertrag, kein Sanitizing. | `posts/[id]/+page.svelte:119`, `posts/endpoint.ts:21-29` | Website muss raten; Formatierung unmöglich | Format festlegen (Markdown + serverseitiges Rendering/Sanitizing, oder Rich-Text) | Entscheidung nötig | F-573, F-574, F-576 |
| B-510 | Doku-Konflikte: `public-rest-api.md` sagt „Handlers delegate to public-api-service.ts (projections…)" — tatsächlich enthält die Datei nur `findFreeSlots`; Projektionen liegen in vehicle/tire/item/post-service. „detail caps at 7 photos" gilt auch für die Liste. Rate-Limit-Doku unvollständig (s. B-03). | `docs/integrations/public-rest-api.md:36,45-46`, `public-api-service.ts:1-14` | Falsche Orientierung für den Rewrite | Doku an Code angleichen | im Rewrite beheben | F-557…18 |
| B-511 | Restbestände: leerer Kommentarblock „Public-API tokens" im Schema (Überbleibsel 0013/0025); Testname „refuses callers without mailings:read" trotz abgeschafftem Read/Write-Split; `attributes: {}` und `shippingNet: 0` als Wire-Kompat-Altlasten. | `schema.ts:1772-1774`, `inquiries.remote.test.ts:179`, `services/endpoint.ts:26,40`, `orders/endpoint.ts:257` | Kosmetik/Vertragsballast | Bei API v2 Altlasten entfernen | Entscheidung nötig | F-566, F-570 |
| B-512 | `GET /posts?pageSize=999` wird still auf 50 geklemmt, `page=0` liefert 400 — inkonsistente Behandlung von Grenzwerten. | `posts/endpoint.ts:66-72` | Kleine Inkonsistenz | Einheitlich 400 oder einheitlich klemmen, dokumentieren | bewusst später | F-573 |
| B-513 | Rate-Limiter In-Memory, Single-Replica; Sweep per `setInterval`. Bei horizontaler Skalierung unwirksam (dokumentiert). | `rate-limit.ts:16-25` | Nur bei Multi-Replica | Redis/DB-basiertes Limit im Rewrite vorsehen | bewusst später | F-560 |
| B-514 | `GET /used-cars` ignoriert `vehicle_listings.status` (wird selektiert, nicht gefiltert) und zeigt Fahrzeuge ohne Listing (kein Preis) — Sichtbarkeit hängt allein an `customer_id IS NULL`. | `vehicle-service.ts:737-756,809-830` | Reservierte/unbepreiste Fahrzeuge öffentlich | Filter auf `status='available'` bzw. Listing-Pflicht; Sichtbarkeitsregel mit Inventar-Modul abstimmen | Entscheidung nötig | F-562, F-563 |
| B-515 | Öffentliche Endpoints umgehen das Setup-Gate: vor Setup-Abschluss legen `getSettings()`/`listWorkshopHours()` leere Default-Zeilen an und liefern Platzhalterdaten; `ensureSeeded()` läuft auch für API-Requests. | `hooks.server.ts:61-75,231-232`, `settings-service.ts:7-14` | Website sieht leere Firmendaten statt 503 | `setupCompleted`-Check im Wrapper (503 `NOT_READY`) | bewusst später | F-561, F-572 |
| B-516 | `free-slots` liest `workshop_hours` ohne Lazy-Insert und ergänzt fehlende Tage nur in-memory (`defaultHoursFor`), `company` legt sie per `listWorkshopHours` an — zwei Default-Quellen, die synchron gehalten werden müssen. | `public-api-service.ts:77-88,198-206`, `workshop-hours-service.ts:11-20` | Drift-Risiko | Eine Default-Quelle (Service) | im Rewrite beheben | F-568, F-587 |
| B-517 | Retry-Command refresht serverseitig (`requested(listInquiriesRemote, 4).refreshAll()`), der Client deklariert kein `.updates(...)` — laut CLAUDE.md ist der Server-Refresh dann clientseitig wirkungslos; Badge-Update in der Liste nach „Erneut senden" unklar (im Code nicht abgesichert). | `inquiries.remote.ts:107`, `inquiries/+page.svelte:59-73` | Möglicherweise veralteter Status bis Reload | `.updates(listInquiriesRemote(queryArgs).withOverride(...))` | im Rewrite beheben | F-583 |
| B-518 | `size`-Picklist `[10,25,50,100]` in `listPostsRemote`/`listInquiriesRemote`, obwohl Pagination laut CLAUDE.md fix 25 ist (UI hält sich daran). | `posts.remote.ts:77`, `inquiries.remote.ts:34` | Kosmetik | Konstante 25 im Schema | bewusst später | F-575, F-582 |
| B-519 | Posts-Admin-Liste lädt volle Zeilen inkl. Base64-Cover (`db.select()`), obwohl nur Titel/Status/Datum gerendert werden. | `post-service.ts:81-88` | Schwere Listen-Roundtrips | Projektion ohne `cover_image` für die Liste | im Rewrite beheben | F-575 |
| B-520 | `handleValidationError`-`FIELD_LABELS` kennen `excerpt`, `coverImage`, `published`, `slug`, `customerEmail`, `customerName`, `referenceType` nicht — interne Validierungsfehler zeigen Rohschlüssel. | `hooks.server.ts:264-375` | Unschöne Meldungen bei serverseitiger Ablehnung | Labels ergänzen | im Rewrite beheben | F-576, F-578 |

## 11. Offene Fragen an den Architekten

1. **Konsumenten der API**: Wird die Website serverseitig (SSR/Build) oder im Browser gegen die API laufen? Bestimmt CORS-Strategie (B-489), Cache-Design (B-490) und ob Bilder als URLs oder Data-URLs sinnvoll sind (B-491).
2. **API-Versionierung**: Darf der Rewrite den Vertrag brechen (Altlasten `attributes: {}`, `shippingNet: 0`, `photos[].dataUrl` vs. `photos[].url`-Inkonsistenz zwischen used-cars und tires) oder muss `/api/public/*` byte-kompatibel bleiben? Gibt es eine zweite, ältere Website-Version?
3. **Sprache/Format der API-Fehler** (B-497): stabile Fehlercodes + Feldpfad, englische oder deutsche Texte?
4. **Bestellprozess** (B-502): Soll eine Web-Bestellung weiterhin direkt ein Rechnungsentwurf sein, oder braucht es eine eigene Bestell-Entität mit Status, Lagerabgleich, Bestätigungsmail, Versandkosten (2026 entfernt) und Zahlungsweg?
5. **Terminbuchung**: Soll das Bestätigungs-Token eine Funktion bekommen (Kunde bestätigt/storniert per Link) oder entfallen (B-500)? Welche Zeitzone ist verbindlich (B-498)? Sollen Buchungen einen eigenen Status (`requested` → Werkstatt bestätigt) statt sofort `scheduled` haben?
6. **Anfragen-Workflow** (B-486/02): Welche Status (neu/in Bearbeitung/erledigt/archiviert), Zuweisung an Mitarbeiter, „Kunde daraus anlegen", Antworten aus der App heraus (statt Reply-To in der Mail)?
7. **Öffentliche Sichtbarkeit von Leistungen** (B-494): eigenes Flag `publicVisible` neben `onlineBookable`? Soll der Stundensatz/„Arbeitszeit" jemals öffentlich sein?
8. **Gebrauchtwagen-Sichtbarkeit** (B-514): Regel „kundenlos + nicht archiviert" beibehalten oder an `vehicle_listings.status`/Preis koppeln?
9. **Posts**: Inhaltsformat (Markdown/Rich-Text), Slug-Editierbarkeit und Redirects (B-508/24), Soft-Delete/Archiv, geplante Veröffentlichung (`publishedAt` in der Zukunft), mehrere Bilder?
10. **Rate-Limit/Deployment**: bleibt Single-Replica (In-Memory ok) oder ist Multi-Replica/Redis einzuplanen (B-513)?
11. **Spamschutz** (B-503): Honeypot, Captcha (Turnstile o. ä.) auf Website-Seite oder serverseitige Heuristiken?
12. **Setup-Gate für die API** (B-515): 503 vor abgeschlossenem Setup gewünscht?

## 12. Gelesene Dateien

| Datei | Zeilen |
|---|---|
| `src/routes/api/public/appointments/endpoint.ts` | 240 |
| `src/routes/api/public/appointments/+server.ts` | 13 |
| `src/routes/api/public/company/endpoint.ts` | 89 |
| `src/routes/api/public/company/+server.ts` | 13 |
| `src/routes/api/public/contact/endpoint.ts` | 158 |
| `src/routes/api/public/contact/+server.ts` | 13 |
| `src/routes/api/public/free-slots/endpoint.ts` | 92 |
| `src/routes/api/public/free-slots/+server.ts` | 13 |
| `src/routes/api/public/orders/endpoint.ts` | 260 |
| `src/routes/api/public/orders/+server.ts` | 13 |
| `src/routes/api/public/posts/endpoint.ts` | 82 |
| `src/routes/api/public/posts/+server.ts` | 15 |
| `src/routes/api/public/posts/[slug]/endpoint.ts` | 49 |
| `src/routes/api/public/posts/[slug]/+server.ts` | 14 |
| `src/routes/api/public/services/endpoint.ts` | 43 |
| `src/routes/api/public/services/+server.ts` | 15 |
| `src/routes/api/public/services/[id]/endpoint.ts` | 45 |
| `src/routes/api/public/services/[id]/+server.ts` | 13 |
| `src/routes/api/public/tires/endpoint.ts` | 120 |
| `src/routes/api/public/tires/+server.ts` | 13 |
| `src/routes/api/public/tires/[id]/endpoint.ts` | 37 |
| `src/routes/api/public/tires/[id]/+server.ts` | 13 |
| `src/routes/api/public/used-cars/endpoint.ts` | 16 |
| `src/routes/api/public/used-cars/+server.ts` | 13 |
| `src/routes/api/public/used-cars/[id]/endpoint.ts` | 37 |
| `src/routes/api/public/used-cars/[id]/+server.ts` | 13 |
| `src/routes/api/public/public-api.test.ts` | 1479 |
| `src/routes/api/public/public-api-security.test.ts` | 416 |
| `src/lib/server/public-api.ts` | 173 |
| `src/lib/server/services/public-api-service.ts` | 206 |
| `src/lib/server/services/public-api-service.test.ts` (Testtitel) | 256 |
| `src/lib/server/api-tokens.ts` | 113 |
| `src/lib/server/api-tokens.test.ts` (Testtitel) | 172 |
| `src/lib/server/rate-limit.ts` | 137 |
| `src/lib/server/rate-limit.test.ts` (Testtitel) | 107 |
| `src/hooks.server.ts` | 470 |
| `src/hooks.server.test.ts` (Testtitel) | 328 |
| `src/routes/posts/+page.svelte` | 220 |
| `src/routes/posts/posts.remote.ts` | 183 |
| `src/routes/posts/posts.remote.test.ts` | 185 |
| `src/routes/posts/PostForm.svelte` | 221 |
| `src/routes/posts/PostForm.test.ts` | 85 |
| `src/routes/posts/new/+page.svelte` | 30 |
| `src/routes/posts/[id]/+page.svelte` | 144 |
| `src/routes/posts/[id]/edit/+page.svelte` | 38 |
| `src/lib/server/services/post-service.ts` | 247 |
| `src/lib/server/services/post-service.test.ts` (Testtitel) | 181 |
| `src/routes/settings/inquiries/+page.svelte` | 215 |
| `src/routes/settings/inquiries.remote.ts` | 112 |
| `src/routes/settings/inquiries.remote.test.ts` | 287 |
| `src/lib/server/db/schema.ts` (Abschnitte 30–147, 437–475, 947–1000, 1073–1100, 1327–1440, 1455–1580, 1755–1800; grep für Listings/Customers) | 2025 |
| `src/lib/server/db/validation.ts` | 315 |
| `src/lib/server/services/mail-service.ts` (Abschnitte 600–780, 780–935, 935–1080, 1205–1236) | 1236 |
| `src/lib/server/services/mail-service.test.ts` (Testtitel ab 1114) | 1576 |
| `src/lib/server/services/vehicle-service.ts` (700–858) | 858 |
| `src/lib/server/services/tire-service.ts` (200–225, 360–543) | 543 |
| `src/lib/server/services/item-service.ts` (95–160) | 263 |
| `src/lib/server/services/workshop-hours-service.ts` (1–80) | 132 |
| `src/lib/server/services/settings-service.ts` | 14 |
| `src/lib/server/services/customer-service.ts` (118–175) | 262 |
| `src/lib/server/services/document-service.ts` (220–340, 580–625) | 688 |
| `src/lib/server/db/seed-defaults.ts` (Template `appointment_confirmation`, `seedLaborItem`) | 376 |
| `src/lib/components/layout/navigation.ts` (200–240) | 247 |
| `src/routes/settings/+layout.svelte` (40–110) | 118 |
| `src/lib/permissions.ts` (grep) | 53 |
| `drizzle/0013_public_api_tokens.sql` | 34 |
| `drizzle/0016_customer_inquiries.sql` | 38 |
| `drizzle/0018_company_geo.sql` | 12 |
| `drizzle/0023_inquiry_notification_status.sql` | 27 |
| `drizzle/0025_drop_api_tokens.sql` | 4 |
| `drizzle/0029_posts.sql` | 20 |
| `docs/integrations/public-rest-api.md` | 59 |
| `docs/modules/posts.md` | 30 |
| `docs/modules/settings.md` (1–40, 60–104) | 104 |
| `docs/decisions/adr-010-api-tokens-in-env.md` | 31 |
| `.env.example` (10–21) | 58 |
| `Dockerfile` (grep `TZ`/`ENV`) | — |
| `e2e/smoke.spec.ts` (85–105) | 134 |
| `e2e/navigation.spec.ts` (50–65) | 143 |
| `e2e/settings.spec.ts` (18–40) | 152 |
| `e2e/users.spec.ts` (80–90) | — |
| `/tmp/…/scratchpad/inv/TEMPLATE.md` | 59 |
