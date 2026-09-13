---
id: F-607
title: Import-Seite: Datei wählen + Hinweise
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: ['/settings/import']
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-607 — Import-Seite: Datei wählen + Hinweise

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Import-Seite: Datei wählen + Hinweise

## Erwartetes Verhalten

`accept=".mdb,…"`; Nicht-`.mdb` → Toast „Bitte eine .mdb-Datei auswählen." (Datei wird verworfen); Anzeige „Ausgewählt: <name> (<MB> MB)"; Hinweise-Karte mit 5 Punkten (Wipe-Umfang, Settings bleiben, Belege abgeschlossen + PDFs, kein Fahrzeugbezug, Nummern 1:1 / max+1)

## Nutzersicht

_Wird mit T-033 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-033 ergänzt._

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
| Routen | `/settings/import` |
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-607 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
