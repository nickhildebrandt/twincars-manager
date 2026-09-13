---
id: F-553
title: Dashboard-Terminkacheln
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-035
permission: offen
routes: ['/']
endpoints: ['getDashboardKpis', 'getUpcomingRemote', 'requireUser']
tables: ['calendar_entries', 'vehicles']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-553 — Dashboard-Terminkacheln

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-035** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Dashboard-Terminkacheln

## Erwartetes Verhalten

KPI „Termine heute" (UTC-Tag, nicht `cancelled`); Karte „Anstehende Termine" (max. 10 aus 20 HU + 20 Terminen, ab heute, sortiert nach Datum; Termin-Link → `/calendar`, HU-Link → Fahrzeug); Leerzustand-Text; Link „Kalender öffnen →".

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
| Endpoints | `getDashboardKpis`, `getUpcomingRemote`, `requireUser` |
| Tabellen | `calendar_entries`, `vehicles` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-035 ergänzt._

## Quellen

- Inventar: [F-553 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-035 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
