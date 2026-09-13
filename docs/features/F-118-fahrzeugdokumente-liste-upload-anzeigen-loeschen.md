---
id: F-118
title: Fahrzeugdokumente: Liste/Upload/Anzeigen/Löschen
status: geplant
modul: Gemeinsame UI-Komponenten und Picker
paket: T-012
permission: offen
routes: ['vehicles/[id]']
endpoints: ['listVehicleDocumentsRemote', 'getVehicleDocumentRemote', 'uploadVehicleDocumentRemote', 'deleteVehicleDocumentRemote']
tables: ['vehicle_documents']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-118 — Fahrzeugdokumente: Liste/Upload/Anzeigen/Löschen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Fahrzeugdokumente: Liste/Upload/Anzeigen/Löschen

## Erwartetes Verhalten

Allowlist PDF/JPEG/PNG/WebP + Extension-Fallback, 15 MiB, Notiz ≤ 500, Blob in neuem Tab, ConfirmDialog „Endgültig löschen", Toasts

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
| Routen | `vehicles/[id]` |
| Endpoints | `listVehicleDocumentsRemote`, `getVehicleDocumentRemote`, `uploadVehicleDocumentRemote`, `deleteVehicleDocumentRemote` |
| Tabellen | `vehicle_documents` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-118 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
