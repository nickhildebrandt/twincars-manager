---
id: F-529
title: Monatsnavigation
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

# F-529 — Monatsnavigation

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Monatsnavigation

## Erwartetes Verhalten

Join-Buttons „Zurück" (aria-label), „Heute", „Weiter"; Monatslabel deutsch „<Monat> <Jahr>" rechts (`:99-113`, `:246-249`); „Heute" springt auf den beim Mount ermittelten UTC-Monat; kein Deep-Link, kein Browser-History-Eintrag je Monat.

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

- Inventar: [F-529 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
