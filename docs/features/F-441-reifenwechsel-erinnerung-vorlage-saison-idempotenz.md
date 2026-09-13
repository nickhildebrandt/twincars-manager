---
id: F-441
title: Reifenwechsel-Erinnerung (Vorlage `tire_reminder`, Saison-Idempotenz)
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-016
permission: offen
routes: ['/settings/tire-reminders']
endpoints: ['sendTireRemindersRemote', 'sendDocumentEmail']
tables: ['tire_reminder_log', 'sent_messages']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-441 — Reifenwechsel-Erinnerung (Vorlage `tire_reminder`, Saison-Idempotenz)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-016** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Reifenwechsel-Erinnerung (Vorlage `tire_reminder`, Saison-Idempotenz)

## Erwartetes Verhalten

Detail im Tires-Inventar; nutzt F-414/03/05

## Nutzersicht

_Wird mit T-016 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-016 ergänzt._

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
| Routen | `/settings/tire-reminders` |
| Endpoints | `sendTireRemindersRemote`, `sendDocumentEmail` |
| Tabellen | `tire_reminder_log`, `sent_messages` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-016 ergänzt._

## Quellen

- Inventar: [F-441 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-016 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
