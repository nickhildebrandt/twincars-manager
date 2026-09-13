---
title: Inventar E-Mail & Erinnerungen (MAIL)
teil_von: docs/rewrite/01-inventar.md
stand: Bestand (SvelteKit) vor dem Rewrite
---

> **Detail-Inventar des Bestands.** Erhoben durch vollständiges Lesen der in
> Abschnitt „Gelesene Dateien" genannten Dateien. Die IDs wurden auf die
> globalen IDs aus [01-inventar.md](../01-inventar.md) umgestellt
> (70 IDs). Zurück: [01-inventar.md](../01-inventar.md) ·
> [02-befunde.md](../02-befunde.md)

# Modul: E-Mail-Versand, Vorlagen, SMTP, Zahlungserinnerungen (Offene Rechnungen), Gesendet, Rundschreiben (Mailings)   (Kürzel: MAIL)

Sprache: Deutsch für Fließtext/Tabellen; Code-Bezeichner, Dateipfade, Tabellen-/Spaltennamen bleiben englisch und exakt wie im Code.
Alles muss aus dem tatsächlich gelesenen Code stammen. Keine Vermutungen. Bei Unsicherheit "unklar" schreiben und Fundstelle nennen.
Fundstellen immer als `pfad/datei.ts:zeile`.

Abgrenzung: Dieses Inventar deckt den kompletten SMTP-Versandpfad (`mail-service.ts`), die SMTP-Konfiguration inkl. Testversand, die Mail-Vorlagenverwaltung, das Modul "Offene Rechnungen" (`/reminders`, Zahlungserinnerungen), die Versand-Historie (`/sent`) und die Rundschreiben (`/mailings`) ab. Die weiteren Konsumenten des Versandpfads (Rechnungs-/Angebotsversand, Ad-hoc-Kundenmail, Reifenwechsel-Erinnerung, Terminbestätigung, Kontaktformular-Benachrichtigung, Anfragen-Retry) werden nur soweit beschrieben, wie sie den Versandpfad berühren — ihre Module haben eigene Inventare.

## 1. Routen und Seiten

| Route | Datei | Parameter | Guard / Permission | Layout | Datenabhängigkeiten (Remote-Queries, Reihenfolge) | Zweck |
|---|---|---|---|---|---|---|
| `/reminders` | `src/routes/reminders/+page.svelte` | keine (keine Deep-Links, keine Pagination) | Session (hooks) + `requirePermission('reminders')` in jeder Remote; Nav-Eintrag "Offene Rechnungen" mit `permission: 'reminders'` (`src/lib/components/layout/navigation.ts:139-143`) | AppShell | 1. `await listOpenInvoicesRemote()` (`:32`), 2. `await listRemindersRemote()` (`:33`) — sequentiell, dann in lokale `$state`-Arrays gespiegelt; Refresh imperativ via `.run()` (`:44-49`) | OP-Liste offener Rechnungen mit Verzugstagen, Erinnerungs-Zähler, "Senden"-Button pro Zeile, Batch-Button "Fällige jetzt versenden", Historie versendeter Zahlungserinnerungen |
| `/reminders/[id]` | `src/routes/reminders/[id]/+page.svelte` | `id` (Reminder-UUID, `untrack(() => page.params.id!)` `:10`) | `requirePermission('reminders')` in `getReminderRemote`; PDF-Bytes über `getReminderPdfBytesRemote` (ebenfalls `reminders`) | AppShell | `await getReminderRemote({ id })` (`:13`); `PdfViewer documentId={reminder.id} kind="reminder"` (`:81`) lädt Bytes selbst | Detail einer Zahlungserinnerung: Forderungsaufstellung, PDF-Viewer, Metadaten, Link zur Rechnung. Keine Aktionen. |
| `/sent` | `src/routes/sent/+page.svelte` | keine URL-Parameter; interner State `pageNum`, `q`, `type`, `viewYear/viewMonth` (`:17-52`) | `requireAnyPermission('invoices','offers','reminders')` (`sent.remote.ts:35`); Nav-Eintrag "Gesendet" mit `permission: 'invoices'` (`navigation.ts:215`) | AppShell | `await untrack(() => listSentRemote(queryArgs))` (`:87`), reaktiv `listSentRemote(queryArgs).current ?? lastResult` (`:95-97`), `$effect` für `lastResult`/Fehler (`:102-106`) | Zentrale Versand-Historie mit Suche, Typfilter, Monatsnavigation, Pagination 25 |
| `/sent/[id]` | `src/routes/sent/[id]/+page.svelte` | `id` (sent_messages-UUID) | `requireAnyPermission('invoices','offers','reminders')` (`sent.remote.ts:90`) | AppShell | `await getSentMessageRemote({ id })` (`:13`); optional `PdfViewer documentId={msg.documentId} kind={msg.pdfKind}` (`:90-92`) | Kopfdaten, Fehlertext, Body-Text, ggf. PDF |
| `/mailings` | `src/routes/mailings/+page.svelte` | keine | `requirePermission('mailings')` (alle drei Remotes); Nav "Rundschreiben" `permission: 'mailings'` (`navigation.ts:210-214`) | AppShell | `previewBroadcastRecipientsRemote()` + `listBroadcastHistoryRemote()` parallel via `Promise.all` (`:28-30`) — **statischer Snapshot**, kein reaktives `.current` | Empfänger-Vorschau, Composer (`EmailComposer`), Bestätigungsdialog, Historie (letzte 10 Zeilen) |
| `/settings/mail` | `src/routes/settings/mail/+page.svelte` | keine; Legacy `/settings?tab=mail` → Redirect via `goto(..., { replaceState: true })` (`src/routes/settings/+page.svelte:36-45`) | Tab nur mit `settings` (`src/routes/settings/+layout.svelte:33-38`); Remotes `requirePermission('settings')` | Settings-TabGroup (nav-mode) im AppShell | `listMailTemplatesRemote().current ?? []` reaktiv (`:25`), `$effect` Fehler (`:27-30`), Editor-Seeding per `$effect` (`:37-45`) | Vorlagen-Editor (Select → Betreff/Body), Speichern, Reset auf Standard |
| `/settings/smtp` | `src/routes/settings/smtp/+page.svelte` | keine; Legacy `/settings?tab=smtp` → Redirect | Tab `settings` (`+layout.svelte:45-50`); Remotes `settings` | Settings-TabGroup | `getAllSettingsRemote().current` reaktiv (`:25`), Einmal-Initialisierung (`:45-59`) | SMTP-Formular (Absender, Server) + Testversand-Karte (`SmtpTestSend.svelte`) |
| `/settings/reminders` | `src/routes/settings/reminders/+page.svelte` | keine; Legacy `/settings?tab=reminders` → Redirect | Tab `settings` (`+layout.svelte:39-44`); Remotes `settings` | Settings-TabGroup | `getAllSettingsRemote().current` (`:28`), `listMailTemplatesRemote().current` (`:35`); zwei Einmal-Initialisierungen (`:47-55`, `:60-69`) | Auto-Toggle, Kleinunternehmer-Toggle, `reminderDays1`, `reminderRecurEveryDays`, Inline-Editor der Vorlage `reminder_1` |
| `/invoices/[id]` (Anteil) | `src/routes/invoices/[id]/+page.svelte` | `id` | `invoices` (+ `reminders` für die Reminder-Remotes) | AppShell | `listRemindersForInvoiceRemote({ invoiceId })` parallel zum Rechnungs-Load (`:57-61`), reaktiv (`:75-79`) | Banner "überfällig"/"N Zahlungserinnerungen versendet", CTA "Zahlungserinnerung senden"/"Erneut senden" (mit ConfirmDialog), Tabelle "Versendete Zahlungserinnerungen"; nach Senden `goto('/reminders/<id>')` (`:257`) |
| `/customers/[id]` (Anteil) | `src/routes/customers/[id]/+page.svelte` | `id` | `customers` | AppShell | – | Button "E-Mail schreiben" (deaktiviert ohne E-Mail, `:243-255`), Modal mit `EmailComposer allowHtml` (`:552-613`) → `sendAdHocCustomerEmailRemote` |
| `/settings/inquiries` (Anteil) | `src/routes/settings/inquiries.remote.ts` | – | `mailings` | Settings-TabGroup | – | Retry der Kontaktformular-Benachrichtigung (`retryInquiryNotificationRemote`) — nutzt `sendContactNotification` |
| `/settings/tire-reminders` (Anteil) | `src/routes/settings/tire-reminders.remote.ts` | – | `settings` | Settings-TabGroup | – | Saison-Versand über `sendDocumentEmail` mit Vorlage `tire_reminder` |

Redirects/Setup: Alle Routen stehen hinter dem Setup-Gate und der Session-Prüfung in `src/hooks.server.ts` (nicht Teil dieses Inventars). Die Settings-Seiten setzen `formDirty` bei `oninput/onchange` und löschen es nach erfolgreichem Speichern (`mail/+page.svelte:19-20,82`, `smtp/+page.svelte:20-21,77`, `reminders/+page.svelte:23-24,90`).

## 2. Remote Functions und Endpoints

### 2.1 `src/routes/reminders/reminders.remote.ts`

- **listOpenInvoicesRemote** — query (ohne Schema) — `reminders.remote.ts:27-115`
  - Guard: `requirePermission('reminders')` (`:28`)
  - Argumente: keine
  - Rückgabe: **unpaginiertes** Array `{ id, documentNumber, issueDate, dueDate, customerName (company ?? lastName ?? null), grossTotal:number, totalPaid:number, openAmount:number, status, overdueDays:number, reminderCount (= documents.reminderLevel), lastReminderDate: string|null }` (`:89-114`)
  - Logik: `documents.type='invoice'`, Status nicht in `paid|cancelled|storno|draft|converted` (`:75-81`), Left-Join `customers`, Subquery `sum(documentPayments.amount)` je Beleg (`:31-38`), Subquery `max(reminders.issueDate)` je Rechnung (`:42-49`); Sortierung `dueDate ASC, issueDate ASC` (NULLs am Ende, `:86`); `overdueDays` = Tage zwischen `dueDate` und heute (UTC-ISO-Datum, `:88-96`); `openAmount = grossTotal - totalPaid` (`:97`)
  - Fehlerfälle: 401/403 aus Guard
  - Nebenwirkungen: keine; Transaktion: nein
- **listRemindersRemote** — query — `:123-127`
  - Guard: `reminders`; ruft `listOpenReminders()`; `grossTotal` → Number. Unpaginiert.
- **getReminderRemote** — query `object({ id: idSchema })` — `:135-157`
  - Guard: `reminders`; 404 `'Zahlungserinnerung nicht gefunden.'` (`:140`)
  - Rückgabe: `{ id, documentNumber, invoiceId, invoiceNumber, invoiceGross:number, invoiceDueDate, level, issueDate, dueDate, status, notes, customerName, customerCity }`
- **listRemindersForInvoiceRemote** — query `object({ invoiceId: idSchema })` — `:165-179`
  - Guard: `reminders`; Rückgabe Array `{ id, documentNumber, level, issueDate, dueDate, status }` älteste zuerst
- **createPaymentReminderRemote** — command `object({ invoiceId: idSchema })` — `:190-206`
  - Guard: `reminders` (`:193`)
  - Ablauf: `sendPaymentReminder(invoiceId)` (ohne Optionen → `asOf` = heute, `dueDate` = heute + `reminderDays1`), dann `requested(listOpenInvoicesRemote, 4).refreshAll()` + `requested(listRemindersRemote, 4).refreshAll()` (`:196-199`)
  - Rückgabe: die neue `reminders`-Zeile (kompletter Row inkl. `id`)
  - Fehlerfälle: jede `Error` aus dem Service → `error(400, e.message)` (`:202`): `'Rechnung nicht gefunden.'`, `'Zahlungserinnerungen können nur zu Rechnungen erzeugt werden.'`, `'Zahlungserinnerungen sind nur für offene, nicht stornierte Rechnungen möglich.'`, Nummernkreis-Fehler
  - Nebenwirkungen: Nummernkreis `reminder`, `reminders`-Insert, `documents.reminderLevel`++, Reminder-PDF, Mail (`reminder_1`), `sent_messages`-Zeile; Transaktion: **nein**
- **createReminderRemote** — Alias auf `createPaymentReminderRemote` (`:212`), `@deprecated`, kein Aufrufer außerhalb (Doku nennt ihn)
- **autoSendDuePaymentRemindersRemote** — command ohne Schema — `:223-231`
  - Guard: `reminders`; ruft `autoSendDuePaymentReminders()` (heute), danach `refreshAll()` beider Listen; Rückgabe `{ created, failed }`. Kein Lock gegen parallele Läufe (nur die Unique-Index-Sicherung `(invoiceId, level)`).

### 2.2 `src/routes/sent/sent.remote.ts`

- **listSentRemote** — query `listSchema` — `sent.remote.ts:19-76`
  - Guard: `requireAnyPermission('invoices','offers','reminders')` (`:35`)
  - Argumente: `page: number()` (keine Untergrenze), `size: picklist([10,25,50,100])`, `q?: string trim maxLength(200)`, `type?: string trim maxLength(30)` (kein Picklist; `'all'` = kein Filter), `from?: string maxLength(10)`, `to?: string maxLength(10)` — **keine Datumsformat-Validierung, keine deutschen Meldungen** (`:19-26`)
  - Filter: `ilike` auf `recipientEmail|subject|recipientName` (`:38-47`), `eq(documentType, type)` (`:48-50`), `sentAt >= from T00:00:00Z`, `sentAt <= to T23:59:59Z` (UTC, `:51-56`)
  - Rückgabe: `{ items: sentMessages-Rows (alle Spalten inkl. bodyText), total, page, size, pageCount }` sortiert `sentAt DESC` (`:58-75`)
  - Fehlerfälle: ungültiges Datum → `new Date('...')` Invalid Date → DB-Fehler 500 (unvalidiert)
- **getSentMessageRemote** — query `object({ id: idSchema })` — `:87-106`
  - Guard wie oben; 404 `'Gesendete Nachricht nicht gefunden.'` (`:96`)
  - Rückgabe: kompletter Row + `pdfKind: 'document'|'reminder'|null` — `'reminder'` wenn `documentType.startsWith('reminder')`, sonst `'document'` sofern `documentId` gesetzt (`:98-103`)

### 2.3 `src/routes/mailings/mailings.remote.ts`

- **previewBroadcastRecipientsRemote** — query — `:78-91`
  - Guard: `requirePermission('mailings')`; Rückgabe `{ totalOptIn, totalWithEmail, sampleNames: string[] (max 5; company || "first last" || email || customerNumber) }`
- **sendBroadcastEmailRemote** — command `broadcastSchema` — `:104-115`
  - Guard: `mailings`
  - Payload: `subject` (`string('Bitte einen Betreff eingeben.')`, `trim`, `minLength(1,'Der Betreff darf nicht leer sein.')`, `maxLength(200,'Der Betreff darf maximal 200 Zeichen lang sein.')`), `body` (`string('Bitte einen Nachrichtentext eingeben.')`, `minLength(1,'Die Nachricht darf nicht leer sein.')`, `maxLength(50_000,'Die Nachricht darf maximal 50.000 Zeichen lang sein.')`), `asHtml?: boolean`, `attachments: array(attachmentSchema)` mit `filename` (trim, 1..255, deutsche Meldungen), `mime` (trim, ≤100), `base64Data` (1..14_000_000, `'Der Anhang ist zu groß (maximal 10 MB pro Datei).'`) (`:31-67`); Anzahl Anhänge unbegrenzt
  - Rückgabe: `BroadcastSendResult { sent, failed: [{ customerId, reason }] }`
  - Fehlerfälle: SMTP nicht konfiguriert → `buildTransport` wirft `Error('SMTP ist nicht konfiguriert. …')` → ungefangen → 500 → generische Meldung `'Ein interner Fehler ist aufgetreten.'` (`hooks.server.ts:459-463`)
  - Nebenwirkungen: `previewBroadcastRecipientsRemote().refresh()` + `listBroadcastHistoryRemote().refresh()` (`:109-112`) — server-seitig, Client deklariert kein `.updates(...)`; Transaktion: nein
- **listBroadcastHistoryRemote** — query — `:128-144`: Guard `mailings`; letzte **10** `sent_messages` mit `documentType='mailing'`, `sentAt DESC`; Felder `{ id, sentAt, subject, recipientEmail, recipientName, status }`
- **countBroadcastsRemote** — query — `:152-164`: Guard `mailings`; `count(*)` mit `documentType='mailing' AND status='sent'`; **ohne Aufrufer** (JSDoc `:149-150` bestätigt)

### 2.4 `src/routes/settings/settings.remote.ts` (Mail-relevante Teile)

- **getAllSettingsRemote** — query — `:111-136`: Guard `settings`; `{ company: CompanySettings (inkl. Logo, reminder*-Felder), smtp: { host, port, secure, username, hasPassword:boolean, fromAddress, fromName, replyTo, verified } | null }` — Passwort verlässt den Server nie (`:125-128`)
- **updateReminderSettingsRemote** — command `reminderSettingsSchema` — `:182-199`
  - Guard `settings`; Felder `reminderAutoEnabled: boolean()`, `smallBusinessExempt: boolean()`, `reminderDays1` (`number('Bitte einen Wert eingeben.')`, `integer('Bitte ganze Zahl eingeben.')`, `minValue(0,'Bitte keinen negativen Wert eingeben.')`, `maxValue(365,'Maximal 365 Tage.')`), `reminderRecurEveryDays` (integer, `minValue(1,'Intervall muss mindestens 1 Tag betragen.')`, `maxValue(365,…)`) (`:71-86`)
  - Nebenwirkung: `void getAllSettingsRemote().refresh()`; Transaktion nein
- **listMailTemplatesRemote** — query — `:305-318`: Guard `settings`; alle `mail_templates` sortiert `key ASC`; `{ key, subject, body, isCustom, updatedAt }`
- **updateMailTemplateRemote** — command `mailTemplateUpdateSchema` — `:333-349`
  - `key` (trim ≤50, **kein Picklist**), `subject` (trim ≤200, keine deutsche Meldung), `body` (≤20_000) (`:320-324`); 404 `Mailvorlage „<key>" wurde nicht gefunden.`; setzt `isCustom=true`, `updatedAt`; `void listMailTemplatesRemote().refresh()`
- **resetMailTemplateRemote** — command `object({ key })` — `:359-376`: sucht in `defaultMailTemplates` (`seed-defaults.ts:20-147`), 404 `Standardvorlage für „<key>" nicht hinterlegt.`; schreibt Default, `isCustom=false`
- **updateSmtpRemote** — command `smtpUpdateSchema` — `:382-400`
  - Guard `settings`; Felder `host` (trim ≤255, **kein minLength**), `port: number()`, `secure: picklist(['none','STARTTLS','TLS'])`, `username` (trim ≤200), `password?` (≤200), `fromAddress: emailSchema`, `fromName` (trim ≤200), `replyTo: optionalEmailSchema` (`:88-97`); manuelle Port-Prüfung 1..65535 → `error(400,'Ungültiger SMTP-Port.')` (`:384-386`)
  - Delegiert an `upsertSmtpSettings` mit `password: data.password ?? ''` (leer = behalten) und `replyTo: data.replyTo ?? null` (`:388-398`)
- **sendSmtpTestMailRemote** — command `object({ recipient: emailSchema })` — `:428-450`
  - Guard `settings`; modul-globaler Double-Fire-Guard: `smtpTestInFlight` + 5 s Cooldown ab letztem Start → `error(429, 'Ein Testversand läuft bereits oder wurde soeben gestartet. Bitte warten Sie einen Moment.')` (`:414-441`)
  - Rückgabe: `SmtpTestResult` (`{ ok:true, messageId } | { ok:false, error }`) — Versandfehler werden **nicht** geworfen, sondern als Wert zurückgegeben
- Übrige Remotes (`updateCompanyRemote`, Logo, Stundensatz) gehören zum Settings-Inventar; `updateCompanyRemote` schreibt u. a. `companySettings.email` und `salutationStyle`, die der Platzhalter-Engine als `firmaMail` und Anrede-Stil dienen (`:141-174`).

### 2.5 Konsumenten des Versandpfads (Kurzform)

- **sendInvoiceRemote** (`src/routes/invoices/invoices.remote.ts:~300-369`): 400 `'Der Kunde hat keine hinterlegte E-Mail-Adresse.'`; Fahrzeug via `latestPlateSubquery`; `sendDocumentEmail({ documentType:'invoice', documentId })`; bei `!ok` → `error(400, 'E-Mail konnte nicht versendet werden: ' + send.error)` (Roh-SMTP-Fehler im Toast); Erfolg → `setDocumentStatus(id,'sent')`.
- **sendOfferRemote** (`src/routes/offers/offers.remote.ts:337-357`): identisch mit `documentType: doc.type as DocumentMailKind` (offer/cost_estimate/order_confirmation).
- **sendAdHocCustomerEmailRemote** (`src/routes/customers/customers.remote.ts:370-380`): Guard **`customers`**; Schema `adHocEmailSchema` (`:344-359`) identisch zu `broadcastSchema` + `customerId`; 400 mit Roh-Fehler.
- **retryInquiryNotificationRemote** (`src/routes/settings/inquiries.remote.ts:78-112`): Guard `mailings`; erneuter `sendContactNotification` + `recordInquiryNotificationResult`.
- **sendTireRemindersRemote** (`src/routes/settings/tire-reminders.remote.ts:40-48`): Guard `settings`; `sendTireReminders(season)` → `sendDocumentEmail({ documentType:'tire_reminder', documentId:null })` je Kunde (`tire-reminder-service.ts:160-172`).
- **POST /api/public/appointments** (`src/routes/api/public/appointments/endpoint.ts:217-232`): best-effort `sendAppointmentConfirmation`, Fehler geloggt.
- **POST /api/public/contact** (`src/routes/api/public/contact/endpoint.ts:128-155`): Inquiry-Row zuerst persistiert, dann `sendContactNotification` + `recordInquiryNotificationResult`; jeder Fehler → `notificationStatus='failed'`.

## 3. Services (Server-Layer)

### 3.1 `src/lib/server/services/mail-service.ts` (1236 Zeilen)

Modul-Header (`:1-14`) ist veraltet: "PDF attachments are not wired in this iteration" — tatsächlich werden Beleg-PDFs angehängt (`:252-277`).

- `type DocumentMailKind` (`:40-50`): `invoice | offer | cost_estimate | order_confirmation | reminder_1 | reminder_2 | reminder_3 | mailing | tire_reminder | appointment_confirmation`. **`reminder_2`/`reminder_3` haben keine Seeds** (`seed-defaults.ts:20-147`) — `loadTemplate` würde werfen; tote Enum-Mitglieder.
- `type MailContext` (`:52-62`): `document?`, `customer? (firstName,lastName,company,salutation)`, `vehicle? (licensePlate,make,model)`, `extra?: Record<string,string>` (überschreibt alles).
- **`buildVars(ctx)`** (`:98-145`) — Platzhalter-Engine. DB: `companySettings` (1 Row). Erzeugt:

  | Platzhalter | Quelle |
  |---|---|
  | `firma` | `companySettings.companyName` |
  | `firmaIban`, `firmaBic`, `firmaBank`, `firmaTelefon`, `firmaMail` | `companySettings.iban/bic/bankName/phone/email` |
  | `kundeAnredeName` | `salutationStyle==='Du'` → `Hallo <firstName ?? kundeName>,`; Firma → `Sehr geehrte Damen und Herren,`; sonst `Sehr geehrte/r <salutation> <lastName>,`; ohne Kunde `Sehr geehrte Damen und Herren,` (`:107-114`) |
  | `kundeName` | `company || "firstName lastName"` |
  | `kundeVorname` | `firstName ?? kundeName` |
  | `fahrzeugKennzeichen`, `fahrzeugTyp` | `ctx.vehicle.licensePlate`, `make model` |
  | `rechnungNummer`, `rechnungDatum`, `rechnungBetragBrutto`, `rechnungOffenerBetrag` | nur wenn `doc.type==='invoice'`: `documentNumber`, `issueDate` (de-DE), `grossTotal` (EUR), **`grossTotal` (nicht abzüglich Teilzahlungen)** (`:131-136`) |
  | `fälligkeitsDatum` | `doc.dueDate` (jeder Typ) |
  | `angebotNummer`, `angebotGültigBis` | nur wenn `doc.type!=='invoice'`: `documentNumber`, `dueDate` |
  | `verzugstage` | nur via `extra` aus `reminder-service.ts:193` |
  | `terminDatum`, `terminUhrzeit`, `terminDauer`, `leistung`, `bestaetigungsCode` | nur via `extra` aus `sendAppointmentConfirmation` (`:681-687`) |

  Nicht erzeugt, aber in der UI beworben (`settings/mail/+page.svelte:156-158`): `mahnungGebühr`, `mitarbeiterVorname`, `periode`.
- **`render(template, vars)`** (`:152-155`): Regex `/\{([^{}]+)\}/g`; unbekannte Keys bleiben wörtlich stehen (bewusst). Keine Escaping-Logik (alles Plain-Text).
- `htmlToPlainText(html)` (`:164-177`): `<br>`/Blockende → `\n`, Tags entfernt, 6 Entities dekodiert; `<style>`/`<script>`-Inhalte bleiben als Text.
- `UNSUBSCRIBE_TEXT` / `UNSUBSCRIBE_HTML` (`:186-194`): Fußzeile „Keine weiteren Informationen gewünscht? Antworten Sie auf diese E-Mail mit dem Betreff „Abbestellen"."
- **`buildTransport()`** (`:196-217`): 1 Row `smtpSettings`; wirft `Error('SMTP ist nicht konfiguriert. Bitte tragen Sie Host, Absender und Zugangsdaten in den Einstellungen ein.')` wenn `!host || !fromAddress`. nodemailer-Optionen: `host, port, secure: secure==='TLS', requireTLS: secure==='STARTTLS', auth: username ? { user, pass: decryptSecretIfNeeded(password) } : undefined`. **Keine Timeouts, keine TLS-Optionen, kein Pooling.** Modus `'none'` = `secure:false, requireTLS:false` (opportunistisches STARTTLS durch nodemailer möglich).
- `loadTemplate(key)` (`:224-236`): `mail_templates` by key; wirft `Mailvorlage „<key>" nicht gefunden.`
- **`sendDocumentEmail(input)`** (`:238-324`) — zentraler Vorlagen-Versand.
  1. Template laden, Vars bauen, Subject/Body rendern (`:241-244`).
  2. From: `fromName ? "<fromName> <fromAddress>" : fromAddress`; `replyTo = smtp.replyTo ?? undefined` (`:246-250`).
  3. PDF-Anhang nur für `invoice|offer|cost_estimate|order_confirmation` und `documentId` gesetzt: `getOrRenderDocumentPdf(documentId)` (Cache oder Render, `pdf-service.ts:1507-1513`); Render-Fehler → still kein Anhang (`:266-277`).
  4. `sent_messages` Insert `status='pending'` mit `attachmentMeta [{name,size}]` (`:281-295`) — **vor** dem Transport-Aufbau; Subject > 200 Zeichen nach Rendering → DB-Fehler wirft (varchar(200), `schema.ts:1083`).
  5. `transport.sendMail({ from, to: name ? "<name> <email>" : email, replyTo, subject, text: body, attachments })` (`:298-308`) — **nur Text**, kein HTML; Empfängername unquoted konkateniert.
  6. Erfolg → `status='sent', smtpMessageId`; Fehler → `status='failed', errorMessage: e.message` (roh) und Rückgabe `{ ok:false, error }` (`:310-323`).
  - Transaktion: nein. Wirft nur bei fehlender Vorlage oder DB-Fehler; SMTP-Fehler werden als Wert zurückgegeben.
- `decodeAttachment` (`:343-354`): Base64 (mit/ohne `data:`-Präfix) → Buffer; `contentType = mime || 'application/octet-stream'`.
- **`sendAdHocCustomerEmail(input)`** (`:376-455`): Kunde per `customerId` (wirft `'Kunde nicht gefunden.'` / `'Der Kunde hat keine hinterlegte E-Mail-Adresse.'`); `asHtml` → `html` + `text=htmlToPlainText`; Audit-Row `documentType='mailing'`, `bodyText` immer Plain-Text; sonst wie `sendDocumentEmail`. Keine Archiv-Prüfung des Kunden.
- **`sendBroadcastEmail(input)`** (`:492-602`): Empfänger `listCustomersForBroadcast()` (`customer-service.ts:254-262`: `archived=false AND wantsBroadcast=true`, sortiert lastName/firstName, **alle Spalten, unpaginiert**) gefiltert auf `email` gesetzt; 0 Empfänger → `{sent:0,failed:[]}` ohne Transport. Fußzeile + Header `List-Unsubscribe: <mailto:<company.email || replyTo || fromAddress>?subject=Abbestellen>` (`:512-529`). Transport einmal (`:534`, wirft bei fehlender Konfiguration **unfangen**). Batches à `BROADCAST_BCC_BATCH=50` (`:476`): pro Kunde sequentieller `sent_messages`-Insert `pending` (`:546-566`), dann **ein** `sendMail({ to: fromAddress, bcc: [...], html?, text, headers, attachments })` (`:569-579`) — der Absender bekommt je Batch eine Kopie; Erfolg → N Updates `sent` (ohne `smtpMessageId`), Fehler → N Updates `failed` + `failed[]`, nächster Batch läuft weiter. Keine Transaktion, kein Fortschritt nach außen, kein Campaign-Datensatz. `bodyText` (inkl. Fußzeile) wird N-fach gespeichert.
- `formatBerlinDate/Time` (`:623-642`): `Intl` mit `timeZone:'Europe/Berlin'`.
- **`sendAppointmentConfirmation(input)`** (`:662-750`): Name-Split am ersten Leerzeichen; `extra` mit Termin-Platzhaltern; Template `appointment_confirmation`; Template-Fehler → `console.error` + `{ok:false}` (`:689-696`); Audit-Row `documentType='appointment_confirmation'`; kein Anhang; Reply-To aus SMTP.
- `resolveReference` (`:794-936`): löst `used-car`/`tire`/`article` in Textblock + interne URL (`/vehicles/<id>`, `/tires/<id>`, `/items/<id>`); UUID-Check; Preise über jüngste `*_price_versions` mit `validFrom <= heute`; nicht auflösbar → `console.warn` + `null`.
- `buildContactBody` (`:945-980`): Plain-Text-Block (Name, E-Mail, Telefon, Betreff, Nachricht zeilenweise eingerückt, „Bezogen auf", Anfrage-ID, Eingegangen am).
- **`sendContactNotification(input)`** (`:995-1056`): Ziel `companySettings.email`; leer → `{ok:false, error:'Keine Empfänger-Adresse hinterlegt - bitte „E-Mail" in den Firmen-Einstellungen ausfüllen.'}` **ohne** Audit-Row; Subject `[Anfrage] <subject>` auf 200 gekürzt; `replyTo: input.customerEmail`; Audit-Row **`documentType='mailing'`** (`:1025`) → erscheint als „Serienbrief" in `/sent` und in der Mailings-Historie; kein `replyTo` aus SMTP.
- `SMTP_TEST_TIMEOUT_MS = 10_000` (`:1072`); **`mapSmtpTestError(err)`** (`:1096-1141`): Reihenfolge DNS → ECONNREFUSED → EAUTH/535 → EENVELOPE/550/553 → Timeout → TLS → generisch; gibt nie Rohtext zurück.
- **`sendSmtpTestMail({ recipient })`** (`:1160-1210`): eigener Transport mit `connectionTimeout/greetingTimeout/socketTimeout = 10 s`; fehlende Konfiguration → `{ok:false, error:'SMTP ist nicht konfiguriert. Bitte speichern Sie zuerst Host und Absender-Adresse.'}`; Subject `'TwinCarsManager SMTP-Test'`, fester deutscher Text mit Zeitstempel; **kein** `sent_messages`-Eintrag; Fehler → `console.error` + `mapSmtpTestError`.
- `recordInquiryNotificationResult(inquiryId, result)` (`:1217-1236`): setzt `customer_inquiries.notificationStatus/SentAt/Error`.

Performance: pro Versand 3–4 Einzel-Selects (`smtpSettings` wird in `sendDocumentEmail` und erneut in `buildTransport` gelesen, `:246` + `:197`); Broadcast N Inserts + N Updates sequentiell; alle Reads `limit(1)`.

### 3.2 `src/lib/server/services/smtp-settings-service.ts` (76 Zeilen)

- `interface SmtpSettingsInput` (`:17-30`); **`upsertSmtpSettings(input)`** (`:37-76`): Singleton-Row; Insert mit `password: input.password ? encryptSecret(..) : ''`; Update behält `rows[0].password` wenn Eingabe leer; `verified=false` und `updatedAt` bei jedem Save. Keine Transaktion (Select + Insert/Update). Kein Weg, ein gespeichertes Passwort zu löschen (nur Username leeren deaktiviert Auth).

### 3.3 `src/lib/server/crypto.ts` (92 Zeilen)

- Key = SHA-256 über `APP_ENCRYPTION_KEY || APP_SECRET`, sonst Throw `'Weder APP_ENCRYPTION_KEY noch APP_SECRET ist gesetzt - Verschlüsselung nicht möglich.'` (`:30-38`); `encryptSecret` AES-256-GCM, 12-Byte-IV, Format `v1:<iv>:<tag>:<data>` (`:41-55`); `isEncryptedSecret` (`:58-60`); `decryptSecretIfNeeded` (`:68-70`) lässt Klartext durch; `decryptSecret` wirft `'Unbekanntes Chiffrat-Format.'` bzw. GCM-Tag-Fehler (`:76-92`). Ein Key-Wechsel macht das SMTP-Passwort unlesbar → `buildTransport` wirft beim Entschlüsseln (Rohfehler in `sent_messages.errorMessage`).

### 3.4 `src/lib/server/services/reminder-service.ts` (388 Zeilen)

- `addDays(yyyymmdd, days)` (`:40-44`, UTC), `diffDays` (`:46-50`).
- **`sendPaymentReminder(invoiceId, opts)`** (`:80-144`): lädt `documents`; wirft bei `!doc`, `type!=='invoice'`, `status in paid|cancelled` (Storno/Draft/Converted werden **nicht** abgewiesen); `today = opts.asOf ?? heute (UTC)`; `dueDate = opts.dueDate ?? today + settings.reminderDays1` (`:108` — `reminderDays1` doppelt genutzt als Wartezeit **und** Zahlungsziel der Erinnerung); `nextCounter = reminderLevel+1`; `nextDocumentNumber('reminder')` (`document-service.ts:180-182`, Format `ZE-{YYYY}-{NNNN}` aus `seed-defaults.ts:162`); Insert `reminders {documentNumber, invoiceId, level, issueDate, dueDate, status:'open', notes}`; Update `documents.reminderLevel`; danach best-effort `renderAndPersistReminderPdf(row.id)` (Fehler → `console.error`) und `trySendReminderEmail` (Fehler → `console.error`). **Keine Transaktion**: Nummer verbraucht/Row angelegt auch wenn PDF/Mail scheitern; Unique-Index `(invoiceId, level)` fängt Doppel-Läufe (dann wirft der Insert, Nummer bereits verbraucht).
- `createPaymentReminder` = Alias (`:151`, deprecated).
- **`trySendReminderEmail(reminder, invoice)`** (`:159-196`): kein `customerId` oder keine E-Mail → **stiller No-op** (keine `sent_messages`-Zeile, kein Hinweis); `verzugstage = max(0, diffDays(invoice.dueDate, heute))` mit `new Date()` (nicht `asOf`); `sendDocumentEmail({ documentId: invoice.id, documentType:'reminder_1', to:{ email, name: company ?? lastName }, context:{ document: invoice, customer, extra:{verzugstage} } })`. `reminder` selbst wird nicht referenziert (`void reminder`, `:179`) → Erinnerungsnummer/Zahlbar-bis/Zähler stehen nicht als Platzhalter zur Verfügung; **kein PDF-Anhang** (Reminder-PDF existiert, `pdfAttachable` schließt `reminder_1` aus).
- `listOpenReminders()` (`:198-222`): Inner-Join `documents`, Left-Join `customers`, `reminders.status='open'`, `issueDate DESC`, **kein Limit**.
- **`listDuePaymentReminderCandidates(asOf)`** (`:237-291`): Subquery `max(issueDate)` je Rechnung; Rechnungen `type='invoice'`, Status nicht in `paid|cancelled|draft|converted` (**`storno` nicht** in der Liste; laut Doku durch `isNotNull(dueDate)` mit abgedeckt), `dueDate` gesetzt; Filter in JS: `reminderLevel===0` → `dueDate + reminderDays1 <= today`; sonst `lastReminderDate + reminderRecurEveryDays <= today`. **`reminderAutoEnabled` wird nicht gelesen.** Keine Prüfung auf Kunden-E-Mail.
- `listOverduePaymentReminderCandidates`, `findInvoicesNeedingReminder` = Aliase (`:297-298`, `:330`), `createReminderForInvoice` (`:345-352`) — alle deprecated, ohne Aufrufer.
- **`autoSendDuePaymentReminders(asOf)`** (`:306-323`): sequentiell `sendPaymentReminder(c.id, { asOf })` je Kandidat; Fehler → `failed++` + `console.error`; Rückgabe `{ created, failed }`. `created` zählt auch Erinnerungen ohne versendete Mail.
- `getReminderById(id)` (`:360-379`), `listRemindersForInvoice(invoiceId)` (`:382-388`, `level ASC`).
- **Nirgends** wird `reminders.status` geändert (grep `update(reminders` ohne Treffer außerhalb Tests) — der Status bleibt immer `'open'`.

### 3.5 PDF-Anteil (`src/lib/server/services/pdf-service.ts`)

- `loadReminderRenderInput` (`:2006-2044`): Reminder + Rechnung + Kunde + Fahrzeug (Kennzeichen zum `issueDate`) + Settings; `renderAndPersistReminderPdf` (`:2062-2084`) rendert immer neu, löscht/insertet `reminder_pdfs`; `loadCachedReminderPdf` (`:2051-2060`); `getReminderPdfMeta` (`:2099-2116`). `getReminderPdfBytesRemote` (`src/routes/pdfs.remote.ts:97-111`) liefert **nur den Cache** (404 `'Für diese Zahlungserinnerung ist kein PDF gespeichert.'`), kein Auto-Render.

### 3.6 `src/lib/server/db/seed-defaults.ts` (Mail-Anteil)

`defaultMailTemplates` (`:20-147`), idempotent via `onConflictDoNothing({ target: mailTemplates.key })` (`:215-220`); leere `smtp_settings`-Row wird angelegt (`:203-206`). Vorlagen:

| Key | Betreff | Platzhalter im Body |
|---|---|---|
| `invoice` (`:25-41`) | `Ihre Rechnung {rechnungNummer} vom {rechnungDatum}` | `rechnungNummer, rechnungDatum, rechnungBetragBrutto, fälligkeitsDatum, firma, firmaIban, firmaBic` |
| `cost_estimate` (`:42-54`) | `Ihr Kostenvoranschlag {angebotNummer} - {fahrzeugKennzeichen}` | `angebotNummer, fahrzeugTyp, fahrzeugKennzeichen, angebotGültigBis, firma` |
| `offer` (`:55-65`) | `Unser Angebot {angebotNummer}` | `angebotNummer, angebotGültigBis, firma` |
| `order_confirmation` (`:66-76`) | `Auftragsbestätigung {angebotNummer}` | `angebotNummer, firma` |
| `reminder_1` (`:77-93`) | `Freundliche Zahlungserinnerung zu Rechnung {rechnungNummer}` | `rechnungNummer, rechnungDatum, verzugstage, rechnungOffenerBetrag, firma` |
| `tire_reminder` (`:94-109`) | `Termin für den Reifenwechsel buchen - {firma}` | `kundeVorname, firmaTelefon, firmaMail, firma` |
| `appointment_confirmation` (`:110-132`) | `Ihre Terminbestätigung bei {firma}` | `kundeVorname, terminDatum, terminUhrzeit, terminDauer, leistung, bestaetigungsCode, firmaTelefon, firmaMail, firma` |
| `mailing` (`:133-146`) | `Information von {firma}` | `firmaTelefon, firmaMail, firma` + Platzhaltertext `[Hier Ihren Text einfügen]` — **wird von keinem Versandpfad geladen** (Broadcast nutzt den Composer-Text verbatim) |

Alle Body-Anreden sind fest „Sehr geehrte Damen und Herren," bzw. „Hallo {kundeVorname}," — `{kundeAnredeName}` wird in keinem Seed verwendet.

### 3.7 `scripts/dev-mail-catcher.js` (104 Zeilen)

Reiner `node:net`-SMTP-Fake auf `MAIL_CATCHER_HOST/PORT` (Default `127.0.0.1:1025`), antwortet EHLO/MAIL/RCPT/DATA/QUIT, schreibt jede Nachricht als `<timestamp>-<n>.eml` nach `tmp/mail/` (`:23-28`, `:50-55`); kein STARTTLS, keine Auth-Prüfung. Zum Nachstellen von Flows mit `secure=none`.

## 4. Komponenten (modul-lokal)

| Komponente | Datei | Zweck | Props (Name: Typ, default) | Events/Callbacks | Snippets/Slots | Interner State | Verwendete Shared-Komponenten |
|---|---|---|---|---|---|---|---|
| `EmailComposer` | `src/lib/components/ui/EmailComposer.svelte` (212) | Betreff/Nachricht/Anhänge-Formular, layout-only, kein Remote-Aufruf | `subject: string` ($bindable ''), `body: string` ($bindable ''), `attachments: ComposerAttachment[]` ($bindable []), `maxBytesPerFile?: number` (10 MiB), `disabled?: boolean` (false), `hint?: string`, `allowHtml?: boolean` (false), `asHtml?: boolean` ($bindable false) (`:28-53`) | keine (alles über bindable Props) | keine | `fileInput` ref; Dateien via `FileReader.readAsDataURL` → Base64 ohne Präfix (`:57-67`); Größen-Check mit Toast `„<name>" ist größer als <mb> MB.` (`:74-82`); Lesefehler-Toast (`:97`); `removeAt` (`:104-106`) | `busy` (disabled bei `busy.active`), `toast`, Lucide `Paperclip`/`X`; DaisyUI `input`, `textarea` (`maxlength=200/50000`), `checkbox` |
| `SmtpTestSend` | `src/routes/settings/SmtpTestSend.svelte` (104) | Testversand-Fieldset unter dem SMTP-Formular | `defaultRecipient?: string` (''), `dirty?: boolean` (false), `send: (recipient) => Promise<SendResult>` (`:11-23`) | `send`-Callback | keine | `recipient`, `seeded` (einmaliges Prefill, `:28-34`), `fieldError`, `inlineError`; Regex-Validierung `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (`:41-42`); Toast `Testnachricht an <adresse> versendet.`; Server-Fehler inline als `role="alert"` (`:98-102`) | `busy`, `toast`, `handleClientError`; Formular mit `novalidate` (`:68`) |
| `MailingsHost` | `src/routes/mailings/MailingsHost.svelte` (15) | Test-Host: `<svelte:boundary>` um die async Page | keine | – | `pending` Snippet | – | nur von `page.test.ts` importiert |
| Reminders-Listenseite | `src/routes/reminders/+page.svelte` | s. §1 | – | – | – | `items`, `reminders` ($state-Spiegel), `totals` ($derived) | `PageHeader` (primaryAction), `StatCard` ×3, `EmptyState`, DaisyUI `table` + mobile `ul` |
| Sent-Listenseite | `src/routes/sent/+page.svelte` | s. §1 | – | – | `toolbar`/`filters` Snippets von `PageHeader`/`Toolbar` | `pageNum`, `q`, `type`, `viewYear`, `viewMonth`, `lastResult` | `PageHeader`, `Toolbar` (`bind:query`, `onQuery` setzt `pageNum=1`), `Pagination`, `EmptyState`, `status-labels` |
| Mailings-Seite | `src/routes/mailings/+page.svelte` | s. §1 | – | – | – | `subject`, `body`, `asHtml`, `attachments`, `confirmOpen`, `errorMsg`, `canCompose` | `PageHeader`, `EmailComposer`, `ConfirmDialog`, `EmptyState` |

Shared Utilities: `documentTypeLabel` (`src/lib/utils/status-labels.ts:230-251`: invoice/offer/cost_estimate/order_confirmation/reminder*/customer_letter/mailing; **kein** Fall für `tire_reminder`, `appointment_confirmation` → Rohkey wird angezeigt), `sentMessageStatusLabel/Badge` (`:178-206`: sent „Gesendet", failed „Fehlgeschlagen", pending „In Warteschlange"), `reminderLevelLabel/Badge` (`:214-227`).

## 5. Tabellen

| Tabelle | Relevante Spalten / Enums | Fundstelle |
|---|---|---|
| `smtp_settings` (Singleton) | `host` ('' default), `port` (587), `secure` varchar(10) `'none'|'STARTTLS'|'TLS'` (Default `STARTTLS`), `username`, `password` text (AES-GCM-Chiffrat `v1:…` oder Legacy-Klartext, '' = keins), `from_address`, `from_name`, `reply_to` nullable, `verified` (immer false, dormant), `updated_at` | `schema.ts:125-139`; Migration `0000:322-334` (Spalte hieß `password_encrypted`), `0021` Rename auf `password` |
| `mail_templates` | `key` varchar(50) unique, `subject` varchar(200), `body` text, `is_custom`, `updated_at` | `schema.ts:148-161` |
| `company_settings` (Mail-Anteil) | `email` (Ziel Kontakt-Notification, List-Unsubscribe), `salutation_style` `'Sie'|'Du'`, `iban/bic/bank_name/phone/company_name` (Platzhalter), `reminder_auto_enabled` (default true, **wirkungslos**), `reminder_days_1` (default 3), `reminder_recur_every_days` (default 14; Migration 0014 legte 7 an, 0024 hob Default auf 14), `small_business_exempt` | `schema.ts:45,61-63,72-98`; `drizzle/0014`, `0024` |
| `customers` (Anteil) | `email` nullable, `wants_broadcast` (default false, Index), `wants_tire_reminders`, `archived`, `company/first_name/last_name/salutation` | `schema.ts:185,208,216,219,233` |
| `documents` (Anteil) | `reminder_level` int default 0 (Zähler), `status` (`draft|created|sent|open|paid|cancelled|storno|converted` lt. `status-labels.ts:38-48`), `due_date`, `gross_total`, `customer_id`, `vehicle_id` | `schema.ts:592` |
| `document_payments` | `document_id`, `amount` (Teilzahlungssumme für `openAmount`) | `reminders.remote.ts:31-38` |
| `reminders` | `document_number` unique (`ZE-YYYY-NNNN`), `invoice_id` FK cascade, `level` (laufender Zähler), `issue_date`, `due_date` ("Zahlbar bis"), `status` varchar(20) default `'open'` (dokumentiert `open|sent|paid|cancelled`, **nur `open` wird je geschrieben**), `notes`; Unique `(invoice_id, level)`, Indizes `invoice_id`, `status` | `schema.ts:752-788` |
| `reminder_pdfs` | `reminder_id` unique FK cascade, `input_hash`, `filename`, `mime`, `size`, `data` bytea | `schema.ts:797-814` |
| `number_ranges` | Kind `reminder`, `format_template` `ZE-{YYYY}-{NNNN}` (0024 migrierte `MA-…`) | `seed-defaults.ts:162`, `drizzle/0024:25-27` |
| `sent_messages` | `document_id` nullable FK set null, `document_type` varchar(30) (Werte: `invoice, offer, cost_estimate, order_confirmation, reminder_1, tire_reminder, appointment_confirmation, mailing`), `recipient_email`, `recipient_name` varchar(200), `subject` varchar(200), `body_text` (immer Plain-Text), `attachment_meta` jsonb `[{name,size}]`, `sent_at` default now (= Insert-Zeit, nicht Erfolgszeit), `status` `'pending'|'sent'|'failed'`, `error_message` (roh), `smtp_message_id`; Indizes `sent_at`, `document_id` | `schema.ts:1073-1097` |
| `customer_inquiries` (Anteil) | `notification_status` `'pending'|'sent'|'failed'`, `notification_sent_at`, `notification_error` | `schema.ts:1489-1495`, `drizzle/0023` |
| `tire_reminder_log` (Anteil) | Unique `(customer_id, season, year)` — Idempotenz des Saison-Versands | `schema.ts:1741-1755` |

## 6. Flows (durchgängig, Start bis Ende)

- **Rechnung/Angebot per E-Mail senden** — `/invoices/[id]` Header-CTA „Versenden" → `ConfirmDialog` „Rechnung per E-Mail senden?" / „Die Rechnung wird mit der hinterlegten SMTP-Konfiguration an den Kunden geschickt." / „Jetzt senden" (`invoices/[id]/+page.svelte:857-865`) → `sendInvoiceRemote` → `sendDocumentEmail` (Vorlage `invoice`, PDF-Anhang) → Status `sent` → Toast (im Rechnungsmodul).
  - Validierungsfehler: 400 `'Dieses Dokument ist keinem Kunden zugeordnet.'`, `'Der Kunde hat keine hinterlegte E-Mail-Adresse.'`
  - Fehlerzustand: SMTP-Fehler → 400 `E-Mail konnte nicht versendet werden: <roher SMTP-Fehler>` als Toast; `sent_messages`-Zeile `failed`; Status bleibt.
  - Berechtigung: `invoices`/`offers` (401/403 via Guard).
- **Zahlungserinnerung manuell senden (OP-Liste)** — `/reminders` Zeile → Button „Senden" (Title „Zahlungserinnerung senden" / „… erneut senden", `:186-201`) → `busy.run(createPaymentReminderRemote + refresh())` → Toast `Zahlungserinnerung versendet.` (`:57`). Kein Bestätigungsdialog auf der OP-Liste.
  - Leerzustand: `EmptyState` „Keine offenen Rechnungen" / „Alle Rechnungen sind bezahlt." (`:129-133`)
  - Ladezustand: globaler `busy`-Balken/Overlay; Buttons `disabled={busy.active}`
  - Fehlerzustand: `handleClientError(err, 'Zahlungserinnerung konnte nicht versendet werden')` (`:59`) — 400-Meldungen aus §2.1
  - Irreführender Erfolg: Toast erscheint auch, wenn der Kunde keine E-Mail hat (stiller No-op) oder SMTP fehlschlägt (Fehler nur in `sent_messages`/Konsole).
- **Zahlungserinnerung aus der Rechnung** — `/invoices/[id]`: Banner „Rechnung überfällig" mit Button „Zahlungserinnerung senden" (direkt, ohne Dialog, `:341-365`) bzw. Banner „N Zahlungserinnerung(en) versendet / Letzte Erinnerung am …" mit „Erneut senden" → `ConfirmDialog` „Zahlungserinnerung erneut senden?" / „Es wird eine weitere Zahlungserinnerung mit dem gleichen freundlichen Text an den Kunden versendet." / „Jetzt senden" (`:867-875`) → Toast `Zahlungserinnerung versendet.` → `goto('/reminders/<id>')` (`:251-261`).
- **Batch „Fällige jetzt versenden"** — `/reminders` Header-PrimaryAction (`:95-103`, Icon `RefreshCw`) → `autoSendDuePaymentRemindersRemote` → Toast `Keine fälligen Zahlungserinnerungen.` bzw. `<n> Zahlungserinnerung(en) versendet · <m> fehlgeschlagen` (`:75-82`); Fehler → `handleClientError(err, 'Batch-Versand fehlgeschlagen')`. Kein Bestätigungsdialog, keine Vorschau der Kandidaten, kein Fortschritt.
- **Zahlungserinnerung ansehen** — `/reminders` Historie-Zeile/„Details" oder `/invoices/[id]` Tabelle → `/reminders/[id]`: Info-Alert mit „Zur Rechnung", Karte „Forderungsaufstellung" (Rechnungsbrutto = „Offener Betrag"), `PdfViewer` (404 falls Render bei Erstellung scheiterte), Karte „Details" (Typ-Badge `N. Zahlungserinnerung`, Datum, Zahlbar bis, Kunde, Rechnung, Notizen). Keine Aktionen (kein erneutes Senden/Rendern, kein Download-Hinweis außer im Viewer). Fehler → `+error.svelte` (kein try/catch).
- **Gesendet durchsuchen** — `/sent`: Toolbar-Suche (Placeholder „Suchen: Empfänger, Betreff ...", `:117`), Select „Alle Typen | Rechnung | Angebot | Kostenvoranschlag | Zahlungserinnerung | Serienbrief" (`:127-132`), Monatskarte „‹ Heute ›" + `<Monat> <Jahr>` (`:140-170`), Tabelle Datum/Typ/Empfänger/Betreff/Status, Zeile → `/sent/[id]`, `Pagination` 25 (`:218-224`). Filterwechsel setzt `pageNum=1` (`:57,63,71,119,125`).
  - Leerzustand: „Noch keine versendeten Dokumente" / „Sobald Sie Dokumente per E-Mail versenden, erscheinen sie hier." (`:175-179`) — auch bei leerem Monat/Filter (gleicher Text).
  - Fehlerzustand: `$effect` → `handleClientError(query.error)` (`:105`), Tabelle zeigt `lastResult`.
- **Gesendet-Detail** — `/sent/[id]`: Kopfdaten (Empfänger, Datum, Typ, Status, Message-ID), bei `failed` Alert „SMTP-Fehler" mit rohem `errorMessage` (`:71-79`), Karte „Nachricht" mit `<pre>`-Body (`:83-88`), `PdfViewer` wenn `pdfKind && documentId` (`:90-92`). Kein „Erneut senden", keine Anhangsliste (`attachmentMeta` wird nicht gerendert).
- **Rundschreiben senden** — `/mailings`: Karte „Empfänger" (Anzahl mit Opt-in + E-Mail, Hinweis auf übersprungene ohne E-Mail, Beispielnamen, `:105-135`); Karte „Nachricht verfassen" mit `EmailComposer allowHtml` (Hint: „Empfänger erhalten die Nachricht via BCC, … Eine Abbestellen-Fußzeile wird automatisch angehängt.", Composer `disabled={!canCompose}`); Button „Senden" (nie wegen Eingaben deaktiviert) → `requestSend` Click-Validierung: `'Es sind keine Empfänger mit Newsletter-Opt-in und E-Mail-Adresse vorhanden.'`, `'Bitte einen Betreff eingeben.'`, `'Bitte einen Nachrichtentext eingeben.'` als `alert-error role="alert"` (`:47-63,150-154`) → `ConfirmDialog` „Serienbrief senden" / „<n> Empfänger anschreiben?" / „Jetzt senden" (`:224-232`) → `busy.run(sendBroadcastEmailRemote)` → Toast `Serienbrief versendet an <n> Empfänger.` oder `toast.warning('Serienbrief: <s> erfolgreich, <f> fehlgeschlagen.')` (`:79-85`) → Felder geleert.
  - Leerzustand Empfänger: Text „Aktuell ist kein Kunde mit Newsletter-Opt-in … Aktivieren Sie das Häkchen „Newsletter" auf einer Kundenkarte …" (`:108-113`); Historie leer: `EmptyState` „Noch keine Serienbriefe versendet".
  - Fehlerzustand: `handleClientError(err, 'Serienbrief konnte nicht versendet werden')`; bei fehlender SMTP-Konfiguration → 500 → generischer Toast (Formularinhalt bleibt erhalten).
  - Nach Erfolg: Historie-Karte aktualisiert sich **nicht** (statischer Snapshot, `:28-30`).
  - Opt-out: Empfänger antwortet mit Betreff „Abbestellen" an `companySettings.email` (bzw. Reply-To/From); Operator setzt `wantsBroadcast=false` manuell auf der Kundenkarte (ADR-017). Keine In-App-Unterstützung.
- **Ad-hoc-E-Mail an Kunden** — `/customers/[id]` Button „E-Mail schreiben" (deaktiviert ohne E-Mail, Title „Keine E-Mail-Adresse hinterlegt", `:243-255` — Abweichung von Regel „Buttons nie wegen Eingaben deaktivieren", hier Modus-Gate) → Modal „E-Mail schreiben" mit „An <Name <mail>>", `EmailComposer allowHtml`, Buttons „Abbrechen"/„Senden" (`:552-613`) → Click-Validierung (`'Für diesen Kunden ist keine E-Mail-Adresse hinterlegt.'`, Betreff, Nachricht, `:187-200`) → `sendAdHocCustomerEmailRemote` → Toast `E-Mail versendet.`; Fehler → `handleClientError(err, 'E-Mail konnte nicht versendet werden')`. Kein Bestätigungsdialog, kein Entwurf.
- **Mailvorlage bearbeiten** — `/settings/mail`: Select „Vorlage" (Label aus `templateLabel`, Suffix „ · angepasst" bei `isCustom`, `:112-121`), „Betreff" (`maxlength=200`), „Nachricht" (`textarea maxlength=20000 font-mono`), Platzhalter-Hinweis (`:140-159`), Buttons „Auf Standard zurücksetzen" (ohne Rückfrage) / „Speichern" → Toasts `Mailvorlage gespeichert.` / `Mailvorlage zurückgesetzt.`; Fehler `… konnte nicht gespeichert werden` / `Vorlage konnte nicht zurückgesetzt werden`. Kein Preview, keine Platzhalter-Prüfung, kein `novalidate` (aber keine `required`).
  - Ladezustand: Formular erscheint erst, wenn `templates.length > 0` (`:103`); ohne Vorlagen bleibt die Seite leer (kein Leerzustand).
- **SMTP konfigurieren + Testversand** — `/settings/smtp`: Fieldset „Absender" (Absender-Adresse*, Absender-Name*), „Server" (SMTP-Host*, Port* 1–65535, Verschlüsselung* `STARTTLS | TLS (SSL) | Keine` mit Auto-Port 587/465/25 beim Wechsel `:177-184`, Benutzername*, Passwort mit Placeholder `••••••••••` und Label „(leer lassen = behalten)" wenn gespeichert `:200-211`), „Speichern" → `updateSmtpRemote` → Toast `SMTP-Konfiguration gespeichert.`, Passwortfeld geleert (`:76-79`). **Formular ohne `novalidate` mit `required`-Attributen** → Browser-Native-Validierung statt Click-Time-Meldungen (`:119-124,134,144,158,168,196`). Reply-To ist nicht editierbar und wird beim Speichern auf `null` gesetzt (`:73`, `settings.remote.ts:397`).
  - Testversand-Karte: Hinweis „Sendet eine Testnachricht über die zuletzt gespeicherten SMTP-Einstellungen."; Warnung „Speichern Sie geänderte SMTP-Einstellungen vor dem Test." bei `smtpFormDirty` (`:93-114`); Empfänger vorbelegt mit `company.email`; Click-Validierung `'Bitte eine gültige Empfängeradresse eingeben.'`; Erfolg-Toast; kuratierte Fehlermeldung inline; 429 bei Doppelklick → `handleClientError(err, 'Testversand fehlgeschlagen')`.
- **Zahlungserinnerungs-Einstellungen** — `/settings/reminders`: Info-Alert (Text `:117-122`), Toggles „Zahlungserinnerungen automatisch versenden" und „Kleinunternehmer (§ 19 UStG)", Zahlenfelder „Erste Erinnerung nach (Tagen nach Fälligkeit)" (0–365) und „Folge-Erinnerung alle (Tage)" (1–365, Live-Hinweis „… alle N Tage erneut versendet."), Fieldset „Vorlagentext" (Betreff/Nachricht der `reminder_1`, Platzhalter-Hinweis `{firma}, {rechnungNummer}, {rechnungDatum}, {rechnungOffenerBetrag}, {verzugstage}, {fälligkeitsDatum}`, Button „Auf Standard zurücksetzen") → „Speichern" ruft **zwei** Commands sequentiell (`updateReminderSettingsRemote`, dann `updateMailTemplateRemote`, `:74-88`) → Toast `Einstellungen für Zahlungserinnerungen gespeichert.`; Reset-Toast `Vorlage zurückgesetzt.`. Validierungsfehler kommen als Toast über `handleValidationError` (Label-Prefix roher Key, da `reminderDays1`/`reminderRecurEveryDays` nicht in `FIELD_LABELS`).
- **Berechtigungs-Verweigerung (alle Flows)**: Guards werfen 401 (`requireUser`) / 403; Nav-Filter blendet Einträge aus; direkter Aufruf einer Route ohne Permission → Remote-Fehler → `+error.svelte`. `/sent` ist mit `offers` oder `reminders` per Remote erreichbar, aber nur mit `invoices` in der Navigation.

## 7. Nebenwirkungen

- **E-Mails** (alle über `mail-service.ts`, Transport aus `smtp_settings`, From `fromName <fromAddress>`, Reply-To `smtp.replyTo` außer Kontakt-Notification):
  - Vorlage `invoice|offer|cost_estimate|order_confirmation` → Kunde des Belegs, Trigger `sendInvoiceRemote`/`sendOfferRemote`, PDF-Anhang aus `document_pdfs` (Cache oder Render).
  - Vorlage `reminder_1` → Kunde der Rechnung, Trigger `createPaymentReminderRemote`/Batch, **ohne** PDF.
  - Vorlage `tire_reminder` → Kunden mit `wantsTireReminders` + aktiver Einlagerung, Trigger `/settings/tire-reminders`.
  - Vorlage `appointment_confirmation` → Bucher, Trigger öffentliche Terminbuchung.
  - Ohne Vorlage: Ad-hoc (Composer-Text, optional HTML, Anhänge Base64), Broadcast (BCC-Batches à 50, Fußzeile, `List-Unsubscribe`), Kontakt-Notification (an `companySettings.email`, Reply-To = Absender der Anfrage), SMTP-Test (an eingegebene Adresse, nicht protokolliert).
- **Protokoll**: jede Nachricht außer dem Testversand → `sent_messages` (`pending` → `sent`/`failed`), Broadcast eine Zeile je Empfänger.
- **PDFs**: `renderAndPersistReminderPdf` bei jeder Zahlungserinnerung (`reminder_pdfs`, `pdf-lib`, best-effort); Beleg-PDF-Render on demand beim Versand, falls Cache leer.
- **Uploads**: Anhänge im Browser als Base64 (`EmailComposer`), Client-Cap 10 MiB/Datei, Server-Cap 14 000 000 Zeichen Base64 je Anhang (`mailings.remote.ts:29`, identisch in `customers.remote.ts`), kein Cap auf Anzahl; Speicherort: keiner (nur im Request, `attachmentMeta` Name+Größe).
- **Nummernkreise**: `reminder` (`ZE-{YYYY}-{NNNN}`) je Zahlungserinnerung, atomar in `allocateNumber`, aber außerhalb einer Transaktion mit dem Insert.
- **Exporte/Webhooks/externe APIs**: keine (SMTP ist der einzige externe Kanal).
- **Zustandsänderungen**: `documents.reminderLevel`++, `documents.status='sent'` nach Belegversand, `customer_inquiries.notification*`, `tire_reminder_log`-Insert, `smtp_settings.verified=false` bei jedem Save, `mail_templates.isCustom`.

## 8. Vorhandene Tests

| Testdatei | Art | Was wird abgedeckt (1 Zeile) |
|---|---|---|
| `src/lib/server/services/mail-service.test.ts` (1576) | integration (pg-mem, nodemailer gemockt) | Platzhalter-Rendering inkl. Du/Sie/Firma-Anrede, `extra`-Override, fehlende Vorlage, SMTP-fehlt-Pfad + Audit, Transport-Optionen (STARTTLS/TLS/ohne Auth), From/Reply-To, PDF-Anhang/Reminder ohne Anhang/Render-Fehler, Failure-Path + pending-vor-send, Ad-hoc (Anhänge, HTML-Fallback, Data-URL, Kunde fehlt/ohne Mail), Broadcast (0 Empfänger, ohne Mail überspringen, BCC, 50er-Batches, Teilfehler, Anhänge, Fußzeile, List-Unsubscribe + Fallback, HTML), Terminbestätigung (Berlin-Zeit, Leistung optional, Fehler, Audit), Kontakt-Notification (Referenzen used-car/tire, Fallback, Reply-To, Fehler, fehlende Firmenmail, `recordInquiryNotificationResult`), `mapSmtpTestError` alle Klassen, `sendSmtpTestMail` (Config fehlt, Timeouts, Entschlüsselung, kein Audit, kuratierter Fehler, ohne Auth) |
| `src/lib/server/services/smtp-settings-service.test.ts` (128) | integration | Insert verschlüsselt, leeres Passwort beim Insert, Update statt zweiter Row, Passwort behalten bei leerer Eingabe, Re-Encrypt, `verified` Reset |
| `src/lib/server/crypto.test.ts` (109) | unit | Roundtrip, frischer IV, Tamper-Erkennung, Formatversion, `APP_SECRET`-Fallback, fail-closed, Cross-Key, `decryptSecretIfNeeded` Legacy-Durchleitung |
| `src/lib/server/services/reminder-service.test.ts` (240) | integration (PDF+Mail gemockt) | `sendPaymentReminder`: Level 1, Zähler 1→3, Refusal paid/cancelled/non-invoice; wiederholte Sends, Status immer `open`. **Kandidaten-Finder/Auto-Batch nicht getestet** (Kommentar `:327-332`: pg-mem kann die Subquery nicht ausführen) |
| `src/routes/mailings/mailings.remote.test.ts` (381) | integration (`$app/server` gefaked) | 401/403 für alle drei Remotes, Preview-Zählung, Send-Weiterleitung, leerer Betreff, 14-MB-Cap, Historie nur `mailing`, Cap 10 |
| `src/routes/mailings/page.test.ts` (77) | component (`MailingsHost`) | Senden nie deaktiviert, Betreff-/Nachricht-Fehler ohne Dialog |
| `src/lib/components/ui/EmailComposer.test.ts` (57) | component | HTML-Toggle sichtbar/unsichtbar, Label-Wechsel, initiales `asHtml` — **kein Test für Dateiauswahl/Größen-Cap/Entfernen** |
| `src/routes/settings/settings.remote.test.ts` (387) | integration | Stundensatz-Remotes; SMTP-Testversand: 401/403, ungültiger Empfänger, Erfolg via persistierte Settings, Config fehlt, 429 in-flight, 429 Cooldown |
| `src/routes/settings/SmtpTestSend.test.ts` (124) | component | Button aktiv, Prefill, Click-Validierung + `input-error`, Trim + Toast, Inline-Alert + Clearing, Dirty-Hinweis |
| `e2e/smoke.spec.ts:39-75` | e2e | `/sent` Leerzustand, `/reminders` Titel + Batch-Toast „Keine fälligen Zahlungserinnerungen.", `/mailings` Click-Validierung ohne Dialog |
| `e2e/settings.spec.ts:19-24,70-106` | e2e | Tabs Mailvorlagen/Zahlungserinnerung/SMTP/Reifen-Erinnerungen erreichbar, `?tab=smtp`-Redirect, Testversand-Validierung (ungültig + leer, kein Alert) |
| `e2e/navigation.spec.ts:33-55` | e2e | Nav-Einträge „Offene Rechnungen", „Rundschreiben"→„Serienbriefe", „Gesendet" |

**Ohne Tests**: `reminders.remote.ts` (alle Remotes, inkl. Permission-Gates), `sent.remote.ts` (Filter, Datums-Parsing, `pdfKind`), Seiten `/reminders`, `/reminders/[id]`, `/sent`, `/sent/[id]`, `/settings/mail`, `/settings/smtp` (Formular), `/settings/reminders`, `updateMailTemplateRemote`/`resetMailTemplateRemote`/`updateSmtpRemote`/`updateReminderSettingsRemote`, `listDuePaymentReminderCandidates`/`autoSendDuePaymentReminders` gegen echte DB, `dev-mail-catcher.js`.

## 9. Feature-Matrix

| ID | Feature | Routen | Endpoints/Remotes | Tabellen | Erwartetes Verhalten |
|---|---|---|---|---|---|
| F-414 | SMTP-Transport aus Einstellungen (Host/Port/Modus none·STARTTLS·TLS/Auth) | – | `buildTransport` (`mail-service.ts:196-217`) | `smtp_settings` | `TLS`→`secure:true`; `STARTTLS`→`requireTLS:true`; `none`→beides false; Auth nur bei Username; Passwort via `decryptSecretIfNeeded`; fehlt Host/From → deutscher Fehler; keine Timeouts |
| F-415 | Absender-Header From/Reply-To | – | alle Send-Funktionen | `smtp_settings` | `From = "<fromName> <fromAddress>"` oder bare Adresse; `Reply-To = smtp.replyTo` (Kontakt-Notification: Anfragender) |
| F-416 | Platzhalter-Engine `{key}` mit Firmen-, Kunden-, Fahrzeug-, Beleg-Variablen, Anrede-Stil Sie/Du, `extra`-Override, unbekannte Keys bleiben stehen | – | `buildVars`, `render` | `company_settings` | Tabelle in §3.1; nur Plain-Text, kein Escaping |
| F-417 | Vorlagen-Versand mit PDF-Anhang für Rechnung/Angebot/KV/AB | `/invoices/[id]`, `/offers/[id]` | `sendDocumentEmail` | `mail_templates`, `document_pdfs`, `sent_messages` | Anhang aus Cache/Render; Render-Fehler → still ohne Anhang; Erfolg setzt Belegstatus `sent` (im Aufrufer) |
| F-418 | Versandprotokoll `sent_messages` (pending → sent/failed, Fehlertext, Message-ID, Anhang-Metadaten) | `/sent` | alle Send-Funktionen außer Test | `sent_messages` | Row vor Transportaufbau; Status-Flip danach; Rohfehler in `error_message`; kein Retry |
| F-419 | Ad-hoc-E-Mail an einen Kunden (Composer-Modal, Anhänge, HTML-Option) | `/customers/[id]` | `sendAdHocCustomerEmailRemote`, `sendAdHocCustomerEmail` | `customers`, `sent_messages` | Guard `customers`; Button ohne E-Mail deaktiviert; Click-Validierung; `documentType='mailing'`; HTML → `text` via `htmlToPlainText` |
| F-420 | HTML-Versand opt-in mit automatischem Plain-Text-Fallback, Audit speichert nur Text | `/customers/[id]`, `/mailings` | `sendAdHocCustomerEmail`, `sendBroadcastEmail` | `sent_messages` | `asHtml=true` → `html` + `text`; Composer-Label „Nachricht (HTML-Quelltext)", Monospace |
| F-421 | Anhänge im Composer (Mehrfachauswahl, 10-MiB-Cap/Datei mit Toast, Entfernen, Größenanzeige) | `/customers/[id]`, `/mailings` | – (Client) + Valibot 14 000 000 Zeichen | – | Base64 im Speicher; Serverseitig Filename 1..255, MIME ≤100 |
| F-422 | Rundschreiben: Empfänger-Vorschau (Opt-in gesamt, mit E-Mail, 5 Beispielnamen) | `/mailings` | `previewBroadcastRecipientsRemote` | `customers` | `archived=false AND wantsBroadcast=true`; Hinweis auf übersprungene ohne E-Mail |
| F-423 | Rundschreiben senden in BCC-Batches à 50 mit Teilfehler-Toleranz, Ergebnis `{sent, failed}` | `/mailings` | `sendBroadcastEmailRemote`, `sendBroadcastEmail` | `customers`, `sent_messages`, `smtp_settings`, `company_settings` | ConfirmDialog mit Empfängerzahl; Toast success/warning; Formular geleert; `to`=Absender selbst |
| F-424 | Abbestellen-Fußzeile (Text+HTML) + `List-Unsubscribe`-mailto-Header; Opt-out manuell durch Operator | `/mailings` | `sendBroadcastEmail` | `company_settings.email`, `customers.wants_broadcast` | Adresse: Firmenmail → Reply-To → From; Ad-hoc-Mails ohne Fußzeile |
| F-425 | Rundschreiben-Historie (letzte 10 Empfängerzeilen mit Status) | `/mailings` | `listBroadcastHistoryRemote` | `sent_messages` | nur `documentType='mailing'`, `sentAt DESC`, Limit 10, keine Pagination, kein Link ins Detail |
| F-426 | Gesendet-Liste: Suche (Empfänger/Betreff/Name), Typfilter, Monatsnavigation, Pagination 25 | `/sent` | `listSentRemote` | `sent_messages` | Filterwechsel → Seite 1; stale-while-revalidate; Zeile → Detail |
| F-427 | Gesendet-Detail: Kopfdaten, Status-Badge, SMTP-Fehlertext, Body-Text, PDF-Viewer (Beleg/Reminder) | `/sent/[id]` | `getSentMessageRemote`, `getDocumentPdfBytesRemote`/`getReminderPdfBytesRemote` | `sent_messages`, `document_pdfs`, `reminder_pdfs` | `pdfKind` aus `documentType`; kein Resend, keine Anhangsliste |
| F-428 | OP-Liste offener Rechnungen mit Verzugstagen, Offen-Betrag (abzgl. Teilzahlungen), Erinnerungszähler, letzte Erinnerung; StatCards Offene Beträge / Überfällige Rechnungen / Überfälliger Betrag | `/reminders` | `listOpenInvoicesRemote` | `documents`, `document_payments`, `reminders`, `customers` | Status-Ausschluss paid/cancelled/storno/draft/converted; Sortierung Fälligkeit ASC; Desktop-Tabelle + Mobile-Cards; Zeile → `/invoices/[id]`; unpaginiert |
| F-429 | Zahlungserinnerung manuell senden (OP-Liste ohne Dialog; Rechnung mit Banner-CTA und ConfirmDialog bei Wiederholung) | `/reminders`, `/invoices/[id]` | `createPaymentReminderRemote`, `sendPaymentReminder` | `reminders`, `documents`, `number_ranges`, `reminder_pdfs`, `sent_messages`, `mail_templates` | Immer neue Zeile `level+1`, Nummer `ZE-YYYY-NNNN`, `dueDate = heute + reminderDays1`, PDF gerendert, Mail `reminder_1` best-effort; Refusal paid/cancelled/nicht-Rechnung |
| F-430 | Batch „Fällige jetzt versenden" (erste Erinnerung `dueDate + reminderDays1`, Folge `letzte + reminderRecurEveryDays`) | `/reminders` | `autoSendDuePaymentRemindersRemote`, `listDuePaymentReminderCandidates`, `autoSendDuePaymentReminders` | wie F-429 | Sequentiell, Fehler gezählt, Toast mit Zahlen; kein Scheduler (ADR-009); Toggle `reminderAutoEnabled` ohne Wirkung |
| F-431 | Historie versendeter Zahlungserinnerungen (global + je Rechnung) | `/reminders`, `/invoices/[id]` | `listRemindersRemote`, `listRemindersForInvoiceRemote` | `reminders`, `documents`, `customers` | Global: nur `status='open'` (faktisch alle), `issueDate DESC`, unpaginiert; je Rechnung `level ASC`; Badge „N. Erinnerung" |
| F-432 | Zahlungserinnerungs-Detail mit PDF-Viewer und Forderungsaufstellung | `/reminders/[id]` | `getReminderRemote`, `getReminderPdfMetaRemote`, `getReminderPdfBytesRemote` | `reminders`, `documents`, `customers`, `reminder_pdfs` | Nur Cache-PDF (404 bei fehlendem Render); „Offener Betrag" = Rechnungsbrutto; keine Aktionen |
| F-433 | Reminder-Banner auf der Rechnung (überfällig / N versendet, letzte am …) mit CTA und Link „Zur letzten Erinnerung" | `/invoices/[id]` | `listRemindersForInvoiceRemote` | `reminders` | überfällig = `dueDate < heute` und nicht paid/cancelled |
| F-434 | Zahlungserinnerungs-Einstellungen: Auto-Toggle, Kleinunternehmer-Toggle, Erste Erinnerung nach N Tagen (0–365), Folge alle N Tage (1–365) | `/settings/reminders` | `updateReminderSettingsRemote` | `company_settings` | Valibot mit deutschen Meldungen; Default 3/14; Einmal-Initialisierung aus `getAllSettingsRemote` |
| F-435 | Inline-Editor der Vorlage `reminder_1` in den Zahlungserinnerungs-Einstellungen inkl. Reset | `/settings/reminders` | `updateMailTemplateRemote`, `resetMailTemplateRemote` | `mail_templates` | Gemeinsamer „Speichern"-Button (zwei Commands); Reset re-hydriert Editor |
| F-436 | Mailvorlagen-Verwaltung: 8 Vorlagen (Select mit deutschen Labels, „· angepasst"), Betreff ≤200, Body ≤20 000, Speichern (`isCustom=true`), Reset auf Seed-Default | `/settings/mail` | `listMailTemplatesRemote`, `updateMailTemplateRemote`, `resetMailTemplateRemote` | `mail_templates` | Sortierung alphabetisch nach Key; Platzhalter-Hinweisliste statisch; kein Preview/Testversand der Vorlage |
| F-437 | Seed der Standard-Vorlagen und leeren SMTP-Zeile bei Setup/erstem Request | `/setup`, hooks | `seedDefaults` | `mail_templates`, `smtp_settings`, `number_ranges` | idempotent (`onConflictDoNothing`); Reset nutzt dieselbe Quelle |
| F-438 | SMTP-Formular (Absender-Adresse/-Name, Host, Port mit Auto-Vorschlag je Modus, Verschlüsselung, Benutzer, Passwort „leer = behalten") | `/settings/smtp` | `updateSmtpRemote`, `upsertSmtpSettings` | `smtp_settings` | Passwort nie zum Client (`hasPassword`); Save verschlüsselt, setzt `verified=false`; Reply-To nicht editierbar |
| F-439 | SMTP-Passwort verschlüsselt at rest (AES-256-GCM, Legacy-Klartext toleriert) | – | `encryptSecret`, `decryptSecretIfNeeded` | `smtp_settings.password` | Key aus `APP_ENCRYPTION_KEY`/`APP_SECRET`; Setup-Wizard nutzt denselben Upsert |
| F-440 | SMTP-Testversand mit 10-s-Timeouts, kuratierten deutschen Fehlermeldungen, Dirty-Hinweis, Empfänger-Prefill, Double-Fire-Guard (429) | `/settings/smtp` | `sendSmtpTestMailRemote`, `sendSmtpTestMail`, `mapSmtpTestError` | `smtp_settings`, `company_settings.email` | Nicht in `sent_messages`; Rohfehler nur Server-Log |
| F-441 | Reifenwechsel-Erinnerung (Vorlage `tire_reminder`, Saison-Idempotenz) | `/settings/tire-reminders` | `sendTireRemindersRemote` → `sendDocumentEmail` | `tire_reminder_log`, `sent_messages` | Detail im Tires-Inventar; nutzt F-414/03/05 |
| F-442 | Terminbestätigung nach öffentlicher Buchung (Berlin-Zeit, Bestätigungs-Code) | `POST /api/public/appointments` | `sendAppointmentConfirmation` | `mail_templates`, `sent_messages` | best-effort; Audit-Typ `appointment_confirmation` |
| F-443 | Kontaktformular-Benachrichtigung an Firmenmail mit Referenzauflösung (Fahrzeug/Reifen/Artikel), Reply-To = Anfragender, Retry aus Anfragen-Liste | `POST /api/public/contact`, `/settings/inquiries` | `sendContactNotification`, `recordInquiryNotificationResult`, `retryInquiryNotificationRemote` | `customer_inquiries`, `sent_messages` | Audit-Typ `mailing`; Statusspalten am Inquiry |
| F-444 | Deutsche Feldlabels für Validierungsfehler der Mail-Schemas | – | `FIELD_LABELS` (`hooks.server.ts:278-287`) | – | Abgedeckt: subject, body, filename, attachments, username, password, host, port, fromName; nicht: recipient, fromAddress, replyTo, secure, mime, base64Data, key, reminderDays1, reminderRecurEveryDays |
| F-445 | Navigation/Permissions: „Offene Rechnungen" (`reminders`), „Rundschreiben" (`mailings`), „Gesendet" (`invoices`), „Anfragen" (`mailings`), Settings-Tabs Mailvorlagen/Zahlungserinnerung/SMTP (`settings`) | Sidebar, Settings-TabGroup | `filterNavigationByPermissions` | `role_permissions` | Rolle `Mitarbeiter` hat `reminders`+`invoices`, nicht `mailings`/`settings` (`seed-defaults.ts:339-356`) |
| F-446 | Legacy-Deep-Links `/settings?tab=mail\|reminders\|smtp` → Redirect | `/settings` | – | – | `goto(…, { replaceState: true })` |
| F-447 | Dev-Mail-Catcher für lokale Versandtests (.eml-Dateien) | – | `scripts/dev-mail-catcher.js` | – | `127.0.0.1:1025`, `secure=none` |

## 10. Befunde

| ID | Beschreibung | Fundstelle | Auswirkung | Empfehlung | Einordnung | Betroffene Features |
|---|---|---|---|---|---|---|
| B-349 | `/sent/[id]` für Erinnerungs-Mails: `pdfKind='reminder'` wird mit `documentId` = **Rechnungs-ID** an `getReminderPdfBytesRemote` übergeben (die Erinnerungs-Mail speichert `documentId: invoice.id`); Lookup in `reminder_pdfs` per `reminderId` schlägt fehl | `sent.remote.ts:98-104`, `sent/[id]/+page.svelte:90-92`, `reminder-service.ts:182`, `pdfs.remote.ts:97-111` | Jedes Erinnerungs-Detail in „Gesendet" zeigt PDF-Fehler „Für diese Zahlungserinnerung ist kein PDF gespeichert." (Bug) | Reminder-ID in `sent_messages` speichern (eigene Spalte/Polymorphie) oder `pdfKind` auf `document` mappen | im Rewrite beheben | F-427, F-429 |
| B-350 | Typfilter „Zahlungserinnerung" in `/sent` filtert auf `documentType='reminder'`, gespeichert wird `reminder_1`; Typen `order_confirmation`, `tire_reminder`, `appointment_confirmation` fehlen im Filter und in `documentTypeLabel` (Rohkey im Badge) | `sent/+page.svelte:127-132`, `sent.remote.ts:48-50`, `status-labels.ts:230-251` | Filter liefert immer 0 Treffer; Badges zeigen `tire_reminder` etc. | Enum der Mail-Typen zentralisieren (Picklist im Schema, Label-Map vollständig) | im Rewrite beheben | F-426, F-427 |
| B-351 | Ad-hoc-Kundenmails und Kontaktformular-Benachrichtigungen werden mit `documentType='mailing'` protokolliert → erscheinen als „Serienbrief" in `/sent` und in der Rundschreiben-Historie | `mail-service.ts:418,1025`, `mailings.remote.ts:140` | Historie und Filter vermischen drei fachlich verschiedene Mailarten | Eigene Typen `adhoc`, `contact_notification` einführen; Broadcast über Kampagnen-ID gruppieren | im Rewrite beheben | F-419, F-425, F-443 |
| B-352 | `reminderAutoEnabled` wird gespeichert und in der UI angeboten, aber von `listDuePaymentReminderCandidates`/`autoSendDuePaymentReminders` nie gelesen | `settings/reminders/+page.svelte:128-135`, `reminder-service.ts:237-323`, `docs/modules/reminders.md:34` (behauptet Wirkung) | Toggle wirkungslos; Doku falsch | Toggle im Batch auswerten (oder entfernen) | im Rewrite beheben | F-430, F-434 |
| B-353 | `reminders.status` wird nirgends aus `'open'` weiterbewegt; dokumentierter Lebenszyklus `open→sent→paid/cancelled` existiert nicht; `listOpenReminders` filtert auf `open` und liefert damit alle Zeilen unbegrenzt | `reminder-service.ts:198-222`, `schema.ts:773-774`, `docs/modules/reminders.md:35` | Karte „Versendete Zahlungserinnerungen" wächst unpaginiert; Status-Spalte tot | Status beim Mail-Erfolg auf `sent`, bei Rechnungszahlung/Storno auf `paid/cancelled` setzen; Liste paginieren | im Rewrite beheben | F-431 |
| B-354 | `sendPaymentReminder` ist nicht transaktional: Nummernkreis, `reminders`-Insert, `documents`-Update, PDF, Mail laufen getrennt; PDF-Fehler → Erinnerung ohne PDF, kein Re-Render-Pfad (Bytes-Remote liefert nur Cache); Mail-Fehler/fehlende Kunden-E-Mail → stiller No-op, UI toastet trotzdem „Zahlungserinnerung versendet." | `reminder-service.ts:111-142,159-169`, `reminders/+page.svelte:57`, `invoices/[id]/+page.svelte:256`, `pdfs.remote.ts:97-103` | Operator glaubt, Mail sei raus; Zähler und Fälligkeitsintervall laufen weiter; Batch erzeugt alle 14 Tage Erinnerungen an Kunden ohne E-Mail | Kandidaten ohne E-Mail ausschließen bzw. als „manuell/Post" markieren; Rückgabe `{ reminder, mailResult }` und Toast differenzieren; Insert+Update in Transaktion, PDF-Render on demand | im Rewrite beheben | F-429, F-430, F-432 |
| B-355 | `rechnungOffenerBetrag` = `grossTotal` ohne Abzug von Teilzahlungen; Detailseite „Forderungsaufstellung" zeigt ebenfalls Brutto als „Offener Betrag", während die OP-Liste `openAmount` korrekt berechnet | `mail-service.ts:135-136`, `reminders/[id]/+page.svelte:59-79`, `reminders.remote.ts:97` | Erinnerung nennt bei Teilzahlung falschen Betrag (fachlich/rechtlich heikel) | Offenen Betrag aus `document_payments` in `buildVars`/Reminder-Kontext übergeben | im Rewrite beheben | F-416, F-429, F-432 |
| B-356 | Erinnerungs-Mail hängt das erzeugte Reminder-PDF nicht an (`pdfAttachable` ohne `reminder_1`); Platzhalter für Erinnerungsnummer/„Zahlbar bis"/Zähler fehlen (`void reminder`) | `mail-service.ts:255-260`, `reminder-service.ts:176-179` | Kunde erhält nur Text, PDF nur intern | Entscheidung, ob PDF angehängt wird; Reminder-Variablen (`erinnerungNummer`, `zahlbarBis`, `erinnerungNr`) ergänzen | Entscheidung nötig | F-421, F-429 |
| B-357 | `reminderDays1` doppelt belegt: Wartezeit nach Fälligkeit **und** Zahlungsziel der Erinnerung (`dueDate = heute + reminderDays1`, Default 3 Tage) | `reminder-service.ts:105-108` | „Zahlbar bis" auf der Erinnerung nur 3 Tage nach Versand | Eigenes Feld „Zahlungsziel Erinnerung" | Entscheidung nötig | F-429, F-434 |
| B-358 | Rundschreiben-Seite hält Vorschau/Historie als statischen `Promise.all`-Snapshot; server-seitige `.refresh()` erreichen den Client nicht (kein `.updates(...)`) | `mailings/+page.svelte:28-30`, `mailings.remote.ts:109-112` | Historie zeigt den gerade abgeschickten Versand erst nach Reload | `.current`-Pattern oder `.updates()` nutzen | im Rewrite beheben | F-423, F-425 |
| B-359 | Broadcast ohne Kampagnen-Entität und ohne Fortschritt: ein Request für alle Batches, N sequentielle Inserts/Updates, Historie nur 10 Empfängerzeilen (ein Versand an 50 Kunden füllt sie komplett), `failed[]`-Gründe werden im UI nicht gezeigt | `mail-service.ts:539-599`, `mailings.remote.ts:128-144`, `mailings/+page.svelte:79-85` | Bei größeren Listen Request-Timeout-Risiko, keine Übersicht je Versand | Kampagnen-Tabelle + Job/Queue mit Fortschritt; Batch-Insert | Entscheidung nötig | F-423, F-425 |
| B-360 | `buildTransport` ohne `connectionTimeout/greetingTimeout/socketTimeout` (nur der Testversand hat 10 s) | `mail-service.ts:203-216` vs. `:1185-1187` | Nicht erreichbarer SMTP-Host blockiert Beleg-/Broadcast-Requests minutenlang | Timeouts in den produktiven Transport übernehmen | im Rewrite beheben | F-414 |
| B-361 | Rohe SMTP-Fehlertexte erreichen den Nutzer: `error(400, 'E-Mail konnte nicht versendet werden: ' + send.error)` (Toast) und `/sent/[id]` „SMTP-Fehler" zeigt `errorMessage` ungefiltert; im Widerspruch zur kuratierten Behandlung im Testversand | `invoices.remote.ts:359-360`, `offers.remote.ts:348-349`, `customers.remote.ts:375-377`, `sent/[id]/+page.svelte:71-79` | Hostnamen/Banner/Benutzernamen können in der UI landen; verstößt gegen „Toasts nur kuratiertes Deutsch" | `mapSmtpTestError`-artige Klassifizierung für alle Sendepfade, Rohfehler nur ins Log | im Rewrite beheben | F-417, F-418, F-419, F-427 |
| B-362 | Speichern in `/settings/smtp` sendet immer `replyTo: undefined` → `null`; ein im Setup-Wizard gesetztes Reply-To wird stillschweigend gelöscht; Feld in der UI nicht vorhanden | `settings/smtp/+page.svelte:73`, `settings.remote.ts:397`, `setup.remote.ts:162-171` | Datenverlust der Reply-To-Konfiguration | Reply-To-Feld ins Formular aufnehmen | im Rewrite beheben | F-415, F-438 |
| B-363 | SMTP-Formular ohne `novalidate` mit `required`-Attributen → Browser-Native-Validierung; Server erlaubt leeren Host/Namen (`maxLength` ohne `minLength`), keine deutschen Meldungen; `FIELD_LABELS` ohne `fromAddress/replyTo/secure` | `settings/smtp/+page.svelte:119-124,134-196`, `settings.remote.ts:88-97`, `hooks.server.ts:278-287` | Verstößt gegen CONTRIBUTING (Click-Time-Validierung, `novalidate`); Toast „Ungültige Eingabe für „fromAddress" …" | Schema mit `minLength` + deutschen Meldungen, Labels ergänzen, Click-Time-Fehlerzusammenfassung | im Rewrite beheben | F-438, F-444 |
| B-364 | Gespeichertes SMTP-Passwort kann nicht gelöscht werden (leer = behalten); `verified`-Spalte dormant (nie `true`) | `smtp-settings-service.ts:64-67`, `schema.ts:135` | Auth-frei nur über leeren Benutzernamen erreichbar; Spalte ohne Funktion | Explizites „Passwort entfernen"; `verified` nach erfolgreichem Testversand setzen oder Spalte streichen | bewusst später | F-438, F-440 |
| B-365 | `listSentRemote`: `from`/`to` nur `maxLength(10)`, kein Datumsformat → `new Date('x')` Invalid Date → DB-Fehler 500; `size`-Picklist 10/25/50/100 trotz „fest 25"; `page` ohne `minValue(1)` | `sent.remote.ts:19-26,51-56` | Manipulierte Aufrufe erzeugen 500 statt 400; Abweichung von CONTRIBUTING-Pagination | `dateStringSchema`, `size: literal(25)`, `page ≥ 1` | im Rewrite beheben | F-426 |
| B-366 | Platzhalter-Hinweis in `/settings/mail` bewirbt nicht existierende Variablen (`{mahnungGebühr}`, `{mitarbeiterVorname}`, `{periode}`) und verschweigt existierende (`{kundeAnredeName}`, `{kundeName}`, `{kundeVorname}`, `{firmaBank}`, Termin-Platzhalter); Hinweis ist nicht vorlagenspezifisch | `settings/mail/+page.svelte:140-159`, `mail-service.ts:117-142` | Operator setzt Platzhalter ein, die wörtlich im Kundenmail stehen | Platzhalter-Katalog je Vorlagentyp aus einer Quelle generieren; Vorschau mit Beispieldaten | im Rewrite beheben | F-436 |
| B-367 | Vorlage `mailing` wird geseedet und ist editierbar, aber von keinem Sendepfad geladen; `DocumentMailKind` enthält `reminder_2/reminder_3` ohne Seeds; `documentTypeLabel`/`documentTypeSchema` kennen `customer_letter` ohne Verwendung | `seed-defaults.ts:133-146`, `mail-service.ts:40-50`, `status-labels.ts:240-247`, `validation.ts:150-157` | Tote Konfiguration, verwirrend für Operator („Serienbrief"-Vorlage ohne Wirkung) | Entweder Broadcast-Composer mit `mailing`-Vorlage vorbelegen oder Vorlage entfernen; Enum bereinigen | Entscheidung nötig | F-423, F-436 |
| B-368 | Empfänger-/Absendername wird unquoted in `"<name> <email>"` konkateniert (Firmennamen mit `,`, `"`, `<>` können den Adress-Parser stören); Subject nach Rendering kann `varchar(200)` überschreiten → Insert wirft vor dem Versand | `mail-service.ts:249,301-303,435,726-728`, `schema.ts:1083` | Fehlgeschlagene Sends bei exotischen Namen/langen Betreffs; kein `sent_messages`-Eintrag im Overflow-Fall | nodemailer-Adressobjekte `{ name, address }`; Subject kürzen oder Spalte `text` | im Rewrite beheben | F-415, F-418 |
| B-369 | Kandidaten-Finder und Auto-Batch sind nicht unit-getestet (Kommentar „broken correlated SQL … pg-mem can't run it"); nur E2E-Smoke „nichts fällig" | `reminder-service.test.ts:327-332`, `e2e/smoke.spec.ts:51-62` | Kernlogik der Wiederholung ungeprüft | Integrationstest gegen echtes Postgres (E2E-DB) mit Datumsinjektion | im Rewrite beheben | F-430 |
| B-370 | `/reminders` ohne Pagination und ohne Filter/Suche (beide Listen); Overdue/`today` per UTC-ISO statt Europe/Berlin (Abweichung um Mitternacht); `verzugstage` in der Mail nutzt `new Date()` statt `asOf` | `reminders.remote.ts:27-115`, `reminder-service.ts:171-174,198-222`, `reminders/+page.svelte` | Verstößt gegen „Pagination fest 25"; Datumsdrift | Paginieren, Datumslogik zentral in Berlin-Zeit | im Rewrite beheben | F-428, F-431 |
| B-371 | `listDuePaymentReminderCandidates` schließt `storno` nicht explizit aus (verlässt sich auf `dueDate IS NULL`), `sendPaymentReminder` weist `draft/converted/storno` nicht ab (manueller Pfad) | `reminder-service.ts:92-101,270-276` | Manuelle Erinnerung auf Entwurf/Storno technisch möglich (UI blendet Zeilen aus, Remote nicht) | Status-Whitelist im Service | im Rewrite beheben | F-429, F-430 |
| B-372 | `smallBusinessExempt` (§ 19 UStG, Steuerflag) wird auf `/settings/reminders` **und** `/settings` (Allgemein) gepflegt; die Reminder-Seite initialisiert einmalig und überschreibt beim Speichern mit ihrem Stand | `settings/reminders/+page.svelte:136-143`, `settings.remote.ts:191`, `docs/modules/settings.md:38` | Zwei Schreibpfade auf dasselbe Feld; Fachfremdes Feld auf der Erinnerungsseite | Nur an einer Stelle pflegen | im Rewrite beheben | F-434 |
| B-373 | Speichern auf `/settings/reminders` ruft zwei Commands nacheinander (Einstellungen, dann Vorlage) — Teilerfolg möglich; Reset-Button ohne Bestätigung setzt sofort zurück (auch in `/settings/mail`) | `settings/reminders/+page.svelte:74-88,97-105`, `settings/mail/+page.svelte:89-98` | Inkonsistenter Zustand bei Fehler, versehentlicher Verlust angepasster Texte | Ein Command; `ConfirmDialog` vor Reset | im Rewrite beheben | F-435, F-436 |
| B-374 | Ad-hoc-Versand mit Anhängen nur mit `customers`-Permission (nicht `mailings`); kein Bestätigungsdialog; Rolle `Mitarbeiter` kann damit beliebige Mails im Firmennamen senden | `customers.remote.ts:373`, `seed-defaults.ts:339-356` | Berechtigungsmodell für ausgehende Kommunikation uneinheitlich | Entscheidung, ob ein `mail`/`communication`-Recht eingeführt wird | Entscheidung nötig | F-419, F-445 |
| B-375 | `/sent` in der Navigation nur mit `invoices`, Remote akzeptiert auch `offers`/`reminders`, `mailings`-Inhaber (Rundschreiben-Versender) sehen die Historie nicht | `navigation.ts:215`, `sent.remote.ts:35` | Uneinheitliche Sichtbarkeit | Konsistente Permission (z. B. `mailings\|invoices\|offers\|reminders`) | im Rewrite beheben | F-426, F-445 |
| B-376 | Doppelte Status-Labels: `/sent/[id]` definiert eigene `statusLabel` („In Versand") neben `sentMessageStatusLabel` („In Warteschlange") | `sent/[id]/+page.svelte:26-39`, `status-labels.ts:180-184` | Inkonsistente Begriffe | Eine Quelle | im Rewrite beheben | F-427 |
| B-377 | Dokumentations-Widersprüche: ADR-005 sagt SMTP-Passwort Klartext (Code verschlüsselt); Migration 0021 behauptet Verschlüsselung entfernt und `APP_ENCRYPTION_KEY` gestrichen (Code nutzt beides); `docs/modules/sent.md` nennt Guard `invoices` (Code `requireAnyPermission`); `docs/modules/reminders.md` Status-Lebenszyklus und Auto-Toggle; Modul-Header `mail-service.ts:10-13` „PDF attachments are not wired"; CLAUDE/Docs nennen Button „Jetzt prüfen" (UI: „Fällige jetzt versenden") | `docs/decisions/adr-005-encryption-scope.md:30-33`, `drizzle/0021_smtp_plain_password.sql:1-9`, `docs/modules/sent.md:13`, `docs/modules/reminders.md:34-35`, `reminders/+page.svelte:99` | Soll-Dokumente unzuverlässig für den Rewrite | Docs auf Code-Stand ziehen | im Rewrite beheben | F-430, F-439 |
| B-378 | Broadcast sendet `to: fromAddress` je Batch → Absender-Postfach erhält N/50 Kopien; `htmlToPlainText` lässt `<style>`/`<script>`-Inhalte als Text stehen; HTML-Body wird ohne Sanitizing 1:1 versendet (Operator-Vertrauen) | `mail-service.ts:571`, `:164-177`, `:520` | Postfach-Rauschen; unschöne Text-Fallbacks | `to: undefined` mit `bcc` oder eigenes Postfach; robusterer HTML→Text-Konverter | bewusst später | F-420, F-423 |
| B-379 | `sent_messages`-Zeilen bleiben bei Prozessabbruch dauerhaft `pending`; keine Aufräum-/Retry-/Retention-Logik; Broadcast-Body wird je Empfänger dupliziert | `mail-service.ts:281-295,546-566` | Audit wächst, „In Warteschlange" ist irreführend | Stale-pending-Bereinigung, Body-Deduplizierung (Kampagne) | Entscheidung nötig | F-418, F-425 |
| B-380 | Header-Injection über Betreff/Namen wird nur durch nodemailer 8.0.11 neutralisiert (`replace(/\r?\n\|\r/g, ' ')` in `_encodeHeaderValue`); die App selbst prüft keine Steuerzeichen | `node_modules/nodemailer/lib/mime-node/index.js:1117,1136`, `mailings.remote.ts:54-59` | Bei Bibliothekswechsel entfiele der Schutz | Eigene `regex`-Prüfung (keine CR/LF) in den Subject-Schemas | im Rewrite beheben | F-419, F-423, F-443 |
| B-381 | Tote Exporte/Aliase: `createPaymentReminder`, `listOverduePaymentReminderCandidates`, `findInvoicesNeedingReminder`, `createReminderForInvoice`, `createReminderRemote`, `countBroadcastsRemote`, `getOrRenderReminderPdf` | `reminder-service.ts:151,297-298,330,345-352`, `reminders.remote.ts:212`, `mailings.remote.ts:152-164`, `pdf-service.ts:2091-2097` | Wartungslast, irreführende Doku-Referenzen | Im Rewrite nicht übernehmen | im Rewrite beheben | – |
| B-382 | `smtpSettings` wird pro Versand zweimal gelesen (Send-Funktion + `buildTransport`); `listCustomersForBroadcast` lädt alle Spalten; Broadcast-Anhänge liegen mehrfach im Speicher (Base64 im Request + Buffer je Batch-Referenz) | `mail-service.ts:246,197,504`, `customer-service.ts:254-262` | Geringe Last, aber unnötige Roundtrips | Settings einmal laden und durchreichen | bewusst später | F-414, F-423 |
| B-383 | E-Mail-Adressen der Kunden werden nicht validiert, bevor sie in `to`/`bcc` landen (nur `customers.email` Freitext); ein ungültiger Eintrag lässt einen ganzen 50er-BCC-Batch scheitern (`EENVELOPE`) | `mail-service.ts:496-498,541`, `customer-service.ts` | 50 Kunden als `failed` wegen eines Tippfehlers | Adress-Syntaxprüfung vor Batch-Bildung, ungültige einzeln als `failed` markieren | im Rewrite beheben | F-423 |
| B-384 | Abweichung vom Listen-Pattern (CONTRIBUTING §5): `/reminders` nutzt `$state`-Spiegel + `.run()`-Refetch statt `.current`; `createPaymentReminderRemote` macht zusätzlich `refreshAll()` → doppelte Abfragen | `reminders/+page.svelte:25-49`, `reminders.remote.ts:196-199` | Doppelter Roundtrip, zwei Patterns im Code | Einheitliches Pattern im Rewrite | im Rewrite beheben | F-428 |

## 11. Offene Fragen an den Architekten

1. Soll die Zahlungserinnerung das erzeugte PDF als Anhang erhalten (rechtlich/fachlich gewünscht?) und sollen Erinnerungsnummer/„Zahlbar bis" als Platzhalter verfügbar sein (B-356)?
2. Soll es ein eigenes Zahlungsziel für Erinnerungen geben statt der Doppelnutzung von `reminderDays1` (B-357)?
3. Wie sollen Rechnungen ohne Kunden-E-Mail im Erinnerungsprozess behandelt werden — ausschließen, Post-Versand markieren, Operator-Hinweis (B-354)?
4. Wird für Rundschreiben eine Kampagnen-Entität mit Job/Queue, Fortschritt und Wiederholung fehlgeschlagener Empfänger gewünscht, oder bleibt das synchrone Ein-Request-Modell (B-359)? Bleibt BCC-Versand oder personalisierte Einzelmails (Anrede-Platzhalter)?
5. Bleibt das Opt-out per mailto-Antwort mit manuellem Umschalten durch den Operator (ADR-017), oder soll ein Token-Link/öffentlicher Endpoint kommen?
6. Soll ein externer Scheduler (Cron) den Batch `autoSendDuePaymentReminders` auslösen und `reminderAutoEnabled` dann respektieren (ADR-009, B-352)?
7. Berechtigungsmodell für ausgehende Mails: eigenes Recht `mail`/`communication` für Ad-hoc, Rundschreiben, Gesendet (B-374/27)?
8. Retention/Datenschutz für `sent_messages` (Volltexte aller Kundenmails, Broadcast-Kopien je Empfänger) — Aufbewahrungsfrist, Löschkonzept (B-379)?
9. Soll die Vorlage `mailing` den Rundschreiben-Composer vorbelegen oder entfallen (B-367)? Sollen Vorlagen HTML unterstützen (aktuell nur Plain-Text)?
10. Ist ein Multi-Provider-Transport (API-Provider statt SMTP) oder Pooling/Retry-Strategie im Zielbild, oder bleibt SMTP-only mit nodemailer?
11. Soll der Testversand `verified=true` setzen und die UI einen „geprüft am"-Status zeigen (B-364)?

## 12. Gelesene Dateien

Vollständig gelesen:

| Datei | Zeilen |
|---|---|
| `src/lib/server/services/mail-service.ts` | 1236 |
| `src/lib/server/services/smtp-settings-service.ts` | 76 |
| `src/lib/server/services/reminder-service.ts` | 388 |
| `src/lib/server/crypto.ts` | 92 |
| `src/routes/reminders/+page.svelte` | 352 |
| `src/routes/reminders/reminders.remote.ts` | 231 |
| `src/routes/reminders/[id]/+page.svelte` | 114 |
| `src/routes/sent/+page.svelte` | 227 |
| `src/routes/sent/sent.remote.ts` | 106 |
| `src/routes/sent/[id]/+page.svelte` | 93 |
| `src/routes/mailings/+page.svelte` | 232 |
| `src/routes/mailings/MailingsHost.svelte` | 15 |
| `src/routes/mailings/mailings.remote.ts` | 164 |
| `src/lib/components/ui/EmailComposer.svelte` | 212 |
| `src/routes/settings/settings.remote.ts` | 450 |
| `src/routes/settings/mail/+page.svelte` | 176 |
| `src/routes/settings/smtp/+page.svelte` | 224 |
| `src/routes/settings/SmtpTestSend.svelte` | 104 |
| `src/routes/settings/reminders/+page.svelte` | 221 |
| `src/routes/settings/tire-reminders.remote.ts` | 48 |
| `src/routes/settings/inquiries.remote.ts` | 112 |
| `src/routes/settings/+layout.svelte` | 118 |
| `src/lib/server/db/seed-defaults.ts` | 376 |
| `drizzle/0014_recurring_reminder.sql` | 18 |
| `drizzle/0021_smtp_plain_password.sql` | 9 |
| `drizzle/0024_simplify_reminders.sql` | 27 |
| `drizzle/0023_inquiry_notification_status.sql` | 27 |
| `scripts/dev-mail-catcher.js` | 104 |
| `src/lib/server/services/mail-service.test.ts` | 1576 |
| `src/lib/server/services/smtp-settings-service.test.ts` | 128 |
| `src/lib/server/services/reminder-service.test.ts` | 240 |
| `src/lib/server/crypto.test.ts` | 109 |
| `src/routes/mailings/mailings.remote.test.ts` | 381 |
| `src/routes/mailings/page.test.ts` | 77 |
| `src/routes/settings/settings.remote.test.ts` | 387 |
| `src/routes/settings/SmtpTestSend.test.ts` | 124 |
| `src/lib/components/ui/EmailComposer.test.ts` | 57 |
| `docs/modules/reminders.md` | 46 |
| `docs/modules/sent.md` | 24 |
| `docs/modules/mailings.md` | 33 |
| `docs/modules/settings.md` | 104 |
| `docs/integrations/smtp-mail.md` | 76 |
| `docs/decisions/adr-009-no-in-process-scheduler.md` | 34 |
| `docs/decisions/adr-017-broadcast-unsubscribe-mailto.md` | 32 |
| `docs/decisions/adr-005-encryption-scope.md` | 41 |
| `/tmp/…/scratchpad/inv/TEMPLATE.md` | 59 |

Ausschnittsweise gelesen (Gesamtzeilen; gelesene Bereiche):

| Datei | Zeilen | Gelesene Bereiche |
|---|---|---|
| `src/lib/server/db/schema.ts` | 2025 | 36-165, 175-240, 585-600, 740-816, 1060-1100, 1455-1506, 1730-1756 + grep |
| `src/routes/invoices/invoices.remote.ts` | 421 | 320-400 |
| `src/routes/offers/offers.remote.ts` | 358 | 300-390 |
| `src/routes/customers/customers.remote.ts` | 380 | 340-420 |
| `src/routes/customers/[id]/+page.svelte` | 613 | 100-260, 550-615 + grep |
| `src/routes/invoices/[id]/+page.svelte` | 962 | 40-100, 230-290, 300-365, 715-765, 855-880 + grep |
| `src/lib/server/services/tire-reminder-service.ts` | 199 | 130-199 |
| `src/routes/api/public/contact/endpoint.ts` | 158 | 110-158 |
| `src/routes/api/public/appointments/endpoint.ts` | 240 | 205-240 |
| `src/lib/server/services/customer-service.ts` | 262 | 245-262 |
| `src/lib/server/services/pdf-service.ts` | 2716 | 1507-1519, 1985-2140 |
| `src/routes/pdfs.remote.ts` | 111 | 60-111 |
| `src/lib/utils/status-labels.ts` | 269 | 36-65, 175-262 |
| `src/lib/components/layout/navigation.ts` | 247 | 128-235 |
| `src/routes/settings/+page.svelte` | 486 | 1-60 + grep |
| `src/hooks.server.ts` | 470 | 264-291, 355-470 + grep |
| `src/lib/server/db/validation.ts` | 315 | 26-84, 145-160 |
| `src/routes/setup/setup.remote.ts` | 350 | 22-50, 159-187 |
| `src/lib/server/services/settings-service.ts` | 14 | 7-14 |
| `src/lib/server/services/document-service.ts` | 688 | 180-207 |
| `src/lib/permissions.ts` | 53 | grep (37, 42) |
| `src/lib/server/services/import-service.ts` | 1591 | grep (reminders/sentMessages-Stellen) |
| `CONTRIBUTING.md` | 1474 | 1405-1450 + grep |
| `e2e/smoke.spec.ts` | 134 | 30-85 |
| `e2e/settings.spec.ts` | 152 | 60-110 + grep |
| `e2e/navigation.spec.ts` | 143 | 25-60 |
| `drizzle/0000_lying_tyger_tiger.sql` | 474 | 242-256, 307-334 |
| `drizzle/0001_pdfs_reminders_offer_link.sql` | 46 | grep |
| `drizzle/0011_phase3_data_model.sql` | 125 | grep |
| `package.json` | – | grep (nodemailer ^8.0.7, valibot ^1.3.1, svelte 5.56.4) |
| `node_modules/nodemailer/lib/mime-node/index.js` (8.0.11) | – | grep (Header-Zeilenumbruch-Sanitizing 1117, 1136) |
