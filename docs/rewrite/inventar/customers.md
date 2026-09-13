---
title: Inventar Kunden & Lieferanten (CUST)
teil_von: docs/rewrite/01-inventar.md
stand: Bestand (SvelteKit) vor dem Rewrite
---

> **Detail-Inventar des Bestands.** Erhoben durch vollständiges Lesen der in
> Abschnitt „Gelesene Dateien" genannten Dateien. Die IDs wurden auf die
> globalen IDs aus [01-inventar.md](../01-inventar.md) umgestellt
> (87 IDs). Zurück: [01-inventar.md](../01-inventar.md) ·
> [02-befunde.md](../02-befunde.md)

# Modul: Kunden und Lieferanten   (Kürzel: CUST)

Sprache: Deutsch für Fließtext/Tabellen; Code-Bezeichner, Dateipfade, Tabellen-/Spaltennamen bleiben englisch und exakt wie im Code.
Alles stammt aus dem tatsächlich gelesenen Code (Stand Branch `twincast-production-readiness`, v1.4.0). Bei Unsicherheit steht "unklar" mit Fundstelle.
Fundstellen als `pfad/datei.ts:zeile`.

Kurzcharakteristik: `customers` ist laut `CONTRIBUTING.md:199-200` und `docs/modules/customers.md:9-10` die **kanonische Vorlage** für alle Listen-/Detail-/Formular-Module. Das Muster (queryArgs mit only-set keys, `await untrack(...)`-Seed, `lastResult`-Fallback, `$derived.by`-Re-Call, ein `$effect` für Sync, `pageNum`-Reset, optimistische Single-Flight-Mutationen) ist deshalb in §6/§9 besonders detailliert festgehalten. Lieferanten sind die reduzierte Variante desselben Musters (nur Suche, kein Kind-Filter, kein Archiv-UI, kein Lösch-Guard).

---

## 1. Routen und Seiten

| Route | Datei | Parameter | Guard / Permission | Layout | Datenabhängigkeiten (Remote-Queries, Reihenfolge) | Zweck |
|---|---|---|---|---|---|---|
| `/customers` | `src/routes/customers/+page.svelte` | keine URL-Parameter. Lokaler State: `pageNum` (:19), `q` (:21), `kindFilter` `'all'|'private'|'business'|'ebay'|'archived'` (:27-29). **Kein URL-Sync** (kein `?q=`, `?page=`, `?tab=`) | Session-Gate in `hooks.server.ts`; `listCustomersRemote` → `requirePermission('customers')` (`customers.remote.ts:108`); Sidebar-Eintrag `permission: 'customers'` (`navigation.ts:88-93`) | Root-`+layout.svelte` / `AppShell` | 1. `await untrack(() => listCustomersRemote(queryArgs))` (:45); danach reaktiv `listCustomersRemote(queryArgs).current ?? lastResult` (:62-64) + Sync-`$effect` (:69-73) | Kundenliste mit Suche, Kind-Tabs, Archiv-Tab, Pagination, Inline-Aktionen (Bearbeiten, Löschen, Reaktivieren) |
| `/customers/new` | `src/routes/customers/new/+page.svelte` | keine. Flow-Modus, wenn `creationFlow.top?.entity === 'customer'` (:20) | `createCustomerRemote` → `requirePermission('customers')` (`customers.remote.ts:240`) | AppShell | keine Query; Command `createCustomerRemote(values)` (:24). Redirect nach Save: Flow → `creationFlow.finish({id,label})` → `goto(returnUrl ?? /customers/{id}, {replaceState:true})` (:30-36); sonst `goto(/customers/{id}, {replaceState:true})` (:38). Cancel: Flow → `creationFlow.cancel()` → `goto(returnUrl ?? '/customers')` (:44-51) | Kunde anlegen (Standard oder eBay); Creation-Flow-Blatt |
| `/customers/[id]` | `src/routes/customers/[id]/+page.svelte` | `id` (Route-Param, `untrack(() => page.params.id!)` :40; **keine UUID-Formatprüfung**). Deep-Link `?tab=uebersicht|fahrzeuge|rechnungen|auftraege` über `TabGroup name="customer_detail_tabs"` (:272) | `getCustomerRemote`/`getCustomerRelatedRemote` → `requirePermission('customers')`; `listCustomerWorkOrdersRemote` → `requireAnyPermission('customers','orders')` (`customers.remote.ts:197`) | AppShell; **kein** keyed `[id]/+layout.svelte` (nicht nötig: keine Detail→Detail-Links innerhalb `/customers`) | `Promise.all([getCustomerRemote({id}), getCustomerRelatedRemote({id}), listCustomerWorkOrdersRemote({id,page:1})])` (:47-51); danach reaktiv `getCustomerRemote({id}).current ?? initialCustomer` (:60-62) und `listCustomerWorkOrdersRemote({id,page:ordersPage}).current ?? initialOrders` (:71-75). 404 → root `+error.svelte` | Kundendetail: Übersicht, Fahrzeuge, Rechnungen, Aufträge; Aktionen E-Mail, Archivieren/Reaktivieren, Bearbeiten |
| `/customers/[id]/edit` | `src/routes/customers/[id]/edit/+page.svelte` | `id` (:18) | `getCustomerRemote` + `updateCustomerRemote` → `requirePermission('customers')` | AppShell | `await getCustomerRemote({ id })` (:21); Save → `updateCustomerRemote({id, values})` (:25) → `formDirty.clear()` → Toast "Kunde gespeichert." → `goto(/customers/{id})` (:29-31); Cancel → `goto(/customers/{id})` (:43) | Kunde bearbeiten |
| (kein Route) | `src/routes/customers/[id]/DetailHost.svelte` | – | – | – | Test-Host: wickelt `+page.svelte` in `<svelte:boundary>` mit `pending`-Snippet (:9-15); "Not imported by production code" (:5) | Nur für Vitest/jsdom |
| `/suppliers` | `src/routes/suppliers/+page.svelte` | keine; State `pageNum` (:15), `q` (:17); `archived` fest `'active'` (:25). Kein URL-Sync | `listSuppliersRemote` → `requirePermission('suppliers')` (`suppliers.remote.ts:66`); Sidebar `permission: 'suppliers'` (`navigation.ts:167-172`) | AppShell | `await untrack(() => listSuppliersRemote(queryArgs))` (:29); reaktiv :37-39; `$effect` :44-48 | Lieferantenliste mit Suche, Pagination, Bearbeiten/Löschen |
| `/suppliers/new` | `src/routes/suppliers/new/+page.svelte` | keine | `createSupplierRemote` → `requirePermission('suppliers')` | AppShell | Command `createSupplierRemote(values)` (:13) → `formDirty.clear()` → Toast "Lieferant angelegt." → `goto(/suppliers/{id}, {replaceState:true})` (:17-19); Cancel → `goto('/suppliers')` (:27). **Kein** Creation-Flow-Blatt | Lieferant anlegen |
| `/suppliers/[id]` | `src/routes/suppliers/[id]/+page.svelte` | `id` (:8) | `getSupplierRemote` → `requirePermission('suppliers')` | AppShell | `await getSupplierRemote({ id })` (:11); 404 → `+error.svelte` | Lieferantendetail (Anschrift, Kontakt, Bankdaten) |
| `/suppliers/[id]/edit` | `src/routes/suppliers/[id]/edit/+page.svelte` | `id` (:18) | `getSupplierRemote`, `updateSupplierRemote` → `requirePermission('suppliers')` | AppShell | `await getSupplierRemote({id})` (:21); Save → `updateSupplierRemote` (:25) → clear dirty → Toast "Lieferant gespeichert." → `goto(/suppliers/{id})` (:29-31) | Lieferant bearbeiten |

Hinweis `PageHeader`: Die Prop `subtitle` wird "accepted for backwards compatibility but no longer rendered" (`src/lib/components/layout/PageHeader.svelte:17-18`). `customers/new` (:54-57), `customers/[id]/edit` (:38), `suppliers/new` (:26), `suppliers/[id]/edit` (:38) übergeben trotzdem Untertitel, die nie erscheinen (siehe B-193).

---

## 2. Remote Functions und Endpoints

Alle in `src/routes/customers/customers.remote.ts`, `src/routes/suppliers/suppliers.remote.ts` und `src/routes/pickers.remote.ts`. Keine HTTP-Endpoints in diesem Modul (die `/api/public/*`-Endpoints berühren `customers` nur über `customer_inquiries`, außerhalb dieses Moduls).

### 2.1 Kunden

- **listCustomersRemote** — query — `customers.remote.ts:107`
  - Guard: `requirePermission('customers')` (:108)
  - Argumente (`listSchema` :84-91):
    | Feld | Typ | Regel | Pflicht |
    |---|---|---|---|
    | `page` | `number()` | **keine** Untergrenze (kein `minValue(1)`; `listParamsSchema` aus `validation.ts:288-297` mit Bounds wird NICHT genutzt) | Pflicht |
    | `size` | `picklist([10,25,50,100])` | ohne deutsche Meldung | Pflicht (Seite sendet immer 25) |
    | `q` | `optional(pipe(string(), trim(), maxLength(200)))` | maxLength ohne deutsche Meldung | optional |
    | `sort` | `optional(pipe(string(), trim(), maxLength(30)))` | Whitelist nur im Service (`sortableMap`), unbekannte Werte → Default | optional (Seite sendet nie) |
    | `kind` | `optional(picklist(['all','private','business','ebay']))` | Default im Handler `'all'` (:114) | optional |
    | `archived` | `optional(picklist(['active','archived']))` | `'archived'` → `archived: true`, sonst `false` (:115) | optional |
  - Rückgabe: `ListResult<Customer>` = `{ items: Customer[] (vollständige Zeilen inkl. bankIban/bankBic/vatId/notes/birthday), total, page, size, pageCount }` (`customer-service.ts:111-117`)
  - Fehlerfälle: Valibot → `handleValidationError` ("Ungültige Eingabe für „…“: …"); `page <= 0` → negativer OFFSET → Postgres-Fehler → 500 "Ein interner Fehler ist aufgetreten." (siehe B-156)
  - Nebenwirkungen: keine. Transaktion: nein (zwei parallele SELECTs).

- **getCustomerRemote** — query — `customers.remote.ts:125`
  - Guard: `requirePermission('customers')` (:128)
  - Argumente: `{ id: idSchema }` (`validation.ts:28`: `string`, `minLength(1)`, `maxLength(64)`, `trim` — **keine UUID-Prüfung**)
  - Rückgabe: vollständige `Customer`-Zeile
  - Fehler: `error(404, 'Kunde nicht gefunden.')` (:130); ungültige UUID-Syntax → Postgres-Fehler → 500 (B-155)
  - Nebenwirkungen: keine; Transaktion: nein.

- **getCustomerRelatedRemote** — query — `customers.remote.ts:143`
  - Guard: `requirePermission('customers')` (:146)
  - Argumente: `{ id: idSchema }`
  - Implementierung **direkt per Drizzle in der Remote-Schicht** (:147-177), nicht im Service:
    - `vehicles`: `id, make, model, licensePlate (latestPlateSubquery), firstRegistration, mileageKm, nextHu, archived` WHERE `vehicles.customerId = id` ORDER BY `createdAt DESC`, **ohne LIMIT**, archivierte Fahrzeuge eingeschlossen (:149-163)
    - `documents`: `id, documentNumber, type, status, issueDate, dueDate, grossTotal` WHERE `customerId = id AND type = 'invoice'` ORDER BY `issueDate DESC`, **ohne LIMIT** (:164-177)
  - Rückgabe: `{ vehicles: [...], invoices: [...] }`
  - Fehler: keine kuratierten; unbekannte id liefert leere Arrays (kein 404)
  - Nebenwirkungen: keine; Transaktion: nein (`Promise.all`).

- **listCustomerWorkOrdersRemote** — query — `customers.remote.ts:194`
  - Guard: `requireAnyPermission('customers', 'orders')` (:197) — Werkstatt (nur `orders`) darf die Auftragshistorie eines Kunden lesen
  - Argumente: `{ id: idSchema, page: number() }` (kein `minValue`)
  - Delegiert an `listWorkOrders({ page, size: 25, customerId: id })` (`work-order-service.ts:228-234`, Filter :260)
  - Rückgabe: `ListResult<WorkOrderListRow>` (`WorkOrder & { customerLabel, vehiclePlate, assigneeNames }`, `work-order-service.ts:74-78`)
  - Nebenwirkungen: keine.

- **countCustomersRemote** — query (ohne Argumente) — `customers.remote.ts:209`
  - Guard: `requirePermission('customers')` (:210)
  - Rückgabe: `number` = aktive (nicht archivierte) Kunden (`customer-service.ts:240-246`)
  - Konsumenten: **keine** außerhalb der Datei (grep über `src/` ohne Treffer in `dashboard.remote.ts`); wird nur in `refreshListsAndCount` (:219-224) refreshed → B-173.

- **createCustomerRemote** — command — `customers.remote.ts:237`
  - Guard: `requirePermission('customers')` (:240)
  - Payload `customerInputSchema` (:53-78) — **alle Felder optional**, keine Geschäftsregel auf dem Server (die "Firma oder Nachname"-Regel existiert nur clientseitig, `CustomerForm.svelte:111-115`; Kommentar :50-52 behauptet fälschlich "the service layer enforces business rules"):
    | Feld | Schema | Deutsche Meldung |
    |---|---|---|
    | `company` | `optional(pipe(string(), trim(), maxLength(200)))` | **keine** |
    | `salutation` | `optional(pipe(string(), trim(), maxLength(30)))` | keine |
    | `firstName`, `lastName` | `optional(pipe(string(), trim(), maxLength(100)))` | keine |
    | `street` | `optional(addressLineSchema)` (max 200) | "Die Anschrift darf maximal 200 Zeichen lang sein." (`validation.ts:43-47`) |
    | `zip` | `optional(zipSchema)` (max 10, kein Format) | "Die PLZ darf maximal 10 Zeichen lang sein." (:49-53) |
    | `city` | `optional(citySchema)` (max 150) | "Der Ort darf maximal 150 Zeichen lang sein." (:55-59) |
    | `country` | `optional(pipe(string(), trim(), maxLength(100)))` | keine; Formular sendet nie → DB-Default `'Deutschland'` (`schema.ts:180`) |
    | `phone`, `mobile`, `fax` | `optional(phoneSchema)` (max 30, kein Format) | "Die Telefonnummer darf maximal 30 Zeichen lang sein." (:61-65) |
    | `email` | `optionalEmailSchema` (max 254; leer erlaubt; Regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`) | "Die E-Mail darf maximal 254 Zeichen lang sein." / "Bitte geben Sie eine gültige E-Mail-Adresse ein." (:74-84) |
    | `website` | `optional(urlSchema)` (max 2048, kein URL-Format) | "Die URL darf maximal 2048 Zeichen lang sein." (:86-90) |
    | `notes` | `optional(notesSchema)` (max 2000) | "Die Notiz darf maximal 2000 Zeichen lang sein." (:123-127) |
    | `paymentTermDays` | `optional(number())` | keine; **kein Formularfeld** |
    | `vatId` | `optional(pipe(string(), trim(), maxLength(30)))` | keine; kein Formularfeld |
    | `bankIban` | `optional(ibanSchema)` (normalisiert, mod-97) | "Die IBAN darf maximal 34 Zeichen lang sein." / "Bitte geben Sie eine gültige IBAN ein." (:97-106); kein Formularfeld |
    | `bankBic` | `optional(bicSchema)` (8/11 Zeichen) | "Der BIC darf maximal 11 Zeichen lang sein." / "Bitte geben Sie einen gültigen BIC ein (8 oder 11 Zeichen)." (:112-121); kein Formularfeld |
    | `bankName` | `optional(pipe(string(), trim(), maxLength(100)))` | keine; kein Formularfeld |
    | `customerNumber` | `optional(pipe(string(), trim(), maxLength(50)))` | keine; **Client kann Nummer frei setzen** (B-157) |
    | `kind` | `optional(picklist(['regular','ebay']))` | keine; DB-Default `'regular'` |
    | `ebayHandle` | `optional(pipe(string(), trim(), maxLength(100)))` | keine; Server erzwingt für `kind='ebay'` **nichts** (minLength 3 nur clientseitig) |
    | `wantsBroadcast`, `wantsTireReminders` | `optional(boolean())` | keine; DB-Default `false` |
  - Rückgabe: erzeugte `Customer`-Zeile (`createCustomer` :241)
  - Fehler: Valibot; Unique-Verletzung `customers_customer_number_idx` bei mitgeschickter Nummer → 500 unkuratiert
  - Nebenwirkungen: `nextCustomerNumber()` = `allocateNumber('customer')` (Nummernkreis, Default-Template `'{N}'`, `number-range-service.ts:53`); `refreshListsAndCount()` = `countCustomersRemote().refresh()` + `requested(listCustomersRemote, 4).refreshAll()` (:219-224)
  - Transaktion: **nein** (Nummer wird vor dem Insert verbraucht, `customer-service.ts:135-139`).

- **updateCustomerRemote** — command — `customers.remote.ts:257`
  - Guard: `requirePermission('customers')` (:260)
  - Payload: `{ id: idSchema, values: customerInputSchema }`
  - Rückgabe: `updateCustomer(id, values)` → aktualisierte Zeile **oder `undefined`** bei unbekannter id (kein 404, `customer-service.ts:150-155`)
  - Nebenwirkungen: `getCustomerRemote({ id }).refresh()` + `refreshListsAndCount()` (:262-265)
  - Semantik-Falle: `set({...values})` — Drizzle `mapUpdateSet` filtert `undefined`-Werte (`node_modules/drizzle-orm/utils.js:84`), d. h. nicht mitgesendete/leere Felder bleiben **unverändert** (B-153).
  - Transaktion: nein.

- **setCustomerArchivedRemote** — command — `customers.remote.ts:283`
  - Guard: `requirePermission('customers')` (:286)
  - Payload: `{ id: idSchema, archived: boolean() }`
  - Rückgabe: aktualisierte Zeile; Fehler `error(404, 'Kunde nicht gefunden.')` (`customer-service.ts:174`)
  - Nebenwirkungen: `getCustomerRemote({id}).refresh()` + `refreshListsAndCount()` (:288-291); Transaktion: nein.

- **deleteCustomerRemote** — command — `customers.remote.ts:306`
  - Guard: `requirePermission('customers')` (:309)
  - Payload: `{ id: idSchema }`
  - Rückgabe: `void`
  - Fehler: `error(409, 'Es sind noch <n> Fahrzeug(e), <n> Beleg(e), <n> Reifeneinlagerung(en) mit diesem Kunden verknüpft. Bitte entfernen Sie zuerst die Verknüpfungen oder archivieren Sie den Kunden.')` (`customer-service.ts:217-220`); `vehicle_sales.customer_id` (RESTRICT) → unkuratierter 500 (B-159)
  - Nebenwirkungen: `refreshListsAndCount()` (:311); Transaktion: **nein** (Zählen und Löschen getrennt).

- **sendAdHocCustomerEmailRemote** — command — `customers.remote.ts:370`
  - Guard: `requirePermission('customers')` (:373)
  - Payload `adHocEmailSchema` (:344-359):
    | Feld | Regel | Meldung |
    |---|---|---|
    | `customerId` | `idSchema` | – |
    | `subject` | `string`, trim, `minLength(1)`, `maxLength(200)` | "Bitte einen Betreff eingeben." / "Der Betreff darf nicht leer sein." / "Der Betreff darf maximal 200 Zeichen lang sein." |
    | `body` | `string`, `minLength(1)`, `maxLength(50_000)` (kein trim) | "Bitte einen Nachrichtentext eingeben." / "Die Nachricht darf nicht leer sein." / "Die Nachricht darf maximal 50.000 Zeichen lang sein." |
    | `asHtml` | `optional(boolean())` | – |
    | `attachments[]` | `filename` 1..255 ("Bitte einen Dateinamen angeben." / "Dateiname darf nicht leer sein." / "Dateiname darf maximal 255 Zeichen lang sein."), `mime` max 100 ("MIME-Typ darf maximal 100 Zeichen lang sein."; **keine Whitelist**), `base64Data` 1..14_000_000 ("Anhang-Daten fehlen." / "Anhang-Daten dürfen nicht leer sein." / "Der Anhang ist zu groß (maximal 10 MB pro Datei).") (:320-342). Kein Gesamtlimit, keine Anzahlgrenze | – |
  - Rückgabe: `{ messageId: string | null }`
  - Fehler: `error(400, 'E-Mail konnte nicht versendet werden: ' + send.error)` — `send.error` ist die **rohe nodemailer/SMTP-Meldung** (:375-377, `mail-service.ts:447-453`) → B-161; unbekannter Kunde/fehlende E-Mail werfen im Service ein plain `Error` (`mail-service.ts:390-395`) → 500 generisch (B-162)
  - Nebenwirkungen: `sent_messages`-Zeile (`documentType='mailing'`, `documentId=null`, `status` pending → sent/failed, `attachmentMeta` `{name,size}[]`, `bodyText` = Plaintext bzw. `htmlToPlainText(body)`) (`mail-service.ts:414-453`); SMTP-Versand über `buildTransport()` mit `from`/`replyTo` aus `smtp_settings` (:408-441); bei `asHtml` `html` + abgeleiteter `text` (:405-406). **Kein** `refreshAll`. Transaktion: nein.

### 2.2 Lieferanten (`src/routes/suppliers/suppliers.remote.ts`)

- **listSuppliersRemote** — query — :65
  - Guard: `requirePermission('suppliers')` (:66)
  - Argumente (`listSchema` :52-57): `page: number()` (ohne Untergrenze), `size: picklist([10,25,50,100])`, `q?` (trim, max 200, ohne Meldung), `archived?: picklist(['active','archived','all'])` → `true|false|undefined` (:67-72; `'all'`/fehlend = alle)
  - Rückgabe: `ListResult<Supplier>` (vollständige Zeilen inkl. `iban`/`bic`)
  - Nebenwirkungen: keine.

- **getSupplierRemote** — query — :82 — `{ id: idSchema }` — `error(404, 'Lieferant nicht gefunden.')` (:87).

- **createSupplierRemote** — command — :101
  - Guard: `requirePermission('suppliers')` (:102)
  - Payload `supplierInputSchema` (:34-50): `name: pipe(string(), trim(), maxLength(200))` — **Pflicht auf Typebene, aber ohne `minLength`** (leerer Name serverseitig gültig, B-178); `customerNumberAtSupplier?` (max 50), `contactPerson?` (max 100), `street?` (`addressLineSchema`), `zip?` (`zipSchema`), `city?` (`citySchema`), `country?` (max 100), `phone?`/`fax?` (`phoneSchema`), `email` (`optionalEmailSchema`), `website?` (`urlSchema`), `bankName?` (max 100), `iban?` (`ibanSchema`, mod-97), `bic?` (`bicSchema`), `notes?` (`notesSchema`). Meldungen nur bei den geteilten Schemas.
  - Rückgabe: erzeugte Zeile; Nebenwirkung `requested(listSuppliersRemote, 4).refreshAll()` (:106). Kein Nummernkreis (Lieferanten haben nur `legacySupplierNumber`).

- **updateSupplierRemote** — command — :117 — `{ id, values: supplierInputSchema }` — `getSupplierRemote({id}).refresh()` + `requested(listSuppliersRemote,4).refreshAll()` (:122-125); gleiche `undefined`-Falle wie beim Kunden; `undefined` statt 404 bei unbekannter id.

- **deleteSupplierRemote** — command — :136 — `{ id }` — **ohne Guard** (`supplier-service.ts:71-73`), `refreshAll` (:140).

### 2.3 Picker (`src/routes/pickers.remote.ts`)

- **pickCustomersRemote** — query — :100
  - Guard: `requirePermission('customers')` (:103)
  - Argumente `pickerSchema` (:49-53): `q?` (trim, max 200), `page: number()`, `size: picklist([10,25,50,100])`
  - Filter: `customers.archived = false` (:105) + ILIKE `%q%` über `company, lastName, firstName, customerNumber, city, phone, mobile, email` (:109-118) — **ohne `ebayHandle`, `street`, `zip`**
  - Sortierung: `lastName ASC, company ASC` (:134)
  - Rückgabe: `{ items: {id, label}[], total, page, size, pageCount }`, Label = `customerPickerLabel` = `company || "first last" || customerNumber` + ` · city` (`picker-labels.ts:37-48`)
  - Konsumenten: `src/routes/vehicles/VehicleForm.svelte:363`, `src/routes/hours/HoursForm.svelte`, `src/lib/components/ui/CustomerVehiclePicker.svelte:90-94`.

- **pickCustomerVehiclesRemote** — query — :225 (gehört fachlich zu Fahrzeuge, wird aber vom kombinierten Kunde/Fahrzeug-Picker genutzt)
  - Guard: `requirePermission('vehicles')` (:228) — ein Nutzer mit nur `customers`-Recht kann den kombinierten Picker nicht vollständig nutzen (unklar, ob relevant: Konsumenten sind Belege/Aufträge/Kalender/Reifenlager, nicht das Kundenmodul)
  - Argumente `customerVehiclePickerSchema` (:74-79): zusätzlich `customerId?` (max 64)
  - Sucht Kennzeichen-Versionen separat (:234-238), dann `vin, make, model, hsn, tsn, customers.lastName, customers.company` (:239-247); liefert `customerId` + `customerLabel` (Halter) je Treffer (:282-298).

- **pickSuppliersRemote** — query — :517
  - Guard: `requirePermission('suppliers')` (:520)
  - Filter `archived = false` + ILIKE `name, city, contactPerson, email` (:522-533); Sortierung `name ASC` (:544); Label `` `${name}${city ? ' · ' + city : ''}` `` (:551)
  - Konsumenten: **keine** (grep über `src/` ohne Treffer außerhalb `pickers.remote.ts`; `src/routes/ledger` verwendet `supplierId` nicht) → B-180.

---

## 3. Services (Server-Layer)

### 3.1 `src/lib/server/services/customer-service.ts` (262 Zeilen)

| Funktion | Signatur | Beschreibung | DB-Zugriffe | Tx | Fehler | Performance |
|---|---|---|---|---|---|---|
| `listCustomers` (:45) | `(params: ListParams & { kind?: CustomerKindFilter; archived?: boolean }) => Promise<ListResult<Customer>>` | Liste mit Pagination, Suche, Kind-Filter, Archiv-Sicht | `customers`: `SELECT *` + `SELECT count(*)` parallel (:99-108). Filter: immer `archived = <bool>` (:51); `q` → `OR(ILIKE)` über `customerNumber, lastName, firstName, company, city, zip, street, phone, mobile, email, ebayHandle` mit `%q%` (:52-68); nur wenn `!archived`: `kind='ebay'` bei `'ebay'`, sonst `kind='regular'` + `'business'` → `company IS NOT NULL`, `'private'` → `company IS NULL` (:70-81). Sortierung `sortableMap` (`customerNumber`, `lastName`, `city`, `createdAt`, jeweils `-` für DESC), Default `-createdAt` (:84-97). `LIMIT size OFFSET (page-1)*size` (:49,105-106) | nein | keine (Postgres-Fehler bei negativem Offset → 500) | Führendes Wildcard → keine Nutzung der btree-Indizes `customers_last_name_idx`/`_company_idx`/`_zip_idx` (`schema.ts:228-234`); kein `pg_trgm` (grep `drizzle/*.sql` ohne Treffer); `%`/`_` im Suchbegriff nicht escaped. Bei ~300 Kunden (e2e-Fixture) unkritisch. `pageCount = max(1, ceil(total/size))` (:116) |
| `nextCustomerNumber` (:125) | `() => Promise<string>` | Nächste Kundennummer | `allocateNumber('customer')` (`number-range-service.ts:102-122`): atomarer `UPDATE … RETURNING`, bei fehlender Zeile `INSERT … ON CONFLICT DO NOTHING` mit Default-Template `'{N}'` (:53) | intern atomar | `Error` "number range allocation failed" nur bei Race mit TRUNCATE | – |
| `createCustomer` (:132) | `(values: Omit<NewCustomer,'customerNumber'> & { customerNumber?: string }) => Promise<Customer>` | Insert mit auto-Nummer, falls nicht übergeben | `INSERT customers … RETURNING` (:136-139) | **nein** | Unique-Verletzung `customers_customer_number_idx` → unkuratiert | Nummer verbraucht bei fehlgeschlagenem Insert |
| `updateCustomer` (:146) | `(id: string, values: Partial<NewCustomer>) => Promise<Customer>` | Update + `updatedAt = now()` | `UPDATE … RETURNING` (:150-155) | nein | **kein 404** (liefert `undefined`) | `undefined`-Werte werden von Drizzle ignoriert → Feld leeren unmöglich (B-153) |
| `setCustomerArchived` (:165) | `(id, archived: boolean) => Promise<Customer>` | Soft-Delete/Reaktivierung | `UPDATE … SET archived, updatedAt … RETURNING` (:169-173) | nein | `error(404, 'Kunde nicht gefunden.')` (:174) | – |
| `deleteCustomer` (:188) | `(id) => Promise<void>` | Hard-Delete mit Guard | 3 parallele `count(*)`: `vehicles.customerId`, `documents.customerId`, `tireStorage.customerId` (:189-202); dann `DELETE customers` (:222) | **nein** (TOCTOU) | `error(409, 'Es sind noch … mit diesem Kunden verknüpft. Bitte entfernen Sie zuerst die Verknüpfungen oder archivieren Sie den Kunden.')` (:217-220); Pluralisierung `Fahrzeug/e`, `Beleg/e`, `Reifeneinlagerung/en` (:207-212), Reihenfolge Fahrzeuge → Belege → Reifeneinlagerungen, Trenner `, ` | Nicht gezählte FKs siehe B-159 |
| `getCustomer` (:228) | `(id) => Promise<Customer \| null>` | Einzelzeile | `SELECT * … LIMIT 1` (:229-233) | nein | Postgres-Fehler bei Nicht-UUID → 500 | – |
| `countCustomers` (:240) | `() => Promise<number>` | Anzahl aktiver Kunden | `count(*) WHERE archived = false` (:241-244) | nein | – | Index auf `archived` fehlt |
| `listCustomersForBroadcast` (:254) | `() => Promise<Customer[]>` | Alle aktiven Opt-in-Kunden | `SELECT * WHERE archived=false AND wantsBroadcast=true ORDER BY lastName, firstName` (:255-261) | nein | – | **unpaginiert** (bewusst, :251-252); Index `customers_wants_broadcast_idx` vorhanden. Konsumenten: `mail-service.ts:37,495`, `mailings.remote.ts:22,80` |

### 3.2 `src/lib/server/services/supplier-service.ts` (82 Zeilen)

| Funktion | Signatur | Beschreibung | DB-Zugriffe | Tx | Fehler | Performance |
|---|---|---|---|---|---|---|
| `listSuppliers` (:12) | `(params: ListParams & { archived?: boolean }) => Promise<ListResult<Supplier>>` | Liste mit Suche + Archiv-Tri-State | `suppliers`: `SELECT *` + `count(*)` parallel (:34-43); `q` → ILIKE über `name, city, contactPerson, email, phone` (:18-29); `archived` nur wenn boolean (:30-31); `where` `undefined` bei leerem Filter (:32); **Sortierung fest `createdAt DESC`** (:39), `sort`-Param ignoriert | nein | keine | **Keine Indizes** auf `suppliers` (`schema.ts:511-538`, `drizzle/0000` ohne Treffer) |
| `createSupplier` (:54) | `(values: NewSupplier) => Promise<Supplier>` | Insert | `INSERT … RETURNING` | nein | – | – |
| `updateSupplier` (:59) | `(id, values: Partial<NewSupplier>) => Promise<Supplier>` | Update + `updatedAt` | `UPDATE … RETURNING` (:63-68) | nein | kein 404 (`undefined`) | `undefined`-Falle wie Kunde |
| `deleteSupplier` (:71) | `(id) => Promise<void>` | Hard-Delete **ohne Guard** | `DELETE` (:72) | nein | keine | `ledger_entries.supplierId`/`recurring_entries.supplierId` SET NULL (B-176) |
| `getSupplier` (:75) | `(id) => Promise<Supplier \| null>` | Einzelzeile | `SELECT … LIMIT 1` | nein | Nicht-UUID → 500 | – |

### 3.3 Berührte Fremd-Services

- `mail-service.ts:376-455` `sendAdHocCustomerEmail(input) => Promise<SendDocumentResult>`: lädt Kunde (`id, firstName, lastName, company, email`), wirft `Error('Kunde nicht gefunden.')` / `Error('Der Kunde hat keine hinterlegte E-Mail-Adresse.')` (:390-395), dekodiert Anhänge, schreibt `sent_messages` pending, sendet, setzt `sent`/`failed`; gibt `{ok:false,error}` zurück statt zu werfen (:447-454).
- `work-order-service.ts:228` `listWorkOrders({ page, size, q?, status?, customerId?, employeeId? })` — Filter `workOrders.customerId` (:260), Left-Join `customers` für `customerLabel` (:286, :303).
- `search-service.ts:130-169` `searchCustomers(term, limit)`: `archived=false` + ILIKE `company, lastName, firstName, customerNumber, email, phone, mobile`; Sortierung `lastName, company`; `searchSuppliers` (:357-393): `archived=false` + ILIKE `name, legacySupplierNumber, city, email, phone`. Guard in `search.remote.ts:30` `requireUser()`, Sektionen per `hasPermission(perms,'customers'|'suppliers')` gefiltert (:36,41).
- `tire-reminder-service.ts:95-108`: Kandidaten = `archived=false AND wantsTireReminders=true AND email IS NOT NULL AND email <> '' AND id IN (tire_storage mit retrievedAt IS NULL) AND id NOT IN (bereits benachrichtigt)`.
- `import-service.ts:606-640` setzt beim MDB-Import `kind` via `isEbayCustomerName([...])`, `customerNumber = legacyCustomerNumber = legacyNr`, und füllt `birthday`, `vatId`, `bankIban`, `bankBic`, `bankName`, `fax` — Felder, die das Formular nicht zeigt. Lieferanten (:740-757): `legacySupplierNumber`, `name ?? '-'`, `country`, `iban`, `bic`, `bankName`, `customerNumberAtSupplier`; `archived` wird für Lieferanten **nicht** aus dem Import gesetzt.

---

## 4. Komponenten (modul-lokal)

| Komponente | Datei | Zweck | Props (Name: Typ, default) | Events/Callbacks | Snippets/Slots | Interner State | Verwendete Shared-Komponenten |
|---|---|---|---|---|---|---|---|
| `CustomerForm` | `src/routes/customers/CustomerForm.svelte` (549) | Anlegen/Bearbeiten-Formular für Standard- und eBay-Kunden; exportiert `CustomerFormValues` (:118-135) | `initial?: Partial<Customer>` (default `{}`, einmalig per `untrack` gesnapshottet :159), `onSave: (values) => Promise<void> \| void`, `onCancel?: () => void` (:151-157) | `onSave` mit getrimmten Werten (leer → `undefined` via `trimOrUndef` :219-222); eBay-Payload nur `{kind:'ebay', ebayHandle, firstName?, wantsBroadcast, wantsTireReminders}` (:243-249); Regular-Payload 15 Felder (:255-271); `onCancel` auf "Abbrechen" (:534) | keine | `kind` (Default `init.kind ?? 'regular'` :161), 15 Feld-States (:162-176), `errorMsg` (:178), `fv = useFormValidation(() => kind==='ebay' ? ebaySchema : regularSchema, …)` (:186-214); `formDirty.set(true)` bei `oninput`/`onchange` am `<form>` (:216, :284-285), `formDirty.clear()` beim Unmount (:217) | `FormField`, `validationClasses`/`selectValidationClasses`/`textareaValidationClasses` (`form-validation.svelte`), `busy`, `formDirty` |
| `SupplierForm` | `src/routes/suppliers/SupplierForm.svelte` (350) | Lieferantenformular; exportiert `SupplierFormValues` (:70-86) | `initial?: Supplier` (lokaler Typ :46-62), `onSave`, `onCancel?` (:64-68) | `onSave` mit `name` getrimmt (Pflicht), 14 optionale Felder via `u()` (:124-127, :144-160); **`country` Default `'Deutschland'`** (:98) | keine | 15 States (:93-107), `errorMsg` (:109), `fv = useFormValidation(supplierSchema, () => ({ name, email }))` (:117) — nur `name` + `email` clientseitig validiert; Dirty wie CustomerForm (:163-164, :169-170) | `FormField` (nur Firmenname/E-Mail), `busy`, `formDirty` |
| `DetailHost` | `src/routes/customers/[id]/DetailHost.svelte` (15) | Test-Host mit `<svelte:boundary>` + `pending`-Snippet (`data-testid="page-pending"`) | keine | – | – | – | – |
| `CompactCustomerCard` (shared) | `src/lib/components/ui/CompactCustomerCard.svelte` (60) | Read-only Halter-Karte (Kundennr., Name, Telefon, E-Mail, Link "Zum Kunden") | `customerNumber: string`, `company?`, `firstName?`, `lastName?`, `phone?`, `email?` (alle `string \| null`, default `null`), `href: string`, `title?: string` (default `'Kunde'`) (:11-33) | keine | keine | `nameLabel = company \|\| "first last" \|\| customerNumber` (:35-37) | Lucide `User` |
| `CustomerVehiclePicker` (shared) | `src/lib/components/ui/CustomerVehiclePicker.svelte` (209) | Relationsbewusster Doppelpicker Kunde ↔ Fahrzeug: Fahrzeugwahl füllt Halter (:136-152); Kundenwahl filtert Fahrzeuge auf `customerId` (:98-103) und löscht fremdes Fahrzeug (:125-129); Kunde leeren löscht Fahrzeug außer bei `vehicleLocked` (:111-124) | bindable `customerId`, `customerLabel`, `vehicleId`, `vehicleLabel` (default `''`); `customerFieldLabel='Kunde'`, `vehicleFieldLabel='Fahrzeug'`, `customerRequired=false`, `vehicleRequired=false`, `vehicleLocked=false`, `vehicleHint?`, `customerError?: string\|null`, `onChange?`, `onCreateCustomer?`, `onCreateVehicle?`, `disabled=false`, `colSpan?` (:38-88) | `onChange()` nach jeder Änderung; `onCreateCustomer`/`onCreateVehicle` an die Dialog-Header-Buttons "Neuen Kunden anlegen" / "Neues Fahrzeug anlegen" (letzterer nur mit gewähltem Kunden, :155, :203-204) | keine | `lastCustomerId` (:109) | `SearchablePicker` ×2 (Dialogtitel "Kunde wählen" / "Fahrzeug des Kunden wählen" bzw. "Fahrzeug wählen (Kunde wird übernommen)", Placeholder "Kunde suchen" / "Fahrzeug dieses Kunden suchen" / "Fahrzeug oder Halter suchen", `emptyText` mit Hinweis "Zuerst Kunden wählen, um ein neues Fahrzeug anzulegen." :168-205) |

Konsumenten der Shared-Komponenten (grep `src/routes/**/*.svelte`): `CustomerVehiclePicker` → `calendar/CalendarForm.svelte`, `invoices/new/+page.svelte`, `offers/new/+page.svelte`, `orders/WorkOrderForm.svelte`, `tire-storage/TireStorageForm.svelte`; `CompactCustomerCard` → `vehicles/[id]/+page.svelte:475-483` (Halter-Tab).

Shared-Komponenten der Seiten: `PageHeader` (`title`, `back`, `primaryAction {label, href, icon}`, `toolbar`-Snippet), `Toolbar` (`bind:query`, `placeholder`, `onQuery` mit **250 ms Debounce** `Toolbar.svelte:21-27`, `filters`-Snippet), `Pagination` (`page`, `pageCount`, `total`, `onPage`; `size` akzeptiert und ignoriert; Caption "`<total de-DE>` Treffer · Seite X von Y", `aria-label="Seitennavigation"`, Buttons "Erste/Vorherige/Nächste/Letzte Seite", `data-testid="pagination-full|compact"` `Pagination.svelte:31-139`), `EmptyState` (`icon`, `title`, `description`, `action`-Snippet), `ConfirmDialog` (`bind:open`, `title`, `message`, `confirmLabel` default "Bestätigen", `cancelLabel` default "Abbrechen", `variant 'danger'|'primary'`, `onConfirm`, `onClose`; ein rejectendes `onConfirm` hält den Dialog offen `ConfirmDialog.svelte:60-67`), `TabGroup` (`name`, `tabs: TabItem[] {id,label,icon?,badge?}`, `contentClass`, `content(tabId)`-Snippet; `?tab=` per `replaceState` `TabGroup.svelte:125-134`), `EmailComposer` (bindable `subject` maxlength 200, `body` maxlength 50000, `attachments`, `asHtml`; `allowHtml`; `maxBytesPerFile` default 10 MiB mit Toast "„<name>" ist größer als 10 MB." `EmailComposer.svelte:48,74-82`).

---

## 5. Tabellen

Vollständiger Katalog beim Datenmodell-Agenten; hier die fachlich relevanten Spalten.

### `customers` (`src/lib/server/db/schema.ts:167-235`)

| Spalte | Typ | Bemerkung |
|---|---|---|
| `id` | uuid PK default random | |
| `customer_number` | varchar(50) NOT NULL, **unique** (`customers_customer_number_idx` :228) | aus Nummernkreis `customer` (Default `'{N}'`) oder Import |
| `legacy_customer_number` | varchar(50) | Import "Kunden-Nr"; **nirgends im UI** |
| `company`, `salutation`, `first_name`, `last_name` | varchar 200/30/100/100 | `salutation` Formular-Optionen `-`, `Herr`, `Frau`, `Familie` (`CustomerForm.svelte:394-397`) |
| `street`, `zip`, `city`, `country` | varchar 200/10/150/100 | `country` default `'Deutschland'` (:180), kein Formularfeld |
| `phone`, `phone2`, `mobile`, `fax` | varchar(30) | `phone2`, `fax` ohne UI |
| `email` | varchar(254) | |
| `website` | varchar(2048) | |
| `birthday` | date | nur Import, ohne UI |
| `notes` | text | |
| `payment_term_days` | integer | ohne UI (Verwendung außerhalb des Moduls: unklar) |
| `vat_id`, `bank_iban`, `bank_bic`, `bank_name` | varchar 30/34/11/100 | Import + Server-Schema, ohne UI |
| `kind` | varchar(20) NOT NULL default `'regular'` | Werte `'regular' \| 'ebay'` (`CustomerKind` :237); Index `customers_kind_idx` (:232) |
| `ebay_handle` | varchar(100) | nur bei `kind='ebay'` fachlich sinnvoll |
| `wants_broadcast`, `wants_tire_reminders` | boolean NOT NULL default false | Opt-ins; Index `customers_wants_broadcast_idx` (:233) |
| `archived` | boolean NOT NULL default false | Soft-Delete; **kein Index** |
| `created_at`, `updated_at` | timestamptz NOT NULL default now | |

Weitere Indizes: `customers_last_name_idx`, `customers_company_idx`, `customers_zip_idx` (btree, :229-231).

### `suppliers` (`schema.ts:511-538`)

`id` uuid PK; `legacy_supplier_number` varchar(50); `name` varchar(200) NOT NULL; `customer_number_at_supplier` varchar(50); `contact_person` varchar(100); `street`, `zip`, `city`, `country` (kein DB-Default); `phone`, `fax` varchar(30); `email` varchar(254); `website` varchar(2048); `bank_name` varchar(100); `iban` varchar(34); `bic` varchar(11); `notes` text; `archived` boolean NOT NULL default false; `created_at`, `updated_at`. **Keine Indizes.**

### Fremdschlüssel auf `customers.id` (grep `customers.id`)

| Tabelle.Spalte | onDelete | Im Lösch-Guard gezählt? | Fundstelle |
|---|---|---|---|
| `vehicles.customer_id` (Halter; NULL = Bestandsfahrzeug) | set null | ja ("Fahrzeug/e") | `schema.ts:247-249` |
| `vehicles.previous_owner_customer_id` (Vorbesitzer) | set null | **nein** | :255-258 |
| `vehicle_sales.customer_id` NOT NULL | **restrict** | **nein** → 500 | :417-419 |
| `documents.customer_id` | set null | ja ("Beleg/e", alle Typen) | :552-554 |
| `calendar_entries.customer_id` | set null | nein | :957-959 |
| `ledger_entries.customer_id` | set null | nein | :1021-1023 |
| `time_entries.customer_id` | set null | nein | :1143-1145 |
| `work_orders.customer_id` | set null | nein | :1208-1210 |
| `customer_inquiries.customer_id` | set null | nein | :1468-1470 |
| `tire_storage.customer_id` NOT NULL | restrict | ja ("Reifeneinlagerung/en") | :1697-1699 |

### Fremdschlüssel auf `suppliers.id`

`ledger_entries.supplier_id` (set null, :1018-1020), `recurring_entries.supplier_id` (set null, :1047-1049). Kein Guard, keine UI-Verwendung.

### Weitere berührte Tabellen

`sent_messages` (Ad-hoc-Mail-Audit), `smtp_settings` (Absender), `number_ranges` (`kind='customer'`), `vehicle_license_plate_versions` (über `latestPlateSubquery`), `work_orders` (+ Joins) für den Aufträge-Tab.

---

## 6. Flows (durchgängig, Start bis Ende)

### F-Flow 1: Kundenliste durchsuchen, filtern, blättern — `/customers`
- Einstieg: Sidebar "Kunden" (`navigation.ts:89-93`) oder `back="/customers"` vom Detail.
- Muster (kanonisch, `+page.svelte`):
  1. `queryArgs = $derived({ page: pageNum, size, ...(q ? { q } : {}), kind: kindFilter==='archived' ? 'all' : kindFilter, ...(kindFilter==='archived' ? { archived: 'archived' } : {}) })` (:35-41) — only-set keys, damit Cache-Key der Mutation exakt passt.
  2. SSR-Seed `const initial = await untrack(() => listCustomersRemote(queryArgs))` (:45).
  3. `lastResult = $state(initial)` (:49); `result = $derived.by(() => listCustomersRemote(queryArgs).current ?? lastResult)` (:62-64) — Proxy wird bei jeder Auswertung neu geholt, nie memoisiert (Kommentar :51-61 erklärt den Framework-Grund).
  4. `$effect`: `lastResult = query.current` wenn vorhanden; `query.error` → `handleClientError` (:69-73) — Stale-while-revalidate, Tabelle wird nie leer.
  5. Suche: `Toolbar bind:query={q}` mit `onQuery={() => (pageNum = 1)}` (:156-160), Debounce 250 ms im Toolbar. Placeholder "Kunden suchen: Name, Kundennr., Ort, Telefon, eBay-Name ..." (:158).
  6. Kind-Tabs `Alle | Privat | Firma | eBay | Archiv` als `role="tablist" tabs tabs-box` (kein `TabGroup`, §7-konform); `setKind` setzt `pageNum = 1`, no-op bei gleichem Tab (:136-140).
  7. Pagination `onPage={(p) => (pageNum = p)}` (:377-383).
- Tabelle (≥ `lg`): Spalten `Kundennr.` (mono), `Name / Firma` (+ Badge "Archiviert"), `Ort`, `Telefon` — im eBay-Tab stattdessen `eBay-Name`, `eingetragen am` (ISO `yyyy-mm-dd`, :143-148) —, `E-Mail`, `Aktion` (:245-256). Zeile `hover:bg-base-200 cursor-pointer` + `goto(/customers/{id})` (:260-263). Aktionszelle mit `stopPropagation` (:281): Reaktivieren (nur archiviert, :283-292), Bearbeiten-Link (:293-299), Löschen (:300-306).
- Mobil (< `lg`): `<ul>` mit `<a>`-Zeilen (Label, Nummer, `city · phone` bzw. eBay-Handle/Datum) + Aktions-Cluster (:321-376).
- Leerzustand: Archiv-Tab → "Keine archivierten Kunden" / "Archivierte Kunden erscheinen hier und lassen sich jederzeit reaktivieren." (:218-222); sonst "Noch keine Kunden" / "Legen Sie Ihren ersten Kunden an, um loszulegen." + Button "Neuer Kunde" (:224-234). **Auch bei leerer Suche** erscheint "Noch keine Kunden" (kein "Keine Treffer"-Zustand; e2e `customers.spec.ts:305-306` verlässt sich darauf).
- Ladezustand: globaler `busy`-Balken; keine lokale Anzeige.
- Fehlerzustand: `handleClientError(query.error)` → Toast (ohne baseMessage).
- Berechtigungs-Verweigerung: ohne `customers` kein Sidebar-Eintrag; direkter Aufruf → Remote 403 → `+error.svelte`.

### F-Flow 2: Kunde anlegen (Standardkunde) — `/customers/new`
- Einstieg: PageHeader-Primäraktion "Neuer Kunde" (`+page.svelte:153`) oder EmptyState-Button.
- Formular (`CustomerForm.svelte`): Radio "Kundenart" `Standardkunde | eBay-Kunde` (:297-323). Standard-Fieldsets: "Person / Firma" (Firma, Anrede-Select, Vorname, Nachname), "Anschrift" (Straße + Hausnummer, PLZ, Ort), "Kontakt" (Telefon, Mobil, E-Mail `type=email`, Website, Checkboxen "Möchte Rundschreiben / Newsletter erhalten", "Möchte Erinnerung zum Reifenwechsel erhalten"), "Notiz" (Textarea). `maxlength`-Attribute spiegeln die Schemas.
- Validierung (Klick-Zeit, `submit` :224-272): `fv.markAllTouched()`; wenn ungültig → `errorMsg` = `_form`-Regel (Priorität) oder erster Feldfehler oder "Bitte prüfen Sie Ihre Eingaben." → `alert alert-error role="alert"` (:291-295); Feldfehler rot + `FormField error` nur für E-Mail/eBay-Name (andere Felder zeigen nur die rote Rahmung, :335-343, :472-483). Regeln (`regularSchema` :43-116): `company` ≤ 200 ("Die Firma darf maximal 200 Zeichen lang sein."), `firstName`/`lastName` ≤ 100 ("Der Vorname/Nachname darf maximal 100 Zeichen lang sein."), `street` ≤ 200, `zip` ≤ 10, `city` ≤ 150, `phone`/`mobile` ≤ 30 (ohne Meldung), `email` ≤ 254 + Regex ("Bitte eine gültige E-Mail-Adresse eingeben."), `website` ≤ 2048, `notes` ≤ 2000; Formregel `company || lastName || firstName` → "Bitte mindestens Firma oder Nachname angeben." (:111-115). Speichern-Button nur bei `busy.active` disabled (:541).
- Save: `busy.run(() => createCustomerRemote(values))` → `formDirty.clear()` → Toast "Kunde angelegt." → `goto(/customers/{id}, {replaceState:true})` (`new/+page.svelte:22-42`).
- Fehler: `handleClientError(err, 'Kunde konnte nicht angelegt werden')` → Toast "Kunde konnte nicht angelegt werden: <kuratiert>"; Formular bleibt dirty.
- Abbruch: "Abbrechen" → `goto('/customers')`; bei dirty öffnet AppShell `ConfirmDialog` "Ungespeicherte Änderungen" / "Es gibt ungespeicherte Änderungen. Sollen sie verworfen werden?" mit "Verwerfen"/"Bleiben" (`AppShell.svelte:500-506`), `beforeunload` bei Reload/Tab-Close.

### F-Flow 3: Kunde anlegen (eBay-Kunde)
- Radio "eBay-Kunde" blendet alle Standard-Fieldsets aus; Fieldset "eBay-Daten": `eBay-Name` (Pflicht, `required`-Marker), `Name (optional)` (schreibt in `firstName`), beide Opt-in-Checkboxen (:325-372).
- Regeln (`ebaySchema` :24-41): `ebayHandle` 3..100 ("Bitte einen eBay-Namen eingeben." / "Bitte einen eBay-Namen mit 3 bis 100 Zeichen angeben."), `firstName` ≤ 100 ("Der Name darf maximal 100 Zeichen lang sein.").
- Payload nur `{kind:'ebay', ebayHandle, firstName?, wantsBroadcast, wantsTireReminders}` (:243-249); Anschrift/Kontakt werden nicht gesendet. Beim **Bearbeiten** eines Standardkunden zu eBay bleiben die alten Felder in der DB (B-154).

### F-Flow 4: Kunde aus einem Picker heraus anlegen (Creation-Flow-Blatt)
- Einstieg: "Neuen Kunden anlegen" im Header eines Kunden-Pickers (z. B. `VehicleForm.svelte:246-266`, `CustomerVehiclePicker.svelte:176-178`); Host ruft `creationFlow.start({ entity:'customer', returnUrl, originField, draft, createdAt })` (`creation-flow.svelte.ts:121-124`) und navigiert nach `/customers/new`.
- `/customers/new` erkennt `creationFlow.top?.entity === 'customer'` (:20) und zeigt `alert alert-info` "Dieser Kunde wird nach dem Speichern automatisch im vorherigen Formular ausgewählt." (:59-67).
- Save: `creationFlow.finish({ id, label: customerPickerLabel(created) })` → `goto(returnUrl, {replaceState:true})` (:30-36); Host konsumiert `pendingReturnFor(currentUrl())` genau einmal (`creation-flow.svelte.ts:149-155`), restauriert Draft, selektiert den Kunden.
- Abbruch: `creationFlow.cancel()` → `goto(returnUrl)`; Host restauriert nur den Draft (:44-49).
- Stack/`pending` in `sessionStorage` `twincars.creation-flow`, Verfall nach 1 h (:76-79, :186-203). Zyklusschutz `activeEntities()` liegt beim Host (:161-163).

### F-Flow 5: Kunde bearbeiten — `/customers/[id]/edit`
- Einstieg: Stift-Icon in der Liste (`aria-label="Bearbeiten"`) oder PageHeader "Bearbeiten" im Detail (`[id]/+page.svelte:226-230`).
- Formular mit `initial={customer}` (Snapshot); Kind-Wechsel möglich.
- Save → `updateCustomerRemote({id, values})` → `formDirty.clear()` → Toast "Kunde gespeichert." → `goto(/customers/{id})` (`edit/+page.svelte:23-35`). Server refresht `getCustomerRemote({id})` + Listen.
- Fehler: Toast "Kunde konnte nicht gespeichert werden: …".
- Bekannte Grenze: geleerte Felder werden nicht gespeichert (B-153); e2e `customers.spec.ts:176-227` deckt nur das Überschreiben ab.

### F-Flow 6: Kundendetail ansehen — `/customers/[id]`
- Header: Titel = `company || "first last" || ebayHandle || customerNumber` (:113-117), Zurück nach `/customers`, Primäraktion "Bearbeiten".
- Warnbanner bei `archived`: "Dieser Kunde ist archiviert und erscheint nicht mehr in Listen, Suche und Auswahlfeldern." (:233-241).
- Aktionsleiste (:243-270): "E-Mail schreiben" (`disabled={!customer.email}`, Title "E-Mail an diesen Kunden schreiben" / "Keine E-Mail-Adresse hinterlegt"), "Archivieren"/"Reaktivieren" (`disabled={busy.active}`).
- `TabGroup` mit Badges (:91-111): Übersicht, Fahrzeuge (`related.vehicles.length`), Rechnungen (`related.invoices.length`), Aufträge (`orders.total`).
  - **Übersicht** (:274-374): Standardkunde → Karte "Anschrift" (Kundennr., Firma, Name = `salutation first last`, Straße, PLZ / Ort) und Karte "Kontakt" (Telefon, Mobil, E-Mail, Website, Newsletter Ja/Nein, Reifenwechsel-Erinnerung Ja/Nein), Karte "Notiz" nur wenn `notes` (whitespace-pre-line). eBay-Kunde → eine Karte "eBay-Kunde" (Kundennr., eBay-Name, Name, Newsletter, Reifenwechsel-Erinnerung). Fehlende Werte als `-`.
  - **Fahrzeuge** (:375-422): Kopf "Fahrzeuge" + "<n> verknüpfte Fahrzeug(e)."; Leerzustand "Keine Fahrzeuge auf diesen Kunden zugeordnet."; Tabelle Kennzeichen, Fahrzeug (`make model`), Erstzulassung (roh), km-Stand (`toLocaleString('de-DE') + ' km'`), HU bis (roh); Zeilenklick → `/vehicles/{id}`. Archivierte Fahrzeuge werden ohne Kennzeichnung mitgelistet (`archived` kommt mit, wird nicht gerendert).
  - **Rechnungen** (:423-474): Kopf "<n> verknüpfte Rechnung(en)."; Leerzustand "Bisher keine Rechnungen für diesen Kunden."; Spalten Rechnungsnr., Datum (roh ISO), Fällig, Brutto (`formatEuro`), Status-Badge (`documentStatusLabel/Badge`); Klick → `/invoices/{id}`.
  - **Aufträge** (:475-535): Kopf "<n> Eintrag/Einträge"; Leerzustand "Bisher keine Aufträge für diesen Kunden."; Spalten Nummer, Titel, Status-Badge (`workOrderStatusLabel/Badge`), Kennzeichen, Termin (`dd.mm.yyyy[, HH:MM]` via `fmtDate` :77-84); Klick → `/orders/{id}`; `Pagination` mit `ordersPage` (:528-534), Größe 25.
- Nicht vorhanden: Karten für Reifeneinlagerungen, Termine, Anfragen, Zeiteinträge, Buchhaltung, Angebote/KV/AB, Vorbesitzer-Fahrzeuge, Bankdaten/USt-ID/Zahlungsziel; keine Lösch-Aktion; keine Schnellaktionen (siehe B-164, B-167).
- Fehler: `getCustomerRemote` 404 → `+error.svelte` ("Kunde nicht gefunden."); Nicht-UUID → 500-Seite.

### F-Flow 7: Kunde archivieren / reaktivieren (Detail)
- Button → `archiveConfirmOpen = true` → `ConfirmDialog` Titel "Kunde archivieren?" / "Kunde reaktivieren?", Text `Soll der Kunde "<label>" archiviert werden? Er verschwindet aus Listen, Suche und Auswahlfeldern; alle verknüpften Daten bleiben erhalten.` bzw. `Soll der Kunde "<label>" wieder aktiviert werden? Er erscheint danach wieder in Listen, Suche und Auswahlfeldern.`, Buttons "Archivieren"/"Reaktivieren", `variant="primary"` (:540-550).
- `toggleArchived` → `busy.run(() => setCustomerArchivedRemote({id, archived: !customer.archived}))` → Toast "Kunde archiviert." / "Kunde reaktiviert." (:154-169); Seite flippt über den serverseitigen `getCustomerRemote({id}).refresh()` ohne Remount (:53-62).
- Fehler: "Kunde konnte nicht archiviert/reaktiviert werden: …".

### F-Flow 8: Kunde reaktivieren (Archiv-Tab)
- Archiv-Tab → Icon `ArchiveRestore` (`aria-label="Reaktivieren"`) → **ohne Bestätigung** `setCustomerArchivedRemote({id, archived:false}).updates(listCustomersRemote(queryArgs).withOverride(items ohne id, total-1))` (:119-134) → Toast `Kunde „<name>" reaktiviert.`; Zeile verschwindet optimistisch.

### F-Flow 9: Kunde löschen (Liste)
- Papierkorb-Icon (`aria-label="Löschen"`) → `askDelete` → `ConfirmDialog` "Kunde löschen?" / `Soll der Kunde "<name>" wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.` / "Löschen", `variant="danger"` (:388-396).
- `performDelete`: `busy.run(() => deleteCustomerRemote({id}).updates(listCustomersRemote(queryArgs).withOverride(…)))` (:85-106) → Toast `Kunde „<name>" gelöscht.`.
- Guard-Fehler 409 → Override rollt zurück, Toast "Kunde konnte nicht gelöscht werden: Es sind noch 1 Fahrzeug mit diesem Kunden verknüpft. Bitte entfernen Sie zuerst die Verknüpfungen oder archivieren Sie den Kunden." (e2e `customers.spec.ts:259-263`).
- Kein Löschen aus dem Detail; kein Löschen aus dem Archiv-Tab gesondert (Icon ist dort auch vorhanden).

### F-Flow 10: E-Mail an Kunden schreiben (Detail)
- Voraussetzung: `customer.email` gesetzt (sonst Button disabled).
- `openEmailDialog` setzt Betreff/Text/HTML/Anhänge zurück (:171-178); Modal "E-Mail schreiben" mit Zeile "An <name> <email>" (`recipientLabel` :133-143), `EmailComposer allowHtml` (Betreff maxlength 200, Nachricht maxlength 50000, Checkbox HTML-Quelltext, Anhänge ≤ 10 MiB je Datei), Buttons "Abbrechen"/"Senden" (nur `busy.active` disabled), Backdrop-Button "Schließen" (:552-612).
- Klick-Zeit-Validierung in `sendEmail` (:187-200): "Für diesen Kunden ist keine E-Mail-Adresse hinterlegt." (unerreichbar wegen disabled-Button), "Bitte einen Betreff eingeben.", "Bitte einen Nachrichtentext eingeben." als `alert alert-error` im Modal.
- Senden → `sendAdHocCustomerEmailRemote({customerId, subject: trim, body, asHtml, attachments})` → Toast "E-Mail versendet." → Modal zu (:201-219). Fehler → Toast "E-Mail konnte nicht versendet werden: E-Mail konnte nicht versendet werden: <SMTP-Text>" (doppelter Präfix: `baseMessage` :218 + Server-Message :376).

### F-Flow 11: Lieferantenliste — `/suppliers`
- Wie F-Flow 1 ohne Kind-/Archiv-Tabs; `queryArgs = { page, size, ...(q ? {q} : {}), archived: 'active' }` (:21-26); Placeholder "Lieferanten suchen: Firma, Ort, Kontakt ..." (:85). Spalten Firma, Kontakt, Ort, Telefon, E-Mail, Aktion (:110-116); keine Mobil-Kartenliste; Leerzustand "Noch keine Lieferanten" / "Legen Sie Ihren ersten Lieferanten an." + "Neuer Lieferant" (:94-104).
- Löschen: `ConfirmDialog` "Lieferant löschen?" / `Soll der Lieferant "<name>" wirklich gelöscht werden?` / "Löschen" danger (:166-174) → optimistischer Single-Flight (:53-71) → Toast `Lieferant „<name>" gelöscht.`; Fehler `handleClientError(err)` ohne Kontext.

### F-Flow 12: Lieferant anlegen / bearbeiten — `/suppliers/new`, `/suppliers/[id]/edit`
- Fieldsets "Firma" (Firmenname `required`, Kontaktperson, Kundennummer beim Lieferanten), "Anschrift" (Straße + Hausnummer, PLZ, Ort, Land — Default "Deutschland"), "Kontakt" (Telefon, Fax, E-Mail, Website), "Bankdaten" (Bankname, IBAN maxlength 34, BIC maxlength 11), "Notiz" (`SupplierForm.svelte:179-331`).
- Klick-Zeit-Validierung nur `name` ("Bitte einen Firmennamen eingeben." / "Der Firmenname darf maximal 200 Zeichen lang sein.") und `email` ("Die E-Mail darf maximal 254 Zeichen lang sein." / "Bitte eine gültige E-Mail-Adresse eingeben.") (:17-33); IBAN/BIC erst serverseitig → Toast "Ungültige Eingabe für „IBAN“: Bitte geben Sie eine gültige IBAN ein." ohne Feldmarkierung.
- Save → Toast "Lieferant angelegt." / "Lieferant gespeichert." → Detail. Kein Creation-Flow, kein Picker-Rücksprung.

### F-Flow 13: Lieferantendetail — `/suppliers/[id]`
- Titel = `name`, Zurück `/suppliers`, "Bearbeiten". Karten "Anschrift" (Straße, PLZ / Ort, Land), "Kontakt" (Telefon, Fax, E-Mail, Website), "Bankdaten" (Bank, IBAN mono, BIC mono) **nur wenn** `iban || bic || bankName` (:24-78). **Nicht angezeigt**: `contactPerson`, `customerNumberAtSupplier`, `notes`, `legacySupplierNumber` (B-194). Keine Archivieren-/Löschen-Aktion, keine verknüpften Buchungen.

---

## 7. Nebenwirkungen

| Art | Details | Fundstelle |
|---|---|---|
| E-Mail (ad hoc) | Freitext an genau einen Kunden; Absender aus `smtp_settings` (`fromName <fromAddress>`, `replyTo`); Plaintext default, HTML opt-in mit `htmlToPlainText`-Fallback; Anhänge base64 → Buffer; **kein** Unsubscribe-Footer (transaktional, `CONTRIBUTING.md:1437-1438`); Audit `sent_messages` (`documentType='mailing'`, pending → sent/failed, `errorMessage`) | `mail-service.ts:376-455` |
| Upload | Anhänge über `EmailComposer` (`FileReader.readAsDataURL`), Client-Limit 10 MiB je Datei, Server-Limit 14.000.000 Zeichen base64 je Anhang, MIME frei, kein Gesamt-/Anzahl-Limit; nichts wird persistiert außer `attachmentMeta {name,size}` | `EmailComposer.svelte:57-99`, `customers.remote.ts:320-342`, `mail-service.ts:423-426` |
| Nummernkreis | `customer` beim Anlegen ohne mitgegebene Nummer; Default-Template `'{N}'` (Seed außerhalb des Moduls: unklar, `seed-defaults.ts` nicht unter dem erwarteten Pfad gefunden); nach Import Fortführung ab max(legacy)+1 (`business-overview.md:39-40`) | `customer-service.ts:125-127`, `number-range-service.ts:47-58,102-122` |
| Cache-Refresh | Jede Kunden-Mutation: `countCustomersRemote().refresh()` + `requested(listCustomersRemote,4).refreshAll()`; Update/Archiv zusätzlich `getCustomerRemote({id}).refresh()`; Lieferanten analog ohne Count | `customers.remote.ts:219-224,262-265,288-291`, `suppliers.remote.ts:106,122-125,140` |
| Broadcast/Mailings (Fremdmodul) | Opt-in `wantsBroadcast` speist `listCustomersForBroadcast()` (Vorschau + Versand) | `mailings.remote.ts:78-91`, `mail-service.ts:495` |
| Reifenwechsel-Erinnerung (Fremdmodul) | Opt-in `wantsTireReminders` + aktive `tire_storage` + E-Mail | `tire-reminder-service.ts:90-111` |
| Globale Suche | Kunden/Lieferanten-Treffer (archiviert ausgeschlossen), permission-gefiltert | `search-service.ts:130-169,357-393`, `search.remote.ts:30-41` |
| PDFs, Exporte, externe APIs, Webhooks | keine in diesem Modul | – |

---

## 8. Vorhandene Tests

| Testdatei | Art | Was wird abgedeckt |
|---|---|---|
| `src/lib/server/services/customer-service.test.ts` (525) | integration (pg-mem) | create (inkl. Auto-Nummer, eBay, Opt-in), `nextCustomerNumber` (Seed + Template), `listCustomers` (Pagination, Suche über Name/Ort/Nummer/Telefon/PLZ/Mobil/Straße/E-Mail/ebayHandle, kind private/business/ebay/all, Archiv-Sicht über Kinds, Sortierung customerNumber ±/lastName), update, delete (Fahrzeug-/Beleg-Guard 409 — **Reifenlager-Guard nicht getestet**), get, setCustomerArchived (404), listCustomersForBroadcast, countCustomers |
| `src/routes/customers/customers.remote.test.ts` (480) | integration (Remote-Guards) | `sendAdHocCustomerEmailRemote` (401/403/Wildcard/Schema-Rejects/Größencap/400 bei Mail-Fehler), `setCustomerArchivedRemote` (401/403/Roundtrip/404), `listCustomerWorkOrdersRemote` (401/403, customers- und orders-Recht, Shape 25, leer). **Nicht**: list/get/create/update/delete-Remotes, `getCustomerRelatedRemote` |
| `src/routes/customers/CustomerForm.test.ts` (204) | component | Labels, Speichern nie disabled, Firma-oder-Nachname-Regel, E-Mail-Fehler bei Klick + Blur, getrimmter Regular-Payload, Kind-Umschaltung (Felder ein/aus), eBay-Payload, eBay-Handle < 3 Zeichen, Opt-in-Durchreichung + Defaults, onCancel |
| `src/routes/customers/[id]/detail-email.test.ts` (113) | component (DetailHost, gemockte Remotes) | Senden nie disabled, Betreff-/Text-Fehlermeldung im Dialog |
| `src/routes/customers/[id]/detail-tabs.test.ts` (204) | component | vier Tabs + Badges, Panels bleiben gemountet, globale Aktionen außerhalb der Tabs, Aufträge-Tab (Status-Labels, Kennzeichen, Termin-Format, Zeilenklick → `/orders/o1`, Leerzustand) |
| `src/lib/components/ui/CompactCustomerCard.test.ts` (59) | component | Felder + Link, Firma-Priorität, Fallback auf Nummer/`-` |
| `src/lib/components/ui/CustomerVehiclePicker.test.ts` (305) | component | Labels, Fahrzeug → Halter, Kunde filtert Fahrzeuge, Kundenwechsel löscht Fahrzeug, Kunde leeren löscht Fahrzeug, `vehicleLocked`, Create-Buttons nur mit Callbacks, Fahrzeug-Create nur mit Kunde + Hinweistext, `customerError`, `disabled`, Required-Marker + Hint |
| `src/lib/server/services/supplier-service.test.ts` (154) | integration | create, list (Pagination, Suche Name/Ort/Kontakt/E-Mail/Telefon, archived-Filter, leer), update, delete, get |
| `src/routes/suppliers/SupplierForm.test.ts` (187) | component | Labels, Speichern nie disabled, Pflicht-Firmenname (Klick + Blur), E-Mail-Fehler, pristine ohne Fehler, getrimmter Payload + Land-Default, Dirty-Flag bleibt nach Submit, IBAN/BIC-Durchreichung, onCancel, Vorbelegung |
| `e2e/customers.spec.ts` (329) | e2e (Playwright, Fixture-DB ~301 Kunden) | 25/Seite + Caption, Suche nach Seed-Kunde + Zeilenklick, Kind-Tabs (Privat/Firma/eBay-Spalte/Archiv/Alle), Pagination + Reset auf Seite 1 bei Suche, Klick-Zeit-Validierung + Unsaved-Dialog "Verwerfen", Detail-Tabs + `?tab=rechnungen`, Edit mit "Bleiben"/"Verwerfen", Lösch-Guard mit verknüpftem Fahrzeug + Archivieren als Alternative, Create → Archiv → Reaktivieren (Archiv-Tab) → Delete |
| Lieferanten-Remotes, `/suppliers`-Seiten, Lieferanten-e2e | – | **nicht vorhanden** |
| `src/routes/pickers.remote.test.ts` | integration | nicht gelesen (unklar, ob `pickCustomersRemote`/`pickSuppliersRemote` abgedeckt) |

---

## 9. Feature-Matrix

| ID | Feature | Routen | Endpoints/Remotes | Tabellen | Erwartetes Verhalten |
|---|---|---|---|---|---|
| F-178 | Kundenliste (Tabelle, Zeilenklick, Aktionsspalte) | `/customers` | `listCustomersRemote` | `customers` | Spalten Kundennr./Name-Firma/Ort/Telefon/E-Mail/Aktion; Label-Priorität `company > "first last" > ebayHandle > customerNumber`; ganze Zeile klickbar → Detail; Aktionszelle mit `stopPropagation` (Bearbeiten, Löschen, Reaktivieren nur archiviert); Badge "Archiviert" |
| F-179 | Mobile Kartenliste (< `lg`) | `/customers` | – | – | `<a>`-Zeilen mit Label, Nummer, `Ort · Telefon` bzw. eBay-Handle/Datum; Aktionen als Sibling |
| F-180 | Serverseitige Volltextsuche | `/customers` | `listCustomersRemote` (`q`) | `customers` | ILIKE `%q%` über customerNumber, lastName, firstName, company, city, zip, street, phone, mobile, email, ebayHandle; Debounce 250 ms; `pageNum = 1`; `q` nur gesetzt, wenn nicht leer |
| F-181 | Kind-Filter-Tabs Alle/Privat/Firma/eBay | `/customers` | `listCustomersRemote` (`kind`) | `customers.kind`, `customers.company` | `all/private/business` → `kind='regular'`; `business` = `company IS NOT NULL`, `private` = `company IS NULL`; `ebay` = `kind='ebay'` mit Spalten eBay-Name + eingetragen am; Tabwechsel resettet Seite; einfache Filter-Tabs (kein TabGroup) |
| F-182 | Archiv-Tab | `/customers` | `listCustomersRemote` (`archived:'archived'`) | `customers.archived` | Nur archivierte Kunden **aller Kinds** (Kind-Filter ignoriert, `kind:'all'` gesendet); Badge; Inline-Reaktivieren; eigener Leerzustand |
| F-183 | Pagination fix 25 + Stale-while-revalidate | `/customers`, `/suppliers` | list-Remotes | – | `{items,total,page,size,pageCount}`; Caption "N Treffer · Seite X von Y"; `lastResult`-Fallback; keine Größenwahl |
| F-184 | Sortierung | `/customers` | `listCustomersRemote` (`sort`) | – | Server: `customerNumber`, `lastName`, `city`, `createdAt` (±); UI setzt nie `sort` → immer `createdAt DESC` (neueste zuerst) |
| F-185 | Leerzustände Liste | `/customers` | – | – | "Noch keine Kunden" (+ Button) bzw. "Keine archivierten Kunden"; kein separater "Keine Treffer"-Zustand |
| F-186 | Kunde anlegen (Standardkunde) | `/customers/new` | `createCustomerRemote` | `customers`, `number_ranges` | Felder Firma/Anrede/Vorname/Nachname/Straße/PLZ/Ort/Telefon/Mobil/E-Mail/Website/Notiz/2 Opt-ins; Regel "Firma oder Nachname" (client); leere Felder → `undefined`; Nummer automatisch; Toast "Kunde angelegt."; Redirect Detail (replaceState) |
| F-187 | Kunde anlegen (eBay-Kunde) | `/customers/new` | `createCustomerRemote` | `customers` | Radio "eBay-Kunde"; nur eBay-Name (3..100, Pflicht client), Name (optional → `firstName`), Opt-ins; `kind='ebay'` |
| F-188 | Kundennummer aus Nummernkreis | – | `createCustomer` → `allocateNumber('customer')` | `number_ranges` | Atomarer Zähler; fehlende Range wird mit `'{N}'` angelegt; unique Index; Nummer nicht editierbar im UI |
| F-189 | Creation-Flow-Blatt (Rücksprung mit Draft) | `/customers/new` | `createCustomerRemote` | – | Info-Alert im Flow-Modus; `finish({id,label})`/`cancel()` → `returnUrl`; Host restauriert Draft und selektiert Kunden (`customerPickerLabel`) |
| F-190 | Kunde bearbeiten | `/customers/[id]/edit` | `getCustomerRemote`, `updateCustomerRemote` | `customers` | Formular vorbelegt (Snapshot); Kind-Wechsel möglich; Toast "Kunde gespeichert."; Redirect Detail; Server refresht Detail + Listen |
| F-191 | Klick-Zeit-Validierung + Feldfehler | `/customers/new`, `/edit`, Lieferanten | – | – | Speichern nie wegen Eingaben disabled; `alert alert-error` mit Formregel bzw. erstem Feldfehler; rote Felder nach Blur/Submit; `novalidate` |
| F-192 | Unsaved-Changes-Guard | alle Formulare | – | – | `formDirty` bei `oninput`/`onchange`; AppShell-Dialog "Ungespeicherte Änderungen" (Verwerfen/Bleiben) + `beforeunload`; Clear **vor** dem Post-Save-`goto`; Fehlerpfad bleibt dirty |
| F-193 | Detail: Übersicht (Anschrift/Kontakt/Notiz bzw. eBay-Karte) | `/customers/[id]` | `getCustomerRemote` | `customers` | Zwei Karten + bedingte Notiz-Karte; eBay: eine Karte; Opt-ins als Ja/Nein; `-` für leere Werte |
| F-194 | Detail: Tab Fahrzeuge | `/customers/[id]?tab=fahrzeuge` | `getCustomerRelatedRemote` | `vehicles`, `vehicle_license_plate_versions` | Alle Fahrzeuge mit `customerId` (inkl. archivierte, unmarkiert), neueste zuerst, unbegrenzt; Badge = Anzahl; Klick → Fahrzeugdetail; Leerzustand-Text |
| F-195 | Detail: Tab Rechnungen | `?tab=rechnungen` | `getCustomerRelatedRemote` | `documents` | Nur `type='invoice'`, `issueDate DESC`, unbegrenzt; Status-Badges; Klick → `/invoices/{id}` |
| F-196 | Detail: Tab Aufträge (paginiert) | `?tab=auftraege` | `listCustomerWorkOrdersRemote` | `work_orders` (+Joins) | 25/Seite, nur `ordersPage` reaktiv; Badge = `orders.total`; auch mit reinem `orders`-Recht lesbar; Klick → `/orders/{id}` |
| F-197 | `?tab=`-Deep-Links | `/customers/[id]` | – | – | `TabGroup` spiegelt aktiven Tab per `replaceState`; ungültiger Wert → erster Tab |
| F-198 | Kunde archivieren/reaktivieren (Detail) | `/customers/[id]` | `setCustomerArchivedRemote` | `customers.archived` | ConfirmDialog mit kuratierten Texten; Toasts; Warnbanner im archivierten Zustand; Seite flippt ohne Remount |
| F-199 | Kunde reaktivieren (Archiv-Tab, inline) | `/customers` | `setCustomerArchivedRemote` | `customers.archived` | Ohne Bestätigung, optimistisch (Zeile verschwindet), Toast `Kunde „…" reaktiviert.` |
| F-200 | Kunde löschen (Liste) | `/customers` | `deleteCustomerRemote` | `customers` | ConfirmDialog danger; optimistischer Single-Flight; Toast `Kunde „…" gelöscht.`; nur aus der Liste |
| F-201 | Lösch-Guard mit Zählungen | – | `deleteCustomer` | `vehicles`, `documents`, `tire_storage` | 409 "Es sind noch <n Fahrzeug(e)>, <n Beleg(e)>, <n Reifeneinlagerung(en)> mit diesem Kunden verknüpft. Bitte entfernen Sie zuerst die Verknüpfungen oder archivieren Sie den Kunden."; Toast-Präfix "Kunde konnte nicht gelöscht werden" |
| F-202 | E-Mail an Kunden (Composer) | `/customers/[id]` | `sendAdHocCustomerEmailRemote` | `sent_messages`, `smtp_settings` | Button nur mit E-Mail aktiv; Modal mit "An"-Zeile; Betreff/Text Pflicht (Klick-Zeit); HTML opt-in; Anhänge ≤ 10 MiB/Datei; Toast "E-Mail versendet."; Audit-Zeile als `mailing` |
| F-203 | Opt-ins Newsletter / Reifenwechsel-Erinnerung | Formular + Detail | `create/updateCustomerRemote` | `customers.wants_broadcast`, `wants_tire_reminders` | Checkboxen in beiden Kundenarten; Default false; Verwendung durch Mailings bzw. Reifen-Erinnerungsjob (nur mit aktiver Einlagerung + E-Mail) |
| F-204 | Kundenpicker (`SearchablePicker`) | Fremdformulare (Fahrzeug, Stunden) | `pickCustomersRemote` | `customers` | Aktive Kunden; ILIKE über 8 Spalten (ohne eBay-Handle); Sortierung Nachname, Firma; Label `Name · Ort`; "Neu anlegen" via Creation-Flow |
| F-205 | Kombinierter Kunde/Fahrzeug-Picker | Belege, Aufträge, Kalender, Reifenlager | `pickCustomersRemote`, `pickCustomerVehiclesRemote` | `customers`, `vehicles` | Fahrzeug → Halter automatisch; Kunde → Fahrzeugsuche gefiltert, fremdes Fahrzeug gelöscht; `vehicleLocked`; Fahrzeug-Neuanlage nur mit Kunde |
| F-206 | Kompakte Kundenkarte (Halter) | `/vehicles/[id]` | – | – | Kundennr., Name (Firma > Person > Nummer), Telefon, E-Mail, Link "Zum Kunden" |
| F-207 | Kunden in der globalen Suche | AppShell-Suche | `search.remote.ts` | `customers` | Aktive Kunden, ILIKE über 7 Spalten, Sublabel `Nummer · E-Mail · Ort`; nur mit `customers`-Recht |
| F-208 | Kundenzähler | – | `countCustomersRemote` | `customers` | Anzahl aktiver Kunden; wird bei jeder Mutation refreshed; kein UI-Konsument gefunden |
| F-209 | Broadcast-Empfängermenge | Mailings | `listCustomersForBroadcast` | `customers` | Alle aktiven Opt-in-Kunden (auch eBay), sortiert Nachname/Vorname, unpaginiert |
| F-210 | Berechtigung `customers` | alle Kundenrouten | alle Kunden-Remotes | – | Ein Schlüssel für Lesen/Schreiben/Löschen; Aufträge-Tab zusätzlich mit `orders`; Sidebar gefiltert; Wildcard `*` |
| F-211 | Import-Herkunft (Kfz-Kaufmann) | `/settings/import` (Fremdmodul) | – | `customers.legacy_customer_number`, `kind`, Bank-/Steuerfelder | `kind='ebay'` per Namensheuristik einmalig beim Import; Bankdaten/USt-ID/Geburtstag werden importiert, aber nirgends angezeigt |
| F-212 | Lieferantenliste | `/suppliers` | `listSuppliersRemote` | `suppliers` | Spalten Firma/Kontakt/Ort/Telefon/E-Mail/Aktion; Suche ILIKE name/city/contactPerson/email/phone; `createdAt DESC`; nur aktive (`archived:'active'` fest); Zeilenklick; Bearbeiten/Löschen |
| F-213 | Lieferant anlegen | `/suppliers/new` | `createSupplierRemote` | `suppliers` | Firmenname Pflicht (client); Land Default "Deutschland"; IBAN/BIC serverseitig geprüft (mod-97 / 8-11 Zeichen); Toast "Lieferant angelegt."; Redirect Detail |
| F-214 | Lieferant bearbeiten | `/suppliers/[id]/edit` | `getSupplierRemote`, `updateSupplierRemote` | `suppliers` | Vorbelegung; Toast "Lieferant gespeichert." |
| F-215 | Lieferantendetail | `/suppliers/[id]` | `getSupplierRemote` | `suppliers` | Karten Anschrift/Kontakt, Bankdaten nur bei Inhalt; ohne Kontaktperson/Kundennr./Notiz |
| F-216 | Lieferant löschen | `/suppliers` | `deleteSupplierRemote` | `suppliers` | ConfirmDialog; optimistisch; **kein Guard**; verknüpfte Buchungen verlieren `supplierId` (SET NULL) |
| F-217 | Lieferanten-Archiv-Flag (ohne UI) | – | `listSuppliersRemote` (`archived: active\|archived\|all`) | `suppliers.archived` | Service/Remote/Picker/Suche berücksichtigen `archived`; keine Möglichkeit im UI zu archivieren oder Archivierte zu sehen |
| F-218 | Lieferantenpicker | – | `pickSuppliersRemote` | `suppliers` | Aktive, ILIKE name/city/contactPerson/email, `name ASC`, Label `Name · Ort`; **kein Konsument** |
| F-219 | Lieferanten in der globalen Suche | AppShell-Suche | `search.remote.ts` | `suppliers` | Aktive; ILIKE name/legacySupplierNumber/city/email/phone; nur mit `suppliers`-Recht |
| F-220 | Berechtigung `suppliers` | alle Lieferantenrouten | alle Lieferanten-Remotes | – | Ein Schlüssel; Sidebar-Eintrag "Lieferanten" |

---

## 10. Befunde

| ID | Beschreibung | Fundstelle | Auswirkung | Empfehlung | Einordnung | Betroffene Features |
|---|---|---|---|---|---|---|
| B-153 | **Feld leeren beim Bearbeiten wird nicht gespeichert.** Formulare wandeln leere Eingaben in `undefined` (`trimOrUndef`/`u`), Drizzle `mapUpdateSet` filtert `undefined` heraus → `UPDATE` lässt das Feld unverändert. Kein Test deckt das ab (e2e ändert nur Werte). | `CustomerForm.svelte:219-222,255-271`; `SupplierForm.svelte:124-127,144-160`; `customer-service.ts:150-155`; `supplier-service.ts:63-68`; `node_modules/drizzle-orm/utils.js:84` (`value !== void 0`) | Nutzer kann E-Mail, Telefon, Firma, Notiz, IBAN usw. nie wieder entfernen; falsche Daten bleiben dauerhaft | Leer = `null` persistieren (explizites `null` senden oder Update-Semantik "ganzer Datensatz") | im Rewrite beheben | F-190, F-214 |
| B-154 | Kind-Wechsel hinterlässt Altdaten: regular → ebay sendet nur `ebayHandle`/`firstName`; `company`, `lastName`, Adresse bleiben → Listenlabel zeigt weiterhin Firma statt eBay-Name (Priorität `company` zuerst), eBay-Karte zeigt alten Namen; ebay → regular lässt `ebayHandle` stehen. | `CustomerForm.svelte:242-250`; `+page.svelte:108-112`; `[id]/+page.svelte:113-117` | Inkonsistente Anzeige, irreführende Suche | Beim Kind-Wechsel die nicht zum Kind gehörenden Felder serverseitig nullen | im Rewrite beheben | F-181, F-187, F-190 |
| B-155 | `idSchema` prüft kein UUID-Format → `/customers/abc` oder `/suppliers/abc` löst Postgres-Fehler `invalid input syntax for type uuid` aus → 500 "Ein interner Fehler ist aufgetreten." statt kuratiertem 404. | `validation.ts:28`; `customer-service.ts:229-233`; `supplier-service.ts:75-82` | Unsaubere Fehlerseite bei manipulierten/vertippten Links; Server-Log-Rauschen | `uuid()`-Pipe mit deutscher Meldung oder 404-Mapping | im Rewrite beheben | F-190, F-193, F-215 |
| B-156 | `page: number()` ohne `minValue(1)` in allen Listen-/Picker-Schemas → `page: 0`/negativ → negativer OFFSET → 500. Das vorhandene `listParamsSchema` mit Bounds wird nicht verwendet. | `customers.remote.ts:85,195`; `suppliers.remote.ts:53`; `pickers.remote.ts:51,76`; `validation.ts:288-297` | Unkuratierter Fehler bei manipulierten Requests | `listParamsSchema` wiederverwenden | im Rewrite beheben | F-183, F-196, F-204 |
| B-157 | `customerInputSchema.customerNumber` ist vom Client setzbar: Nummernkreis umgehbar, Duplikat → Unique-Index-Verletzung → 500. | `customers.remote.ts:73`; `customer-service.ts:135` | Integritätsrisiko, unkuratierter Fehler | Feld aus dem Remote-Schema entfernen (nur Import setzt Nummern) | im Rewrite beheben | F-186, F-188 |
| B-158 | DB/Server kennen Felder ohne UI: `country`, `fax`, `phone2`, `birthday`, `paymentTermDays`, `vatId`, `bankIban`, `bankBic`, `bankName`, `legacyCustomerNumber`. Import füllt `birthday`, `vatId`, Bank, `fax`; Detail zeigt sie nicht ("Detail zeigt alles", `CONTRIBUTING.md:594-595`). | `schema.ts:172-193`; `customers.remote.ts:61-72`; `import-service.ts:633-640`; `[id]/+page.svelte:307-372` | Importierte Daten unsichtbar/uneditierbar; Docs (`entities.md:14-16`) suggerieren Nutzung | Entscheidung, welche Felder ins Formular/Detail; Rest aus Schema streichen | Entscheidung nötig | F-186, F-190, F-193, F-211 |
| B-159 | Lösch-Guard unvollständig: `vehicle_sales.customer_id` (RESTRICT) → unkuratierter 500; `vehicles.previous_owner_customer_id`, `calendar_entries`, `ledger_entries`, `time_entries`, `work_orders`, `customer_inquiries` (SET NULL) werden **still entkoppelt** (Vorbesitzer-Historie, Buchhaltungs-/Auftragsbezug gehen verloren). | `customer-service.ts:188-223`; `schema.ts:255-258,417-419,957,1021,1143,1208,1468` | Datenverlust bzw. 500 statt Meldung | Alle FKs zählen (oder Hard-Delete komplett durch Archivierung ersetzen) | im Rewrite beheben (Delete-Policy: Entscheidung nötig) | F-200, F-201 |
| B-160 | Keine Transaktionen: Guard-Zählung und DELETE getrennt (TOCTOU); Nummernvergabe und INSERT getrennt (Nummernlücke bei Insert-Fehler). | `customer-service.ts:189-222,135-139` | Race-Conditions, Lücken im Nummernkreis | `db.transaction` | im Rewrite beheben | F-186, F-201 |
| B-161 | Ad-hoc-Mail: `send.error` (roher nodemailer/SMTP-Text, i. d. R. Englisch) wird im 400 an den Nutzer durchgereicht; zusätzlich doppelter Präfix ("E-Mail konnte nicht versendet werden: E-Mail konnte nicht versendet werden: …"). Verstoß gegen §12.5. | `customers.remote.ts:375-377`; `mail-service.ts:447-453`; `[id]/+page.svelte:218` | Englische/technische Toasts | Fehler klassifizieren, kuratierte deutsche Meldung | im Rewrite beheben | F-202 |
| B-162 | `sendAdHocCustomerEmail` wirft plain `Error('Kunde nicht gefunden.')` / `Error('Der Kunde hat keine hinterlegte E-Mail-Adresse.')` → 500 generisch statt 404/400. | `mail-service.ts:390-395` | Falsche Fehlermeldung | `error(404/400, …)` | im Rewrite beheben | F-202 |
| B-163 | "E-Mail schreiben" ist bei fehlender E-Mail `disabled` — Abweichung von §11 ("nie wegen fehlender Eingabe disabled"); dadurch sind der Klick-Zeit-Check und der Warn-Alert im Dialog tote Pfade. | `[id]/+page.svelte:243-255,189-192,564-567` | Regelbruch bzw. toter Code | Entweder als Modus-Gate dokumentieren oder Button aktiv lassen + Hinweis | Entscheidung nötig | F-202 |
| B-164 | Detail zeigt keine Reifeneinlagerungen, Termine, Anfragen (`customer_inquiries`), Zeiteinträge, Buchhaltungsbuchungen, Angebote/KV/AB, Vorbesitzer-Fahrzeuge — obwohl FKs existieren und die Docs die Relationen nennen. | `[id]/+page.svelte:91-111`; `docs/modules/customers.md:26-27` | Nutzer muss in andere Module wechseln | Tabs/Karten je Relation (paginiert) | Entscheidung nötig | F-193…19 |
| B-165 | Rechnungen- und Fahrzeuge-Tab laden unbegrenzt (kein LIMIT, keine Pagination) und nur `type='invoice'`; archivierte Fahrzeuge ohne Kennzeichnung. | `customers.remote.ts:149-177`; `[id]/+page.svelte:401-417` | Große Kunden → große Payload; Angebote unsichtbar | Paginierte Relations-Queries wie beim Aufträge-Tab; Archiv-Badge | im Rewrite beheben | F-194, F-195 |
| B-166 | `getCustomerRelatedRemote` greift direkt per Drizzle in der Remote-Schicht auf die DB zu (Schichtung Service = Drizzle, Remote = Guard + Delegation, `CLAUDE.md` "Adding a new module" 1-2). | `customers.remote.ts:147-178` | Muster-Inkonsistenz in der "kanonischen Vorlage" | Service-Funktion `getCustomerRelated` | im Rewrite beheben | F-194, F-195 |
| B-167 | Detail ohne Löschen und ohne Schnellaktionen (Fahrzeug/Auftrag/Rechnung/Termin/Einlagerung für diesen Kunden anlegen); Löschen nur in der Liste. | `[id]/+page.svelte:223-270` | Umwege für Nutzer | Aktionsmenü im Detail | Entscheidung nötig | F-193, F-200 |
| B-168 | Listenfilter (`q`, `kind`, `page`) nicht in der URL → Reload/Back/Teilen verliert Zustand; Archiv-Tab nicht verlinkbar. Gilt für Lieferanten analog. | `+page.svelte:19-41`; `suppliers/+page.svelte:15-26` | Verlorener Kontext nach Navigation | URL-State (`?q=&kind=&page=`) | Entscheidung nötig | F-180…06, F-212 |
| B-169 | Sortierung: Server bietet `sortableMap`, UI keine Spaltensortierung; Default `createdAt DESC` (neueste zuerst, nicht alphabetisch). `sort` nicht per Whitelist validiert (unbekannt → still Default). | `customer-service.ts:84-97`; `customers.remote.ts:88` | Nutzer kann nicht nach Name sortieren | Sortierbare Spalten oder Default alphabetisch | bewusst später | F-184 |
| B-170 | Suche: führendes Wildcard über 11 Spalten → btree-Indizes nutzlos, kein `pg_trgm`/GIN; `%`/`_` im Suchbegriff nicht escaped (`%` matcht alles). | `customer-service.ts:52-68`; `drizzle/0000_lying_tyger_tiger.sql:456-459` | Bei ~300 Kunden unkritisch, skaliert nicht; Wildcard-Injection | Trigram-Index + Escaping bzw. `websearch_to_tsquery` | im Rewrite beheben | F-180 |
| B-171 | Suchspalten inkonsistent: Liste 11 Spalten (mit ebayHandle/street/zip), Picker 8 (ohne ebayHandle/street/zip), globale Suche 7 (ohne ebayHandle/city/street/zip) → eBay-Kunden per Handle im Picker/globaler Suche nicht findbar. | `customer-service.ts:55-66`; `pickers.remote.ts:109-118`; `search-service.ts:148-156` | Unterschiedliche Trefferlogik je Oberfläche | Eine gemeinsame Such-Prädikat-Funktion | im Rewrite beheben | F-180, F-204, F-207 |
| B-172 | eBay-Tab "eingetragen am" rendert ISO `yyyy-mm-dd`, Detail nutzt `de-DE` (`dd.mm.yyyy`); Fahrzeuge-/Rechnungen-Tab zeigen `firstRegistration`, `nextHu`, `issueDate`, `dueDate` roh (ISO). | `+page.svelte:143-148`; `[id]/+page.svelte:77-84,410,416,457-458` | Uneinheitliche Datumsformate | Zentraler `formatDate` | im Rewrite beheben | F-181, F-194, F-195 |
| B-173 | `countCustomersRemote` hat keinen Konsumenten (Dashboard nutzt es nicht), wird aber bei jeder Mutation per COUNT refreshed. | `customers.remote.ts:209-224`; grep `dashboard.remote.ts` ohne Treffer | Toter Pfad, unnötiger Roundtrip | Entfernen oder Dashboard anbinden | im Rewrite beheben | F-208 |
| B-174 | `updateCustomer`/`updateSupplier` liefern `undefined` bei unbekannter id; Remotes geben `undefined` zurück (kein 404) — inkonsistent zu `setCustomerArchived`. | `customer-service.ts:150-155`; `supplier-service.ts:63-68` | Stiller Erfolg bei Fremd-IDs | 404 werfen | im Rewrite beheben | F-190, F-214 |
| B-175 | "Privat/Firma" ist keine Stammdatum-Eigenschaft, sondern Heuristik `company IS NULL`; ein Leerstring `''` (z. B. aus anderen Schreibpfaden) zählt als Firma; `kind` (regular/ebay) und Privat/Firma sind zwei Konzepte in einer Spalte + Heuristik. | `customer-service.ts:70-81`; `schema.ts:194-201` | Fachlich unscharfe Filter | Explizites Feld `customerType: private\|business\|ebay` | Entscheidung nötig | F-181 |
| B-176 | Lieferant löschen ohne Guard: `ledger_entries.supplier_id`, `recurring_entries.supplier_id` werden per SET NULL still entkoppelt. | `supplier-service.ts:71-73`; `schema.ts:1018-1020,1047-1049` | Buchhaltungsbezug geht verloren | Guard analog Kunde oder Archivierung | im Rewrite beheben | F-216 |
| B-177 | Lieferanten-Archivierung existiert in DB/Service/Remote (`active\|archived\|all`), aber ohne jede UI (kein Archiv-Tab, kein Button); die Liste sendet fest `'active'` → archivierte Lieferanten wären unerreichbar. CONTRIBUTING §8 nennt Lieferanten "mit weniger UI". | `suppliers/+page.svelte:25`; `suppliers.remote.ts:56,67-72`; `CONTRIBUTING.md:599-600` | Halbfertiges Feature | Archiv-Tab + Detail-Aktion wie Kunden | im Rewrite beheben | F-217 |
| B-178 | Server-Schemas ohne deutsche Meldungen / ohne Pflichtprüfung: `supplierInputSchema.name` ohne `minLength` (leerer Firmenname serverseitig gültig, `import-service.ts:743` legt `'-'` an); `name`, `contactPerson`, `country`, `customerNumberAtSupplier`, bei Kunden `company`, `salutation`, `firstName`, `lastName`, `country`, `vatId`, `bankName`, `customerNumber`, `ebayHandle`, `q`, `sort` nur `maxLength` ohne Message → Fallback "Bitte prüfen Sie Ihre Eingabe."; Geschäftsregeln (Firma-oder-Nachname, eBay-Name ≥ 3) nur clientseitig. | `suppliers.remote.ts:35-40`; `customers.remote.ts:54-75,87-88` | Umgehbar per API; degradierte Meldungen | Regeln + Meldungen serverseitig | im Rewrite beheben | F-186, F-187, F-213 |
| B-179 | SupplierForm validiert IBAN/BIC nicht clientseitig; Serverfehler erscheint als Toast "Ungültige Eingabe für „IBAN“: …" ohne Feldmarkierung; Detail zeigt IBAN unformatiert. | `SupplierForm.svelte:17-33,305-320`; `validation.ts:97-121` | Schlechtere Fehler-UX | Client-Schema um `ibanSchema`/`bicSchema` erweitern | im Rewrite beheben | F-213 |
| B-180 | `pickSuppliersRemote` hat keinen Konsumenten; kein Formular (auch nicht Buchhaltung) wählt Lieferanten aus, obwohl `ledger_entries.supplier_id` / `recurring_entries.supplier_id` existieren. Docs (`suppliers.md:19-20`) beschreiben die Verknüpfung als genutzt. | `pickers.remote.ts:517-555`; grep `src/routes/ledger` ohne `supplierId` | Toter Code, unfertiges Feature | Lieferantenbezug in Buchhaltung umsetzen oder Picker/FKs streichen | Entscheidung nötig | F-218 |
| B-181 | `suppliers` ohne Indizes (auch nicht `archived`, `name`); Sortierung fest `createdAt DESC`, nicht nach Name; `customers.archived` ohne Index. | `schema.ts:511-538,227-234`; `supplier-service.ts:39` | Seq-Scans (klein), unintuitive Reihenfolge | Index `name`/`archived`, Sortierung Name | im Rewrite beheben | F-212 |
| B-182 | `FIELD_LABELS` ohne `wantsBroadcast`, `wantsTireReminders`, `kind`, `contactPerson`, `customerNumberAtSupplier` → Validierungsfehler zeigen Rohschlüssel (§12.1 "add its German label"). | `hooks.server.ts:264-330` (grep ohne Treffer) | Degradierte Meldung | Labels ergänzen | im Rewrite beheben | F-186, F-213 |
| B-183 | Listen-Remotes liefern vollständige Zeilen (inkl. `bankIban`, `bankBic`, `vatId`, `notes`, `birthday` bzw. `iban`/`bic`), obwohl die Tabelle 5-6 Spalten zeigt. | `customer-service.ts:100-106`; `supplier-service.ts:35-41` | Unnötige Payload/Exposition sensibler Daten an jeden `customers`-Berechtigten | Projektion auf Listen-DTO | im Rewrite beheben | F-178, F-212 |
| B-184 | Testlücken: keine Tests für Listen-Seite, `createCustomerRemote`/`updateCustomerRemote`/`deleteCustomerRemote`-Guards, `getCustomerRelatedRemote`, Reifenlager-Blocker im Guard, Feld-Leeren beim Update, Lieferanten-Remotes/-Seiten, keine Lieferanten-e2e. | `customers.remote.test.ts:4-10`; `customer-service.test.ts:357-402`; Verzeichnis `src/routes/suppliers` | Regressionen unbemerkt | Testmatrix im Rewrite vervollständigen | im Rewrite beheben | F-201, F-212…44 |
| B-185 | Docs vs. Code: `entities.md:14-16` (Bankdaten, `paymentTermDays` "override") und `suppliers.md:19-20` (Buchhaltungsverknüpfung) beschreiben Fähigkeiten, die nur als Spalten existieren; `customers.remote.ts:50-52` behauptet Service-Geschäftsregeln, die es nicht gibt. | `docs/domain/entities.md:12-21`; `docs/modules/suppliers.md:19-21`; `customers.remote.ts:48-52` | Falsche Erwartungen beim Rewrite | Docs an den Ist-Stand angleichen | im Rewrite beheben (Doku) | F-183, F-211, F-218 |
| B-186 | Picker-Wording uneinheitlich: `VehicleForm` "- Kunde wählen -"/"Kunden auswählen", `CustomerVehiclePicker` "Kunde suchen"/"Kunde wählen", CONTRIBUTING-Beispiel "— Kunde suchen und auswählen —". | `VehicleForm.svelte:394-395`; `CustomerVehiclePicker.svelte:171-172`; `CONTRIBUTING.md:700-701` | Uneinheitliche UI | Eine Wortwahl | im Rewrite beheben | F-204, F-205 |
| B-187 | Lösch-Bestätigung sagt "Diese Aktion kann nicht rückgängig gemacht werden.", verweist nicht auf die Archiv-Alternative; erst der 409-Toast tut es. | `+page.svelte:391` | Nutzer erfährt die Alternative erst nach dem Fehlversuch | Hinweis auf Archivieren im Dialog | bewusst später | F-200 |
| B-188 | Ad-hoc-Einzelmail wird als `documentType='mailing'` protokolliert → in "Gesendet" nicht von Serienbriefen unterscheidbar. | `mail-service.ts:366-370,418` | Audit unscharf | Eigener Typ (`adhoc`) | Entscheidung nötig | F-202 |
| B-189 | Anhänge: MIME nicht whitelisted, Dateiname ungefiltert, kein Gesamt-/Anzahllimit (nur `BODY_SIZE_LIMIT=64M` des Adapters); Base64 wandert durch den Remote-Call in den Server-Speicher. | `customers.remote.ts:320-342`; `EmailComposer.svelte:69-99` | DoS-/Missbrauchsfläche für authentifizierte Nutzer | Limits + Whitelist, ggf. Upload-Store | im Rewrite beheben | F-202 |
| B-190 | eBay-Formular: "Name (optional)" schreibt in `firstName`, `lastName` nicht erfassbar → Halbnamen; Detail setzt `[firstName, lastName]` zusammen. | `CustomerForm.svelte:344-350`; `[id]/+page.svelte:291-296` | Datenmodell-Unschärfe | Ein Feld `displayName` oder beide Namensfelder | Entscheidung nötig | F-187 |
| B-191 | `useFormValidation`-Docblock behauptet "Submit button is disabled until every field passes" — widerspricht §11 und der Nutzung; `resetTouched` ungenutzt in diesem Modul. | `form-validation.svelte.ts:7-8,57-58` | Irreführende Doku | Kommentar korrigieren | im Rewrite beheben (Doku) | F-191 |
| B-192 | Lieferanten-Seiten rufen `handleClientError(err)` ohne `baseMessage` → Toast ohne Kontext ("Es ist leider ein Fehler aufgetreten."), entgegen §12.4 Wording-Katalog. | `suppliers/+page.svelte:69`; `suppliers/new/+page.svelte:21`; `suppliers/[id]/edit/+page.svelte:33` | Weniger hilfreiche Fehlermeldungen | `'Lieferant konnte nicht … werden'` | im Rewrite beheben | F-213, F-214, F-216 |
| B-193 | `PageHeader subtitle` wird nicht mehr gerendert; vier Seiten übergeben Untertitel (Kundennummer, "Geben Sie die Stammdaten des Kunden ein.", "Stammdaten erfassen.", Lieferantenname). | `PageHeader.svelte:17-18`; `customers/new/+page.svelte:54-57`; `customers/[id]/edit/+page.svelte:38`; `suppliers/new/+page.svelte:26`; `suppliers/[id]/edit/+page.svelte:38` | Toter Code; Kundennummer im Edit-Header fehlt sichtbar | Prop entfernen oder rendern | im Rewrite beheben | F-186, F-190, F-213, F-214 |
| B-194 | Lieferantendetail zeigt `contactPerson`, `customerNumberAtSupplier`, `notes`, `legacySupplierNumber` nicht (Liste zeigt Kontakt, Detail nicht — Umkehr von §8). | `suppliers/[id]/+page.svelte:24-78` | Nutzer muss ins Edit-Formular | Karten "Firma" + "Notiz" | im Rewrite beheben | F-215 |
| B-195 | Reaktivieren im Archiv-Tab ohne Bestätigung, im Detail mit ConfirmDialog — inkonsistentes Verhalten für dieselbe Aktion (bewusst laut Kommentar :114-118, aber nicht dokumentiert). | `+page.svelte:119-134`; `[id]/+page.svelte:540-550` | Uneinheitliche UX | Einheitlich entscheiden | Entscheidung nötig | F-198, F-199 |
| B-196 | Aufträge-Tab ist mit `orders`-Recht lesbar, aber `getCustomerRemote` (Seitenkopf) verlangt `customers` → die Sonderregel greift auf der Kundendetailseite faktisch nie (nur bei Direktaufruf des Remotes). | `customers.remote.ts:182-199`; `[id]/+page.svelte:47-51` | Halbwirksame Berechtigungsregel | Entweder Detail für `orders` lesbar machen oder Guard vereinheitlichen | Entscheidung nötig | F-196, F-210 |

---

## 11. Offene Fragen an den Architekten

1. **Stammdatenumfang Kunde**: Sollen Bankdaten (IBAN/BIC/Bank), USt-IdNr., Zahlungsziel (`paymentTermDays`), Geburtstag, Fax, Land, zweite Telefonnummer im Rewrite erfasst und angezeigt werden — oder bewusst entfallen (dann Import-Mapping und Schema kürzen)? Wird `paymentTermDays` irgendwo in der Belegerstellung ausgewertet (außerhalb dieses Moduls, unklar)?
2. **Kundentypen**: eBay-Kunde als eigener `kind` beibehalten (mit reduziertem Formular) oder eBay-Handle als optionales Feld jedes Kunden? Soll "Privat/Firma" ein explizites Attribut werden (statt `company IS NULL`)? Braucht ein Firmenkunde mehrere Ansprechpartner/Adressen?
3. **Lösch-Policy (GoBD)**: Hard-Delete für Kunden/Lieferanten überhaupt anbieten (nur ohne Verknüpfungen) oder ausschließlich Archivierung? Falls Hard-Delete: Welche Verknüpfungen blockieren (Vorbesitzer, Verkäufe, Termine, Buchungen, Zeiteinträge, Anfragen)?
4. **Lieferanten**: Sollen Archivierung (UI), Lösch-Guard und die Verwendung in der Buchhaltung (Picker bei Ausgabenbuchungen/Daueraufträgen) umgesetzt werden — oder ist der Lieferantenstamm nur eine Adressliste?
5. **Kundendetail-Umfang**: Welche Relationen sollen als Tabs/Karten erscheinen (Reifeneinlagerungen, Termine, Anfragen aus dem Kontaktformular, Zeiteinträge, Buchungen, Angebote/KV/AB, Vorbesitz-Historie)? Welche Schnellaktionen (Fahrzeug/Auftrag/Termin/Rechnung/Einlagerung anlegen, Löschen) gehören ins Detail?
6. **Listen-Zustand in der URL**: Sollen Suche/Filter/Seite als Query-Parameter geführt werden (Deep-Links, Back-Button), inkl. Spaltensortierung?
7. **Ad-hoc-Mail**: Eigener `sent_messages`-Typ für Einzelmails? Anhang-Whitelist/Gesamtlimit? Soll die Mail-Historie eines Kunden im Detail sichtbar sein?
8. **Kundennummer**: Bleibt das Template `'{N}'` (rein numerisch, an Legacy anschließend) oder gewünschtes Format (z. B. `KU-{NNNNN}`)? Manuelle Vergabe erlaubt?
9. **Berechtigungen**: Soll die Werkstatt (`orders`-Recht) das Kundendetail (zumindest lesend) öffnen dürfen (siehe B-196)?
10. **Suche**: Gemeinsame Suchsemantik (welche Spalten) für Liste, Picker und globale Suche — und soll Volltext (trigram/tsvector) eingeführt werden?

---

## 12. Gelesene Dateien

| Datei | Zeilen | Umfang |
|---|---|---|
| `/tmp/claude-1000/-home-nick-tc-twincars-manager/f70b161a-4b0a-45f4-88cf-7cf1305fd0cf/scratchpad/inv/TEMPLATE.md` | 59 | vollständig |
| `src/routes/customers/+page.svelte` | 396 | vollständig |
| `src/routes/customers/customers.remote.ts` | 380 | vollständig |
| `src/routes/customers/CustomerForm.svelte` | 549 | vollständig |
| `src/routes/customers/new/+page.svelte` | 69 | vollständig |
| `src/routes/customers/[id]/+page.svelte` | 613 | vollständig |
| `src/routes/customers/[id]/DetailHost.svelte` | 15 | vollständig |
| `src/routes/customers/[id]/edit/+page.svelte` | 44 | vollständig |
| `src/lib/server/services/customer-service.ts` | 262 | vollständig |
| `src/lib/components/ui/CompactCustomerCard.svelte` | 60 | vollständig |
| `src/lib/components/ui/CustomerVehiclePicker.svelte` | 209 | vollständig |
| `src/routes/suppliers/+page.svelte` | 174 | vollständig |
| `src/routes/suppliers/suppliers.remote.ts` | 143 | vollständig |
| `src/routes/suppliers/SupplierForm.svelte` | 350 | vollständig |
| `src/routes/suppliers/new/+page.svelte` | 27 | vollständig |
| `src/routes/suppliers/[id]/+page.svelte` | 79 | vollständig |
| `src/routes/suppliers/[id]/edit/+page.svelte` | 44 | vollständig |
| `src/lib/server/services/supplier-service.ts` | 82 | vollständig |
| `src/lib/server/db/schema.ts` | 2025 | Abschnitte 160-270, 400-430, 505-575, 940-970, 1005-1060, 1130-1150, 1195-1215, 1455-1475, 1685-1705 + grep `customers.id`/`suppliers.id` |
| `src/lib/server/db/validation.ts` | 315 | vollständig |
| `src/routes/pickers.remote.ts` | 703 | Abschnitte 1-160, 218-300, 505-560 (pickCustomers, pickCustomerVehicles, pickSuppliers) |
| `src/lib/utils/picker-labels.ts` | 61 | vollständig |
| `src/routes/customers/customers.remote.test.ts` | 480 | vollständig |
| `src/lib/server/services/customer-service.test.ts` | 525 | vollständig |
| `src/lib/server/services/supplier-service.test.ts` | 154 | vollständig |
| `src/routes/customers/CustomerForm.test.ts` | 204 | vollständig |
| `src/routes/suppliers/SupplierForm.test.ts` | 187 | vollständig |
| `src/routes/customers/[id]/detail-email.test.ts` | 113 | vollständig |
| `src/routes/customers/[id]/detail-tabs.test.ts` | 204 | vollständig |
| `src/lib/components/ui/CompactCustomerCard.test.ts` | 59 | vollständig |
| `src/lib/components/ui/CustomerVehiclePicker.test.ts` | 305 | vollständig |
| `e2e/customers.spec.ts` | 329 | vollständig |
| `docs/modules/customers.md` | 63 | vollständig |
| `docs/modules/suppliers.md` | 22 | vollständig |
| `docs/domain/entities.md` | 166 | vollständig |
| `docs/domain/glossary.md` | 61 | vollständig |
| `docs/domain/business-overview.md` | 57 | vollständig |
| `CONTRIBUTING.md` | 1474 | vollständig |
| `src/lib/server/services/mail-service.ts` | 1236 | Abschnitt 360-480 (`sendAdHocCustomerEmail`) + grep |
| `src/hooks.server.ts` | 470 | Abschnitte 255-330 (`FIELD_LABELS`), 423-446 (`handleValidationError`) |
| `src/lib/server/services/search-service.ts` | 500 | Abschnitte 120-175, 355-392 + grep |
| `src/routes/search.remote.ts` | 49 | grep (Guard, Permission-Filter) |
| `src/lib/components/ui/Toolbar.svelte` | 65 | vollständig |
| `src/lib/components/ui/Pagination.svelte` | 144 | grep (Props, Caption, aria-labels) |
| `src/lib/components/ui/ConfirmDialog.svelte` | 123 | grep (Props, Defaults, onConfirm-Verhalten) |
| `src/lib/components/ui/EmptyState.svelte` | 35 | grep (Props) |
| `src/lib/components/layout/PageHeader.svelte` | 33 | grep (Props, `subtitle` nicht gerendert) |
| `src/lib/components/ui/TabGroup.svelte` | 184 | grep (Props, `?tab=`-Handling) |
| `src/lib/components/ui/EmailComposer.svelte` | 212 | Abschnitt 55-100 + grep (Props, Limits) |
| `src/lib/utils/form-validation.svelte.ts` | 201 | Zeilen 1-150 |
| `src/lib/stores/form-dirty.svelte.ts` | 38 | vollständig |
| `src/lib/stores/creation-flow.svelte.ts` | 223 | vollständig |
| `src/lib/utils/client-error.ts` | 69 | vollständig |
| `src/lib/components/layout/AppShell.svelte` | 511 | Abschnitt 498-510 + grep (Unsaved-Dialog) |
| `src/lib/server/services/number-range-service.ts` | 122 | Abschnitte 47-61, 102-122 |
| `src/lib/server/services/import-service.ts` | 1591 | Abschnitte 606-640, 690-706, 735-758 + grep |
| `src/lib/server/services/tire-reminder-service.ts` | 199 | Abschnitt 90-111 |
| `src/lib/server/services/work-order-service.ts` | 1160 | Abschnitte 74-90, 228-240 + grep `customerId` |
| `src/routes/mailings/mailings.remote.ts` | 164 | Abschnitt 70-100 |
| `src/lib/components/layout/navigation.ts` | 247 | grep (Einträge Kunden/Lieferanten) |
| `src/lib/permissions.ts` | 53 | grep (`customers`, `suppliers`) |
| `src/routes/vehicles/VehicleForm.svelte` | – | grep (Picker-Wording, Creation-Flow-Aufruf) |
| `src/routes/vehicles/[id]/+page.svelte` | – | Abschnitt 473-485 (CompactCustomerCard) |
| `drizzle/0000_lying_tyger_tiger.sql`, `drizzle/0011_phase3_data_model.sql` | – | grep (Indizes customers/suppliers, `pg_trgm`) |
| `node_modules/drizzle-orm/utils.js` | – | Zeilen 83-91 (`mapUpdateSet`, `undefined`-Filter) |
