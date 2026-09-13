---
id: F-587
title: Öffnungszeiten-Defaults und Feiertage
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-019
permission: offen
routes: ['/company', '/free-slots']
endpoints: ['listWorkshopHours', 'defaultHoursFor', 'getCompanyHolidayState']
tables: ['workshop_hours', 'company_settings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-587 — Öffnungszeiten-Defaults und Feiertage

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Öffnungszeiten-Defaults und Feiertage

## Erwartetes Verhalten

Fehlende Wochentage → Mo–Fr 08:00–17:00 offen, Sa/So geschlossen (Lazy-Insert nur bei `/company`, im Slot-Finder nur in-memory); Feiertage algorithmisch je Bundesland

## Nutzersicht

_Wird mit T-019 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-019 ergänzt._

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
| Routen | `/company`, `/free-slots` |
| Endpoints | `listWorkshopHours`, `defaultHoursFor`, `getCompanyHolidayState` |
| Tabellen | `workshop_hours`, `company_settings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-587 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
