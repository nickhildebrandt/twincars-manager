---
id: F-246
title: Bestandsfahrzeug für Rechnungs-Vorbelegung laden
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-013
permission: offen
routes: ['/invoices/new']
endpoints: ['getInventoryVehicleRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-246 — Bestandsfahrzeug für Rechnungs-Vorbelegung laden

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-013** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Bestandsfahrzeug für Rechnungs-Vorbelegung laden

## Erwartetes Verhalten

Liefert Preis/§25a/Kennzeichen; kein Bestands-/Archivfilter

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
| Routen | `/invoices/new` |
| Endpoints | `getInventoryVehicleRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-013 ergänzt._

## Quellen

- Inventar: [F-246 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-013 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
