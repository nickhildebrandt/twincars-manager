---
id: F-480
title: Schema-Vorräte ohne UI
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-005
permission: offen
routes: []
endpoints: []
tables: ['ledger_entries.supplier_id/customer_id/document_id/recurring_template_id/entry_number', 'ledger_categories.default_tax_rate', 'recurring_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-480 — Schema-Vorräte ohne UI

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-005** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Schema-Vorräte ohne UI

## Erwartetes Verhalten

Existieren in Schema/Migration 0000, werden nirgends geschrieben oder gelesen (außer `entry_number` lesend in Suche/Liste/DATEV); `recurring_entries` ist laut Docs bewusst dormant (ADR-009)

## Nutzersicht

_Wird mit T-005 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-005 ergänzt._

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
| Tabellen | `ledger_entries.supplier_id/customer_id/document_id/recurring_template_id/entry_number`, `ledger_categories.default_tax_rate`, `recurring_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-005 ergänzt._

## Quellen

- Inventar: [F-480 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-005 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
