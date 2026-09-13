---
id: F-527
title: Monatsraster (Desktop ≥ `lg`)
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/calendar']
endpoints: ['listCalendarEventsRemote']
tables: ['calendar_entries', 'employee_absences', 'vehicles', 'work_orders', 'company_settings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-527 — Monatsraster (Desktop ≥ `lg`)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Monatsraster (Desktop ≥ `lg`)

## Erwartetes Verhalten

7 Spalten Mo–So, immer 42 Zellen ab dem Montag vor dem 1. (`+page.svelte:115-130`); Nachbarmonatstage gedimmt; je Zelle Tagesnummer + max. 3 Chips + „+N weitere" (Tooltip); Chips `truncate` mit `title`-Attribut; Zeitraum der Query = `YYYY-MM-01` bis Monatsletzter (`:24-31`).

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
| Routen | `/calendar` |
| Endpoints | `listCalendarEventsRemote` |
| Tabellen | `calendar_entries`, `employee_absences`, `vehicles`, `work_orders`, `company_settings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-527 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
