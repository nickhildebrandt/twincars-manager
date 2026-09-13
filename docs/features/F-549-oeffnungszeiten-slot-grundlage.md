---
id: F-549
title: Öffnungszeiten (Slot-Grundlage)
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/settings/workshop-hours']
endpoints: ['listWorkshopHoursRemote', 'updateWorkshopHoursRemote', 'settings']
tables: ['workshop_hours']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-549 — Öffnungszeiten (Slot-Grundlage)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Öffnungszeiten (Slot-Grundlage)

## Erwartetes Verhalten

7 Wochentage, `HH:MM`, Geschlossen-Toggle; Regel `opensAt < closesAt` für offene Tage; Defaults Mo–Fr 08–17, Sa/So zu; Seed beim Setup + Lazy-Create beim Lesen.

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
| Routen | `/settings/workshop-hours` |
| Endpoints | `listWorkshopHoursRemote`, `updateWorkshopHoursRemote`, `settings` |
| Tabellen | `workshop_hours` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-549 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
