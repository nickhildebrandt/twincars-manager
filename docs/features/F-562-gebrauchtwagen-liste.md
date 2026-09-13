---
id: F-562
title: Gebrauchtwagen-Liste
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-031
permission: offen
routes: ['/api/public/used-cars']
endpoints: ['handlePublicUsedCars', 'listPublicUsedCars']
tables: ['vehicles', 'vehicle_listings', 'vehicle_photos']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-562 — Gebrauchtwagen-Liste

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Gebrauchtwagen-Liste

## Erwartetes Verhalten

Bestand = `archived=false AND customer_id IS NULL`, neueste zuerst, ohne Pagination/Filter; Felder make/model/firstRegistration/mileageKm/priceGross/fuel/transmission/description + bis 7 Fotos als Data-URL; Listing-Status ignoriert

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
| Routen | `/api/public/used-cars` |
| Endpoints | `handlePublicUsedCars`, `listPublicUsedCars` |
| Tabellen | `vehicles`, `vehicle_listings`, `vehicle_photos` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-562 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
