---
id: F-445
title: Navigation/Permissions: „Offene Rechnungen' (`reminders`), „Rundschreiben' (`mailings`), „Gesendet' (`invoices`), „Anfragen' (`mailings`), Settings-Tabs Mailvorlagen/Zahlungserinnerung/SMTP (`settings`)
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-008
permission: offen
routes: []
endpoints: ['filterNavigationByPermissions']
tables: ['role_permissions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-445 — Navigation/Permissions: „Offene Rechnungen" (`reminders`), „Rundschreiben" (`mailings`), „Gesendet" (`invoices`), „Anfragen" (`mailings`), Settings-Tabs Mailvorlagen/Zahlungserinnerung/SMTP (`settings`)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-008** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Navigation/Permissions: „Offene Rechnungen" (`reminders`), „Rundschreiben" (`mailings`), „Gesendet" (`invoices`), „Anfragen" (`mailings`), Settings-Tabs Mailvorlagen/Zahlungserinnerung/SMTP (`settings`)

## Erwartetes Verhalten

Rolle `Mitarbeiter` hat `reminders`+`invoices`, nicht `mailings`/`settings` (`seed-defaults.ts:339-356`)

## Nutzersicht

_Wird mit T-008 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-008 ergänzt._

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
| Routen | — |
| Endpoints | `filterNavigationByPermissions` |
| Tabellen | `role_permissions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-008 ergänzt._

## Quellen

- Inventar: [F-445 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-008 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
