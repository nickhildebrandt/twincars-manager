---
id: F-372
title: Positionen-Editor: Quelle Frei/Artikel/Leistung/Fahrzeug
status: geplant
modul: Angebote, Rechnungen, Storno, PDF-Pipeline, XRechnung
paket: T-021
permission: offen
routes: ['new']
endpoints: ['pickItemsRemote', 'pickInventoryVehiclesRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-372 — Positionen-Editor: Quelle Frei/Artikel/Leistung/Fahrzeug

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-021** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Positionen-Editor: Quelle Frei/Artikel/Leistung/Fahrzeug

## Erwartetes Verhalten

Quellwechsel setzt Beschreibung/Preis zurück (außer → Frei); Picker füllt Beschreibung, Einheit, Preis, kind, articleNumber; Artikelnummer unter dem Select

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
| Routen | `new` |
| Endpoints | `pickItemsRemote`, `pickInventoryVehiclesRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-021 ergänzt._

## Quellen

- Inventar: [F-372 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-021 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
