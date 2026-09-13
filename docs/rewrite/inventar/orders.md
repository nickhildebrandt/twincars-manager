---
title: Inventar Aufträge (ORD)
teil_von: docs/rewrite/01-inventar.md
stand: Bestand (SvelteKit) vor dem Rewrite
---

> **Detail-Inventar des Bestands.** Erhoben durch vollständiges Lesen der in
> Abschnitt „Gelesene Dateien" genannten Dateien. Die IDs wurden auf die
> globalen IDs aus [01-inventar.md](../01-inventar.md) umgestellt
> (90 IDs). Zurück: [01-inventar.md](../01-inventar.md) ·
> [02-befunde.md](../02-befunde.md)

# Modul: Aufträge (Werkstatt-Arbeitsaufträge, Kanban, Abschluss-zu-Rechnung)   (Kürzel: ORD)

Sprache: Deutsch für Fließtext/Tabellen; Code-Bezeichner, Dateipfade, Tabellen-/Spaltennamen bleiben englisch und exakt wie im Code.
Alles muss aus dem tatsächlich gelesenen Code stammen. Keine Vermutungen. Bei Unsicherheit "unklar" schreiben und Fundstelle nennen.
Fundstellen immer als `pfad/datei.ts:zeile`.

Alle Pfade relativ zu `/home/nick/tc/twincars-manager`.

## 1. Routen und Seiten

| Route | Datei | Parameter | Guard / Permission | Layout | Datenabhängigkeiten (Remote-Queries, Reihenfolge) | Zweck |
|---|---|---|---|---|---|---|
| `/orders` | `src/routes/orders/+page.svelte` | keine URL-Parameter. Filter `q` (Suchfeld, 250 ms debounce, `maxlength=200`, `+page.svelte:22-37`) und `employeeId` (SearchablePicker) leben nur im Komponenten-State, **nicht** in der URL (kein `?q=`/`?employeeId=`), keine Pagination | Session-Gate aus `hooks.server.ts`; fachlich `requirePermission('orders')` in `kanbanBoardRemote` (`orders.remote.ts:171`); Sidebar-Eintrag "Aufträge" mit `permission: 'orders'` (`navigation.ts:118-121`) | AppShell (kein eigenes `+layout.svelte` unter `src/routes/orders`, verifiziert per `find`) | 1. `await untrack(() => kanbanBoardRemote(boardArgs))` (`+page.svelte:46`), 2. `pickEmployeesRemote` lazy beim Öffnen des Mitarbeiter-Pickers (`+page.svelte:67-71`, `.run()`) | Kanban-Hauptansicht mit drei festen Spalten |
| `/orders/new` | `src/routes/orders/new/+page.svelte` | keine; Creation-Flow-Rückkehr über `creationFlow.pendingReturnFor(currentUrl())` (`WorkOrderForm.svelte:132`) | `createWorkOrderRemote` → `requirePermission('orders')` (`orders.remote.ts:325`) | AppShell, `PageHeader back="/orders"` | keine Query beim Laden; Picker-Remotes lazy (`pickCustomersRemote`, `pickCustomerVehiclesRemote`, `pickEmployeesRemote`) | Auftrag anlegen; nach Erfolg `goto('/orders/{id}', { replaceState: true })` (`new/+page.svelte:31`) |
| `/orders/[id]` | `src/routes/orders/[id]/+page.svelte` | `id` (`page.params.id`, eingefroren via `untrack`, `+page.svelte:40`) | `getWorkOrderRemote` → `requirePermission('orders')`, 404 `'Auftrag nicht gefunden.'` → Root `+error.svelte` (`orders.remote.ts:237-239`) | AppShell, `PageHeader back="/orders"`, `primaryAction` "Bearbeiten" nur wenn nicht `done` (`+page.svelte:394-400`) | parallel via `Promise.all`: `getWorkOrderRemote({id})`, `getLaborRateRemote()`, `pickEmployeesRemote({page:1,size:100})` (`+page.svelte:48-53`); Mutationen aktualisieren `getWorkOrderRemote({id})` per `.updates(...)` / `withOverride` | Detail: Stammdaten, Statusaktionen, Positionen (Erfassung/Bearbeitung), Rechnungshistorie, Abschluss-Dialog, Löschen |
| `/orders/[id]/edit` | `src/routes/orders/[id]/edit/+page.svelte` | `id` | `getWorkOrderRemote` (404 → Fehlerseite); `updateWorkOrderRemote` → `requirePermission('orders')` | AppHeader `back="/orders/{id}"`, `subtitle=orderNumber` (`edit/+page.svelte:51-55`) | `await getWorkOrderRemote({ id })` top-level (`edit/+page.svelte:21`) | Stammdaten/Termin/Zuweisungen bearbeiten; nach Erfolg `goto('/orders/{id}')` (`edit/+page.svelte:44`) |
| `/orders/[id]/DetailHost.svelte` | `src/routes/orders/[id]/DetailHost.svelte` | – | – | – | – | **Nur Test-Host** (`<svelte:boundary>` um `+page.svelte`), nicht produktiv importiert (`DetailHost.svelte:2-7`) |

Fremdrouten mit Auftragsbezug (Einstiege/Deep-Links in dieses Modul):

| Route | Datei | Bezug |
|---|---|---|
| `/calendar/[id]/edit` | `src/routes/calendar/[id]/edit/+page.svelte:43-69, 109-125` | Button "Auftrag erstellen" (→ `createWorkOrderFromAppointmentRemote`, Toast `'Auftrag angelegt.'`, `goto('/orders/{id}')`) bzw. Link "Zum Auftrag" wenn `getWorkOrderIdForAppointmentRemote` eine Id liefert; bei Fehler der Probe (z. B. 403) werden beide Aktionen still versteckt (`console.info`) |
| `/invoices/[id]` | `src/routes/invoices/[id]/+page.svelte:687-708` | Karte "Auftrag" (Auftragsnr., Titel, Button "Zum Auftrag" → `/orders/{id}`) für jede Rechnung mit `documents.work_order_id` (auch Storno und stornierte Originale, `invoices.remote.ts:162-175`); erfasste Stunden mit `workOrderItemId` zeigen Badge "Auftrag" statt Löschen (`+page.svelte:815-819`) |
| `/customers/[id]?tab=auftraege` | `src/routes/customers/[id]/+page.svelte:475-533` | Tab "Aufträge": paginiert 25/Seite via `listCustomerWorkOrdersRemote` (`customers.remote.ts:194-200`, `requireAnyPermission('customers','orders')`), Zeilenklick → `/orders/{id}` |
| `/vehicles/[id]?tab=auftraege` | `src/routes/vehicles/[id]/+page.svelte:545-601` | Tab "Aufträge" via `listVehicleWorkOrdersRemote` (`vehicles.remote.ts:270-300`, `requireAnyPermission('vehicles','orders')`) |
| `/hours?workOrderId=<uuid>` | `src/routes/hours/+page.svelte:33-51, 195-209, 262-269, 283-289` | Deep-Link-Filter "Gefiltert nach Auftrag", Spalte "Auftrag" mit Link `/orders/{id}`, Badge "Auftrag" statt Bearbeiten/Löschen bei `workOrderItemId` |
| `/calendar` | `src/lib/server/services/calendar-service.ts:199-228, 322-340` | Jeder Auftrag mit `scheduled_date` erscheint als `work_order`-Event (`id: wo-<uuid>`, `done: status==='done'`), Klick-Ziel `/orders/[id]` laut Docs; Termin mit verknüpftem Auftrag wird aus der Termin-Quelle ausgeblendet (`calendar-service.ts:124-127`) |
| `/settings` (Allgemein) | `src/routes/settings/+page.svelte:133-171, 426-460` / `settings.remote.ts:213-244` | Feld "Stundensatz (netto, EUR)" → `updateLaborRateRemote` schreibt neue `item_price_versions`-Zeile für den Arbeitszeit-Artikel; Quelle des Prefills im Positionsformular |

Redirects: keine modulinternen. Setup-Gate (`/setup`) und Login-Redirect greifen global (`hooks.server.ts`, nicht Teil dieses Moduls).

## 2. Remote Functions und Endpoints

Alle in `src/routes/orders/orders.remote.ts`, sofern nicht anders angegeben. Alle Guards sind die erste Anweisung im Body. Es gibt **keine** HTTP-Endpoints (`+server.ts`) für Aufträge; die öffentliche REST-API (`/api/public/*`) kennt laut CLAUDE.md `orders` als Ressource, das wurde hier nicht gelesen (außerhalb des Auftrags-Scopes; siehe offene Frage 12).

Gemeinsame Schemas (`orders.remote.ts:49-153`):

- `titleSchema`: `string('Bitte einen Titel eingeben.')`, `trim`, `minLength(1,'Der Titel darf nicht leer sein.')`, `maxLength(200,'Der Titel darf maximal 200 Zeichen lang sein.')`.
- `workOrderInputSchema` (create): `title` Pflicht; `description` optional `longTextSchema` (trim, ≤ 10 000, `'Der Text darf maximal 10.000 Zeichen lang sein.'`, `validation.ts:129-133`); `customerId`, `vehicleId` optional `idSchema` (string 1–64, trim, **ohne** deutsche Meldung, `validation.ts:28`); `scheduledDate` optional `dateStringSchema` (`'Bitte geben Sie ein gültiges Datum ein (YYYY-MM-DD).'`, `validation.ts:168-176`); `scheduledTime` optional `timeHHMMSchema` (`'Bitte eine Uhrzeit eingeben.'` / `'Bitte eine gültige Uhrzeit (HH:MM) angeben.'`, `validation.ts:262-269`); `assigneeIds` optional `array(idSchema)` `maxLength(50,'Es können maximal 50 Mitarbeiter zugewiesen werden.')`.
- `workOrderPatchSchema` (update): alle Felder optional, `description`/`customerId`/`vehicleId`/`scheduledDate`/`scheduledTime` zusätzlich `nullable` (explizites `null` löscht).
- `listSchema`: `page` number `minValue(1,'Seite muss mindestens 1 sein.')`, `maxValue(100000,'Seite ist zu groß.')`; `size` `picklist([10,25,50,100])`; `q` optional `searchQuerySchema` (≤ 200, `'Der Suchbegriff darf maximal 200 Zeichen lang sein.'`); `status` optional `picklist(['all','open','in_progress','done'],'Bitte einen gültigen Status wählen.')`; `employeeId` optional.
- `workOrderItemInputSchema`: `kind` `picklist(['labor','material'],'Bitte eine gültige Art wählen.')`; `itemId` optional nullable; `description` string `'Bitte eine Beschreibung eingeben.'`, trim, `minLength(1,'Die Beschreibung darf nicht leer sein.')`, `maxLength(500,'Die Beschreibung darf maximal 500 Zeichen lang sein.')`; `quantity` optional number `'Bitte eine Menge eingeben.'`, `minValue(0.001,'Die Menge muss größer als 0 sein.')`, `maxValue(1_000_000,'Die Menge ist zu groß.')`; `unit` optional string trim `maxLength(20,'Die Einheit darf maximal 20 Zeichen lang sein.')`; `unitPriceNet` `moneySchema` (number `'Bitte geben Sie einen Betrag ein.'`, −1e9…1e9, `validation.ts:187-191`, **negativ erlaubt**); `employeeId` optional nullable; `hours` optional nullable number `'Bitte die Stunden eingeben.'`, `minValue(0.01,'Die Stunden müssen größer als 0 sein.')`, `maxValue(999,'Die Stundenzahl ist zu groß.')`; `doneAt` `dateStringSchema` Pflicht.
- `kanbanFilterSchema`: `q` optional (trim, `maxLength(200,'Suchbegriff zu lang.')`), `employeeId` optional.

Fehlerübersetzung: `handleValidationError` (`src/hooks.server.ts:423`) zeigt nur das erste Issue und übersetzt den Feldschlüssel über `FIELD_LABELS` (`hooks.server.ts:264`). Vorhanden für dieses Modul: `title`, `description`, `customerId`, `vehicleId`, `employeeId`, `quantity`, `unit`, `unitPriceNet`, `issueDate`, `q`, `page`, `size`, `status`. **Nicht** vorhanden (Fallback = roher Schlüssel, `hooks.server.ts:403`): `scheduledDate`, `scheduledTime`, `assigneeIds`, `doneAt`, `hours`, `kind`, `itemId`, `workOrderId`, `paymentMethod`, `appointmentId` (grep verifiziert) → B-270.

- **`kanbanBoardRemote`** — query — `orders.remote.ts:170`
  - Guard: `requirePermission('orders')`
  - Argumente: `kanbanFilterSchema` (`q?`, `employeeId?`); Client übergibt nur gesetzte Schlüssel (`+page.svelte:42-45`)
  - Rückgabe: `{ open: Card[], in_progress: Card[], done: Card[] }`; `Card = KanbanCard & { invoiceId: string|null, invoiceNumber: string|null }`; `invoiceId/invoiceNumber` nur für `done` befüllt (Join `work_orders.invoice_id → documents`, `orders.remote.ts:176-189`), für `open`/`in_progress` immer `null`
  - Fehlerfälle: 401/403 via Guard
  - Nebenwirkungen: keine; zweiter DB-Roundtrip für Rechnungsnummern der done-Karten
  - Transaktion: nein
- **`listWorkOrdersRemote`** — query — `orders.remote.ts:216`
  - Guard: `requirePermission('orders')`
  - Argumente: `listSchema`; `status` default `'all'`
  - Rückgabe: `ListResult<WorkOrderListRow>` = `{ items, total, page, size, pageCount }`, Row = `WorkOrder & { customerLabel, vehiclePlate, assigneeNames: string[] }`
  - Fehlerfälle: 401/403
  - Nebenwirkungen: keine. **Wird von keiner Seite aufgerufen** (grep: nur Definition und `refreshBoardAndLists`) → B-266
  - Transaktion: nein
- **`getWorkOrderRemote`** — query — `orders.remote.ts:234`
  - Guard: `requirePermission('orders')`
  - Argumente: `{ id: idSchema }`
  - Rückgabe: `WorkOrderDetail` = `{ order: WorkOrder, items: WorkOrderItem[], assignees: {id,label}[], customerLabel, vehicleLabel, appointmentTitle, invoiceNumber, invoices: OrderInvoiceRef[] }`
  - Fehlerfälle: `404 'Auftrag nicht gefunden.'`
  - Transaktion: nein
- **`getLaborRateRemote`** — query (ohne Schema) — `orders.remote.ts:252`
  - Guard: `requirePermission('orders')`
  - Rückgabe: `LaborRate | null` = `{ itemId, articleNumber, unitPriceNet: string|null }`; `null` ohne verknüpften Arbeitszeit-Artikel
- **`getWorkOrderIdForAppointmentRemote`** — query — `orders.remote.ts:265`
  - Guard: `requirePermission('orders')`
  - Argumente: `{ appointmentId: idSchema }`
  - Rückgabe: `{ id } | null`
  - Verwendung: Calendar-Edit-Seite als Permission-Probe + Link-Ziel
- **`createWorkOrderRemote`** — command — `orders.remote.ts:322`
  - Guard: `requirePermission('orders')`; danach `requireCustomerOrVehicle` (`400 'Bitte mindestens einen Kunden oder ein Fahrzeug zuordnen.'`, `orders.remote.ts:303-310`)
  - Argumente: `workOrderInputSchema`
  - Rückgabe: `WorkOrder` (Insert-Row)
  - Fehlerfälle: 400 (Regel), 401/403; FK-Verletzungen (unbekannte `customerId`/`vehicleId`/`assigneeIds`) laufen als DB-Fehler in `handleError` (generische Meldung) → B-289
  - Nebenwirkungen: Nummernkreis `work_order` (`allocateNumber`), `refreshBoardAndLists()` = `requested(kanbanBoardRemote,4).refreshAll()` + `requested(listWorkOrdersRemote,4).refreshAll()` (`orders.remote.ts:292-297`)
  - Transaktion: nein (Service: Nummer → Insert → Assignees getrennt)
- **`createWorkOrderFromAppointmentRemote`** — command — `orders.remote.ts:349`
  - Guard: `requirePermission('orders')`
  - Argumente: `{ appointmentId }`
  - Rückgabe: `{ id }`
  - Fehlerfälle: `404 'Termin nicht gefunden.'` (auch wenn Eintrag kein `kind='appointment'` ist), `409 'Zu diesem Termin existiert bereits ein Auftrag.'`
  - Nebenwirkungen: Nummernkreis, Assignee aus `calendar_entries.employee_id`, `refreshBoardAndLists()`
  - Transaktion: nein
- **`updateWorkOrderRemote`** — command — `orders.remote.ts:368`
  - Guard: `requirePermission('orders')`; Schnellpfad `customerId===null && vehicleId===null` → 400; Service prüft effektiven Post-Patch-Zustand
  - Argumente: `{ id, values: workOrderPatchSchema }`
  - Rückgabe: `WorkOrder`
  - Fehlerfälle: 400 Regel, `404 'Auftrag nicht gefunden.'`
  - **Keine Sperre** für `done`/abgerechnete Aufträge (weder Remote noch Service) → B-271
  - Nebenwirkungen: `getWorkOrderRemote({id}).refresh()` + `refreshBoardAndLists()`; `scheduledDate===null` löscht `scheduledTime` mit (`work-order-service.ts:635`); `assigneeIds` ersetzt das ganze Set
  - Transaktion: nein
- **`deleteWorkOrderRemote`** — command — `orders.remote.ts:391`
  - Guard: `requirePermission('orders')`
  - Argumente: `{ id }`
  - Rückgabe: void; unbekannte Id = No-op
  - Fehlerfälle: `409 'Dieser Auftrag wurde bereits abgerechnet und kann nicht gelöscht werden. Die Rechnungshistorie (inklusive Stornos) bleibt erhalten.'` wenn `invoice_id` gesetzt ODER irgendein `documents.work_order_id = id` existiert (`work-order-service.ts:665-675`)
  - Nebenwirkungen: löscht `time_entries` mit `work_order_id` explizit, dann `work_orders` (Cascade auf items/assignees); `refreshBoardAndLists()`
  - Transaktion: nein
- **`moveWorkOrderStatusRemote`** — command — `orders.remote.ts:407`
  - Guard: `requirePermission('orders')`
  - Argumente: `{ id, status: picklist(['open','in_progress'],'Bitte einen gültigen Status wählen.') }` — `done` ist auf Schema-Ebene nicht wählbar
  - Rückgabe: `WorkOrder`
  - Fehlerfälle: 404; 409-Meldungen aus `setWorkOrderStatus` (siehe §3)
  - Nebenwirkungen: `getWorkOrderRemote({id}).refresh()` + `refreshBoardAndLists()`; bei Reopen `completed_at=null`, `invoice_id=null`
  - Transaktion: nein
- **`addWorkOrderItemRemote`** — command — `orders.remote.ts:435`
  - Guard: `requirePermission('orders')`
  - Argumente: `{ workOrderId, values: workOrderItemInputSchema }`
  - Rückgabe: `WorkOrderItem`
  - Fehlerfälle: 404 Auftrag; 409 Positionssperre (aktive Rechnung / done)
  - Nebenwirkungen: `time_entries` Write-Through; `getWorkOrderRemote({ id: workOrderId }).refresh()`; kein Board-Refresh
- **`updateWorkOrderItemRemote`** — command — `orders.remote.ts:451`
  - Guard: `requirePermission('orders')`
  - Argumente: `{ id, values: workOrderItemInputSchema }` — **volles** Schema (kind/description/unitPriceNet/doneAt Pflicht), obwohl JSDoc "partial patch" sagt und der Service `Partial<WorkOrderItemInput>` akzeptiert → B-276
  - Fehlerfälle: `404 'Auftragsposition nicht gefunden.'`, 404 Auftrag, 409 Sperre
  - Nebenwirkungen: Write-Through-Sync; Refresh der Detail-Query über `item.workOrderId`
- **`deleteWorkOrderItemRemote`** — command — `orders.remote.ts:468`
  - Guard: `requirePermission('orders')`
  - Argumente: `{ id, workOrderId }` (letzteres nur für den Refresh)
  - Fehlerfälle: 409 Sperre; unbekannte Id = No-op
  - Nebenwirkungen: löscht `time_entries` mit `work_order_item_id`, dann die Position; Detail-Refresh
- **`completeWorkOrderRemote`** — command — `orders.remote.ts:487`
  - Guard: `requirePermission('orders')`
  - Argumente: `{ id, issueDate: dateStringSchema, paymentMethod: paymentMethodSchema }` (`optional(picklist(PAYMENT_METHODS,'Bitte eine gültige Zahlungsart wählen.'))`, Werte `'Überweisung'|'Bar'|'Lastschrift'|'Karte'`, `payment-methods.ts:13-18`)
  - Rückgabe: `{ invoiceId, invoiceNumber }`
  - Fehlerfälle: 404; `409 'Für diesen Auftrag existiert bereits die gültige Rechnung {nr}. Stornieren Sie diese zuerst, um den Auftrag neu abzurechnen.'`; `409 'Dieser Auftrag ist bereits abgeschlossen.'`; `409 'Der Auftrag hat keine Positionen und kann nicht abgerechnet werden.'`
  - Nebenwirkungen: Nummernkreis `invoice`, `documents` + `document_items` Insert, PDF-Render/Persist (best-effort, `document-service.ts:308-316`), `work_orders` → `done`, `time_entries.document_id` Backfill, `getWorkOrderRemote({id}).refresh()` + `refreshBoardAndLists()`
  - Transaktion: nein → B-272

Genutzte Picker (`src/routes/pickers.remote.ts`):

- **`pickEmployeesRemote`** — query — `pickers.remote.ts:309` — Guard `requireAnyPermission('employees','orders')`; `archived=false`; Suche über `firstName`, `lastName`, `personnelNumber`, `position`, `privateEmail`, `privatePhone`, `mobile`; Label `"{firstName} {lastName} · {personnelNumber}"`; Sortierung `lastName asc`. Verwendet in Kanban-Filter, WorkOrderForm (Multi), Positionsformular, Detail-Roster (`size:100`).
- **`pickItemsRemote`** — query — `pickers.remote.ts:362` — Guard `requireAnyPermission('items','orders')`; `category` `'services'` (kind=service) | `'articles'` (article/material/pass_through) | `'all'`; **kein** `archived`-Filter; N+1 `getCurrentItemPrice` je Zeile (`pickers.remote.ts:400-413`); Rückgabe `{id,label:"{articleNumber} - {description}",articleNumber,description,kind,unit ?? 'Stk',unitPriceNet,stockOnHand}`.
- **`pickCustomersRemote`** — query — `pickers.remote.ts:100` — Guard `requirePermission('customers')` (nicht relaxiert!); `archived=false`; Label via `customerPickerLabel` = `"{name} · {city}"`.
- **`pickCustomerVehiclesRemote`** — query — `pickers.remote.ts:225` — Guard `requirePermission('vehicles')` (nicht relaxiert!); optionaler `customerId`-Filter; Label `"{plate|-} · {make model|-} · {holder}"` plus `customerId`, `customerLabel` je Treffer. Beide werden in `CustomerVehiclePicker.svelte:90-103` benutzt → ein Nutzer mit **nur** `orders` kann im Formular keine Kunden/Fahrzeuge wählen → B-290.

Fremd-Remotes, die Auftragsdaten liefern: `listCustomerWorkOrdersRemote` (`customers.remote.ts:194`, `{id, page}`, Größe fix 25, delegiert an `listWorkOrders({customerId})`), `listVehicleWorkOrdersRemote` (`vehicles.remote.ts:270`, eigene Query ohne Assignees/Kunde), `getInvoiceRemote`-Anreicherung `workOrder` (`invoices.remote.ts:165-175`).

## 3. Services (Server-Layer)

Datei `src/lib/server/services/work-order-service.ts` (1160 Zeilen). Keine Funktion verwendet `db.transaction`.

| Funktion | Signatur | Beschreibung / DB-Zugriffe | Fehler | Performance |
|---|---|---|---|---|
| `listOrderInvoices` | `(orderId) => Promise<OrderInvoiceRef[]>` (`:149`) | `documents` where `work_order_id=orderId AND type='invoice'`, `orderBy createdAt asc`; Felder id, documentNumber, status, issueDate, grossTotal, cancelledAt | – | Index `documents_work_order_id_idx` vorhanden |
| `getActiveInvoiceForOrder` | `(orderId) => Promise<OrderInvoiceRef\|null>` (`:167`) | wie oben zusätzlich `status NOT IN ('cancelled','storno')`, `limit 1`. Einzige Wahrheitsquelle für "aktive Rechnung" | – | ok |
| `listWorkOrders` | `(params: ListParams & {status?, customerId?, employeeId?}) => Promise<ListResult<WorkOrderListRow>>` (`:228`) | bei `q`: Vor-Query `vehicle_license_plate_versions ILIKE` → `vehicleId`-Liste (`:242-246`); Suche `order_number`, `title`, `customers.company`, `customers.lastName` OR `vehicle_id IN (...)`; Filter status (≠'all'), customerId, employeeId (Subquery `work_order_assignees`); Hauptquery `work_orders ⟕ customers ⟕ vehicles ⟕ latestPlateSubquery`, `orderBy createdAt desc`, limit/offset; Count-Query `work_orders ⟕ customers`; danach `fetchAssignees` (eine IN-Query) | – | Kennzeichen-Treffer werden als unbounded `inArray` eingebettet; keine Trigram-Indizes (ILIKE `%term%`) |
| `listKanbanBoard` | `(params?: {q?, employeeId?}) => Promise<KanbanBoard>` (`:334`) | Filter `q` über `order_number`, `title`, `customers.lastName`, `customers.company` (**kein** Kennzeichen); `employeeId` Subquery; zwei Queries parallel: aktive (`status IN ('open','in_progress')`, `createdAt desc`, **kein Limit**) und done (`completedAt desc`, `limit 25` = `DONE_COLUMN_LIMIT`, `:185`); `fetchAssignees` für alle | – | open/in_progress unbegrenzt → B-267 |
| `getWorkOrder` | `(id) => Promise<WorkOrderDetail\|null>` (`:415`) | Kopfquery `work_orders ⟕ customers ⟕ vehicles ⟕ lp ⟕ calendar_entries ⟕ documents(invoice_id)`; dann parallel `work_order_items` (`position asc`), `fetchAssignees([id])`, `listOrderInvoices(id)`; `vehicleLabel = "{plate} · {make model}"` | – | 4 Queries |
| `createWorkOrder` | `(input: CreateWorkOrderInput) => Promise<WorkOrder>` (`:519`) | `requireCustomerOrVehicle`; `allocateNumber('work_order')`; Insert; `scheduledTime` nur mit Datum; `replaceAssignees` (delete+insert, dedupliziert) | `400 'Bitte mindestens einen Kunden oder ein Fahrzeug zuordnen.'` | Nummer wird vor Insert verbraucht (Lücke bei Fehler) |
| `createWorkOrderFromAppointment` | `(appointmentId) => Promise<WorkOrder>` (`:574`) | lädt `calendar_entries` mit `kind='appointment'`; Duplikat-Check `work_orders.appointment_id`; `scheduleFromAppointment` (`:552-565`: allDay → UTC-Datum ohne Zeit; sonst **server-lokale** `getFullYear/getHours`-Getter); Insert ohne Kunde/Fahrzeug-Regel (bewusst, `:503-508`); Assignee = `employeeId` des Termins | `404 'Termin nicht gefunden.'`, `409 'Zu diesem Termin existiert bereits ein Auftrag.'` | Unique-Partial-Index `work_orders_appointment_id_idx` als DB-Backstop (in pg-mem nicht aktiv) |
| `updateWorkOrder` | `(id, patch: Partial<CreateWorkOrderInput>) => Promise<WorkOrder>` (`:622`) | `requireOrder` (404); Regelprüfung gegen effektiven Zustand; `scheduledDate===null ⇒ scheduledTime=null`; Update `updatedAt`; optional `replaceAssignees` | 404, 400 | keine Status-/Rechnungssperre |
| `deleteWorkOrder` | `(id) => Promise<void>` (`:658`) | Select id/invoiceId; Select `documents.work_order_id=id limit 1`; 409 wenn eins davon; `delete time_entries where work_order_id`; `delete work_orders` | 409 (Text s. §2) | – |
| `setWorkOrderStatus` | `(id, status: WorkOrderStatus) => Promise<WorkOrder>` (`:699`) | Select; `status==='done'` → 409; gleicher Status → Row zurück (No-op); von `done` nur nach `in_progress`, sonst 409; von `done` mit aktiver Rechnung → 409; Update setzt bei Reopen `completedAt=null`, `invoiceId=null` | `409 'Abschließen ist nur über "Abschließen & Rechnung erstellen" möglich — ohne gültige Rechnung kann ein Auftrag nicht abgeschlossen werden.'`; `409 'Ein abgeschlossener Auftrag kann nur nach "in Bearbeitung" zurückgeholt werden.'`; `409 'Dieser Auftrag wurde bereits abgerechnet und kann nicht wieder geöffnet werden. Stornieren Sie zuerst die Rechnung.'`; `404 'Auftrag nicht gefunden.'` | – |
| `addWorkOrderItem` | `(workOrderId, input: WorkOrderItemInput) => Promise<WorkOrderItem>` (`:847`) | `requireOrder`; `requireItemsUnlocked`; `position = max+1` (Select `orderBy position desc limit 1`); `hours` nur bei labor; `quantity = labor ? hours : (quantity ?? 1)`; `unit = input.unit ?? (labor ? 'Std.' : null)`; Insert; `syncTimeEntryForItem` | 404; `409 'Positionen sind gesperrt, solange eine gültige Rechnung existiert ({nr}). Stornieren Sie die Rechnung, um Änderungen vorzunehmen.'`; `409 'Dieser Auftrag ist abgeschlossen — Positionen können erst nach dem Wiederöffnen geändert werden.'` | Position-Race bei parallelen Adds möglich (kein Unique auf `(work_order_id, position)`) |
| `updateWorkOrderItem` | `(itemId, patch: Partial<WorkOrderItemInput>) => Promise<WorkOrderItem>` (`:890`) | Select Position (404); `requireOrder`; Sperre; Feld-Patch; `kind==='material' ⇒ hours=null`; labor mit hours und ohne explizite quantity ⇒ `quantity=hours`; Update; Sync | `404 'Auftragsposition nicht gefunden.'`, 409 | – |
| `deleteWorkOrderItem` | `(itemId) => Promise<void>` (`:945`) | Select (No-op bei unbekannt); Sperre; `delete time_entries where work_order_item_id`; `delete work_order_items` | 409 | – |
| `syncTimeEntryForItem` (intern) | `(order: {id, customerId}, item) => Promise<void>` (`:769`) | billable = `labor && employeeId && hours>0`; Select vorhandenen Eintrag über `work_order_item_id`; nicht billable → delete; sonst Upsert mit `employeeId`, `date=doneAt`, `hours`, `customerId=order.customerId`, `task=description.slice(0,200)`, `workOrderId`, `workOrderItemId` | – | Unique-Partial-Index `time_entries_work_order_item_id_idx` |
| `requireItemsUnlocked` (intern) | (`:831`) | aktiv-Rechnung → 409; `status==='done'` → 409 | s. o. | – |
| `getLaborRate` | `() => Promise<LaborRate\|null>` (`:974`) | `getSettings().laborItemId`; `items` Select; `getCurrentItemPrice` | – | 3 Queries |
| `completeWorkOrder` | `(id, {issueDate, paymentMethod?}) => Promise<Document>` (`:1015`) | `requireOrder`; aktive Rechnung → 409; `done` → 409; Positionen (`position asc`), leer → 409; `getSettings()` (`defaultVatRate`, `defaultPaymentTermDays`, `laborItemId`); Katalogzeilen für `itemId`s; Mitarbeiternamen für labor-Zeilen; Mapping (§7/F-344); `createDocument({type:'invoice', customerId?, vehicleId?, workOrderId:id, issueDate, serviceDate: todayIso() (UTC), dueDate: issueDate+defaultPaymentTermDays, paymentMethod, items})`; Update `work_orders` (`status='done'`, `completedAt`, `invoiceId`); Update `time_entries.document_id` für `work_order_id=id` | 404, 409 ×3 | 6+ Roundtrips, nicht atomar |

Angrenzende Services (nur auftragsrelevante Teile gelesen):

- `document-service.ts`: `createDocument` (`:236-318`) — Nummer via `numberKindFor('invoice')`, Zeilen mit `round2` je Zeile (`qty*unit`, Rabatt %, Steuer), Kopfsummen, `taxRate = items[0].taxRate ?? 19`, `workOrderId` durchgereicht (`:284`), PDF-Render best-effort mit `console.error`. `deleteDocument` (`:336-377`) — Rechnungen mit `work_order_id` sind unlöschbar: `409 'Diese Rechnung gehört zu einem Auftrag und ist Teil der Belegkette. Bitte stornieren Sie sie stattdessen.'`. `cancelInvoice` (`:419-584`) — Storno-Dokument erbt `workOrderId` (`:485`); wenn `original.workOrderId` gesetzt: `work_orders` → `status='in_progress'`, `completedAt=null`, `invoiceId=null` **nur wenn** `work_orders.invoice_id = originalId` (`:552-556`); `time_entries.document_id=null` für `work_order_id AND document_id=originalId`. Ausdrücklich ohne `db.transaction` (`:494-499`).
- `time-entry-service.ts`: `OrderDerivedTimeEntryError` (`:35`), `assertNotOrderDerived` (`:270`) in `updateTimeEntry`/`deleteTimeEntry`; `listTimeEntries` mit Filter `workOrderId` (`:111`) und Join `work_orders` für `workOrderNumber` (`:136,142`); `hours.remote.ts:45-53` mappt auf `409 'Dieser Eintrag stammt aus einem Auftrag und wird dort gepflegt.'`. Manuelle Einträge können **keinen** `workOrderId` setzen (`timeEntryInputSchema`, `hours.remote.ts:117-125`).
- `calendar-service.ts:113-340`: Quelle `work_orders` mit `scheduled_date` im Bereich, Mitarbeiterfilter über Assignees, `startsAt = new Date('{date}T{time}:00')` (lokal-naiv), `done`-Flag; Termine mit Auftrag aus der Termin-Quelle ausgeschlossen.
- `seed-defaults.ts:249-281` `seedLaborItem`: Artikel `ARBEIT`/"Arbeitszeit"/`kind='service'`/`unit='Std.'` mit Preisversion `'0'`, Link in `company_settings.labor_item_id` nur wenn NULL.
- `number-range-service.ts:57`: Default-Template `work_order: 'AU-{YYYY}-{NNNN}'`.

## 4. Komponenten (modul-lokal)

| Komponente | Datei | Zweck | Props (Name: Typ, default) | Events/Callbacks | Snippets/Slots | Interner State | Verwendete Shared-Komponenten |
|---|---|---|---|---|---|---|---|
| `WorkOrderForm` | `src/routes/orders/WorkOrderForm.svelte` | Gemeinsamer Editor für `/orders/new` und `/orders/[id]/edit` | `initial?: { title?, description?, customerId?, customerLabel?, vehicleId?, vehicleLabel?, scheduledDate?, scheduledTime?, assignees?: {id,label}[] }` (default `{}`), `onSave: (values: WorkOrderFormValues) => Promise<void>\|void`, `onCancel?: () => void` (`:79-96`) | `onSave` mit `{ title (trim), description?: string, customerId?, vehicleId?, scheduledDate?, scheduledTime? (nur mit Datum), assigneeIds: string[] }` (`:364-373`); `onCancel` | keine | `title`, `titleTouched`, `description`, `customerId/Label`, `vehicleId/Label`, `scheduledDate`, `scheduledTime`, `assigneeIds`, `assigneeLabels` (Map oder Entry-Array), `errorMsg`, `lastComposed`; Draft-Restore aus `creationFlow.pendingReturnFor` (`:132-213`); `useFormValidation(workOrderSchema)` mit Root-`check` → `_form` (`:21-33, 311-315`); `formDirty` markiert bei `oninput/onchange`, geleert im `$effect`-Cleanup (`:322-323`) | `FormField`, `CustomerVehiclePicker`, `MultiSearchablePicker`, `busy`, `formDirty`, `creationFlow`, `validationClasses` |
| `DetailHost` | `src/routes/orders/[id]/DetailHost.svelte` | Test-Host mit `<svelte:boundary>` + `pending`-Snippet `data-testid="page-pending"` | – | – | `pending` | – | – |

Shared-Komponenten mit Auftragsverwendung:

| Komponente | Datei | Verwendung im Modul | Props / Verhalten (Auszug) |
|---|---|---|---|
| `MultiSearchablePicker` | `src/lib/components/ui/MultiSearchablePicker.svelte` | Zugewiesene Mitarbeiter im Formular | `values` (bindable `string[]`), `valueLabels` (bindable Map oder Entry-Array, schreibt Map zurück), `placeholder`, `dialogTitle`, `emptyText='Keine passenden Einträge gefunden.'`, `search`, `onChange`, `disabled`, `triggerSize`, `createLabel`, `onCreateNew` (`:13-40`). Dialog transaktional: Arbeitskopie `selection`, "Übernehmen (N)" schreibt zurück, "Abbrechen"/Backdrop/Schließen verwerfen (`:102-134`). Trigger-Text: Placeholder / bis 2 Labels kommagetrennt / "N ausgewählt" (`:80-86`). Suche 250 ms debounce, Seite 25, `Pagination`, Loader; Clear-X (`aria-label="Auswahl entfernen"`) leert ohne Dialog |
| `CustomerVehiclePicker` | `src/lib/components/ui/CustomerVehiclePicker.svelte` | Kunde/Fahrzeug im Formular | Bindable `customerId/customerLabel/vehicleId/vehicleLabel`; Fahrzeugwahl übernimmt Halter (`:136-152`); Kundenwechsel löscht Fahrzeug (`:125-129`); Kunde entfernen löscht Fahrzeug (`:111-124`); Fahrzeug-Dialogtitel "Fahrzeug des Kunden wählen" / "Fahrzeug wählen (Kunde wird übernommen)"; Placeholder "Fahrzeug dieses Kunden suchen" / "Fahrzeug oder Halter suchen"; "Neues Fahrzeug anlegen" nur mit gewähltem Kunden (`:155, 203-204`); `customerError` unter dem Kundenfeld |
| `SearchablePicker` | `src/lib/components/ui/SearchablePicker.svelte:6-37` | Kanban-Mitarbeiterfilter, Katalog-Picker und Mitarbeiter-Picker im Positionsformular | `value` (bindable), `valueLabel`, `placeholder`, `dialogTitle`, `emptyText`, `search`, `onSelect(item\|null)`, `disabled`, `triggerSize`, `createLabel`, `onCreateNew`; Seite 25 |
| `ConfirmDialog` | `src/lib/components/ui/ConfirmDialog.svelte` (nicht gelesen) | "Auftrag löschen?", "Position löschen?" (`[id]/+page.svelte:1029-1047`) | `open` (bindable), `title`, `message`, `confirmLabel`, `variant='danger'`, `onConfirm`, `onClose` |
| `PageHeader`, `Pagination`, `FormField`, `Loader` | `src/lib/components/...` | Header/Actions, Picker-Pagination, Feldrahmen | – |
| `QuickTimeEntryModal` | `src/lib/components/ui/QuickTimeEntryModal.svelte` | **Nicht im Auftragsmodul verwendet** (grep: nur `offers/[id]` und `invoices/[id]`, `QuickTimeEntryModal.svelte:12-22` beschreibt Verwendung auf Beleg-Detailseiten mit `documentId`) | Props `open` (bindable), `documentId`, `onClose`; Felder Datum/Stunden(0.25–24)/Was wurde gemacht; Mitarbeiter über `currentEmployeeRemote()` → B-277 |

Eigene Dialoge in `[id]/+page.svelte`: Abschluss-Dialog als nativer `<dialog class="modal modal-open">` mit `showModal()`, Esc = Abbrechen (`:953-1027`).

## 5. Tabellen

| Tabelle | Relevante Spalten / Regeln | Fundstelle |
|---|---|---|
| `work_orders` | `id` uuid PK; `order_number` varchar(50) NOT NULL UNIQUE (Nummernkreis `work_order`, `AU-{YYYY}-{NNNN}`); `title` varchar(200) NOT NULL; `description` text; `status` varchar(20) NOT NULL default `'open'` — Werte `open \| in_progress \| done` (`WorkOrderStatus`, `schema.ts:2003`, **kein** DB-Enum/Check); `customer_id` FK customers SET NULL; `vehicle_id` FK vehicles SET NULL; `appointment_id` FK calendar_entries SET NULL, Unique-Partial-Index WHERE NOT NULL; `invoice_id` FK documents SET NULL (Pointer auf die AKTIVE Rechnung); `scheduled_date` date; `scheduled_time` varchar(5) `HH:MM`; `completed_at` timestamptz; `created_at`/`updated_at`. Indizes: status, customer_id, appointment_id (unique partial), invoice_id | `schema.ts:1199-1246`, `drizzle/0033_work_orders.sql:18-33,143-164`, `0034_scheduling_docs_owner.sql:12-35` (Split von `scheduled_at` in Europe/Berlin) |
| `work_order_assignees` | `work_order_id` FK CASCADE, `employee_id` FK employees CASCADE, zusammengesetzter PK | `schema.ts:1249-1260` |
| `work_order_items` | `id`; `work_order_id` FK CASCADE NOT NULL; `position` int NOT NULL; `kind` varchar(20) NOT NULL default `'labor'` (`labor \| material`, `WorkOrderItemKind`, `schema.ts:2005`); `item_id` FK items SET NULL; `description` text NOT NULL; `quantity` numeric(12,3) NOT NULL default 1 (labor spiegelt hours); `unit` varchar(20); `unit_price_net` numeric(12,2) NOT NULL (Preis-Snapshot); `employee_id` FK employees SET NULL; `hours` numeric(6,2) (nur labor); `done_at` date NOT NULL; Timestamps. Index `work_order_id`. **Keine** Spalten für MwSt/Rabatt | `schema.ts:1270-1309` |
| `time_entries` | `work_order_id` FK work_orders SET NULL (+Index), `work_order_item_id` FK work_order_items CASCADE (+Unique-Partial-Index), `document_id` (Backfill bei Abschluss), `task` ≤ 200, `customer_id` | `schema.ts:1153-1181`, `0033:171-205` |
| `documents` | `work_order_id` FK work_orders SET NULL (+Index) — permanente Historien-Rückverknüpfung; `status` `created/sent/paid/cancelled/storno/...`; `cancels_document_id`, `cancelled_at` | `schema.ts:620-647`, `drizzle/0037_document_work_order_link.sql` (Backfill 2-pass) |
| `company_settings` | `labor_item_id` FK items SET NULL; `default_vat_rate`; `default_payment_term_days` | `schema.ts:52,58,114`, `0033:208-218` |
| `number_ranges` | `kind='work_order'`, Template `AU-{YYYY}-{NNNN}` (per SQL geseedet, `0033:223-225`; Default-Template im Service `number-range-service.ts:57`) | – |
| `role_permissions` | Migration 0033 grant `orders` an `Werkstattleiter` und `Mitarbeiter` (`0033:232-235`); `MODULE_PERMISSIONS.orders = ['orders']` (`permissions.ts:36`) | – |
| Lesend | `customers` (Label), `vehicles` + `vehicle_license_plate_versions` (Kennzeichen via `latestPlateSubquery`), `employees` (Namen), `items` + `item_price_versions` (Katalog/Stundensatz), `calendar_entries` (Termin-Titel) | – |

## 6. Flows (durchgängig, Start bis Ende)

- **Auftrag anlegen (direkt)** — Sidebar "Aufträge" → Kanban → `PageHeader` "Neuer Auftrag" (`/orders/new`) → Formular ausfüllen → "Speichern" → `createWorkOrderRemote` → Toast `'Auftrag angelegt.'` → `/orders/{id}` (replaceState).
  - Leerzustand: leeres Formular; Titel-Placeholder "Wird aus Kunde und Fahrzeug vorgeschlagen"; Hinweis "Mindestens ein Kunde oder ein Fahrzeug wird benötigt."
  - Ladezustand: keine Query; `busy.run` beim Speichern (Spinner im Button, Button disabled).
  - Validierungsfehler (Klick-Zeit, `WorkOrderForm.svelte:349-359`): alle Felder touched; Summary-Alert mit `_form`-Fehler `'Bitte mindestens einen Kunden oder ein Fahrzeug zuordnen.'` oder erster Feldfehler (`'Der Titel darf nicht leer sein.'`, `'Der Titel darf maximal 200 Zeichen lang sein.'`), Fallback `'Bitte prüfen Sie Ihre Eingaben.'`; Titel-Feld rot; Link-Fehler unter dem Kundenfeld nur wenn beide Picker touched (`:430-432`).
  - Fehlerzustand: `handleClientError(err,'Auftrag konnte nicht angelegt werden')` (Toast); Formular bleibt dirty.
  - Abbruchpfade: "Abbrechen" → `goto('/orders')` (Dirty-Guard greift, da `formDirty` gesetzt); Browser-Navigation mit Unsaved-Changes-Dialog.
  - Berechtigungs-Verweigerung: ohne `orders` fehlt der Sidebar-Eintrag; direkter Aufruf → Remote 403 → Toast. Ohne `customers`/`vehicles` bleiben die Picker leer/403 (B-290).
  - Bestätigungsdialoge: keine.
- **Auftrag aus Termin anlegen** — `/calendar/[id]/edit` (Termin) → "Auftrag erstellen" → `createWorkOrderFromAppointmentRemote` → `formDirty.clear()` → Toast `'Auftrag angelegt.'` → `/orders/{id}`. Übernommen: Titel, Kunde, Fahrzeug, Mitarbeiter→Zuweisung, `appointment_id`, Datum/Uhrzeit aus `startsAt`. Existiert bereits ein Auftrag: Link "Zum Auftrag". Fehler: `'Auftrag konnte nicht angelegt werden'` + 409-Text. Keine Kunde-ODER-Fahrzeug-Prüfung (bewusst). Kein Bestätigungsdialog.
- **Auftrag bearbeiten** — Detail → "Bearbeiten" (nur wenn nicht `done`) → `/orders/[id]/edit` (Formular mit `initial` aus Detail; Titel gilt als "touched", Auto-Titel aus) → "Speichern" → `updateWorkOrderRemote` (alle Felder gesendet, leere als `null`) → Toast `'Auftrag gespeichert.'` → `/orders/{id}`. Abbrechen → `/orders/{id}`. Fehler `'Auftrag konnte nicht gespeichert werden'`.
- **Kanban-Status verschieben** — `/orders` → Pfeil-Button auf Karte ("In Bearbeitung verschieben" / "Zurück zu Offen" / "Wieder öffnen (in Bearbeitung)" nur auf done-Karten ohne `invoiceId`) **oder** Drag&Drop (nur Karten mit `status !== 'done'` sind `draggable`) → `moveWorkOrderStatusRemote(...).updates(kanbanBoardRemote(boardArgs).withOverride(...))` — Karte springt sofort an den Spaltenanfang (`+page.svelte:92-111`). Drop auf "Abgeschlossen": `toast.info('Abschließen ist nur über die Auftragsseite möglich ("Abschließen & Rechnung erstellen") — ohne gültige Rechnung kann ein Auftrag nicht abgeschlossen werden.')`, Karte bleibt (`:144-154`). Fehler: `'Status konnte nicht geändert werden'` + Servertext; Override wird zurückgerollt. Kein Bestätigungsdialog. Tastatur: Enter/Space öffnet Karte; DnD nicht tastaturbedienbar (Buttons als Ersatz).
- **Position erfassen / bearbeiten** — Detail → Karte "Positionen" → Formular "Neue Position erfassen" (nur sichtbar wenn `!positionsLocked`) → Art wählen (Radio "Arbeitszeit" default / "Material") → optional Katalog-Picker ("Leistung aus Katalog (optional)" bzw. "Artikel aus Katalog (optional)", Dialog "Leistung auswählen"/"Artikel auswählen", Placeholder "Katalog durchsuchen oder Freitext nutzen"; Auswahl setzt Beschreibung, Preis, bei Material Einheit) → Beschreibung* → Mitarbeiter (Picker) → Stunden* (labor, `min=0.25 step=0.25`) bzw. Menge* (material, `min=0.001 step=any`) → Stundensatz (netto)* (Prefill aus `getLaborRate`, Hinweis `'Kein Stundensatz hinterlegt. Stundensatz in den Einstellungen pflegen.'` bei 0/null) bzw. Einzelpreis (netto)* → Einheit (material, default `Stk`) → Erledigt am* (default heute, lokal) → "Position hinzufügen" / "Position speichern" → Toast `'Position hinzugefügt.'` / `'Position gespeichert.'`, Formular-Reset (`resetItemForm`, `:160-174`).
  - Validierung (Klick-Zeit, Alert im Formular, `:244-271`): `'Bitte eine Beschreibung eingeben.'`, `'Bitte einen gültigen Preis eingeben.'` (nur `isFinite`; negativ erlaubt), `'Bitte eine positive Stundenzahl eingeben.'`, `'Bitte eine positive Menge eingeben.'`. "Erledigt am" wird clientseitig nicht geprüft (leer → Server `dateStringSchema` mit rohem Key `doneAt`, B-270/29).
  - Bearbeiten: Pencil (`aria-label="Position bearbeiten"`) lädt Werte ins Formular (Mitarbeiter-Label aus Roster `size:100`, sonst leer), Überschrift "Position bearbeiten", Button "Abbrechen" setzt zurück.
  - Fehler: `'Position konnte nicht gespeichert werden'` + 409-Sperrtext.
- **Position löschen** — Trash (`aria-label="Position löschen"`) → `ConfirmDialog` Titel `Position löschen?`, Text `Die Position wird entfernt. Eine daraus erfasste Arbeitszeit wird ebenfalls gelöscht.`, Button "Löschen" (danger) → optimistisch entfernt (`withOverride` filtert Items) → Toast `'Position gelöscht.'`; bei laufender Bearbeitung derselben Position Reset. Fehler `'Position konnte nicht gelöscht werden'`.
- **Abschließen & Rechnung erstellen** — Detail → Karte "Abschluss" (nur wenn `!isDone && !hasInvoice`; Text "Erstellt aus allen erfassten Positionen automatisch die Rechnung und schließt den Auftrag ab."; Hinweis `Mindestens eine Position erforderlich.` bei 0 Positionen) → Button "Abschließen & Rechnung erstellen" (immer klickbar) → bei 0 Positionen `toast.error('Bitte mindestens eine Position erfassen, bevor der Auftrag abgerechnet wird.')` → sonst Dialog `Auftrag abschließen?` mit Text `Aus der einen Position` / `Aus den {n} Positionen` `wird die Rechnung erstellt. Der Auftrag wird danach schreibgeschützt.`, Felder "Rechnungsdatum *" (default heute lokal) und "Zahlungsart" (`<select>` mit "-" + `PAYMENT_METHODS`) → "Abschließen & Rechnung erstellen" → clientseitig `'Bitte ein Rechnungsdatum angeben.'` bei leer → `completeWorkOrderRemote` → Dialog schließen → Toast `` `Rechnung ${nr} erstellt.` `` → `goto('/invoices/{invoiceId}')`. Esc/Backdrop/"Abbrechen" = Abbruch. Fehler `'Auftrag konnte nicht abgeschlossen werden'` + 409-Text.
- **Storno → Wiedereröffnung → Neuabrechnung** — `/invoices/[id]` → "Stornieren" (Grund Pflicht, `'Bitte einen Stornogrund angeben.'`) → `cancelInvoice` setzt Auftrag auf `in_progress`, löscht `completed_at`/`invoice_id`, entbilligt `time_entries` → Detail zeigt Badge "In Bearbeitung", Positionsformular und Abschluss-Karte wieder sichtbar, Karte "Rechnungen" listet Original (Storniert), Storno (Stornorechnung) und später die neue Rechnung (Angelegt). Neuer Abschluss → neue Rechnungsnummer (E2E `e2e/orders-invoices.spec.ts:44-217`).
- **Wieder öffnen (Detail)** — nur Button "Wieder öffnen" wenn `isDone && !hasInvoice` (Legacy-Fall) → `moveWorkOrderStatusRemote('in_progress')` optimistisch → Badge wechselt. Kein Dialog.
- **Auftrag löschen** — Detail → Button "Löschen" (nur wenn `!hasInvoice`) → `ConfirmDialog` Titel `Auftrag löschen?`, Text `` `Der Auftrag ${orderNumber} wird unwiderruflich gelöscht. Erfasste Arbeitszeiten dieses Auftrags werden ebenfalls entfernt.` ``, "Löschen" (danger) → `deleteWorkOrderRemote` → Toast `'Auftrag gelöscht.'` → `/orders` (replaceState). Fehler `'Auftrag konnte nicht gelöscht werden'` + 409-Text (Rechnungshistorie).
- **Creation-Flow aus dem Formular** — Picker-Dialog-Header "Neuen Kunden anlegen" / "Neues Fahrzeug anlegen" (nur mit Kunde) / "Neuen Mitarbeiter anlegen" → `creationFlow.start({entity, returnUrl, originField, draft, createdAt, leafInitial?})`, `formDirty.clear()`, `goto('/customers/new'|'/vehicles/new'|'/employees/new')` → Leaf `finish`/`cancel` → Rückkehr: Draft wiederhergestellt (inkl. `titleTouched`, Assignee-Labels), erzeugter Datensatz vorausgewählt; erzeugtes Fahrzeug synchronisiert den Halter als Kunden (`WorkOrderForm.svelte:183-203`); Formular wird als dirty markiert (`:230`). Cycle-Guard: kein "Neu anlegen" für eine Entität, die bereits in der aktiven Kette angelegt wird (`:255-263`).
- **Zeiterfassung am Auftrag** — ausschließlich über Arbeitszeit-Positionen (Mitarbeiter + Stunden) → automatischer `time_entries`-Eintrag; in `/hours` (Liste/Detail/Edit) schreibgeschützt mit Badge "Auftrag" und Hinweis `'Dieser Eintrag stammt aus einem Auftrag und wird dort gepflegt.'` (`hours/[id]/+page.svelte:55`). Kein `QuickTimeEntryModal`, keine Soll-/Ist-Anzeige am Auftrag (B-277).

## 7. Nebenwirkungen

- **Nummernkreise**: `work_order` (`AU-{YYYY}-{NNNN}`) bei jeder Auftragsanlage (`work-order-service.ts:523, 600`); `invoice` beim Abschluss (`createDocument` → `nextDocumentNumber('invoice')`); `storno` beim Stornieren (Fremdmodul).
- **PDF**: Beim Abschluss wird die Rechnungs-PDF sofort gerendert und persistiert (`document-service.ts:308-316`, best-effort, Fehler nur `console.error`). **Es gibt keine PDF für den Werkstattauftrag selbst**; `pdf-service.ts` kennt `work_orders` nicht (grep leer). "Auftragsbestätigung" = Beleg-Typ `order_confirmation` des Angebotsmoduls (`offers/new/+page.svelte:244`, Titel `'Auftragsbestätigung'` `pdf-service.ts:257-258`, Intro `'Wir bestätigen Ihnen Ihren Auftrag wie folgt:'` `:468-469`, Mailvorlage `order_confirmation` mit Betreff `'Auftragsbestätigung {angebotNummer}'` `seed-defaults.ts:67-71`) — ohne Verknüpfung zu `work_orders` → B-278.
- **E-Mails**: keine aus dem Auftragsmodul.
- **Zeiterfassung**: Write-Through `time_entries` (Insert/Update/Delete) bei Positionsänderungen; `document_id`-Backfill beim Abschluss; Entbilligung bei Storno; Löschung bei Auftragslöschung.
- **Kalender**: jede Änderung an `scheduled_date`/`status` wirkt auf `work_order`-Events (abgeleitet, keine Schreiboperation).
- **Uploads/Exporte/externe APIs/Webhooks**: keine.
- **Cache-Refresh**: `requested(kanbanBoardRemote,4)`, `requested(listWorkOrdersRemote,4)`, `getWorkOrderRemote({id}).refresh()`; Client deklariert Kanban-Override und Detail-Updates via `.updates(...)`.

## 8. Vorhandene Tests

| Testdatei | Art | Was wird abgedeckt (1 Zeile) |
|---|---|---|
| `src/lib/server/services/work-order-service.test.ts` (1261 Z.) | integration (pg-mem) | Nummernkreis, Links/Assignees, Scheduling-Split, Kunde-ODER-Fahrzeug, Termin-Ableitung (timed/allDay/404/409), Update/Assignee-Replace, Statusfluss inkl. done-Sperren, Write-Through (create/update/remove/delete/material), Positionsnummerierung, Stundensatz, Abschluss-Mapping (Std., Backlinks, Employee-Snapshot, Summen 240/285,60), Delete-Guard, Liste+Filter, Board-Limit 25, Regelwerk Fälle 1–11 + Traceability |
| `src/routes/orders/orders.remote.test.ts` (589 Z.) | integration | Guards 401/403, Board-Shape nach Create, 404-Text, Stundensatz null, 400 Regel (create/update), Listen-Statusfilter, Moves, Schema-Ablehnung `done`, Termin-Integration, Items+Abschluss (Rechnungsnummer, done-Karte mit Rechnungslink), leere Beschreibung, 409 ohne Positionen, Sperre/Storno/Neuabrechnung/Historie |
| `src/routes/orders/WorkOrderForm.test.ts` (371 Z.) | component | Pristine, Button nie disabled, Link-Regel-Fehler, Titel-Pflicht, Fahrzeug-only, Auto-Titel (compose/stop/resume/keeps typed/edit-mode), Zeitfeld bis Datum disabled, Assignee-Roundtrip, Creation-Flow (leafInitial, Halter-Resync, gleicher Halter) |
| `src/routes/orders/[id]/page.test.ts` (214 Z.) | component | Sperrhinweis + versteckte Aktionen bei aktiver Rechnung, Historienkarte mit Storniert/Stornorechnung, Freigabe nach Storno |
| `src/lib/components/ui/MultiSearchablePicker.test.ts` (378 Z.) | component | Placeholder, Labels/"N ausgewählt", Entry-Array, Dialog/Suche/Checkboxen, Übernehmen, Selektion über Seiten, Abbrechen/Backdrop, Clear (Maus/Tastatur), disabled, Debounce, Leer/Loader, Create-Button |
| `src/lib/components/ui/QuickTimeEntryModal.test.ts` (161 Z.) | component | Felder, geschlossen, Button nie disabled, Task-Fehler, Submit mit Employee+documentId, kein Profil, Abbrechen (nicht auftragsbezogen) |
| `e2e/orders-invoices.spec.ts` (325 Z.) | e2e (Playwright, Prod-Build + Fixture-DB) | Regelfehler im Formular, Anlage, Arbeitszeit- und Materialposition, Abschluss-Dialog, Rechnungs-Backlink, Sperre, Storno (Grund Pflicht), Wiedereröffnung, Korrektur 2→3 h, Neuabrechnung, Historie 3 Zeilen; Kanban Drop-auf-Abgeschlossen abgelehnt + Pfeil-Move; Teileverkauf ohne Auftragskarte |
| `src/lib/server/services/time-entry-service.test.ts:282-370` | integration | Auftrags-abgeleitete Einträge: Listenfelder, Filter `workOrderId`, Update/Delete typed error |
| `src/routes/hours/hours.remote.test.ts:483-530` | integration | `workOrderId` in get/list, 409 bei Update/Delete auftragsabgeleiteter Zeilen |
| `src/lib/server/services/calendar-service.test.ts:406-560` | integration | `work_order`-Quelle: timed/timeless, done-Flag, Termin-Ausblendung, Mitarbeiterfilter |
| `src/lib/server/db/seed-defaults.test.ts:54-140` | integration | Nummernkreis AU, Arbeitszeit-Artikel + Link, kein Relink, `orders`-Grant |
| `src/lib/server/services/document-service.test.ts:561-720` | integration | Storno-Mechanik (nicht auftragsspezifisch), `order_confirmation`-Nummernkreis |
| `src/routes/customers/customers.remote.test.ts:430-470`, `src/routes/vehicles/vehicles.remote.test.ts:495-545` | integration | Aufträge-Tabs: Guards, Filterung, orders-only-Zugriff, Leerseite |
| `src/lib/server/services/pdf-visual.test.ts:888` | visual | Snapshot eines `order_confirmation`-Belegs (Angebotsmodul) |

Nicht getestet: Kanban-Board-Komponente (`+page.svelte`) als Component-Test (nur E2E), `new/+page.svelte`, `edit/+page.svelte`, Kanban-Suche/Mitarbeiterfilter im UI, Abschluss-Dialog-Validierung `'Bitte ein Rechnungsdatum angeben.'`, Auftrag-Löschen-Dialog (nur E2E), Calendar-Edit-Probe (403-Pfad).

## 9. Feature-Matrix

| ID | Feature | Routen | Endpoints/Remotes | Tabellen | Erwartetes Verhalten |
|---|---|---|---|---|---|
| F-312 | Kanban-Board mit drei festen Spalten | `/orders` | `kanbanBoardRemote` | `work_orders`, `work_order_assignees`, `customers`, `vehicles`, `vehicle_license_plate_versions`, `documents` | Spalten "Offen", "In Bearbeitung", "Abgeschlossen" (Labels aus `workOrderStatusLabel`, `status-labels.ts:150-154`), Zähler-Badge je Spalte, Leerzustand "Keine Aufträge.", Grid 1 Spalte mobil / 3 ab `md` |
| F-313 | Kanban-Volltextsuche | `/orders` | `kanbanBoardRemote({q})` | s. o. | Eingabe "Auftrag, Kunde oder Nummer suchen", 250 ms Debounce, `maxlength=200`; Server matcht `order_number`, `title`, `customers.lastName`, `customers.company` (ILIKE `%q%`); **kein** Kennzeichen; stale-while-revalidate über `lastResult`; nicht in URL |
| F-314 | Kanban-Mitarbeiterfilter | `/orders` | `kanbanBoardRemote({employeeId})`, `pickEmployeesRemote` | `work_order_assignees` | SearchablePicker "Alle Mitarbeiter" / Dialog "Mitarbeiter filtern" (`triggerSize sm`); nur Aufträge, denen der Mitarbeiter zugewiesen ist; Clear-X hebt Filter auf |
| F-315 | Kanban-Karte | `/orders` | – | – | Auftragsnummer (mono), Titel, "Kunde · Kennzeichen" (nur wenn vorhanden), Assignee-Badges, Klick/Enter/Space → `/orders/{id}`; Aktionsbereich stoppt Propagation |
| F-316 | Sortierung und Begrenzung | `/orders` | `listKanbanBoard` | – | open/in_progress: `created_at desc`, unbegrenzt; done: `completed_at desc`, max. 25, Fußnote "Zeigt die letzten 25 abgeschlossenen Aufträge." (nur wenn ≥ 1 done-Karte) |
| F-317 | Statuswechsel per Pfeil-Buttons (optimistisch) | `/orders` | `moveWorkOrderStatusRemote` | `work_orders` | open→in_progress ("In Bearbeitung verschieben", →), in_progress→open ("Zurück zu Offen", ←), done→in_progress ("Wieder öffnen (in Bearbeitung)") nur bei `invoiceId === null`; Karte springt an den Spaltenanfang; Buttons `disabled={busy.active}`; Fehler-Toast "Status konnte nicht geändert werden" |
| F-318 | HTML5 Drag & Drop | `/orders` | `moveWorkOrderStatusRemote` | `work_orders` | Karten mit `status !== 'done'` draggable; Zielspalte färbt sich `bg-base-200`; Drop auf "Abgeschlossen" → `toast.info(...)`, keine Änderung; Drop in gleiche Spalte No-op |
| F-319 | Rechnungslink auf done-Karten | `/orders` | `kanbanBoardRemote` | `documents` | done-Karte mit `invoiceId` zeigt Link "Rechnung {nr}" (Receipt-Icon) → `/invoices/{id}`; open/in_progress nie |
| F-320 | Auftrag anlegen | `/orders/new` | `createWorkOrderRemote` | `work_orders`, `work_order_assignees`, `number_ranges` | Nummer `AU-{YYYY}-{NNNN}`, `status='open'`; Toast "Auftrag angelegt."; `goto` mit `replaceState`; `formDirty.clear()` vor `goto` |
| F-321 | Auftragsformular-Felder | `/orders/new`, `/orders/[id]/edit` | – | – | Fieldset "Auftrag": Titel* (`maxlength=200`), Beschreibung (`textarea maxlength=10000`); Fieldset "Verknüpfungen": Kunde, Fahrzeug, "Geplant am" (`date`), "Beginn (Uhrzeit)" (`time`, disabled ohne Datum, wird ohne Datum nicht gesendet); Fieldset "Zugewiesene Mitarbeiter": MultiSearchablePicker "Mitarbeiter auswählen"/"Mitarbeiter zuweisen" (max. 50 serverseitig) |
| F-322 | Regel Kunde ODER Fahrzeug | Formular, Remote, Service | `createWorkOrderRemote`, `updateWorkOrderRemote` | – | Beide optional, mindestens eins Pflicht; dreifach geprüft (Client-`check` → `_form`; Remote-Schnellpfad; Service gegen effektiven Post-Patch-Zustand); identischer deutscher Text; Termin-Aufträge ausgenommen |
| F-323 | Auto-Titel | Formular | – | – | Solange Titel unberührt: `"{make model} · {plate} · {customerName}"` aus Picker-Labels (Segmente `-` ignoriert), auf 200 Zeichen gekürzt; Tippen deaktiviert, komplettes Leeren reaktiviert (Refill beim nächsten Picker-Wechsel); Werte-Vergleich gegen `lastComposed` fängt verlorene Input-Events ab; Edit-Modus mit bestehendem Titel = manuell |
| F-324 | Kunde/Fahrzeug-Relation | Formular | `pickCustomersRemote`, `pickCustomerVehiclesRemote` | `customers`, `vehicles` | Fahrzeug zuerst → Halter wird Kunde; Kunde zuerst → Fahrzeugsuche auf dessen Fahrzeuge; Kundenwechsel/Entfernen löscht Fahrzeug; Fahrzeugsuche matcht Haltername; archivierte ausgeschlossen |
| F-325 | Creation-Flow "Neu anlegen" | Formular ↔ `/customers/new`, `/vehicles/new`, `/employees/new` | – | – | Header-Button im Picker-Dialog; Draft (alle Felder inkl. `titleTouched`, Assignee-Labels) in `creationFlow` (sessionStorage, 1 h); Rückkehr setzt Ergebnis in das Ursprungsfeld; Fahrzeug-Leaf erhält `leafInitial` mit Kunde; abweichender Halter überschreibt Kunden; Cycle-Guard je Entität |
| F-326 | Unsaved-Changes-Guard | Formular | – | – | `formDirty.set(true)` bei `oninput/onchange`/Picker-Änderung/Draft-Restore; `clear()` bei Start des Creation-Flows, nach erfolgreichem Save (vor `goto`) und beim Unmount; fehlgeschlagener Save bleibt dirty |
| F-327 | Klick-Zeit-Validierung, Button nie gesperrt | Formular | – | – | "Speichern"/"Abbrechen" nur `disabled={busy.active}`; Spinner im Submit; `novalidate`; Fehler-Alert `role="alert"` + rote Felder (`validationClasses`) |
| F-328 | Auftrag bearbeiten | `/orders/[id]/edit` | `getWorkOrderRemote`, `updateWorkOrderRemote` | `work_orders`, `work_order_assignees` | Header "Auftrag bearbeiten" mit Subtitle Nummer, Back → Detail; alle Felder werden gesendet (leer = `null`), Assignee-Set ersetzt; Toast "Auftrag gespeichert."; Bearbeiten-Button auf dem Detail fehlt bei `done` — Route/Remote aber nicht gesperrt |
| F-329 | Auftragsnummer | Service | `allocateNumber('work_order')` | `number_ranges` | `AU-{YYYY}-{NNNN}`, atomar (`UPDATE ... RETURNING`), per Migration und `seedDefaults` geseedet; UNIQUE |
| F-330 | Auftrag aus Termin | `/calendar/[id]/edit` | `getWorkOrderIdForAppointmentRemote`, `createWorkOrderFromAppointmentRemote` | `calendar_entries`, `work_orders` | Nur `kind='appointment'`; Button "Auftrag erstellen" bzw. Link "Zum Auftrag"; kopiert Titel/Kunde/Fahrzeug/Mitarbeiter; `scheduledDate/Time` aus `startsAt` (allDay → nur Datum); genau ein Auftrag pro Termin (409); Aktionen versteckt, wenn die Probe fehlschlägt |
| F-331 | Detail-Kopf und Statusaktionen | `/orders/[id]` | `moveWorkOrderStatusRemote` | `work_orders` | Titel "AU-… · {title}", Back `/orders`, "Bearbeiten" (Pencil) nur wenn nicht done; Badge (`badge-ghost`/`badge-info`/`badge-success`); Buttons: open → "In Bearbeitung"; in_progress → "Zurück zu Offen"; done ohne Rechnung → "Wieder öffnen" (RotateCcw); "Löschen" (Trash, `text-error`) nur ohne `invoiceId`; optimistisches Status-Override |
| F-332 | Stammdaten-Karte | `/orders/[id]` | `getWorkOrderRemote` | – | `dl` mit Kunde (Link `/customers/{id}` oder "-"), Fahrzeug (Link `/vehicles/{id}`, Label "Kennzeichen · Marke Modell"), Termin (nur wenn `appointmentId`, Link `/calendar/{id}/edit`, Text Termin-Titel oder "Zum Termin"), "Geplant am" (`dd.MM.yyyy` + " ab HH:MM Uhr" oder "-"), Mitarbeiter-Badges oder "-", "Abgeschlossen am" (nur done, `de-DE` medium+short), Beschreibung (`whitespace-pre-line`, nur wenn gesetzt) |
| F-333 | Abgerechnet-Hinweis | `/orders/[id]` | – | – | `alert-success` "Dieser Auftrag ist abgeschlossen und abgerechnet: Rechnung {nr}" (Link) bei `done && invoiceId` |
| F-334 | Positionen-Tabelle | `/orders/[id]` | `getWorkOrderRemote` | `work_order_items` | ab `lg` Tabelle: Pos, Beschreibung (+ "Arbeitszeit"/"Material · dd.MM.yyyy"), Mitarbeiter (Name aus Roster oder "-"), "Std. / Menge" (labor: `hours ?? quantity` + " Std."; material: `quantity unit`), Einzelpreis, Summe (`quantity × unitPriceNet`, `formatEuro`), Aktionen (nur wenn nicht gesperrt); `tfoot` "Summe (netto)"; unter `lg` gestapelte Liste "{Menge} x {Preis} = {Summe}"; Leerzustand "Noch keine Positionen erfasst."; Mengenformat `de-DE` 0–3 Nachkommastellen |
| F-335 | Positionsformular | `/orders/[id]` | `addWorkOrderItemRemote` | `work_order_items`, `time_entries` | Join-Radios "Arbeitszeit" (default) / "Material"; Felder s. Flow; Prefill Stundensatz aus `getLaborRateRemote` (nur labor); Materialpreis leer bis Katalogwahl; Einheit nur material (`maxlength=20`); Erledigt am default heute; nach Erfolg Reset (Art bleibt) |
| F-336 | Katalog-Picker mit Kategorie | `/orders/[id]` | `pickItemsRemote({category})` | `items`, `item_price_versions` | Arbeitszeit → `services` (kind=service); Material → `articles` (article/material/pass_through); Treffer-Label "{articleNumber} - {description}"; Auswahl setzt Beschreibung + Preis (+ Einheit bei Material); Abwahl leert nur die Picker-Felder; Artwechsel leert Picker und setzt Preis neu |
| F-337 | Positions-Validierung (Client) | `/orders/[id]` | – | – | Meldungen s. Flow; Button "Position hinzufügen"/"Position speichern" nur `busy`-gesperrt; Server-Schema als zweite Linie (500-Zeichen, Menge > 0, Stunden 0.01–999, Datum) |
| F-338 | Position bearbeiten | `/orders/[id]` | `updateWorkOrderItemRemote` | s. o. | Formular wechselt in "Position bearbeiten" mit vorbefüllten Werten; "Abbrechen" → Reset; Speichern → Toast "Position gespeichert."; volle Werte werden gesendet |
| F-339 | Position löschen | `/orders/[id]` | `deleteWorkOrderItemRemote` | `work_order_items`, `time_entries` | ConfirmDialog (Texte s. Flow), optimistisches Entfernen, Toast "Position gelöscht." |
| F-340 | Server-Normalisierung der Position | Service | – | `work_order_items` | Fortlaufende `position` je Auftrag; labor: `quantity = hours`, `unit='Std.'` (Default), `hours` Pflichtwert; material: `hours=null` (auch wenn gesendet), `quantity` default 1; Preis-Snapshot `unit_price_net` je Position editierbar |
| F-341 | Zeiterfassungs-Write-Through | Service | – | `time_entries` | Genau ein Eintrag je labor-Position mit Mitarbeiter und Stunden > 0 (`task = description[0:200]`, `date = done_at`, `customer_id = order.customer_id`, `work_order_id`, `work_order_item_id`); Änderung → Update; Wegfall der Bedingung/Löschung → Delete; `/hours` zeigt Auftragsnummer-Link und Badge "Auftrag", Bearbeiten/Löschen dort 409 |
| F-342 | Positionssperre | `/orders/[id]`, Service | add/update/delete Item | – | Aktive Rechnung: Warnhinweis mit Lock-Icon "Positionen sind gesperrt, solange eine gültige Rechnung existiert. Stornieren Sie die Rechnung, um Änderungen vorzunehmen.", keine Aktionsspalte, kein Formular; done ohne Rechnung: "Der Auftrag ist abgeschlossen, die Positionen sind schreibgeschützt."; Server 409 mit Rechnungsnummer |
| F-343 | Abschluss-Dialog | `/orders/[id]` | `completeWorkOrderRemote` | – | Karte "Abschluss" nur wenn `!done && !invoiceId`; Dialog-Texte/Felder s. Flow; Zahlungsart optional (`''` → `undefined`); Esc/Backdrop = Abbrechen; nach Erfolg `goto('/invoices/{id}')` |
| F-344 | Rechnungserzeugung aus Positionen | Service | `createDocument` | `documents`, `document_items`, `number_ranges` | labor → `kind='service'`, `quantity = hours ?? quantity`, `unit='Std.'`, Text + " (ausgeführt von {Vorname Nachname})" wenn Mitarbeiter (Snapshot zur Abschlusszeit), `itemId = item.itemId ?? company_settings.labor_item_id`, `articleNumber` nur aus eigener Katalogzeile; material → `kind = Katalog.kind ?? 'article'`, `articleNumber` aus Katalog, `unit = unit ?? 'Stk'`; `taxRate = default_vat_rate` für alle; `discountPercent` 0; `serviceDate` = heute (UTC); `dueDate = issueDate + default_payment_term_days`; `workOrderId` Backlink; Rundung `round2` je Zeile; Rechnung `status='created'`; PDF persistiert |
| F-345 | Regel "max. eine aktive Rechnung" | Service | `completeWorkOrderRemote` | `documents` | Zweiter Abschluss bei aktiver Rechnung → 409 mit Nummer und Storno-Hinweis; `status='done'` ohne aktive Rechnung → 409 "bereits abgeschlossen" |
| F-346 | Storno öffnet Auftrag wieder | `/invoices/[id]` → `cancelInvoice` | – | `work_orders`, `time_entries`, `documents` | `status='in_progress'`, `completed_at=null`, `invoice_id=null` (nur wenn Pointer auf das Original zeigt), Zeitbuchungen entbilligt; Storno erbt `work_order_id`; danach Positionen editierbar und Neuabschluss möglich |
| F-347 | Rechnungshistorie-Karte | `/orders/[id]` | `listOrderInvoices` | `documents` | Karte "Rechnungen" mit Untertitel "Alle zu diesem Auftrag erstellten Rechnungen — inklusive stornierter Belege und Stornorechnungen."; Spalten Nummer/Datum/Status-Badge (`documentStatusLabel`: Angelegt, Versendet, Bezahlt, Storniert, Stornorechnung…)/Brutto; Zeilen klickbar → `/invoices/{id}`; älteste zuerst; nur sichtbar wenn ≥ 1 |
| F-348 | Wiederöffnen-Regeln | Service | `setWorkOrderStatus` | `work_orders` | done → nur `in_progress`; done → open 409; done mit aktiver Rechnung 409 (Storno-Hinweis); Reopen löscht `completed_at` und `invoice_id`; gleicher Status = No-op |
| F-349 | Auftrag löschen mit GoBD-Guard | `/orders/[id]` | `deleteWorkOrderRemote` | `work_orders`, `time_entries` | Button nur ohne `invoiceId`; ConfirmDialog; 409 sobald irgendeine Rechnung (aktiv, storniert, Storno) mit `work_order_id` existiert; entfernt Zeitbuchungen; Toast "Auftrag gelöscht." |
| F-350 | Statusmaschine | Remote/Service | `moveWorkOrderStatusRemote`, `completeWorkOrderRemote` | – | `open ⇄ in_progress`; `→ done` ausschließlich über Abschluss (Schema des Move-Commands kennt `done` nicht; Service 409 als Backstop); `done → in_progress` nur ohne aktive Rechnung (automatisch durch Storno); alle Übergänge nur mit Permission `orders` (keine Rollen-Differenzierung) |
| F-351 | Berechtigungen | alle | Guards | `role_permissions` | Modulschlüssel `orders` (Administrator `*`, Werkstattleiter, Mitarbeiter geseedet; Migration 0033 nachgetragen); `pickEmployeesRemote`/`pickItemsRemote` auch mit `orders`; Aufträge-Tabs bei Kunde/Fahrzeug mit `customers\|orders` bzw. `vehicles\|orders`; Kunden-/Fahrzeug-Picker verlangen `customers` bzw. `vehicles` |
| F-352 | Aufträge-Tab Kundendetail | `/customers/[id]?tab=auftraege` | `listCustomerWorkOrdersRemote` | `work_orders` | 25/Seite, Zähler "N Einträge", Spalten Nummer/Titel/Status/Kennzeichen/Termin ("dd.MM.yyyy, HH:MM"), Zeilenklick → Detail, Leer "Bisher keine Aufträge für diesen Kunden.", Sortierung `created_at desc` |
| F-353 | Aufträge-Tab Fahrzeugdetail | `/vehicles/[id]?tab=auftraege` | `listVehicleWorkOrdersRemote` | `work_orders` | wie F-352 ohne Kennzeichen-Spalte; Leer "Keine Aufträge für dieses Fahrzeug." |
| F-354 | Rückverweis auf Rechnungsdetail | `/invoices/[id]` | `getInvoiceRemote` | `documents`, `work_orders` | Karte "Auftrag" (Auftragsnr., Titel, Button "Zum Auftrag") für aktive, stornierte und Storno-Rechnungen mit `work_order_id`; auftragsabgeleitete Stunden dort read-only mit Badge "Auftrag" |
| F-355 | Kalender-Integration | `/calendar` | `listCalendarEvents` | `work_orders`, `work_order_assignees` | Aufträge mit `scheduled_date` als `work_order`-Events (alle Status; done gemutet/durchgestrichen); Uhrzeit optional (all-day-Chip); Mitarbeiterfilter über Assignees; Ursprungs-Termin eines Auftrags wird ausgeblendet |
| F-356 | Zeiterfassungsmodul-Kopplung | `/hours`, `/hours/[id]`, `/hours/[id]/edit` | `listTimeEntriesRemote({workOrderId})` | `time_entries` | Deep-Link-Filter "Gefiltert nach Auftrag" (Chip mit X), Spalte "Auftrag" mit Link, Badge "Auftrag" statt Aktionen, Hinweis "Dieser Eintrag stammt aus einem Auftrag und wird dort gepflegt.", 409 bei Mutation |
| F-357 | Stundensatz-Verwaltung | `/settings` | `getLaborRateSettingRemote`, `updateLaborRateRemote` (Permission `settings`) | `items`, `item_price_versions`, `company_settings` | Artikel `ARBEIT` "Arbeitszeit" (`service`, `Std.`) mit Startpreis 0 durch `seedDefaults`; neue Preisversion `valid_from = heute` bei Änderung (`'Der Stundensatz muss größer als 0 sein.'`, `'Es ist kein Arbeitszeit-Artikel hinterlegt.'`); bestehende Positionen behalten Snapshot |
| F-358 | Fahrzeug-Löschguard zählt Aufträge | `/vehicles/[id]` | `deleteVehicle` | `work_orders` | "Es sind noch … N Auftrag/Aufträge … verknüpft. Bitte entfernen Sie zuerst die Verknüpfungen oder archivieren Sie das Fahrzeug." (`vehicle-service.ts:341-350`); Kunden-Löschguard zählt **keine** Aufträge (B-281) |
| F-359 | Unlöschbarkeit auftragsgebundener Rechnungen | `/invoices/[id]` | `deleteDocument` | `documents` | 409 "Diese Rechnung gehört zu einem Auftrag und ist Teil der Belegkette. Bitte stornieren Sie sie stattdessen." — auch für stornierte Originale |
| F-360 | Paginierte Auftragsliste (Server) | – (keine Seite) | `listWorkOrdersRemote` | `work_orders` u. a. | Filter `q` (inkl. Kennzeichen), `status`, `employeeId`, `customerId` (nur Service); Größe 10/25/50/100; Sortierung `created_at desc`; Rückgabe mit `customerLabel`, `vehiclePlate`, `assigneeNames` — **ohne UI** (B-266) |
| F-361 | Formatierung | `/orders/[id]` | – | – | Datum `Intl.DateTimeFormat('de-DE',{dateStyle:'medium'})`, Datum+Zeit `timeStyle:'short'`, Beträge `formatEuro`, Mengen 0–3 Dezimalstellen; Auftragsnummer monospace |
| F-362 | Ladeverhalten | alle | – | – | Ein globaler `busy`-Store: alle Mutationen in `busy.run`, Buttons `disabled={busy.active}` mit Spinner; Kanban SSR via top-level await; Detail lädt drei Queries parallel |
| F-363 | Zuweisungen (Assignees) | Formular/Service | `replaceAssignees` | `work_order_assignees` | Set-Ersetzung (delete + insert), Duplikate entfernt, max. 50; Anzeige "Vorname Nachname" (Detail/Kanban, sortiert Nachname/Vorname) vs. "Vorname Nachname · Personalnummer" (Picker); Mitarbeiterlöschung kaskadiert Zuweisung |
| F-364 | Terminplanung ohne Zeitzone | Formular/Service/Kalender | – | `work_orders.scheduled_date/scheduled_time` | Datum + optionale `HH:MM` als Wandzeit ohne TZ; Zeit ohne Datum wird verworfen (Client und Service); Datum löschen löscht Zeit; Termin-Ableitung: allDay → UTC-Datum, sonst server-lokale Getter |
| F-365 | Migrationen/Seeds | – | – | s. §5 | 0033 Tabellen + Rechte + Nummernkreis, 0034 Scheduling-Split (Europe/Berlin-Konvertierung), 0037 `documents.work_order_id` mit 2-Pass-Backfill; `seedDefaults` Arbeitszeit-Artikel |
| F-366 | Mitarbeiter-Roster für Positionsanzeige | `/orders/[id]` | `pickEmployeesRemote({page:1,size:100})` | `employees` | Beim Laden einmalig 100 nicht archivierte Mitarbeiter geholt; Map `employeeLabelById` löst Namen der Positions-Mitarbeiter auf; Fallback "-" |

## 10. Befunde

| ID | Beschreibung | Fundstelle | Auswirkung | Empfehlung | Einordnung | Betroffene Features |
|---|---|---|---|---|---|---|
| B-266 | `listWorkOrdersRemote` / `listWorkOrders` (paginierte, filterbare Liste) hat **keine UI**; die Docs behaupten "older completed orders live in the list view" (`docs/modules/orders.md:88-89`, `work-order-service.ts:330`). Abgeschlossene Aufträge älter als die letzten 25 sind nur über Kunden-/Fahrzeug-Tabs, den Rechnungs-Backlink oder den Kalender erreichbar. | `src/routes/orders/orders.remote.ts:216-225`; grep: keine Verwendung | Auffindbarkeit alter Aufträge; toter Remote inkl. `refreshAll`-Ziel | Im Rewrite Listenansicht (Tabelle mit Status-Tabs, Suche, Pagination) als Umschalter neben dem Kanban vorsehen oder den Remote streichen | Entscheidung nötig | F-316, F-360 |
| B-267 | Kanban-Spalten "Offen"/"In Bearbeitung" sind unbegrenzt (kein Limit, keine Pagination); Assignee-Fetch für alle Karten. | `work-order-service.ts:375-378` | Wachsende Betriebe: große Payload, langsames Board | WIP-Limit/Pagination oder "Mehr laden" je Spalte; Filter serverseitig beibehalten | Entscheidung nötig | F-312, F-316 |
| B-268 | Kanban-Filter (`q`, `employeeId`) werden nicht in der URL persistiert; Reload/Zurück-Navigation verliert sie. CONTRIBUTING-Listenmuster (Deep-Links) nicht angewendet. | `src/routes/orders/+page.svelte:22-45` | UX-Bruch beim Navigieren Detail → Board | Filter als `?q=&employeeId=` spiegeln | im Rewrite beheben | F-313, F-314 |
| B-269 | Kanban-Suche matcht kein Kennzeichen, die (ungenutzte) Liste schon; Placeholder verspricht "Kunde oder Nummer". | `work-order-service.ts:342-347` vs. `:239-257` | Werkstatt sucht typischerweise nach Kennzeichen | Kennzeichen-Suche im Board ergänzen | im Rewrite beheben | F-313 |
| B-270 | `FIELD_LABELS` fehlen für `scheduledDate`, `scheduledTime`, `assigneeIds`, `doneAt`, `hours`, `kind`, `itemId`, `workOrderId`, `paymentMethod`, `appointmentId` → Validierungsfehler zeigen rohe Schlüssel (z. B. "doneAt: Bitte geben Sie ein gültiges Datum ein"). `idSchema` hat keine deutsche Meldung. | `src/hooks.server.ts:264-374, 403`; `validation.ts:28` | CONTRIBUTING-Abweichung (jede Meldung deutsch) | Labels ergänzen; `idSchema` mit Meldung | im Rewrite beheben | F-321, F-335, F-337, F-343 |
| B-271 | `updateWorkOrderRemote`/`updateWorkOrder` haben keine Sperre für `done`/abgerechnete Aufträge; `/orders/[id]/edit` ist per URL erreichbar (nur der Button ist ausgeblendet). Kunde/Fahrzeug/Titel/Termin/Zuweisungen eines abgerechneten Auftrags bleiben änderbar. | `orders.remote.ts:368-382`, `work-order-service.ts:622-645`, `[id]/+page.svelte:397-399` | Historie Auftrag↔Rechnung kann divergieren (Rechnung hat eigene Snapshots, Auftragsdaten nicht) | Serverseitig 409 nach Abschluss (oder nur definierte Felder erlauben) | Entscheidung nötig | F-328, F-344 |
| B-272 | Keine Transaktionen: `createWorkOrder` (Nummer + Insert + Assignees), `createWorkOrderFromAppointment`, `deleteWorkOrder`, `completeWorkOrder` (Rechnung + Positionen + PDF + Auftrag + Zeitbuchungen), `cancelInvoice` (bewusst wegen pg-proxy-Testtreiber). Teilzustände möglich (Rechnung erzeugt, Auftrag nicht `done`; Nummer verbraucht). | `work-order-service.ts:519-542, 1015-1160`; `document-service.ts:487-499` | Datenkonsistenz bei Fehlern mitten im Ablauf | Im Nuxt-Stack echte `db.transaction` (Testharness entsprechend wählen) | im Rewrite beheben | F-320, F-330, F-344, F-346, F-349 |
| B-273 | Datumsquellen gemischt: `serviceDate = todayIso()` UTC (`work-order-service.ts:187`), Client-`issueDate`/`doneAt` lokal (`[id]/+page.svelte:75-78`), `QuickTimeEntryModal`/Settings `toISOString()` UTC. Nach 22:00 Uhr Berlin (Winter 23:00) weichen Leistungsdatum und Rechnungsdatum ab. | s. Fundstellen | Falsches Leistungsdatum auf Rechnungen | Eine Datumsquelle (Europe/Berlin) serverseitig | im Rewrite beheben | F-344 |
| B-274 | `scheduleFromAppointment` nutzt server-lokale Getter (`getHours`); Ergebnis hängt von der Server-Zeitzone ab (Container `node:lts-slim`, TZ nicht geprüft). Migration 0034 rechnete explizit Europe/Berlin. Termin 08:00 Berlin könnte als `06:00` übernommen werden. Tests spiegeln die lokalen Getter und decken das nicht auf. | `work-order-service.ts:552-565`; `calendar-service.ts:329-334` | Falsche Uhrzeit bei Termin-Aufträgen in UTC-Deployments (unklar, ob TZ gesetzt) | Zeitzonen-Konvention festlegen (feste `Europe/Berlin`), Datum/Zeit deterministisch ableiten | Entscheidung nötig | F-330, F-364 |
| B-275 | Detail lädt `pickEmployeesRemote({size:100})` (nur `archived=false`) zur Namensauflösung; archivierte Mitarbeiter oder Betriebe > 100 zeigen "-" bei Positionen; `startEditItem` verliert das Label. | `[id]/+page.svelte:49-60, 233-235, 587-589` | Falsche/leere Anzeige historischer Positionen | Mitarbeitername serverseitig je Position mitliefern (Join) | im Rewrite beheben | F-334, F-338, F-366 |
| B-276 | `updateWorkOrderItemRemote` verlangt das volle Item-Schema, obwohl Service und JSDoc einen Partial-Patch beschreiben. | `orders.remote.ts:445-459` | API-Inkonsistenz; Client muss alle Werte kennen | Patch-Schema mit optionalen Feldern | im Rewrite beheben | F-338 |
| B-277 | Keine Soll-/Ist-Stunden am Auftrag: kein Feld "geplante Stunden" im Modell, keine Summe der Ist-Stunden, kein `QuickTimeEntryModal` am Auftrag (nur an Angebot/Rechnung). Zeit wird ausschließlich über Arbeitszeit-Positionen erfasst. | `schema.ts:1199-1246`; grep `QuickTimeEntryModal` | Erwartetes Feature (Aufgabenstellung) existiert nicht | Entscheiden, ob Planstunden/Ist-Anzeige/Schnellerfassung ins Zielsystem gehören | Entscheidung nötig | F-341 |
| B-278 | Keine Auftrags-PDF/Auftragsbestätigung für Werkstattaufträge (kein Druckstück für Kunde/Werkstatt, kein Mailversand). `order_confirmation` ist ein Beleg des Angebotsmoduls ohne Bezug zu `work_orders`. | grep `pdf-service.ts`/`pdfs.remote.ts` leer; `offers/new/+page.svelte:244`; `seed-defaults.ts:67-71` | Kein Auftragsschein, keine Kundenbestätigung aus dem Auftrag | Entscheiden: Auftragsschein-PDF (+ Mail) im Rewrite, ggf. Verknüpfung `order_confirmation` ↔ `work_orders` | Entscheidung nötig | F-344 |
| B-279 | Keine MwSt/Rabatt je Auftragsposition: alle Rechnungspositionen erhalten `default_vat_rate`, `discountPercent` bleibt 0; Auftrag zeigt nur Netto-Summe (keine Brutto-Vorschau). Durchlaufposten (`pass_through`) erhalten ebenfalls den Standardsatz. | `work-order-service.ts:1046-1047, 1094-1125`; `[id]/+page.svelte:105-108, 632-640` | Steuerlich falsche Rechnungen bei abweichenden Sätzen (z. B. 0 % Durchlaufposten) | Steuersatz/Rabatt je Position (aus Katalog übernehmen), Brutto-Vorschau | Entscheidung nötig | F-334, F-344 |
| B-280 | Detail-Summe rechnet `Number(quantity)*Number(unitPriceNet)` ohne Zeilenrundung, die Rechnung rundet `round2` je Zeile → Cent-Abweichungen zwischen Auftrag und Rechnung möglich. | `[id]/+page.svelte:105-108`; `document-service.ts:252-256` | Verwirrende Differenzen | Gleiche Rundungsfunktion (shared util) | im Rewrite beheben | F-334, F-344 |
| B-281 | Kunden-Löschguard zählt Fahrzeuge/Belege/Reifeneinlagerungen, aber **keine Aufträge**; `work_orders.customer_id` ist `ON DELETE SET NULL` → Auftrag ohne Kunde (bei Fahrzeug-losem Auftrag Verletzung der Kunde-ODER-Fahrzeug-Regel, Zeitbuchungen behalten `customer_id`? unklar, FK in `time_entries` nicht gelesen). Fahrzeug-Guard macht es richtig. | `customer-service.ts:188-218` vs. `vehicle-service.ts:320-350` | Verwaiste Aufträge, Regelbruch | Aufträge im Kunden-Guard zählen (Archivieren als Pfad) | im Rewrite beheben | F-322, F-358 |
| B-282 | Mitarbeiterlöschung: `work_order_assignees` CASCADE, `work_order_items.employee_id` SET NULL → Position verliert Ausführenden, Write-Through-Eintrag (`time_entries.employee_id`) unklar (employee-service nicht gelesen). Rechnungstext behält Snapshot. | `schema.ts:1255-1257, 1295-1297` | Historienverlust am Auftrag | Guard oder Archivierung statt Löschung; Name-Snapshot auf Position | Entscheidung nötig | F-340, F-363 |
| B-283 | `pickItemsRemote` löst je Treffer `getCurrentItemPrice` einzeln (N+1, 25 Queries pro Seite). | `pickers.remote.ts:399-413` | Latenz im Katalog-Picker der Positionserfassung | Preis per Subquery/Join laden | im Rewrite beheben | F-336 |
| B-284 | Suche `q` in `listWorkOrders` erzeugt Vor-Query auf Kennzeichen und bettet alle Treffer-IDs als `IN (...)` ein (unbounded); alle ILIKE `%q%` ohne Trigram-Index. | `work-order-service.ts:239-257` | Skalierung bei großen Fahrzeugbeständen | Join/EXISTS statt ID-Liste; `pg_trgm`-Index prüfen | bewusst später | F-360 |
| B-285 | A11y Kanban: Spalten `role="list"` enthalten `role="button"`-Karten (keine `listitem`); Drag & Drop nicht tastaturbedienbar (Pfeil-Buttons als Ersatz vorhanden); `title`-Attribute als einzige Tooltips. | `+page.svelte:194-232` | Screenreader-Struktur inkonsistent | ARIA-Struktur (`listitem`) und Tastatur-Move | im Rewrite beheben | F-312, F-318 |
| B-286 | UI-Sperre `hasInvoice = invoiceId !== null` (Pointer) vs. Server-Sperre über Rechnungsstatus. Bei Legacy-/Inkonsistenz-Zeilen (Pointer auf stornierte Rechnung, z. B. Storno vor Migration 0037 oder wenn `cancelInvoice`-Bedingung `invoice_id = originalId` nicht griff) bleibt die UI dauerhaft gesperrt: "Wieder öffnen" erscheint nur bei `invoiceId === null`, Löschen ebenso versteckt → nur per DB reparierbar. | `[id]/+page.svelte:62-71, 426-448`; `document-service.ts:552-556` | Deadlock für Sonderfälle | UI-Sperre vom Server-Flag (`activeInvoice`) ableiten und im Detail mitliefern | im Rewrite beheben | F-331, F-342 |
| B-287 | "Wieder öffnen"-Pfad (Detail und Kanban) ist praktisch tot: nach Storno ist der Auftrag bereits `in_progress`; ein `done`-Auftrag ohne `invoice_id` entsteht nur durch Legacy/Direktmanipulation. | `[id]/+page.svelte:426-437`; `+page.svelte:266-277` | Toter Code / verwirrende Zustandsmatrix | Zustand "done ohne Rechnung" im Zielmodell ausschließen (Invariante) | im Rewrite beheben | F-317, F-348 |
| B-288 | Kein Existenz-/Archiv-Check für `customerId`, `vehicleId`, `assigneeIds`, `itemId`, `employeeId` (nur Picker filtern archivierte); unbekannte IDs enden als FK-Fehler → generische 500-Meldung statt kuratiertem 4xx. | `orders.remote.ts:322-339, 435-443` | Unsaubere Fehlertexte; archivierte Datensätze per API zuweisbar | Serverseitige Prüfung mit deutschen 400/404 | im Rewrite beheben | F-320, F-335 |
| B-289 | Nutzer mit **nur** `orders` können im Formular keine Kunden/Fahrzeuge wählen: `pickCustomersRemote` verlangt `customers`, `pickCustomerVehiclesRemote` verlangt `vehicles` (nicht relaxiert wie Mitarbeiter/Artikel). Seeds geben Mitarbeitern breite Leserechte, also selten sichtbar; trotzdem inkonsistent. | `pickers.remote.ts:103, 228` vs. `:314, 367` | 403-Toasts im Auftragsformular für reine Werkstatt-Rollen | Picker-Guards auf `requireAnyPermission(..., 'orders')` erweitern | im Rewrite beheben | F-324, F-351 |
| B-290 | Abschluss erlaubt Rechnungen **ohne Kunden** (Fahrzeug-only-Auftrag → `documents.customer_id = NULL`), während `/invoices/new` einen Kunden erzwingt ("Bitte einen Kunden auswählen.", E2E `orders-invoices.spec.ts:291`). Termin-Aufträge können sogar ohne Kunde und Fahrzeug entstehen. | `work-order-service.ts:1128-1140, 503-508`; `orders.remote.ts:353` | Rechnung ohne Empfänger (GoBD/§14 UStG) | Abschluss ohne Kunde verweigern oder Kunden im Abschluss-Dialog nachfordern | Entscheidung nötig | F-322, F-330, F-344 |
| B-291 | Docs veraltet gegenüber Code: Spec sagt "reopen only while invoice_id IS NULL" und "delete 409s once invoice_id is set" (`docs/specs/2026-07-06-work-orders-design.md:75-77`), Code nutzt aktive Rechnung bzw. gesamte Historie; Spec nennt `ConfirmDialog` für Abschluss (`:120`), Code nutzt eigenen `<dialog>`; Spec-Kalenderregel (`:96-98`) durch Addendum ersetzt. `docs/modules/orders.md` und `order-invoice-rules.md` sind korrekt. | s. Fundstellen | Missverständnisse beim Rewrite | Spec als historisch markieren, `order-invoice-rules.md` als Wahrheit | bewusst später | F-348, F-349 |
| B-292 | `listSchema.size` erlaubt 10/25/50/100, CONTRIBUTING schreibt feste 25 vor (Remote ungenutzt, s. B-266). | `orders.remote.ts:102` | Regelabweichung | Feste 25 | im Rewrite beheben | F-360 |
| B-293 | Positionsformular: "Erledigt am" ohne Client-Validierung; Stunden serverseitig bis 999 erlaubt (Write-Through erzeugt `time_entries` mit Werten, die `/hours` selbst auf 24 h/Eintrag begrenzt, `hours.remote.ts:112-115`); Preis darf negativ sein (nur `isFinite`). | `[id]/+page.svelte:244-282`; `orders.remote.ts:143-152` | Inkonsistente Datenqualität zwischen Modulen | Gemeinsame Grenzen (0.25–24 h, Preis ≥ 0 oder bewusst negativ) | im Rewrite beheben | F-335, F-337, F-341 |
| B-294 | Beschreibung 500 Zeichen erlaubt, `time_entries.task` wird still auf 200 Zeichen gekürzt (`slice(0,200)`). | `work-order-service.ts:798` | Informationsverlust in der Zeiterfassung ohne Hinweis | Längen angleichen oder Hinweis | im Rewrite beheben | F-341 |
| B-295 | Globale Suche kennt keine Aufträge (Quellen: customers, vehicles, items, tires, tireStorage, suppliers, employees, documents, posts). Auftragsnummer `AU-…` ist nicht global suchbar. | `search-service.ts` (grep leer) | Auffindbarkeit | Aufträge in globale Suche aufnehmen | im Rewrite beheben | F-313 |
| B-296 | Calendar-Edit: Probe `getWorkOrderIdForAppointmentRemote` schluckt **jeden** Fehler (nicht nur 403) per `console.info` und versteckt die Auftragsaktionen still. | `calendar/[id]/edit/+page.svelte:45-56` | 500er bleiben unsichtbar | Nur 403 abfangen, Rest melden; oder Permission clientseitig prüfen | im Rewrite beheben | F-330 |
| B-297 | Optimistische Kanban-Moves und Detail-Status-Override zeigen bei Server-409 kurz den neuen Zustand und springen zurück; für den Kanban-Reopen-Pfad wird `getWorkOrderRemote({id}).refresh()` serverseitig ausgelöst, ohne dass das Board diese Instanz per `.updates` deklariert (harmlos, aber unnötiger Roundtrip). | `orders.remote.ts:418-421`, `+page.svelte:92-111` | Minimal | Refresh-Ziele je Aufrufer trennen | bewusst später | F-317 |
| B-298 | `pickEmployeesRemote` (mit `orders`-Recht zugänglich) sucht auch in `privateEmail`, `privatePhone`, `mobile` — ein Werkstattnutzer kann private Kontaktdaten anderer Mitarbeiter per Suchtreffer verifizieren (Label zeigt nur Name/Personalnummer). | `pickers.remote.ts:319-328` | Datenschutz (Mitarbeiterdaten) | Suchfelder für den Picker auf Name/Personalnummer beschränken | im Rewrite beheben | F-314, F-321 |
| B-299 | Race bei paralleler Positionsanlage: `position = max+1` ohne Unique-Constraint `(work_order_id, position)` → doppelte Positionsnummern möglich. | `work-order-service.ts:853-859` | Doppelte Pos-Nummern in Auftrag und Rechnung | Unique-Index + Retry oder Sequenz je Auftrag | im Rewrite beheben | F-340 |
| B-300 | Rechnungsvorschau/-summe vor Abschluss fehlt: Der Dialog zeigt nur die Anzahl Positionen, nicht Netto/Brutto oder Fälligkeit; Zahlungsart-Select nutzt `<select>` (erlaubt, da keine Relation). | `[id]/+page.svelte:963-997` | Nutzer sieht Betrag erst auf der Rechnung | Summenvorschau im Dialog | bewusst später | F-343 |

## 11. Offene Fragen an den Architekten

1. Soll es neben dem Kanban eine echte Listenansicht (Tabelle, Status-Tabs, Suche inkl. Kennzeichen, Pagination, Umschalter mit Persistenz) geben? Bleibt das Done-Limit 25? (B-266/02)
2. Darf ein Auftrag ohne Kunden abgeschlossen werden (Rechnung ohne Empfänger)? Sollen Termin-Aufträge ohne Kunde/Fahrzeug weiterhin erlaubt sein? (B-290)
3. Welche Felder dürfen nach Abschluss/Abrechnung noch geändert werden (Titel, Beschreibung, Zuweisungen, Termin)? Vollständige Sperre oder Teilsperre? (B-271)
4. Werden Planstunden (Soll), Ist-Stunden-Summe je Auftrag und eine Schnellerfassung ("Arbeit erfassen") am Auftrag gewünscht? Bleibt die Regel "Zeit nur über Arbeitszeit-Positionen"? (B-277)
5. Wird ein Auftragsschein/Auftragsbestätigung als PDF (Druck für Werkstatt, Mail an Kunde) benötigt? Soll der Belegtyp `order_confirmation` mit `work_orders` verknüpft werden? (B-278)
6. Steuersatz und Rabatt je Position (Übernahme aus Katalog, Durchlaufposten 0 %)? Brutto-Vorschau im Auftrag und im Abschluss-Dialog? (B-279/35)
7. Zeitzonen-Strategie des Zielsystems: feste `Europe/Berlin` serverseitig für alle Datums-/Zeitableitungen (Termin → Auftrag, Leistungsdatum)? (B-273/09)
8. Kanban-Verhalten: manuelle Reihenfolge innerhalb einer Spalte (Drag-Sortierung), WIP-Limits, weitere Spalten (z. B. "Wartet auf Teile")? Aktuell feste drei Status ohne Sortierung.
9. Rollen/Rechte: Sollen Statuswechsel/Abschluss/Löschen feiner berechtigt werden (z. B. Abschluss nur Werkstattleiter)? Aktuell genügt `orders` für alles. Picker-Guards für Kunde/Fahrzeug relaxieren? (B-289)
10. Umgang mit archivierten/gelöschten Mitarbeitern in Positionen: Name-Snapshot auf der Position, Lösch-Guard? (B-275/17)
11. Lösch-Guard für Kunden um Aufträge erweitern (Archivieren als Standardpfad)? (B-281)
12. Öffentliche REST-API: CLAUDE.md nennt `orders` unter `/api/public/*`; das ist ein anderer Ressourcenbegriff (Bestellungen?) — nicht gelesen. Zu klären, ob Werkstattaufträge nach außen exponiert werden sollen.
13. Nummernformat `AU-{YYYY}-{NNNN}` und Jahreswechsel-Reset beibehalten?
14. Sollen Aufträge in die globale Suche? (B-295)

## 12. Gelesene Dateien

Vollständig gelesen (Datei — Zeilen):

- `src/routes/orders/+page.svelte` — 328
- `src/routes/orders/orders.remote.ts` — 502
- `src/routes/orders/WorkOrderForm.svelte` — 500
- `src/routes/orders/new/+page.svelte` — 40
- `src/routes/orders/[id]/+page.svelte` — 1047
- `src/routes/orders/[id]/DetailHost.svelte` — 16
- `src/routes/orders/[id]/edit/+page.svelte` — 71
- `src/lib/server/services/work-order-service.ts` — 1160
- `src/lib/components/ui/MultiSearchablePicker.svelte` — 315
- `src/lib/components/ui/QuickTimeEntryModal.svelte` — 184
- `src/lib/components/ui/CustomerVehiclePicker.svelte` — 209
- `src/routes/pickers.remote.ts` — 703
- `drizzle/0033_work_orders.sql` — 235
- `drizzle/0034_scheduling_docs_owner.sql` — 73
- `drizzle/0037_document_work_order_link.sql` — 49
- `src/routes/orders/orders.remote.test.ts` — 589
- `src/routes/orders/WorkOrderForm.test.ts` — 371
- `src/routes/orders/[id]/page.test.ts` — 214
- `src/lib/server/services/work-order-service.test.ts` — 1261
- `e2e/orders-invoices.spec.ts` — 325
- `docs/modules/orders.md` — 101
- `docs/specs/2026-07-06-work-orders-design.md` — 187
- `docs/domain/order-invoice-rules.md` — 82
- `docs/domain/document-types.md` — 63
- `src/lib/payment-methods.ts` — 20
- `src/lib/utils/picker-labels.ts` — 61
- `src/lib/server/services/settings-service.ts` — 14

Abschnittsweise gelesen (Datei — Gesamtzeilen — gelesene Bereiche):

- `src/lib/server/db/schema.ts` — 2025 — 620–647, 1150–1181, 1199–1309, 1996–2005 + grep `work_order|workOrder`
- `src/lib/server/services/document-service.ts` — 688 — 180–590 + grep der Exporte
- `src/lib/server/services/pdf-service.ts` — 2716 — 240–270, 455–485 + grep `order|auftrag|work_order` (kein Auftragsbezug)
- `src/lib/server/services/time-entry-service.ts` — 446 — 1–300 + grep
- `src/lib/server/services/calendar-service.ts` — 577 — 95–135, 195–240, 315–340 + grep
- `src/lib/components/ui/SearchablePicker.svelte` — 284 — 1–80 (Props)
- `src/hooks.server.ts` — 470 — 255–275, 376–430 + grep `FIELD_LABELS`-Schlüssel
- `src/lib/server/db/validation.ts` — 315 — Definitionen `idSchema`, `longTextSchema`, `paymentMethodSchema`, `dateStringSchema`, `moneySchema`, `timeHHMMSchema`, `searchQuerySchema`, `ListParams`, `ListResult`
- `src/lib/utils/status-labels.ts` — 269 — 38–54, 148–175
- `src/lib/components/layout/navigation.ts` — 247 — 112–124
- `src/lib/permissions.ts` — 53 — 35–36
- `src/lib/server/services/number-range-service.ts` — 122 — 45–65
- `src/lib/server/db/seed-defaults.ts` — 376 — 233–281 + grep `order_confirmation`
- `src/routes/settings/settings.remote.ts` — 450 — 200–262
- `src/routes/settings/+page.svelte` — grep `Stundensatz|laborRate` (Zeilen 133–171, 426–460 identifiziert)
- `src/routes/calendar/[id]/edit/+page.svelte` — 157 — 1–125
- `src/routes/calendar/calendar.remote.ts` — 380 — grep `startsAt|allDay`
- `src/routes/invoices/invoices.remote.ts` — 421 — 150–186
- `src/routes/invoices/[id]/+page.svelte` — 962 — 680–712, 805–830
- `src/routes/customers/customers.remote.ts` — 380 — 180–200
- `src/routes/customers/[id]/+page.svelte` — 613 — 470–533
- `src/lib/server/services/customer-service.ts` — 262 — 188–218
- `src/routes/vehicles/vehicles.remote.ts` — 644 — 255–300
- `src/routes/vehicles/[id]/+page.svelte` — 724 — 545–601
- `src/lib/server/services/vehicle-service.ts` — 858 — 310–350
- `src/routes/hours/+page.svelte` — 420 — 28–55, 190–210, 255–295
- `src/routes/hours/hours.remote.ts` — 369 — 33–53, 105–130, 260–300
- `src/routes/hours/[id]/+page.svelte`, `src/routes/hours/[id]/edit/+page.svelte` — grep `isOrderDerived|stammt aus einem Auftrag`
- `src/lib/server/services/search-service.ts` — 500 — grep `workOrder|work_order` (0 Treffer), `from(`-Quellen
- `src/lib/server/services/mail-service.ts` — grep `order_confirmation`
- `src/lib/components/ui/MultiSearchablePicker.test.ts` — 378 — Testnamen (describe/it)
- `src/lib/components/ui/QuickTimeEntryModal.test.ts` — 161 — Testnamen
- `src/lib/server/services/time-entry-service.test.ts` — 520 — Testnamen mit Auftragsbezug
- `src/routes/hours/hours.remote.test.ts` — 618 — Testnamen mit Auftragsbezug
- `src/lib/server/services/calendar-service.test.ts` — 777 — Testnamen mit Auftragsbezug
- `src/lib/server/db/seed-defaults.test.ts` — 136 — Testnamen
- `src/lib/server/services/document-service.test.ts` — 847 — Testnamen mit Storno/Order-Bezug
- `src/lib/server/services/pdf-visual.test.ts` — 1147 — grep `order_confirmation`
- `src/routes/customers/customers.remote.test.ts` — 480 — Testnamen Aufträge-Tab
- `src/routes/vehicles/vehicles.remote.test.ts` — 752 — Testnamen Aufträge-Tab

Nicht gelesen (bewusst, außerhalb Scope): `ConfirmDialog.svelte`, `creation-flow.svelte.ts`, `form-validation.svelte.ts`, `employee-service.ts` (Lösch-Guard), `Dockerfile` (TZ), `src/routes/api/public/*` (Ressource `orders`).
