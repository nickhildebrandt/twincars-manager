---
id: F-470
title: DATEV-CSV Grundformat
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-028
permission: offen
routes: ['/ledger']
endpoints: ['exportDatevRemote', 'exportDatevCsv']
tables: ['documents', 'ledger_entries', 'ledger_categories']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-470 — DATEV-CSV Grundformat

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-028** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

DATEV-CSV Grundformat

## Erwartetes Verhalten

EXTF 700/21/"Buchungsstapel"/13, 31 Header-Felder (Berater 1000, Mandant 10000, WJ-Beginn 1.1. des `from`-Jahres, Sachkontenlänge 4, Buchungstyp 1, Festschreibung 1, EUR), 125-Spalten-Header, Rows immer 125 Zellen, `;`-getrennt, CRLF, CP1252

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
| Endpoints | `exportDatevRemote`, `exportDatevCsv` |
| Tabellen | `documents`, `ledger_entries`, `ledger_categories` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-028 ergänzt._

## Quellen

- Inventar: [F-470 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-028 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
