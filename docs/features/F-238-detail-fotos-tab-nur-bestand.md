---
id: F-238
title: Detail: Fotos-Tab (nur Bestand)
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: ['?tab=fotos']
endpoints: ['listVehiclePhotosRemote', 'addVehiclePhotoRemote', 'deleteVehiclePhotoRemote', 'setMainVehiclePhotoRemote']
tables: ['vehicle_photos']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-238 — Detail: Fotos-Tab (nur Bestand)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Detail: Fotos-Tab (nur Bestand)

## Erwartetes Verhalten

Multi-Upload + Drag&Drop, 20 MB/Datei, `image/*`; erstes Foto automatisch Titelbild; Titelbild-Badge; "Als Titelbild festlegen"; Löschen ohne Dialog, Cover-Nachrücken; keine Reihenfolge-Änderung; keine Obergrenze; Fotos werden beim Verkauf gelöscht

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
| Routen | `?tab=fotos` |
| Endpoints | `listVehiclePhotosRemote`, `addVehiclePhotoRemote`, `deleteVehiclePhotoRemote`, `setMainVehiclePhotoRemote` |
| Tabellen | `vehicle_photos` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-238 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
