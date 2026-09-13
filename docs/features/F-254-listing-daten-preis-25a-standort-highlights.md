---
id: F-254
title: Listing-Daten (Preis, §25a, Standort, Highlights, Status) — nur Lesepfade
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-013
permission: offen
routes: ['/inventory']
endpoints: ['listInventoryRemote', 'getInventoryVehicleRemote', 'pickInventoryVehiclesRemote', 'getVehicleSaleSignPdfRemote', 'listPublicUsedCars']
tables: ['vehicle_listings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-254 — Listing-Daten (Preis, §25a, Standort, Highlights, Status) — nur Lesepfade

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-013** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Listing-Daten (Preis, §25a, Standort, Highlights, Status) — nur Lesepfade

## Erwartetes Verhalten

Werte werden überall angezeigt/genutzt; **es existiert keine Anlage-/Bearbeitungs-UI und kein Remote** (nur Statusflips `sold`/`available` durch Verkauf/Ankauf) → in der Praxis immer 0,00 €/"Regelbest."/"Preis auf Anfrage"/`priceGross: null`

## Nutzersicht

_Wird mit T-013 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-013 ergänzt._

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
| Routen | `/inventory` |
| Endpoints | `listInventoryRemote`, `getInventoryVehicleRemote`, `pickInventoryVehiclesRemote`, `getVehicleSaleSignPdfRemote`, `listPublicUsedCars` |
| Tabellen | `vehicle_listings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-013 ergänzt._

## Quellen

- Inventar: [F-254 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-013 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
