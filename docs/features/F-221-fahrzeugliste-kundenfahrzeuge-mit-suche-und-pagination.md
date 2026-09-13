---
id: F-221
title: Fahrzeugliste (Kundenfahrzeuge) mit Suche und Pagination
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: ['/vehicles']
endpoints: ['listVehiclesRemote', 'customer']
tables: ['vehicles', 'vehicle_license_plate_versions', 'customers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-221 — Fahrzeugliste (Kundenfahrzeuge) mit Suche und Pagination

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Fahrzeugliste (Kundenfahrzeuge) mit Suche und Pagination

## Erwartetes Verhalten

25/Seite fest, Sortierung `created_at DESC` (nicht wählbar); Spalten Kennzeichen (mono), Marke/Modell (+Badge "Archiviert"), FIN, EZ (roh ISO), HU (roh ISO), Aktion; Zeile klickbar; stale-while-revalidate; Suche/Tab-Wechsel setzen `pageNum=1`

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
| Routen | `/vehicles` |
| Endpoints | `listVehiclesRemote`, `customer` |
| Tabellen | `vehicles`, `vehicle_license_plate_versions`, `customers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-221 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
