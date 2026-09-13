---
id: F-460
title: Brutto-basierte Netto/Steuer-Ableitung
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-028
permission: offen
routes: ['/ledger/new', '/ledger/[id]/edit']
endpoints: ['createLedgerEntryRemote', 'updateLedgerEntryRemote']
tables: ['ledger_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-460 — Brutto-basierte Netto/Steuer-Ableitung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-028** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Brutto-basierte Netto/Steuer-Ableitung

## Erwartetes Verhalten

Server rechnet `net = round2(gross/(1+rate/100))`, `tax = round2(gross−net)`, `taxRate` Default 19; Netto/Steuer sind nicht editierbar und werden im UI nirgends angezeigt

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
| Routen | `/ledger/new`, `/ledger/[id]/edit` |
| Endpoints | `createLedgerEntryRemote`, `updateLedgerEntryRemote` |
| Tabellen | `ledger_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-028 ergänzt._

## Quellen

- Inventar: [F-460 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-028 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
