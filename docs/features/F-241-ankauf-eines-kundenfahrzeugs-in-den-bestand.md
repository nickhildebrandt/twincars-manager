---
id: F-241
title: Ankauf eines Kundenfahrzeugs in den Bestand
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-013
permission: offen
routes: ['/vehicles/[id]']
endpoints: ['purchaseVehicleIntoStockRemote']
tables: ['vehicles', 'vehicle_purchases', 'vehicle_listings', 'customers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-241 — Ankauf eines Kundenfahrzeugs in den Bestand

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-013** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Ankauf eines Kundenfahrzeugs in den Bestand

## Erwartetes Verhalten

Halter → `previous_owner_customer_id`, `customer_id = NULL`, Ankaufszeile mit Namens-Snapshot und Bruttopreis (0,00 wenn leer), `sold`-Listing → `available`; Permission `inventory`; verweigert für archivierte / bereits Bestand

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
| Routen | `/vehicles/[id]` |
| Endpoints | `purchaseVehicleIntoStockRemote` |
| Tabellen | `vehicles`, `vehicle_purchases`, `vehicle_listings`, `customers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-013 ergänzt._

## Quellen

- Inventar: [F-241 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-013 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
