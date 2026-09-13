---
id: F-585
title: Terminbestätigung an den Kunden
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-030
permission: offen
routes: []
endpoints: ['sendAppointmentConfirmation']
tables: ['mail_templates', 'sent_messages', 'smtp_settings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-585 — Terminbestätigung an den Kunden

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-030** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Terminbestätigung an den Kunden

## Erwartetes Verhalten

Vorlage `appointment_confirmation` mit Platzhaltern; Datum/Uhrzeit in Europe/Berlin; Audit als `appointment_confirmation`

## Nutzersicht

_Wird mit T-030 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-030 ergänzt._

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
| Tabellen | `mail_templates`, `sent_messages`, `smtp_settings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-030 ergänzt._

## Quellen

- Inventar: [F-585 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-030 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
