---
id: F-244
title: Bestandsliste 'Zu verkaufende Fahrzeuge'
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-013
permission: offen
routes: ['/inventory']
endpoints: ['listInventoryRemote']
tables: ['vehicles', 'vehicle_listings', 'vehicle_license_plate_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-244 — Bestandsliste "Zu verkaufende Fahrzeuge"

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-013** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Bestandsliste "Zu verkaufende Fahrzeuge"

## Erwartetes Verhalten

Nur `archived=false AND customer_id IS NULL`; Sortierung Marke/Modell ASC; 25/Seite; Suche Marke/Modell/FIN/Kennzeichen; Spalten inkl. Standort, VK Brutto (0,00 € ohne Listing), Steuer-Badge; "Verkaufen"-Button; kein Archiv-Tab, kein Bearbeiten-Link, kein Filter nach Listing-Status

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
| Endpoints | `listInventoryRemote` |
| Tabellen | `vehicles`, `vehicle_listings`, `vehicle_license_plate_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-013 ergänzt._

## Quellen

- Inventar: [F-244 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-013 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
