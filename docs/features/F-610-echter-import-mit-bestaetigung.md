---
id: F-610
title: Echter Import mit Bestätigung
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: ['/settings/import']
endpoints: ['runMdbImportRemote{dryRun:false}']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-610 — Echter Import mit Bestätigung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Echter Import mit Bestätigung

## Erwartetes Verhalten

ConfirmDialog (Texte §6, danger) → Pipeline → Modal „Import abgeschlossen"; Datei-Input geleert; Toast keiner (nur Modal)

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
| Endpoints | `runMdbImportRemote{dryRun:false}` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-610 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
