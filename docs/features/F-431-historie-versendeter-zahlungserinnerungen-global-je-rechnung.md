---
id: F-431
title: Historie versendeter Zahlungserinnerungen (global + je Rechnung)
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-025
permission: offen
routes: ['/reminders', '/invoices/[id]']
endpoints: ['listRemindersRemote', 'listRemindersForInvoiceRemote']
tables: ['reminders', 'documents', 'customers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-431 — Historie versendeter Zahlungserinnerungen (global + je Rechnung)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-025** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Historie versendeter Zahlungserinnerungen (global + je Rechnung)

## Erwartetes Verhalten

Global: nur `status='open'` (faktisch alle), `issueDate DESC`, unpaginiert; je Rechnung `level ASC`; Badge „N. Erinnerung"

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
| Endpoints | `listRemindersRemote`, `listRemindersForInvoiceRemote` |
| Tabellen | `reminders`, `documents`, `customers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-025 ergänzt._

## Quellen

- Inventar: [F-431 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-025 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
