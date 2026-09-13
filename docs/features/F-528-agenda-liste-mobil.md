---
id: F-528
title: Agenda-Liste (Mobil < `lg`)
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/calendar']
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-528 — Agenda-Liste (Mobil < `lg`)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Agenda-Liste (Mobil < `lg`)

## Erwartetes Verhalten

Nur In-Monat-Tage mit Events, Überschrift `weekday, dd.mm.yyyy` (de-DE, UTC), Chips als Buttons/Spans untereinander (`:171-184`, `:317-353`); Leerzustand „Keine Einträge in diesem Monat.".

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
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-528 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
