---
id: F-250
title: HU-Fälligkeit im Dashboard/Kalender
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-019
permission: offen
routes: ['/', '/calendar']
endpoints: ['dashboard-service', 'calendar-service']
tables: ['vehicles.next_hu']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-250 — HU-Fälligkeit im Dashboard/Kalender

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

HU-Fälligkeit im Dashboard/Kalender

## Erwartetes Verhalten

Cross-Module: `hu_due`-Einträge verlinken `/vehicles/<id>` (`src/routes/+page.svelte:145-150`); Details außerhalb dieses Inventars

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
| Routen | `/`, `/calendar` |
| Endpoints | `dashboard-service`, `calendar-service` |
| Tabellen | `vehicles.next_hu` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-250 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
