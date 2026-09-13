---
id: F-448
title: Buchungsliste als Monatsansicht mit Monatsnavigation
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-028
permission: offen
routes: ['/ledger']
endpoints: ['listLedgerEntriesRemote']
tables: ['ledger_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-448 — Buchungsliste als Monatsansicht mit Monatsnavigation

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-028** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Buchungsliste als Monatsansicht mit Monatsnavigation

## Erwartetes Verhalten

Default = aktueller Monat; `◀`/`▶` wechseln Monat inkl. Jahreswechsel; "Heute" springt zurück und ist im aktuellen Monat disabled; `from`/`to` = 1. bis letzter Tag (UTC-Berechnung `+page.svelte:66-72`); jeder Wechsel setzt `pageNum=1`; Sortierung `entry_date desc, created_at desc`

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
| Endpoints | `listLedgerEntriesRemote` |
| Tabellen | `ledger_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-028 ergänzt._

## Quellen

- Inventar: [F-448 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-028 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
