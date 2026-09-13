---
id: F-563
title: Gebrauchtwagen-Detail
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-031
permission: offen
routes: ['/api/public/used-cars/[id]']
endpoints: ['handlePublicUsedCarDetail', 'getPublicUsedCar']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-563 — Gebrauchtwagen-Detail

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Gebrauchtwagen-Detail

## Erwartetes Verhalten

UUID-Prüfung (400), gleiche Sichtbarkeitsregel, 404 sonst

## Nutzersicht

_Wird mit T-031 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-031 ergänzt._

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
| Routen | `/api/public/used-cars/[id]` |
| Endpoints | `handlePublicUsedCarDetail`, `getPublicUsedCar` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-563 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
