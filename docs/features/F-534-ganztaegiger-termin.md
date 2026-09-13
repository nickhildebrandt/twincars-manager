---
id: F-534
title: Ganztägiger Termin
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/calendar/new', '/calendar/[id]/edit']
endpoints: []
tables: ['calendar_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-534 — Ganztägiger Termin

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Ganztägiger Termin

## Erwartetes Verhalten

Checkbox schaltet Inputs auf `type=date`; Formular sendet `YYYY-MM-DDT00:00`; Server pinnt `00:00:00Z`–`23:59:59Z`; Grid expandiert auf alle Tage; Edit liest UTC-Datum zurück. Mehrtägig erlaubt (`endDate >= startDate`). Keine Kollisionswarnung (B-460).

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
| Routen | `/calendar/new`, `/calendar/[id]/edit` |
| Endpoints | — |
| Tabellen | `calendar_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-534 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
