---
id: F-222
title: Listen-Suche über Kennzeichen (alle Versionen), VIN, Marke, Modell, HSN, TSN, Halter-Nachname/Vorname/Firma
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: ['/vehicles']
endpoints: ['listVehiclesRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-222 — Listen-Suche über Kennzeichen (alle Versionen), VIN, Marke, Modell, HSN, TSN, Halter-Nachname/Vorname/Firma

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Listen-Suche über Kennzeichen (alle Versionen), VIN, Marke, Modell, HSN, TSN, Halter-Nachname/Vorname/Firma

## Erwartetes Verhalten

`ILIKE %q%`, case-insensitiv, max 200 Zeichen, Debounce 250 ms; keine Mindestlänge

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
| Endpoints | `listVehiclesRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-222 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
