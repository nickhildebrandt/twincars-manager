---
id: F-229
title: Fahrzeug bearbeiten
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: ['/vehicles/[id]/edit']
endpoints: ['getVehicleRemote', 'updateVehicleRemote']
tables: ['vehicles', 'vehicle_license_plate_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-229 — Fahrzeug bearbeiten

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Fahrzeug bearbeiten

## Erwartetes Verhalten

Alle Felder wie Anlage; Halter optional (Picker mit Label vorbelegt), Vorbesitzer optional (leer → `null` löscht); geändertes Kennzeichen → neue Version `valid_from = heute` (gleicher Tag = Überschreiben); Toast "Fahrzeug gespeichert."

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
| Routen | `/vehicles/[id]/edit` |
| Endpoints | `getVehicleRemote`, `updateVehicleRemote` |
| Tabellen | `vehicles`, `vehicle_license_plate_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-229 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
