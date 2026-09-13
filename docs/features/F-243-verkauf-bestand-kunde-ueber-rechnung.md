---
id: F-243
title: Verkauf Bestand → Kunde über Rechnung
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-013
permission: offen
routes: ['/inventory', '/vehicles/[id]', '/invoices/new?vehicleId=']
endpoints: ['getInventoryVehicleRemote', 'sellStockVehicleToCustomer', 'invoices.remote.ts']
tables: ['vehicles', 'vehicle_sales', 'vehicle_photos', 'vehicle_listings', 'documents']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-243 — Verkauf Bestand → Kunde über Rechnung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-013** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Verkauf Bestand → Kunde über Rechnung

## Erwartetes Verhalten

Position + `documents.vehicle_id` vorbelegt; Eigentumsübergang erst bei "bezahlt": Käufer = Rechnungskunde, Verkaufspreis = Rechnungsbrutto gesamt, Verkaufsdatum = Zahlungstag, Fotos gelöscht, Listing `sold`; idempotent pro Zyklus; Vorbesitzer bleibt

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
| Routen | `/inventory`, `/vehicles/[id]`, `/invoices/new?vehicleId=` |
| Endpoints | `getInventoryVehicleRemote`, `sellStockVehicleToCustomer`, `invoices.remote.ts` |
| Tabellen | `vehicles`, `vehicle_sales`, `vehicle_photos`, `vehicle_listings`, `documents` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-013 ergänzt._

## Quellen

- Inventar: [F-243 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-013 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
