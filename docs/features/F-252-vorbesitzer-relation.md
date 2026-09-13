---
id: F-252
title: Vorbesitzer-Relation
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-013
permission: offen
routes: ['/inventory/new', '/vehicles/[id]/edit']
endpoints: ['createVehicleRemote', 'updateVehicleRemote', 'getVehicleRemote']
tables: ['vehicles.previous_owner_customer_id', 'customers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-252 — Vorbesitzer-Relation

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-013** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Vorbesitzer-Relation

## Erwartetes Verhalten

Optionaler Kunden-Picker in Stock- und Edit-Modus (nicht in Customer-Modus); Detail zeigt Link "<Label>" oder "Zum Kunden"; Ankauf setzt ihn automatisch; Verkauf lässt ihn stehen

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
| Routen | `/inventory/new`, `/vehicles/[id]/edit` |
| Endpoints | `createVehicleRemote`, `updateVehicleRemote`, `getVehicleRemote` |
| Tabellen | `vehicles.previous_owner_customer_id`, `customers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-013 ergänzt._

## Quellen

- Inventar: [F-252 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-013 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
