---
id: F-472
title: DATEV: Ledger-Buchungen exportieren mit Kategorie-Mapping
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-028
permission: offen
routes: []
endpoints: ['exportDatevCsv']
tables: ['ledger_entries', 'ledger_categories']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-472 — DATEV: Ledger-Buchungen exportieren mit Kategorie-Mapping

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-028** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

DATEV: Ledger-Buchungen exportieren mit Kategorie-Mapping

## Erwartetes Verhalten

Alle Buchungen im Zeitraum (jeder `paymentStatus`, jede `source`); Konto/Gegenkonto per Regex auf Kategoriename (siehe §3), Default income 8400/1400, expense 4980/1600; `H` bei income, `S` bei expense; Betrag brutto ohne Steuerschlüssel; Belegfeld 1 = `entry_number` (praktisch leer); Text = Beschreibung

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
| Routen | — |
| Endpoints | `exportDatevCsv` |
| Tabellen | `ledger_entries`, `ledger_categories` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-028 ergänzt._

## Quellen

- Inventar: [F-472 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-028 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
