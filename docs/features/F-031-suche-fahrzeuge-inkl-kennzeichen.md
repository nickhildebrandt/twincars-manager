---
id: F-031
title: Suche Fahrzeuge inkl. Kennzeichen
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-035
permission: offen
routes: []
endpoints: ['searchVehicles']
tables: ['vehicles', 'vehicle_license_plate_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-031 — Suche Fahrzeuge inkl. Kennzeichen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-035** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Suche Fahrzeuge inkl. Kennzeichen

## Erwartetes Verhalten

VIN/Marke/Modell/HSN/TSN + jedes Kennzeichen (auch historische), nicht archiviert; Sublabel aktuelles Kennzeichen · VIN

## Nutzersicht

_Wird mit T-035 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-035 ergänzt._

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
| Endpoints | `searchVehicles` |
| Tabellen | `vehicles`, `vehicle_license_plate_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-035 ergänzt._

## Quellen

- Inventar: [F-031 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-035 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
