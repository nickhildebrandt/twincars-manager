---
id: F-008
title: Serverfehler-Funnel
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-004
permission: offen
routes: []
endpoints: ['handleError']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-008 — Serverfehler-Funnel

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-004** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Serverfehler-Funnel

## Erwartetes Verhalten

≥ 500: Log + „Ein interner Fehler ist aufgetreten.“; 4xx mit Text: durchreichen; sonst „Die Anfrage konnte nicht bearbeitet werden.“

## Nutzersicht

_Wird mit T-004 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-004 ergänzt._

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
| Endpoints | `handleError` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-004 ergänzt._

## Quellen

- Inventar: [F-008 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-004 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
