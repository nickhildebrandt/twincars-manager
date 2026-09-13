---
id: F-247
title: Fahrzeug-Picker (3 Varianten)
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-009
permission: offen
routes: []
endpoints: ['pickVehiclesRemote', 'pickCustomerVehiclesRemote', 'pickInventoryVehiclesRemote']
tables: ['vehicles', 'vehicle_license_plate_versions', 'customers', 'vehicle_listings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-247 — Fahrzeug-Picker (3 Varianten)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-009** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Fahrzeug-Picker (3 Varianten)

## Erwartetes Verhalten

Archivierte nie; Suche Kennzeichen/VIN/Marke/Modell/HSN/TSN (+ Halter bei `pickCustomerVehicles`); `CustomerVehiclePicker`: Fahrzeug-Wahl füllt Halter, Kunden-Wahl filtert Fahrzeuge, Kundenwechsel leert fremdes Fahrzeug, `vehicleLocked` für Verkaufsfluss; Inventory-Picker nur `available`/ohne Listing

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
| Endpoints | `pickVehiclesRemote`, `pickCustomerVehiclesRemote`, `pickInventoryVehiclesRemote` |
| Tabellen | `vehicles`, `vehicle_license_plate_versions`, `customers`, `vehicle_listings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-009 ergänzt._

## Quellen

- Inventar: [F-247 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-009 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
