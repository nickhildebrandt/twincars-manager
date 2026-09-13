---
id: F-231
title: Server-seitige Feldvalidierung mit deutschen Meldungen
status: geplant
modul: Fahrzeuge, Dokumente, Fotos, Bestand, Verkaufsschild
paket: T-012
permission: offen
routes: []
endpoints: ['vehicleInputShape', 'validation.ts']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-231 — Server-seitige Feldvalidierung mit deutschen Meldungen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-012** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Server-seitige Feldvalidierung mit deutschen Meldungen

## Erwartetes Verhalten

Kennzeichen: A-Z/ÄÖÜ/0-9/Leer/Bindestrich, max 12, Upper-Case-Normalisierung; VIN: exakt 17 ohne I/O/Q; HSN 4 Ziffern; TSN 3 alnum; km/ccm/kW Integer-Bereiche; Notiz ≤ 2000; Datumsfelder nur Länge ≤ 10; Ausgabe `Ungültige Eingabe für „<Label>“: <Meldung>`

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
| Routen | — |
| Endpoints | `vehicleInputShape`, `validation.ts` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-012 ergänzt._

## Quellen

- Inventar: [F-231 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-012 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
