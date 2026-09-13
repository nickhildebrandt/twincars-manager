---
id: F-237
title: Detail: Historie-Tab
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: ['?tab=historie']
endpoints: ['getVehicleHistoryRemote']
tables: ['vehicle_purchases', 'vehicle_sales', 'customers', 'vehicle_license_plate_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-237 — Detail: Historie-Tab

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Detail: Historie-Tab

## Erwartetes Verhalten

Ereignisse "Ankauf von <Snapshot>" (Betrag), "Verkauf an <Käufer-Link>" (Betrag), "Kennzeichen <X> ab <Datum>"; neueste zuerst, unpaginiert; Leerzustand "Noch keine Historie für dieses Fahrzeug."

## Nutzersicht

_Wird mit T-012 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-012 ergänzt._

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
| Routen | `?tab=historie` |
| Endpoints | `getVehicleHistoryRemote` |
| Tabellen | `vehicle_purchases`, `vehicle_sales`, `customers`, `vehicle_license_plate_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-237 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
