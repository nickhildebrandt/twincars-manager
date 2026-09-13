---
id: F-429
title: Zahlungserinnerung manuell senden (OP-Liste ohne Dialog; Rechnung mit Banner-CTA und ConfirmDialog bei Wiederholung)
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-025
permission: offen
routes: ['/reminders', '/invoices/[id]']
endpoints: ['createPaymentReminderRemote', 'sendPaymentReminder']
tables: ['reminders', 'documents', 'number_ranges', 'reminder_pdfs', 'sent_messages', 'mail_templates']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-429 — Zahlungserinnerung manuell senden (OP-Liste ohne Dialog; Rechnung mit Banner-CTA und ConfirmDialog bei Wiederholung)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-025** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Zahlungserinnerung manuell senden (OP-Liste ohne Dialog; Rechnung mit Banner-CTA und ConfirmDialog bei Wiederholung)

## Erwartetes Verhalten

Immer neue Zeile `level+1`, Nummer `ZE-YYYY-NNNN`, `dueDate = heute + reminderDays1`, PDF gerendert, Mail `reminder_1` best-effort; Refusal paid/cancelled/nicht-Rechnung

## Nutzersicht

_Wird mit T-025 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-025 ergänzt._

## Zustände

| Zustand | Verhalten |
| --- | --- |
| Leer | _offen_ |
| Laden | _offen_ |
| Fehler | _offen_ |
| Keine Berechtigung | _offen_ |

## Technischer Bezug

| | |
| --- | --- |
| Routen | `/reminders`, `/invoices/[id]` |
| Endpoints | `createPaymentReminderRemote`, `sendPaymentReminder` |
| Tabellen | `reminders`, `documents`, `number_ranges`, `reminder_pdfs`, `sent_messages`, `mail_templates` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-025 ergänzt._

## Quellen

- Inventar: [F-429 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-025 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
