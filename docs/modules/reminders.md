---
title: Module - reminders (Offene Rechnungen)
tags: [module, reminders, documents]
updated: 2026-07-07
---

# reminders - "Offene Rechnungen"

- **Naming**: the module is labeled **"Offene Rechnungen"** in the
  sidebar (group "Aufträge & Rechnungen") and as the page title; the
  route stays `/reminders` and the permission key stays `reminders`.
  The artifact wording **"Zahlungserinnerung"** is retained for the
  actions, PDFs, number range and mail templates - it names the thing
  being sent, not the module.
- **Purpose**: track open invoices and send the single friendly
  "Zahlungserinnerung" (no escalation, no Mahngebühr, no Verzugszinsen -
  the same template every time).
- **Routes**: `/reminders` (open invoices + reminder list + "Jetzt
  prüfen" button), `/reminders/[id]`.
- **Remote** `reminders.remote.ts`: `listOpenInvoicesRemote`,
  `listRemindersRemote`, `getReminderRemote`,
  `listRemindersForInvoiceRemote`, `createPaymentReminderRemote`,
  `createReminderRemote`, `autoSendDuePaymentRemindersRemote`.
  Guard `requirePermission('reminders')`.
- **Service**: `reminder-service.ts` - `sendPaymentReminder`,
  `listDuePaymentReminderCandidates`, `autoSendDuePaymentReminders`
  (the operator-triggered batch; designed to be callable from an
  external cron later, [[adr-009-no-in-process-scheduler]]).
- **Tables**: `reminders` (own number range `ZE-{YYYY}-{NNNN}`, unique
  (invoiceId, level)), `reminder_pdfs`; `documents.reminderLevel`.
- **Timing** (defaults on `company_settings`): first reminder
  `reminderDays1` = 3 days after the invoice due date, then every
  `reminderRecurEveryDays` = 14 days until paid;
  `reminderAutoEnabled` toggles the batch candidate logic.
- **Special**: reminder status `open` → `sent` → `paid`/`cancelled`;
  PDFs cached like documents ([[pdf-pipeline]]); sends audit into
  `sent_messages` ([[sent]], [[smtp-mail]]).
- **Open-invoice definition**: `listOpenInvoicesRemote` lists only real
  open receivables - it excludes `paid`, `cancelled`, **`storno`**,
  **`draft`** and **`converted`** invoices (storno documents are
  negative counter-bookings, drafts and converted offers are not
  dunnable; QA round 2 removed the "Senden" offer on storno rows). The
  batch candidate query (`listDuePaymentReminderCandidates`) excludes
  paid/cancelled/draft/converted and additionally requires a due date,
  which Stornorechnungen never carry (`dueDate` is null).
- **Tests**: `reminder-service.test.ts`.
