---
id: F-103
title: Lagerfahrzeug-Picker
status: geplant
modul: Gemeinsame UI-Komponenten und Picker
paket: T-009
permission: offen
routes: []
endpoints: ['pickInventoryVehiclesRemote']
tables: ['vehicles', 'vehicle_listings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-103 — Lagerfahrzeug-Picker

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-009** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Lagerfahrzeug-Picker

## Erwartetes Verhalten

`customerId IS NULL`, Listing fehlt oder `available`; Preisfelder für Positionen; Sort Marke/Modell

## Nutzersicht

_Wird mit T-009 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-009 ergänzt._

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
| Endpoints | `pickInventoryVehiclesRemote` |
| Tabellen | `vehicles`, `vehicle_listings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-009 ergänzt._

## Quellen

- Inventar: [F-103 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-009 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
