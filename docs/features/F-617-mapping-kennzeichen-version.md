---
id: F-617
title: Mapping `Autos` → `vehicles` + Kennzeichen-Version
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: []
endpoints: []
tables: ['vehicles', 'vehicle_license_plate_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-617 — Mapping `Autos` → `vehicles` + Kennzeichen-Version

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mapping `Autos` → `vehicles` + Kennzeichen-Version

## Erwartetes Verhalten

Halter über `Kunden-Nr` Pflicht (Skip „Halter (Kunden-Nr X) nicht gefunden." / „Fahrzeug ohne Kunden-Nr."); `KFZ-Typ` → `make`/`model` (Split am 1. Leerzeichen); `Fahrgestellnr`→`vin`(25); `EZ`→`firstRegistration` (loose); `km-Stand`→`mileageKm`; `HU`→`nextHu` (loose); `ff1`→`hsn`(10), `ff2`→`tsn`(10), `ff3`→`engineNumber`(50), `ff4`→`fuelType`(30), `ff5`→`bodyType`(50); `Freifeld1`→`notes`; `Archiv==1`→`archived`; `legacyVehicleId=ID_Auto`; Kennzeichen → eine Version `validFrom = EZ ?? '1900-01-01'`; alle Fahrzeuge sind Kundenfahrzeuge (kein Bestand)

## Nutzersicht

_Wird mit T-033 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-033 ergänzt._

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
| Endpoints | — |
| Tabellen | `vehicles`, `vehicle_license_plate_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-617 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
