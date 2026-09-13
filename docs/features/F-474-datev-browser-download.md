---
id: F-474
title: DATEV: Browser-Download
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-028
permission: offen
routes: ['/ledger']
endpoints: ['exportDatevRemote(...).run()', 'downloadBase64File']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-474 — DATEV: Browser-Download

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-028** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

DATEV: Browser-Download

## Erwartetes Verhalten

Query im Click-Handler mit `.run()` innerhalb `busy.run`; base64 → Blob `text/csv; charset=windows-1252` → `<a download="DATEV_<from>_bis_<to>.csv">`; Toast "DATEV-Export heruntergeladen."; Modal schließt nur bei Erfolg

## Nutzersicht

_Wird mit T-028 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-028 ergänzt._

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
| Routen | `/ledger` |
| Endpoints | `exportDatevRemote(...).run()`, `downloadBase64File` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-028 ergänzt._

## Quellen

- Inventar: [F-474 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-028 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
