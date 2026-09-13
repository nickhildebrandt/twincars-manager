---
id: F-039
title: Dashboard-KPIs (8 Kacheln)
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-035
permission: offen
routes: ['/']
endpoints: ['getDashboardKpis']
tables: ['customers', 'vehicles', 'ledger_entries', 'documents', 'reminders', 'calendar_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-039 — Dashboard-KPIs (8 Kacheln)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-035** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Dashboard-KPIs (8 Kacheln)

## Erwartetes Verhalten

Definitionen §3; Anzeige `de-DE`-Zahlen / `formatEuro`; `…` während Client-Load; nicht klickbar

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
| Endpoints | `getDashboardKpis` |
| Tabellen | `customers`, `vehicles`, `ledger_entries`, `documents`, `reminders`, `calendar_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-035 ergänzt._

## Quellen

- Inventar: [F-039 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-035 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
