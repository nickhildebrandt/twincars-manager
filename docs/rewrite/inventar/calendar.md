---
title: Inventar Kalender (CAL)
teil_von: docs/rewrite/01-inventar.md
stand: Bestand (SvelteKit) vor dem Rewrite
---

> **Detail-Inventar des Bestands.** Erhoben durch vollständiges Lesen der in
> Abschnitt „Gelesene Dateien" genannten Dateien. Die IDs wurden auf die
> globalen IDs aus [01-inventar.md](../01-inventar.md) umgestellt
> (60 IDs). Zurück: [01-inventar.md](../01-inventar.md) ·
> [02-befunde.md](../02-befunde.md)

# Modul: Kalender, Termine, Feiertage, freie Slots   (Kürzel: CAL)

Sprache: Deutsch für Fließtext/Tabellen; Code-Bezeichner, Dateipfade, Tabellen-/Spaltennamen bleiben englisch und exakt wie im Code.
Alles muss aus dem tatsächlich gelesenen Code stammen. Keine Vermutungen. Bei Unsicherheit "unklar" schreiben und Fundstelle nennen.
Fundstellen immer als `pfad/datei.ts:zeile`.

Abgrenzung: Der Public-API-Agent verweist für `GET /api/public/free-slots` und `POST /api/public/appointments` hierher — die Slot-Berechnung und die externe Terminbuchung sind in diesem Dokument vollständig beschrieben (Abschnitte 2, 3, 6, 7). Die Öffnungszeiten-Pflege (`/settings/workshop-hours`) gehört zum Settings-Agenten, wird hier aber als Slot-Grundlage mit dokumentiert. Abwesenheiten (`employee_absences`) gehören zum Employees-Agenten; hier nur ihr Erscheinen im Kalender.

## 1. Routen und Seiten

| Route | Datei | Parameter | Guard / Permission | Layout | Datenabhängigkeiten (Remote-Queries, Reihenfolge) | Zweck |
|---|---|---|---|---|---|---|
| `/calendar` | `src/routes/calendar/+page.svelte` | **keine URL-Parameter**. Zustand (`viewYear`, `viewMonth`, `employeeId`) lebt nur im Komponenten-State (`+page.svelte:13-22`); kein `?date=`, kein `?employee=`, kein `?page=`. Nach Navigation weg und zurück startet der Kalender wieder im aktuellen Monat ohne Filter. | Session-Gate in `hooks.server.ts:223-226`; Remote `listCalendarEventsRemote` → `requirePermission('calendar')` (`calendar.remote.ts:103`); Sidebar-Eintrag "Kalender" mit `permission: 'calendar'` (`navigation.ts:78-81`) | AppShell (Standard, `PageHeader` mit Primäraktion "Termin hinzufügen" → `/calendar/new`, `+page.svelte:204-211`) | 1. `await untrack(() => listCalendarEventsRemote({ from, to, employeeId? }))` als SSR-Seed (`+page.svelte:44`), only-set-keys (`:34-41`); 2. `$effect` + `$derived.by` rufen den Proxy bei jeder Monats-/Filteränderung neu (`:48-55`); 3. `pickEmployeesRemote(...).run()` nur bei Öffnen des Filter-Pickers (`:57-61`) | Monatsraster (≥ `lg`) bzw. Agenda-Liste (< `lg`) mit Terminen, Betriebsschließungen, Abwesenheiten, Feiertagen, HU-Fälligkeiten und Aufträgen |
| `/calendar/new` | `src/routes/calendar/new/+page.svelte` | keine. Creation-Flow: `CalendarForm` nutzt `currentUrl()` als `returnUrl` (`CalendarForm.svelte:253`) und liest beim Zurückkommen `creationFlow.pendingReturnFor(currentUrl())` (`:176`) | `createCalendarEntryRemote` → `requirePermission('calendar')` (`calendar.remote.ts:135`); Picker-Remotes verlangen zusätzlich `customers` / `vehicles` / `employees|orders` (siehe B-474) | AppShell; `PageHeader title="Neuer Eintrag" back="/calendar"` (`new/+page.svelte:36`) | Beim Laden **keine** Query. Beim Speichern: `findOverlappingAppointmentsRemote(...).run()` (nur Termin, `CalendarForm.svelte:357-363`) → `createCalendarEntryRemote(values)` (`new/+page.svelte:19`). Redirect nach Erfolg: `goto('/calendar')` (`:29`); Abbrechen: `goto('/calendar')` (`:38`) | Termin oder Betriebsschließung anlegen |
| `/calendar/[id]/edit` | `src/routes/calendar/[id]/edit/+page.svelte` | `id` aus `page.params.id`, einmalig per `untrack` gelesen (`:25`); kein keyed `[id]/+layout.svelte` (es gibt keine Detail-zu-Detail-Links, daher nicht nötig) | `getCalendarEntryRemote` → `calendar` (`calendar.remote.ts:246`); Auftrags-Probe `getWorkOrderIdForAppointmentRemote` → `orders` (`orders.remote.ts:268`); bei Fehler (z. B. 403) werden die Auftragsaktionen still ausgeblendet (`edit/+page.svelte:45-56`) | AppShell; Titel "Termin bearbeiten" / "Betriebsschließung bearbeiten", `back="/calendar"` (`:102-107`) | 1. `await getCalendarEntryRemote({ id })` (`:33`, 404 → `+error.svelte`); 2. nur für `kind='appointment'`: `await getWorkOrderIdForAppointmentRemote({ appointmentId: id })` in try/catch (`:45-56`); beim Speichern `findOverlappingAppointmentsRemote` (mit `excludeId`) → `updateCalendarEntryRemote({ id, values })` (`:73`); Löschen `deleteCalendarEntryRemote({ id })` (`:91`); "Auftrag erstellen" `createWorkOrderFromAppointmentRemote` (`:60-62`) → `goto('/orders/{id}')` | Eintrag bearbeiten, löschen, Termin → Auftrag |
| `/calendar/[id]` | – | – | – | – | – | **Existiert nicht.** Es gibt keine Detailseite; Chips im Kalender führen direkt auf `/calendar/[id]/edit` (`+page.svelte:76-78`). Auch die Auftrags-Detailseite verlinkt direkt auf `/calendar/{appointmentId}/edit` (`src/routes/orders/[id]/+page.svelte:492`). |
| `GET /api/public/free-slots` | `src/routes/api/public/free-slots/+server.ts` (Handler in `endpoint.ts`) | Query: `from`, `to` (ISO-Datetime, Pflicht), `durationMinutes` (optional, Default 30, 1..480), `service` (optional Item-ID) | `publicApi(...)`-Wrapper: Bearer-Token aus `API_TOKENS`, Rate-Limit 120/min pro Token-Präfix (`src/lib/server/public-api.ts:41-130`); Pfad in `PUBLIC_PREFIXES` (`hooks.server.ts:61-75`); `OPTIONS` ohne Auth (CORS-Preflight, `:45-47`) | – (JSON-Envelope `{ data }` / `{ error: { code, message } }`) | `getItem(serviceId)` (nur wenn `service` gesetzt) → `findFreeSlots(...)` | Freie Buchungsfenster für die Website |
| `POST /api/public/appointments` | `src/routes/api/public/appointments/+server.ts` (Handler in `endpoint.ts`) | JSON-Body: `customerEmail`, `customerName`, `customerPhone?`, `serviceId` (laut Schema optional, zur Laufzeit Pflicht), `startsAt`, `durationMinutes` (laut Schema optional, zur Laufzeit Pflicht), `notes?` | wie oben (Bearer + Rate-Limit) | – | `getItem(serviceId)` → `findFreeSlots(...)` → Kunden-Lookup/-Anlage (`nextCustomerNumber()`) → Insert `calendar_entries` → `sendAppointmentConfirmation(...)` (best effort) | Externe Terminbuchung |
| `/` (Dashboard, nur Termin-Kacheln) | `src/routes/+page.svelte` | – | `getDashboardKpis` / `getUpcomingRemote` → `requireUser()` (`dashboard.remote.ts:18,30`) — **keine** Modul-Permission | AppShell | `getDashboardKpis()` (`+page.svelte:23`), `await untrack(() => getUpcomingRemote())` (`:26`) | KPI "Termine heute" (`:77-83`), Karte "Anstehende Termine" (`:125-169`) mit Link "Kalender öffnen →" auf `/calendar` |
| `/settings/workshop-hours` | `src/routes/settings/workshop-hours/+page.svelte` (Settings-Agent) | – | `requirePermission('settings')` (`workshop-hours.remote.ts:63,76`) | Settings-Layout (TabGroup-Nav-Modus, Tab "Öffnungszeiten", `src/routes/settings/+layout.svelte:58-60`) | `await listWorkshopHoursRemote()` (`+page.svelte:14`); Speichern: sequenziell 7× `updateWorkshopHoursRemote` (`:69-76`) | Öffnungszeiten je Wochentag — Grundlage der Slot-Berechnung |

## 2. Remote Functions und Endpoints

Gemeinsame Schemas in `src/routes/calendar/calendar.remote.ts`:
- `isoDateSchema = pipe(string(), trim(), maxLength(10))` (`:30`) — **kein** Format-Check, **keine** deutsche Meldung.
- `dateTimeStringSchema = pipe(string(), trim(), maxLength(40))` (`:31`) — dito.
- `titleSchema = pipe(string(), trim(), maxLength(200))` (`:32`) — **kein** `minLength(1)`, keine Meldung.
- `appointmentInput` (`:47-58`): `kind: literal('appointment')`, `title`, `startsAt`, `endsAt` (alle Pflicht), `allDay?: boolean`, `status?: picklist(['scheduled','completed','cancelled'])`, `customerId?/vehicleId?/employeeId?: idSchema` (`idSchema` = string 1..64, kein UUID-Check, `validation.ts:28`), `notes?: notesSchema` (trim, max 2000, deutsche Meldung, `validation.ts:123-127`).
- `closureInput` (`:66-77`): `kind: literal('closure')`, `title`, `startsAt`, `endsAt`, `allDay: literal(true)`, `status?`, FK-Felder optional (Laufzeitprüfung verbietet Werte), `notes?`.
- `createInputSchema = variant('kind', [appointmentInput, closureInput])` (`:79`).
- `listSchema` (`:81-87`): `page: number()`, `size: picklist([10,25,50,100])`, `q?` (max 200), `from?`, `to?` (dateTimeStringSchema).

FIELD_LABELS-Abdeckung (`src/hooks.server.ts`): `title` → "Titel" (`:268`), `notes` → "Notiz" (`:283`), `customerId/vehicleId/employeeId` → "Kunde/Fahrzeug/Mitarbeiter" (`:300-302`), `status` → "Status" (`:374`). Für `startsAt`, `endsAt`, `allDay`, `kind`, `from`, `to`, `excludeId` gibt es **keine** Labels (grep ohne Treffer).

- **`listCalendarEventsRemote`** — query — `src/routes/calendar/calendar.remote.ts:96-106`
  - Guard: `requirePermission('calendar')` (`:103`)
  - Argumente: `from: isoDateSchema` (Pflicht), `to: isoDateSchema` (Pflicht), `employeeId?: idSchema`
  - Rückgabe: `CalendarEvent[]` (flach, ein Eintrag pro Tag; Felder `id`, `kind`, `dateIso`, `title`, `startsAt?`, `endsAt?`, `sourceId?`, `employeeId?`, `customerId?`, `vehicleId?`, `done?`; `calendar-service.ts:62-80`). Keine Pagination, kein Limit.
  - Fehlerfälle: nur Valibot (`from`/`to` > 10 Zeichen). Ungültige Datumsstrings führen in `expandDays`/`new Date(...)` zu `NaN`-Vergleichen → leeres Ergebnis bzw. Postgres-Fehler bei `Invalid Date` als Parameter (unklar, nicht getestet; `calendar-service.ts:118-119`).
  - Nebenwirkungen: keine. Transaktion: nein.

- **`listAppointmentsRemote`** — query — `calendar.remote.ts:115-118`
  - Guard: `requirePermission('calendar')`
  - Argumente: `listSchema` (s. o.; `size` erlaubt 10/25/50/100 — widerspricht "fix 25")
  - Rückgabe: `ListResult<AppointmentRow>` = `{ items, total, page, size, pageCount }`; `AppointmentRow = CalendarEntry & { customerName, vehicleLabel, employeeName }` (`calendar-service.ts:346-350`)
  - **Von keiner Seite aufgerufen** (grep: nur Tests und die Remote selbst). Ist das Refresh-Ziel aller Mutationen (`:168`, `:232`, `:304`).

- **`createCalendarEntryRemote`** — command — `calendar.remote.ts:132-217`
  - Guard: `requirePermission('calendar')` (`:135`)
  - Argumente: `createInputSchema` (variant)
  - Verhalten Termin (`:136-174`): `allDay` Default `false`; `new Date(input.startsAt)` / `new Date(input.endsAt)` (lokal-naiv, d. h. Server-TZ, `:138-139`); `NaN` → 400 „Bitte einen gültigen Zeitraum angeben." (`:141`); `endsAt < startsAt` → 400 „Endzeit muss nach Startzeit liegen." (`:144`; **Gleichheit erlaubt**); bei `allDay` werden die Grenzen auf `YYYY-MM-DDT00:00:00Z` / `T23:59:59Z` gepinnt (`:149-154`); `status` Default `'scheduled'` (`:162`); FK-Felder `?? null`; danach `requested(listAppointmentsRemote, 4).refreshAll()` (`:168`).
  - Verhalten Schließung (`:176-216`): jede gesetzte `status`/FK → 400 „Eine Betriebsschließung darf keine Verknüpfungen oder einen Status enthalten." (`:177-187`); `startsAt = new Date(\`${input.startsAt}T00:00:00Z\`)`, `endsAt = ...T23:59:59Z` (`:190-191`; erwartet reine `YYYY-MM-DD`-Strings); `NaN` → 400 „Bitte ein gültiges Datum angeben." (`:193`); `endsAt < startsAt` → 400 „Bis-Datum darf nicht vor dem Von-Datum liegen." (`:196`); `allDay: true`, `status: null`, FK null. **Kein** `refreshAll` im Schließungszweig (`:199-211`).
  - Fehlerfälle (beide Zweige): `catch (e) { if (e instanceof Error) error(400, e.message) }` (`:170-173`, `:212-215`) — gibt **rohe Fehlertexte** (Drizzle/Postgres, z. B. FK-Verletzung bei ungültiger `customerId`, `22P02` bei Nicht-UUID) als 400 an den Client weiter.
  - Rückgabe: die eingefügte Zeile (`CalendarEntry`).
  - Transaktion: nein (einzelner Insert).

- **`deleteCalendarEntryRemote`** — command — `calendar.remote.ts:227-234`
  - Guard: `requirePermission('calendar')`
  - Argumente: `{ id: idSchema }`
  - Verhalten: `deleteCalendarEntry(id)` (kein Existenz-Check, kein Guard bei verknüpftem Auftrag — `work_orders.appointment_id` ist `ON DELETE SET NULL`, `schema.ts:1215-1217`), dann `requested(listAppointmentsRemote, 4).refreshAll()`.
  - Rückgabe: `void`. Fehler: keine kuratierten. Transaktion: nein.

- **`getCalendarEntryRemote`** — query — `calendar.remote.ts:243-251`
  - Guard: `requirePermission('calendar')`
  - Argumente: `{ id: idSchema }`
  - Rückgabe: `CalendarEntryWithLabels` (`CalendarEntry & { customerLabel, vehicleLabel, employeeLabel }`, `calendar-service.ts:459-463`)
  - Fehler: 404 „Kalendereintrag nicht gefunden." (`:248`)

- **`updateCalendarEntryRemote`** — command — `calendar.remote.ts:263-350`
  - Guard: `requirePermission('calendar')`
  - Argumente: `{ id: idSchema, values: createInputSchema }`
  - Verhalten: lädt Bestand (`getCalendarEntry`), 404 „Kalendereintrag nicht gefunden." (`:268`); `existing.kind !== input.kind` → 400 „Die Art eines Eintrags kann nicht nachträglich geändert werden. Bitte neu anlegen." (`:269-274`); danach identische Normalisierung/Validierung wie beim Anlegen (Termin `:276-310`, Schließung `:313-349`); Termin-Zweig ruft `requested(listAppointmentsRemote, 4).refreshAll()` (`:304`), Schließungszweig nicht.
  - Fehlerfälle: wie create, inkl. Rohfehler-Leak (`:306-309`, `:345-348`).
  - Rückgabe: aktualisierte Zeile. Transaktion: nein.

- **`findOverlappingAppointmentsRemote`** — query — `calendar.remote.ts:360-378`
  - Guard: `requirePermission('calendar')`
  - Argumente: `startsAt`, `endsAt` (dateTimeStringSchema), `excludeId?: idSchema`
  - Verhalten: `new Date(...)` lokal-naiv; `NaN` → 400 „Bitte einen gültigen Zeitraum angeben." (`:371`); `e <= s` → 400 „Endzeit muss nach Startzeit liegen." (`:374`; **strikt**, anders als create/update). Liefert `findOverlappingAppointments(s, e, excludeId)`.
  - Rückgabe: `{ id, title, startsAt, endsAt }[]` sortiert nach `startsAt` (kein Limit).
  - Zweck: reine **Warnung** vor Doppelbelegung, kein Hard-Gate (`calendar-service.ts:526-539`).

- **`getWorkOrderIdForAppointmentRemote`** — query — `src/routes/orders/orders.remote.ts:265-276` (Orders-Modul, hier genutzt)
  - Guard: `requirePermission('orders')`; Argument `{ appointmentId: idSchema }`; Rückgabe `{ id } | null`.

- **`createWorkOrderFromAppointmentRemote`** — command — `orders.remote.ts:349-357` (Orders-Modul, hier genutzt)
  - Guard: `requirePermission('orders')`; ruft `createWorkOrderFromAppointment(appointmentId)` (`work-order-service.ts:574-616`): 404 „Termin nicht gefunden." (`:585`), 409 „Zu diesem Termin existiert bereits ein Auftrag." (`:596`); Nummernkreis `work_order` (`:599`); übernimmt Titel/Kunde/Fahrzeug, Mitarbeiter → Assignee, `scheduledDate`/`scheduledTime` aus `startsAt` (`scheduleFromAppointment`, `:549-567`: all-day → UTC-Datum ohne Zeit, sonst lokale Getter). Danach Board/Listen-Refresh (`:354`). Nicht transaktional (Nummer + Insert + Assignees getrennt).

- **`getDashboardKpis`** / **`getUpcomingRemote`** — query — `src/routes/dashboard.remote.ts:17-20`, `:29-32`
  - Guard: `requireUser()` (keine Modul-Permission — ein Nutzer ohne `calendar` sieht trotzdem Termin-Titel im Feed).
  - Rückgabe: `DashboardKpis` (u. a. `appointmentsToday`), `UpcomingItem[]` (max. 10, Kinds `hu_due` | `appointment`).

- **`GET /api/public/free-slots`** — HTTP GET (+ OPTIONS) — `src/routes/api/public/free-slots/endpoint.ts:42-92`, `+server.ts:12-13`
  - Guard: Bearer (`publicApi`), 401 `UNAUTHORIZED` „Missing or invalid Bearer token.", 429 `RATE_LIMITED` mit `Retry-After` (`public-api.ts:48-80`).
  - Query-Parameter:
    - `from`, `to`: Pflicht; `new Date(value)`; fehlend → 400 `Query parameter "from" is required.`; unparsebar → 400 `... is not a valid ISO datetime.` (`:21-28`). Strings ohne Zeitzone werden **server-lokal** interpretiert.
    - `durationMinutes`: Default 30; nicht-ganzzahlig/≤ 0 → 400 `durationMinutes must be a positive integer.`; > 480 → 400 `durationMinutes may not exceed 480.` (`:30-40`).
    - `service`: optional; `getItem(serviceId)`; fehlt/kein `kind='service'` → 404 `Service not found.`; `!onlineBookable` → 400 `This service is not available for online booking; please arrange it by phone.` (`:54-68`). Die Dauer wird **nicht** aus dem Service abgeleitet (Kommentar `:66-67`: JSONB `attributes` in Migration 0022 entfernt).
  - Service-Fehler → 400: `Range may not exceed 60 days.`, `"to" must be greater than or equal to "from".`, `durationMinutes must be positive.` (`:70-85`); sonst 500 `INTERNAL_ERROR`.
  - Rückgabe: `{ data: { slots: [{ startsAt: ISO-UTC, endsAt: ISO-UTC }] } }` (`:86-91`). Kein Limit (bei 60 Tagen × 35 Slots ≈ 2.100 Einträge bei 30-min-Dauer, bei 5-min-Dauer bis ~106/Tag).
  - Transaktion: nein.

- **`POST /api/public/appointments`** — HTTP POST (+ OPTIONS) — `src/routes/api/public/appointments/endpoint.ts:87-240`, `+server.ts:12-13`
  - Guard: Bearer + Rate-Limit wie oben.
  - Body-Schema (`:60-75`): `customerEmail: emailSchema` (deutsche Meldung „Bitte geben Sie eine gültige E-Mail-Adresse ein.", `validation.ts:67-72`), `customerName: nameSchema` (1..100, deutsche Meldungen), `customerPhone?: phoneSchema` (max 30), `serviceId?: string`, `startsAt: dateFromStringSchema` (→ `Date`, „Bitte geben Sie ein gültiges Datum ein."), `durationMinutes?: integer 1..480` (englische Meldungen `durationMinutes must be an integer.` / `... must be positive.` / `... is too large.`), `notes?: notesSchema`.
  - Ablauf (`:90-239`):
    1. Body nicht JSON → 400 `Request body must be valid JSON.`
    2. Valibot-Fehler → 400 `Invalid "<pfad>": <erste Meldung>` (Meldung kann deutsch sein).
    3. Kein `serviceId` → 400 `Only online-bookable services (tire change) can be booked online; please arrange other appointments by phone.`; Service fehlt/kein Service → 404 `Service not found.`; `!onlineBookable` → 400 `This service is not available for online booking; ...`; `title = service.description`.
    4. Kein `durationMinutes` → 400 `durationMinutes is required.`
    5. `startsAt <= now` → 400 `Appointment must be in the future.` (keine weitere Vorlaufzeit).
    6. Re-Check: `findFreeSlots({ from: startsAt, to: startsAt + duration + 60 s, durationMinutes })`; nur wenn ein Slot **exakt** bei `startsAt` beginnt → sonst 409 `Termin ist nicht mehr verfügbar.` (`:146-158`; deutscher Text im englischen API).
    7. Kunde: `SELECT id FROM customers WHERE email = <input> LIMIT 1` (exakt, case-sensitive, ohne `archived`-Filter, ohne ORDER BY, `:161-165`); sonst Insert mit `customerNumber = await nextCustomerNumber()`, `kind: 'regular'`, `wantsBroadcast: false`, `firstName` = Text bis zum ersten Leerzeichen, `lastName` = Rest oder `null`, `email`, `phone` (`:167-188`).
    8. Insert `calendar_entries`: `kind 'appointment'`, `title`, `startsAt`, `endsAt = startsAt + duration`, `allDay false`, `status 'scheduled'`, `customerId`, `notes = [notes?, 'confirmation:<randomUUID>'].join('\n')` (`:190-210`). `vehicleId`/`employeeId` bleiben null.
    9. `sendAppointmentConfirmation({...})` in try/catch; Fehler nur `console.error` (`:217-232`).
  - Rückgabe: `{ data: { appointmentId, startsAt (ISO), endsAt (ISO), confirmationToken } }` (`:234-239`).
  - Transaktion: **nein** — Slot-Check, Kundenanlage und Termin-Insert sind drei getrennte Statements ohne Lock (Race, siehe B-463).

## 3. Services (Server-Layer)

### `src/lib/server/services/calendar-service.ts`

- `listCalendarEvents(fromIso, toIso, employeeId?) : Promise<CalendarEvent[]>` (`:113-342`)
  - Sechs Quellen parallel per `Promise.all` (`:129-229`):
    1. `calendar_entries` mit `starts_at <= to 23:59:59Z AND ends_at >= from 00:00:00Z AND id NOT IN (SELECT appointment_id FROM work_orders WHERE appointment_id IS NOT NULL)` und — falls `employeeId` — `employee_id = ?` (`:131-153`). **Der Mitarbeiterfilter trifft die gesamte Tabelle, also auch Schließungen** (die `employee_id IS NULL` haben) → Schließungen verschwinden bei aktivem Filter (B-456).
    2. `employee_absences` mit Datumsüberlappung (+ optional `employee_id`) (`:154-163`).
    3. `getCompanyHolidayState()` (`:167`).
    4. **Alle** `employees` (id, Vor-/Nachname) für die Label-Map — kein Filter, kein Limit (`:168-174`).
    5. `vehicles` mit `archived = false AND next_hu BETWEEN from AND to` + `latestPlateSubquery()` für das Kennzeichen (`:178-198`).
    6. `work_orders` mit `scheduled_date BETWEEN from AND to`, bei Filter `id IN (SELECT work_order_id FROM work_order_assignees WHERE employee_id = ?)` (`:203-228`).
  - Mapping (`:237-341`): Termine mit `status='cancelled'` werden übersprungen (`:240`); ganztägige Termine expandieren auf jeden Tag (`expandDays`), zeitgebundene nur auf `dateToIso(startsAt)` = **UTC-Datum** (`:82`, `:244-246`); Titel = `title + ' · Vorname Nachname'` (`:252`); Schließungen → `kind 'business_closure'`, Titel `Betriebsschließung - <title>` pro Tag (`:261-273`); Abwesenheiten mit `status='cancelled'` übersprungen (`:276`), Typ → `employee_vacation`/`employee_sick`/`employee_other`, Titel `Urlaub`/`Krankheit`/`Abwesenheit` + Mitarbeiter (`:277-298`); Feiertage → `public_holiday`, `id 'hol-<date>'` (`:300-308`); HU → `hu_due`, Titel `HU: <Marke Modell> · <Kennzeichen>` (`:309-321`); Aufträge → `work_order`, `startsAt` = `new Date('<date>T<HH:MM>:00')` lokal-naiv oder `null`, `done = status === 'done'` (`:322-340`).
  - Reihenfolge der Ausgabe = Quellenreihenfolge, innerhalb der Quellen **ohne ORDER BY** (keine der sechs Queries sortiert) → Chip-Reihenfolge pro Tag nicht deterministisch (B-470).
  - Transaktion: nein. Fehler: keine kuratierten.
- `listAppointments(params: ListParams & { from?, to? }) : Promise<ListResult<AppointmentRow>>` (`:352-433`): nur `kind='appointment'`, `ilike(title, %q%)`, `starts_at >= from`, `starts_at <= to`; Left Joins `customers`, `vehicles`, `latestPlateSubquery`, `employees`; `ORDER BY starts_at ASC`, `LIMIT size OFFSET`; `count()` parallel; Labels in JS (`customerName = company ?? lastName`). Ungenutzt außerhalb Tests.
- `createCalendarEntry(values: NewCalendarEntry)` (`:437-442`): reiner Insert mit `returning()`.
- `deleteCalendarEntry(id)` (`:444-446`): `DELETE WHERE id`; Unbekannte ID = No-op.
- `getCalendarEntry(id)` (`:448-457`): `SELECT * LIMIT 1` → `row ?? null`.
- `getCalendarEntryWithLabels(id)` (`:470-512`): ein Select mit Left Joins auf `customers`, `vehicles`, `latestPlateSubquery`, `employees`; `customerLabel = company || 'Vorname Nachname' || customerNumber`; `vehicleLabel = [plate, 'Marke Modell'].join(' · ')`; `employeeLabel = 'Vorname Nachname'`.
- `updateCalendarEntry(id, values: Partial<NewCalendarEntry>)` (`:514-524`): `UPDATE ... RETURNING`; unbekannte ID → `undefined` (getestet `calendar-service.test.ts:104-110`).
- `findOverlappingAppointments(startsAt, endsAt, excludeId?)` (`:548-577`): `kind='appointment' AND starts_at < endsAt AND ends_at > startsAt AND status <> 'cancelled' [AND id <> excludeId]`, `ORDER BY starts_at`, ohne Limit. Berührende Ränder zählen nicht als Überlappung. Hinweis: `ne(status, 'cancelled')` ist bei `status IS NULL` SQL-`NULL` → solche Zeilen fallen heraus (für Termine ist `status` per Remote immer gesetzt; per Direkt-Insert/Import nicht garantiert).

### `src/lib/server/services/holiday-service.ts`

- `easterSundayIso(year)` (`:66-85`): Gauß/Meeus-Jones-Butcher, Guard 1583..4099 (sonst `Error('easterSundayIso: unsupported year …')`).
- `bussUndBettagIso(year)` (`:98-103`): Mittwoch strikt vor dem 23.11.
- Regeltabelle `HOLIDAY_RULES` (`:121-178`):
  - Bundesweit (`states: '*'`): Neujahr 01-01, Karfreitag (Ostern −2), Ostermontag (+1), Tag der Arbeit 05-01, Christi Himmelfahrt (+39), Pfingstmontag (+50), Tag der Deutschen Einheit 10-03, 1. Weihnachtsfeiertag 12-25, 2. Weihnachtsfeiertag 12-26.
  - Heilige Drei Könige 01-06: BW, BY, ST. Internationaler Frauentag 03-08: BE, MV. Ostersonntag: BB. Pfingstsonntag (+49): BB. Fronleichnam (+60): BW, BY, HE, NW, RP, SL (nicht SN/TH — nur kommunal). Mariä Himmelfahrt 08-15: nur SL (nicht BY). Weltkindertag 09-20: TH. Reformationstag 10-31: BB, HB, HH, MV, NI, SN, ST, SH, TH. Allerheiligen 11-01: BW, BY, NW, RP, SL. Buß- und Bettag: SN.
  - Nicht abgebildet (bewusst, Kommentar `:13-24`): kommunale Feiertage, Augsburger Friedensfest.
- `getPublicHolidays(year, state)` (`:195-221`): memoisiert pro `year:state` in einer `Map` mit FIFO-Eviction bei 64 Einträgen; Rückgabe eingefroren, sortiert nach Datum. `'DE'` = nur die 9 bundesweiten.
- `isPublicHoliday(dateIso, state)` (`:224-228`), `getPublicHolidaysInRange(fromIso, toIso, state)` (`:235-250`, iteriert alle berührten Jahre).
- `resolveGermanState(freeText)` (`:324-329`): normalisiert (lowercase, Umlaute → ae/oe/ue/ss, nur Buchstaben) und schlägt in `STATE_ALIASES` nach (`:267-314`: volle Namen, ISO-Codes, `nrw`, `deutschland`, `bund`); unbekannt/leer → `'DE'`.
- `getCompanyHolidayState()` (`:336-342`): `SELECT state FROM company_settings LIMIT 1` → `resolveGermanState`. `company_settings.state` ist Freitext `varchar(50)` (`schema.ts:41`). Wird bei **jedem** Aufruf (jede Monatsansicht, jede Slot-Anfrage, jede Abwesenheitsberechnung) neu gelesen — kein Cache.

### `src/lib/server/services/workshop-hours-service.ts` (Nutzung für Slots)

- `listWorkshopHours()` (`:46-66`): liest alle Zeilen, legt fehlende Wochentage lazy mit Default Mo–Fr 08:00–17:00, Sa/So geschlossen an (Insert!), normalisiert `HH:MM:SS` → `HH:MM` (Migration 0011 legte `time`-Spalten an, Schema deklariert `text`, `:24-33`).
- `updateWorkshopHours(weekday, { opensAt, closesAt, closed })` (`:78-100`): Upsert-artig (Select, dann Insert oder Update mit `updatedAt`).
- `isWithinHours(date)` (`:117-132`): Vergleich `HH:MM` lexikografisch, `opensAt` inklusiv, `closesAt` exklusiv; in den gelesenen Produktionsdateien **nirgends aufgerufen** (nur Tests) — `findFreeSlots` implementiert die Logik eigenständig.
- Seed `seedDefaultWorkshopHours()` (`seed-defaults.ts:290-304`) legt dieselben Defaults beim Setup an; `findFreeSlots` hat zusätzlich einen dritten Spiegel der Defaults (`public-api-service.ts:199-206`).

### `src/lib/server/services/public-api-service.ts` — Slot-Algorithmus

- `findFreeSlots({ from, to, durationMinutes }) : Promise<FreeSlot[]>` (`:60-196`)
  1. `durationMinutes <= 0` → `Error('durationMinutes must be positive')`; `to < from` → `Error('to must be >= from')`; Spanne > 60 Tage → `Error('range exceeds 60 days')` (`:64-73`).
  2. Öffnungszeiten: `SELECT * FROM workshop_hours` (alle), Map je Wochentag; fehlende Tage → `defaultHoursFor` (`:77-88`, `:199-206`).
  3. Blocker-Fenster `[from − 1 Tag, to + 1 Tag]` (`:92-93`); zwei Queries: Termine (`kind='appointment'`, Überlappung mit Fenster, `status` in JS gefiltert: `cancelled` ignoriert) und Schließungen (`kind='closure'`) (`:95-122`, `:140-148`); parallel `getCompanyHolidayState()`.
  4. Feiertage: `getPublicHolidaysInRange(toLocalIso(from), toLocalIso(to), state)` → `Set` (`:129-135`; `toLocalIso` = Server-Lokalzeit).
  5. Schleife tageweise ab `from` auf **lokale Mitternacht** gepinnt bis `cursor <= to` (`:165-194`): Wochentag `getDay()`; wenn `closed` oder Feiertag → Tag überspringen; sonst `dayStart = opensAt`, `dayEnd = closesAt` (lokale `setHours`); Kandidaten `t` ab `dayStart` in **15-min-Schritten** solange `t + duration <= dayEnd`; `t < from` → skip; `t + duration > to` → Abbruch des Tages; Überlappung mit einem Blocker (`t < b.end && t+dur > b.start`, `:151-156`) → skip; sonst Slot `{ startsAt, endsAt }`.
  - **Nicht berücksichtigt**: `employee_absences`, `work_orders` (`scheduled_date`), Kapazität/Mitarbeiterzahl (ein Termin blockt alles), aktuelle Uhrzeit (Slots in der Vergangenheit werden geliefert, wenn `from` in der Vergangenheit liegt), Vorlaufzeit, Puffer zwischen Terminen.
  - Komplexität: O(Tage × Slots × Blocker); Blocker-Liste ohne Index-Struktur (bei Kleinbetrieb unkritisch).
  - Zeitsemantik: alles in Server-Lokalzeit (`setHours`, `getDay`, `toLocalIso`). Kein `TZ` in `Dockerfile`/Compose gepinnt (grep ohne Treffer) → im `node:lts-slim`-Container ist das UTC, sofern die Pod-Umgebung nichts setzt (unklar, außerhalb des Repos).

### `src/lib/server/services/absence-service.ts` (nur Kalender-Bezug)

- Der Kalender liest `employee_absences` **direkt** (`calendar-service.ts:154-163`), nicht über `listAbsencesInRange` (`absence-service.ts:230-242`, ungenutzt vom Kalender).
- Feiertagsbezug: `businessDaysBetween` (`:40-58`) und `absenceWorkdays` (`:79-99`) überspringen Wochenenden und `isPublicHoliday(day, state)`; `state` kommt aus `getCompanyHolidayState()` (`:187-190`, `:257-268`, `:340`). Damit hängen Resturlaub (`remainingVacationDays`, `:293-317`) und die harte Budget-Sperre (`checkVacationBudget`, `:327-364`) an derselben Feiertagsquelle wie der Kalender und die Slots.
- Abwesenheits-Status `planned`/`approved` erscheinen im Kalender gleich (kein Unterschied), `cancelled` wird ausgeblendet (`calendar-service.ts:276`). Halbtage (`halfDay`) werden im Kalender **nicht** kenntlich gemacht (Feld wird nicht gelesen, `:275-299`).

### `src/lib/server/services/dashboard-service.ts` (Termin-Kacheln)

- `getDashboardKpis()` (`:44-125`): `appointmentsToday` = `COUNT(*)` über `kind='appointment' AND starts_at >= <UTC-heute 00:00Z> AND starts_at < <UTC-morgen> AND status <> 'cancelled'` (`:58-61`, `:100-111`). Zählt auch Termine mit verknüpftem Auftrag (die das Grid ausblendet).
- `getUpcoming()` (`:142-209`): HU (`next_hu >= heute`, `archived=false`, `ORDER BY next_hu LIMIT 20`) + Termine (`kind='appointment' AND starts_at >= <UTC-heute>`, `ORDER BY starts_at LIMIT 20`); `cancelled` erst **nach** dem LIMIT in JS gefiltert (`:198-200`); Merge, Sortierung nach `dateIso` (String), `slice(0, 10)`.

### `src/lib/server/services/mail-service.ts` — `sendAppointmentConfirmation(input)` (`:662-750`)

- Input `{ appointmentId, customerEmail, customerName?, startsAt, durationMinutes, serviceTitle?, confirmationToken }` (`:608-616`).
- Name-Split am ersten Leerzeichen → `customer` für `buildVars`; Extra-Variablen `terminDatum` (Europe/Berlin, `DD.MM.YYYY`), `terminUhrzeit` (Europe/Berlin, `HH:MM`), `terminDauer`, `leistung` (Zeile `Leistung:    …\n` oder leer), `bestaetigungsCode` (`:677-687`, Formatter `:623-642`).
- Template `appointment_confirmation` (`loadTemplate`, `:691`); Ladefehler → `{ ok: false }` ohne `sent_messages`-Zeile (`:690-696`).
- `sent_messages`-Zeile `status 'pending'`, `documentType 'appointment_confirmation'`, `documentId null` (`:708-720`); Versand über `buildTransport()` mit `from`/`replyTo` aus `smtp_settings`; danach `sent` (+ `smtpMessageId`) oder `failed` (+ `errorMessage`) (`:722-749`). Keine Anhänge.

### `src/lib/server/services/import-service.ts` (Verweis, Legacy-Termine)

- Legacy `Termine` → `calendar_entries` (`:1421-1483`): `Datum` + `Uhrzeit` → `startsAt` als **`…:00Z` (UTC)**; ohne Uhrzeit ganztägig (`00:00Z`–`23:59Z`); `UhrzeitBis` oder +1 h; Vergangenheit → `status 'completed'`, sonst `'scheduled'`; `Name`/`Mitarbeiter`/`Intervall` landen als Text in `notes`; keine FKs. Der Import löscht vorher alle `calendar_entries` (`:385`).

## 4. Komponenten (modul-lokal)

| Komponente | Datei | Zweck | Props (Name: Typ, default) | Events/Callbacks | Snippets/Slots | Interner State | Verwendete Shared-Komponenten |
|---|---|---|---|---|---|---|---|
| `CalendarForm` | `src/routes/calendar/CalendarForm.svelte` | Gemeinsames Formular für `/calendar/new` und `/calendar/[id]/edit`: Art-Wahl (nur `new`), Termin-Zweig (Ganztägig, Beginn/Ende, Status, Kunde/Fahrzeug/Mitarbeiter), Schließungs-Zweig (Von/Bis), Notiz, Klick-Zeit-Validierung, Überschneidungs-Bestätigung, Creation-Flow-Draft, Cross-Modul-Karten (nur `new`) | `mode: 'new' \| 'edit'` (Pflicht); `initial?: { id?, kind, title, allDay, startsAt: Date\|string, endsAt, status?, customerId?, customerLabel?, vehicleId?, vehicleLabel?, employeeId?, employeeLabel?, notes? }`; `onSave: (values: CalendarFormValues) => Promise<void>\|void` (Pflicht); `onCancel?: () => void`; `deleteAction?: Snippet` (`:62-86`) | `onSave(values)` (Payload-Typ `CalendarFormValues`, `:3-23`: Termin mit `startsAt/endsAt` als `YYYY-MM-DDTHH:MM` bzw. bei Ganztägig `YYYY-MM-DDT00:00`, Schließung mit reinen Datumsstrings); `onCancel()`; intern `startCreate(entity, originField, target)` → `creationFlow.start(...)` + `formDirty.clear()` + `goto('/customers/new' \| '/vehicles/new')` (`:246-266`) | `deleteAction` links in der Aktionszeile (`:581-583`) | `kind, title, allDay, startsAt, endsAt, dateFrom, dateTo, status, customerId/Label, vehicleId/Label, employeeId/Label, notes` (`:179-193`; Seed aus Draft > `initial` > Defaults: nächste volle Stunde +1 h, `:125-146`); `errorMsg` (`:217`); `overlapOpen`, `overlapList`, `pendingSave` (`:283-287`); Cycle-Guards `canCreateCustomer/Vehicle` (`:239-244`); `formDirty` via `oninput`/`onchange`, Clear bei Unmount (`:405-406`); Draft-Restore setzt `formDirty` (`:215`); Auto-Select nach Creation-Flow inkl. Halter-Sync beim Fahrzeug (`:197-213`) | `SearchablePicker` (Mitarbeiter, `:524-530`), `CustomerVehiclePicker` (`:509-521`), `ConfirmDialog` (Terminkollision, `:653-668`), Icons `ArrowRight`, `ClipboardList`, `Users2`; Stores `busy`, `formDirty`, `creationFlow` |

Seiten-Komponenten (`+page.svelte`) nutzen zusätzlich `PageHeader`, `SearchablePicker` (Filter), `ConfirmDialog` (Löschen), Icons `ChevronLeft`, `ChevronRight`, `Plus`, `ClipboardList`, `Trash2`.

## 5. Tabellen

| Tabelle | Relevante Spalten / Enums | Fundstelle |
|---|---|---|
| `calendar_entries` | `id uuid PK`, `kind varchar(20)` (Werte `'appointment'` \| `'closure'`, **kein pgEnum, kein CHECK**), `title varchar(200) NOT NULL`, `starts_at timestamptz NOT NULL`, `ends_at timestamptz NOT NULL`, `all_day boolean NOT NULL DEFAULT false`, `status varchar(20) NULL` (`'scheduled'` \| `'completed'` \| `'cancelled'`, für Schließung `NULL`), `customer_id uuid FK customers ON DELETE SET NULL`, `vehicle_id uuid FK vehicles SET NULL`, `employee_id uuid FK employees SET NULL`, `notes text`, `created_at`; Indizes `calendar_entries_kind_idx`, `calendar_entries_starts_at_idx`. **Kein `updated_at`**, kein Index auf `ends_at` (Überlappungs-Queries filtern beide Spalten). | `schema.ts:947-974`, `drizzle/0005_unified_calendar_entries.sql:1-22` (ersetzt `appointments` + `business_closures`) |
| `work_orders` | `appointment_id uuid FK calendar_entries SET NULL` mit partiellem `UNIQUE` (`work_orders_appointment_id_idx WHERE appointment_id IS NOT NULL`) — ein Auftrag je Termin; `scheduled_date date`, `scheduled_time varchar(5)` (Europe/Berlin-Wandzeit laut Kommentar; Migration 0034 konvertierte `scheduled_at AT TIME ZONE 'Europe/Berlin'`); `status` `'open'` \| `'in_progress'` \| `'done'` | `schema.ts:1199-1243`, `drizzle/0034_scheduling_docs_owner.sql:12-35` |
| `work_order_assignees` | `work_order_id`, `employee_id` (PK-Paar) — Mitarbeiterfilter für Aufträge | `schema.ts:1247-1258` |
| `employee_absences` | `employee_id FK CASCADE`, `type` (`vacation` \| `sick` \| `other`), `date_from date`, `date_to date`, `half_day`, `status` (`planned` \| `approved` \| `cancelled`, Default `approved`), `notes`, Anhang-Spalten | `schema.ts:896-925` |
| `vehicles` | `next_hu date` (Index `vehicles_next_hu_idx`), `archived` — HU-Fälligkeiten | `schema.ts:273,296` |
| `vehicle_license_plate_versions` | via `latestPlateSubquery()` für Kennzeichen-Labels | `calendar-service.ts:46,179` |
| `customers` | Labels (`company`, `firstName`, `lastName`, `customerNumber`), `email` (Public-Booking-Matching), Anlage durch Booking (`kind 'regular'`, `wantsBroadcast false`) | `calendar-service.ts:477-480`, `appointments/endpoint.ts:161-188` |
| `employees` | `firstName`, `lastName`, `personnelNumber`, `archived` (Picker) | `calendar-service.ts:169-174`, `pickers.remote.ts:316-349` |
| `company_settings` | `state varchar(50) NOT NULL DEFAULT ''` (Freitext, Bundesland) | `schema.ts:41`, `holiday-service.ts:336-342` |
| `workshop_hours` | `weekday int PK (0=So..6=Sa)`, `opens_at text DEFAULT '08:00'`, `closes_at text DEFAULT '17:00'` (physisch `time`, siehe `workshop-hours-service.ts:24-33`), `closed boolean`, `updated_at` | `schema.ts:1761-1769` |
| `public_holidays` | `state`, `date`, `name` — **dormant**: wird weder gelesen noch geschrieben (Kommentar `holiday-service.ts:2-5`), Typen `PublicHoliday`/`NewPublicHoliday` existieren weiter | `schema.ts:977-982`, `:1956-1957` |
| `items` | `kind = 'service'`, `onlineBookable`, `description` (Titel des Online-Termins) | `appointments/endpoint.ts:123-133` |
| `sent_messages` | `document_type 'appointment_confirmation'`, `status pending/sent/failed`, `recipient_email`, `subject`, `body_text`, `error_message`, `smtp_message_id` | `mail-service.ts:708-749` |
| `mail_templates` | Key `appointment_confirmation` (Seed) | `seed-defaults.ts:116-131` |
| `number_ranges` | Kundennummer via `nextCustomerNumber()` bei Online-Buchung | `appointments/endpoint.ts:174` |

## 6. Flows (durchgängig, Start bis Ende)

- **Monat ansehen** — Sidebar "Kalender" (`/calendar`) → Monatsraster des aktuellen Monats (UTC-basiert, `+page.svelte:12-14`) → Zurück/Heute/Weiter (`:186-201`, `:226-234`) → Chips klicken.
  - Leerzustand: Grid zeigt leere Zellen (kein Hinweistext); Agenda (< `lg`) zeigt „Keine Einträge in diesem Monat." (`:319-322`).
  - Ladezustand: globaler `busy`-Balken (Remote-Query); Stale-while-revalidate hält den letzten Monat sichtbar (`:47-55`).
  - Validierungsfehler: keine Eingaben.
  - Fehlerzustand: `handleClientError(q.error)` als Toast (`:51`); initialer Fehler → `+error.svelte`.
  - Abbruchpfade: –.
  - Berechtigungs-Verweigerung: ohne `calendar` fehlt der Sidebar-Eintrag; direkter Aufruf → 403 aus `requirePermission` → `+error.svelte`.
  - Klickziele (`:71-96`): Termin/Schließung → `/calendar/{id}/edit`; HU → `/vehicles/{id}`; Auftrag → `/orders/{id}`; Urlaub/Krankheit/Sonstiges → `/employees/{employeeId}`; Feiertag nicht klickbar (`<span>`).
  - Darstellung: Tageszelle mit Tagesnummer, max. 3 Chips + „+N weitere" (Tooltip mit allen Titeln, `:301-308`); Nachbarmonatstage `bg-base-200 opacity-60` (`:272-273`); Farben je Kind (`:142-164`): Feiertag `bg-error/10 text-error`, Schließung `bg-base-300`, Urlaub `bg-info/10`, Krankheit `bg-warning/10`, Sonstiges `bg-neutral/10`, HU `bg-warning/15`, Auftrag `bg-secondary/10` bzw. erledigt `bg-secondary/5 line-through`, Termin `bg-primary/10 text-primary`. **Keine Uhrzeit** im Chip (nur `ev.title`), keine Legende, kein Wochen-/Tagesmodus.

- **Nach Mitarbeiter filtern** — Toolbar-Picker „Alle Mitarbeiter" / Dialog „Mitarbeiter filtern" (`:235-245`) → Auswahl → Query mit `employeeId` (`:34-41`).
  - Wirkung: Termine mit diesem `employee_id`, Abwesenheiten des Mitarbeiters, Aufträge mit Zuweisung; Feiertage und HU bleiben; **Schließungen verschwinden** (B-456).
  - Leerzustand: wie oben. Fehler: 403-Toast, wenn der Nutzer weder `employees` noch `orders` hat (B-474).
  - Abbruch: Picker-„×" setzt `employeeId=''`.

- **Termin anlegen** — „Termin hinzufügen" (`/calendar/new`) → Art „Termin" (Default) → Titel*, Ganztägig (Checkbox), Beginn*/Ende* (`datetime-local`, bei Ganztägig `date`), Status (Geplant/Abgeschlossen/Abgesagt), Kunde/Fahrzeug (`CustomerVehiclePicker`), Mitarbeiter (`SearchablePicker`), Notiz (max 2000) → „Speichern" → ggf. Dialog „Terminkollision" → `createCalendarEntryRemote` → Toast „Termin angelegt." → `goto('/calendar')`.
  - Defaults: Beginn = nächste volle Stunde, Ende = +1 h (`CalendarForm.svelte:125-128`), Status `scheduled`.
  - Ladezustand: `busy.run` um Overlap-Check und Save; Speichern-Button mit Spinner, `disabled={busy.active}` (`:595-600`).
  - Validierungsfehler (Klick-Zeit, `alert alert-error` oben, `:417-421`): „Bitte einen Titel angeben." (`:313-316`); „Bitte Beginn und Ende angeben." (`:319-322`); zeitgebunden `end <= start` → „Endzeit muss nach Startzeit liegen." (`:325-328`); ganztägig `endDate < startDate` → „Bis-Datum darf nicht vor dem Von-Datum liegen." (`:329-332`). Keine Feld-Markierung, nur die Summary. Server-Fehler (400) → Toast via `handleClientError` (`new/+page.svelte:30-32`).
  - Überschneidung: `findOverlappingAppointmentsRemote` mit `excludeId: initial?.id` (`:357-363`); Treffer → `ConfirmDialog` Titel „Terminkollision", Text „In diesem Zeitfenster gibt es bereits N Termin(e):\n  • <Titel> (<dd.mm.yyyy, hh:mm> bis <…>)\n\nTrotzdem speichern?", Buttons „Trotzdem speichern" / „Abbrechen" (`:301-307`, `:653-668`). Lookup-Fehler werden verschluckt → speichert ohne Warnung (`:375-377`). **Bei ganztägigen Terminen** sendet das Formular `T00:00` für beide Grenzen → Remote wirft 400 (`e <= s`) → verschluckt → nie eine Warnung (B-460).
  - Abbruchpfade: „Abbrechen" → `/calendar` (Unsaved-Changes-Guard über `formDirty`); Dialog „Abbrechen" → `pendingSave = null`, Formular bleibt.
  - Creation-Flow: Picker-Header „Neu anlegen" → Draft in `creationFlow` → `/customers/new` bzw. `/vehicles/new` (Fahrzeug nur mit gewähltem Kunden; `leafInitial` Halter) → zurück mit Auto-Select (`:197-213`); Cycle-Guard über `activeEntities()` (`:239-244`).
  - Berechtigungs-Verweigerung: `calendar` fehlt → 403 beim Speichern; Picker verlangen fremde Rechte (B-474).

- **Betriebsschließung anlegen** — `/calendar/new` → Art „Betriebsschließung" → Titel*, Von*/Bis* (`date`), Notiz → „Speichern" → `createCalendarEntryRemote({ kind:'closure', ... })` → Toast „Betriebsschließung angelegt." → `/calendar`.
  - Hinweistext im Formular: „Mehrtägige Schließungen werden in einem Eintrag gespeichert. Die Tage erscheinen automatisch im Kalender und in den Konfliktwarnungen beim Anlegen neuer Termine." (`:538-542`). **Achtung:** `findOverlappingAppointments` prüft nur `kind='appointment'` (`calendar-service.ts:554`) — Schließungen erzeugen **keine** Konfliktwarnung im internen Formular (nur die Public-API-Slots berücksichtigen sie). Text ist falsch (B-478).
  - Validierung: „Bitte Von- und Bis-Datum angeben." (`:384-387`), „Bis-Datum darf nicht vor dem Von-Datum liegen." (`:388-391`); kein Overlap-Check.
  - Server: Status/FK gesetzt → „Eine Betriebsschließung darf keine Verknüpfungen oder einen Status enthalten."

- **Eintrag bearbeiten** — Chip-Klick → `/calendar/{id}/edit` → Formular vorbefüllt (Labels aus `getCalendarEntryWithLabels`) → „Speichern" → ggf. „Terminkollision" → `updateCalendarEntryRemote` → Toast „Termin gespeichert." / „Betriebsschließung gespeichert." → `/calendar`.
  - Art-Wechsel nicht möglich (kein Select in `edit`, Server 400 bei Abweichung).
  - Fehler 404 beim Laden → `+error.svelte`.
  - Ganztägige Einträge werden mit `toISOString().slice(0,10)` (UTC) befüllt, zeitgebundene mit lokalen Gettern `fmtLocalIso` (`CalendarForm.svelte:88-89`, `:98-109`).

- **Eintrag löschen** — Edit-Seite → Button „Löschen" (links, `btn-ghost text-error`) → `ConfirmDialog` Titel „Eintrag löschen?", Text „Der Eintrag wird unwiderruflich gelöscht.", Bestätigung „Löschen" (`variant danger`) → `deleteCalendarEntryRemote` → Toast „Eintrag gelöscht." → `/calendar` (`edit/+page.svelte:87-99`, `:136-157`).
  - Kein Guard bei verknüpftem Auftrag (der Auftrag verliert seinen Termin-Link still, B-473).

- **Termin → Auftrag** — Edit-Seite eines Termins (nur mit `orders`-Recht, Probe `:43-56`) → „Auftrag erstellen" → `createWorkOrderFromAppointmentRemote` → Toast „Auftrag angelegt." → `goto('/orders/{id}')`; existiert schon einer → Link „Zum Auftrag" (`:109-128`).
  - Fehler: `handleClientError(err, 'Auftrag konnte nicht angelegt werden')` (409 „Zu diesem Termin existiert bereits ein Auftrag.", 404 „Termin nicht gefunden.").
  - Danach verschwindet der Termin-Chip aus dem Kalender (Auftrag-Chip ersetzt ihn); der Termin bleibt über die Auftrags-Detailseite erreichbar (`orders/[id]/+page.svelte:489-495`).

- **Cross-Modul-Hinweise auf `/calendar/new`** — zwei Karten unter dem Formular (`CalendarForm.svelte:606-651`): „Werkstattauftrag" (Text „Werkstattarbeiten werden als Auftrag angelegt. …", Button „Neuer Auftrag" → `/orders/new`) und „Urlaub & Krankheit" (Text „Mitarbeiter-Abwesenheiten werden direkt im Mitarbeiter-Datenblatt gepflegt …", Button „Zu den Mitarbeitern" → `/employees`). Nur in `new`.

- **Freie Slots abfragen (extern)** — Website ruft `GET /api/public/free-slots?from=…&to=…&durationMinutes=…[&service=…]` mit Bearer → Antwort `{ data: { slots: [...] } }`.
  - Fehler: 401/429 (Wrapper), 400 (Parameter, 60-Tage-Grenze, Dauer), 404 (Service), 500 mit `INTERNAL_ERROR`.

- **Termin buchen (extern)** — Website `POST /api/public/appointments` → Ablauf Abschnitt 2 → Antwort `{ appointmentId, startsAt, endsAt, confirmationToken }`; Termin erscheint im Kalender als Chip mit Titel = Service-Beschreibung (z. B. „Reifenwechsel") und Kunde verknüpft; Bestätigungsmail an den Kunden (best effort, Protokoll in `sent_messages`).
  - Kein Status „angefragt": sofort `scheduled`. Keine interne Benachrichtigung an den Betrieb. Keine Storno-/Lookup-Möglichkeit über das Token.

- **Dashboard-Kacheln** — `/` → „Termine heute" (Zahl) und „Anstehende Termine" (max. 10 Zeilen HU + Termine, Datum `dd.mm.yyyy`); Leerzustand „Aktuell keine anstehenden HU-Termine oder Werkstatt-Termine." (`+page.svelte:135-138`); Termin-Zeilen verlinken auf `/calendar` (nicht auf den Eintrag, `:149-151`), HU auf `/vehicles/{id}`.

- **Öffnungszeiten pflegen** — `/settings/workshop-hours` → Tabelle 7 Zeilen (Wochentag, Öffnet, Schließt, Geschlossen-Toggle) → „Speichern" → 7 sequenzielle Commands → Toast „Öffnungszeiten gespeichert." / Fehler „Öffnungszeiten konnten nicht gespeichert werden" (`+page.svelte:62-84`). Server-Regel: offener Tag braucht `opensAt < closesAt` → „Die Öffnungszeit muss vor der Schließzeit liegen." (`workshop-hours.remote.ts:42-53`).

## 7. Nebenwirkungen

- **E-Mail**: `appointment_confirmation` an `customerEmail` nach erfolgreicher Public-Buchung (Trigger `appointments/endpoint.ts:217-232`); Vorlage `seed-defaults.ts:116-131` (Betreff „Ihre Terminbestätigung bei {firma}", Body mit `{terminDatum}`, `{terminUhrzeit} Uhr`, `{terminDauer} Minuten`, `{leistung}`, `{bestaetigungsCode}`); Absender/Reply-To aus `smtp_settings`; Protokoll in `sent_messages` (`pending` → `sent`/`failed`). Keine Mails bei internen Termin-Operationen, keine Termin-Erinnerungen, keine interne Benachrichtigung bei Online-Buchung.
- **PDFs**: keine.
- **Uploads**: keine (Abwesenheits-Anhänge gehören zum Employees-Modul).
- **Exporte**: keine (kein iCal/ICS, kein CSV).
- **Externe APIs**: keine ausgehenden. Eingehend: `GET /free-slots`, `POST /appointments` (Bearer, CORS `*`, `public-api.ts:132-141`).
- **Webhooks**: keine.
- **Nummernkreise**: `customer` bei Kundenanlage durch Online-Buchung (`nextCustomerNumber()`, `appointments/endpoint.ts:174`); `work_order` bei „Auftrag erstellen" (`work-order-service.ts:599`).
- **Refresh**: Mutationen rufen `requested(listAppointmentsRemote, 4).refreshAll()`; der Client deklariert nirgends `.updates(...)`; die Grid-Query `listCalendarEventsRemote` wird nie refreshed — Aktualität entsteht nur durch `goto('/calendar')` nach jeder Mutation (Cache-Release beim Unmount).
- **Seed**: `seedDefaultWorkshopHours()` beim Setup (`seed-defaults.ts:234,290-304`); Lazy-Insert fehlender Wochentage bei `listWorkshopHours()` (Lese-Pfad mit Schreib-Nebenwirkung, `workshop-hours-service.ts:53-62`).
- **Legacy-Import**: löscht und befüllt `calendar_entries` (`import-service.ts:385`, `:1421-1483`).

## 8. Vorhandene Tests

| Testdatei | Art | Was wird abgedeckt (1 Zeile) |
|---|---|---|
| `src/routes/calendar/CalendarForm.test.ts` (260 Z.) | component | Art-Select nur in `new`, Speichern nie disabled, Titel-Pflicht, Payload-Trim, `excludeId` im Edit, Kollisions-Dialog + „Trotzdem speichern", Schließung ohne Overlap-Check, getrennte Cross-Modul-Karten, Bis<Von-Fehler |
| `src/lib/server/services/calendar-service.test.ts` (777 Z.) | integration (pg-mem) | CRUD, Multi-Source-Merge (Termin/Schließung/Abwesenheit/Feiertag NRW), cancelled-Skip, sick/other, Mitarbeiterfilter (Entries+Absences+Orders), Feiertage 2033/Jahreswechsel, leerer Monat, Aufträge (timed/timeless/done/Termin-born mit Ausblendung), `listAppointments` (Paging/Suche/Datum), Overlap-Varianten inkl. back-to-back, excludeId, cancelled, closures ignoriert. **`hu_due` per `it.skip`** (pg-mem-Limitierung, `:249-254`). |
| `src/lib/server/services/holiday-service.test.ts` (346 Z.) | unit/integration | Oster-Known-Answers 2000–2049, 300-Jahre-Invariante, Range-Guard, Berlin-2026-Vollset, Retired-Seed-Reproduktion, BY/SL/TH/BB/SN-Spezifika, Reformationstag-Menge, Zählertabelle je Land, Buß- und Bettag 2026–2033, Jahresgrenzen, Resolver-Toleranz, Memo/Eviction, `getCompanyHolidayState` |
| `src/lib/server/services/public-api-service.test.ts` (256 Z.) | integration (pg-mem) | Slots: geschlossene Tage, 15-min-Raster (35 Slots/Tag), Termin-Blocker, cancelled ignoriert, Schließung, Feiertag (Pfingstmontag), Bundesland-Abhängigkeit (Fronleichnam NRW vs. Berlin), Mehrtagesbereich, 60-Tage-Grenze, Dauer ≤ 0, `to < from`, Freitag 09–13 |
| `src/lib/server/services/workshop-hours-service.test.ts` (174 Z.) | integration | Lazy-Create 7 Zeilen, Idempotenz, Update/Insert, `isWithinHours`-Grenzen und Defaults |
| `src/routes/settings/workshop-hours/workshop-hours.remote.test.ts` (159 Z.) | integration | 401/403-Guards, gültiges Update, invertierter/leerer Bereich mit deutscher Meldung, geschlossener Tag ignoriert Zeiten |
| `src/lib/server/services/absence-service.test.ts` (897 Z.) | integration | u. a. Feiertags-Skip in Arbeitstagen (2031, Bundesland/Federal-Fallback) — Kalenderbezug nur indirekt |
| `src/routes/api/public/public-api.test.ts` (Abschnitte `:421-685`) | integration | free-slots: fehlende Parameter → 400, 35 Slots, > 60 Tage → 400; appointments: Buchung mit Kundenanlage + Mail-Payload, nicht buchbarer Service → 400, belegter Slot → 409, Vergangenheit → 400, Kunden-Wiederverwendung per E-Mail, ohne `serviceId` → 400 |
| `e2e/calendar.spec.ts` (132 Z.) | e2e (Playwright) | Feiertags-Chip „Tag der Arbeit" Mai 2026 (bis 26 Monate zurück), kein „Neuer Auftrag" auf `/calendar`, zwei Karten auf `/calendar/new`, Termin anlegen mit Mitarbeiter → Chip → Filter → Löschen → Cleanup |
| – | – | **Fehlend**: kein `calendar.remote.test.ts` (Schemas, Normalisierung, Kind-Wechsel-Sperre, Rohfehler-Pfad), kein `dashboard-service.test.ts`, kein Endpoint-Test in `free-slots/`/`appointments/` selbst (nur Sammeltest), kein Test der Race-Bedingung, kein Test für `+page.svelte` (Grid-Mathematik, Agenda, Klickziele). |

## 9. Feature-Matrix

| ID | Feature | Routen | Endpoints/Remotes | Tabellen | Erwartetes Verhalten |
|---|---|---|---|---|---|
| F-527 | Monatsraster (Desktop ≥ `lg`) | `/calendar` | `listCalendarEventsRemote` | `calendar_entries`, `employee_absences`, `vehicles`, `work_orders`, `company_settings` | 7 Spalten Mo–So, immer 42 Zellen ab dem Montag vor dem 1. (`+page.svelte:115-130`); Nachbarmonatstage gedimmt; je Zelle Tagesnummer + max. 3 Chips + „+N weitere" (Tooltip); Chips `truncate` mit `title`-Attribut; Zeitraum der Query = `YYYY-MM-01` bis Monatsletzter (`:24-31`). |
| F-528 | Agenda-Liste (Mobil < `lg`) | `/calendar` | dito | dito | Nur In-Monat-Tage mit Events, Überschrift `weekday, dd.mm.yyyy` (de-DE, UTC), Chips als Buttons/Spans untereinander (`:171-184`, `:317-353`); Leerzustand „Keine Einträge in diesem Monat.". |
| F-529 | Monatsnavigation | `/calendar` | – | – | Join-Buttons „Zurück" (aria-label), „Heute", „Weiter"; Monatslabel deutsch „<Monat> <Jahr>" rechts (`:99-113`, `:246-249`); „Heute" springt auf den beim Mount ermittelten UTC-Monat; kein Deep-Link, kein Browser-History-Eintrag je Monat. |
| F-530 | Mitarbeiterfilter | `/calendar` | `pickEmployeesRemote` (`employees` \| `orders`), `listCalendarEventsRemote` | `employees`, `work_order_assignees` | `SearchablePicker` (Placeholder „Alle Mitarbeiter", Dialog „Mitarbeiter filtern", `triggerSize sm`); Filter reduziert Termine (`employee_id`), Abwesenheiten, Aufträge (Assignee); Feiertage/HU bleiben; Schließungen fallen weg (Ist-Verhalten, B-456). Suche über Vor-/Nachname, Personalnummer, Position, private E-Mail/Telefon, Mobil; nur `archived=false`; 25/Seite. |
| F-531 | Event-Quellen, Farben, Klickziele | `/calendar` | `listCalendarEventsRemote` | s. o. | 8 Kinds: `appointment` (primary, Titel + „ · Vorname Nachname", nur wenn nicht `cancelled` und ohne Auftrag), `business_closure` (base-300, „Betriebsschließung - <Titel>", jeder Tag), `employee_vacation`/`employee_sick`/`employee_other` (info/warning/neutral, „Urlaub/Krankheit/Abwesenheit · Name", jeder Tag, nicht `cancelled`), `public_holiday` (error, Name, nicht klickbar), `hu_due` (warning, „HU: Marke Modell · Kennzeichen", nur `archived=false`), `work_order` (secondary; `done` → gedimmt + durchgestrichen; alle Status). Klick: Termin/Schließung → Edit, HU → Fahrzeug, Auftrag → Auftrag, Abwesenheit → Mitarbeiter. Keine Uhrzeiten, keine Legende. |
| F-532 | Stale-while-revalidate | `/calendar` | `listCalendarEventsRemote` | – | Letztes Ergebnis bleibt bei Monats-/Filterwechsel sichtbar (`lastEvents`, `:47-55`); Fehler → Toast. |
| F-533 | Termin anlegen | `/calendar/new` | `createCalendarEntryRemote`, `findOverlappingAppointmentsRemote` | `calendar_entries` | Felder: Art (Termin/Betriebsschließung), Titel* (max 200), Ganztägig, Beginn*, Ende*, Status (Geplant/Abgeschlossen/Abgesagt), Kunde, Fahrzeug, Mitarbeiter, Notiz (max 2000). Defaults nächste volle Stunde / +1 h / Geplant. Toast „Termin angelegt.", danach `/calendar`. Server: `endsAt >= startsAt`, lokal-naives Parsen. |
| F-534 | Ganztägiger Termin | `/calendar/new`, `/calendar/[id]/edit` | create/update | `calendar_entries` | Checkbox schaltet Inputs auf `type=date`; Formular sendet `YYYY-MM-DDT00:00`; Server pinnt `00:00:00Z`–`23:59:59Z`; Grid expandiert auf alle Tage; Edit liest UTC-Datum zurück. Mehrtägig erlaubt (`endDate >= startDate`). Keine Kollisionswarnung (B-460). |
| F-535 | Termin-Status | `/calendar/[id]/edit` | update | `calendar_entries.status` | Select Geplant/Abgeschlossen/Abgesagt; `cancelled` → Chip verschwindet aus Grid, blockiert keine Slots, löst keine Kollisionswarnung aus, zählt nicht im Dashboard; `completed` wird wie `scheduled` gerendert (keine visuelle Unterscheidung, `eventClass` default). Kein Status-Übergangs-Regelwerk (jeder Wechsel erlaubt, auch rückwärts). |
| F-536 | Verknüpfungen Kunde/Fahrzeug/Mitarbeiter inkl. Creation-Flow | `/calendar/new`, `/calendar/[id]/edit` | `pickCustomersRemote` (`customers`), `pickCustomerVehiclesRemote` (`vehicles`), `pickEmployeesRemote` | `customers`, `vehicles`, `employees` | `CustomerVehiclePicker`: Fahrzeug zuerst → Halter wird Kunde; Kunde zuerst → Fahrzeugsuche eingeschränkt; „Neu anlegen" im Picker-Header → Draft speichern → `/customers/new` bzw. `/vehicles/new` (nur mit Kunde, Halter vorbelegt) → Rückkehr mit Auto-Select und Halter-Sync; Cycle-Guard. Mitarbeiter über `SearchablePicker` „Mitarbeiter auswählen" (kein „Neu anlegen"). Alle optional. Server prüft nicht, dass Fahrzeug zum Kunden gehört. |
| F-537 | Überschneidungswarnung | `/calendar/new`, `/calendar/[id]/edit` | `findOverlappingAppointmentsRemote` | `calendar_entries` | Vor dem Speichern eines zeitgebundenen Termins: andere nicht-abgesagte Termine mit `starts_at < end AND ends_at > start` (Randberührung erlaubt), eigener Eintrag ausgeschlossen; Dialog „Terminkollision" mit Liste (dd.mm.yyyy, hh:mm bis …) und „Trotzdem speichern"/„Abbrechen"; Lookup-Fehler → stilles Speichern. Kein Hard-Gate; Schließungen, Abwesenheiten, Aufträge werden nicht geprüft. |
| F-538 | Betriebsschließung anlegen/bearbeiten | `/calendar/new`, `/calendar/[id]/edit` | create/update (`kind:'closure'`) | `calendar_entries` | Von*/Bis* (`date`), Titel*, Notiz; immer `all_day=true`, `status=null`, keine FKs (Server 400 bei Verstoß); Grenzen `00:00:00Z`–`23:59:59Z`; Grid-Chip je Tag; blockiert Public-Slots vollständig; Toast „Betriebsschließung angelegt."/„… gespeichert.". |
| F-539 | Eintrag bearbeiten | `/calendar/[id]/edit` | `getCalendarEntryRemote`, `updateCalendarEntryRemote` | `calendar_entries` (+ Label-Joins) | Formular vorbefüllt inkl. Picker-Labels; Art nicht änderbar (Server: „Die Art eines Eintrags kann nicht nachträglich geändert werden. Bitte neu anlegen."); 404 → Fehlerseite; Toast „Termin gespeichert."; Rückkehr `/calendar`. |
| F-540 | Eintrag löschen | `/calendar/[id]/edit` | `deleteCalendarEntryRemote` | `calendar_entries` | Button „Löschen" → `ConfirmDialog` „Eintrag löschen?" / „Der Eintrag wird unwiderruflich gelöscht." → Toast „Eintrag gelöscht." → `/calendar`. Kein Guard; verknüpfter Auftrag verliert `appointment_id` (SET NULL). |
| F-541 | Termin → Auftrag | `/calendar/[id]/edit` | `getWorkOrderIdForAppointmentRemote`, `createWorkOrderFromAppointmentRemote` (`orders`) | `work_orders`, `work_order_assignees`, `number_ranges` | Nur für Termine und nur mit `orders`-Recht (Probe; Fehler → Aktionen verborgen, `console.info`); „Auftrag erstellen" → Auftrag mit Titel/Kunde/Fahrzeug/Assignee/`scheduledDate`+`scheduledTime` → Toast „Auftrag angelegt." → `/orders/{id}`; ab dann „Zum Auftrag"; ein Auftrag je Termin (409). Termin-Chip wird durch Auftrags-Chip ersetzt. |
| F-542 | Cross-Modul-Karten | `/calendar/new` | – | – | Zwei getrennte Cards „Werkstattauftrag" (→ `/orders/new`) und „Urlaub & Krankheit" (→ `/employees`) unter dem Formular, nur im `new`-Modus; nie im Formular selbst. Auf `/calendar` bewusst kein „Neuer Auftrag". |
| F-543 | Unsaved-Changes-Guard | `/calendar/new`, `/calendar/[id]/edit` | – | – | `formDirty` über `oninput`/`onchange`; `clear()` vor `goto` nach Erfolg (create/update/delete/createOrder), bei Fehler bleibt dirty; Draft-Restore re-armed; Creation-Flow-Absprung räumt den Guard. |
| F-544 | Feiertage algorithmisch | `/calendar` (und Slots, Abwesenheiten) | `listCalendarEventsRemote` | `company_settings.state` | Gauß-Osterformel, Regeltabelle (Abschnitt 3), Bundesland aus Freitext toleranter Resolver, Fallback `'DE'` (9 bundesweite); Memo 64 Einträge; kein Jahreslimit (1583–4099). Feiertage sind reine Anzeige (nicht klickbar) und Blocker in Slots/Arbeitstagen. Kommunale Feiertage nicht abgebildet; keine manuellen Zusatz-/Ausnahmetage. |
| F-545 | Feiertage in Arbeitstagen (Abwesenheiten) | `/employees/[id]` (Employees-Modul) | – | `employee_absences`, `employees.vacationDaysPerYear` | Arbeitstage = Mo–Fr minus Feiertage des Bundeslandes; Halbtag 0,5; Resturlaub und harte Budget-Sperre nutzen dieselbe Quelle (`absence-service.ts:40-58`, `:327-364`). |
| F-546 | Abwesenheiten im Kalender | `/calendar` | `listCalendarEventsRemote` | `employee_absences` | Direkt-Read; `planned` und `approved` gleich dargestellt, `cancelled` ausgeblendet; ein Chip je Tag; Halbtag nicht kenntlich; Klick → `/employees/{employeeId}` (Bearbeitung nur dort). |
| F-547 | HU-Fälligkeiten im Kalender | `/calendar` | `listCalendarEventsRemote` | `vehicles.next_hu`, `vehicle_license_plate_versions` | Chip „HU: Marke Modell · Kennzeichen" am `next_hu`-Tag, nur nicht-archivierte Fahrzeuge, nicht vom Mitarbeiterfilter betroffen; Klick → `/vehicles/{id}`. |
| F-548 | Aufträge im Kalender | `/calendar` | `listCalendarEventsRemote` | `work_orders`, `work_order_assignees` | Alle Aufträge mit `scheduled_date` im Monat, unabhängig vom Status; `done` gedimmt/durchgestrichen; `scheduled_time` nur als `startsAt` im Payload (nicht angezeigt); Termin-geborene Aufträge ersetzen den Termin-Chip; Mitarbeiterfilter über Assignees; Klick → `/orders/{id}`. |
| F-549 | Öffnungszeiten (Slot-Grundlage) | `/settings/workshop-hours` | `listWorkshopHoursRemote`, `updateWorkshopHoursRemote` (`settings`) | `workshop_hours` | 7 Wochentage, `HH:MM`, Geschlossen-Toggle; Regel `opensAt < closesAt` für offene Tage; Defaults Mo–Fr 08–17, Sa/So zu; Seed beim Setup + Lazy-Create beim Lesen. |
| F-550 | Freie Slots (extern) | `GET /api/public/free-slots` | `findFreeSlots` | `workshop_hours`, `calendar_entries`, `company_settings` | Parameter/Fehler s. Abschnitt 2; Algorithmus s. Abschnitt 3: 15-min-Raster innerhalb Öffnungszeiten, minus nicht-abgesagte Termine und Schließungen (alle, ohne Kapazität), minus Feiertage; max. 60 Tage; Slots müssen komplett in `[from, to]` liegen; Ausgabe ISO-UTC. Vergangene Slots werden nicht herausgefiltert. |
| F-551 | Terminbuchung (extern) | `POST /api/public/appointments` | `findFreeSlots`, `getItem`, `nextCustomerNumber`, `sendAppointmentConfirmation` | `items`, `customers`, `calendar_entries`, `number_ranges`, `sent_messages` | Nur `onlineBookable` Services (Pflicht), `durationMinutes` Pflicht, Start > jetzt, Start muss exakt ein freier Raster-Slot sein (sonst 409), Kunde per E-Mail exakt gematcht oder neu (`regular`, Name-Split am ersten Leerzeichen), Termin `scheduled` mit Titel = Service-Beschreibung, `notes` = Kundennotiz + `confirmation:<uuid>`, Antwort mit Token; keine Transaktion; keine Fahrzeug-/Mitarbeiterzuordnung. |
| F-552 | Bestätigungsmail | (Trigger aus F-551) | `sendAppointmentConfirmation` | `mail_templates`, `smtp_settings`, `sent_messages` | Vorlage `appointment_confirmation` mit Datum/Uhrzeit in Europe/Berlin, Dauer, Leistung, Bestätigungs-Code; best effort; Fehler nur im Log + `sent_messages.failed`. |
| F-553 | Dashboard-Terminkacheln | `/` | `getDashboardKpis`, `getUpcomingRemote` (`requireUser`) | `calendar_entries`, `vehicles` | KPI „Termine heute" (UTC-Tag, nicht `cancelled`); Karte „Anstehende Termine" (max. 10 aus 20 HU + 20 Terminen, ab heute, sortiert nach Datum; Termin-Link → `/calendar`, HU-Link → Fahrzeug); Leerzustand-Text; Link „Kalender öffnen →". |
| F-554 | Paginierte Terminliste (Backend vorhanden, keine UI) | – | `listAppointmentsRemote` | `calendar_entries` + Joins | Suche im Titel, Datumsfilter auf `starts_at`, `ORDER BY starts_at`, Größen 10/25/50/100. In keiner Seite verwendet; einzige Möglichkeit, abgesagte Termine zu finden, existiert somit nicht im UI. |
| F-555 | Legacy-Import von Terminen | `/settings/import` (Import-Agent) | `importMdb` | `calendar_entries` | Legacy `Termine` → Termine mit UTC-Zeiten, ganztägig ohne Uhrzeit, vergangene als `completed`, Zusatzfelder in `notes`; Import löscht Bestand vorher. |
| F-556 | Zugriff/Permission | alle `/calendar*` | alle Kalender-Remotes | – | Ein Modul-Key `calendar` (Sidebar + jede Remote); Dashboard-Feed nur `requireUser()`; Public-Endpunkte Bearer; Auftragsaktionen zusätzlich `orders`; Picker zusätzlich `customers`/`vehicles`/`employees\|orders`. |

## 10. Befunde

| ID | Beschreibung | Fundstelle | Auswirkung | Empfehlung | Einordnung | Betroffene Features |
|---|---|---|---|---|---|---|
| B-456 | Mitarbeiterfilter blendet Betriebsschließungen aus: `eq(calendarEntries.employeeId, employeeId)` gilt für die ganze `calendar_entries`-Query, Schließungen haben `employee_id NULL`. Kommentar in der Page (`+page.svelte:16-20`) und `docs/modules/calendar.md:47-50` behaupten das Gegenteil. Kein Test deckt es ab. | `src/lib/server/services/calendar-service.ts:145-153` | Bei aktivem Filter fehlen Schließungen im Grid → Nutzer plant Termine auf Betriebsurlaub. | Filter nur auf `kind='appointment'` anwenden (`or(eq(kind,'closure'), eq(employeeId, …))`). | im Rewrite beheben | F-530, F-538 |
| B-457 | Abgesagte Termine sind im UI unerreichbar: Grid blendet `cancelled` aus (`:240`), es gibt keine Terminliste (F-554 ungenutzt), keine Detailseite, keine Suche. Ein versehentlich auf „Abgesagt" gesetzter Termin kann nicht mehr geöffnet/gelöscht werden (außer über einen verknüpften Auftrag). | `calendar-service.ts:240`; `calendar.remote.ts:115-118` (ungenutzt) | Datenverlust aus Nutzersicht; keine Historie abgesagter Termine sichtbar. | Terminliste mit Status-Filter einführen oder abgesagte Termine gedimmt/durchgestrichen im Grid rendern (analog `done`-Aufträge). | im Rewrite beheben | F-535, F-554 |
| B-458 | Single-Flight-Refresh ist wirkungslos: alle Mutationen refreshen `listAppointmentsRemote` (von keiner Seite gehalten); `listCalendarEventsRemote` wird nie refreshed; der Client nutzt nirgends `.updates(...)` (CLAUDE.md: „Both halves are required"). Der Schließungszweig refresht gar nichts. Funktioniert nur, weil jede Mutation mit `goto('/calendar')` endet. | `calendar.remote.ts:168,199-211,232,304,333-344`; `new/+page.svelte:19`; `edit/+page.svelte:73,91` | Toter Refresh-Code; jede zukünftige Inline-Mutation (z. B. Status-Flip im Grid) würde stale bleiben. | Im Rewrite Grid-Query als Refresh-Ziel bzw. Invalidierung nach Mutation sauber definieren. | im Rewrite beheben | F-533, F-538, F-539, F-540 |
| B-459 | Zeitzonen-Inkonsistenz: `datetime-local`-Strings werden serverseitig lokal-naiv geparst (`new Date('2026-07-21T09:00')` = Server-TZ); Grid bucketet nach **UTC** (`toISOString()`); Kalender-„Heute", Dashboard-„heute" und Agenda-Datum nach UTC; Edit-Formular liest mit Browser-Lokalzeit zurück; Slots rechnen in Server-Lokalzeit; Mail formatiert Europe/Berlin; Aufträge speichern Berlin-Wandzeit. Kein `TZ` im `Dockerfile`/Compose. Bei Server-TZ ≠ Browser-TZ verschieben sich Uhrzeiten (UTC-Container: 09:00 eingegeben → 11:00 angezeigt im Sommer); Termine nach 22/23 Uhr Berlin landen im Grid am Vortag/Folgetag; um Mitternacht Berlin zeigt „Heute" ggf. den Vormonat. | `calendar.remote.ts:138-139,278-279,368-369`; `calendar-service.ts:82,246`; `+page.svelte:13-14,184`; `dashboard-service.ts:48-61,143`; `public-api-service.ts:36-41,165-179`; `CalendarForm.svelte:88-89,104-111`; `Dockerfile` (kein TZ) | Falsche Uhrzeiten/Tage je nach Deployment; schwer reproduzierbare Bugs. | Rewrite: eine Betriebszeitzone (Europe/Berlin) explizit festlegen und alle Konvertierungen (Parsen, Bucketing, Slots, „heute") darauf beziehen; Wire-Format mit Offset (`Z`) statt lokal-naiv. | Entscheidung nötig | F-527..03, F-533, F-534, F-539, F-550, F-551, F-553 |
| B-460 | Kollisionswarnung läuft für ganztägige Termine nie: Formular sendet `T00:00` für Beginn und Ende → Remote wirft 400 („Endzeit muss nach Startzeit liegen.", strikt) → `catch {}` verschluckt → Speichern ohne Warnung. Gleicher Effekt bei mehrtägig ganztägig. | `CalendarForm.svelte:323-324,357-377`; `calendar.remote.ts:373-375` | Stille Doppelbelegungen bei ganztägigen Terminen; verschluckte Fehler verdecken auch echte 403/500. | Overlap-Check mit den vom Server gepinnten Grenzen (00:00–23:59:59) aufrufen; Fehler des Checks nicht verschlucken. | im Rewrite beheben | F-534, F-537 |
| B-461 | Rohfehler-Leak: `catch (e) { if (e instanceof Error) error(400, e.message) }` reicht Drizzle-/Postgres-Meldungen (FK-Verletzung bei falscher `customerId`, `invalid input syntax for type uuid` bei Nicht-UUID — `idSchema` prüft kein UUID-Format) als Toast an den Nutzer. Verstoß gegen CONTRIBUTING §12.1 („no DB error"). Existenz/Zugehörigkeit von Kunde/Fahrzeug/Mitarbeiter wird nicht geprüft. | `calendar.remote.ts:170-173,212-215,306-309,345-348`; `validation.ts:28` | Englische/technische Fehlermeldungen im UI; Informationspreisgabe über Schema. | Kuratierte deutsche Fehler; FK-Existenz vorab prüfen; `idSchema` mit UUID-Check. | im Rewrite beheben | F-533, F-536, F-538, F-539 |
| B-462 | Schemas ohne deutsche Meldungen und ohne Inhaltsprüfung: `isoDateSchema`/`dateTimeStringSchema`/`titleSchema` sind reine `maxLength`-Pipes; `title` ohne `minLength(1)` → leerer Titel per Remote möglich (nur das Formular prüft); `from`/`to` ohne Datumsformat-Check; FIELD_LABELS fehlen für `startsAt`, `endsAt`, `allDay`, `kind`, `from`, `to`. CONTRIBUTING §12.1 fordert deutsche Meldung je Pipe-Schritt und `dateStringSchema` aus `validation.ts`. | `calendar.remote.ts:30-32,98-101`; `hooks.server.ts` (Labels) | Degradierte Fehlermeldungen („Bitte prüfen Sie Ihre Eingabe."), inkonsistente Datenqualität. | `dateStringSchema` nutzen, `minLength(1, …)` für Titel, Labels ergänzen. | im Rewrite beheben | F-533, F-538, F-539 |
| B-463 | Doppelbuchungs-Schutz der Public-API ist nicht atomar: Slot-Recheck (`findFreeSlots`), Kundenanlage und Termin-Insert laufen ohne Transaktion/Lock; zwei parallele `POST`s auf denselben Slot passieren beide den Check. Auch intern (Kalenderformular) gibt es nur eine Warnung — kein DB-seitiger Ausschluss (kein Exclusion-Constraint). | `appointments/endpoint.ts:146-210`; `calendar-service.ts:526-539` | Reale Doppelbuchung bei gleichzeitigen Website-Anfragen; Kundennummer wird auch bei späterem Fehler verbraucht. | Transaktion mit Advisory-Lock oder `EXCLUDE USING gist (tsrange(starts_at, ends_at) WITH &&) WHERE kind='appointment' AND status<>'cancelled'` (falls Doppelbelegung für Online-Buchungen wirklich verboten sein soll). | im Rewrite beheben | F-551 |
| B-464 | Kundenmatching per exaktem `email =`-Vergleich: case-sensitiv, keine Normalisierung, archivierte Kunden werden gematcht, bei Duplikaten kein `ORDER BY` (beliebiger Treffer). Name-Split am ersten Leerzeichen macht aus „Anna Maria Müller" Vorname „Anna", Nachname „Maria Müller"; Firmenkunden werden nie erkannt. | `appointments/endpoint.ts:161-188` | Dubletten (`Max@…` vs. `max@…`), Zuordnung zu archivierten Kunden, unsaubere Namen. | `lower(email)`-Vergleich, `archived=false`, deterministische Wahl (ältester), Name-Felder getrennt entgegennehmen. | im Rewrite beheben | F-551 |
| B-465 | Slot-Modell ohne Kapazität/Ressourcen: jeder nicht-abgesagte Termin (auch interne, ganztägige, ohne Mitarbeiter) blockiert den gesamten Betrieb; `employee_absences` und `work_orders` (`scheduled_date`) werden nicht berücksichtigt; keine Vorlaufzeit außer „> jetzt"; `free-slots` liefert Slots in der Vergangenheit (kein `now`-Filter); kein Puffer zwischen Terminen. | `public-api-service.ts:95-156,165-194`; `appointments/endpoint.ts:140-144` | Website zeigt entweder zu wenige (ein Termin sperrt alles) oder nicht buchbare (vergangene) Slots; Mitarbeiterabwesenheiten unbeachtet. | Kapazitätsmodell (parallele Plätze/Mitarbeiter), Vorlaufzeit/Horizont konfigurierbar, `now`-Filter. | Entscheidung nötig | F-550, F-551 |
| B-466 | Buchung nur auf dem 15-min-Raster ab `opensAt` möglich: `isAvailable` verlangt einen Slot mit **exakt** gleichem Start; Start 09:05 → 409 „Termin ist nicht mehr verfügbar." (irreführend, Slot ist nicht belegt, sondern rasterfremd). | `appointments/endpoint.ts:147-158`; `public-api-service.ts:181-191` | Verwirrende Fehlermeldung; implizite Raster-Regel undokumentiert. | Raster-Verletzung als eigener 400 mit klarer Meldung; Raster in Doku. | im Rewrite beheben | F-551 |
| B-467 | Sprachmix in der englischen Public-API: Valibot-Meldungen aus `validation.ts` sind deutsch (`Invalid "customerEmail": Bitte geben Sie eine gültige E-Mail-Adresse ein.`), 409-Text „Termin ist nicht mehr verfügbar." deutsch, übrige Meldungen englisch. | `appointments/endpoint.ts:60-75,101-107,157` | Inkonsistente Konsumenten-API. | Eigene englische Schemas für die Public-API oder durchgängig deutsch. | im Rewrite beheben | F-551 |
| B-468 | `confirmationToken` ist ein totes Artefakt: wird als `confirmation:<uuid>` in `notes` gespeichert und per Mail verschickt, aber nirgends gelesen (kein Lookup-/Storno-Endpoint, kein Index, Freitext-Spalte). Kundennotiz und Token teilen sich das Feld; Operator sieht den UUID in der Notiz. | `appointments/endpoint.ts:191-208`; `seed-defaults.ts:116-131` | Unvollständiges Feature; Notizfeld verschmutzt. | Entweder eigene Spalte + Storno/Lookup-Endpoint oder Token entfernen. | Entscheidung nötig | F-551, F-552 |
| B-469 | Endpoint-Dokukommentare veraltet: `free-slots` verspricht Dauer aus `attributes.durationMinutes` des Service, `appointments` nennt `serviceId` optional und „or a service id whose attributes.durationMinutes is used"; tatsächlich ist `serviceId` Pflicht, Dauer kommt nur vom Aufrufer. Body-Schema und Laufzeit widersprechen sich (optional vs. Pflicht). | `free-slots/endpoint.ts:4-9`; `appointments/endpoint.ts:5-6,60-75,117-138` | Irreführende Doku für den Website-Entwickler. | Schema auf Pflichtfelder ziehen, Kommentare korrigieren. | im Rewrite beheben | F-550, F-551 |
| B-470 | Keine deterministische Chip-Reihenfolge pro Tag: keine der sechs Quell-Queries hat `ORDER BY`, Ausgabe folgt Quellen- und Heap-Reihenfolge; das Grid zeigt nur die ersten 3. Verstoß gegen CONTRIBUTING (`:678` „Always order deterministically"). | `calendar-service.ts:131-229,237-341`; `+page.svelte:268-269` | Welche 3 Chips sichtbar sind, ist zufällig; Uhrzeitreihenfolge nicht gegeben. | Sortierung nach Kind-Priorität (Feiertag, Schließung, Termin nach Uhrzeit, …) im Service. | im Rewrite beheben | F-527, F-528, F-531 |
| B-471 | „+N weitere" ist nur ein Tooltip (`title`), nicht klickbar/aufklappbar; auf Touch-Geräten (Agenda zeigt alle, aber Grid ≥ `lg` mit Touch) unerreichbar. Keine Farblegende, keine Uhrzeit in Chips (`startsAt` wird nicht gerendert). | `+page.svelte:279-308,329-347` | Termine ab dem 4. pro Tag sind faktisch unsichtbar; Zeitplanung ohne Uhrzeiten. | Tagesansicht/Popover, Uhrzeit-Prefix, Legende. | im Rewrite beheben | F-527, F-531 |
| B-472 | Mehrtägige **zeitgebundene** Termine (z. B. 21.07. 22:00 – 22.07. 02:00 oder ein zweitägiger Termin ohne Ganztägig) erscheinen nur am Starttag. | `calendar-service.ts:244-246` | Folgetage sehen frei aus. | Expansion wie bei `allDay` über alle berührten Tage. | im Rewrite beheben | F-531, F-533 |
| B-473 | Löschen eines Termins mit verknüpftem Auftrag ohne Guard/Hinweis: FK `SET NULL` entfernt den Link still; der Auftrag behält `scheduledDate/Time`, verliert aber „Termin"-Bezug; Dialogtext erwähnt es nicht. Auch Kunden-/Fahrzeug-/Mitarbeiter-Löschung setzt Termin-FKs still auf NULL (Kunden-Delete-Guard prüft Termine? — nicht in diesem Modul; unklar). | `calendar-service.ts:444-446`; `schema.ts:1215-1217`; `edit/+page.svelte:149-157` | Unbeabsichtigter Verlust der Termin↔Auftrag-Beziehung. | Delete-Guard mit deutscher Meldung („Zu diesem Termin existiert ein Auftrag …") analog Archiv-Guards. | Entscheidung nötig | F-540, F-541 |
| B-474 | Picker im Kalender verlangen fremde Modulrechte: Mitarbeiterfilter/-picker `requireAnyPermission('employees','orders')`, Kunde `requirePermission('customers')`, Fahrzeug `requirePermission('vehicles')`. Ein Nutzer mit nur `calendar` bekommt beim Öffnen 403-Toasts und kann keine Verknüpfungen setzen. | `pickers.remote.ts:103,228,314`; `+page.svelte:57-61`; `CalendarForm.svelte:509-530` | Rollen ohne Vollzugriff scheitern an Kernfunktionen des Kalenders. | Picker-Guards um `calendar` erweitern (wie bereits für `orders` geschehen) oder Rechte-Modell klären. | Entscheidung nötig | F-530, F-536, F-556 |
| B-475 | Dashboard „Anstehende Termine": Termin-Zeilen verlinken pauschal auf `/calendar` (aktueller Monat), nicht auf den Eintrag oder dessen Monat; bei Terminen im Folgemonat landet der Nutzer im falschen Monat (kein Deep-Link vorhanden, vgl. B-477). | `src/routes/+page.svelte:149-151`; `dashboard-service.ts:127-129` | Umständliche Navigation. | Link auf `/calendar/{entryId}/edit` bzw. `/calendar?date=…`. | im Rewrite beheben | F-553 |
| B-476 | Dashboard-Feed filtert `cancelled` erst nach `LIMIT 20` in JS; `appointmentsToday` zählt Termine mit verknüpftem Auftrag mit (die das Grid ausblendet) → KPI und Grid widersprechen sich; Feed-Remote nur `requireUser()` (Termin-Titel für Nutzer ohne `calendar`). | `dashboard-service.ts:100-111,167-183,198-200`; `dashboard.remote.ts:18,30` | Falsche/uneinheitliche Zahlen; leichte Informationspreisgabe. | Status-Filter in SQL; einheitliche Definition „Termin" mit dem Grid; Permission-Prüfung im Feed. | im Rewrite beheben | F-553 |
| B-477 | Kein Deep-Link/URL-Zustand (`?date=`, `?employee=`), nur Monatsansicht (keine Woche/Tag/Liste), kein Browser-Back je Monat; Zustand geht bei jeder Navigation (z. B. Chip → Edit → zurück) verloren: nach dem Speichern eines Termins im Dezember landet der Nutzer im aktuellen Monat. | `+page.svelte:12-22,186-201`; `new/+page.svelte:29`; `edit/+page.svelte:81,95` | Wiederholtes Blättern; keine teilbaren Links; der E2E-Test blättert deshalb bis zu 26 Monate zurück (`e2e/calendar.spec.ts:44-47`, ab 2028 bricht er). | `?date=YYYY-MM` + `?employee=` als Quelle des Zustands; Rücksprung mit `returnTo`. | im Rewrite beheben | F-529, F-530 |
| B-478 | Doku/Text-Konflikte: `docs/modules/calendar.md:9-12,16` beschreibt eine „Termine table"/„appointment list" auf `/calendar` (existiert nicht); `docs/modules/calendar.md:47-50` und `+page.svelte:16-20` behaupten Schließungen bleiben beim Filter sichtbar (falsch, B-456); Formulartext (`CalendarForm.svelte:538-542`) verspricht Schließungen in den Konfliktwarnungen (falsch: Overlap-Check prüft nur Termine); `holiday-service.ts:2-5` und `docs/architecture/holidays.md:12-14` verweisen auf eine ausstehende Drop-Migration für `public_holidays`. | s. Beschreibung | Irreführende Anforderungsbasis für den Rewrite. | Code als Wahrheit übernehmen; Zieltexte korrigieren. | im Rewrite beheben | F-530, F-537, F-538, F-554 |
| B-479 | Testlücken: `hu_due`-Quelle ist `it.skip` (pg-mem); kein `calendar.remote.test.ts` (Normalisierung all-day, Kind-Wechsel-Sperre, Closure-Invarianten, Rohfehler-Pfad); kein Dashboard-Service-Test; keine Endpoint-Tests neben `free-slots/`/`appointments/` (nur Sammeltest); keine Race-/Concurrency-Tests; keine Page-Tests für Grid/Agenda/Klickziele; E2E-Feiertagstest zeitabhängig (26-Monate-Schleife). | `calendar-service.test.ts:249-254`; `e2e/calendar.spec.ts:44-47` | Regressionen in den kritischen Pfaden (TZ, Slots, Buchung) unbemerkt. | Rewrite-Testplan: Remote-Tests, Endpoint-Tests, Zeitzonen-Fixtures mit fester TZ, Concurrency-Test für Buchung. | im Rewrite beheben | alle |
| B-480 | Legacy-Import schreibt Termin-Zeiten als UTC (`…:00Z`), das UI parst Eingaben lokal-naiv → importierte 09:00-Termine erscheinen je nach Server-/Browser-TZ um 1–2 h verschoben; ganztägige Legacy-Termine enden `23:59Z` statt `23:59:59Z` (kosmetisch). | `import-service.ts:1444-1456` | Falsche Uhrzeiten bei Altdaten. | Im Rewrite mit einer Zeitzonen-Konvention (B-459) konsistent importieren. | im Rewrite beheben | F-555 |
| B-481 | Performance/Struktur: `listCalendarEvents` lädt bei jedem Monatswechsel **alle** `employees` (Label-Map) und `getCompanyHolidayState()` liest `company_settings` bei jedem Aufruf (Kalender, Slots, jede Abwesenheitsberechnung); `findFreeSlots` lädt Blocker über 62 Tage in den Speicher; Overlap-Queries filtern `starts_at` und `ends_at`, Index nur auf `starts_at`. Für einen Kleinbetrieb unkritisch, aber ohne Limits. | `calendar-service.ts:168-174`; `holiday-service.ts:336-342`; `public-api-service.ts:95-122`; `schema.ts:971-973` | Unnötige Roundtrips; unbegrenzte Payloads bei Wachstum. | Label-Join statt Vollabzug; Bundesland cachen/als Enum; Index auf `(kind, starts_at, ends_at)`. | bewusst später | F-527, F-550 |
| B-482 | Toter/duplizierter Code: `listAppointments`/`listAppointmentsRemote` ungenutzt; `isWithinHours` in den gelesenen Produktionsdateien nie aufgerufen; Öffnungszeiten-Defaults dreifach (Seed, Service, Slot-Service); `public_holidays`-Tabelle + Typen dormant; `listAbsencesInRange` vom Kalender nicht genutzt; Closure-Inputs tragen `required` trotz `novalidate`. | `calendar-service.ts:352-433`; `workshop-hours-service.ts:117-132`; `public-api-service.ts:199-206`; `schema.ts:977-982,1956-1957`; `absence-service.ts:230-242`; `CalendarForm.svelte:550,559` | Wartungslast, Verwirrung über die „Wahrheit". | Im Rewrite nicht übernehmen bzw. eine Quelle je Regel. | im Rewrite beheben | F-549, F-554 |
| B-483 | Status `completed` ist im Grid nicht von `scheduled` unterscheidbar (nur Aufträge haben `done`-Styling); `planned` vs. `approved` bei Abwesenheiten gleich; Halbtage unsichtbar; kein Hinweis auf Termine mit Auftrag außer dem Chip-Wechsel. | `+page.svelte:142-164`; `calendar-service.ts:275-299` | Erledigte/geplante Termine nicht auf einen Blick erkennbar. | Status-abhängiges Styling/Badges. | im Rewrite beheben | F-531, F-535, F-546 |
| B-484 | `findOverlappingAppointments` nutzt `ne(status, 'cancelled')` — bei `status IS NULL` (Direkt-Insert, Import ohne Status, Datenmigration) fällt die Zeile aus der Warnung; `findFreeSlots` filtert `cancelled` dagegen in JS (NULL blockiert). Keine DB-Constraint erzwingt `status NOT NULL` für Termine oder erlaubte `kind`-Werte. | `calendar-service.ts:559`; `public-api-service.ts:142-145`; `schema.ts:949-956` | Inkonsistentes Verhalten zwischen interner Warnung und Public-Slots. | CHECK-Constraints (`kind IN (...)`, `status NOT NULL WHERE kind='appointment'`) oder Enum im Rewrite. | im Rewrite beheben | F-537, F-550 |
| B-485 | Öffnungszeiten-Speichern schickt 7 sequenzielle Commands ohne Transaktion; scheitert Zeile 4, sind 1–3 gespeichert, der Toast meldet Fehler, `formDirty` bleibt gesetzt (Teilzustand). `listWorkshopHours()` schreibt beim Lesen (Lazy-Insert). Physischer Spaltentyp `time` vs. Schema `text` (Migration 0011 vs. Schema) — funktioniert nur durch `slice(0,5)`. | `settings/workshop-hours/+page.svelte:65-77`; `workshop-hours-service.ts:24-33,53-62` | Teilweise gespeicherte Öffnungszeiten; Schema-Drift. | Ein Command mit allen 7 Zeilen in einer Transaktion; Spaltentyp bereinigen. | im Rewrite beheben | F-549 |

## 11. Offene Fragen an den Architekten

1. **Zeitzone**: Soll das Rewrite alle Kalenderzeiten fest in `Europe/Berlin` interpretieren (unabhängig von Server- und Browser-TZ) und Zeiten mit Offset über die Leitung schicken? (Betrifft B-459, B-480; heute vier verschiedene Konventionen.)
2. **Ansichten**: Bleibt es bei der Monatsansicht, oder werden Woche/Tag/Agenda-Liste mit Uhrzeiten, Deep-Links (`?date=`, `?view=`, `?employee=`) und Drag-and-drop gewünscht? Soll eine durchsuchbare Terminliste (auch abgesagte) existieren (B-457, B-477)?
3. **Doppelbelegung intern**: Bleibt die Doppelbuchung für Mitarbeiter bewusst erlaubt (nur Warnung)? Sollen Schließungen, Abwesenheiten des gewählten Mitarbeiters und Aufträge in die Warnung einfließen?
4. **Kapazitätsmodell Online-Buchung**: Wie viele parallele Termine/Hebebühnen/Mitarbeiter kann der Betrieb bedienen? Sollen Abwesenheiten und geplante Aufträge Slots blocken? Vorlaufzeit (z. B. ≥ 24 h), Buchungshorizont (heute 60 Tage Range-Limit), Puffer, Raster (15 min) konfigurierbar (B-465, B-466)?
5. **Buchungsstatus**: Sollen Online-Buchungen als „angefragt" eingehen und vom Betrieb bestätigt werden (mit Benachrichtigung an den Betrieb), oder weiterhin sofort „geplant"? Storno/Umbuchung über den `confirmationToken` gewünscht (B-468)?
6. **Kundenanlage per Website**: Matching-Regeln (E-Mail case-insensitiv? Telefon? archivierte Kunden reaktivieren?), Name-Felder getrennt, DSGVO-Hinweis/Double-Opt-in? (B-464)
7. **Termin-Löschung mit Auftrag**: Blockieren, warnen oder still entkoppeln (B-473)? Soll ein Termin nach Auftragserstellung überhaupt noch eigenständig editierbar sein (Zeit-Drift zwischen Termin und `scheduledDate`)?
8. **Rechte**: Soll `calendar` allein für Filter/Verknüpfungen reichen (Picker-Guards erweitern), oder ist das Rollenmodell „Mitarbeiter hat ohnehin breite Leserechte" verbindlich (B-474)? Soll der Dashboard-Feed `calendar` verlangen?
9. **Feiertage**: Bundesland als Enum in den Einstellungen statt Freitext? Kommunale Feiertage (Augsburg, Mariä Himmelfahrt in BY-Gemeinden) und betriebsindividuelle freie Tage als konfigurierbare Zusatzliste? `public_holidays`-Tabelle endgültig entfernen?
10. **Wiederholungen/Erinnerungen**: Legacy hat „Intervall" (nur in Notizen importiert). Sind Serientermine und Termin-Erinnerungsmails/-SMS an Kunden (heute keine) im Zielumfang?
11. **Public-API-Sprache**: Bleiben Fehlermeldungen englisch (dann eigene Schemas ohne deutsche Texte), oder deutsch für die eigene Website (B-467)?
12. **Uhrzeitanzeige und Status-Styling** im Kalender (Uhrzeit-Prefix, abgeschlossene/abgesagte Termine gedimmt, Halbtage) — gewünschter Detailgrad (B-471, B-483)?
13. **iCal/Export/Synchronisation** (Google/Outlook, ICS-Feed je Mitarbeiter) — im Zielumfang? Heute nicht vorhanden.

## 12. Gelesene Dateien

| Datei | Zeilen |
|---|---|
| `src/routes/calendar/+page.svelte` | 354 |
| `src/routes/calendar/calendar.remote.ts` | 380 |
| `src/routes/calendar/CalendarForm.svelte` | 668 |
| `src/routes/calendar/new/+page.svelte` | 38 |
| `src/routes/calendar/[id]/edit/+page.svelte` | 157 |
| `src/routes/calendar/CalendarForm.test.ts` | 260 |
| `src/lib/server/services/calendar-service.ts` | 577 |
| `src/lib/server/services/calendar-service.test.ts` | 777 |
| `src/lib/server/services/holiday-service.ts` | 342 |
| `src/lib/server/services/holiday-service.test.ts` | 346 |
| `src/lib/server/services/workshop-hours-service.ts` | 132 |
| `src/lib/server/services/workshop-hours-service.test.ts` | 174 |
| `src/lib/server/services/absence-service.ts` | 406 |
| `src/lib/server/services/absence-service.test.ts` (Testnamen; Feiertagsbezug) | 897 |
| `src/lib/server/services/public-api-service.ts` | 206 |
| `src/lib/server/services/public-api-service.test.ts` | 256 |
| `src/lib/server/public-api.ts` | 173 |
| `src/routes/api/public/free-slots/endpoint.ts` | 92 |
| `src/routes/api/public/free-slots/+server.ts` | 13 |
| `src/routes/api/public/appointments/endpoint.ts` | 240 |
| `src/routes/api/public/appointments/+server.ts` | 13 |
| `src/routes/api/public/public-api.test.ts` (Abschnitte free-slots/appointments `:421-685`, Struktur) | 1479 |
| `src/lib/server/db/schema.ts` (Abschnitte `:30-60`, `:880-985`, `:1180-1260`, `:1750-1790`, Typ-Exporte) | 2025 |
| `src/lib/server/db/validation.ts` (verwendete Schemas, `ListParams`/`ListResult`) | 315 |
| `src/lib/server/db/seed-defaults.ts` (`:100-150`, `:234`, `:290-307`) | 376 |
| `drizzle/0005_unified_calendar_entries.sql` | 21 |
| `drizzle/0034_scheduling_docs_owner.sql` | 73 |
| `src/routes/pickers.remote.ts` (`pickerSchema`, `pickCustomersRemote`, `pickCustomerVehiclesRemote`, `pickEmployeesRemote`) | 703 |
| `src/routes/+page.svelte` | 171 |
| `src/routes/dashboard.remote.ts` | 32 |
| `src/lib/server/services/dashboard-service.ts` | 209 |
| `src/lib/server/services/mail-service.ts` (`:608-750`, Formatter) | 1236 |
| `src/lib/server/services/work-order-service.ts` (`:495-640`) | 1160 |
| `src/routes/orders/orders.remote.ts` (`:265-276`, `:349-357`) | 502 |
| `src/routes/orders/[id]/+page.svelte` (`:484-498`) | – (Ausschnitt) |
| `src/lib/server/services/import-service.ts` (`:36-64`, `:382-389`, `:1405-1500`) | 1591 |
| `src/routes/settings/workshop-hours/workshop-hours.remote.ts` | 85 |
| `src/routes/settings/workshop-hours/+page.svelte` | 147 |
| `src/routes/settings/workshop-hours/workshop-hours.remote.test.ts` (Kopf + Testnamen) | 159 |
| `src/lib/components/ui/CustomerVehiclePicker.svelte` (`:1-80`) | 209 |
| `src/lib/components/ui/SearchablePicker.svelte` (Props) | 284 |
| `src/hooks.server.ts` (`:58-78`, FIELD_LABELS-Treffer) | 470 |
| `src/lib/components/layout/navigation.ts` (`:78-81`) | 247 |
| `e2e/calendar.spec.ts` | 132 |
| `docs/modules/calendar.md` | 68 |
| `docs/architecture/holidays.md` | 66 |
| `docs/decisions/adr-011-unified-calendar-entries.md` | 33 |
| `docs/integrations/public-rest-api.md` | 59 |
| `CONTRIBUTING.md` (§4, §5, §11, §12.1, Überschriften) | 1474 |
| `Dockerfile`, `docker-compose*.yml`, `.env.example` (nur grep nach `TZ`) | – |
| `/tmp/…/scratchpad/inv/TEMPLATE.md` | 59 |
