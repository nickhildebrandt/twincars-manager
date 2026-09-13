---
id: F-442
title: Terminbestätigung nach öffentlicher Buchung (Berlin-Zeit, Bestätigungs-Code)
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-031
permission: offen
routes: ['POST /api/public/appointments']
endpoints: ['sendAppointmentConfirmation']
tables: ['mail_templates', 'sent_messages']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-442 — Terminbestätigung nach öffentlicher Buchung (Berlin-Zeit, Bestätigungs-Code)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Terminbestätigung nach öffentlicher Buchung (Berlin-Zeit, Bestätigungs-Code)

## Erwartetes Verhalten

best-effort; Audit-Typ `appointment_confirmation`

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
| Routen | `POST /api/public/appointments` |
| Endpoints | `sendAppointmentConfirmation` |
| Tabellen | `mail_templates`, `sent_messages` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-442 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
