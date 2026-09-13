---
id: F-609
title: Vorschau (Dry-Run)
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: ['/settings/import']
endpoints: ['runMdbImportRemote{dryRun:true}']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-609 — Vorschau (Dry-Run)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Vorschau (Dry-Run)

## Erwartetes Verhalten

Parst, mappt, validiert; gleiche Zähler/Skip-Report wie echter Lauf; kein Wipe, keine Inserts, keine Nummernkreise, keine PDFs (nur Anzahl), keine Job-Zeile, kein Fortschritt; Modal „Vorschau des Imports" mit Info-Banner; Datei bleibt gewählt; Button „Jetzt wirklich importieren" → Confirm

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
| Endpoints | `runMdbImportRemote{dryRun:true}` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-609 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
