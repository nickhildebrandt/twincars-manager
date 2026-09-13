---
id: F-630
title: Audit-Job und Skip-Report
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: []
endpoints: []
tables: ['access_import_jobs']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-630 — Audit-Job und Skip-Report

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Audit-Job und Skip-Report

## Erwartetes Verhalten

Echter Lauf: Zeile `running` → `completed` (Zähler, `tablesProcessed=13`, `notes`) oder `failed` (`notes='Import fehlgeschlagen: …'`); Skip-Report: jede verworfene Zeile mit `table`, `legacyKey`, deutschem `reason`, max. 1000 Details, `skippedTotal` exakt, `skippedDetailTruncated`

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
| Routen | — |
| Endpoints | — |
| Tabellen | `access_import_jobs` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-630 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
