---
id: F-374
title: Lagerfahrzeug als Position + Dokument-Fahrzeuglink
status: geplant
modul: Angebote, Rechnungen, Storno, PDF-Pipeline, XRechnung
paket: T-021
permission: offen
routes: []
endpoints: ['pickInventoryVehiclesRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-374 — Lagerfahrzeug als Position + Dokument-Fahrzeuglink

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-021** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Lagerfahrzeug als Position + Dokument-Fahrzeuglink

## Erwartetes Verhalten

`applyVehicleToPosition`: Beschreibung `Fahrzeug <Marke Modell> · Kennz. · FIN · EZ`; §25a → 0 % Bruttopreis, sonst netto = gross/1.19; `onVehiclePicked` setzt `vehicleId` am Dokument

## Nutzersicht

_Wird mit T-021 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-021 ergänzt._

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
| Endpoints | `pickInventoryVehiclesRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-021 ergänzt._

## Quellen

- Inventar: [F-374 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-021 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
