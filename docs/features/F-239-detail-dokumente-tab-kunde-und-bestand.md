---
id: F-239
title: Detail: Dokumente-Tab (Kunde und Bestand)
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: ['?tab=dokumente']
endpoints: ['listVehicleDocumentsRemote', 'uploadVehicleDocumentRemote', 'getVehicleDocumentRemote', 'deleteVehicleDocumentRemote']
tables: ['vehicle_documents']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-239 — Detail: Dokumente-Tab (Kunde und Bestand)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Detail: Dokumente-Tab (Kunde und Bestand)

## Erwartetes Verhalten

Typen PDF/JPEG/PNG/WebP, ≤ 15 MB, optionale Notiz ≤ 500; Liste Name/Größe/Datum/Notiz, neueste zuerst; "Anzeigen" öffnet Blob-Tab; Löschen mit ConfirmDialog; alle `vehicles`-Nutzer dürfen alles (kein Rollen-Split); kein Download-Button (nur Tab)

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
| Routen | `?tab=dokumente` |
| Endpoints | `listVehicleDocumentsRemote`, `uploadVehicleDocumentRemote`, `getVehicleDocumentRemote`, `deleteVehicleDocumentRemote` |
| Tabellen | `vehicle_documents` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-239 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
