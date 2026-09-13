---
id: F-028
title: Globale Suche: Abfrage + Berechtigungsfilter
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-035
permission: offen
routes: []
endpoints: ['globalSearchRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-028 — Globale Suche: Abfrage + Berechtigungsfilter

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-035** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Globale Suche: Abfrage + Berechtigungsfilter

## Erwartetes Verhalten

≥ 2 Zeichen, ≤ 200, 250 ms Debounce, 8/Bucket, Buckets ohne Modulrecht leer

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
| Routen | — |
| Endpoints | `globalSearchRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-035 ergänzt._

## Quellen

- Inventar: [F-028 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-035 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
