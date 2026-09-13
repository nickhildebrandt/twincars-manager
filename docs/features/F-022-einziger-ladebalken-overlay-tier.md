---
id: F-022
title: Einziger Ladebalken + Overlay-Tier
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-008
permission: offen
routes: []
endpoints: ['busy']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-022 — Einziger Ladebalken + Overlay-Tier

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-008** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Einziger Ladebalken + Overlay-Tier

## Erwartetes Verhalten

`active` → Balken-Opacity; `slow` (≥ 250 ms) → Overlay „Inhalte werden geladen“, `<main inert aria-busy>`

## Nutzersicht

_Wird mit T-008 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-008 ergänzt._

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
| Endpoints | `busy` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-008 ergänzt._

## Quellen

- Inventar: [F-022 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-008 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
