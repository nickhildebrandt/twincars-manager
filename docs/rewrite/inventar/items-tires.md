---
title: Inventar Artikel & Reifen (ITEM)
teil_von: docs/rewrite/01-inventar.md
stand: Bestand (SvelteKit) vor dem Rewrite
---

> **Detail-Inventar des Bestands.** Erhoben durch vollständiges Lesen der in
> Abschnitt „Gelesene Dateien" genannten Dateien. Die IDs wurden auf die
> globalen IDs aus [01-inventar.md](../01-inventar.md) umgestellt
> (92 IDs). Zurück: [01-inventar.md](../01-inventar.md) ·
> [02-befunde.md](../02-befunde.md)

# Modul: Artikel/Leistungen (Items), Reifenkatalog (Tires), Reifeneinlagerung (Tire-Storage), Reifen-Erinnerungen, Etiketten   (Kürzel: ITEM)

## 1. Routen und Seiten

| Route | Datei | Parameter | Guard / Permission | Layout | Datenabhängigkeiten | Zweck |
|---|---|---|---|---|---|---|
| `/items` | `src/routes/items/+page.svelte` | `q`, `kind` (State, nicht URL), `pageNum` | `items` | AppShell | `listItemsRemote` | Katalog Leistungen/Material/Artikel |
| `/items/new` | `src/routes/items/new/+page.svelte` | – | `items` | AppShell | `createItemRemote` | Anlegen |
| `/items/[id]` | `src/routes/items/[id]/+page.svelte` | `id` | `items` | AppShell | `getItemRemote`, `getItemPriceHistoryRemote` | Detail + Preisverlauf |
| `/items/[id]/edit` | `src/routes/items/[id]/edit/+page.svelte` | `id` | `items` | AppShell | `getItemRemote`, `updateItemRemote` | Bearbeiten |
| `/tires` | `src/routes/tires/+page.svelte` | `q`, `season`, `pageNum` | `tires` | AppShell | `listTiresRemote` | Reifenkatalog |
| `/tires/new` | `src/routes/tires/new/+page.svelte` | – | `tires` | AppShell | `createTireRemote` | Anlegen |
| `/tires/[id]` | `src/routes/tires/[id]/+page.svelte` | `id` | `tires` | AppShell | `getTireRemote`, `listTirePhotosRemote`, `getTirePriceHistoryRemote` | Detail, Galerie, Preisverlauf |
| `/tires/[id]/edit` | `src/routes/tires/[id]/edit/+page.svelte` | `id` | `tires` | AppShell | `getTireRemote`, `updateTireRemote` | Bearbeiten |
| `/tire-storage` | `src/routes/tire-storage/+page.svelte` | `q`, Tab `active\|retrieved`, `pageNum` | `tires` | AppShell | `listTireStorageRemote` | Einlagerungen |
| `/tire-storage/new` | `src/routes/tire-storage/new/+page.svelte` | – | `tires` | AppShell | `createTireStorageRemote` | Anlegen |
| `/tire-storage/[id]` | `src/routes/tire-storage/[id]/+page.svelte` | `id` | `tires` | AppShell | `getTireStorageRemote`, `getTireStorageLabelPdfRemote` | Detail, Etikett, Abholung |
| `/tire-storage/[id]/edit` | `src/routes/tire-storage/[id]/edit/+page.svelte` | `id` | `tires` | AppShell | `getTireStorageRemote`, `updateTireStorageRemote` | Bearbeiten |
| `/tire-storage/scan/[number]` | `src/routes/tire-storage/scan/[number]/+page.svelte` | `number` | `tires` | AppShell | `resolveTireStorageByNumberRemote` | QR-Ziel, leitet auf Detail um |
| `/settings/tire-reminders` | `src/routes/settings/tire-reminders/+page.svelte` | – | `settings` | Settings-TabGroup | `getTireReminderPreviewRemote`, `sendTireRemindersRemote` | Saison-Erinnerungen |

Keine Filter stehen in der URL; Neuladen verliert Suche, Filter und Seite.

## 2. Remote Functions und Endpoints

### Artikel — `src/routes/items/items.remote.ts`

- **`listItemsRemote`** — query — `items.remote.ts:56`
  - Guard `requirePermission('items')`
  - Args: `page: number()` (**ohne `minValue`**), `size: picklist([10,25,50,100])`, `q?` ≤ 200, `kind?` freier String ≤ 20 (`'all'` → kein Filter)
  - Rückgabe `{ items: ItemWithPrice[], total, page, size, pageCount }`
  - Nebenwirkungen keine; Suche ILIKE über `articleNumber`, `description`; Sortierung fest `createdAt DESC`
- **`getItemRemote`** — query — `:68` — Guard `items`; 404 „Artikel nicht gefunden."
- **`getItemPriceHistoryRemote`** — query — `:85` — Guard `items`; `{ id, page, size }`; liest `item_price_versions` DESC; **keine Existenzprüfung des Items**
- **`createItemRemote`** — command — `:110` — Guard `items`; Nummer aus `nextArticleNumber()` falls leer; `requested(listItemsRemote, 4).refreshAll()`; **keine Transaktion** (Item + Preisversion getrennt)
- **`updateItemRemote`** — command — `:130` — Guard `items`; refresht Detail + Listen
- **`deleteItemRemote`** — command — `:148` — Guard `items`; **kein Verknüpfungs-Guard**, kein Zählen von `document_items`/`work_order_items`

`itemInputSchema` (`:31`): `articleNumber?` ≤50, `description` ≤500 (Pflicht), `kind` picklist `service|material|article|pass_through`, `unit?` ≤20, `unitPriceNet?` number, `purchasePriceNet?` number, `stockOnHand?` number, `onlineBookable?` bool, `notes?`. **Kein einziger Pipe-Schritt trägt eine deutsche Meldung.**

### Reifen — `src/routes/tires/tires.remote.ts`

- **`listTiresRemote`** — query — `:118` — Guard `tires`; Args `page`(ohne Minimum), `size` picklist, `q?`, `season?`, `brand?`, `width?`, `aspectRatio?`, `diameterInch?`, `onlineSellable?`
- **`getTireRemote`** — query — `:131` — 404 „Reifen nicht gefunden."
- **`getTirePriceHistoryRemote`** — query — `:148`
- **`createTireRemote`** / **`updateTireRemote`** / **`deleteTireRemote`** — commands — `:194/:213/:232` — Guard `tires`; Nummer via `allocateNumber('tire')`; `deleteTire` ohne Guard
- **`upsertTirePriceRemote`** — command — `:245` — `{ tireId, validFrom: dateStringSchema, unitPriceNet: number() }`
- **`listTirePhotosRemote`** / **`addTirePhotoRemote`** / **`setMainTirePhotoRemote`** / **`deleteTirePhotoRemote`** — `:271…:305` — Foto als Base64 ≤ 8 MiB, `mime` freier String ≤50 (**keine Whitelist**)

`tireInputSchema` (`:47`): Marke/Modell Pflicht mit deutschen Meldungen; `width` 50–500, `aspectRatio` 10–100, `diameterInch` 8–30 jeweils mit deutschen Meldungen; `construction?` `R|D`; `loadIndex?` ≤10; `speedIndex?` ≤5; `season` picklist `Sommer|Winter|Ganzjahres`; `ean?`, `manufacturerPartNumber?`; EU-Label je ein Buchstabe (**ohne A–E-Prüfung**); `noiseDb?` 0–150; sechs Boolesche Eigenschaften; `description?` ≤1000; `purchasePriceNet?`, `unitPriceNet?`, `stockOnHand?` je `number()` **ohne Grenzen**; `onlineSellable?`; `notes?`.

### Einlagerung — `src/routes/tire-storage/tire-storage.remote.ts`

- **`listTireStorageRemote`** — query — `:113` — Guard `tires`; `{ page, size, q?, active? }`
- **`getTireStorageRemote`** — query — `:127` — 404 „Reifeneinlagerung nicht gefunden."
- **`resolveTireStorageByNumberRemote`** — query — `:145` — Guard `tires`; Nummer ≤50 → `{ id }`; 404 „Keine Einlagerung mit dieser Nummer gefunden."
- **`createTireStorageRemote`** / **`updateTireStorageRemote`** — commands — `:161/:177`
- **`markRetrievedRemote`** — command — `:196` — optionales Datum, sonst heute
- **`deleteTireStorageRemote`** — command — `:214` — hart, ohne Rückfrage serverseitig

`tireStorageInputSchema` (`:46`): `customerId` Pflicht, `vehicleId?`, `brand?` ≤80, `model?` ≤120, `size?` ≤40, `profileMm?` 0–20, `dotYear?` 1980–2100, `season?` `summer|winter|allseason`, `quantity?` 1–20, `photos?` Array aus `{mime ≤64, data ≤8 MiB, caption? ≤200}`, `notes?`, `storedAt?`, `retrievedAt?` — **`retrievedAt` ist vom Client direkt setzbar.**

### Etikett — `src/routes/tire-storage/labels.remote.ts`

- **`getTireStorageLabelPdfRemote`** — query — `:19` — Guard `tires`; rendert A6-Etikett, QR-Inhalt `{origin}/tire-storage/scan/<storageNumber>`; Rückgabe `{ filename, mime, data(base64) }`; Dateiname sanitisiert

### Erinnerungen — `src/routes/settings/tire-reminders.remote.ts`

- **`getTireReminderPreviewRemote`** — query — `:24` — Guard **`settings`**; `{ season: 'spring'|'autumn' }`
- **`sendTireRemindersRemote`** — command — `:38` — Guard **`settings`**; Jahr immer serverseitig

## 3. Services (Server-Layer)

`item-service.ts`
- `listItems(params)` — Liste + Zähler parallel, danach **je Zeile** `getCurrentItemPrice` → **N+1** (25 Zusatzabfragen/Seite)
- `createItem` / `updateItem` — trennen `unitPriceNet` ab und legen über `upsertItemPrice` eine Version mit `valid_from = heute` an; `updateItem` setzt `updatedAt` manuell
- `deleteItem(id)` — reines `DELETE`, kein Guard
- `getItem`, `nextArticleNumber()` = `count()+1` als `ART-00001` (**nicht atomar, nach Löschung Duplikate**)
- `listPublicServices()` — **alle** `kind='service'` ohne Pagination, wieder N+1
- `getItemPriceAt/getCurrentItemPrice/upsertItemPrice/deleteItemPriceVersion/listItemPriceHistory`

`tire-service.ts`
- `listTires` — wie oben inkl. N+1; Suche zusätzlich über `parseTireSize(q)` (Größen-Trio exakt)
- `nextArticleNumber()` = `allocateNumber('tire')` (atomar — anders als bei Items)
- `createTire/updateTire/deleteTire` analog, `deleteTire` ohne Guard
- Preisversionen wie bei Items
- Fotos: `listTirePhotos`, `addTirePhoto` (erstes Foto wird Titelbild, `sortOrder` = bisherige Anzahl), `deleteTirePhoto` (rückt Titelbild nach), `setMainTirePhoto`
- `parseTireSize(raw)` — Regex `^(\d{2,3})/(\d{2,3})(Z?R|D)?(\d{2,3})$`, `ZR`→`R`, Standard `R`
- `listPublicTires(filters)` — **ohne Pagination**, N+1 auf Preise, danach `fetchTirePhotosFor` (max. 7 Fotos je Reifen, Base64 inline); unparsbare Größe ⇒ leeres Ergebnis
- `getPublicTire(id)` — nur wenn `onlineSellable`

`tire-storage-service.ts`
- `listTireStorage` — Join auf `customers` (inner), Suche über Lagernummer/Marke/Modell/Größe/Kundenname/Kundennummer; `active` steuert `retrievedAt IS (NOT) NULL`; **selektiert die ganze Tabellenzeile inklusive `photos`-jsonb**
- `getTireStorage`, `getTireStorageIdByNumber`, `nextStorageNumber()` = `allocateNumber('tire_storage')`
- `createTireStorage` (Nummer + `storedAt` serverseitig), `updateTireStorage`, `markRetrieved`, `deleteTireStorage`

`tire-reminder-service.ts`
- `findTireReminderCandidates(season, asOf?)` — Kunden mit `wants_tire_reminders`, nicht archiviert, E-Mail vorhanden, mindestens eine aktive Einlagerung, noch kein Log-Eintrag für `(season, year)`
- `previewTireReminderCandidates` — Anzahl + 5 Beispielnamen
- `sendTireReminders` — **sequentiell** je Kunde `sendDocumentEmail({ documentType: 'tire_reminder' })`; Log-Zeile erst **nach** erfolgreichem Versand (`onConflictDoNothing`), Fehler sammeln und zurückgeben

## 4. Komponenten (modul-lokal)

| Komponente | Datei | Zweck | Besonderheiten |
|---|---|---|---|
| `ItemForm` | `src/routes/items/ItemForm.svelte` | Anlegen/Bearbeiten Artikel | Abschnitte Stammdaten / Preise / Lager / Notiz; `u()` wandelt Leereingaben in `undefined` |
| `TireForm` | `src/routes/tires/TireForm.svelte` | Anlegen/Bearbeiten Reifen (622 Zeilen) | Größen-Trio, EU-Label, Eigenschaften, Preise |
| `TireStorageForm` | `src/routes/tire-storage/TireStorageForm.svelte` | Einlagerung (664 Zeilen) | Kunden-/Fahrzeug-Picker, Saison, Stückzahl, Fotos |
| Galerie auf `/tires/[id]` | Detailseite | Fotos hinzufügen/löschen/Titelbild | nutzt `ImageUploader` |

## 5. Tabellen

- `items` — `article_number` unique, `kind` varchar(20) ohne CHECK, `unit`, `purchase_price_net`, `stock_on_hand`, `online_bookable`, `notes`, `legacy_item_number`. **Kein `unit_price_net`** (seit 0008 ausgelagert).
- `item_price_versions` — `(item_id, valid_from)` unique, CASCADE
- `tires` — 30 Spalten: Nummern, Marke/Modell, `width`/`aspect_ratio`/`construction`/`diameter_inch`, Indizes, `season` varchar(20), EAN, EU-Label (je 1 Zeichen), `noise_db`, sechs Flags, `purchase_price_net`, `stock_on_hand`, `online_sellable`, Beschreibung, Notiz
- `tire_price_versions`, `tire_photos` (`is_main`, `sort_order`, `data` base64)
- `tire_storage` — `storage_number` unique, `customer_id` RESTRICT, `vehicle_id` SET NULL, Reifendaten, `photos` **jsonb**, `stored_at` Pflicht, `retrieved_at` nullable; Indizes auf Kunde und `retrieved_at`
- `tire_reminder_log` — `(customer_id, season, year)` unique; **`customer_id` ohne Fremdschlüssel**
- `number_ranges` — Schlüssel `tire`, `tire_storage`

## 6. Flows

- **Artikel anlegen** — `/items` → „Neu" → Formular → Speichern → Toast → Detail. Leerzustand „Noch keine Artikel" mit Anlegen-Aktion. Validierungsfehler zum Klickzeitpunkt mit Fehlerzusammenfassung.
- **Artikel löschen** — Aktionszelle → `ConfirmDialog` „Artikel löschen?" → Toast „„<Name>" gelöscht." → optimistische Listenaktualisierung. **Serverseitig ohne Prüfung auf verknüpfte Belegpositionen.**
- **Reifen anlegen** — analog; Nummer aus dem Nummernkreis; Größe als drei Zahlen plus Bauart.
- **Reifen-Detail** — Karten Größe & Index, EU-Label, Eigenschaften, Preise & Lager, Beschreibung, Notiz, Galerie, Preisverlauf.
- **Einlagerung anlegen** — Kunde (Pflicht, Picker), optional Fahrzeug, Reifendaten, Saison, Stückzahl, Fotos → Lagernummer wird vergeben.
- **Etikett** — Detail → „Etikett" → A6-PDF mit QR auf die Scan-Route; Ausdruck klebt am Reifensatz.
- **Scan** — Mitarbeiter scannt → `/tire-storage/scan/<Nummer>` → Auflösung → Weiterleitung auf das Detail. Unbekannte Nummer → 404-Seite. **Die Route liegt hinter dem Login.**
- **Abholung** — Detail → „Als abgeholt markieren?" → `markRetrieved` → Eintrag wandert in den Tab „Abgeholt".
- **Saison-Erinnerung** — Einstellungen → Saison wählen → Vorschau (Anzahl + 5 Namen) → „Erinnerungen jetzt versenden?" → Versand → Toast mit Anzahl. Zweiter Lauf im selben Jahr ist wirkungslos.

## 7. Nebenwirkungen

- E-Mail: Vorlage `tire_reminder` über `sendDocumentEmail`, Protokoll in `sent_messages`, Idempotenz über `tire_reminder_log`
- PDF: A6-Etikett mit QR-Code (`qr-service.ts`), nicht zwischengespeichert (wird bei jedem Aufruf neu gerendert)
- Nummernkreise: `tire`, `tire_storage` atomar; Artikelnummer der Items **nicht**
- Öffentliche API: `/api/public/services`, `/api/public/tires`, `/api/public/tires/[id]`

## 8. Vorhandene Tests

| Testdatei | Art | Inhalt |
|---|---|---|
| `src/lib/server/services/item-service.test.ts` | unit | Preisversionen, Auflösung zum Stichtag |
| `src/lib/server/services/tire-service.test.ts` | unit | Größen-Parser, Liste, öffentliche Projektion |
| `src/lib/server/services/tire-storage-service.test.ts` | unit | CRUD, Nummernvergabe, Abholung |
| `src/lib/server/services/tire-reminder-service.test.ts` | unit | Kandidaten, Idempotenz |
| `src/routes/items/ItemForm.test.ts` | component | Felder, Validierung |
| `src/routes/tires/TireForm.test.ts` | component | Felder, Validierung |
| `src/routes/tire-storage/TireStorageForm.test.ts` | component | Felder, Validierung |
| `src/routes/tire-storage/labels.remote.test.ts` | integration | Etikett-Erzeugung |

Keine Tests für: Listen-Remotes, Löschpfade, Foto-Endpunkte, Scan-Route, öffentliche Reifen-Endpunkte.

## 9. Feature-Matrix

| ID | Feature | Routen | Endpoints/Remotes | Tabellen | Erwartetes Verhalten |
|---|---|---|---|---|---|
| F-257 | Artikelliste mit Suche und Typfilter | `/items` | `listItemsRemote` | `items` | ILIKE über Art-Nr. und Beschreibung; Filter-Tabs Alle/Leistung/Material/Artikel/Durchlaufposten; Tabwechsel setzt Seite 1; Sortierung fest neueste zuerst |
| F-258 | Artikelliste: Spalten, Zeilenklick, Aktionen | `/items` | – | `items` | Spalten Art-Nr., Beschreibung, Einheit, Preis netto, Bestand, Aktion; ganze Zeile öffnet Detail; Aktionszelle mit Bearbeiten/Löschen |
| F-259 | Leerzustand Artikelliste | `/items` | – | – | „Noch keine Artikel" mit Beschreibung und Anlegen-Aktion |
| F-260 | Artikel anlegen | `/items/new` | `createItemRemote` | `items`, `item_price_versions` | Beschreibung Pflicht; Typ, Einheit, Preise, Bestand, Notiz optional; Toast; Weiterleitung ins Detail |
| F-261 | Artikelnummer automatisch | – | `nextArticleNumber` | `items` | Format `ART-00001`, fortlaufend aus der Zeilenzahl; manuelle Eingabe möglich |
| F-262 | Artikeltypen | `/items`, `/items/new` | `createItemRemote` | `items.kind` | Leistung, Material, Artikel, Durchlaufposten; steuert Filter und Artikel-Picker |
| F-263 | Kennzeichen „online buchbar" | `/items/new`, `/items/[id]/edit` | `createItemRemote` | `items.online_bookable` | nur für Leistungen sinnvoll; einziges Tor für die Online-Terminbuchung |
| F-264 | Artikel bearbeiten | `/items/[id]/edit` | `updateItemRemote` | `items` | Formular vorbelegt; neuer Preis erzeugt Version mit Gültigkeit heute |
| F-265 | Artikel löschen | `/items`, `/items/[id]` | `deleteItemRemote` | `items` | Bestätigungsdialog „Artikel löschen?"; Toast; optimistische Entfernung aus der Liste |
| F-266 | Artikel-Detail Stammdaten | `/items/[id]` | `getItemRemote` | `items` | Artikelnummer, Typ, Einheit, Beschreibung, Notiz |
| F-267 | Artikel-Detail Preise und Lager | `/items/[id]` | `getItemRemote` | `items`, `item_price_versions` | VK netto (aktuelle Version), EK netto, Bestand |
| F-268 | Preisversionierung Artikel | – | `upsertItemPrice` | `item_price_versions` | eine Zeile je `gültig ab`; gleiche Gültigkeit ⇒ Aktualisierung statt Duplikat |
| F-269 | Preisverlauf Artikel, paginiert | `/items/[id]` | `getItemPriceHistoryRemote` | `item_price_versions` | Spalten Gültig ab, Einzelpreis netto, Erfasst; neueste zuerst |
| F-270 | Preis zum Stichtag auflösen | – | `getItemPriceAt` | `item_price_versions` | höchste Version mit `gültig ab <= Stichtag`; Belege behalten ihren Schnappschuss |
| F-271 | Artikel-Picker | Belege, Aufträge | `pickItemsRemote` | `items` | Serversuche, Kategorie-Filter Leistung vs. Material; liefert aktuellen Preis mit; auch für Recht `orders` |
| F-272 | Öffentlicher Leistungskatalog | `/api/public/services` | `listPublicServices` | `items` | liefert id, Art-Nr., Beschreibung, Einheit, aktueller Preis, online buchbar |
| F-273 | Klick-Zeit-Validierung Artikelformular | `/items/new`, `/items/[id]/edit` | – | – | Speichern nie wegen Eingaben gesperrt; deutsche Fehlerzusammenfassung und Feldfehler |
| F-274 | Unsaved-Changes-Guard | alle drei Formulare | – | – | Warnung beim Verlassen mit ungespeicherten Änderungen |
| F-275 | Reifenliste mit Suche und Saisonfilter | `/tires` | `listTiresRemote` | `tires` | ILIKE über Art-Nr., Marke, Modell, EAN; zusätzlich exakte Größensuche, wenn die Eingabe wie `205/55R16` aussieht; Tabs Alle/Sommer/Winter/Ganzjahres |
| F-276 | Reifenliste: Spalten und Aktionen | `/tires` | – | `tires` | Art-Nr., Marke/Modell, Größe, Saison, Preis netto, Bestand, Aktion |
| F-277 | Leerzustand Reifenliste | `/tires` | – | – | „Noch keine Reifen" mit Anlegen-Aktion |
| F-278 | Reifen anlegen | `/tires/new` | `createTireRemote` | `tires`, `tire_price_versions` | Marke, Modell, Breite, Querschnitt, Durchmesser und Saison sind Pflicht mit deutschen Meldungen |
| F-279 | Reifennummer aus Nummernkreis | – | `allocateNumber('tire')` | `number_ranges` | atomar; fehlender Kreis wird selbst angelegt |
| F-280 | Größen-Trio und Bauart | `/tires/*` | `createTireRemote` | `tires` | Breite 50–500 mm, Querschnitt 10–100 %, Durchmesser 8–30 Zoll, Bauart R oder D (Standard R) |
| F-281 | EU-Reifenlabel | `/tires/*` | `createTireRemote` | `tires` | Kraftstoffeffizienz, Nasshaftung, Geräuschklasse je ein Buchstabe, Geräuschwert 0–150 dB |
| F-282 | Reifeneigenschaften | `/tires/*` | `createTireRemote` | `tires` | Run-Flat, XL/RF, Spikes, M+S, Schneeflocke, E-Auto-tauglich; Detail zeigt „Keine Sondereigenschaften." |
| F-283 | Reifen bearbeiten | `/tires/[id]/edit` | `updateTireRemote` | `tires` | Leereingaben werden ausdrücklich auf `NULL` gesetzt (anders als bei Artikeln) |
| F-284 | Reifen löschen | `/tires` | `deleteTireRemote` | `tires` | Bestätigungsdialog „Reifen löschen?"; Toast mit Bezeichnung |
| F-285 | Reifen-Detail | `/tires/[id]` | `getTireRemote` | `tires` | Kopf „Marke Modell" und „Größe · Saison"; Karten Größe & Index, EU-Label, Eigenschaften, Preise & Lager, Beschreibung, Notiz |
| F-286 | Reifen-Preisversionen und Verlauf | `/tires/[id]` | `upsertTirePriceRemote`, `getTirePriceHistoryRemote` | `tire_price_versions` | Gültigkeitsdatum frei wählbar; Verlauf paginiert |
| F-287 | Reifengalerie | `/tires/[id]` | `listTirePhotosRemote`, `addTirePhotoRemote`, `setMainTirePhotoRemote`, `deleteTirePhotoRemote` | `tire_photos` | erstes Foto wird Titelbild; Löschen des Titelbilds rückt das nächste nach; Toasts „Foto hinzugefügt."/„Foto gelöscht." |
| F-288 | Kennzeichen „online verkaufbar" | `/tires/*` | `updateTireRemote` | `tires.online_sellable` | einziges Tor für die öffentliche Sichtbarkeit |
| F-289 | Reifengrößen-Parser | – | `parseTireSize` | – | akzeptiert `205/55R16`, `205/55 R16`, `205/55 ZR 17`, `205/55D16`; `ZR` wird zu `R` normalisiert |
| F-290 | Öffentlicher Reifenkatalog | `/api/public/tires`, `/api/public/tires/[id]` | `listPublicTires`, `getPublicTire` | `tires`, `tire_photos` | nur `online_sellable`; Filter Größe, Saison, Marke, Höchstpreis; liefert Größenbezeichnung, aktuellen Preis und bis zu sieben Fotos |
| F-291 | Reifen-Picker | Belege | `pickTiresRemote` | `tires` | Serversuche über Art-Nr., Marke, Modell, EAN; liefert Größe, Saison, Preis |
| F-292 | Reifen in der globalen Suche | überall | `searchRemote` | `tires` | eigener Ergebnisbereich |
| F-293 | Einlagerungsliste mit Tabs | `/tire-storage` | `listTireStorageRemote` | `tire_storage`, `customers` | Tabs „Aktiv eingelagert" und „Abgeholt"; Tabwechsel setzt Seite 1; Spalte „Abgeholt" nur im zweiten Tab |
| F-294 | Einlagerungssuche | `/tire-storage` | `listTireStorageRemote` | `tire_storage`, `customers` | über Lagernummer, Marke, Modell, Größe, Kundenname, Kundennummer |
| F-295 | Einlagerung anlegen | `/tire-storage/new` | `createTireStorageRemote` | `tire_storage` | Kunde Pflicht; Reifendaten, Saison, Stückzahl 1–20, Profil 0–20 mm, DOT-Jahr 1980–2100 |
| F-296 | Lagernummer aus Nummernkreis | – | `allocateNumber('tire_storage')` | `number_ranges` | Format `L-{Jahr}-{lfd}`; eindeutig |
| F-297 | Verknüpfung Kunde und Fahrzeug | `/tire-storage/*` | `createTireStorageRemote` | `tire_storage` | Kunde über Picker, Fahrzeug optional; Kunde ist gegen Löschen geschützt |
| F-298 | Reifendaten der Einlagerung | `/tire-storage/*` | – | `tire_storage` | Marke, Modell, Größe, Profil, DOT-Jahr, Saison, Stückzahl (Standard 4) |
| F-299 | Fotos der Einlagerung | `/tire-storage/*` | `createTireStorageRemote` | `tire_storage.photos` | als JSON-Feld am Datensatz, je Bild bis 8 MiB, optionale Bildunterschrift |
| F-300 | Einlagerung bearbeiten | `/tire-storage/[id]/edit` | `updateTireStorageRemote` | `tire_storage` | alle Felder änderbar |
| F-301 | Als abgeholt markieren | `/tire-storage/[id]` | `markRetrievedRemote` | `tire_storage.retrieved_at` | Bestätigung „Als abgeholt markieren?"; Standarddatum heute; Toast „Als abgeholt markiert." |
| F-302 | Einlagerung löschen | `/tire-storage/[id]` | `deleteTireStorageRemote` | `tire_storage` | Bestätigung „Eintrag löschen?"; Toast „Eintrag gelöscht." |
| F-303 | Einlagerungs-Detail | `/tire-storage/[id]` | `getTireStorageRemote` | `tire_storage`, `customers` | Karten Stammdaten, Lagerstatus, Notiz, Fotos; Kundennummer und Kundenname |
| F-304 | Etikett als A6-PDF mit QR | `/tire-storage/[id]` | `getTireStorageLabelPdfRemote` | `tire_storage` | Lagernummer lesbar und als QR; Dateiname `Reifenlager_<Nummer>.pdf` |
| F-305 | Scan-Route | `/tire-storage/scan/[number]` | `resolveTireStorageByNumberRemote` | `tire_storage` | löst Nummer auf und leitet auf das Detail um; unbekannte Nummer ergibt 404 |
| F-306 | Einlagerung in der globalen Suche | überall | `searchRemote` | `tire_storage` | eigener Ergebnisbereich |
| F-307 | Kandidaten für Reifenerinnerungen | – | `findTireReminderCandidates` | `customers`, `tire_storage`, `tire_reminder_log` | Zustimmung, nicht archiviert, E-Mail vorhanden, aktive Einlagerung, noch nicht benachrichtigt |
| F-308 | Vorschau der Erinnerungen | `/settings/tire-reminders` | `getTireReminderPreviewRemote` | wie oben | Anzahl und bis zu fünf Beispielnamen |
| F-309 | Erinnerungen versenden | `/settings/tire-reminders` | `sendTireRemindersRemote` | `tire_reminder_log`, `sent_messages` | Bestätigung „Erinnerungen jetzt versenden?"; Vorlage `tire_reminder`; Protokollzeile erst nach erfolgreichem Versand; zweiter Lauf im selben Jahr ist wirkungslos |
| F-310 | Einstellungsseite Reifenerinnerungen | `/settings/tire-reminders` | beide Remotes | – | Saisonwahl Frühjahr/Herbst; Jahr immer serverseitig |
| F-311 | Berechtigungen und Navigation | Sidebar, Settings | – | – | Katalog und Lager unter `tires`; Erinnerungen unter `settings`; Sidebar-Einträge „Reifenkatalog" und „Reifenlager" |

## 10. Befunde

| ID | Beschreibung | Fundstelle | Auswirkung | Empfehlung | Einordnung | Betroffene Features |
|---|---|---|---|---|---|---|
| B-229 | **N+1 in beiden Katalog-Listen**: nach der Seitenabfrage wird je Zeile einzeln der gültige Preis geholt (25 zusätzliche Abfragen je Seitenaufruf). | `item-service.ts:44-50`; `tire-service.ts:112-118` | Listen skalieren schlecht; bei 25 Zeilen 26 statt 2 Abfragen | Preis per `LATERAL`/Fensterfunktion mitziehen | im Rewrite beheben | F-257, F-275 |
| B-230 | **Einlagerungsliste lädt alle Fotos mit**: `db.select({ entry: tireStorage, … })` zieht die komplette Zeile inklusive `photos`-JSON (bis 8 MiB je Bild) für **25 Zeilen**. | `tire-storage-service.ts:60-70` | Sehr große Antworten, hoher Speicherbedarf, langsame Liste | Spalten ausdrücklich auswählen, Fotos nur im Detail | im Rewrite beheben | F-293, F-294 |
| B-231 | **`listPublicServices` ohne Pagination** und mit N+1; liefert jede Leistung, auch das interne Arbeitszeit-Item mit Stundensatz. | `item-service.ts:122-136` | Interne Kalkulation nach außen sichtbar, unbegrenzte Antwort | Auf `online_bookable` einschränken, paginieren | im Rewrite beheben | F-272 |
| B-232 | **`listPublicTires` ohne Pagination**, mit N+1 auf Preise und bis zu sieben Base64-Fotos je Reifen in der Liste. | `tire-service.ts:430-470` | Antwortgrößen im zweistelligen Megabytebereich möglich | Paginieren, Bilder über eigene URLs ausliefern | im Rewrite beheben | F-290 |
| B-233 | **`deleteItem` hat keinerlei Verknüpfungsprüfung.** Belegpositionen und Auftragspositionen verweisen auf den Artikel; gelöscht wird ohne Zählung und ohne Meldung. | `item-service.ts:104-106`; `items.remote.ts:148` | Rückverweis von Belegzeilen auf den Katalog geht verloren oder es entsteht ein unbehandelter Fehler | Alle Verweise zählen und mit deutscher Meldung verweigern | im Rewrite beheben | F-265 |
| B-234 | **`deleteTire` ebenso ohne Guard** — inklusive Fotos und Preisversionen. | `tire-service.ts:180-182` | Datenverlust ohne Warnung | wie oben | im Rewrite beheben | F-284 |
| B-235 | **`deleteTireStorage` prüft nichts** — auch ein aktiv eingelagerter Satz lässt sich löschen, ohne dass jemand widerspricht. | `tire-storage-service.ts:200-202` | Ein Reifensatz liegt im Regal, der Datensatz ist weg | Löschen nur für abgeholte Einträge, sonst Hinweis | im Rewrite beheben | F-302 |
| B-236 | **Artikelnummer wird aus `count()+1` gebildet** — nicht atomar und nach dem Löschen eines Artikels doppelt vergeben (Unique-Index schlägt zu, unkurierter 500). | `item-service.ts:118-121` | Anlegen schlägt scheinbar grundlos fehl | `allocateNumber('item')` wie bei Reifen benutzen | im Rewrite beheben | F-261, F-260 |
| B-237 | **Leeren eines Feldes im Artikelformular wirkt nicht**: leere Eingaben werden zu `undefined`, Drizzle lässt `undefined` in `.set()` weg. Einheit, Notiz, Art-Nr. lassen sich nie wieder entfernen. Beim Reifenformular ist derselbe Fall ausdrücklich behandelt, beim Artikel nicht. | `ItemForm.svelte:88,105-113`; `item-service.ts:92-98`; Gegenbeispiel `tires.remote.ts:163-186` | Falsche Stammdaten bleiben dauerhaft stehen | Leer als `null` senden | im Rewrite beheben | F-264 |
| B-238 | **`itemInputSchema` trägt an keinem einzigen Pipe-Schritt eine deutsche Meldung.** | `items.remote.ts:31-42` | Der Nutzer sieht englische Standardtexte oder den Ersatztext | Meldungen ergänzen bzw. global auf Deutsch stellen | im Rewrite beheben | F-273 |
| B-239 | **`page: number()` ohne Mindestwert** in allen drei Listen- und beiden Verlaufsschemas → negative Seite ergibt negativen Offset und damit 500. | `items.remote.ts:45,75`; `tires.remote.ts:105,141`; `tire-storage.remote.ts:79` | Unkurierter Fehler bei manipulierten Anfragen | Gemeinsames Listenschema mit Grenzen verwenden | im Rewrite beheben | F-257, F-269, F-275, F-286, F-293 |
| B-240 | **`size: picklist([10,25,50,100])`** widerspricht der eigenen Festlegung auf 25 (ADR-003). | `items.remote.ts:46`; `tires.remote.ts:106`; `tire-storage.remote.ts:80` | Ein Aufrufer kann 100 Zeilen anfordern | `size` serverseitig festlegen | im Rewrite beheben | F-257, F-275, F-293 |
| B-241 | **Typfilter ist ein freier String** statt einer Auswahlliste; `season` beim Reifen ebenso. Ein unbekannter Wert liefert stillschweigend eine leere Liste. | `items.remote.ts:48`; `tires.remote.ts:108` | Stille Falschergebnisse | `picklist` benutzen | im Rewrite beheben | F-257, F-275 |
| B-242 | **Preise und Bestände ohne Grenzen** (`number()` ohne `minValue`/`maxValue`): negative Preise, negativer Bestand und Werte jenseits der Spaltenbreite sind möglich. | `items.remote.ts:37-39`; `tires.remote.ts:99-101` | Unsinnige Stammdaten, Überlauf in `numeric(12,2)` → 500 | Realistische Grenzen setzen | im Rewrite beheben | F-260, F-278 |
| B-243 | **Keine Transaktion** beim Anlegen: Artikel bzw. Reifen und die erste Preisversion werden getrennt geschrieben. Bricht der zweite Schritt ab, existiert ein Katalogeintrag ohne Preis. | `item-service.ts:70-84`; `tire-service.ts:150-166` | Datensätze ohne Preis, die in Belegen als 0 € erscheinen | `db.transaction` | im Rewrite beheben | F-260, F-278 |
| B-244 | **Preisänderung am selben Tag überschreibt die Version stillschweigend.** Es gibt keinen Verlauf darüber, dass der Preis heute schon einmal anders war. | `item-service.ts:172-198`; `tire-service.ts:217-247` | Nachvollziehbarkeit fehlt genau an dem Tag, an dem es zählt | Aktualisierung protokollieren oder Version je Änderung | bewusst später | F-268, F-286 |
| B-245 | **EU-Label-Buchstaben werden nicht geprüft**: `maxLength(1)` erlaubt jeden Buchstaben, auch `Z` oder `9`. | `tires.remote.ts:38-44` | Falsche Labelangaben landen in der öffentlichen Schnittstelle | `picklist(['A','B','C','D','E'])` | im Rewrite beheben | F-281, F-290 |
| B-246 | **Foto-Upload ohne Typprüfung**: `mime` ist ein freier String bis 50 Zeichen, es gibt keine Whitelist, keine Prüfung des Dateiinhalts und keine Verkleinerung. Übertragung als Base64 bis 8 MiB. | `tires.remote.ts:265-269`; `tire-storage.remote.ts:37-41` | Beliebige Dateien landen in der Datenbank und werden nach außen ausgeliefert | Whitelist, Magic-Bytes, serverseitige Verkleinerung, Multipart | im Rewrite beheben | F-287, F-299 |
| B-247 | **Keine Obergrenze für die Anzahl Fotos** je Reifen oder Einlagerung. | `tire-service.ts:300-320`; `tire-storage.remote.ts:73` | Unbegrenztes Wachstum der Datenbank | Anzahl begrenzen | im Rewrite beheben | F-287, F-299 |
| B-248 | **`retrievedAt` ist im Eingabeschema der Einlagerung enthalten** — der Abholstatus lässt sich damit am eigentlichen Vorgang vorbei setzen und auch wieder zurücksetzen. | `tire-storage.remote.ts:76` | Status und Protokoll laufen auseinander | Feld aus dem Schema nehmen, nur über den Abholvorgang setzen | im Rewrite beheben | F-300, F-301 |
| B-249 | **Abholdatum wird nicht gegen das Einlagerungsdatum geprüft** — eine Abholung vor der Einlagerung ist möglich. | `tire-storage-service.ts:186-196` | Unplausible Daten in Auswertungen | Prüfung ergänzen | im Rewrite beheben | F-301 |
| B-250 | **Saisonbegriffe sind dreifach uneinheitlich**: Katalog deutsch (`Sommer`/`Winter`/`Ganzjahres`), Einlagerung englisch (`summer`/`winter`/`allseason`), Erinnerung wieder anders (`spring`/`autumn`). | `tires.remote.ts:37`; `tire-storage.remote.ts:44`; `tire-reminders.remote.ts:15` | Verwechslungsgefahr, keine gemeinsame Auswertung möglich | Eine Kodierung, Anzeige getrennt davon | im Rewrite beheben | F-278, F-295, F-309 |
| B-251 | **Kein Enum und kein CHECK** auf `items.kind`, `tires.season`, `tires.construction`, `tire_storage.season`, `tire_reminder_log.season`. | `schema.ts:443,1348,1345,1708,1746` | Die Datenbank erlaubt jeden Wert; Altlasten bleiben unentdeckt | Enums oder CHECK-Constraints | im Rewrite beheben | F-262, F-280 |
| B-252 | **`tire_reminder_log.customer_id` hat keinen Fremdschlüssel**, obwohl es Kunden referenziert. | `schema.ts:1746` | Verwaiste Protokollzeilen nach dem Löschen eines Kunden | Fremdschlüssel ergänzen | im Rewrite beheben | F-309 |
| B-253 | **Erinnerungsversand läuft sequentiell im Request** ohne Fortschritt und ohne Obergrenze; bei vielen Kunden droht ein Zeitüberschreitung, und der Fortschritt ist dann unbekannt. | `tire-reminder-service.ts:130-186` | Abbruch mitten im Versand, Nutzer sieht keinen Stand | Als Aufgabe mit Fortschritt und Wiederaufnahme | im Rewrite beheben | F-309 |
| B-254 | **Erinnerungen hängen am Recht `settings` statt `tires`** — wer das Reifenlager führt, darf nicht erinnern; wer Einstellungen darf, verschickt Kundenpost. | `tire-reminders.remote.ts:26,40` | Falscher Personenkreis | Recht `tires` verwenden | Entscheidung nötig | F-309, F-311 |
| B-255 | **Scan-Seite navigiert in einem Effekt** (`goto` in `$effect`) — dasselbe Muster, das an anderer Stelle wegen der Hydration-Wiederherstellung doppelt feuert. | `scan/[number]/+page.svelte:20-22` | Doppelte Navigation, Zurück-Taste unzuverlässig | Serverseitige Weiterleitung | im Rewrite beheben | F-305 |
| B-256 | **Etikett-PDF wird bei jedem Aufruf neu gerendert** und nicht zwischengespeichert, anders als alle anderen Belege. | `labels.remote.ts:19-38` | Unnötige Last beim Etikettendruck | In den PDF-Zwischenspeicher aufnehmen | bewusst später | F-304 |
| B-257 | **Preisverlauf prüft die Existenz des Datensatzes nicht** — eine unbekannte Id liefert eine leere Liste statt 404. | `items.remote.ts:85-92`; `tires.remote.ts:148-155` | Fehler bleiben unbemerkt | Existenz prüfen | im Rewrite beheben | F-269, F-286 |
| B-258 | **Beide Listen sortieren fest nach Anlagedatum**; die Oberfläche bietet keine Sortierung, obwohl Nutzer nach Nummer oder Bezeichnung suchen würden. | `item-service.ts:36`; `tire-service.ts:104` | Umständliche Bedienung bei großen Katalogen | Sortierbare Spalten | im Rewrite beheben | F-257, F-275 |
| B-259 | **Kein Index auf `items.created_at` / `tires.created_at`**, obwohl beide Listen danach sortieren. | `schema.ts:474-478,1400-1406` | Volle Sortierung bei jedem Seitenaufruf | Index ergänzen | im Rewrite beheben | F-257, F-275 |
| B-260 | **`toRow` ist ein Behelfskonstrukt** mit unbrauchbarer Typsignatur und zwei `as any`-Umgehungen, in beiden Modulen kopiert. | `items.remote.ts:94-104`; `tires.remote.ts:157-190` | Typprüfung greift genau dort nicht, wo Werte umgewandelt werden | Umwandlung ins Schema (`transform`) ziehen | im Rewrite beheben | F-260, F-278 |
| B-261 | **`stockOnHand` wird gepflegt, aber nirgends fortgeschrieben**: kein Verkauf, kein Auftrag und kein Wareneingang verändert den Bestand. | `schema.ts:466,1381`; keine Schreibstelle außerhalb der Formulare | Die Spalte suggeriert eine Lagerführung, die es nicht gibt | Entweder Bestandsführung bauen oder Feld entfernen | Entscheidung nötig | F-267, F-285 |
| B-262 | **Scan-Route liegt hinter der Anmeldung**, das Etikett trägt aber einen QR-Code, den auch ein Kunde scannen kann. | `labels.remote.ts:27`; Auth-Gate | Kunde landet auf der Anmeldeseite und weiß nicht warum | Entweder als intern kennzeichnen oder eine öffentliche Statusseite anbieten | Entscheidung nötig | F-304, F-305 |
| B-263 | **Keine Tests für die Listen-Remotes, die Löschpfade, die Foto-Endpunkte, die Scan-Route und die öffentlichen Reifen-Endpunkte.** | `src/routes/items`, `src/routes/tires`, `src/routes/tire-storage` | Genau die Pfade mit den obigen Befunden sind ungeprüft | Abdeckung nach Teststrategie | im Rewrite beheben | F-257, F-265, F-284, F-287, F-290, F-305 |
| B-264 | **Filter und Seite stehen nicht in der URL** — Neuladen oder Zurück-Taste verlieren den Zustand. | `items/+page.svelte`, `tires/+page.svelte`, `tire-storage/+page.svelte` | Bedienung bricht bei jedem Neuladen ab | Zustand in die URL | im Rewrite beheben | F-257, F-275, F-293 |
| B-265 | **Kein Leerzustand für „Suche ohne Treffer"** — angezeigt wird derselbe Text wie bei einem leeren Katalog („Noch keine Reifen"), was in die Irre führt. | `items/+page.svelte:111`; `tires/+page.svelte` | Nutzer glaubt, der Katalog sei leer | Zwei getrennte Leerzustände | im Rewrite beheben | F-259, F-277 |

## 11. Offene Fragen an den Architekten

1. Soll der Bestand (`stock_on_hand`) tatsächlich geführt werden (Zu- und Abgänge aus Belegen) oder ersatzlos entfallen? Heute ist er ein reines Anzeigefeld (B-261).
2. Wer darf Reifenerinnerungen versenden — `tires` oder `settings` (B-254)?
3. Ist der QR-Code auf dem Etikett für Mitarbeiter oder auch für Kunden gedacht (B-262)?
4. Sollen Artikel und Reifen archivierbar werden statt löschbar, wie Kunden und Fahrzeuge?

## 12. Gelesene Dateien

| Datei | Zeilen |
|---|---|
| src/routes/items/items.remote.ts | 165 |
| src/lib/server/services/item-service.ts | 263 |
| src/routes/tires/tires.remote.ts | 317 |
| src/lib/server/services/tire-service.ts | 543 |
| src/routes/tire-storage/tire-storage.remote.ts | 233 |
| src/lib/server/services/tire-storage-service.ts | 211 |
| src/lib/server/services/tire-reminder-service.ts | 199 |
| src/routes/tire-storage/labels.remote.ts | 39 |
| src/routes/settings/tire-reminders.remote.ts | 48 |
| src/routes/tire-storage/scan/[number]/+page.svelte | 24 |
| src/lib/server/db/schema.ts (items, item_price_versions, tires, tire_price_versions, tire_photos, tire_storage, tire_reminder_log) | Auszüge |
| src/routes/items/+page.svelte, ItemForm.svelte, [id]/+page.svelte | Struktur- und Textauszüge |
| src/routes/tires/+page.svelte, [id]/+page.svelte | Struktur- und Textauszüge |
| src/routes/tire-storage/+page.svelte, [id]/+page.svelte, TireStorageForm.svelte | Struktur- und Textauszüge |
| src/routes/settings/tire-reminders/+page.svelte | Struktur- und Textauszüge |
| src/routes/pickers.remote.ts (pickItemsRemote, pickTiresRemote) | Auszüge |
| src/routes/api/public/services/endpoint.ts, api/public/tires/endpoint.ts | Feldprojektionen |
| Testbestand (8 Dateien) | Dateiliste |
