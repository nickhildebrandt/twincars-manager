---
id: F-242
title: Verkaufsschild-PDF (A4 quer)
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-013
permission: offen
routes: ['/vehicles/[id]']
endpoints: ['getVehicleSaleSignPdfRemote', 'renderVehicleSaleSignPdf', 'renderQrPng']
tables: ['vehicles', 'vehicle_listings', 'vehicle_photos', 'company_settings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-242 — Verkaufsschild-PDF (A4 quer)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-013** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Verkaufsschild-PDF (A4 quer)

## Erwartetes Verhalten

Inhalt s. §3.5; Preis/§25a/Highlights aus Listing (ohne Listing: "Preis auf Anfrage", keine Highlights); Cover = `isMain` sonst erstes Foto; QR → `<origin>/inventory/<id>`; Dateiname `Verkaufsschild_<Marke>_<Modell>.pdf`; nur Bestand (409)

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
| Routen | `/vehicles/[id]` |
| Endpoints | `getVehicleSaleSignPdfRemote`, `renderVehicleSaleSignPdf`, `renderQrPng` |
| Tabellen | `vehicles`, `vehicle_listings`, `vehicle_photos`, `company_settings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-013 ergänzt._

## Quellen

- Inventar: [F-242 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-013 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
