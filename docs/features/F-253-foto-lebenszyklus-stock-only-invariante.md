---
id: F-253
title: Foto-Lebenszyklus (Stock-only-Invariante)
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-013
permission: offen
routes: []
endpoints: ['addVehiclePhoto', 'sellStockVehicleToCustomer']
tables: ['vehicle_photos']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-253 — Foto-Lebenszyklus (Stock-only-Invariante)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-013** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Foto-Lebenszyklus (Stock-only-Invariante)

## Erwartetes Verhalten

Upload nur bei `customer_id IS NULL` (409), Galerie wird beim Verkauf komplett gelöscht, Re-Ankauf startet leer; Liste bleibt für Altbestände lesbar

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
| Routen | — |
| Endpoints | `addVehiclePhoto`, `sellStockVehicleToCustomer` |
| Tabellen | `vehicle_photos` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-013 ergänzt._

## Quellen

- Inventar: [F-253 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-013 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
