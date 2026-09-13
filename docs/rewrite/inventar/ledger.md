---
title: Inventar Buchhaltung (LED)
teil_von: docs/rewrite/01-inventar.md
stand: Bestand (SvelteKit) vor dem Rewrite
---

> **Detail-Inventar des Bestands.** Erhoben durch vollständiges Lesen der in
> Abschnitt „Gelesene Dateien" genannten Dateien. Die IDs wurden auf die
> globalen IDs aus [01-inventar.md](../01-inventar.md) umgestellt
> (67 IDs). Zurück: [01-inventar.md](../01-inventar.md) ·
> [02-befunde.md](../02-befunde.md)

# Modul: Kassenbuch/Buchungen (Ledger), Kategorien, DATEV-Export   (Kürzel: LED)

Sprache: Deutsch für Fließtext/Tabellen; Code-Bezeichner, Dateipfade, Tabellen-/Spaltennamen bleiben englisch und exakt wie im Code.
Alles muss aus dem tatsächlich gelesenen Code stammen. Keine Vermutungen. Bei Unsicherheit "unklar" schreiben und Fundstelle nennen.
Fundstellen immer als `pfad/datei.ts:zeile`.

Vorbemerkung zur Abgrenzung: Das Modul ist im Code als "Buchhaltung" (Nav-Label, `src/lib/components/layout/navigation.ts:199-203`) unter `/ledger` implementiert. Es ist ein rein **manuelles** Einnahmen/Ausgaben-Buch (`source='manual'` ist der einzige je geschriebene Wert, `src/routes/ledger/ledger.remote.ts:121`). Es gibt **keine** automatischen Buchungen aus Rechnungszahlung, Fahrzeug-Ankauf oder Storno (einzige Insert-Stelle für `ledger_entries` im Produktivcode: `src/lib/server/services/ledger-service.ts:111`, aufgerufen nur von `ledger.remote.ts:110`; `vehicle-service.ts` und `document-service.ts` enthalten keinen Ledger-Bezug — grep `ledger` in `vehicle-service.ts` liefert 0 Treffer, in `document-service.ts` nur den Kommentar Zeile 671). Das "Rechnungsausgangsbuch" (`/sales-ledger`) ist eine separate Lese-Sicht über `documents` und teilt nur die Permission `ledger`.

## 1. Routen und Seiten
| Route | Datei | Parameter | Guard / Permission | Layout | Datenabhängigkeiten (Remote-Queries, Reihenfolge) | Zweck |
|---|---|---|---|---|---|---|
| `/ledger` | `src/routes/ledger/+page.svelte` | keine URL-Parameter. Client-State: `pageNum`, `q`, `direction` (`all`/`income`/`expense`), `viewYear`/`viewMonth` (Default heutiger Monat). Keine Deep-Links (`?page=`, `?q=`, `?month=` existieren nicht) | `requirePermission('ledger')` in jeder Remote; Nav-Item `permission: 'ledger'` | AppShell-Root-Layout, kein modul-eigenes Layout | 1. `await untrack(() => listLedgerEntriesRemote(queryArgs))` top-level (`:108`); 2. `$derived.by(() => listLedgerEntriesRemote(queryArgs).current ?? lastResult)` (`:116-118`); 3. `$effect` synct `lastResult` + Fehler (`:129-133`); 4. `exportDatevRemote({from,to}).run()` nur im Click-Handler (`:168-170`); 5. `deleteLedgerEntryRemote({id}).updates(listLedgerEntriesRemote(queryArgs).withOverride(...))` (`:183-191`) | Monatsliste aller Buchungen, Stat-Cards, Löschen, DATEV-Export-Dialog. PageHeader-Primäraktion "Neue Buchung" → `/ledger/new?date=<heute bzw. Monatsersten>` (`:200-207`) |
| `/ledger/new` | `src/routes/ledger/new/+page.svelte` | Query `?date=YYYY-MM-DD` (Regex `^\d{4}-\d{2}-\d{2}$`, sonst heute; einmalig bei Init gelesen, `:23-26`) | `requirePermission('ledger')` in `listCategoriesRemote`/`createLedgerEntryRemote` | AppShell | `listCategoriesRemote({ direction })` in `$derived` (`:39-40`, reaktiv auf Art-Wechsel); `createLedgerEntryRemote(...)` im Submit via `busy.run` (`:58-69`) | Manuelle Buchung anlegen. Erfolg → `goto('/ledger')`; Abbrechen → `goto('/ledger')` |
| `/ledger/[id]/edit` | `src/routes/ledger/[id]/edit/+page.svelte` | `id` (Route-Param, `untrack(() => page.params.id!)`, `:20`) | `requirePermission('ledger')` in `getLedgerEntryRemote`/`updateLedgerEntryRemote`/`deleteLedgerEntryRemote` | AppShell; **kein** `[id]/+layout.svelte` mit `{#key}` (nicht nötig: keine Detail-zu-Detail-Links) | 1. `await getLedgerEntryRemote({ id })` top-level (`:21`) → 404 fliegt nach `+error.svelte`; 2. `listCategoriesRemote({ direction })` in `$derived` (`:48-49`); 3. `updateLedgerEntryRemote({ id, values })` bzw. `deleteLedgerEntryRemote({ id })` im Handler | Buchung bearbeiten/löschen; Read-only-Ansicht für `source !== 'manual'`. `PageHeader back="/ledger"` (`:117`) |
| `/ledger/[id]` | — existiert nicht | — | — | — | — | Es gibt keine separate Detailseite; Zeilenklick in der Liste führt direkt auf `/ledger/{id}/edit` (`+page.svelte:325`) |
| `/sales-ledger` (Abgrenzung) | `src/routes/sales-ledger/+page.svelte` | Client-State `period` (`this_month` Default, `last_month`, `this_year`, `all`), keine URL-Parameter | `requirePermission('ledger')` (`sales-ledger.remote.ts:57`) | AppShell | `await untrack(() => getSalesLedgerRemote(queryArgs))` (`:24`), `$derived.by` + `$effect` (`:31-42`) | Read-only Rechnungsausgangsbuch über `documents` (type invoice) mit Summen Netto/MwSt/Brutto; Zeilenklick → `/invoices/{id}`; keine Pagination |

Redirects: keine modulspezifischen. Unauthentifiziert → `/login` (global, `hooks.server.ts`), Setup-Gate global.

## 2. Remote Functions und Endpoints

Gemeinsame Schemas (`src/routes/ledger/ledger.remote.ts:28-46`):

`entryInputSchema` (`:28-37`):
| Feld | Typ / Pipe | Pflicht | Deutsche Meldung | Bemerkung |
|---|---|---|---|---|
| `direction` | `picklist(['income','expense'])` | Pflicht | keine (Valibot-Default englisch → Fallback "Bitte prüfen Sie Ihre Eingabe.") | |
| `entryDate` | `pipe(string(), trim(), maxLength(10))` | Pflicht | keine | **keine Datumsprüfung** (nicht `dateStringSchema`) |
| `amountGross` | `moneySchema` = `pipe(number('Bitte geben Sie einen Betrag ein.'), minValue(-1_000_000_000, 'Der Betrag ist zu klein.'), maxValue(1_000_000_000, 'Der Betrag ist zu groß.'))` (`src/lib/server/db/validation.ts:187-191`) | Pflicht | ja | 0 und negativ serverseitig erlaubt |
| `taxRate` | `optional(number())` | optional, Default 19 im Handler (`:106`, `:155`) | keine | kein Wertebereich |
| `categoryId` | `optional(idSchema)` = `pipe(string(), minLength(1), maxLength(64), trim())` (`validation.ts:28`) | optional | keine | keine Existenz-/Richtungsprüfung |
| `description` | `pipe(string(), trim(), maxLength(500))` | Pflicht | keine | leerer String serverseitig erlaubt |
| `paymentMethod` | `paymentMethodSchema` = `optional(picklist(PAYMENT_METHODS, 'Bitte eine gültige Zahlungsart wählen.'))` (`validation.ts:164-166`); Werte `'Überweisung' \| 'Bar' \| 'Lastschrift' \| 'Karte'` (`src/lib/payment-methods.ts:13-18`) | optional | ja | Wert = deutsches Label wird gespeichert |
| `paymentStatus` | `optional(picklist(['paid','open','partial']))` | optional, Default `'paid'` (`:120`, `:169`) | keine | |

`listSchema` (`:39-46`): `page: number()`, `size: picklist([10,25,50,100])`, `q: optional(pipe(string(), trim(), maxLength(200)))`, `direction: optional(picklist(['income','expense','all']))`, `from`/`to: optional(pipe(string(), trim(), maxLength(10)))` — ebenfalls ohne Datumsprüfung. FIELD_LABELS-Mapping vorhanden nur für `taxRate` ('Steuersatz'), `description` ('Beschreibung'), `from` ('Von'), `to` ('Bis'), `q`, `page`, `size` (`src/hooks.server.ts:295,350-351,357,371-373`); `entryDate`, `amountGross`, `categoryId`, `paymentMethod`, `paymentStatus`, `direction` sind **nicht** gemappt (grep ohne Treffer) → Rohschlüssel in der Fehlermeldung.

- **listLedgerEntriesRemote** — query — `src/routes/ledger/ledger.remote.ts:54`
  - Guard: `requirePermission('ledger')` (`:55`)
  - Argumente: `listSchema`; `direction` Default `'all'` (`:60`)
  - Rückgabe: `{ items: LedgerEntry[], total, page, size, pageCount, incomeSum, expenseSum }` (`ledger-service.ts:93-104`; die Summen sind im deklarierten Rückgabetyp `ListResult<LedgerEntry>` nicht enthalten, die Seite castet: `+page.svelte:122-127`)
  - Fehlerfälle: 401 'Bitte melden Sie sich an.' (`auth-guards.ts:26`), 403 'Keine Berechtigung für diese Aktion.' (`:40`); Validierungsfehler über `handleValidationError`
  - Nebenwirkungen: keine. Transaktion: nein (4 parallele Selects)
- **listCategoriesRemote** — query — `ledger.remote.ts:72`
  - Guard: `requirePermission('ledger')`
  - Argumente: `{ direction?: 'income' \| 'expense' }`
  - Rückgabe: `ledger_categories`-Zeilen `{ id, direction, name, defaultTaxRate }[]`, sortiert (siehe §3)
  - Nebenwirkungen: keine
- **getLedgerEntryRemote** — query — `ledger.remote.ts:86`
  - Guard: `requirePermission('ledger')`
  - Argumente: `{ id: idSchema }`
  - Rückgabe: `LedgerEntry`
  - Fehler: 404 'Buchung nicht gefunden.' (`:91`)
- **createLedgerEntryRemote** — command — `ledger.remote.ts:102`
  - Guard: `requirePermission('ledger')`
  - Argumente: `entryInputSchema`
  - Handler-Logik (`:106-122`): `taxRate = values.taxRate ?? 19`; `gross = Number(amountGross)`; `net = round2(gross / (1 + taxRate/100))`; `tax = round2(gross - net)`; alle Beträge als String persistiert; `categoryId ?? null`; `paymentMethod ?? null`; `paymentStatus ?? 'paid'`; `source: 'manual'`. **Nicht gesetzt:** `entryNumber`, `supplierId`, `customerId`, `documentId`, `recurringTemplateId`
  - Rückgabe: erzeugte `LedgerEntry`
  - Nebenwirkungen: `await requested(listLedgerEntriesRemote, 4).refreshAll()` (`:123`). Keine Mail/PDF/Nummernkreis/Audit
  - Transaktion: nein
- **deleteLedgerEntryRemote** — command — `ledger.remote.ts:134`
  - Guard: `requirePermission('ledger')`
  - Argumente: `{ id: idSchema }`
  - Rückgabe: `void`; unbekannte id ist No-op (kein 404)
  - Nebenwirkungen: `requested(listLedgerEntriesRemote, 4).refreshAll()` (`:139`). **Keine** Guards (Quelle, Exportstatus, Datum) — Hard-Delete
- **updateLedgerEntryRemote** — command — `ledger.remote.ts:151`
  - Guard: `requirePermission('ledger')`
  - Argumente: `{ id: idSchema, values: entryInputSchema }` (Wrapper-Key `values` wird in Fehlermeldungen ausgeblendet, `hooks.server.ts` Kommentar `:406-409`)
  - Handler: gleiche Netto/Steuer-Ableitung wie Create (`:155-158`); setzt **nicht** `source` (bleibt) — prüft aber auch **nicht**, ob `source === 'manual'`
  - Rückgabe: `LedgerEntry` oder `undefined` bei unbekannter id (`ledger-service.ts:132-137`, Test `ledger-service.test.ts:231-237`) — kein 404
  - Nebenwirkungen: `Promise.all([getLedgerEntryRemote({ id }).refresh(), requested(listLedgerEntriesRemote, 4).refreshAll()])` (`:171-174`)
- **exportDatevRemote** — query — `src/routes/ledger/datev.remote.ts:19`
  - Guard: `requirePermission('ledger')` (`:22`)
  - Argumente: `{ from: dateStringSchema, to: dateStringSchema }` — Meldung 'Bitte geben Sie ein gültiges Datum ein (YYYY-MM-DD).' (`validation.ts:168-176`). Keine Prüfung `from <= to`, keine Prüfung "gleiches Jahr"
  - Rückgabe: `{ filename: 'DATEV_<from>_bis_<to>.csv', mime: 'text/csv; charset=windows-1252', data: <base64> }` (`:28-32`); `data = Buffer.from(csv, 'latin1').toString('base64')` (`:27`)
  - `consultantNo`/`clientNo` werden **nicht** übergeben → Service-Defaults `'1000'`/`'10000'` (`datev-export-service.ts:487`)
  - Nebenwirkungen: keine — kein Export-Log, keine Markierung exportierter Buchungen, kein `refreshAll`
  - Transportform: `query` (nicht `command`), Aufruf im Click-Handler zwingend mit `.run()` (`+page.svelte:166-170`; Bug-Historie CONTRIBUTING.md:209-216 "XRechnung/DATEV downloads")
- **getSalesLedgerRemote** (Abgrenzung) — query — `src/routes/sales-ledger/sales-ledger.remote.ts:56`
  - Guard: `requirePermission('ledger')`
  - Argumente: `{ from?, to? (string max 10, keine Datumsprüfung), period?: 'this_month'\|'last_month'\|'this_year'\|'all' }`; explizite Daten schlagen Preset (`:27`); `this_month`/kein Preset → nur `from` (offenes Ende, `:43-46`); `all` → keine Grenzen
  - Rückgabe: `{ rows: {id, documentNumber, issueDate, grossTotal, netTotal, taxTotal, status, customerName}[], totals: {net, tax, gross}, from, to }` — **alle** Status (auch `created`, `cancelled`, `storno`), keine Pagination, Summen in JS (`:86-94`)

HTTP-Endpoints (`+server.ts`): keine im Modul.

## 3. Services (Server-Layer)

### `src/lib/server/services/ledger-service.ts`
- `listLedgerCategories(direction?: 'income'\|'expense'): Promise<Category[]>` (`:24-38`) — `select * from ledger_categories`; mit `direction` → `where direction = ? order by name asc`; ohne → `order by direction asc, name asc` (d. h. `expense` vor `income`, Test `:55-66`). Kein Limit (Seed = 13 Zeilen). Keine Fehler.
- `listLedgerEntries(params: ListParams & { direction?, from?, to? }): Promise<ListResult<LedgerEntry>>` (`:40-106`) — Filter: `q` → `ilike(description, '%q%') OR ilike(entryNumber, '%q%')` (`:51-59`); `direction !== 'all'` → `eq`; `from` → `gte(entryDate)`; `to` → `lte(entryDate)` (inklusiv). Vier parallele Queries (`Promise.all`, `:73-90`): Items (`order by entry_date desc, created_at desc`, `limit size offset (page-1)*size`), `count()`, `sum(amount_gross)` für `direction='income'` und für `'expense'` jeweils **mit** dem vollen Filter (Summen gelten für den gesamten Filter, nicht die Seite). `pageCount = max(1, ceil(total/size))`. Kein Join auf `ledger_categories` (Kategoriename ist im Listenresultat nicht enthalten). Performance: ILIKE `%…%` ohne Trigram-Index → Sequential Scan bei Suche; Indizes `ledger_entries_entry_date_idx`, `_direction_idx`, `_category_id_idx` (`schema.ts:1034-1036`). Summen zählen alle `paymentStatus`-Werte (auch `open`/`partial`) voll.
- `createLedgerEntry(values: NewLedgerEntry): Promise<LedgerEntry>` (`:108-113`) — `insert … returning`. Keine Validierung, keine Transaktion.
- `deleteLedgerEntry(id): Promise<void>` (`:115-117`) — `delete where id`; No-op bei unbekannter id.
- `getLedgerEntry(id): Promise<LedgerEntry \| null>` (`:119-126`).
- `updateLedgerEntry(id, values: Partial<NewLedgerEntry>): Promise<LedgerEntry>` (`:128-138`) — `update … set values returning`; liefert `undefined` bei unbekannter id (Typ lügt).

### `src/lib/server/services/datev-export-service.ts`
- `exportDatevCsv(params: { from, to, consultantNo?='1000', clientNo?='10000' }): Promise<string>` (`:484-579`) — Drei parallele Queries (`:490-519`): (a) `documents` mit `type='invoice'`, `status in ('sent','paid','storno')` (`EXPORTED_INVOICE_STATUSES`, `:469`), `issueDate between from and to`, `order by issueDate asc`, Spalten `documentNumber, issueDate, grossTotal, status`; (b) `ledger_entries` mit `entryDate between from and to`, `order by entryDate asc`, alle Spalten; (c) alle `ledger_categories` (Map id→name, `:521-522`). Row-Erzeugung: Rechnungen (`:526-548`) → Konten `accountsForCategory('income','Erlöse')` = 8400/1400; `soHa = status==='storno' ? 'S' : 'H'`; `amount = abs(grossTotal)`; `beleg = documentNumber`; Text `'Rechnung <nr>'` bzw. `'Storno Rechnung <nr>'`. Ledger (`:550-564`) → `accountsForCategory(direction, categoryName)`; `amount = Number(amountGross)` (Vorzeichen wird erst in `fmtAmount` per `abs` entfernt); `soHa = income ? 'H' : 'S'`; `beleg = entryNumber ?? ''`; Text = `description`. `taxRate`/`taxAmount`/`amountNet`/`paymentStatus`/`paymentMethod` der Buchung werden **nicht** verwendet. Sortierung aller Rows nach `date` (String-Vergleich, stabil → Rechnungen vor Buchungen bei gleichem Datum, `:567`). Ausgabe: EXTF-Header, Spaltenheader, Rows, `\r\n`-getrennt mit abschließendem CRLF (`:577`), dann `toCp1252LatinString` (`:578`). Kein Limit, alles im Speicher. Keine Transaktion, keine Schreibzugriffe.
- `accountsForCategory(direction, categoryName)` (`:96-108`) — erster Regex-Treffer aus `ACCOUNT_MAP` (`:61-94`), sonst Default `income → 8400/1400`, `expense → 4980/1600`. Die `direction` wird bei einem Regex-Treffer **ignoriert**.
- `ACCOUNT_MAP` (`:61-94`, SKR03-orientiert, Konto/Gegenkonto): `/material\|werkstatt\|teile/i` → 3400/1600; `/büro\|office\|verwaltung/i` → 4930/1600; `/miete\|pacht\|raum/i` → 4210/1600; `/telefon\|internet\|porto/i` → 4920/1600; `/versicherung/i` → 4360/1600; `/kraftstoff\|sprit\|tank/i` → 4530/1600; `/verkauf\|erlös\|umsatz/i` → 8400/1400.
- Konsequenz für die 13 Seed-Kategorien (`seed-defaults.ts:174-188`): Werkstatterlöse → 8400/1400 (Treffer `erlös`); Fahrzeugverkauf → 8400/1400 (`verkauf`); Sonstige Einnahmen → 8400/1400 (Default income); Material → 3400/1600; Werkzeug → 4980/1600 (kein Treffer; `werkstatt` matcht nicht); Miete → 4210/1600; Strom → 4980/1600; Internet → 4920/1600; Reisekosten → 4980/1600; Lohnaufwand → 4980/1600; Fahrzeug-Einkauf → 4980/1600 (`/verkauf/` matcht "Einkauf" nicht); Inzahlungnahme → 4980/1600; Sonstiges → 4980/1600; ohne Kategorie: income 8400/1400, expense 4980/1600. Es gibt **keine** Konto-Spalte an der Kategorie — die Zuordnung ist ausschließlich Regex auf den Namen.
- `fmtAmount(v)` (`:119-124`) — `abs(round2(n)).toFixed(2)` mit `,` als Dezimaltrenner, keine Tausendertrennung.
- `fmtDateDdmm(s)` (`:127-131`) — `DDMM` aus ISO; leer bei ungültig.
- `fmtDateDot(s)` (`:134-138`, exportiert, im Modul ungenutzt) — `DD.MM.YYYY`.
- `fmtDateCompact(s)` (`:141-145`) — `YYYYMMDD`.
- `csvText(s)` (`:151-155`) — in `"` gewrappt, eingebettete `"` verdoppelt; `null/undefined` → leer (ohne Anführungszeichen).
- `sanitizeBookingText(s)` (`:162-169`, exportiert) — `[\r\n;]+` → Leerzeichen, Whitespace kollabiert, trim, max 60 Zeichen.
- `sanitizeBelegfeld(s)` (`:176-179`, exportiert) — nur `[0-9A-Za-z$%&*+\-/]`, max 36 Zeichen (Leerzeichen, Umlaute, `#`, Klammern werden entfernt).
- `COLUMN_HEADER` (`:193-280`) — exakt 125 Feldnamen der Buchungsstapel-Formatversion 13 (Feld 103 als `'Leerfeld'`).
- `buildExtfHeader({from, to, now, consultantNo, clientNo})` (`:292-356`) — 31 Felder: `"EXTF";700;21;"Buchungsstapel";13;<YYYYMMDDHHMMSS+'000' aus toISOString (UTC)>;;"RE";"TwinCarsManager";;<consultantNo>;<clientNo>;<WJ-Beginn = from.slice(0,4)+'0101'>;4;<from YYYYMMDD>;<to YYYYMMDD>;"TwinCars <from>-<to>";;1;0;1;"EUR"` + 9 leere Felder. Feld 14 Sachkontenlänge fix `4`, Feld 19 Buchungstyp `1` (Fibu), Feld 20 Rechnungslegungszweck `0`, Feld 21 Festschreibung `1`.
- `renderRow(r)` (`:375-386`) — 125 Zellen, befüllt: `[0]` Umsatz, `[1]` S/H, `[2]` `"EUR"`, `[6]` Konto, `[7]` Gegenkonto, `[9]` Belegdatum DDMM, `[10]` Belegfeld 1 (sanitized), `[13]` Buchungstext (sanitized). **Leer** bleiben u. a. BU-Schlüssel `[8]`, Belegfeld 2, KOST, Leistungsdatum `[114]`, Steuersatz `[118]`, Festschreibung `[113]`.
- `toCp1252LatinString(input)` (`:434-450`) — Codepoints `< 0x100` 1:1, `CP1252_HIGH_MAP` (`:398-426`, z. B. `€`→0x80, typografische Anführungszeichen, `–`/`—`) gemappt, alles andere → `'?'` (stumm).

### `src/lib/server/db/seed-defaults.ts` (Ledger-Anteil)
- `defaultLedgerCategories` (`:174-188`): income: Werkstatterlöse, Fahrzeugverkauf, Sonstige Einnahmen; expense: Material, Werkzeug, Miete, Strom, Internet, Reisekosten, Lohnaufwand, Fahrzeug-Einkauf, Inzahlungnahme, Sonstiges. **Kein** Konto, **kein** `defaultTaxRate` im Seed (Spalte bleibt `null`).
- `seedDefaults()` (`:222-227`): `insert {direction, name} … onConflictDoNothing({ target: ledgerCategories.name })` — idempotent über den global eindeutigen Namen (gleicher Name in beiden Richtungen unmöglich). Läuft beim ersten Request (`hooks.server.ts`) und beim Setup-Abschluss; `seed-defaults.test.ts` enthält keinen Kategorie-Test (grep `categor` ohne Treffer).

### Angrenzende Services (nur Ledger-Bezug)
- `src/lib/server/services/dashboard-service.ts:44-121` — `getDashboardKpis()` summiert `ledger_entries.amount_gross` des laufenden Monats (`:53-56`, `:80-87`) nach `direction` → `monthlyIncome`, `monthlyExpense`, `monthlyBalance`; Dashboard-Card heißt "Monatsumsatz" (`src/routes/+page.svelte:53-58`).
- `src/lib/server/services/import-service.ts:386-387` — Legacy-Import löscht `recurring_entries` und `ledger_entries` vollständig; `ledger_categories` bleiben (`:8-9`). Der Import schreibt **keine** Ledger-Buchungen.
- `src/lib/server/services/vehicle-service.ts:629-676` (`purchaseVehicleIntoStock`) und `:483-506` (`recordVehiclePurchase`) — schreiben `vehicles`, `vehicle_purchases`, `vehicle_listings`; **keine** Ledger-Buchung. Ebenso `PurchaseIntoStockModal.svelte` (nur `purchaseVehicleIntoStockRemote`, `:75-84`).
- `src/lib/server/services/document-service.ts:419-545` (`cancelInvoice`) — setzt das Original auf `status: 'cancelled'` + `cancelledAt` (`:526-533`) und legt eine `status: 'storno'`-Rechnung mit negierten Beträgen und `issueDate = heute` an (`:464-484`); keine Ledger-Buchung. `invoiceMonthlyStats()` (`:672-687`) summiert `documents`, nicht `ledger_entries`.

## 4. Komponenten (modul-lokal)
| Komponente | Datei | Zweck | Props (Name: Typ, default) | Events/Callbacks | Snippets/Slots | Interner State | Verwendete Shared-Komponenten |
|---|---|---|---|---|---|---|---|
| `EditEntryHost` | `src/routes/ledger/[id]/edit/EditEntryHost.svelte` | Test-only Wrapper: hüllt das async `+page.svelte` in `<svelte:boundary>` mit `pending`-Snippet (`data-testid="page-pending"`), damit top-level `await` in vitest/jsdom auflöst. Nicht im Produktivcode importiert | keine | keine | `pending` (intern) | keiner | `Page` (`./+page.svelte`) |
| DATEV-Export-Dialog | inline in `src/routes/ledger/+page.svelte:406-456` | Zeitraum-Modal (`<dialog class="modal modal-open">`, ohne natives `open`-Attribut) | — | `openDatev` (`:158-163`), `runDatevExport` (`:164-177`) | — | `datevOpen`, `datevFrom`, `datevTo` (`:153-157`) | keine (DaisyUI-Markup) |
| Lösch-Bestätigung | inline `+page.svelte:389-397`, `[id]/edit/+page.svelte:253-261` | ConfirmDialog-Instanzen | — | `onConfirm=remove` | — | `confirmOpen`, `toDelete` | `ConfirmDialog` |

Verwendete Shared-Komponenten/Utilities: `PageHeader` (Titel, `primaryAction`, `back`, `toolbar`-Snippet), `Toolbar` (`bind:query`, `placeholder`, `onQuery` mit 250 ms Debounce `Toolbar.svelte:21-27`, `filters`-Snippet), `Pagination`, `EmptyState`, `StatCard`, `ConfirmDialog`; `formatEuro` (`money.ts:45-51`), `paymentStatusLabel`/`paymentStatusBadge` (`status-labels.ts:92-111`: paid→'Bezahlt'/`badge-success`, open→'Offen'/`badge-error`, partial→'Teilweise gezahlt'/`badge-warning`, sonst '-'/`badge-ghost`), `downloadBase64File` (`pdf-download.ts:78-91`: base64 → `Uint8Array` → `Blob` → verstecktes `<a download>` → Klick → `revokeObjectURL` nach 60 s), `handleClientError`, `toast`, `busy`, `formDirty`, `PAYMENT_METHODS`.

## 5. Tabellen
- **`ledger_categories`** (`src/lib/server/db/schema.ts:988-993`): `id uuid PK`, `direction varchar(10) NOT NULL` (Werte `'income'`/`'expense'`, kein Enum/CHECK), `name varchar(100) NOT NULL UNIQUE` (global, nicht je Richtung), `default_tax_rate numeric(5,2) NULL` (nie geschrieben, nie gelesen).
- **`ledger_entries`** (`:995-1037`): `id uuid PK`; `entry_number varchar(50) NULL` (**nie gesetzt** — kein Nummernkreis `ledger` in `defaultNumberRanges` `seed-defaults.ts:157-172`; grep `entryNumber` außerhalb Tests: nur Lesezugriffe); `direction varchar(10) NOT NULL` (`'income'`/`'expense'`); `entry_date date NOT NULL`; `amount_gross numeric(12,2) NOT NULL`; `amount_net numeric(12,2) NOT NULL`; `tax_amount numeric(12,2) NOT NULL DEFAULT 0`; `tax_rate numeric(5,2) NOT NULL DEFAULT 19.00`; `category_id uuid FK → ledger_categories ON DELETE SET NULL`; `description text NOT NULL`; `payment_method varchar(30) NULL` (deutsches Label als Wert); `payment_status varchar(20) NOT NULL DEFAULT 'paid'` (`'paid'`/`'open'`/`'partial'`); `supplier_id uuid FK → suppliers SET NULL` (nie gesetzt); `customer_id uuid FK → customers SET NULL` (nie gesetzt); `document_id uuid FK → documents SET NULL` (nie gesetzt); `source varchar(30) NOT NULL DEFAULT 'manual'` (nur `'manual'` je geschrieben); `recurring_template_id uuid` (kein FK, nie gesetzt); `created_at timestamptz NOT NULL DEFAULT now()`. **Kein** `updated_at`, kein `exported_at`, kein Benutzerbezug (wer hat gebucht). Indizes: `ledger_entries_entry_date_idx`, `ledger_entries_direction_idx`, `ledger_entries_category_id_idx`. Migration: `drizzle/0000_lying_tyger_tiger.sql:213-235,441-444,466-468`; keine spätere Migration berührt die Tabellen.
- **`recurring_entries`** (`:1039-1069`): dormant (name, direction, categoryId, supplierId, amountGross, taxRate, paymentMethod, intervalKind, intervalEvery, startDate, endDate, occurrencesLimit, occurrencesCreated, nextRunDate, paused, notes, createdAt). Einziger Zugriff: `import-service.ts:386` (Delete).
- **`documents`** (gelesen von DATEV-Export und Verkaufsbuch, `:545-…`): `type`, `status` (Vokabular `status-labels.ts:34-44`: `draft`/`created`/`sent`/`open`/`paid`/`cancelled`/`storno`/`converted`/`overdue`), `document_number`, `issue_date`, `gross_total`, `net_total`, `tax_total`, `tax_rate`, `payment_method varchar(30)` (`:561`), `cancels_document_id`, `cancelled_at`. Neue Rechnungen: `status: 'created'` (`document-service.ts:281`); Storno-Original → `'cancelled'`; Legacy-Import: `'paid'` oder `'cancelled'` (`import-service.ts:288-298`).
- **`vehicle_purchases`**: kein Ledger-Bezug (Ankauf bucht nicht).

## 6. Flows (durchgängig, Start bis Ende)

- **Buchungen durchsehen (Monatsansicht)** — Einstieg: Sidebar "Buchhaltung" (Gruppe mit `permission: 'ledger'`, `navigation.ts:198-203`) → `/ledger` → Initial: aktueller Monat, `direction='all'`, `pageNum=1`, `q=''` (`+page.svelte:37-50`). Monatskarte mit `◀` / "Heute" / `▶` (`prevMonth`/`nextMonth`/`goToday`, jeweils `pageNum=1`, `:76-94`; "Heute" `disabled={isCurrentMonth}` `:247`), Überschrift `<Monatsname> <Jahr>` (deutsch, `:51-65`), Button "DATEV-Export" (`disabled={busy.active}`). Suche via `Toolbar` (Placeholder "Buchungen suchen: Beschreibung, Belegnummer ...", 250 ms Debounce, `onQuery → pageNum=1`); Art-Select "Alle/Einnahmen/Ausgaben" (`onchange → pageNum=1`). Drei `StatCard`s: "Einnahmen (gefiltert)" (success), "Ausgaben (gefiltert)" (error), "Saldo" (success wenn ≥ 0 sonst error) — Werte = Server-Summen des gesamten Filters. Tabelle: Datum (ISO-Rohstring `e.entryDate`, `:327`), Beleg-Nr. (mono, i. d. R. leer), Beschreibung, Quelle (`badge-ghost`: `'manuell'` bei `manual`, sonst Rohwert), Betrag (`+`/`−` + `formatEuro(amountGross)`, `text-success`/`text-error`), Status (`paymentStatusBadge`), Aktion (Pencil-Link → `/ledger/{id}/edit`, Trash-Button). Zeile klickbar → `goto('/ledger/{id}/edit')`; Aktionszelle mit `stopPropagation`. `Pagination` mit `size=25`. Ende: Verbleib auf `/ledger`.
  - Leerzustand: `EmptyState` Icon `Calculator`, Titel "Noch keine Buchungen", Text "Für den ausgewählten Monat liegen keine Ein- oder Ausgaben vor." — ohne Button (Kommentar `:300-301`); Stat-Cards zeigen 0,00 €.
  - Ladezustand: globale `busy`-Leiste; `lastResult` verhindert Leerblitzen (`:110-118`).
  - Validierungsfehler: keine Eingaben außer Suche (max 200 serverseitig).
  - Fehlerzustand: `$effect` → `handleClientError(query.error)` Toast (`:132`); initialer Fehler fliegt zu `+error.svelte`.
  - Abbruchpfade: —
  - Berechtigungs-Verweigerung: Nav-Item ausgeblendet (Rolle Mitarbeiter hat kein `ledger`, `seed-defaults.ts:342-356`; E2E `e2e/users.spec.ts:80-89`); Direktaufruf → 403 'Keine Berechtigung für diese Aktion.' via `+error.svelte`.
  - Bestätigungsdialoge: keine.

- **Buchung aus der Liste löschen** — Trash-Button → `toDelete={id, desc}`, `confirmOpen=true` → `ConfirmDialog` Titel "Buchung löschen?", Text `Soll die Buchung "<Beschreibung>" wirklich gelöscht werden?`, Button "Löschen" (`variant="danger"`) → `busy.run(deleteLedgerEntryRemote({id}).updates(listLedgerEntriesRemote(queryArgs).withOverride(items ohne id, total-1)))` (`:183-191`) → Toast "Buchung gelöscht." → Dialog zu. Summen werden nicht optimistisch angepasst, kommen mit `refreshAll` nach.
  - Fehlerzustand: `handleClientError(err)` Toast; Override wird verworfen.
  - Abbruch: "Abbrechen"/Close → `confirmOpen=false`.
  - Keine Sperre nach DATEV-Export, keine Sperre für System-Buchungen.

- **Buchung anlegen** — Einstieg: PageHeader "Neue Buchung" (`href=/ledger/new?date=<heute wenn aktueller Monat, sonst Monatserster>`, `:204`) → Seite "Neue Buchung anlegen" / Subtitle "Manuelle Ein- oder Ausgabe erfassen." → Fieldset "Buchungsdaten" mit: Art (`select`, Default "Ausgabe"; Optionen "Ausgabe"/"Einnahme"), Datum * (`type=date`, Preset), Beschreibung * (`maxlength=500`), Kategorie (`select`, "- wählen -" + Kategorien der gewählten Art, reaktiv über `listCategoriesRemote({direction})`), Steuersatz (%) (`select` 19 %/7 %/0 %, Default 19), Brutto (€) * (`type=number min=0 step=0.01`), Zahlungsart (`select` "-" + `PAYMENT_METHODS`), Zahlungsstatus (`select` "Bezahlt" Default/"Offen"/"Teilweise gezahlt"). Buttons "Abbrechen" (→ `goto('/ledger')`) und "Speichern" (Spinner bei `busy.active`). Submit (`:42-77`): Client-Validierung in Reihenfolge, nur **erste** Meldung als `alert alert-error role=alert`: (1) kein Datum → "Bitte ein Datum angeben."; (2) leere Beschreibung → "Bitte eine Beschreibung eingeben."; (3) Betrag leer oder ≤ 0 → "Bitte einen Betrag größer 0 eingeben.". Keine Feld-Markierung, keine `touched`-Logik. Dann `busy.run(createLedgerEntryRemote({...}))` mit `categoryId || undefined`, `paymentMethod || undefined`, `description.trim()`, `amountGross: Number(...)`. Erfolg: `formDirty.clear()` **vor** `goto` (`:70-73`), Toast "Buchung gespeichert.", `goto('/ledger')` (Liste zeigt den aktuellen Monat, nicht zwingend den Buchungsmonat).
  - Leerzustand Kategorien: Select zeigt nur "- wählen -".
  - Ladezustand: Buttons `disabled={busy.active}`, Spinner.
  - Fehlerzustand: `handleClientError(err)` Toast (z. B. Server-Validierung mit Rohschlüssel-Label, FK-Fehler als generischer 500-Text); Formular bleibt dirty.
  - Abbruchpfade: "Abbrechen" → `/ledger`; `formDirty` gesetzt bei `oninput`/`onchange`, geleert beim Unmount (`:79-80`) — der globale Unsaved-Changes-Guard greift (nicht in diesem Modul implementiert).
  - Berechtigung: wie oben.
  - Bestätigungsdialoge: keine.

- **Buchung bearbeiten** — Einstieg: Zeilenklick/Pencil → `/ledger/{id}/edit` → `await getLedgerEntryRemote({id})` (404 → `+error.svelte` "Buchung nicht gefunden.") → PageHeader "Buchung bearbeiten" mit Back-Pfeil `/ledger`. Bei `entry.source !== 'manual'` (`isManual`, `:52`): `alert-info` "Diese Buchung wurde vom System angelegt (Quelle: `<source>`) und kann hier nur angesehen werden. Änderungen erfolgen am Ursprungsdokument.", `<fieldset disabled>`, "Speichern" `disabled={busy.active \|\| !isManual}` (`:244`), Submit-Guard "System-generierte Buchungen können nicht direkt bearbeitet werden." (`:57-61`). Der Button "Löschen" bleibt aktiv (`:223-231`). Formularfelder identisch zur Anlage, vorbelegt aus `entry` (`Number(amountGross)`, `Number(taxRate)`, `categoryId ?? ''`, `paymentMethod ?? ''`, `paymentStatus ?? 'paid'`). Validierung identisch (drei Meldungen). Erfolg: `updateLedgerEntryRemote({id, values})` → `formDirty.clear()` → Toast "Buchung gespeichert." → `goto('/ledger')`.
  - Löschen: Button "Löschen" (`btn-ghost text-error`) → `ConfirmDialog` "Buchung löschen?" / "Die Buchung wird unwiderruflich gelöscht." / "Löschen" → `busy.run(deleteLedgerEntryRemote({id}))` (ohne `.updates`) → `formDirty.clear()` → Toast "Buchung gelöscht." → `goto('/ledger')`.
  - Fehlerzustand: `handleClientError(err)`.
  - Abbruch: "Abbrechen" → `/ledger`; `ConfirmDialog onClose={() => {}}` (`:260`), Schließen nur über `bind:open`.

- **DATEV-Export** — Einstieg: Button "DATEV-Export" in der Monatskarte (`:263-271`) → `openDatev`: `datevFrom`/`datevTo` = aktuelles Kalenderquartal (`currentQuarter`, `:143-152`; unabhängig vom angezeigten Monat), `datevOpen=true` → Modal "DATEV-Export", Text "Exportiert Rechnungen + Buchungen des gewählten Zeitraums als DATEV-Buchungsstapel-CSV (Format 7.0, CP1252).", zwei `type=date`-Inputs "Von"/"Bis", Buttons "Abbrechen"/"Export starten" (beide `disabled={busy.active}`), Backdrop-Button "Schließen". "Export starten" → `busy.run(() => exportDatevRemote({from, to}).run())` → `downloadBase64File(res)` (Dateiname `DATEV_<from>_bis_<to>.csv`, MIME `text/csv; charset=windows-1252`) → Toast "DATEV-Export heruntergeladen." → `datevOpen=false`.
  - Leerzustand: Zeitraum ohne Daten → gültige CSV mit nur den zwei Header-Zeilen, Erfolgs-Toast.
  - Validierungsfehler: nur serverseitig (`dateStringSchema`): leeres/ungültiges Datum → Toast "Von: Bitte geben Sie ein gültiges Datum ein (YYYY-MM-DD)." bzw. "Bis: …" (Label-Mapping `hooks.server.ts:350-351`); `from > to` wird nicht geprüft (Ergebnis: leere Datei).
  - Fehlerzustand: `handleClientError(err, 'DATEV-Export')`; Modal bleibt offen.
  - Abbruch: "Abbrechen"/Backdrop → `datevOpen=false`, eingegebene Daten werden beim nächsten Öffnen wieder auf das Quartal gesetzt.
  - Keine Bestätigung, keine Markierung exportierter Buchungen, kein Export-Protokoll.

- **Verkaufsbuch ansehen (Abgrenzung)** — Sidebar "Rechnungsausgangsbuch" → `/sales-ledger`: Zeitraum-Select (Dieser Monat/Letzter Monat/Dieses Jahr/Alle), Stat-Cards "Netto-Umsatz"/"MwSt"/"Brutto-Umsatz", Tabelle (Rechnungsnr., Datum, Kunde, Netto, MwSt, Brutto, Status-Badge) mit `<tfoot>`-Summe, Mobile-Kartenliste, Zeilenklick → `/invoices/{id}`; Leerzustand "Keine Rechnungen im Zeitraum". Keine Pagination, keine Suche, kein Export von hier.

## 7. Nebenwirkungen
- **E-Mails:** keine.
- **PDFs:** keine.
- **Uploads:** keine (kein Beleg-Scan pro Buchung).
- **Exporte:** DATEV-Buchungsstapel-CSV — EXTF-Header Version 700, Datenkategorie 21, Formatversion 13; 31 Header-Felder; 125-spaltiger Spaltenheader; Trennzeichen `;`; Textfelder in `"`; Zahlen unquotiert mit `,`-Dezimaltrenner, 2 Nachkommastellen, immer positiv (Vorzeichen über S/H); Belegdatum `DDMM`; Zeilenende `\r\n`; Encoding CP1252 (Latin-1-String → `Buffer latin1` → base64 → Browser-Blob). Kontenrahmen: SKR03-orientierte Fixwerte (8400/1400, 3400/4980/4930/4210/4920/4360/4530 gegen 1600). Beraternummer `1000`, Mandant `10000` (hart). WJ-Beginn = 1. Januar des `from`-Jahres. Kein BU-Schlüssel, kein Steuersatz, kein Leistungsdatum, kein KOST. Rechnungsauswahl: `type='invoice'` und Status `sent`/`paid`/`storno` nach `issueDate`; Ledger nach `entryDate`. Export wird nirgends protokolliert.
- **Externe APIs / Webhooks:** keine.
- **Nummernkreise:** keiner für Buchungen (`entry_number` bleibt leer).
- **Cross-Modul:** Dashboard-KPIs "Monatsumsatz"/"Monatsausgaben" lesen `ledger_entries` (`dashboard-service.ts:80-87`); Legacy-Import löscht alle Buchungen (`import-service.ts:387`); DATEV-Export liest `documents` (Rechnungen) mit.

## 8. Vorhandene Tests
| Testdatei | Art (unit/component/integration/e2e/visual) | Was wird abgedeckt (1 Zeile) |
|---|---|---|
| `src/lib/server/services/ledger-service.test.ts` (270 Zeilen) | integration (pg-mem) | Kategorien-Sortierung/Filter; create; list: Sortierung desc, Summen, Pagination, direction, Datumsbereich inkl., ILIKE-Suche auf description/entryNumber, leeres Ergebnis pageCount=1; update (+ `undefined` bei unbekannter id); delete (+ No-op); get null |
| `src/lib/server/services/datev-export-service.test.ts` (416 Zeilen) | integration (pg-mem) | EXTF-Header-Prefix/WJ/Zeitraum, exakt 31 Header-Felder, 125 Spalten in Header und jeder Row, eine Row pro Rechnung, Status-Filter (created/cancelled raus; sent/paid/storno rein), Ledger-Rows, Bereichsgrenzen, Komma-Betrag, S/H je direction, DDMM, Storno = nur S/H-Flip mit gleichen Konten + "Storno"-Text, Buchungstext-Sanitizing (60, keine `;`/CR/LF), Belegfeld-Sanitizing (Charset, 36), CP1252-Umlaute Round-Trip |
| `src/routes/ledger/new/page.test.ts` (67 Zeilen) | component | "Speichern" nie disabled; Klick ohne Beschreibung → "Bitte eine Beschreibung eingeben."; mit Beschreibung ohne Betrag → "Bitte einen Betrag größer 0 eingeben."; Remote nicht aufgerufen |
| `src/routes/ledger/[id]/edit/page.test.ts` (82 Zeilen) | component (via `EditEntryHost`) | Vorbelegung aus Mock-Entry; "Speichern" bleibt klickbar nach Leeren der Beschreibung; Klick → deutsche Meldung, Remote nicht aufgerufen |
| `src/lib/utils/pdf-download.test.ts:156-175` | unit | `downloadBase64File` erzeugt `text/csv`-Blob und setzt `download`-Dateinamen (DATEV-Fall) |
| `src/routes/dashboard.remote.test.ts:170-…` | integration | Monats-Summen aus `ledger_entries` fließen korrekt in KPIs, Vormonat wird ignoriert |
| `e2e/smoke.spec.ts:46-48, 97-101, 119-132` | e2e | `/ledger` rendert Titel "Buchhaltung"; `/ledger/new` Titel + Klick auf Speichern zeigt Alert "Bitte eine Beschreibung eingeben." |
| `e2e/navigation.spec.ts:38-42, 52` | e2e | Nav "Buchhaltung" → `/ledger`, "Rechnungsausgangsbuch" → `/sales-ledger` |
| `e2e/users.spec.ts:80-89` | e2e | Rolle Mitarbeiter sieht "Buchhaltung" nicht in der Sidebar |
| `e2e/smoke.spec.ts:34-37` | e2e | `/sales-ledger` rendert "Brutto-Umsatz" |

Nicht abgedeckt: `ledger.remote.ts` (Guards, Netto/Steuer-Ableitung, Defaults, `refreshAll`), `datev.remote.ts` (base64/Dateiname/MIME), Listen-Seite (Monatsnavigation, Summen-Cards, Delete-Override, DATEV-Modal), Read-only-Pfad für System-Buchungen (nur Kommentar im Test, kein Case), Kategorien-Seed, E2E: Buchung erfolgreich anlegen/bearbeiten/löschen, DATEV-Download, `sales-ledger.remote.ts` (docs behaupten "covered via document-service.test.ts" — dort kein Bezug).

## 9. Feature-Matrix
| ID | Feature | Routen | Endpoints/Remotes | Tabellen | Erwartetes Verhalten |
|---|---|---|---|---|---|
| F-448 | Buchungsliste als Monatsansicht mit Monatsnavigation | `/ledger` | `listLedgerEntriesRemote` | `ledger_entries` | Default = aktueller Monat; `◀`/`▶` wechseln Monat inkl. Jahreswechsel; "Heute" springt zurück und ist im aktuellen Monat disabled; `from`/`to` = 1. bis letzter Tag (UTC-Berechnung `+page.svelte:66-72`); jeder Wechsel setzt `pageNum=1`; Sortierung `entry_date desc, created_at desc` |
| F-449 | Volltextsuche Beschreibung/Beleg-Nr. | `/ledger` | `listLedgerEntriesRemote(q)` | `ledger_entries` | ILIKE `%q%` auf `description` OR `entry_number`, case-insensitiv, 250 ms Debounce, Seite → 1, max 200 Zeichen; nur-set-key im `queryArgs` (`...(q ? { q } : {})`) |
| F-450 | Art-Filter Alle/Einnahmen/Ausgaben | `/ledger` | `listLedgerEntriesRemote(direction)` | `ledger_entries` | `all` = kein Filter; Wechsel setzt Seite → 1; Filter wirkt auch auf Summen |
| F-451 | Summen-Cards Einnahmen/Ausgaben/Saldo (gefiltert) | `/ledger` | `listLedgerEntriesRemote` (`incomeSum`, `expenseSum`) | `ledger_entries` | Serverseitige `sum(amount_gross)` über den vollen Filter (Monat + Suche + Art), nicht nur die Seite; bei Art-Filter "Einnahmen" ist Ausgaben-Summe 0; Saldo = income − expense, Farbe success/error; `paymentStatus` unberücksichtigt |
| F-452 | Serverseitige Pagination 25 | `/ledger` | `listLedgerEntriesRemote(page,size)` | `ledger_entries` | `size` fix 25 (`+page.svelte:38`), Schema erlaubt 10/25/50/100; `pageCount = max(1, ceil(total/25))`; `Pagination`-Komponente; stale-while-revalidate über `lastResult` |
| F-453 | Leerzustand der Liste | `/ledger` | — | — | `EmptyState` "Noch keine Buchungen" / "Für den ausgewählten Monat liegen keine Ein- oder Ausgaben vor.", kein Button; Pagination wird nicht gerendert (`{#if items.length === 0}`) |
| F-454 | Zeilendarstellung | `/ledger` | — | `ledger_entries` | Spalten Datum (ISO-Rohformat), Beleg-Nr. (mono, leer wenn null), Beschreibung, Quelle-Badge (`manuell`/Rohwert), Betrag mit `+`/`−` und Farbe, Zahlungsstatus-Badge (Bezahlt grün/Offen rot/Teilweise gezahlt gelb), Aktionen Bearbeiten/Löschen; keine Kategorie-, Netto-, Steuer- oder Zahlungsart-Spalte |
| F-455 | Zeile klickbar → Bearbeiten | `/ledger` → `/ledger/[id]/edit` | — | — | `hover:bg-base-200 cursor-pointer`, `goto` auf `<tr>`; Aktionszelle mit `stopPropagation`; Pencil-Link gleiche Ziel-URL |
| F-456 | Buchung aus Liste löschen (optimistisch) | `/ledger` | `deleteLedgerEntryRemote` + `listLedgerEntriesRemote.withOverride` | `ledger_entries` | ConfirmDialog "Buchung löschen?" mit Beschreibung im Text; Override entfernt Zeile und dekrementiert `total`; Server `requested(list,4).refreshAll()`; Toast "Buchung gelöscht."; keinerlei Löschguard |
| F-457 | Neue Buchung anlegen | `/ledger/new` | `createLedgerEntryRemote`, `listCategoriesRemote` | `ledger_entries`, `ledger_categories` | Felder Art (Default Ausgabe), Datum (Preset aus `?date=`, sonst heute), Beschreibung, Kategorie, Steuersatz 19/7/0, Brutto, Zahlungsart, Zahlungsstatus (Default Bezahlt); `source='manual'`; Erfolg → Toast "Buchung gespeichert." + `/ledger` |
| F-458 | Datum-Preset aus der Monatsansicht | `/ledger` → `/ledger/new?date=` | — | — | Aktueller Monat → heute; anderer Monat → 1. des angezeigten Monats; ungültiger Param → heute |
| F-459 | Richtungsabhängige Kategorienliste | `/ledger/new`, `/ledger/[id]/edit` | `listCategoriesRemote({direction})` | `ledger_categories` | Select zeigt nur Kategorien der gewählten Art, alphabetisch; Umschalten der Art lädt neu; "- wählen -" = keine Kategorie (`categoryId` → `undefined` → `null`) |
| F-460 | Brutto-basierte Netto/Steuer-Ableitung | `/ledger/new`, `/ledger/[id]/edit` | `createLedgerEntryRemote`, `updateLedgerEntryRemote` | `ledger_entries` | Server rechnet `net = round2(gross/(1+rate/100))`, `tax = round2(gross−net)`, `taxRate` Default 19; Netto/Steuer sind nicht editierbar und werden im UI nirgends angezeigt |
| F-461 | Zahlungsart und Zahlungsstatus | Formulare | — | `ledger_entries.payment_method/payment_status` | Zahlungsart optional aus `PAYMENT_METHODS` (deutsches Label als Wert); Status `paid`/`open`/`partial`, Default `paid`; Status hat keine Auswirkung auf Summen/Export |
| F-462 | Click-time-Validierung mit deutschen Meldungen | `/ledger/new`, `/ledger/[id]/edit` | — | — | Speichern nie wegen Eingaben disabled; erste verletzte Regel als `alert-error`: Datum → "Bitte ein Datum angeben.", Beschreibung → "Bitte eine Beschreibung eingeben.", Betrag ≤ 0 → "Bitte einen Betrag größer 0 eingeben."; `novalidate` am Formular |
| F-463 | Unsaved-Changes-Handling | `/ledger/new`, `/ledger/[id]/edit` | — | — | `formDirty.set(true)` bei `oninput`/`onchange`; `formDirty.clear()` vor `goto` nach Erfolg und beim Unmount; bei Fehler bleibt dirty |
| F-464 | Buchung bearbeiten (manuelle Buchung) | `/ledger/[id]/edit` | `getLedgerEntryRemote`, `updateLedgerEntryRemote` | `ledger_entries` | Top-level await, Vorbelegung, gleiche Felder/Validierung wie Anlage; Server refresht Detail + Liste; Toast "Buchung gespeichert." → `/ledger` |
| F-465 | Read-only-Modus für System-Buchungen | `/ledger/[id]/edit` | — (nur Client) | — | `source !== 'manual'` → Info-Alert mit Quelle, Fieldset disabled, Speichern disabled + Submit-Guard-Meldung; Löschen bleibt möglich; aktuell nicht erreichbar, da nur `manual` existiert |
| F-466 | Buchung von der Edit-Seite löschen | `/ledger/[id]/edit` | `deleteLedgerEntryRemote` | `ledger_entries` | ConfirmDialog "Buchung löschen?" / "Die Buchung wird unwiderruflich gelöscht."; Toast "Buchung gelöscht." → `/ledger` |
| F-467 | 404 für unbekannte Buchung | `/ledger/[id]/edit` | `getLedgerEntryRemote` | — | `error(404, 'Buchung nicht gefunden.')` → Root `+error.svelte` |
| F-468 | Standard-Kategorien (Seed) | — | `seedDefaults()` | `ledger_categories` | 13 Kategorien (3 income, 10 expense) beim ersten Request/Setup; idempotent über `name` unique; kein Konto, kein Steuersatz-Default; keine Verwaltungs-UI (Anlegen/Umbenennen/Löschen nicht möglich) |
| F-469 | DATEV-Export-Dialog | `/ledger` | — | — | Button in Monatskarte; Modal mit Von/Bis, Default aktuelles Kalenderquartal; "Export starten"/"Abbrechen"/Backdrop; Buttons nur bei `busy.active` disabled |
| F-470 | DATEV-CSV Grundformat | `/ledger` | `exportDatevRemote` → `exportDatevCsv` | `documents`, `ledger_entries`, `ledger_categories` | EXTF 700/21/"Buchungsstapel"/13, 31 Header-Felder (Berater 1000, Mandant 10000, WJ-Beginn 1.1. des `from`-Jahres, Sachkontenlänge 4, Buchungstyp 1, Festschreibung 1, EUR), 125-Spalten-Header, Rows immer 125 Zellen, `;`-getrennt, CRLF, CP1252 |
| F-471 | DATEV: Rechnungen exportieren | — | `exportDatevCsv` | `documents` | Rechnungen mit Status `sent`/`paid`/`storno` und `issue_date` im Zeitraum; Konto 8400 / Gegenkonto 1400; Betrag = `abs(gross_total)`; `H` normal, `S` bei `storno`; Belegfeld 1 = Rechnungsnummer; Text "Rechnung <nr>" bzw. "Storno Rechnung <nr>"; `created`/`draft`/`cancelled`/`open`/`overdue`/`converted` werden **nicht** exportiert |
| F-472 | DATEV: Ledger-Buchungen exportieren mit Kategorie-Mapping | — | `exportDatevCsv` | `ledger_entries`, `ledger_categories` | Alle Buchungen im Zeitraum (jeder `paymentStatus`, jede `source`); Konto/Gegenkonto per Regex auf Kategoriename (siehe §3), Default income 8400/1400, expense 4980/1600; `H` bei income, `S` bei expense; Betrag brutto ohne Steuerschlüssel; Belegfeld 1 = `entry_number` (praktisch leer); Text = Beschreibung |
| F-473 | DATEV: Feld-Sanitizing und Encoding | — | `sanitizeBookingText`, `sanitizeBelegfeld`, `toCp1252LatinString` | — | Buchungstext: CR/LF/`;` → Leerzeichen, max 60; Belegfeld: nur `0-9A-Za-z$%&*+-/`, max 36; Umlaute/`€`/typografische Zeichen als CP1252-Bytes, nicht abbildbare Zeichen → `?` |
| F-474 | DATEV: Browser-Download | `/ledger` | `exportDatevRemote(...).run()` + `downloadBase64File` | — | Query im Click-Handler mit `.run()` innerhalb `busy.run`; base64 → Blob `text/csv; charset=windows-1252` → `<a download="DATEV_<from>_bis_<to>.csv">`; Toast "DATEV-Export heruntergeladen."; Modal schließt nur bei Erfolg |
| F-475 | Berechtigung und Navigation | alle | alle Remotes | `role_permissions` | Modul-Key `ledger` (`permissions.ts:38`); Administrator (`*`) und Werkstattleiter haben es, Mitarbeiter nicht; Nav-Items "Buchhaltung" (`/ledger`) und "Rechnungsausgangsbuch" (`/sales-ledger`) beide hinter `ledger` |
| F-476 | Single-Flight-Refresh | `/ledger`, Formulare | `requested(listLedgerEntriesRemote, 4).refreshAll()`, `.updates(...withOverride)` | — | Create/Update/Delete refreshen bis zu 4 Listen-Instanzen serverseitig; nur der Listen-Delete deklariert clientseitig `.updates`; Update refresht zusätzlich `getLedgerEntryRemote({id})` |
| F-477 | Dashboard-KPIs aus dem Kassenbuch (Cross-Modul) | `/` | `getDashboardKpis` | `ledger_entries` | "Monatsumsatz" = Summe manueller Einnahmen-Buchungen des Kalendermonats (UTC), "Monatsausgaben" analog; Rechnungen fließen nicht ein |
| F-478 | Rechnungsausgangsbuch (Abgrenzung) | `/sales-ledger` | `getSalesLedgerRemote` | `documents`, `customers` | Perioden-Presets, alle Rechnungsstatus inkl. Entwürfe/Storno/storniert, Summen Netto/MwSt/Brutto in JS, `<tfoot>`-Summe, Mobile-Liste, Zeilenklick → Rechnung; ohne Pagination/Suche/Export |
| F-479 | Legacy-Import und Kassenbuch (Cross-Modul) | `/settings/import` | `import-service` | `ledger_entries`, `recurring_entries` | Import löscht alle Buchungen und wiederkehrenden Vorlagen, behält Kategorien; importiert keine Buchungen |
| F-480 | Schema-Vorräte ohne UI | — | — | `ledger_entries.supplier_id/customer_id/document_id/recurring_template_id/entry_number`, `ledger_categories.default_tax_rate`, `recurring_entries` | Existieren in Schema/Migration 0000, werden nirgends geschrieben oder gelesen (außer `entry_number` lesend in Suche/Liste/DATEV); `recurring_entries` ist laut Docs bewusst dormant (ADR-009) |

## 10. Befunde
| ID | Beschreibung | Fundstelle | Auswirkung | Empfehlung | Einordnung | Betroffene Features |
|---|---|---|---|---|---|---|
| B-385 | DATEV-Storno-Logik inkonsistent zum Datenmodell: `cancelInvoice` setzt das Original auf `status='cancelled'`; der Export schließt `cancelled` aus (Kommentar nennt es fälschlich "voided drafts") und exportiert nur die Storno-Row als `S`. Liegen Original und Storno im selben Zeitraum oder wurde das Original nie exportiert, entsteht eine Gegenbuchung ohne Ursprungsbuchung (negativer Erlös). Re-Exporte früherer Perioden sind nicht reproduzierbar (Original verschwindet nachträglich). Zusätzlich lässt `cancelInvoice` `status='created'` zu (prüft nur `'draft'`), sodass nie versendete Rechnungen Phantom-Stornos erzeugen | `src/lib/server/services/datev-export-service.ts:463-469,499-506,526-548`; `src/lib/server/services/document-service.ts:440,526-533`; Test `datev-export-service.test.ts:154-194` zementiert das Verhalten | Fehlerhafte Umsatzzahlen beim Steuerberater | Original (`cancelled`, sofern je ausgestellt) weiterhin als `H` exportieren oder Export an "Ausstellung" statt Status koppeln; Exportlauf als unveränderlichen Snapshot persistieren | im Rewrite beheben | F-471 |
| B-386 | Rechnungen pauschal auf 8400 (Erlöse 19 % USt) ohne BU-Schlüssel und ohne Steuersatz-Spalte, unabhängig von `documents.tax_rate` (7 %/0 % möglich) | `datev-export-service.ts:527,375-386,32-39` | USt-Automatik in DATEV bucht falsche Steuer bei 7 %/0 %-Rechnungen; steuerfreie Umsätze werden 19 %-Erlös | Steuersatz aus Dokument/Buchung mappen (8300/8400/8100 bzw. BU-Schlüssel) | im Rewrite beheben | F-471 |
| B-387 | Ledger-Buchungen werden brutto auf Aufwandskonto ohne Steuerschlüssel gebucht; `tax_rate`, `tax_amount`, `amount_net` werden im Export ignoriert | `datev-export-service.ts:550-564` | Vorsteuer geht verloren bzw. muss vom Steuerberater manuell nachgezogen werden | BU-Schlüssel/Steuersatz aus `tax_rate` setzen oder Netto+Steuer getrennt buchen | im Rewrite beheben | F-472 |
| B-388 | Doppelzählungsrisiko: Rechnungen werden aus `documents` exportiert; erfasst der Betrieb den Zahlungseingang zusätzlich als Ledger-Einnahme (Kategorie "Werkstatterlöse"/"Fahrzeugverkauf" → ebenfalls 8400/1400 `H`), erscheint der Umsatz doppelt. Kein Konzept, welche Quelle führt; keine Verknüpfung `document_id` in der UI | `datev-export-service.ts:526-564`; `README.md:404-415` | Umsatz im Buchungsstapel doppelt | Führende Quelle festlegen (Soll: Rechnungen; Ledger nur Nicht-Rechnungs-Einnahmen) und `document_id`-Verknüpfung/Ausschluss implementieren | Entscheidung nötig | F-471, F-472 |
| B-389 | Beraternummer/Mandantennummer hart codiert (`'1000'`/`'10000'`); Remote übergibt nichts; keine Firmeneinstellung | `datev-export-service.ts:487`; `src/routes/ledger/datev.remote.ts:23`; grep `consultant\|berater\|mandant` in `schema.ts`/`settings` ohne Treffer | Jeder Export muss beim Import beim Steuerberater korrigiert werden | Felder in `company_settings` + Settings-UI | im Rewrite beheben | F-470 |
| B-390 | Wirtschaftsjahr = Kalenderjahr aus `from`; Belegdatum nur `DDMM`; weder `from <= to` noch "gleiches Jahr" geprüft | `datev-export-service.ts:304-305,127-131`; `datev.remote.ts:20` | Jahresübergreifender Zeitraum ordnet Dezember-Belege dem falschen Jahr zu; `from > to` liefert stumm eine leere Datei | Validierung `from <= to` und gleiches WJ mit deutscher Meldung; abweichendes WJ konfigurierbar | im Rewrite beheben | F-469, F-470 |
| B-391 | Keine Festschreibung/Exportmarkierung: Header meldet `Festschreibung=1`, aber exportierte Buchungen und Rechnungen bleiben frei editier-/löschbar; kein `exported_at`, kein Export-Protokoll | `datev-export-service.ts:351`; `ledger-service.ts:115-138`; Schema ohne Export-Spalten `schema.ts:995-1037` | GoBD-Widerspruch (Unveränderbarkeit), Re-Exporte nicht reproduzierbar | Export-Läufe persistieren (Zeitraum, Zeitpunkt, Datei-Hash), Buchungen mit Export-Referenz sperren, Änderungen nur per Storno-Buchung | Entscheidung nötig | F-456, F-464, F-466, F-470 |
| B-392 | Hard-Delete und freie Edit von Buchungen ohne Guard, Audit oder Storno-Buchung — im Gegensatz zur Rechnungs-Philosophie (ADR-015 Storno statt Löschen) | `ledger.remote.ts:134-141,151-176`; `ledger-service.ts:115-117` | Kassenbuch nicht GoBD-konform; kein "wer/wann" | Änderungshistorie/Storno-Buchung, `updated_at`/`user_id` Spalten | Entscheidung nötig | F-456, F-464, F-466 |
| B-393 | Read-only-Gate für System-Buchungen nur clientseitig; `updateLedgerEntryRemote` prüft `source` nicht; "Löschen" auf der Edit-Seite bei System-Buchungen aktiv. Derzeit ohne Wirkung (nur `manual`), aber latente Lücke sobald automatische Buchungen existieren | `src/routes/ledger/[id]/edit/+page.svelte:52-61,223-231,244`; `ledger.remote.ts:151-176` | API-Aufrufer könnten Systembuchungen ändern/löschen | Server-Guard `source==='manual'` in Update/Delete (409 mit deutscher Meldung) | im Rewrite beheben | F-465 |
| B-394 | `entryDate` (Create/Update) und `from`/`to` (Liste) ohne Datumsvalidierung (`string, trim, maxLength(10)` statt `dateStringSchema`) | `ledger.remote.ts:30,44-45` | Ungültige Strings erreichen Postgres → 500 statt kuratiertem 4xx; keine deutsche Meldung | `dateStringSchema` verwenden | im Rewrite beheben | F-457, F-464, F-448 |
| B-395 | `amountGross` erlaubt serverseitig 0 und negative Werte (`moneySchema` −1 Mrd…+1 Mrd); nur der Client prüft `> 0` | `ledger.remote.ts:31`; `validation.ts:187-191`; `new/+page.svelte:53` | Über API negative Buchungen → Summen und DATEV (`abs`) inkonsistent | Eigenes Schema `minValue(0.01, 'Bitte einen Betrag größer 0 eingeben.')` | im Rewrite beheben | F-457, F-460 |
| B-396 | `taxRate: optional(number())` ohne Bereich; `-100` → Division durch 0 → `'Infinity'` → DB-Fehler; beliebige Sätze möglich, obwohl UI nur 19/7/0 anbietet | `ledger.remote.ts:32,106-109` | 500er, inkonsistente Daten | `picklist([0, 7, 19], 'Bitte einen gültigen Steuersatz wählen.')` oder 0..100 | im Rewrite beheben | F-460 |
| B-397 | `categoryId` ohne Existenz- und Richtungsprüfung; beim Umschalten der Art im Formular bleibt der `categoryId`-State der alten Richtung erhalten (Select verliert die Option, State wird nicht zurückgesetzt — Verhalten von Svelte `bind:value` bei verschwundener Option hier nicht verifiziert, "unklar") → Einnahme mit Ausgaben-Kategorie möglich; DATEV mappt dann per Regex (z. B. income + "Material" → 3400/1600 `H`) | `ledger.remote.ts:33`; `new/+page.svelte:28-40,129-135`; `datev-export-service.ts:96-108` | Fehlbuchungen, FK-Verletzung als 500 | Server: Kategorie laden, `direction` abgleichen, 400 mit deutscher Meldung; Client: `categoryId=''` bei Art-Wechsel | im Rewrite beheben | F-459, F-472 |
| B-398 | `description`: `maxLength` ohne deutsche Meldung, kein `minLength` serverseitig (leer möglich via API); `direction`/`paymentStatus`-Picklists ohne Meldung | `ledger.remote.ts:29,34,36` | Fallback "Bitte prüfen Sie Ihre Eingabe." statt konkreter Meldung; leere Beschreibungen | Deutsche Meldungen in allen Pipe-Schritten (CONTRIBUTING) | im Rewrite beheben | F-462 |
| B-399 | `FIELD_LABELS` ohne `entryDate`, `amountGross`, `categoryId`, `paymentMethod`, `paymentStatus`, `direction` | `src/hooks.server.ts:286-374` (grep ohne Treffer), `:403` Fallback Rohschlüssel | Validierungs-Toasts wie "amountGross: Der Betrag ist zu groß." | Labels ergänzen (Datum, Brutto, Kategorie, Zahlungsart, Zahlungsstatus, Art) | im Rewrite beheben | F-462 |
| B-400 | `updateLedgerEntry` liefert `undefined` bei unbekannter id, Remote gibt das ungeprüft zurück (kein 404); Client zeigt "Buchung gespeichert." | `ledger-service.ts:128-138`; `ledger.remote.ts:159-175`; Test `ledger-service.test.ts:231-237` | Falsches Erfolgsfeedback bei Race (parallel gelöscht) | 404 'Buchung nicht gefunden.' im Remote | im Rewrite beheben | F-464 |
| B-401 | `entry_number` wird nie vergeben (kein Nummernkreis, kein Formularfeld): Liste zeigt leere Beleg-Nr.-Spalte, Suche darauf ist wirkungslos, DATEV-Belegfeld 1 bei allen Ledger-Buchungen leer | `seed-defaults.ts:157-172`; `ledger.remote.ts:110-122`; `+page.svelte:328`; `datev-export-service.ts:561` | Steuerberater kann Buchungen keinem Beleg zuordnen | Beleg-Nr.-Feld (Fremdbeleg) + optional eigener Nummernkreis `ledger` | Entscheidung nötig | F-454, F-449, F-472 |
| B-402 | Schema-Vorräte ohne UI/Logik: `supplier_id`, `customer_id`, `document_id`, `recurring_template_id`, `ledger_categories.default_tax_rate` (nie geseedet), `recurring_entries`. README/Docs behaupten "optional verknüpft mit Beleg, Kunde oder Lieferant" und "seeded with defaultTaxRate" — nicht implementiert | `schema.ts:1017-1031,992,1039-1069`; `README.md:409-410`; `docs/modules/ledger.md:23-27` | Doku-Konflikt; tote Spalten; Erwartungslücke beim Rewrite | Entscheiden: Verknüpfungen bauen (Picker) oder Spalten streichen; `recurring_entries` umsetzen (operator-getriggert) oder entfernen | Entscheidung nötig | F-480 |
| B-403 | Keine automatischen Buchungen: Rechnungszahlung (`documents.status → paid`), Fahrzeug-Ankauf (`vehicle_purchases.purchase_price`), Storno erzeugen keine `ledger_entries`. Dashboard-Card "Monatsumsatz" zeigt daher nur manuelle Einnahmen — irreführend neben "Offene Rechnungen" | grep: einzige Insert-Stelle `ledger-service.ts:111` ← `ledger.remote.ts:110`; `vehicle-service.ts:629-676`; `dashboard-service.ts:80-87`; `src/routes/+page.svelte:53-58` | Kassenbuch und Rechnungswesen laufen unverbunden; Dashboard-Kennzahl semantisch falsch | Zielbild klären (siehe §11); Dashboard-Label anpassen oder KPI aus Rechnungen speisen | Entscheidung nötig | F-477, F-472 |
| B-404 | `paymentStatus` (`open`/`partial`) ohne Wirkung: Summen-Cards, Dashboard und DATEV zählen offene/teilbezahlte Buchungen voll; kein Teilbetrag-Feld | `ledger-service.ts:82-89`; `datev-export-service.ts:550-564` | Ist-Versteuerung/Kassenstand falsch, wenn offene Posten als Buchung erfasst werden | Status-Semantik definieren (Kassenbuch = nur Zahlungen?) oder Filter/Teilbetrag ergänzen | Entscheidung nötig | F-451, F-461, F-472 |
| B-405 | Datum in Liste als ISO `YYYY-MM-DD` statt deutsch (`e.entryDate` roh); ebenso Verkaufsbuch | `+page.svelte:327`; `sales-ledger/+page.svelte:107` | UX-Bruch (Monatsüberschrift deutsch, Zeilen ISO) | `Intl.DateTimeFormat('de-DE')`-Helper | im Rewrite beheben | F-454, F-478 |
| B-406 | Liste ohne Kategorie-Spalte/-Filter, ohne Netto/Steuer/Zahlungsart; Kategoriename wird nicht gejoint; Formulare zeigen Netto/Steuer nicht an | `ledger-service.ts:73-80`; `+page.svelte:310-319`; `new/+page.svelte:100-179` | Auswertung nach Kategorie nicht möglich; Nutzer sieht die abgeleitete Steuer nie | Kategorie-Join + Filter; Netto/Steuer-Anzeige im Formular (live berechnet) | im Rewrite beheben | F-454, F-460 |
| B-407 | Keine Kategorienverwaltung; Seed-Namen global unique (gleicher Name für Einnahme und Ausgabe unmöglich); keine Konto-Zuordnung an der Kategorie — DATEV-Konten hängen an Regexen über Namen (z. B. "Werkzeug" → Default 4980 statt 3400; Regex ignoriert `direction`) | `seed-defaults.ts:174-188,222-227`; `schema.ts:991`; `datev-export-service.ts:61-108` | Betrieb kann Kategorien nicht anpassen; Kontenzuordnung intransparent und fehleranfällig | Settings-UI für Kategorien mit Feldern `direction`, `name`, `datev_account`, `datev_contra_account`, `default_tax_rate`; Unique `(direction, name)` | Entscheidung nötig | F-468, F-472 |
| B-408 | Kategorie-Auswahl per nativem `<select>` mit clientseitig geladener Gesamtliste — CONTRIBUTING/CLAUDE.md: "Never `<select>` for relationships" (bei 13 Seed-Kategorien praktisch vertretbar) | `new/+page.svelte:129-135`; `[id]/edit/+page.svelte:170-176` | Regelabweichung; skaliert nicht, wenn Kategorienverwaltung kommt | Bei Kategorienverwaltung → `SearchablePicker`; sonst dokumentierte Ausnahme | Entscheidung nötig | F-459 |
| B-409 | `exportDatevRemote` ist eine `query` (GET, clientseitig cachebar) statt `command`/Download-Endpoint; Ergebnis läuft base64 durch JSON (+33 %) und komplett im Speicher; kein Limit | `datev.remote.ts:19-34`; `+page.svelte:168-170`; `datev-export-service.ts:490-519,569-578` | Bei gleichem Zeitraum in derselben Sitzung ist ein gecachtes, veraltetes Ergebnis möglich ("unklar", ob `.run()` den Cache umgeht — nicht verifiziert); Speicher bei großen Zeiträumen | Export als Command mit Export-Lauf-Datensatz, Streaming-Download über dokumentierte Endpoint-Ausnahme | im Rewrite beheben | F-474 |
| B-410 | Listen-Zustand (Monat, Seite, Suche, Art) nicht in der URL — Reload/Zurück/Return von Edit landet immer im aktuellen Monat, Seite 1 | `+page.svelte:37-50,98-105`; Formulare `goto('/ledger')` | Nutzer verliert Kontext nach jeder Bearbeitung eines älteren Monats | `?month=YYYY-MM&page=&q=&direction=` Deep-Links; Return-URL aus Formularen | im Rewrite beheben | F-448, F-457, F-464 |
| B-411 | `direction`, `payment_status`, `source` als `varchar` ohne Enum/CHECK; `recurring_template_id` ohne FK | `schema.ts:990,1000,1015,1023-1025` | Keine DB-Integrität, beliebige Werte per Service möglich | `pgEnum`/CHECK-Constraints | im Rewrite beheben | F-480 |
| B-412 | Rückgabetyp von `listLedgerEntries` deklariert `ListResult<LedgerEntry>` ohne `incomeSum`/`expenseSum`; Seite und Tests casten (`as unknown as {...}`) | `ledger-service.ts:46,93-96`; `+page.svelte:122-127`; `ledger-service.test.ts:136-138` | Typ-Hack, Fehleranfällig | Eigener Rückgabetyp `LedgerListResult` | im Rewrite beheben | F-451 |
| B-413 | Suche per ILIKE `%q%` ohne Trigram-Index; vier Roundtrips pro Listenaufruf | `ledger-service.ts:51-59,73-90` | Bei großem Bestand langsam; für Kleinbetrieb unkritisch | `pg_trgm`-Index oder `to_tsvector`; Summen in einer Query per `FILTER` | bewusst später | F-449, F-451 |
| B-414 | CP1252-Konvertierung ersetzt nicht abbildbare Zeichen stumm durch `?` (z. B. Emoji, "ł"); `createdAt` im EXTF-Header in UTC statt lokaler Zeit; "exported by" fix "TwinCarsManager" | `datev-export-service.ts:434-450,299-303,339` | Kosmetisch; Beschreibungen mit Sonderzeichen werden entstellt | Hinweis im UI oder Vorab-Prüfung; lokale Zeit | bewusst später | F-473, F-470 |
| B-415 | Testlücken: keine Tests für `ledger.remote.ts` (Guards, Netto/Steuer-Ableitung, Defaults), `datev.remote.ts`, Listen-Seite, Read-only-Fall, Kategorien-Seed, E2E Erfolgspfade und DATEV-Download; `docs/modules/sales-ledger.md:21` behauptet Abdeckung via `document-service.test.ts`, die es nicht gibt | §8; `docs/modules/sales-ledger.md:21` | Regressionen unbemerkt (Memory: Testrigor ist Pflicht) | Testplan für Rewrite ableiten | im Rewrite beheben | alle |
| B-416 | Doku-Konflikte: `docs/modules/ledger.md:9-10` nennt "recurring templates" als Zweck; `docs/integrations/datev.md:13` nennt Signatur `exportDatevCsv(from, to, ...)` (tatsächlich ein Objekt); `sales-ledger.md:20` sagt "Storno rows" inkludiert — richtig, aber auch `created`/`cancelled` sind enthalten | siehe Fundstellen | Fehlleitung beim Rewrite | Doku nach Ist-Stand korrigieren | bewusst später | F-478, F-480 |
| B-417 | Verkaufsbuch (Abgrenzung) ohne Pagination — lädt bei "Alle" sämtliche Rechnungen und summiert in JS; Summen enthalten Entwürfe (`created`) und stornierte Originale (positiv) plus Storno (negativ) — Entwürfe zählen als Umsatz; CONTRIBUTING-Abweichung (Listen ohne Pagination) | `sales-ledger.remote.ts:59-94`; `sales-ledger/+page.svelte` | Falsche Umsatzsummen; Performance | Statusfilter (nur ausgestellte Rechnungen) + SQL-Aggregation + Pagination oder bewusst als Auswertung deklarieren | im Rewrite beheben | F-478 |
| B-418 | Ledger-Storno-Rows im DATEV werden mit `abs(amount)` und `S` gebucht, Ledger-Rows mit negativem `amount_gross` (API-Pfad, siehe B-395) ebenfalls nur `abs` — Vorzeichenverlust ohne S/H-Anpassung | `datev-export-service.ts:119-124,555-563` | Negative Ledger-Buchung würde als positiver Aufwand exportiert | Negativbeträge serverseitig verbieten (B-395) oder S/H invertieren | im Rewrite beheben | F-472 |

## 11. Offene Fragen an den Architekten
1. **Zielbild Kassenbuch vs. Rechnungswesen:** Soll das Kassenbuch künftig automatisch aus Rechnungszahlungen (`source='invoice'`), Fahrzeug-Ankäufen (`source='purchase'`) und Stornos befüllt werden, oder bleibt es ein reines Neben-Buch für Nicht-Rechnungs-Vorgänge? Davon hängt ab, ob der DATEV-Export Rechnungen aus `documents` oder aus `ledger_entries` zieht (Doppelzählung B-388).
2. **Soll- oder Ist-Versteuerung:** Der Export bucht Rechnungen zum Ausstellungsdatum (Soll). Ist der Betrieb Ist-Versteuerer (Zahlungsdatum maßgeblich)? Dann fehlen Zahlungsdaten komplett.
3. **Kontenrahmen und Konten:** SKR03 (aktuell) oder SKR04? Welche Konten nutzt der Steuerberater tatsächlich (Sammel-Debitor 1400 vs. Einzeldebitoren, Erlöskonten je Steuersatz, Kfz-Handel: Differenzbesteuerung §25a UStG bei Gebrauchtwagen!)? Beraternummer/Mandant/abweichendes Wirtschaftsjahr als Einstellung?
4. **GoBD/Festschreibung:** Sollen Buchungen nach DATEV-Export gesperrt werden (Export-Lauf-Protokoll, Änderungen nur per Storno-Buchung, Änderungshistorie mit Benutzer)? Ist Hard-Delete überhaupt zulässig?
5. **Belegverwaltung:** Beleg-Nr. als Pflichtfeld (Fremdbeleg) und/oder eigener Nummernkreis? Beleg-Upload (Scan/PDF) je Buchung? DATEV-Beleglink?
6. **Kategorien:** Verwaltung durch den Betrieb (CRUD in Settings) mit Konto-Zuordnung je Kategorie statt Regex? Standard-Steuersatz je Kategorie nutzen?
7. **Verknüpfungen:** Sollen Lieferant/Kunde/Dokument/Fahrzeug an einer Buchung wählbar sein (Picker)? Wenn nicht, Spalten entfernen.
8. **Wiederkehrende Buchungen:** `recurring_entries` umsetzen (operator-getriggert, ADR-009) oder streichen?
9. **Zahlungsstatus-Semantik:** Was bedeutet `open`/`partial` im Kassenbuch (offene Posten gehören eigentlich ins Rechnungswesen)? Teilbeträge? Filter/Summen nach Status?
10. **Bar-Kasse:** Wird ein echtes Kassenbuch mit Kassenbestand/Tagesabschluss (Bar vs. Bank getrennt, Kassensturz) benötigt? Aktuell gibt es keine Konten-/Kassen-Trennung, nur die Zahlungsart als Label.
11. **Zeitraum-Navigation:** Monatsansicht beibehalten oder freier Zeitraum/Quartal/Jahr + URL-Deep-Links?
12. **Netto-Eingabe:** Nur Brutto (heute) oder wahlweise Netto+USt (Lieferantenrechnungen weisen meist Netto aus)?
13. **Dashboard-KPI:** "Monatsumsatz" aus Rechnungen oder aus dem Kassenbuch?
14. **Export-Zusatzformate:** Neben DATEV Buchungsstapel auch DATEV-Belegbilder/Unternehmen-Online, XLSX/CSV für Excel oder EÜR-Auswertung?

## 12. Gelesene Dateien
| Datei | Zeilen | Umfang |
|---|---|---|
| `src/routes/ledger/+page.svelte` | 456 | vollständig |
| `src/routes/ledger/ledger.remote.ts` | 177 | vollständig |
| `src/routes/ledger/datev.remote.ts` | 34 | vollständig |
| `src/routes/ledger/new/+page.svelte` | 196 | vollständig |
| `src/routes/ledger/new/page.test.ts` | 67 | vollständig |
| `src/routes/ledger/[id]/edit/+page.svelte` | 261 | vollständig |
| `src/routes/ledger/[id]/edit/EditEntryHost.svelte` | 15 | vollständig |
| `src/routes/ledger/[id]/edit/page.test.ts` | 82 | vollständig |
| `src/lib/server/services/ledger-service.ts` | 138 | vollständig |
| `src/lib/server/services/ledger-service.test.ts` | 270 | vollständig |
| `src/lib/server/services/datev-export-service.ts` | 579 | vollständig |
| `src/lib/server/services/datev-export-service.test.ts` | 416 | vollständig |
| `src/lib/server/db/seed-defaults.ts` | 376 | vollständig |
| `src/lib/server/db/schema.ts` | 2025 | Zeilen 540-580, 975-1075, 1965-1980 + grep `ledger`/`paymentMethod` |
| `src/lib/payment-methods.ts` | 20 | vollständig |
| `src/lib/utils/money.ts` | 51 | vollständig |
| `src/lib/utils/money.test.ts` | 74 | vollständig |
| `src/routes/vehicles/PurchaseIntoStockModal.svelte` | 169 | vollständig |
| `src/lib/server/services/vehicle-service.ts` | 858 | grep `ledger`/`purchase` + Zeilen 480-510, 625-700 |
| `src/lib/server/services/document-service.ts` | 688 | grep `ledger`/`paid` + Zeilen 405-545, 660-688 |
| `src/routes/sales-ledger/sales-ledger.remote.ts` | 96 | vollständig |
| `src/routes/sales-ledger/+page.svelte` | 179 | vollständig |
| `docs/modules/ledger.md` | 34 | vollständig |
| `docs/modules/sales-ledger.md` | 21 | vollständig |
| `docs/integrations/datev.md` | 31 | vollständig |
| `src/lib/server/db/validation.ts` | 315 | Zeilen 28, 164-176, 187-191, 299-315 (grep) |
| `src/lib/utils/pdf-download.ts` | 91 | vollständig |
| `src/lib/utils/pdf-download.test.ts` | 208 | Zeilen 150-180 |
| `src/lib/utils/status-labels.ts` | 269 | Zeilen 1-60, 70-111 |
| `src/lib/server/auth-guards.ts` | 60 | Zeilen 1-43 |
| `src/hooks.server.ts` | 470 | Zeilen 286-300, 345-440 + grep FIELD_LABELS-Keys |
| `src/lib/permissions.ts` | 53 | grep `ledger` (Zeile 38) |
| `src/lib/components/layout/navigation.ts` | 247 | Zeilen 144-150, 198-203 |
| `src/lib/components/ui/Toolbar.svelte` | 65 | Zeilen 5-27 |
| `src/lib/server/services/dashboard-service.ts` | 209 | Zeilen 8-23, 40-121 |
| `src/lib/server/services/import-service.ts` | 1591 | Zeilen 6-14, 48-56, 285-312, 385-389 |
| `src/routes/+page.svelte` | 171 | Zeilen 40-75 |
| `src/routes/dashboard.remote.test.ts` | 310 | Zeilen 165-200 |
| `src/lib/server/db/seed-defaults.test.ts` | 136 | grep `categor` (0 Treffer) |
| `e2e/smoke.spec.ts` | 134 | Zeilen 28-134 |
| `e2e/navigation.spec.ts` | 143 | Zeilen 36-56 |
| `e2e/users.spec.ts` | 112 | Zeilen 76-90 |
| `drizzle/0000_lying_tyger_tiger.sql` | 474 | grep `ledger`/`recurring_entries` |
| `README.md` | 618 | Zeilen 400-418 + grep |
| `CONTRIBUTING.md` | 1474 | Zeilen 208-232, 640-680 + grep Pagination |
| `docs/decisions/adr-009-no-in-process-scheduler.md` | — | Kopfzeilen (Titel) |
| `/tmp/…/scratchpad/inv/TEMPLATE.md` | 59 | vollständig |
