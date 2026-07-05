---
title: Module - reminders (Zahlungserinnerungen)
tags: [module, reminders, documents]
updated: 2026-07-05
---

# reminders - "Offene Rechnungen & Zahlungserinnerungen"

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
- **Tests**: `reminder-service.test.ts`.
