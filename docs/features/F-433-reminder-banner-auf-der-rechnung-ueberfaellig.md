---
id: F-433
title: Reminder-Banner auf der Rechnung (überfällig / N versendet, letzte am …) mit CTA und Link „Zur letzten Erinnerung'
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-025
permission: offen
routes: ['/invoices/[id]']
endpoints: ['listRemindersForInvoiceRemote']
tables: ['reminders']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-433 — Reminder-Banner auf der Rechnung (überfällig / N versendet, letzte am …) mit CTA und Link „Zur letzten Erinnerung"

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-025** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Reminder-Banner auf der Rechnung (überfällig / N versendet, letzte am …) mit CTA und Link „Zur letzten Erinnerung"

## Erwartetes Verhalten

überfällig = `dueDate < heute` und nicht paid/cancelled

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
| Routen | `/invoices/[id]` |
| Endpoints | `listRemindersForInvoiceRemote` |
| Tabellen | `reminders` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-025 ergänzt._

## Quellen

- Inventar: [F-433 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-025 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
