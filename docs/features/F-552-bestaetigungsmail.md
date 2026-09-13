---
id: F-552
title: Bestätigungsmail
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-031
permission: offen
routes: []
endpoints: ['sendAppointmentConfirmation']
tables: ['mail_templates', 'smtp_settings', 'sent_messages']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-552 — Bestätigungsmail

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Bestätigungsmail

## Erwartetes Verhalten

Vorlage `appointment_confirmation` mit Datum/Uhrzeit in Europe/Berlin, Dauer, Leistung, Bestätigungs-Code; best effort; Fehler nur im Log + `sent_messages.failed`.

## Nutzersicht

_Wird mit T-031 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-031 ergänzt._

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
| Endpoints | `sendAppointmentConfirmation` |
| Tabellen | `mail_templates`, `smtp_settings`, `sent_messages` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-552 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
