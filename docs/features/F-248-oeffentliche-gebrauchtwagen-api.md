---
id: F-248
title: Öffentliche Gebrauchtwagen-API
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-031
permission: offen
routes: ['/api/public/used-cars', '/api/public/used-cars/:id']
endpoints: []
tables: ['vehicles', 'vehicle_listings', 'vehicle_photos']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-248 — Öffentliche Gebrauchtwagen-API

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Öffentliche Gebrauchtwagen-API

## Erwartetes Verhalten

Projektion `id, make, model, firstRegistration, mileageKm, priceGross, fuel, transmission, description, photos[≤7]{mime,dataUrl}`; unpaginiert, `created_at DESC`; nur nicht archivierte Bestandsfahrzeuge; Listing-Status wird **nicht** gefiltert (auch `reserved` sichtbar)

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
| Routen | `/api/public/used-cars`, `/api/public/used-cars/:id` |
| Endpoints | — |
| Tabellen | `vehicles`, `vehicle_listings`, `vehicle_photos` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-248 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
