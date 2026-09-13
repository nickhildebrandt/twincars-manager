---
id: F-554
title: Paginierte Terminliste (Backend vorhanden, keine UI)
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: []
endpoints: ['listAppointmentsRemote']
tables: ['calendar_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-554 — Paginierte Terminliste (Backend vorhanden, keine UI)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Paginierte Terminliste (Backend vorhanden, keine UI)

## Erwartetes Verhalten

Suche im Titel, Datumsfilter auf `starts_at`, `ORDER BY starts_at`, Größen 10/25/50/100. In keiner Seite verwendet; einzige Möglichkeit, abgesagte Termine zu finden, existiert somit nicht im UI.

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
| Routen | — |
| Endpoints | `listAppointmentsRemote` |
| Tabellen | `calendar_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-554 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
