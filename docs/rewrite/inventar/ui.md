---
title: Inventar UI-Komponenten (UI)
teil_von: docs/rewrite/01-inventar.md
stand: Bestand (SvelteKit) vor dem Rewrite
---

> **Detail-Inventar des Bestands.** Erhoben durch vollständiges Lesen der in
> Abschnitt „Gelesene Dateien" genannten Dateien. Die IDs wurden auf die
> globalen IDs aus [01-inventar.md](../01-inventar.md) umgestellt
> (78 IDs). Zurück: [01-inventar.md](../01-inventar.md) ·
> [02-befunde.md](../02-befunde.md)

# Modul: Shared UI-Komponenten und Picker   (Kürzel: UI)

Sprache: Deutsch für Fließtext/Tabellen; Code-Bezeichner, Dateipfade, Tabellen-/Spaltennamen bleiben englisch und exakt wie im Code.
Alles stammt aus dem tatsächlich gelesenen Code (Stand Branch `twincast-production-readiness`, v1.4.0). Fundstellen als `pfad/datei:zeile`.

Umfang dieses Inventars: die 20 Shared-Komponenten in `src/lib/components/ui/` (+ 2 Test-Harnesses), zur Einordnung `PageHeader`/`AppShell` (Hauptdoku beim Layout-Agenten), das zentrale Picker-Remote `src/routes/pickers.remote.ts`, die Client-Stores `toast`, `creation-flow`, `busy`, `page-title`, `form-dirty` sowie die Utilities `picker-labels`, `form-validation`, `pagination`, `pdf-download`.

---

## 1. Routen und Seiten

Das Modul besitzt **keine eigenen Routen**. Die Komponenten werden von den Modulseiten eingebunden; drei Einbindungen sind global:

| Route / Ort | Datei | Parameter | Guard / Permission | Layout | Datenabhängigkeiten | Zweck |
| --- | --- | --- | --- | --- | --- | --- |
| Root-Layout (alle Routen) | `src/routes/+layout.svelte:7-8,83-88` | – | Session-Gate in `hooks.server.ts` (nicht Teil dieses Moduls) | `AppShell` umschließt alle Nicht-Login/Setup-Routen; `ToastTray` wird immer gerendert (Z. 88) | `getLayoutContext()`, `getCurrentUserRemote()` (Z. 20-21) | Mountet `AppShell` + `ToastTray`; wired `beforeNavigate`/`afterNavigate` an `busy.begin()` (Z. 38-52) |
| Globale Suche (Modal, keine Route) | `src/lib/components/layout/AppShell.svelte:498` | – | `globalSearchRemote` → `requireUser()` + Bucket-Filter je Permission (`src/routes/search.remote.ts:29-49`) | im `AppShell` | `globalSearchRemote({ q })` erst ab 2 Zeichen | Cmd/Ctrl+K oder Navbar-Trigger öffnet `GlobalSearch` |
| Deep-Link `?tab=<id>` | `src/lib/components/ui/TabGroup.svelte:70-80,129-135` | `tab` (Default-Param-Name, per Prop `urlParam` änderbar/abschaltbar) | – | – | – | State-Modus spiegelt aktiven Tab per `replaceState` (kein History-Eintrag); unbekannter Wert → erster Tab |
| Creation-Flow-Rücksprung | `src/lib/stores/creation-flow.svelte.ts:92-95,149-155` | `returnUrl` = `pathname + search` der Host-Seite | – | – | sessionStorage-Key `twincars.creation-flow` | Blätter `/customers/new`, `/vehicles/new`, `/employees/new` (Module Kunden/Fahrzeuge/Mitarbeiter) springen nach `finish`/`cancel` auf `returnUrl` zurück |

Redirects: keine im Modul. `PdfViewer` und `VehicleDocuments` erzeugen `blob:`-URLs mit `#<dateiname>`-Fragment (`PdfViewer.svelte:75`, `VehicleDocuments.svelte:165-169`), keine Routen.

---

## 2. Remote Functions und Endpoints

### 2.1 Gemeinsame Schemata und Helfer (`src/routes/pickers.remote.ts`)

- **`pickerSchema`** (Z. 49-53): `q: optional(pipe(string(), trim(), maxLength(200)))`, `page: number()`, `size: picklist([10, 25, 50, 100])`. **Keine deutschen Meldungen** in den Pipe-Schritten (Befund B-082); `page` hat **kein `minValue(1)`** (Befund B-083).
- **`itemsPickerSchema`** (Z. 61-66): wie oben + `category: optional(picklist(['all','services','articles']))`.
- **`customerVehiclePickerSchema`** (Z. 74-79): wie oben + `customerId: optional(pipe(string(), trim(), maxLength(64)))`.
- **`buildResult(items, total, page, size)`** (Z. 81-92) → `{ items, total, page, size, pageCount: max(1, ceil(total/size)) }`.
- Alle Picker: `offset = (page - 1) * size`, zwei parallele Queries (`Promise.all`: Rows + `count()`), keine Transaktion, keine Nebenwirkungen, keine `refreshAll`-Ziele (reine Queries).
- Die Komponenten rufen die Picker immer per `.run()` auf (z. B. `CustomerVehiclePicker.svelte:90-103`), Seitengröße im Dialog fest 25 (`SearchablePicker.svelte:57`, `MultiSearchablePicker.svelte:60`).

### 2.2 Die Picker-Queries

- **`pickCustomersRemote`** — query — `pickers.remote.ts:100-151`
  - Guard: `requirePermission('customers')` (Z. 103)
  - Argumente: `pickerSchema`
  - Filter: `customers.archived = false` (Z. 105) + ILIKE `%q%` auf `company, lastName, firstName, customerNumber, city, phone, mobile, email` (Z. 109-118)
  - Sortierung: `lastName ASC, company ASC` (Z. 134)
  - Rückgabe-Item: `{ id, label }`; Label via `customerPickerLabel` = Anzeigename (`company` → „Vorname Nachname" → `customerNumber`) + ` · <city>` (Z. 141-147; `picker-labels.ts:37-48`)
  - Fehlerfälle: nur Validierung (generische Meldung) / 403 aus Guard
- **`pickVehiclesRemote`** — query — `pickers.remote.ts:159-213`
  - Guard: `requirePermission('vehicles')` (Z. 162)
  - Filter: `vehicles.archived = false` (Z. 164); bei `q`: Vor-Query `selectDistinct(vehicleId)` aus `vehicle_license_plate_versions` mit ILIKE auf `licensePlate` (Z. 167-171), dann `OR(vin, make, model, hsn, tsn ILIKE) OR id IN (plateMatchIds)` (Z. 172-183)
  - Join: `latestPlateSubquery()` (aus `vehicle-service`) left-joined für das aktuelle Kennzeichen (Z. 186-196)
  - Sortierung: `lp.licensePlate ASC` (Z. 198) — Fahrzeuge ohne Kennzeichen sortieren nach Postgres-Default (NULLs zuletzt bei ASC)
  - Label: `vehiclePickerLabel` = `<plate|-> · <make model|->` (Z. 205-209; `picker-labels.ts:57-61`)
- **`pickCustomerVehiclesRemote`** — query — `pickers.remote.ts:225-301`
  - Guard: `requirePermission('vehicles')` (Z. 228)
  - Argumente: `customerVehiclePickerSchema`; `customerId` engt auf `vehicles.customerId = customerId` ein (Z. 231)
  - Suche: wie `pickVehiclesRemote` **plus** `customers.lastName`, `customers.company` (Halter-Suche, Z. 239-247)
  - Joins: `latestPlateSubquery` + `customers` (Z. 270-271; Count-Query joint `customers` ebenfalls, Z. 276-280)
  - Sortierung: `lp.licensePlate ASC` (Z. 273)
  - Rückgabe-Item: `{ id, label, customerId, customerLabel }`; `label` = `vehiclePickerLabel(..., holder)` mit drittem Segment ` · <Halter-Anzeigename>` (Z. 282-298)
- **`pickEmployeesRemote`** — query — `pickers.remote.ts:309-353`
  - Guard: `requireAnyPermission('employees', 'orders')` (Z. 314) — Auftragsmodul darf Mitarbeiter wählen
  - Filter: `employees.archived = false` (Z. 316) + ILIKE auf `firstName, lastName, personnelNumber, position, privateEmail, privatePhone, mobile` (Z. 321-328)
  - Sortierung: `lastName ASC` (Z. 342)
  - Label: `` `${firstName} ${lastName} · ${personnelNumber}` `` (Z. 349; **nicht** in `picker-labels.ts`)
- **`pickItemsRemote`** — query — `pickers.remote.ts:362-416`
  - Guard: `requireAnyPermission('items', 'orders')` (Z. 367)
  - Argumente: `itemsPickerSchema`; `category='services'` → `kind='service'`; `'articles'` → `kind IN ('article','material','pass_through')`; `'all'`/leer → kein Kind-Filter (Z. 376-380)
  - Filter: **kein** Archiv-/Ausmusterungsfilter (Kommentar Z. 56-59 behauptet „alles, was nicht ausgemustert ist" — Tabelle `items` hat keine `archived`-Spalte; Befund B-085); Suche ILIKE auf `articleNumber, description` (Z. 373)
  - Sortierung: `articleNumber ASC` (Z. 394)
  - Rückgabe-Item: `{ id, label: '<articleNumber> - <description>', articleNumber, description, kind, unit (Default 'Stk'), unitPriceNet, stockOnHand }`; `unitPriceNet` je Zeile via `getCurrentItemPrice(r.id)` → **N+1** (Z. 400-413; Befund B-084)
- **`pickInventoryVehiclesRemote`** — query — `pickers.remote.ts:428-509`
  - Guard: `requirePermission('inventory')` (Z. 431)
  - Filter: `archived = false AND customerId IS NULL AND (vehicleListings.status IS NULL OR = 'available')` (Z. 437-444); Suche wie `pickVehiclesRemote` (Z. 447-464)
  - Joins: `vehicle_listings` + `latestPlateSubquery` (Z. 480-481)
  - Sortierung: `make ASC, model ASC` (Z. 483)
  - Rückgabe-Item: `{ id, label: '<make model|-> · <plate|vin>', plate, vin, make, model, firstRegistration, salesPriceGross (Number, Default 0), differentialTax }` (Z. 492-506)
- **`pickSuppliersRemote`** — query — `pickers.remote.ts:517-555`
  - Guard: `requirePermission('suppliers')` (Z. 520)
  - Filter: `suppliers.archived = false` (Z. 522) + ILIKE auf `name, city, contactPerson, email` (Z. 526-531)
  - Sortierung: `name ASC` (Z. 545)
  - Label: `` `${name}${city ? ' · ' + city : ''}` `` (Z. 551)
- **`pickDocumentsRemote`** — query — `pickers.remote.ts:569-631`
  - Guard: `requireAnyPermission('invoices', 'offers')` (Z. 572)
  - Filter: `documents.type IN ('invoice','offer','cost_estimate','order_confirmation')` (Z. 575-581); **kein** Storno-/Status-Filter; Suche ILIKE auf `documentNumber, customers.company, customers.lastName` (Z. 584-590)
  - Join: `customers` (left) (Z. 604, 612)
  - Sortierung: `issueDate DESC, createdAt DESC` (Z. 606)
  - Label: `'<Rechnung|Angebot|Kostenvoranschlag|Auftrag> <documentNumber>[ · <company|lastName>]'` (Z. 615-627)
- **`pickTiresRemote`** — query — `pickers.remote.ts:640-703`
  - Guard: `requirePermission('tires')` (Z. 643)
  - Filter: kein Archivfilter (Tabelle `tires` ohne `archived`); Suche ILIKE auf `articleNumber, brand, model, ean` (Z. 649-655)
  - Sortierung: `articleNumber ASC` (Z. 674)
  - Rückgabe-Item: `{ id, label: '<articleNumber> · <brand> <model> · <width>/<aspectRatio>R<diameterInch> · <season>', articleNumber, brand, model, width, aspectRatio, construction, diameterInch, sizeLabel, season, stockOnHand, unitPriceNet }`; `unitPriceNet` via `getCurrentTirePrice` → **N+1** (Z. 679-700)

### 2.3 Von Shared-Komponenten konsumierte Remotes anderer Module

| Remote | Art | Datei:Zeile | Guard | Konsument |
| --- | --- | --- | --- | --- |
| `globalSearchRemote({ q })` | query | `src/routes/search.remote.ts:29-49` | `requireUser()`; Buckets ohne Modul-Permission werden leer zurückgegeben (Z. 33-48); `q` trim + maxLength 200 mit deutschen Meldungen (Z. 7-13) | `GlobalSearch.svelte:183` |
| `getDocumentPdfBytesRemote({ id })`, `getReminderPdfBytesRemote({ id })` | query | `src/routes/pdfs.remote.ts` (nicht gelesen; Zeile unklar) | unklar (PDF-Agent) | `PdfViewer.svelte:44-47` |
| `listVehicleDocumentsRemote({ vehicleId })` | query | `src/routes/vehicles/vehicle-documents.remote.ts:66-72` | `requirePermission('vehicles')` | `VehicleDocuments.svelte:86` |
| `getVehicleDocumentRemote({ id })` | query | `…:81-93`; 404 „Dokument nicht gefunden." | `requirePermission('vehicles')` | `VehicleDocuments.svelte:160` |
| `uploadVehicleDocumentRemote` | command | `…:105-119`; Schema Z. 31-55: `fileName` 1-255, `mime` picklist (PDF/JPEG/PNG/WebP, dt. Meldung), `dataBase64` ≤ 21_000_000 Zeichen („Die Datei ist zu groß (maximal 15 MB)."), `note` ≤ 500; refresht `listVehicleDocumentsRemote({vehicleId})` (Z. 116) | `requirePermission('vehicles')` | `VehicleDocuments.svelte:141-147` |
| `deleteVehicleDocumentRemote({ id, vehicleId })` | command | `…:128-135` | `requirePermission('vehicles')` | `VehicleDocuments.svelte:186` |
| `createTimeEntryRemote`, `currentEmployeeRemote`, `listTimeEntriesRemote` | command/query | `src/routes/hours/hours.remote.ts` (nicht gelesen) | unklar (Hours-Agent) | `QuickTimeEntryModal.svelte:84-99` |

---

## 3. Services (Server-Layer) und Client-Stores/Utilities

Die Picker-Queries greifen direkt per Drizzle auf die DB zu (kein Service-Layer; von CONTRIBUTING §9 so vorgesehen, `CONTRIBUTING.md:636-671`). Genutzte Server-Helfer:

| Funktion | Datei | Nutzung | Anmerkung |
| --- | --- | --- | --- |
| `latestPlateSubquery()` | `src/lib/server/services/vehicle-service.ts` (nicht gelesen) | aktuelles Kennzeichen je Fahrzeug (`pickers.remote.ts:186,255,466`) | Subquery-Join in 3 Pickern |
| `getCurrentItemPrice(id)` | `item-service.ts` | je Zeile in `pickItemsRemote` (Z. 409) | N+1 (B-084) |
| `getCurrentTirePrice(id)` | `tire-service.ts` | je Zeile in `pickTiresRemote` (Z. 696) | N+1 (B-084) |
| `customerDisplayName`, `customerPickerLabel`, `vehiclePickerLabel` | `src/lib/utils/picker-labels.ts:37-61` | Label-Formate Kunde/Fahrzeug, server- und clientseitig identisch | Exportierte Typen `CustomerNameParts`, `CustomerLabelParts`, `VehicleLabelParts` |

Client-Stores/Utilities (im Nuxt-Rewrite als Composables/Pinia nachzubauen):

| Export | Datei | Signatur / API | Verhalten |
| --- | --- | --- | --- |
| `toast` | `src/lib/stores/toast.svelte.ts:21-72` | `push(message, variant='info', timeout=4500)`, `success(msg)` (4500 ms), `error(msg)` (**6000 ms**), `warning`, `info`, `dismiss()`, Getter `current` | **Genau ein** Toast sichtbar; neuer Toast ersetzt sofort (Z. 33-57); Auto-Dismiss nur bei `timeout > 0` und im Browser; `id = nanoid(8)` |
| `creationFlow` (`CreationFlowStore`) | `src/lib/stores/creation-flow.svelte.ts:102-223` | `start(frame)`, `finish({id,label,holder?})`, `cancel()`, `pendingReturnFor(url)`, `activeEntities()`, `reset()`, Getter `top`, `depth`; `currentUrl()` (Z. 92-95) | Stack in `sessionStorage['twincars.creation-flow']`; Stack älter als **1 h** wird komplett verworfen (Z. 79, 193-197); Quota-Fehler → nur In-Memory (Z. 215-218); `pendingReturnFor` konsumiert genau einmal und nur bei URL-Gleichheit (Z. 149-155); Entities: `customer \| vehicle \| employee` (Z. 25) |
| `busy` | `src/lib/stores/busy.svelte.ts:29-94` | `active`, `slow`, `begin(): () => void`, `run(fn)` | Zählsemaphor; `slow` nach **250 ms** (Z. 37); `end` idempotent |
| `pageHeader` | `src/lib/stores/page-title.svelte.ts:17-53` | `set({title, back?, primaryAction?})`, `reset()`, Getter `title`, `backTarget`, `primaryAction`; Alias `pageTitle` (Z. 56-62) | von `PageHeader` beschrieben, von `AppShell` gerendert |
| `formDirty` | `src/lib/stores/form-dirty.svelte.ts:26-38` | `dirty`, `set(v)`, `clear()` | globaler Unsaved-Changes-Flag |
| `useFormValidation(schema \| () => schema, () => values)` | `src/lib/utils/form-validation.svelte.ts:73-156` | Handle `{ valid, errors, touched, markTouched, markAllTouched, resetTouched }` | Nur erstes Issue je Feld; Root-`check()`-Fehler unter `_form` (Z. 95-105); englische Valibot-Defaults (`^(Invalid\|Expected\|Missing)`) → „Bitte prüfen Sie Ihre Eingabe." (Z. 114-122) |
| `validationClasses`, `selectValidationClasses`, `textareaValidationClasses` | `…:168-201` | `(error, touched, base?) => string` | hängt `input-error`/`select-error`/`textarea-error` nur bei `error && touched` an |
| `paginationButtons(page, pageCount, visible=5)` | `src/lib/utils/pagination.ts:21-43` | `(number \| null)[]` | Fenster um `page`, `1`/`pageCount` als Sprungziele, `null` = Ellipse; `pageCount <= 1` → `[1]` |
| `clampPagination(page, size)` | `…:5-15` | `{ page: 1..100000, size ∈ {10,25,50,100} (Default 25) }` | serverseitige Klemme für Listen (nicht von den Pickern genutzt) |
| `base64ToBytes`, `openPdfInNewTab`, `downloadBase64File` | `src/lib/utils/pdf-download.ts:40-80+` | – | Blob-URL, `window.open(_blank, noopener)`, Revoke nach 60 s |

---

## 4. Komponenten (Hauptteil)

### 4.1 Übersichtstabelle

| Komponente | Datei | Zweck | Props (Name: Typ, default) | Events/Callbacks | Snippets/Slots | Interner State | Verwendete Shared-Komponenten |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CompactCustomerCard | `ui/CompactCustomerCard.svelte` (60 Z.) | Read-only Halter-/Kundenkarte mit Link | `customerNumber: string` (Pflicht), `company/firstName/lastName/phone/email: string\|null = null`, `href: string` (Pflicht), `title = 'Kunde'` | – | – | `nameLabel` ($derived) | – |
| ConfirmDialog | `ui/ConfirmDialog.svelte` (123 Z.) | Nativer `<dialog>`-Bestätigungsdialog | `open: boolean` (bindable, false), `title` (Pflicht), `message?`, `confirmLabel='Bestätigen'`, `cancelLabel='Abbrechen'`, `variant: 'danger'\|'primary'='primary'`, `onConfirm` (Pflicht), `onClose` (Pflicht) | `onConfirm()` (sync/async), `onClose()` (bei Confirm **und** Cancel) | – | `inFlight` (nicht reaktiv), `dialogEl` | – (liest `busy`) |
| CustomerVehiclePicker | `ui/CustomerVehiclePicker.svelte` (209 Z.) | Relationsbewusster Kombi-Picker Kunde+Fahrzeug | `customerId/customerLabel/vehicleId/vehicleLabel` (bindable, ''), `customerFieldLabel='Kunde'`, `vehicleFieldLabel='Fahrzeug'`, `customerRequired/vehicleRequired=false`, `vehicleLocked=false`, `vehicleHint?`, `customerError: string\|null=null`, `disabled=false`, `colSpan?` | `onChange?()`, `onCreateCustomer?()`, `onCreateVehicle?()` | – | `lastCustomerId` (plain let), `canCreateVehicle` | SearchablePicker ×2 |
| EmailComposer | `ui/EmailComposer.svelte` (212 Z.) | Betreff/Text/Anhänge-Editor (layout-only) | `subject/body` (bindable, ''), `attachments: ComposerAttachment[]` (bindable, []), `maxBytesPerFile=10 MiB`, `disabled=false`, `hint?`, `allowHtml=false`, `asHtml` (bindable, false) | – (nur Bindings) | – | `fileInput` | – (nutzt `toast`, `busy`) |
| EmptyState | `ui/EmptyState.svelte` (35 Z.) | Randloser Leerzustand | `icon?: Component` (Default `Inbox`), `title` (Pflicht), `description?` | – | `action?: Snippet` | – | – |
| FormField | `ui/FormField.svelte` (60 Z.) | Kanonisches Feld-Layout (Label oben, Fehler/Hint unten) | `label` (Pflicht), `required=false`, `error: string\|null=null`, `hint?`, `colSpan?` | – | `children: Snippet` (Pflicht) | – | – |
| GlobalSearch | `ui/GlobalSearch.svelte` (366 Z.) | Modal-Suche über 9 Buckets | `open: boolean` (bindable, false) | – | – | `q`, `results`, `loading`, `activeIndex`, `searchTimer`, `input` | – |
| ImageUploader | `ui/ImageUploader.svelte` (353 Z.) | Bild-Upload-Karte (single/gallery, Drag&Drop) | `images: {id,dataUrl,isMain?}[]` (Pflicht), `title='Bilder'`, `hint?`, `single=false`, `allowDelete=true`, `allowSetMain=true`, `maxBytes=20 MiB` | `onUpload({mime,dataUrl}) → Promise` (Pflicht), `onDelete?(id)`, `onSetMain?(id)` | – | `fileInput`, `dragActive`, `dragDepth`, `cover` | – (nutzt `busy`, `toast`) |
| Loader | `ui/Loader.svelte` (61 Z.) | Spinner block/inline/overlay | `size: 'sm'\|'md'\|'lg'='md'`, `label='Inhalte werden geladen'`, `variant: 'block'\|'inline'\|'overlay'='block'` | – | – | – | – |
| MultiSearchablePicker | `ui/MultiSearchablePicker.svelte` (315 Z.) | Mehrfachauswahl-Dialog mit Server-Suche, transaktional | `values: string[]` (bindable, []), `valueLabels: Map\|Array<[id,label]>` (bindable, Map), `placeholder='Bitte wählen'`, `dialogTitle='Auswählen'`, `emptyText='Keine passenden Einträge gefunden.'`, `search` (Pflicht), `disabled=false`, `triggerSize='md'`, `createLabel?`, `onCreateNew?` | `onChange?(values)`, `onCreateNew?()` | – | `dialog`, `searchInput`, `q`, `page`, `items`, `total`, `pageCount`, `loading`, `selection: Map` | Pagination, Loader |
| MultiSelect | `ui/MultiSelect.svelte` (224 Z.) | Client-seitiges Dropdown-Multiselect mit Chips | `options: {id,label,sublabel?}[]` (Pflicht), `selected: string[]` (bindable, []), `placeholder='Auswählen…'`, `label?`, `disabled=false`, `emptyHint='Keine Einträge.'` | `onChange?(selected)` | – | `open`, `filter`, `root`, `filterInput` | – |
| Pagination | `ui/Pagination.svelte` (144 Z.) | Seitennavigation (Phone-/Desktop-Join) | `page`, `pageCount`, `total` (Pflicht), `size?` (ignoriert), `onSize?` (ignoriert) | `onPage(page)` (Pflicht) | – | `buttons` (5er-Fenster), `compactButtons` (3er) | – |
| PdfViewer | `ui/PdfViewer.svelte` (118 Z.) | PDF-Vorschau via Blob-URL-Iframe | `documentId` (Pflicht), `kind: 'document'\|'reminder'='document'`, `height='720px'` | – | – | `iframeSrc`, `blobUrl`, `loadError` | – (nutzt `busy`, `handleClientError`) |
| QuickTimeEntryModal | `ui/QuickTimeEntryModal.svelte` (184 Z.) | „Arbeit erfassen"-Modal auf Beleg-Detail | `open` (bindable, false), `documentId` (Pflicht), `onClose` (Pflicht) | `onClose()` | – | `date` (heute ISO), `hours=1`, `task=''`, `errorMsg`, `employee` ($derived aus `currentEmployeeRemote()`) | – |
| SearchablePicker | `ui/SearchablePicker.svelte` (284 Z.) | Einzelauswahl-Dialog mit Server-Suche | `value: string` (bindable, ''), `valueLabel` (bindable, ''), `placeholder='Bitte wählen'`, `dialogTitle='Auswählen'`, `emptyText='Keine passenden Einträge gefunden.'`, `search` (Pflicht), `disabled=false`, `triggerSize: 'sm'\|'md'='md'`, `createLabel?`, `onCreateNew?` | `onSelect(item \| null)` (Pflicht), `onCreateNew?()` | – | `dialog`, `searchInput`, `q`, `page`, `items`, `total`, `pageCount`, `loading`, `searchTimer` | Pagination, Loader |
| StatCard | `ui/StatCard.svelte` (60 Z.) | Kennzahlkarte | `title`, `value: string\|number` (Pflicht), `desc?`, `icon?: Component`, `color?: primary\|success\|warning\|error\|info` | – | – | – | – |
| TabGroup | `ui/TabGroup.svelte` (184 Z.) | App-weite Tabs (State-/Nav-Modus) | `name` (Pflicht, eindeutig), `tabs: TabItem[]` (Pflicht), `active?` (bindable; Default aus `?tab=` oder erster Tab), `urlParam: string\|null='tab'`, `contentClass='p-4'` | – | `content?: Snippet<[tabId]>` | `navValue`, `isNav`, `activeId` | – |
| ToastTray | `ui/ToastTray.svelte` (46 Z.) | Rendert `toast.current` | – | – | – | – | – |
| Toolbar | `ui/Toolbar.svelte` (65 Z.) | Such-/Filterleiste für Listen | `query` (bindable, ''), `placeholder='Suchen…'` | `onQuery?(q)` (250 ms debounced) | `filters?`, `actions?` | `timer` | – |
| VehicleDocuments | `ui/VehicleDocuments.svelte` (297 Z.) | Dokumente-Karte eines Fahrzeugs (Upload/Anzeigen/Löschen) | `vehicleId` (Pflicht), `initial: VehicleDocumentItem[]` (Pflicht) | – | – | `docs` (Snapshot aus `initial`), `note`, `fileInput`, `pendingDelete`, `confirmOpen` | ConfirmDialog, EmptyState |
| PageHeader (Layout) | `layout/PageHeader.svelte` (33 Z.) | Schreibt Titel/Back/Primary in `pageHeader`-Store | `title` (Pflicht), `back?: BackTarget`, `primaryAction?`, `subtitle?` (ignoriert) | – | `toolbar?: Snippet` | – | – |
| AppShell (Layout) | `layout/AppShell.svelte` (511 Z.) | Drawer-Shell, Header mit Ladebalken, Sidebar, User-Menü, Unsaved-Guard, Idle-Logout, Suche | `children?`, `companyName='TwinCarsManager'`, `currentUser?` | – | `children` | `unsavedOpen`, `pendingTarget`, `hasInAppHistory`, `searchOpen`, `isMac` | Loader (overlay), ConfirmDialog, GlobalSearch |

### 4.2 Detailbeschreibungen

#### CompactCustomerCard (`src/lib/components/ui/CompactCustomerCard.svelte`)
- Zweck: kompakte Halterkarte (Kundennr., Name, Telefon, E-Mail, Link „Zum Kunden"); Name-Präzedenz `company` → `firstName lastName` → `customerNumber` (Z. 35-37); fehlende Werte als `-` (Z. 55, 57).
- Keine Interaktion außer `<a class="btn btn-ghost btn-sm" href>` (Z. 47); a11y: `<dl>`-Definitionsliste, Icon `User` ohne aria (dekorativ, aber ohne `aria-hidden`).
- DaisyUI: `card border border-base-300 bg-base-100`, `card-body`, `card-title`, `btn btn-ghost btn-sm`.
- Verwendung: 1 Datei — `src/routes/vehicles/[id]/+page.svelte` (Halter-Tab).
- Nachzubauen: Label-Präzedenz, Dash-Fallback, `title`-Prop.

#### ConfirmDialog (`src/lib/components/ui/ConfirmDialog.svelte`)
- Rendering nur bei `open` (`{#if open}`, Z. 84) als `<dialog class="modal modal-open">` + `$effect` ruft `showModal?.()` (Z. 43-47) → **native Fokusfalle, Esc, Fokusrückgabe** an den Trigger (Kommentar Z. 36-41; `docs/architecture/styling.md:52-55`).
- Esc: `oncancel` → `preventDefault` + `handleCancel` (Z. 77-81, 88). Backdrop: `<button class="modal-backdrop" aria-label="Schließen">` (Z. 116-121).
- `handleConfirm`: Re-Entrancy-Guard `inFlight` (nicht reaktiv, Z. 32, 56-71); bei Erfolg `closeDialog()` (native `close()` → `open=false` → `onClose()`); bei Rejection bleibt der Dialog offen, `console.error('[ConfirmDialog] onConfirm rejected:')`, kein Re-Throw (Z. 62-68).
- Buttons: beide `disabled={busy.active}` (Z. 99, 108); Spinner `loading loading-spinner loading-sm` bei `busy.active` (Z. 110-111); Confirm-Klasse `btn-error` (danger) / `btn-primary` (Z. 105-106).
- a11y-Lücke: kein `aria-labelledby` auf dem Dialog (Titel `<h3>`, Z. 91).
- DaisyUI: `modal`, `modal-open`, `modal-box`, `modal-action`, `modal-backdrop`, `btn btn-ghost`, `btn-error`, `btn-primary`, `loading-spinner`.
- Verwendung: 31 Dateien / 36 Tags, z. B. `AppShell.svelte:500-511` (Ungespeicherte Änderungen), `VehicleDocuments.svelte:288-296`, `customers/[id]/+page.svelte`, `invoices/+page.svelte`, `hours/+page.svelte`.
- Nachzubauen: Defaults „Bestätigen"/„Abbrechen"; `onClose` feuert auch nach Confirm; Dialog bleibt bei Fehler offen; Busy-Sperre beider Buttons; Unsaved-Text im AppShell: Titel „Ungespeicherte Änderungen", Text „Es gibt ungespeicherte Änderungen. Sollen sie verworfen werden?", Buttons „Verwerfen"/„Bleiben", Variante danger (`AppShell.svelte:500-511`).

#### CustomerVehiclePicker (`src/lib/components/ui/CustomerVehiclePicker.svelte`)
- Regeln (Kommentar Z. 3-23, Code Z. 111-152): Fahrzeug zuerst → Halter wird übernommen (`item.customerId/customerLabel`); Kunde zuerst → Fahrzeugsuche auf `customerId` eingeschränkt (Z. 98-103); Kundenwechsel löscht fremdes Fahrzeug (Z. 125-129); Kunde leeren löscht Fahrzeug (Z. 112-124); `vehicleLocked` friert Fahrzeug ein und macht Trigger `disabled` (Z. 118, 202).
- Dialogtitel/Placeholder abhängig vom Kundenkontext: „Fahrzeug des Kunden wählen" / „Fahrzeug wählen (Kunde wird übernommen)"; „Fahrzeug dieses Kunden suchen" / „Fahrzeug oder Halter suchen" (Z. 191-196); Leertext ohne Kunde: „Keine passenden Einträge gefunden. Zuerst Kunden wählen, um ein neues Fahrzeug anzulegen." (Z. 197-199).
- „Neu anlegen": Kunde `createLabel='Neuen Kunden anlegen'` nur mit `onCreateCustomer` (Z. 176-177); Fahrzeug `'Neues Fahrzeug anlegen'` nur mit Kunde **und** `onCreateVehicle` (`canCreateVehicle`, Z. 155, 203-204).
- Layout: bewusst `div + span.label-text` statt `FormField`-`<label>` (Kommentar Z. 158-163: Label würde Klicks in den Dialog weiterreichen und Dialogtext in den accessible name mischen); Pflichtmarker ` *`; `customerError` rot (`text-error text-sm`, Z. 179-181); `vehicleHint` (Z. 206-208).
- Interner State-Fallstrick: `lastCustomerId` ist eine einmal initialisierte Plain-Variable (Z. 109) — nicht reaktiv gegenüber späteren Prop-Änderungen (Befund B-112).
- Verwendung: 5 Dateien — `calendar/CalendarForm.svelte`, `invoices/new/+page.svelte`, `offers/new/+page.svelte`, `orders/WorkOrderForm.svelte`, `tire-storage/TireStorageForm.svelte`.

#### EmailComposer (`src/lib/components/ui/EmailComposer.svelte`)
- Felder: „Betreff" (`input`, `maxlength=200`, Z. 116-124), „Nachricht" (`textarea min-h-40`, `maxlength=50000`, Z. 126-135; Label wird zu „Nachricht (HTML-Quelltext)" bei `asHtml`), Toggle „Als HTML senden" (`checkbox checkbox-sm checkbox-primary`, nur bei `allowHtml`, Z. 136-155) mit Erklärtext (Z. 147-153), optionaler `hint` (Z. 156-158), Anhänge (Z. 161-210).
- Anhänge: Button „Datei wählen" (`Paperclip`), verstecktes `<input type=file multiple>` **ohne `accept`** (Z. 173-180); je Datei `size > maxBytesPerFile` → `toast.error('„<name>" ist größer als <MB> MB.')` und übersprungen (Z. 74-82); Lesen als DataURL, Base64 ohne Präfix (Z. 57-67); `ComposerAttachment = { filename, mime (Fallback application/octet-stream), size, base64Data }` (Z. 21-26, 87-95); Lesefehler → `toast.error('„<name>" konnte nicht gelesen werden.')` (Z. 97); Chips mit `formatSize` (B/KB/MB, Z. 108-112) und Entfernen-Button `aria-label="Anhang entfernen"` (Z. 198-206); Leertext „Keine Anhänge ausgewählt. Maximal 10 MB pro Datei." (hart codiert, Z. 182-185).
- Alle Controls `disabled={disabled || busy.active}`. Kein Remote-Aufruf (Kommentar Z. 6-10).
- Verwendung: 2 Dateien — `customers/[id]/+page.svelte:569-575` (Ad-hoc-Mail, `allowHtml`), `mailings/+page.svelte:141-149` (Newsletter, `disabled={!canCompose}`, langer `hint`).

#### EmptyState (`src/lib/components/ui/EmptyState.svelte`)
- Randlos (Kommentar Z. 16-21), zentriert, Icon in `bg-base-200 rounded-full p-4` (Z. 25-27), `h3` Titel, optionale Beschreibung, optionales `action`-Snippet (Z. 29-34). Keine Rolle/aria.
- Verwendung: 22 Dateien / 26 Tags — alle Listenseiten (`customers`, `employees`, `hours`, `inventory`, `invoices`, `items`, `ledger`, `mailings`, `offers`, `posts`, …) + `VehicleDocuments.svelte:207-211`.

#### FormField (`src/lib/components/ui/FormField.svelte`)
- Ganzer Feldblock ist **ein `<label>`** (Z. 50): Label-Text + ` *` (Z. 51-53), `children`-Snippet, dann `error` (`text-error text-sm`) **oder** `hint` (`text-base-content/60 text-xs`) — Fehler gewinnt (Z. 55-59). `colSpan` auf dem Wrapper.
- Konsequenz: das erste labelable Element im Snippet wird per `label.control` assoziiert (Test `FormField.test.ts:72-83`); Picker-Trigger müssen daher ein echtes `<button>` bleiben (`SearchablePicker.svelte:145-153`).
- Verwendung: 13 Dateien / 70 Tags — `CustomerForm`, `EmployeeForm`, `HoursForm`, `ItemForm`, `login/+page`, `WorkOrderForm`, `PostForm`, `settings/account`, `RoleForm`, `SupplierForm`, `TireForm`, `TireStorageForm`, …
- Nachzubauen: Label oben, Required-Marker ` *`, Fehler-vor-Hint-Regel; in Nuxt UI `UFormField` mit `label`/`required`/`error`/`hint`/`help` — Assoziation dort über `for`/`id` statt Wrapping.

#### GlobalSearch (`src/lib/components/ui/GlobalSearch.svelte`)
- Buckets in fester Reihenfolge mit deutschen Labels und Icons (Z. 60-117): Kunden, Fahrzeuge, Artikel, Reifen, Reifeneinlagerungen, Lieferanten, Mitarbeiter, Belege, Aktuelle Informationen; leere Buckets ausgeblendet (Z. 116); Zählung `(N)` im Sticky-Header (Z. 300-308).
- Routing je Treffer (Z. 131-158): `/customers/:id`, `/vehicles/:id`, `/items/:id`, `/tires/:id`, `/tire-storage/:id`, `/suppliers/:id`, `/employees/:id`, `/posts/:id`; Belege: `invoice`/`credit_note` → `/invoices/:id`, sonst `/offers/:id`.
- Suche: `oninput` → 250 ms Debounce (Z. 191-196); < 2 Zeichen (getrimmt) → keine Anfrage, Text „Mindestens 2 Zeichen eingeben." (Z. 173-178, 278-283); Laden nur bei leerer Trefferliste sichtbar „Suche läuft…" (Z. 284-289); leer „Keine Treffer." (Z. 290-295); `maxlength=200` (Z. 260).
- Tastatur: `<svelte:window onkeydown>` (Z. 243): Esc schließt, ↑/↓ zyklisch über `flatHits`, Enter öffnet aktiven Treffer (Z. 204-228); Fußzeile mit `<kbd>`-Hinweisen (Z. 341-357); `onmouseenter` setzt `activeIndex` (Z. 321).
- Fokus: `queueMicrotask(() => input?.focus())` bei `open` (Z. 235-240); **kein `showModal()`** → keine native Fokusfalle, keine Fokusrückgabe; Dialog ohne `aria-label`/`aria-labelledby`; Treffer sind `<button>`s ohne `listbox/option`-Semantik, aktiver Eintrag nur per `bg-base-200`/`data-active` (Z. 315-332) (Befund B-088).
- Schließen: `close()` setzt `open=false` und resettet `q/results/activeIndex/loading` (Z. 160-170); Header-X `aria-label="Schließen"` (Z. 263-270), Backdrop `aria-label="Dialog schließen"` (Z. 359-364).
- DaisyUI: `modal modal-open`, `modal-box … h-[80dvh] max-h-[640px] max-w-2xl p-0`, `input input-bordered`, `btn btn-ghost btn-square btn-xs`, `kbd kbd-xs`, `divide-y`.
- Verwendung: 1 Datei — `AppShell.svelte:498` (Trigger `data-testid="global-search-trigger"` Z. 276-290 und Phone-Icon Z. 307-314; Cmd/Ctrl+K Z. 226-236).

#### ImageUploader (`src/lib/components/ui/ImageUploader.svelte`)
- Modi: `single` (Logo/Beitragsbild: eine Vorschau `h-40`, Buttons „Bild ersetzen"/„Bild hinzufügen"/„Bild entfernen") und Galerie (`grid sm:grid-cols-2 lg:grid-cols-3`, Badge „Titelbild" `badge badge-warning badge-sm`, Buttons „Als Titelbild festlegen" (nur auf Nicht-Cover) / „Löschen", CTA „Bilder hinzufügen") (Z. 219-350).
- Validierung (`ingest`, Z. 89-112): MIME muss `^image\/` matchen → sonst `toast.error('„<name>" ist keine Bilddatei.')`; `size > maxBytes` → `'„<name>" ist größer als <MB> MB.'`; **ein ungültiges File verwirft die ganze Auswahl** (early `return`, Z. 92-101; Test `ImageUploader.test.ts:297-309`); dann `busy.run` über alle Dateien sequenziell `readDataUrl` → `onUpload({ mime, dataUrl })` (Z. 102-108); Fehler stumm verschluckt (`catch {}` Z. 109-111, ebenso `remove`/`setMain` Z. 162-178).
- `<input type=file accept="image/png,image/jpeg,image/webp" multiple={!single}>` (Z. 329-337); `single` + Multi-Drop → nur erste Datei (Z. 155-159). **Kein Resize/Kompression clientseitig.**
- Drag&Drop über die ganze Karte (`role="region" aria-label={title}`, Z. 192-203): `dragDepth`-Zähler (Z. 73-74, 128-147), Overlay „Dateien hier ablegen" (Z. 204-210), aktiver Zustand `border-primary border-dashed` (Z. 193-195; Befund B-097).
- Leerzustände: „Kein Bild hinterlegt" (single) / „Noch keine Fotos hinterlegt" + „Bilder hierher ziehen oder Datei auswählen" (Z. 230-239, 300-309). Kein eigener Ladezustand (global `busy`); alle Buttons + File-Input `disabled={busy.active}`.
- Limits im Bestand: Default `maxBytes = 20 MiB` (Z. 60) vs. JSDoc „5 MB" (Z. 18-19); Aufrufer: `settings/+page.svelte:208-211` (single, `allowSetMain=false`, 5 MB, Hint „…max. 5 MB"), `posts/PostForm.svelte:176-179` (single, 5 MB), `tires/[id]/+page.svelte:216` (Hint „bis 8 MB pro Foto", **kein** `maxBytes`), `vehicles/[id]/+page.svelte:610` (Galerie, kein `maxBytes`) (Befund B-098).
- Verwendung: 4 Dateien.

#### Loader (`src/lib/components/ui/Loader.svelte`)
- Varianten: `block` (`h-32`, `role="status" aria-live="polite"`, Z. 53-60), `inline` (`inline-flex`, ohne Rolle, Z. 37-41), `overlay` (`absolute inset-0 z-20 bg-base-100/70 backdrop-blur-sm`, `role="status" aria-live="polite" aria-busy="true"`, Z. 42-51). Kein `bar`-Variant (Kommentar Z. 14-16).
- Verwendung: `AppShell.svelte:386` (overlay bei `busy.slow`), `SearchablePicker.svelte:240`, `MultiSearchablePicker.svelte:260`.

#### MultiSearchablePicker (`src/lib/components/ui/MultiSearchablePicker.svelte`)
- Trigger wie SearchablePicker (echtes `<button class="input input-bordered …">`, Z. 178-210); Triggertext: Placeholder / bis 2 Labels mit `, ` / „N ausgewählt" (Z. 80-86); Clear-`span[role=button] aria-label="Auswahl entfernen"` mit Enter/Space (Z. 143-148, 195-206), Klick-Routing über `closest('[data-picker-clear]')` (Z. 155-163).
- Dialog `<dialog class="modal">` immer gemountet, `showModal()` bei `open()` (Z. 102-110): `page=1`, `selection` aus `values` + `labelMap` geseedet (Z. 105), Fokus auf Suchfeld per `queueMicrotask`, Initialsuche mit aktuellem `q` (**`q` wird nicht zurückgesetzt**; Befund B-095).
- Suche: 250 ms Debounce, `page=1` (Z. 115-120); Zeilen sind `<label>` mit `checkbox checkbox-sm` (Z. 272-283); Auswahl bleibt über Seiten erhalten (Map, Z. 122-127).
- **Transaktional**: „Übernehmen (N)" schreibt `values`/`valueLabels` (immer `Map`), ruft `onChange(values)`, schließt (Z. 129-134); „Abbrechen"/X/Backdrop/Esc (nativ) verwerfen (Z. 111-113, 301-303, 310-315). Clear am Trigger wirkt sofort ohne Dialog (Z. 136-141).
- „Neu anlegen": nur mit `createLabel` **und** `onCreateNew`, genau einmal im Header neben X; Dialog schließt vor dem Callback (Z. 73, 164-168, 221-231).
- Zustände: Loader nur bei `loading && items.length === 0` (Z. 258-261); `emptyText` zentriert (Z. 262-268); Pagination unten (Z. 288-298).
- Verwendung: 1 Datei — `orders/WorkOrderForm.svelte` (Zuständige); Labels-Map-Konvertierung für JSON-Drafts dokumentiert in `docs/architecture/creation-flow.md:52-57`.

#### MultiSelect (`src/lib/components/ui/MultiSelect.svelte`)
- Client-seitiges Multiselect über eine übergebene `options`-Liste: Trigger `div[role=button] tabindex=0 aria-haspopup=listbox aria-expanded aria-disabled` (Z. 109-127), Chips `badge badge-neutral badge-sm` mit Entfernen-Button `aria-label='„<label>" entfernen'` (Z. 132-149), Dropdown `div[role=listbox]` absolut positioniert (Z. 155-160) mit Filterfeld `type=search` Placeholder „Filtern…" (Z. 161-176), Optionen als `<button aria-pressed>` in `menu menu-sm` mit `aria-hidden` Read-only-Checkbox (Z. 183-219); Filter auf `label`/`sublabel` case-insensitive (Z. 38-46).
- Tastatur: Enter/Space öffnet (Z. 119-125), Esc schließt (window-Listener, Z. 89-95), Outside-`pointerdown` schließt (Z. 83-88); **keine Pfeiltasten-Navigation**, Optionen per Tab erreichbar.
- Leerzustände: `options.length === 0` → `emptyHint`, sonst „Keine Treffer." (Z. 178-181). `toggle`/`removeChip` rufen `onChange(next)` (Z. 48-63).
- Verwendung: 2 Dateien — `settings/users/new/+page.svelte:152-158`, `settings/users/[id]/edit/+page.svelte:161-167` (Rollen; `emptyHint="Noch keine Rollen vorhanden. Legen Sie zuerst eine Rolle an."`). Doppelimplementierung zu `MultiSearchablePicker` (Befund B-094).

#### Pagination (`src/lib/components/ui/Pagination.svelte`)
- `role="navigation" aria-label="Seitennavigation"` (Z. 30-31); Caption `<total de-DE> Treffer · Seite <page> von <max(1,pageCount)>` (Z. 33-38).
- Zwei `join`s: Phone (`sm:hidden`, prev/3er-Fenster/next, Z. 46-84) und Desktop (`hidden sm:flex`, first/prev/5er-Fenster/next/last, Z. 87-143); Fenster via `paginationButtons` (Z. 23-25); Ellipsen als `btn-disabled` + echtes `disabled` (Z. 60-62, 110-112); aktive Seite `btn-primary` + `aria-current="page"` (Z. 66-72, 116-122); Chevrons mit `aria-label` „Erste/Vorherige/Nächste/Letzte Seite".
- `size`/`onSize` werden angenommen, aber ignoriert (Z. 14-18, 21) — Seitengröße app-weit 25 (`CONTRIBUTING.md:781-855`).
- Verwendung: 23 Dateien / 24 Tags — alle Listen + beide Picker-Dialoge.

#### PdfViewer (`src/lib/components/ui/PdfViewer.svelte`)
- Lädt in `onMount` per `setTimeout(load, 0)` (Z. 82-87) die Bytes via `busy.run(() => fetchBytes(documentId))` (Z. 66; Kind-Routing Z. 44-47), dekodiert Base64 (Z. 53-58), baut `Blob` mit `res.mime`, `URL.createObjectURL`, Iframe-`src = <blob>#<encodeURIComponent(filename mit .pdf)>` (Z. 60-75); revoke bei Reload und `onDestroy` (Z. 70, 89-91).
- Zustände: Platzhalter „Vorschau wird geladen …" mit `style="height: {height}"` (Z. 109-115), Fehler `alert alert-error role="alert"` „PDF konnte nicht geladen werden." **und** `handleClientError(err, 'PDF-Vorschau')` (Z. 76-79, 98-101), Iframe `title="PDF-Vorschau"` `rounded-md` (dokumentierte Ausnahme, `CONTRIBUTING.md:533-536`).
- Keine eigenen Download/Print-Buttons (Kommentar Z. 9-13).
- Verwendung: 4 Dateien — `invoices/[id]`, `offers/[id]`, `reminders/[id]` (kind `reminder`), `sent/[id]`.

#### QuickTimeEntryModal (`src/lib/components/ui/QuickTimeEntryModal.svelte`)
- Felder: „Datum *" (`type=date`, Default heute ISO, Z. 27-29, 128-135), „Stunden *" (`type=number min=0.25 max=24 step=0.25`, Default 1, Z. 137-147), „Was wurde gemacht? *" (`maxlength=200`, Placeholder „z. B. Bremsen prüfen", Z. 149-157); Hinweis „Eingetragen für: <Vorname Nachname>" wenn Mitarbeiter aufgelöst (Z. 120-126).
- Validierung click-time in fester Reihenfolge, nur **eine** Meldung als `alert alert-error role="alert"` (Z. 53-81, 115-119): „Es ist kein Mitarbeiterprofil mit Ihrem Konto verknüpft." / „Bitte ein Datum eingeben." / „Bitte eine positive Stundenzahl eingeben." / „Maximal 24 Stunden pro Eintrag." / „Bitte angeben, was gemacht wurde." / „Beschreibung darf maximal 200 Zeichen lang sein."; keine Feldmarkierung.
- Submit: `busy.run(createTimeEntryRemote({ employeeId, date, hours, documentId, task }))` → `toast.success('Stunden erfasst.')` → `listTimeEntriesRemote({ page:1, size:25, documentId }).refresh()` → `close()` (Z. 83-104); Fehler via `handleClientError(err, 'Stunden konnten nicht erfasst werden')`.
- Dialog: `{#if open}<dialog class="modal modal-open">` **ohne `showModal()`**, ohne `oncancel`, ohne Esc-Handling, ohne Fokusverwaltung (Z. 107-183) (Befund B-089); Backdrop `aria-label="Schließen"`; Formular `novalidate`; Buttons „Abbrechen"/„Speichern" `disabled={busy.active}` + Spinner.
- Verwendung: 2 Dateien — `invoices/[id]/+page.svelte:877-881`, `offers/[id]/+page.svelte:385-389` (jeweils `onClose={() => {}}`).

#### SearchablePicker (`src/lib/components/ui/SearchablePicker.svelte`)
- Generisch `T extends { id, label }` (Z. 1). Trigger: `<button type=button class="input input-bordered flex … [input-sm]" disabled>` mit Text `valueLabel` oder `placeholder` (Z. 154-186); Clear-`span[role=button] tabindex=0 aria-label="Auswahl entfernen" data-picker-clear` nur bei `value && !disabled` (Z. 171-183); Klick-Routing über `closest('[data-picker-clear]')` (Z. 114-129; Regression beschrieben Z. 115-121), Tastatur Enter/Space (Z. 131-136); Chevron-Icon.
- Dialog `<dialog class="modal">` immer gemountet; `open()` → `page=1`, `showModal()`, Fokus auf Suchfeld per `queueMicrotask`, Initialsuche (Z. 79-87); `q` bleibt zwischen Öffnungen erhalten (B-095). Feste Maße `h-[80dvh] max-h-[640px] max-w-2xl` (Z. 193-195; `CONTRIBUTING.md:713-715`).
- Suche: `oninput` → 250 ms Debounce, `page=1` (Z. 93-98); `search({ q, page, size: 25 })`; Loader (`Loader` block) nur bei `loading && items.length === 0` (Z. 238-241); `emptyText` (Z. 242-247); Zeilen als `<button class="hover:bg-base-200 …">` mit Badge `badge badge-primary badge-sm` „ausgewählt" für `item.id === value` (Z. 249-264); Auswahl schreibt `value`/`valueLabel`, ruft `onSelect(item)`, schließt (Z. 100-105).
- Header: `dialogTitle`, optional „Neu anlegen"-Button (`Plus` + `createLabel`, nur mit `onCreateNew`; schließt zuerst, Z. 138-142, 201-210), X `aria-label="Schließen"` (Z. 211-218); Backdrop `aria-label="Dialog schließen"` (Z. 278-283); Pagination im Dialog (Z. 267-276).
- Esc: nativ durch `showModal()` (kein eigener Handler) → Dialog schließt ohne Auswahl.
- Verwendung: 10 Dateien / 17 Tags — `CustomerVehiclePicker`, `CalendarForm`, `calendar/+page` (Filter, `triggerSize="sm"`), `HoursForm`, `hours/+page`, `hours/reports/+page`, `invoices/PositionsEditor` (3×, sm), `orders/[id]/+page`, `orders/+page` (sm), `VehicleForm`.
- E2E-Helfer `pickFromSearchablePicker` (`e2e/helpers.ts:113-146`) verlässt sich auf: Trigger-Button mit sichtbarem Text, `dialog[open]` mit Titel, Placeholder „Suchen…", Optionszeile als Button, Dialog schließt nach Auswahl.

#### StatCard (`src/lib/components/ui/StatCard.svelte`)
- Titel (`uppercase text-xs`), Wert (`truncate text-xl … tabular-nums`, `title={String(value)}` für Tooltip, Z. 29-34), `desc`, Icon-Kachel mit Farbpaar (`bg-<color> text-<color>-content`, Fallback `bg-base-200 text-base-content`, Z. 39-57). Kein DaisyUI-`stat`.
- Verwendung: 4 Dateien / 17 Tags — Dashboard `routes/+page.svelte`, `ledger`, `reminders`, `sales-ledger`.

#### TabGroup (`src/lib/components/ui/TabGroup.svelte`)
- `TabItem = { id, label, icon?, badge?, href?, exact? }` (Z. 9-22). Markup: `div[role=tablist].tabs.tabs-lift` → pro Tab `label.tab` mit `input[type=radio name=… aria-label=label]` + Icon + Label + `badge badge-sm` (Z. 148-177), direkt gefolgt von `div.tab-content border border-base-300 bg-base-100 {contentClass}` (Z. 178-182).
- State-Modus: `active` bindable, initial aus `?<urlParam>=` wenn gültig, sonst erster Tab (Z. 70-89); Effekt spiegelt per `replaceState` (erster Tab löscht den Param, Z. 129-135); verschwindet der aktive Tab → erster Tab (Z. 138-143); **alle Panels bleiben gemountet** (CSS blendet aus).
- Nav-Modus (alle Tabs mit `href`, Z. 92): aktiv aus `page.url.pathname` (exact oder Präfix `href + '/'`, Z. 94-101), Radio-`onchange` → `goto(href)`; bei abgelehnter Navigation (Unsaved-Guard) `navValue` zurückgesetzt (Z. 115-122); nur aktives Panel rendert `content` (Z. 179).
- Tastatur: Pfeiltasten über native Radio-Gruppe (Test `TabGroup.test.ts:110-118`). a11y: `role=tablist` enthält Radios statt `role=tab`/`tabpanel` (Befund B-091).
- Verwendung: 4 Dateien / 5 Tags — `customers/[id]/+page.svelte`, `vehicles/[id]/+page.svelte`, `hours/reports/+page.svelte` (State), `settings/+layout.svelte` (Nav). Listen-Filtertabs (`tabs-box`/`tabs-border`) in `customers/+page`, `vehicles/+page`, `hours/+page`, `tire-storage/+page` sind bewusst **kein** TabGroup (`CONTRIBUTING.md:568-570`).

#### ToastTray (`src/lib/components/ui/ToastTray.svelte`)
- Rendert `toast.current` als `div.toast.toast-top.toast-end.z-[60]` mit `div[role=status aria-live=polite].alert.border.border-base-300.shadow-md` (einzige erlaubte Shadow, `CONTRIBUTING.md:524-527`), Variantenklasse `alert-success|warning|error|info`, Icon je Variante (Z. 11-16), Dismiss-Button `aria-label="Benachrichtigung schließen"` (Z. 36-43). Keine Stapelung, keine Animation.
- Verwendung: 1 Datei — `routes/+layout.svelte:88`.

#### Toolbar (`src/lib/components/ui/Toolbar.svelte`)
- `card border border-base-300 bg-base-100 … p-3` ohne `card-body` (Kommentar Z. 30-35); Suchfeld `label.input.input-bordered.input-sm` mit `Search`-Icon, `input[type=search maxlength=200]` (Z. 40-52) **ohne aria-label** (nur Placeholder); `filters`-Snippet (Z. 54-58), `actions`-Snippet rechts (`sm:ms-auto`, Z. 60-64).
- `handleInput`: schreibt `query` sofort (bindable), ruft `onQuery(query)` 250 ms debounced (Z. 21-27).
- Verwendung: 14 Dateien — `customers`, `employees`, `inventory`, `invoices`, `items`, `ledger`, `offers`, `posts`, `sent`, `settings/users`, `suppliers`, `tires`, …

#### VehicleDocuments (`src/lib/components/ui/VehicleDocuments.svelte`)
- Karte „Dokumente" mit Untertitel „Fahrzeugpapiere, Kaufverträge, HU-Berichte - als PDF oder Bild, bis 15 MB." (Z. 196-203); Tabelle Name/Größe/Datum/Notiz/Aktionen (Z. 213-255; keine Row-Navigation, keine Pagination); Leerzustand `EmptyState` „Keine Dokumente vorhanden" / „Laden Sie das erste Dokument über den Button unten hoch." (Z. 206-211).
- Upload: Notizfeld (`maxlength=500`, Placeholder „Notiz zum Upload (optional)", Z. 259-265), verstecktes `<input type=file accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp">` **einzeln** (Z. 266-273), Button „Dokument hochladen"; Client-Prüfung MIME-Allowlist mit Extension-Fallback (Z. 54-69, 89-95) → `toast.error('„<name>" wird nicht unterstützt. Erlaubt sind PDF, JPEG, PNG und WebP.')`; `> 15 MiB` → `'„<name>" ist größer als 15 MB.'` (Z. 122-137); dann `busy.run(upload + refresh)`, `note=''`, `toast.success('Dokument hochgeladen.')` (Z. 138-155). Kein Drag&Drop.
- Anzeigen: `busy.run(getVehicleDocumentRemote({id}).run())`, Blob-URL + `#<fileName>`, `window.open(_blank, noopener)`, Revoke nach 60 s (Z. 157-174).
- Löschen: `ConfirmDialog` Titel „Dokument löschen", Text „Möchten Sie „<fileName>" wirklich löschen?", Button „Endgültig löschen", danger (Z. 287-297) → `busy.run(delete + refresh)`, `toast.success('Dokument gelöscht.')` (Z. 181-193).
- Formatierung: `formatSize` (MB mit max. 1 Nachkommastelle de-DE / KB min 1), `fmtDate` `dd.mm.yyyy` (Z. 106-120).
- Verwendung: 1 Datei — `vehicles/[id]/+page.svelte`.

#### PageHeader (`src/lib/components/layout/PageHeader.svelte`) — Einordnung
- Rendert keinen Titel; `$effect` schreibt `{ title, back, primaryAction }` in `pageHeader` und resettet beim Unmount (Z. 23-26); `subtitle` wird ignoriert (Z. 17-18); optionales `toolbar`-Snippet in `div.mb-4` (Z. 29-33). Verwendung: 78 Seiten.

#### AppShell (`src/lib/components/layout/AppShell.svelte`) — Einordnung (Hauptdoku: Layout-Agent)
- Drawer `lg:drawer-open`, Header `navbar h-[68px]` mit Menü-Label, Zurück-Button (History-bewusst, Z. 172-196), Such-Trigger + `kbd` ⌘K/Strg+K, Seitentitel (mobil), Primary-Action (Link oder Button, Z. 315-337), **einziger Ladebalken** `<progress class="progress progress-primary">` via Opacity (Z. 347-358); `main` `aria-busy`/`inert` bei `busy.slow` + `Loader overlay` (Z. 379-388); Sidebar `menu menu-sm` permission-gefiltert; User-`dropdown dropdown-top` mit Profil/Abmelden; Unsaved-Guard via `beforeNavigate` + `beforeunload` (Z. 39-74); Idle-Logout 1 h (Z. 25, 119-133).

### 4.3 DaisyUI-Muster im Bestand (grep über 132 `.svelte`-Dateien ohne Test-Harnesses)

Zählung aus `class="…"`, `class={'…'}` und `class:…`-Direktiven (Skript im Scratchpad `daisy-count.sh`); Spalten: Vorkommen | Dateien.

| Baustein | Klassen/Elemente | Vorkommen | Dateien | Nuxt-UI-Kandidat (Planungshinweis) |
| --- | --- | --- | --- | --- |
| Button | `btn` 287 / `btn-sm` 170 / `btn-ghost` 150 / `btn-primary` 71 / `btn-square` 60 / `btn-xs` 23 / `btn-outline` 6 / `btn-error` 4 | 287 | 79 | `UButton` (Varianten ghost/solid/outline, Farben, `square`, `size`) |
| Formularfelder | `input`+`input-bordered` 201 / `input-sm` 30 / `label-text` 220 / `label` 29 / `fieldset` 86 / `select(-bordered)` 44 / `textarea(-bordered)` 21 / `checkbox` 22 / `radio` 9 / `toggle` 4 / `file-input` 2 | ≈ 640 | 42+ | `UInput`, `USelect`, `UTextarea`, `UCheckbox`, `URadioGroup`, `USwitch`, `UFormField`, `UFileUpload`/`UInput type=file` |
| Card | `card` 151 / `card-body` 150 / `card-title` 79 | 151 | 72 | `UCard` (flat, ohne Shadow, Border `base-300`) |
| Badge | `badge` 87 | 87 | 37 | `UBadge` |
| Alert | `alert` 63 / `alert-error` 37 / `alert-info` 12 / `alert-warning` 7 / `alert-success` 3; `role="alert"` 34× | 63 | 45 | `UAlert` (Fehlerzusammenfassung in ~30 Formularen) |
| Table | `<table class="table">` 50; Zeilen `hover:bg-base-200 cursor-pointer` in 23 Dateien; `table-zebra` 0 | 50 | 37 | `UTable` **oder** native Tabelle (klickbare Zeilen, `<tfoot>`-Summen, `stopPropagation`-Aktionszellen müssen erhalten bleiben) |
| Loading | `loading loading-spinner` 37; `<progress>` 3 (AppShell-Ladebalken + 2 weitere) | 37 | 31 | `UProgress` (nur global), Spinner-Icon in Buttons |
| Modal/Dialog | `<dialog>` 14 in 10 Dateien; `modal modal-open` 12 Dateien (davon 9 route-lokal hand-gerollt, 3 davon mit `showModal()`); `modal-box` 14 / `modal-action` 11 / `modal-backdrop` 14 | 14 | 14 | `UModal` (ein Wrapper für ConfirmDialog, Picker-Dialoge, GlobalSearch, QuickTimeEntry, 9 Routen-Modale) |
| Join | `join` 7 / `join-item` 24 | 24 | 6 | `UPagination` (Pagination), `UButtonGroup` |
| Tabs | `tabs` 5 / `tab` 13 / `tabs-lift` 1 (nur TabGroup) / `tab-content` 2; Filtertabs `tabs-box`/`tabs-border` in 4 Listen | 13 | 5 | `UTabs` (State), Nav-Modus = Tabs mit `to`; Filtertabs = `UTabs` variant oder Segmented Control |
| Kbd | `kbd` 5 | 5 | 2 | `UKbd` |
| Link | `link` 17 | 17 | 9 | `ULink` |
| Menu/Dropdown | `menu` 3 / `menu-sm` 2 / `menu-title` 1 / `dropdown` 1 (nur AppShell) | 3 | 2 | `UNavigationMenu`, `UDropdownMenu` |
| Drawer/Navbar | `drawer`, `drawer-side`, `drawer-content`, `navbar` je 1 | 1 | 1 | `USlideover` (mobil) + Layout-Grid |
| Toast | `toast` 1 (ToastTray) | 1 | 1 | `useToast()`/`UToaster` (Verhalten: Einzel-Toast, 4.5 s / 6 s) |
| Steps | `steps`/`step` 1 (Setup-Wizard) | 1 | 1 | `UStepper` |
| Collapse | `collapse` 1 (`settings/import`) | 1 | 1 | `UCollapsible`/`UAccordion` |
| Nicht genutzt | `tooltip`, `stat`, `skeleton`, `avatar`, `divider`, `breadcrumbs`, `table-zebra`, `<style>`-Blöcke (0), lokales `let busy = $state` (0), `shadow-*` außerhalb Toast/AppShell-Dropdown (0) | 0 | 0 | – |

Abweichungen von der Stilregel: `border-dashed` in `ImageUploader.svelte:194` (Drag-Zustand) und `tire-storage/TireStorageForm.svelte`; `rounded-md` in `PdfViewer.svelte:106` (dokumentierte Ausnahme); Inline-`style="height: …"` in `PdfViewer.svelte:107,112`.

---

## 5. Tabellen

Nur lesend über die Picker bzw. über konsumierte Remotes berührt:

| Tabelle | Relevante Spalten für das Modul | Archiv-/Statusregel |
| --- | --- | --- |
| `customers` | `id, company, firstName, lastName, customerNumber, city, phone, mobile, email, archived` | `archived = false` (`pickers.remote.ts:105`); Schema `src/lib/server/db/schema.ts:219` |
| `vehicles` | `id, vin, make, model, hsn, tsn, customerId, firstRegistration, archived` | `archived = false` (Z. 164, 230, 438); Lagerbestand = `customerId IS NULL` (Z. 439) |
| `vehicle_license_plate_versions` | `vehicleId, licensePlate` | Kennzeichensuche + aktuelles Kennzeichen via `latestPlateSubquery` |
| `vehicle_listings` | `vehicleId, status ('available' …), salesPriceGross, differentialTax` | Bestand: `status IS NULL OR 'available'` (Z. 441-443) |
| `employees` | `id, firstName, lastName, personnelNumber, position, privateEmail, privatePhone, mobile, archived` | `archived = false` (Z. 316); Schema Z. 857 |
| `items` (+ `item_price_versions` via `getCurrentItemPrice`) | `id, articleNumber, description, kind ('service','article','material','pass_through'), unit, stockOnHand` | **keine** `archived`-Spalte |
| `suppliers` | `id, name, city, contactPerson, email, archived` | `archived = false` (Z. 522); Schema Z. 531 |
| `documents` | `id, documentNumber, type ('invoice','offer','cost_estimate','order_confirmation', …), issueDate, createdAt, customerId` | Typfilter, kein Statusfilter (Z. 575-581) |
| `tires` (+ `tire_price_versions` via `getCurrentTirePrice`) | `id, articleNumber, brand, model, ean, width, aspectRatio, construction, diameterInch, season, stockOnHand` | **keine** `archived`-Spalte |
| `vehicle_documents` (via `VehicleDocuments`) | `id, vehicleId, fileName, mime, sizeBytes, note, uploadedAt, data` | MIME-Allowlist + 15 MB serverseitig (`vehicle-document-service.ts:24-34`) |
| `time_entries` (via `QuickTimeEntryModal`) | `employeeId, date, hours, documentId, task` | unklar (Hours-Agent) |

---

## 6. Flows (durchgängig)

- **Einzelauswahl über SearchablePicker** — Einstieg: Trigger-Button im Formular/Filter → Dialog öffnet (`showModal`), Fokus im Suchfeld, Initialsuche Seite 1 → Tippen (250 ms) → Klick auf Zeile → `value`/`valueLabel` gesetzt, `onSelect(item)`, Dialog zu → Ende: Trigger zeigt Label + X.
  - Leerzustand: `emptyText` (Default „Keine passenden Einträge gefunden."); Ladezustand: `Loader` „Inhalte werden geladen" nur bei leerer Liste (kein globaler Busy); Validierungsfehler: keine (Suche ist optional); Fehlerzustand: **kein** try/catch in `runSearch` (`SearchablePicker.svelte:67-77`) — Rejection landet als unhandled promise, `loading` wird via `finally` zurückgesetzt, kein Toast (Befund B-113/B-UI-40); Abbruch: X, Backdrop, Esc → ohne Änderung; Berechtigungsverweigerung: 403 aus dem Picker-Guard → dito unhandled; Bestätigung: keine.
- **Auswahl entfernen** — X am Trigger (Maus/Enter/Space) → `value=''`, `onSelect(null)`, Dialog öffnet nicht.
- **Mehrfachauswahl über MultiSearchablePicker** — Trigger → Dialog (Arbeitskopie `selection` aus `values`) → Checkboxen (seitenübergreifend) → „Übernehmen (N)" → `values`/`valueLabels`, `onChange(values)` → Ende. Abbruch (Abbrechen/X/Backdrop/Esc) verwirft; Clear am Trigger → `[]` + `onChange([])`. Zustände wie oben.
- **Kunde + Fahrzeug wählen (CustomerVehiclePicker)** — (a) Fahrzeug zuerst: Dialog „Fahrzeug wählen (Kunde wird übernommen)", Suche auch nach Halter → Auswahl setzt Fahrzeug **und** Kunde; (b) Kunde zuerst: Dialog „Kunde wählen" → Fahrzeugdialog „Fahrzeug des Kunden wählen" mit `customerId`-Filter; Kundenwechsel löscht fremdes Fahrzeug; `vehicleLocked` (Lagerverkauf) sperrt Fahrzeugfeld. Fehleranzeige nur `customerError` (vom Host).
- **Neu anlegen aus dem Picker (Creation-Flow)** — Header-Button „Neu anlegen" (Label vom Host, z. B. „Neuen Kunden anlegen") → Dialog schließt → Host: `creationFlow.start({ entity, returnUrl: currentUrl(), originField, draft, createdAt, leafInitial? })`, `formDirty.clear()`, `goto('/<entity>/new')` → Blatt zeigt Flow-Hinweis, speichert → `creationFlow.finish({ id, label, holder? })` → `goto(returnUrl)` → Host: `pendingReturnFor(currentUrl())` → Draft wiederherstellen, Ergebnis in `originField` auswählen (`docs/architecture/creation-flow.md:50-73`). Abbruch am Blatt: `cancel()` → Draft ohne Ergebnis. Zyklenschutz `activeEntities()`; Stack > 1 h → verworfen; sessionStorage-Quota → nur In-Memory.
- **Bestätigen (ConfirmDialog)** — Aktion → `open=true` → nativer Modal mit Fokusfalle → „Bestätigen" (oder Host-Label, z. B. „Endgültig löschen") → `onConfirm()` (Host: `busy.run(...)`) → bei Erfolg Schließen + `onClose()`; bei Fehler bleibt offen (Host-Toast erklärt). Abbruch: „Abbrechen", Backdrop, Esc → `onClose()`.
- **Ungespeicherte Änderungen (AppShell + ConfirmDialog)** — `formDirty.dirty` + In-App-Navigation → `nav.cancel()`, Dialog „Ungespeicherte Änderungen" → „Verwerfen": `formDirty.clear()` + `goto(pendingTarget)`; „Bleiben": Formular bleibt. Tab-Schließen/Reload → Browser-`beforeunload`-Prompt.
- **Globale Suche** — Navbar-Trigger / Phone-Icon / Cmd|Ctrl+K → Modal, Fokus im Feld → ≥ 2 Zeichen, 250 ms → Buckets → ↑/↓/Enter oder Klick → `goto(route)`, Modal geschlossen und geleert. Leer: „Keine Treffer."; < 2: „Mindestens 2 Zeichen eingeben."; Laden: „Suche läuft…"; Fehler: `runSearch` ohne catch (Befund B-UI-40).
- **Bild hochladen (ImageUploader)** — „Bild(er) hinzufügen"/Drop → Prüfung (Bild-MIME, `maxBytes`) → Toast bei Verstoß (ganze Auswahl verworfen) → `busy.run` → `onUpload` je Datei → Host refresht `images`. Titelbild setzen / Löschen → `busy.run(onSetMain|onDelete)`; **keine** Rückfrage vor dem Löschen. Fehler: Host muss toasten (Komponente schluckt).
- **Fahrzeugdokument** — Notiz optional → „Dokument hochladen" → Prüfung (Allowlist, 15 MB) → Toast bei Verstoß → `busy.run(upload → refresh)` → „Dokument hochgeladen."; „Anzeigen" → Bytes laden → neuer Tab (Blob); „Löschen" → ConfirmDialog „Dokument löschen" / „Endgültig löschen" → „Dokument gelöscht.". Fehler: `handleClientError(err, 'Dokument konnte nicht hochgeladen|geöffnet|gelöscht werden')`.
- **E-Mail verfassen (EmailComposer)** — Betreff/Text tippen, optional „Als HTML senden", „Datei wählen" (mehrere) → je Datei Größenprüfung (Toast) → Base64 → Chip; Entfernen per X. Senden/Validierung/Empfänger liegen beim Host (Kunden-Detail, Mailings).
- **Arbeit erfassen (QuickTimeEntryModal)** — Beleg-Detail „Arbeit erfassen" → Modal (Datum heute, 1 h) → „Speichern" → sequenzielle Prüfungen (siehe 4.2) als eine Alert-Meldung → `createTimeEntryRemote` → „Stunden erfasst." → Liste `documentId` refresht → Modal zu. Abbruch: „Abbrechen"/Backdrop (kein Esc).
- **PDF-Vorschau** — Detailseite mountet `PdfViewer` → `busy.run(fetch)` (Header-Balken, ab 250 ms Overlay + `inert` über `main`) → Iframe; Fehler: Alert „PDF konnte nicht geladen werden." + Toast.
- **Tabs (TabGroup)** — Klick/Pfeiltaste → Radio wechselt → State: `?tab=` per `replaceState` (Back-Button springt nie zwischen Tabs); Nav: `goto(href)`, bei Abbruch (Unsaved-Guard) Radio zurück. Deep-Link `?tab=x` beim Laden; ungültig → erster Tab.
- **Liste: Toolbar + Pagination** — Tippen → 250 ms → `onQuery(q)` (Host setzt `pageNum=1`) → Seitenwechsel per Join → `onPage(p)`; alter Stand bleibt sichtbar (Host-`lastResult`).
- **Toast** — `toast.success|error|warning|info` → Einzel-Toast oben rechts, ersetzt vorherigen, Auto-Dismiss 4,5 s (Fehler 6 s), X „Benachrichtigung schließen".

---

## 7. Nebenwirkungen

- **Uploads (clientseitig, alle als Base64 im JSON-Remote-Payload):**
  - `ImageUploader`: `accept image/png,image/jpeg,image/webp`; Prüfung `^image\/` (also auch z. B. `image/gif` per Drop möglich, `ImageUploader.svelte:93`); Default 20 MiB, Aufrufer 5 MiB (Settings-Logo, Beitragsbild), Reifenfoto ohne Limit-Prop (Hint „8 MB"); Payload `{ mime, dataUrl }` (mit `data:`-Präfix); Speicherort: durch Host-Remote (Fahrzeugfotos/Logo/Beitragsbild/Reifenbild — jeweilige Modul-Agenten).
  - `VehicleDocuments`: PDF/JPEG/PNG/WebP, 15 MiB (Client `VehicleDocuments.svelte:72` und Server `vehicle-document-service.ts:34`), Base64 ohne Präfix, ≤ 21_000_000 Zeichen (`vehicle-documents.remote.ts:43-47`); Notiz ≤ 500; Speicherort Tabelle `vehicle_documents.data`.
  - `EmailComposer`: beliebiger MIME, 10 MiB je Datei (Default-Prop), Base64 ohne Präfix; Versand durch Host (`sendAdHocCustomerEmail` / `sendBroadcastEmail`, `CONTRIBUTING.md:1409-1443`).
- **Blob-URLs / neue Tabs:** `PdfViewer` (Iframe, Revoke bei Reload/Unmount), `VehicleDocuments.view` (`window.open(_blank, noopener)`, Revoke nach 60 s), `openPdfInNewTab`/`downloadBase64File` (`pdf-download.ts`).
- **Browser-Storage:** `sessionStorage['twincars.creation-flow']` (Stack + pending Return, JSON, unbegrenzte Draft-Größe).
- **Navigation:** `GlobalSearch` → `goto`; `TabGroup` → `replaceState`/`goto`; `AppShell` → `goto`/`history.back()`/`window.location.href='/login'`.
- **Mutationen aus Shared-Komponenten:** `uploadVehicleDocumentRemote`, `deleteVehicleDocumentRemote`, `createTimeEntryRemote` (+ `listTimeEntriesRemote(...).refresh()`); `ImageUploader` nur über Host-Callbacks.
- **Keine** Mails, PDFs, Nummernkreise, externe APIs oder Webhooks direkt aus diesem Modul.

---

## 8. Vorhandene Tests

| Testdatei | Art | Was wird abgedeckt (1 Zeile) |
| --- | --- | --- |
| `src/lib/components/ui/CompactCustomerCard.test.ts` (59 Z.) | component | Felder, Link, Name-Präzedenz (company > Name > Nummer), Dash-Fallbacks |
| `src/lib/components/ui/ConfirmDialog.test.ts` (282 Z.) | component | offen/zu, Default-/Custom-Labels, Callbacks, Varianten-Klassen, Backdrop, Busy-Sperre + Spinner, async-Confirm bleibt offen, Re-Entrancy, Rejection hält offen + `console.error`, natives `cancel`-Event |
| `src/lib/components/ui/CustomerVehiclePicker.test.ts` (305 Z.) | component (Remotes gemockt) | Labels, Fahrzeug→Halter, Kunde→Filter `customerId`, Kundenwechsel löscht Fahrzeug, Clear-Kaskade, `vehicleLocked`, Create-Buttons nur mit Callbacks/Kunde, `customerError`, `disabled`, Required-Marker/Hint |
| `src/lib/components/ui/EmailComposer.test.ts` (57 Z.) | component | nur der „Als HTML senden"-Toggle (Sichtbarkeit, Label-Wechsel, `asHtml`-Prop); **Anhänge/Größenprüfung ungetestet** |
| `src/lib/components/ui/EmptyState.test.ts` (36 Z.) | component | Titel/Beschreibung/Action-Snippet |
| `src/lib/components/ui/FormField.test.ts` (97 Z.) + `FormField.test.harness.svelte` | component | Label, Required-Marker, Fehler vs. Hint, `label.control`-Assoziation, `colSpan` |
| `src/lib/components/ui/GlobalSearch.test.ts` (309 Z.) | component (Remote gemockt) | Debounce, 2-Zeichen-Schwelle, Esc, Pfeiltasten, Enter, Routing aller Bucket-Typen, Backdrop/X, „Keine Treffer", responsive `modal-box` |
| `src/lib/components/ui/ImageUploader.test.ts` (428 Z.) | component | Leerzustände, Hint, Vorschau, Upload-Payload, MIME-/Größen-Toasts, Delete/`allowDelete`, Drag-Overlay + `border-dashed`, Drop, `accept`/`multiple`, Multi-Upload, Ganze-Auswahl-Verwerfen, single-Drop, Galerie (Badge, SetMain, Delete, `allowSetMain`), Busy-Sperre |
| `src/lib/components/ui/Loader.test.ts` (57 Z.) | component | Label, Varianten, `role=status`/`aria-live`/`aria-busy`, Größenklassen |
| `src/lib/components/ui/MultiSearchablePicker.test.ts` (378 Z.) | component | Triggertexte, Map/Array-Labels, Checkbox-Zeilen, Übernehmen/Abbrechen/Backdrop-Semantik, seitenübergreifende Auswahl, Clear (Maus/Tastatur), disabled, Debounce, Leertext, Loader, Header-Create |
| `src/lib/components/ui/MultiSelect.test.ts` (168 Z.) | component | Placeholder, Chips, Filter, Toggle, Chip-Entfernen, disabled, `emptyHint`, `onChange`, Esc |
| `src/lib/components/ui/Pagination.test.ts` (193 Z.) | component | Caption, Disabled-Ränder, `onPage`, zwei Joins, Fensterbreiten, `navigation`-Landmark, `aria-current`, Ellipsen `disabled`, Chevrons, de-DE-Format, `pageCount=0`, kein Size-Selector |
| `src/lib/components/ui/PdfViewer.test.ts` (146 Z.) | component (Remotes gemockt) | Platzhalter, Blob-URL + `#filename.pdf`, `.pdf`-Anhängen/Encoding, `kind=reminder`, `role=alert`-Fehler + `handleClientError`, Revoke bei Unmount, `height` |
| `src/lib/components/ui/QuickTimeEntryModal.test.ts` (161 Z.) | component (Remotes/Stores gemockt) | Felder, geschlossen, Button nie disabled, Task-Fehler, Payload (`employeeId`, `documentId`, `task`), Liste-Refresh, fehlendes Mitarbeiterprofil, Abbrechen |
| `src/lib/components/ui/SearchablePicker.test.ts` (498 Z.) | component | Placeholder/Label, Trigger-Anatomie (span-Clear, `input-sm`), Öffnen + Initialsuche, Clear Maus/Tastatur ohne Öffnen, Debounce, Auswahl schließt + Label, „ausgewählt"-Badge, Loader, `emptyText`, Paging + Reset auf Seite 1, Header-X, Create-Affordance (nur mit beiden Props, genau einmal, schließt vor Callback) |
| `src/lib/components/ui/StatCard.test.ts` (47 Z.) | component | Titel/Wert/Desc, `title`-Attribut, Farbpaar, Neutral-Fallback |
| `src/lib/components/ui/TabGroup.test.ts` (197 Z.) + `TabGroup.test.harness.svelte` | component (`$app/state`, `$app/navigation` gemockt) | Tablist/Radios, Panels gemountet, `?tab=`-Spiegelung + Löschen, Deep-Link/ungültig, `urlParam=null`, Pfeiltasten, Auto-Reset, Badge-Update; Nav-Modus: Präfix/Exact, `goto`, nur aktives Panel, Snap-back bei Abbruch |
| `src/lib/components/ui/ToastTray.test.ts` (82 Z.) | component | leer, Variante/Message, Border+Shadow, `role=status`/`aria-live`, success/warning, Dismiss |
| `src/lib/components/ui/Toolbar.test.ts` (49 Z.) | component | Placeholder, Debounce, Preset-Query, Snippets |
| `src/lib/components/ui/VehicleDocuments.test.ts` (241 Z.) | component (Remotes gemockt) | Leerzustand, Zeilenformatierung, Upload-Payload (raw Base64 + Notiz) + Refresh + Toast, MIME-/Größen-Toasts, Extension-Fallback, Anzeigen (Blob, `_blank`), Löschen mit ConfirmDialog, Abbruch |
| `src/lib/components/layout/AppShell.test.ts` (373 Z.) | component | Ladebalken/Overlay+`inert`, Nav-Filter, User-Block, Idle-Logout-Arming, Abmelden-Fehler, Such-Trigger + Ctrl+K, Unsaved-Guard (Verwerfen/Bleiben), Titel/Back/Primary |
| `src/lib/components/layout/PageHeader.test.ts` (72 Z.) | component | Store-Schreiben (Titel/Back/Primary), kein eigener Titel-DOM, Toolbar-Snippet |
| `src/lib/components/layout/navigation.test.ts` (128 Z.) | unit | Permission-Filter, Wildcard, reale Navigation (Start-Fallback, Labels, System-Gruppe, Anfragen) |
| `src/lib/utils/pagination.test.ts`, `picker-labels.test.ts`, `form-validation.svelte.test.ts`, `src/lib/stores/toast.svelte.test.ts`, `creation-flow.svelte.test.ts` | unit | existieren (nicht gelesen) |
| `e2e/helpers.ts:100-160` (`openDetailTab`, `pickFromSearchablePicker`, `clickDialogButton`) | e2e-Helfer | koppeln die E2E-Suite an TabGroup-Radios, Picker-Dialog-Anatomie und `dialog.modal-open` |

**Ungetestet:** `pickers.remote.ts` selbst (keine `pickers.remote.test.ts` im gelesenen Umfang — unklar, ob Integrationstests anderswo liegen), EmailComposer-Anhänge, MultiSelect-Tastaturnavigation, PdfViewer-Busy-Verhalten.

---

## 9. Feature-Matrix

| ID | Feature | Routen | Endpoints/Remotes | Tabellen | Erwartetes Verhalten |
| --- | --- | --- | --- | --- | --- |
| F-095 | Einzel-Picker-Dialog (SearchablePicker) mit Server-Suche, Debounce 250 ms, Seite 25, festen Maßen | alle Formulare/Filter (10 Dateien) | `pickXRemote` per `.run()` | je Picker | Trigger sieht wie Input aus; Dialog `h-[80dvh] max-h-[640px] max-w-2xl`; Fokus im Suchfeld; Initialsuche; Auswahl schließt und setzt `value`/`valueLabel`; „ausgewählt"-Badge |
| F-096 | Auswahl entfernen am Picker-Trigger (Maus/Enter/Space) | dito | – | – | X nur bei Wert und nicht `disabled`; setzt `''` und `onSelect(null)`; öffnet keinen Dialog |
| F-097 | „Neu anlegen"-Affordance genau einmal im Dialog-Header | dito | – | – | nur wenn `createLabel` **und** `onCreateNew`; Dialog schließt vor Callback; nie in Liste/Leerzustand |
| F-098 | Mehrfach-Picker (MultiSearchablePicker) transaktional | `orders/WorkOrderForm` | `pickEmployeesRemote` | `employees` | Checkbox-Zeilen, Auswahl über Seiten, „Übernehmen (N)" schreibt, Abbrechen/Backdrop/Esc verwirft; Triggertext ≤ 2 Labels sonst „N ausgewählt"; Clear ohne Dialog |
| F-099 | Kombi-Picker Kunde/Fahrzeug mit Halter-Autofill und Kundenfilter | Calendar/Invoice/Offer/WorkOrder/TireStorage-Formulare | `pickCustomersRemote`, `pickCustomerVehiclesRemote` | `customers`, `vehicles` | Regeln aus 4.2; `vehicleLocked`; dynamische Dialogtitel/Placeholder/Leertexte; Fahrzeug-Neuanlage nur mit Kunde |
| F-100 | Kunden-Picker | – | `pickCustomersRemote` | `customers` | nicht archiviert; ILIKE auf 8 Spalten; Sort `lastName, company`; Label `Name · Stadt` |
| F-101 | Fahrzeug-Picker (allgemein) | – | `pickVehiclesRemote` | `vehicles`, `vehicle_license_plate_versions` | nicht archiviert; Suche VIN/Marke/Modell/HSN/TSN + Kennzeichen (historisch); Sort Kennzeichen; Label `Kennz · Marke Modell` |
| F-102 | Fahrzeug-Picker relationsbewusst | – | `pickCustomerVehiclesRemote` | + `customers` | zusätzlich Halter-Suche, `customerId`-Filter, Rückgabe `customerId/customerLabel`, Label mit Halter-Segment |
| F-103 | Lagerfahrzeug-Picker | Verkaufs-/Belegflüsse | `pickInventoryVehiclesRemote` | `vehicles`, `vehicle_listings` | `customerId IS NULL`, Listing fehlt oder `available`; Preisfelder für Positionen; Sort Marke/Modell |
| F-104 | Mitarbeiter-Picker (auch für `orders`) | – | `pickEmployeesRemote` | `employees` | `requireAnyPermission('employees','orders')`; nicht archiviert; Label `Vorname Nachname · Personalnr.` |
| F-105 | Artikel-Picker mit Kategorie-Filter und aktuellem Preis | PositionsEditor, WorkOrder | `pickItemsRemote` | `items`, `item_price_versions` | `category all/services/articles`; Label `Artikelnr - Beschreibung`; `unitPriceNet` aus Preisversionen; **kein** Archivfilter |
| F-106 | Reifen-Picker mit Größe/Saison/Preis | PositionsEditor | `pickTiresRemote` | `tires`, `tire_price_versions` | Label `Artikelnr · Marke Modell · B/QRZ · Saison`; `sizeLabel`; Preis aus Versionen |
| F-107 | Lieferanten-Picker | Formulare | `pickSuppliersRemote` | `suppliers` | nicht archiviert; Label `Name · Stadt` |
| F-108 | Beleg-Picker (Zeitbuchung) | Hours-Formulare | `pickDocumentsRemote` | `documents`, `customers` | Typen invoice/offer/cost_estimate/order_confirmation; neueste zuerst; Label `Typ Nummer · Kunde` |
| F-109 | Picker-Argumentvalidierung | – | alle Picker | – | `q` trim ≤ 200, `size ∈ {10,25,50,100}`, `page` Zahl; Rückgabe `{items,total,page,size,pageCount≥1}` |
| F-110 | Creation-Flow-Store (Stack, sessionStorage, 1 h, Zyklenschutz) | `/customers/new`, `/vehicles/new`, `/employees/new` als Blätter | – | – | API aus Abschnitt 3; `pendingReturnFor` genau einmal bei URL-Gleichheit; `holder` für Fahrzeug-Ergebnis; `leafInitial` für Halter-Vorbelegung |
| F-111 | Picker-Label-Formate zentral (Kunde/Fahrzeug) | – | – | – | `customerDisplayName`, `customerPickerLabel`, `vehiclePickerLabel` byte-identisch server/client |
| F-112 | ConfirmDialog (nativ, Fokusfalle, Esc, Fokusrückgabe, Busy-Sperre, Fehler hält offen) | 31 Dateien | – | – | Defaults „Bestätigen"/„Abbrechen"; `variant danger` → `btn-error`; `onClose` immer |
| F-113 | Unsaved-Changes-Guard mit ConfirmDialog | alle Formulare via AppShell | – | – | Texte „Ungespeicherte Änderungen" / „…verworfen werden?" / „Verwerfen" / „Bleiben"; `beforeunload` bei Reload |
| F-114 | Globale Suche (Modal, Cmd/Ctrl+K, 9 Buckets, Tastaturnavigation) | alle | `globalSearchRemote` | viele | ≥ 2 Zeichen, 250 ms, Bucket-Reihenfolge/Labels/Icons, Routing je Typ, Esc/↑/↓/Enter, Fußzeile mit `kbd` |
| F-115 | Bild-Upload Karte single-Modus (Logo/Beitragsbild) | Settings, PostForm | Host-Remotes | Host | Vorschau `h-40`, „Bild ersetzen/hinzufügen/entfernen", `allowDelete=false` für Pflichtlogo |
| F-116 | Bild-Upload Galerie-Modus mit Titelbild | Fahrzeug-/Reifen-Detail | Host-Remotes | Host | Grid, Badge „Titelbild", „Als Titelbild festlegen" nur auf Nicht-Cover, „Löschen" ohne Rückfrage, Aktionen immer sichtbar |
| F-117 | Bild-Validierung und Drag&Drop | dito | – | – | `image/*`-MIME, `maxBytes` (Default 20 MiB), deutsche Toasts, ganze Auswahl verwerfen bei Verstoß, Drop-Overlay „Dateien hier ablegen", single ⇒ nur erste Datei |
| F-118 | Fahrzeugdokumente: Liste/Upload/Anzeigen/Löschen | `vehicles/[id]` | `listVehicleDocumentsRemote`, `getVehicleDocumentRemote`, `uploadVehicleDocumentRemote`, `deleteVehicleDocumentRemote` | `vehicle_documents` | Allowlist PDF/JPEG/PNG/WebP + Extension-Fallback, 15 MiB, Notiz ≤ 500, Blob in neuem Tab, ConfirmDialog „Endgültig löschen", Toasts |
| F-119 | E-Mail-Composer (Betreff ≤ 200, Text ≤ 50 000, HTML-Toggle, Anhänge ≤ 10 MiB je Datei als Base64) | Kunden-Detail, Mailings | – (Host sendet) | – | Chips mit Größe, Entfernen, Toasts „…ist größer als N MB." / „…konnte nicht gelesen werden."; Erklärtexte zum HTML-Modus |
| F-120 | Arbeit erfassen (QuickTimeEntryModal) | `invoices/[id]`, `offers/[id]` | `currentEmployeeRemote`, `createTimeEntryRemote`, `listTimeEntriesRemote.refresh` | `time_entries` | Felder/Defaults/Meldungen aus 4.2; Toast „Stunden erfasst."; Button nie validierungs-disabled |
| F-121 | PDF-Vorschau per Blob-Iframe (document/reminder) | Beleg-/Mahnungs-/Sent-Detail | `getDocumentPdfBytesRemote`, `getReminderPdfBytesRemote` | PDF-Cache | Ladeplatzhalter, Iframe mit `#dateiname.pdf`, Fehler-Alert + Toast, Revoke, `height` Prop |
| F-122 | TabGroup State-Modus mit `?tab=`-Deep-Link | Kunden-/Fahrzeug-Detail, Stundenberichte | – | – | Radio-Pattern, Pfeiltasten, `replaceState`, erster Tab löscht Param, Panels bleiben gemountet, Auto-Reset, Badge |
| F-123 | TabGroup Nav-Modus | `settings/+layout` | – | – | aktiv aus Pfad (exact/Präfix), `goto`, Snap-back bei abgebrochener Navigation, nur aktives Panel |
| F-124 | Listen-Filtertabs (bewusst kein TabGroup) | customers/vehicles/hours/tire-storage-Listen | – | – | `tabs-box`/`tabs-border`, mutually exclusive (Alle/Archiv/…) — Modul-Agenten |
| F-125 | Pagination fix 25 mit Phone-/Desktop-Join | 23 Dateien | – | – | Caption de-DE, 5er/3er-Fenster, Ellipsen inert, `aria-current`, Chevron-Labels, kein Size-Selector |
| F-126 | Toolbar (Suche 250 ms debounced, Filter-/Action-Slots) | 14 Listen | – | – | `type=search maxlength=200`; Host setzt `pageNum=1` in `onQuery` |
| F-127 | EmptyState randlos mit Icon/Titel/Beschreibung/Action | 22 Dateien | – | – | immer innerhalb einer Karte |
| F-128 | FormField-Layout (Label oben, ` *`, Fehler vor Hint, `colSpan`) | 13 Formulare / 70 Felder | – | – | ein `<label>` um das Feld |
| F-129 | Validierungs-Handle `useFormValidation` + `validationClasses`-Familie | Formulare | – | – | erstes Issue je Feld, `_form`, engl. Defaults → „Bitte prüfen Sie Ihre Eingabe.", `input-error` nur bei touched |
| F-130 | StatCard Kennzahlkacheln mit Farb-Icon | Dashboard, Ledger, Reminders, Sales-Ledger | – | – | Wert truncated + `title`, `tabular-nums` |
| F-131 | CompactCustomerCard | Fahrzeug-Detail Halter-Tab | – | – | Name-Präzedenz, „Zum Kunden" |
| F-132 | Loader-Varianten (block/inline/overlay), einziger Ladebalken im AppShell | global | – | – | Label „Inhalte werden geladen"; Overlay ab 250 ms + `inert` |
| F-133 | Toast-System (Einzel-Toast, 4,5 s / Fehler 6 s, manuell schließbar) | global | – | – | oben rechts, Varianten-Icons, `role=status` |
| F-134 | Busy-Store (`active`/`slow`, `run`/`begin`) inkl. Navigations-Kopplung | global | – | – | Buttons `disabled={busy.active}` + Spinner; Navigation via `beforeNavigate`/`afterNavigate` |
| F-135 | MultiSelect (client-seitig) für Benutzerrollen | `settings/users/new`, `…/[id]/edit` | – (Host lädt Rollen) | `roles` | Chips, Filter, Toggle, Esc/Outside-Close, `emptyHint` |
| F-136 | PageHeader → globaler Titel/Back/Primary-Action im Header | 78 Seiten | – | – | `subtitle` ignoriert; Primary als Link oder Button; Zurück history-bewusst |
| F-137 | Route-lokale Modale (9 Dateien) | `customers/[id]`, `vehicles/PurchaseIntoStockModal`, `offers/new`, `invoices/new`, `invoices/[id]`, `employees/[id]`, `ledger`, `settings/import`, `orders/[id]` | Modul-Remotes | – | `modal modal-open`; 3 davon mit `showModal()` (invoices/[id], employees/[id], orders/[id]) — Details bei den Modul-Agenten |

---

## 10. Befunde

| ID | Beschreibung | Fundstelle | Auswirkung | Empfehlung | Einordnung | Betroffene Features |
| --- | --- | --- | --- | --- | --- | --- |
| B-082 | `pickerSchema`, `itemsPickerSchema`, `customerVehiclePickerSchema` haben keine deutschen Meldungen in `string()/trim()/maxLength()/number()/picklist()` | `src/routes/pickers.remote.ts:49-53,61-66,74-79` | Verstoß CONTRIBUTING §12 (`CONTRIBUTING.md:954-966`); Nutzer sieht Fallback „Bitte prüfen Sie Ihre Eingabe." | Schemata mit deutschen Meldungen versehen (im Rewrite: zod/valibot-Schema mit Messages) | im Rewrite beheben | F-109 |
| B-083 | `page: number()` ohne `minValue(1)`/Integer-Check → `page ≤ 0` ergibt negatives `OFFSET` → Postgres-Fehler → 500 „Ein interner Fehler ist aufgetreten." | `pickers.remote.ts:52,104` | manipulierte Anfrage erzeugt 500 statt 400 | `pipe(number(), integer(), minValue(1), maxValue(100000))` wie `clampPagination` | im Rewrite beheben | F-109 |
| B-084 | N+1: `getCurrentItemPrice`/`getCurrentTirePrice` pro Zeile (bis zu 100 Zusatzqueries je Seite) | `pickers.remote.ts:400-413,679-700` | Latenz im Positions-Picker | Preis per Lateral-Join/Subquery in einer Query holen | im Rewrite beheben | F-105, F-106 |
| B-085 | Kommentar „nur nicht ausgemusterte" vs. Code ohne Filter; `items`/`tires` haben keine `archived`-Spalte; `pickDocumentsRemote` liefert auch stornierte Belege | `pickers.remote.ts:56-59,369,645,574-581`; Schema ohne `archived` bei `items`/`tires` | Inkonsistenz zur Archiv-Regel §8 („archived records never appear in pickers", `CONTRIBUTING.md:612-613`) | Entscheiden, ob Artikel/Reifen archivierbar werden und ob Storno-Belege wählbar bleiben | Entscheidung nötig | F-105, F-106, F-108 |
| B-086 | Kennzeichensuche dreimal kopiert: Vor-Query `selectDistinct` + `inArray(ids)` mit potenziell tausenden IDs | `pickers.remote.ts:167-183,234-253,447-464` | Duplikat-Code; unbegrenzte IN-Liste | Ein `EXISTS`-Subselect/Helper für alle drei Picker | im Rewrite beheben | F-101, F-102, F-103 |
| B-087 | Label-Formate für Mitarbeiter/Lieferanten/Belege/Artikel/Reifen sind inline, nicht in `picker-labels.ts` (dessen JSDoc „single source of truth" verspricht) | `pickers.remote.ts:349,403,497,551,626,684`; `picker-labels.ts:3-8` | Drift-Risiko zwischen Server-Label und Client-Auto-Select (Creation-Flow) | alle Label-Builder zentralisieren | im Rewrite beheben | F-111 |
| B-088 | GlobalSearch nutzt `modal-open` ohne `showModal()`: keine native Fokusfalle, keine Fokusrückgabe, Dialog ohne `aria-labelledby`, Trefferliste ohne `listbox/option`/`aria-activedescendant` | `GlobalSearch.svelte:245-365` | Tab verlässt das Modal in die Seite; Screenreader erfahren aktiven Treffer nicht | Im Rewrite `UModal`/`UCommandPalette` mit Fokusfalle und Listbox-Semantik | im Rewrite beheben | F-114 |
| B-089 | QuickTimeEntryModal ohne `showModal()`, ohne Esc, ohne Fokusverwaltung, ohne `aria-labelledby`; Validierung nur als eine Summenmeldung ohne Feldmarkierung | `QuickTimeEntryModal.svelte:107-183,53-81` | inkonsistent zu ConfirmDialog/Pickern; Esc tut nichts | gemeinsame Modal-Basis; Feldfehler wie §11 | im Rewrite beheben | F-120 |
| B-090 | `listTimeEntriesRemote({ page:1, size:25, documentId }).refresh()` refresht nur exakt diesen Cache-Key; andere Instanzen (Filter/Seite) bleiben stale | `QuickTimeEntryModal.svelte:99` | „Erfasste Stunden"-Karte nur bei genau passenden Args aktuell | Refresh-Strategie im Rewrite (Query-Invalidation nach Prefix) | im Rewrite beheben | F-120 |
| B-091 | TabGroup: `role="tablist"` enthält Radio-Inputs statt `role=tab`/`tabpanel`, keine `aria-selected`/`aria-controls`; Eindeutigkeit von `name` wird nicht geprüft | `TabGroup.svelte:148-183` | AT meldet Radiogruppe in Tablist; doppelte `name`s koppeln Tab-Gruppen unbemerkt | `UTabs` mit korrekter ARIA nutzen | im Rewrite beheben | F-122, F-123 |
| B-092 | State-Modus hält alle Panels gemountet → alle Tab-Queries (z. B. Kunden-Detail) laden beim Seitenaufruf | `TabGroup.svelte:178-182` (Kommentar Z. 38-40) | Mehr Initiallast, dafür Panel-State erhalten | Entscheidung: lazy Panels (Nuxt `UTabs` unmount) vs. Zustandserhalt | Entscheidung nötig | F-122 |
| B-093 | Suchfelder ohne Accessible Name (nur Placeholder): Toolbar, SearchablePicker, MultiSearchablePicker, GlobalSearch, MultiSelect-Filter | `Toolbar.svelte:44-51`, `SearchablePicker.svelte:226-234`, `MultiSearchablePicker.svelte:246-254`, `GlobalSearch.svelte:253-262`, `MultiSelect.svelte:166-174` | a11y (WCAG 4.1.2) | `aria-label="Suchen"` bzw. sichtbares Label | im Rewrite beheben | F-095, F-098, F-114, F-126, F-135 |
| B-094 | Doppelimplementierung MultiSelect (client-seitig, Chips, Dropdown) vs. MultiSearchablePicker (Server, Dialog); MultiSelect filtert DB-Rollen clientseitig (§9 erlaubt nur hart codierte kleine Listen); Optionen als `aria-pressed`-Buttons in `role=listbox`, keine Pfeiltasten | `MultiSelect.svelte` gesamt; Aufrufer `settings/users/new:152`, `…/[id]/edit:161` | zwei UX-Muster für Mehrfachauswahl | Entscheidung: MultiSelect streichen und Rollen über `MultiSearchablePicker` + `pickRolesRemote`, oder als dokumentierte Kleinlisten-Ausnahme (`USelectMenu multiple`) behalten | Entscheidung nötig | F-098, F-135 |
| B-095 | Picker-Dialoge setzen beim Öffnen `page=1`, aber nicht `q`; alte Trefferliste bleibt bis zum Eintreffen neuer Ergebnisse sichtbar (Loader nur bei leerer Liste) | `SearchablePicker.svelte:79-87,238`, `MultiSearchablePicker.svelte:102-110,258` | Zweites Öffnen zeigt alten Suchbegriff/alte Zeilen | festlegen: Suchbegriff zurücksetzen oder bewusst merken; Ladezustand über alte Zeilen legen | Entscheidung nötig | F-095, F-098 |
| B-096 | Hosts, die den Picker in `FormField` (ein `<label>`) wrappen, erhalten als Accessible Name des Triggers das Feldlabel + Dialogtext; CustomerVehiclePicker umgeht das mit `div+span`; e2e-Helfer kompensiert per `hasText` | `FormField.svelte:50`, `CustomerVehiclePicker.svelte:158-163`, `e2e/helpers.ts:129-135` | uneinheitliche Anatomie; Label-Klick öffnet Dialog | Im Rewrite Label-Assoziation über `for`/`id` (`UFormField`), Dialog außerhalb des Labels rendern | im Rewrite beheben | F-095, F-128 |
| B-097 | `border-dashed` im Drag-Zustand (und in TireStorageForm) trotz Verbot „No dashed / dotted borders" | `ImageUploader.svelte:193-195`, Test `ImageUploader.test.ts:210`; `tire-storage/TireStorageForm.svelte` | Stilabweichung, vom Test zementiert | als Ausnahme dokumentieren oder Drag-Zustand ohne Dash (z. B. `ring`) | Entscheidung nötig | F-117 |
| B-098 | Uneinheitliche Bildlimits: Default 20 MiB vs. JSDoc „5 MB"; Reifenfoto-Hint „8 MB" ohne `maxBytes`; Fahrzeugfotos ohne Limit-Prop; Serverlimits je Modul unklar | `ImageUploader.svelte:18-19,40,60`; `tires/[id]/+page.svelte:216`; `vehicles/[id]/+page.svelte:610` | Nutzer sieht Hint ≠ tatsächliche Prüfung; Server lehnt ggf. später ab | ein Limit pro Bildtyp festlegen und Client/Server/Hint daraus ableiten | Entscheidung nötig | F-115, F-116, F-117 |
| B-099 | Uploads (Bilder ≤ 20 MiB, Dokumente ≤ 15 MiB, Mailanhänge ≤ 10 MiB) laufen als Base64-String durch JSON-Remote-Payloads (+33 %, ganze Datei im Speicher, `BODY_SIZE_LIMIT`-abhängig) | `ImageUploader.svelte:76-82`, `VehicleDocuments.svelte:98-104`, `EmailComposer.svelte:57-67`, `vehicle-documents.remote.ts:43-47` | Speicher-/Payload-Last; keine Fortschrittsanzeige möglich | Im Nuxt-Rewrite Multipart-Upload (`useMultipartFormData`/`readMultipartFormData`) oder Objektspeicher erwägen | Entscheidung nötig | F-115..25 |
| B-100 | ImageUploader schluckt Fehler von `onUpload`/`onDelete`/`onSetMain` stumm (`catch {}`) — §12.5 verbietet stille Catches; korrekt nur, wenn jeder Host selbst toastet | `ImageUploader.svelte:109-111,166-168,175-177` | fehlende Fehlermeldung, falls ein Host den Toast vergisst | Fehler in der Komponente per `handleClientError` surfacen oder rethrow | im Rewrite beheben | F-115, F-116 |
| B-101 | EmailComposer: Hint „Maximal 10 MB pro Datei" hart codiert (Prop `maxBytesPerFile` variabel); kein `accept`; kein Gesamtlimit; Anhänge im `#each` per Index gekeyt | `EmailComposer.svelte:182-185,173-180,188` | Hint kann vom Limit abweichen; Gesamtgröße unbegrenzt bis Server ablehnt | Hint aus Prop ableiten; Gesamtlimit definieren; stabile Keys | im Rewrite beheben | F-119 |
| B-102 | Toast: Fehler-Toasts nutzen `role=status`/`aria-live=polite` statt `role=alert`/assertiv; Einzel-Slot ersetzt Fehlermeldung sofort durch nächsten Erfolg | `ToastTray.svelte:25-26`, `toast.svelte.ts:33-57` | Fehler können von AT verpasst/überschrieben werden | Fehler assertiv; ggf. kurze Queue für Fehler | Entscheidung nötig | F-133 |
| B-103 | PdfViewer: Inline-`style="height"` (Red-List „inline style") und doppelte Fehlerausgabe (Alert + Toast) | `PdfViewer.svelte:76-79,98-115` | kleiner Stilverstoß; doppelte Meldung | Höhe per Klasse/Prop-Map; eine Fehlerdarstellung | im Rewrite beheben | F-121 |
| B-104 | PdfViewer lädt innerhalb `busy.run` → ab 250 ms Overlay + `inert` über der gesamten Detailseite, obwohl nur die Vorschau lädt | `PdfViewer.svelte:66`; `AppShell.svelte:379-388` | Detailseite kurz nicht bedienbar | Vorschau ohne globalen Busy (lokaler Platzhalter reicht) | Entscheidung nötig | F-121 |
| B-105 | VehicleDocuments: Liste ohne Pagination, Einzeldatei-Upload ohne Drag&Drop (inkonsistent zu ImageUploader), zwei Datenquellen (`initial` vom Host + eigener `refresh`), Blob-Dateiname nur in Chromium korrekt | `VehicleDocuments.svelte:77-87,266-273,157-174` | UX-Inkonsistenz; Host-Query nach Upload stale | einheitliche Upload-Komponente; Query-Invalidation statt Snapshot | im Rewrite beheben | F-118 |
| B-106 | Formularsteuerung `useFormValidation` JSDoc behauptet „Submit button is disabled until valid" — widerspricht §11 (nie validierungs-disabled) | `form-validation.svelte.ts:7-9` vs. `CONTRIBUTING.md:861-868` | Doku-Drift, Fehlleitung neuer Entwickler | Kommentar korrigieren | im Rewrite beheben | F-129 |
| B-107 | Pagination: `size`/`onSize` tote Props; zwei Joins im DOM (Tests müssen Duplikate behandeln) | `Pagination.svelte:14-21,46-143` | toter API-Teil; doppelte Buttons für nicht-CSS-Konsumenten | ein responsives `UPagination`; Props entfernen | im Rewrite beheben | F-125 |
| B-108 | 9 Routen rollen eigene `modal modal-open`-Dialoge; nur 3 mit `showModal()` → uneinheitliches Esc/Fokus-Verhalten | `customers/[id]`, `vehicles/PurchaseIntoStockModal:102`, `offers/new`, `invoices/new`, `invoices/[id]:899`, `employees/[id]:430`, `ledger:407`, `settings/import`, `orders/[id]:954` | a11y/UX-Inkonsistenz; Styling-Doku fordert `<dialog>`+`showModal()` (`styling.md:52-55`) | eine `AppModal`-Basis (UModal) für alle Dialoge | im Rewrite beheben | F-137, F-112 |
| B-109 | GlobalSearch/Picker `runSearch` ohne Request-Sequenzierung: langsamere ältere Antwort kann neuere überschreiben (Tippen + Paging) | `GlobalSearch.svelte:172-189`, `SearchablePicker.svelte:67-77`, `MultiSearchablePicker.svelte:90-100` | falsche Trefferliste in Race-Fällen | Sequenznummer/AbortController | im Rewrite beheben | F-095, F-098, F-114 |
| B-110 | CustomerVehiclePicker: `lastCustomerId` einmalig aus Prop initialisiert; setzt der Host `customerId` später programmatisch (Draft-Restore nach Creation-Flow), ist die Wechsel-Erkennung stale → fremdes Fahrzeug wird ggf. nicht/falsch gelöscht | `CustomerVehiclePicker.svelte:105-109,125-129` | potenzieller Logikfehler nach Rücksprung (unklar, ob im Bestand reproduzierbar) | Wechsel-Erkennung aus reaktivem Vorwert ableiten | Entscheidung nötig | F-099, F-110 |
| B-111 | Creation-Flow-Drafts unbegrenzt groß in sessionStorage (Fotos/Base64 in Drafts) → Quota-Fehler still, dann nur In-Memory: ein Full-Reload verliert Draft | `creation-flow.svelte.ts:205-219` | Datenverlust im Randfall, ohne Hinweis | Draft ohne Binärdaten; Quota-Fehler melden | im Rewrite beheben | F-110 |
| B-112 | Typografie: gemischte Anführungszeichen `„…"` (deutsches Öffnen, ASCII-Schließen) in Toasts/Dialogtexten | `EmailComposer.svelte:78,97`, `ImageUploader.svelte:94,98`, `VehicleDocuments.svelte:130,135,291`, `MultiSelect.svelte:142`, `CONTRIBUTING.md:974` | uneinheitliche Wortmarken | einheitlich `„…“` festlegen (styling.md regelt nur Gedankenstriche) | Entscheidung nötig | F-117, F-118, F-119 |
| B-113 | Picker-/GlobalSearch-`runSearch` ohne `try/catch` → Guard-403/Netzfehler enden als unhandled rejection ohne deutschen Toast | `SearchablePicker.svelte:67-77`, `MultiSearchablePicker.svelte:90-100`, `GlobalSearch.svelte:172-189` | Nutzer sieht leeren Dialog ohne Erklärung; §12 verlangt Toast | `handleClientError` im Suchpfad | im Rewrite beheben | F-095, F-098, F-114 |
| B-114 | Toolbar-Verhalten hängt von `onQuery` ab: ohne Callback wird `query` sofort (undebounced) gebunden | `Toolbar.svelte:22-27` | zwei Semantiken derselben Komponente | immer debounced emitten (`update:query`) | im Rewrite beheben | F-126 |
| B-115 | ImageUploader-MIME-Prüfung `^image\/` weiter als `accept` (Drop erlaubt z. B. GIF/SVG), Server-Regel unklar | `ImageUploader.svelte:93,333` | Client/Server-Divergenz möglich | Allowlist explizit (PNG/JPEG/WebP) auch im Drop-Pfad | im Rewrite beheben | F-117 |
| B-116 | Keine Integrationstests für `pickers.remote.ts` im gelesenen Umfang (Suchfelder, Archivfilter, Sortierung, Guards ungetestet); EmailComposer-Anhänge ungetestet | – | Regressionen an Suchlogik/Guards unbemerkt | Picker-Tests gegen pg-mem; Anhangs-Tests | im Rewrite beheben | F-100..15, F-119 |

---

## 11. Offene Fragen an den Architekten

1. **Modal-Basis:** Soll der Rewrite alle Dialoge (ConfirmDialog, Picker, GlobalSearch, QuickTimeEntry, 9 Routen-Modale) auf eine `UModal`-Basis mit einheitlicher Fokusfalle/Esc/Fokusrückgabe ziehen (empfohlen), inkl. der bisher bewusst nativen `<dialog>`-Semantik?
2. **Picker-Suchzustand:** Suchbegriff beim erneuten Öffnen merken oder zurücksetzen (B-095)?
3. **MultiSelect-Zukunft:** Rollen-Mehrfachauswahl über `USelectMenu multiple` (klein, client-seitig) oder über den Server-Picker (`pickRolesRemote`)? Gilt die §9-Ausnahme „hart codierte kleine Liste" für DB-Rollen?
4. **Archivierbarkeit von Artikeln/Reifen und Wählbarkeit stornierter Belege** im Picker (B-085).
5. **Upload-Transport:** Base64-in-JSON beibehalten oder Multipart/Streaming (B-099)? Ein verbindliches Limit je Bildtyp (Logo 5 MB, Beitragsbild 5 MB, Reifen 8 MB?, Fahrzeugfotos ?) (B-098).
6. **Tabs:** Panels lazy (Nuxt `UTabs` unmountet inaktive) oder gemountet lassen (Zustandserhalt für Uploads/Pagination, B-092)? Bleibt die `?tab=`-Spiegelung per `replaceState` (kein Back-Button-Tabwechsel)?
7. **Toast-Semantik:** Einzel-Toast beibehalten (Fehler kann von Erfolg überschrieben werden) oder Nuxt-`useToast`-Stapel mit Limit (B-102)? Dauer 4,5 s / 6 s übernehmen?
8. **Busy-Modell:** Globaler Ladebalken + 250-ms-Overlay mit `inert` 1:1 nachbauen (Nuxt `ULoadingIndicator` + eigener Overlay), oder PDF-/Picker-Ladevorgänge lokal halten (B-104)?
9. **Creation-Flow:** Stack-Store mit sessionStorage übernehmen (Nuxt: Pinia + `useSessionStorage`), Draft-Größe begrenzen, Hinweis bei Quota-Fehler (B-111)?
10. **Styling-Ausnahmen:** `border-dashed` im Drag-Zustand und `rounded-md` am PDF-Iframe als dokumentierte Ausnahmen ins Nuxt-UI-Theme übernehmen oder streichen?
11. **Typografie:** Verbindliche Anführungszeichen (`„…“`) und Gedankenstrich-Regel für alle UI-Strings festlegen (B-112).
12. **E2E-Kopplung:** Die E2E-Helfer (`pickFromSearchablePicker`, `openDetailTab`, `clickDialogButton`) hängen an DaisyUI-Anatomie (`dialog[open]`, Radios als Tabs, `dialog.modal-open`) — sollen sie im Rewrite durch `data-testid`-basierte Helfer ersetzt werden?

---

## 12. Gelesene Dateien

| Datei | Zeilen |
| --- | --- |
| `/tmp/…/scratchpad/inv/TEMPLATE.md` | 59 |
| `src/lib/components/ui/CompactCustomerCard.svelte` | 60 |
| `src/lib/components/ui/ConfirmDialog.svelte` | 123 |
| `src/lib/components/ui/CustomerVehiclePicker.svelte` | 209 |
| `src/lib/components/ui/EmailComposer.svelte` | 212 |
| `src/lib/components/ui/EmptyState.svelte` | 35 |
| `src/lib/components/ui/FormField.svelte` | 60 |
| `src/lib/components/ui/FormField.test.harness.svelte` | 27 |
| `src/lib/components/ui/GlobalSearch.svelte` | 366 |
| `src/lib/components/ui/ImageUploader.svelte` | 353 |
| `src/lib/components/ui/Loader.svelte` | 61 |
| `src/lib/components/ui/MultiSearchablePicker.svelte` | 315 |
| `src/lib/components/ui/MultiSelect.svelte` | 224 |
| `src/lib/components/ui/Pagination.svelte` | 144 |
| `src/lib/components/ui/PdfViewer.svelte` | 118 |
| `src/lib/components/ui/QuickTimeEntryModal.svelte` | 184 |
| `src/lib/components/ui/SearchablePicker.svelte` | 284 |
| `src/lib/components/ui/StatCard.svelte` | 60 |
| `src/lib/components/ui/TabGroup.svelte` | 184 |
| `src/lib/components/ui/TabGroup.test.harness.svelte` | 29 |
| `src/lib/components/ui/ToastTray.svelte` | 46 |
| `src/lib/components/ui/Toolbar.svelte` | 65 |
| `src/lib/components/ui/VehicleDocuments.svelte` | 297 |
| `src/lib/components/layout/PageHeader.svelte` | 33 |
| `src/lib/components/layout/AppShell.svelte` | 511 |
| `src/routes/pickers.remote.ts` | 703 |
| `src/lib/utils/picker-labels.ts` | 61 |
| `src/lib/utils/form-validation.svelte.ts` | 201 |
| `src/lib/utils/pagination.ts` | 43 |
| `src/lib/utils/pdf-download.ts` | 80 (von ~100; Rest nicht gelesen) |
| `src/lib/stores/toast.svelte.ts` | 72 |
| `src/lib/stores/creation-flow.svelte.ts` | 223 |
| `src/lib/stores/busy.svelte.ts` | 94 |
| `src/lib/stores/page-title.svelte.ts` | 62 |
| `src/lib/stores/form-dirty.svelte.ts` | 38 |
| `src/routes/+layout.svelte` | 88 |
| `src/routes/search.remote.ts` | 60 (Kopf; Rest nicht gelesen) |
| `src/routes/vehicles/vehicle-documents.remote.ts` | 135 |
| `src/lib/components/ui/CompactCustomerCard.test.ts` | 59 |
| `src/lib/components/ui/ConfirmDialog.test.ts` | 282 |
| `src/lib/components/ui/CustomerVehiclePicker.test.ts` | 305 |
| `src/lib/components/ui/EmailComposer.test.ts` | 57 |
| `src/lib/components/ui/EmptyState.test.ts` | 36 |
| `src/lib/components/ui/FormField.test.ts` | 97 |
| `src/lib/components/ui/GlobalSearch.test.ts` | 309 |
| `src/lib/components/ui/ImageUploader.test.ts` | 428 |
| `src/lib/components/ui/Loader.test.ts` | 57 |
| `src/lib/components/ui/MultiSearchablePicker.test.ts` | 378 |
| `src/lib/components/ui/MultiSelect.test.ts` | 168 |
| `src/lib/components/ui/Pagination.test.ts` | 193 |
| `src/lib/components/ui/PdfViewer.test.ts` | 146 |
| `src/lib/components/ui/QuickTimeEntryModal.test.ts` | 161 |
| `src/lib/components/ui/SearchablePicker.test.ts` | 498 |
| `src/lib/components/ui/StatCard.test.ts` | 47 |
| `src/lib/components/ui/TabGroup.test.ts` | 197 |
| `src/lib/components/ui/ToastTray.test.ts` | 82 |
| `src/lib/components/ui/Toolbar.test.ts` | 49 |
| `src/lib/components/ui/VehicleDocuments.test.ts` | 241 |
| `src/lib/components/layout/AppShell.test.ts` | 373 |
| `src/lib/components/layout/PageHeader.test.ts` | 72 |
| `src/lib/components/layout/navigation.test.ts` | 128 |
| `docs/architecture/styling.md` | 85 |
| `docs/architecture/creation-flow.md` | 93 |
| `CONTRIBUTING.md` | 1474 |
| `e2e/helpers.ts` | Z. 100-165 (Auszug) |
| `src/lib/server/db/schema.ts` | nur grep (`archived`-Spalten Z. 219/285/531/857; `items`/`tires` ohne) |
| `src/lib/server/services/vehicle-document-service.ts` | nur grep (Z. 24-34: MIME-Allowlist, 15 MiB) |

Grep-Auswertungen (Verwendungszahlen je Komponente, DaisyUI-Klassenzählung über 132 `.svelte`-Dateien, Aufrufer-Props von ImageUploader/EmailComposer/MultiSelect/QuickTimeEntryModal, Routen-Modale) sind in den Abschnitten 4.2/4.3/10 eingearbeitet; Zählskript: `scratchpad/daisy-count.sh`.
