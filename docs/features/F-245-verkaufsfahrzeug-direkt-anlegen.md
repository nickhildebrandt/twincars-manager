---
id: F-245
title: Verkaufsfahrzeug direkt anlegen
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-013
permission: offen
routes: ['/inventory/new']
endpoints: ['createVehicleRemote', 'purchaseDate']
tables: ['vehicles', 'vehicle_purchases', 'vehicle_license_plate_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-245 — Verkaufsfahrzeug direkt anlegen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-013** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Verkaufsfahrzeug direkt anlegen

## Erwartetes Verhalten

Kein Halter; optional Vorbesitzer, Ankaufspreis, Ankaufsdatum (default heute); immer Ankaufszeile; Toast "Verkaufsfahrzeug angelegt."; Permission `vehicles` (nicht `inventory`)

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
| Routen | `/inventory/new` |
| Endpoints | `createVehicleRemote`, `purchaseDate` |
| Tabellen | `vehicles`, `vehicle_purchases`, `vehicle_license_plate_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-013 ergänzt._

## Quellen

- Inventar: [F-245 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-013 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
