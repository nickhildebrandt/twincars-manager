---
id: F-627
title: Mapping `termine` → `calendar_entries(kind='appointment')`
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: []
endpoints: []
tables: ['calendar_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-627 — Mapping `termine` → `calendar_entries(kind='appointment')`

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mapping `termine` → `calendar_entries(kind='appointment')`

## Erwartetes Verhalten

`Datum` Pflicht (Skip „Termin ohne gültiges Datum."); `Uhrzeit` → Start (UTC-Stunden/Minuten aus `isoTimestamp`), fehlend → `allDay`, Start 00:00Z; `UhrzeitBis` → Ende, sonst +1 h bzw. 23:59Z; `ends<starts` → `ends=starts`; `title = TerminText ?? Name ?? 'Importierter Termin'`(200); `notes` = „Name: …" (wenn ≠ Text), „Mitarbeiter: …", „Intervall: …"; `status = completed` wenn Start < jetzt, sonst `scheduled`

## Nutzersicht

_Wird mit T-033 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-033 ergänzt._

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
| Endpoints | — |
| Tabellen | `calendar_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-627 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
