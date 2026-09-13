---
id: F-041
title: Dashboard „Anstehende Termine“
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-035
permission: offen
routes: ['/']
endpoints: ['getUpcomingRemote']
tables: ['vehicles', 'vehicle_license_plate_versions', 'calendar_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-041 — Dashboard „Anstehende Termine“

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-035** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Dashboard „Anstehende Termine“

## Erwartetes Verhalten

Top 10 aus HU-Fälligkeiten (≥ heute) + Terminen (≥ heute, nicht storniert), datumssortiert; HU → Fahrzeug, Termin → `/calendar`; Leertext

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
| Routen | `/` |
| Endpoints | `getUpcomingRemote` |
| Tabellen | `vehicles`, `vehicle_license_plate_versions`, `calendar_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-035 ergänzt._

## Quellen

- Inventar: [F-041 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-035 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
