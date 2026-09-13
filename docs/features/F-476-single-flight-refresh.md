---
id: F-476
title: Single-Flight-Refresh
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-028
permission: offen
routes: ['/ledger']
endpoints: ['requested(listLedgerEntriesRemote, 4).refreshAll()', '.updates(...withOverride)']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-476 — Single-Flight-Refresh

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-028** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Single-Flight-Refresh

## Erwartetes Verhalten

Create/Update/Delete refreshen bis zu 4 Listen-Instanzen serverseitig; nur der Listen-Delete deklariert clientseitig `.updates`; Update refresht zusätzlich `getLedgerEntryRemote({id})`

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
| Endpoints | `requested(listLedgerEntriesRemote, 4).refreshAll()`, `.updates(...withOverride)` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-028 ergänzt._

## Quellen

- Inventar: [F-476 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-028 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
