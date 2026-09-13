---
id: F-477
title: Dashboard-KPIs aus dem Kassenbuch (Cross-Modul)
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-028
permission: offen
routes: ['/']
endpoints: ['getDashboardKpis']
tables: ['ledger_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-477 — Dashboard-KPIs aus dem Kassenbuch (Cross-Modul)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-028** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Dashboard-KPIs aus dem Kassenbuch (Cross-Modul)

## Erwartetes Verhalten

"Monatsumsatz" = Summe manueller Einnahmen-Buchungen des Kalendermonats (UTC), "Monatsausgaben" analog; Rechnungen fließen nicht ein

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
| Routen | `/` |
| Endpoints | `getDashboardKpis` |
| Tabellen | `ledger_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-028 ergänzt._

## Quellen

- Inventar: [F-477 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-028 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
