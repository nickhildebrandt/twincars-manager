---
id: F-451
title: Summen-Cards Einnahmen/Ausgaben/Saldo (gefiltert)
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-028
permission: offen
routes: ['/ledger']
endpoints: ['listLedgerEntriesRemote', 'incomeSum', 'expenseSum']
tables: ['ledger_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-451 — Summen-Cards Einnahmen/Ausgaben/Saldo (gefiltert)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-028** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Summen-Cards Einnahmen/Ausgaben/Saldo (gefiltert)

## Erwartetes Verhalten

Serverseitige `sum(amount_gross)` über den vollen Filter (Monat + Suche + Art), nicht nur die Seite; bei Art-Filter "Einnahmen" ist Ausgaben-Summe 0; Saldo = income − expense, Farbe success/error; `paymentStatus` unberücksichtigt

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
| Endpoints | `listLedgerEntriesRemote`, `incomeSum`, `expenseSum` |
| Tabellen | `ledger_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-028 ergänzt._

## Quellen

- Inventar: [F-451 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-028 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
