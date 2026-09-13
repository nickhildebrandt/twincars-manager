---
id: F-137
title: Route-lokale Modale (9 Dateien)
status: geplant
modul: Gemeinsame UI-Komponenten und Picker
paket: T-009
permission: offen
routes: ['customers/[id]', 'vehicles/PurchaseIntoStockModal', 'offers/new', 'invoices/new', 'invoices/[id]', 'employees/[id]', 'ledger', 'settings/import', 'orders/[id]']
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-137 — Route-lokale Modale (9 Dateien)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-009** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Route-lokale Modale (9 Dateien)

## Erwartetes Verhalten

`modal modal-open`; 3 davon mit `showModal()` (invoices/[id], employees/[id], orders/[id]) — Details bei den Modul-Agenten

## Nutzersicht

_Wird mit T-009 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-009 ergänzt._

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
| Routen | `customers/[id]`, `vehicles/PurchaseIntoStockModal`, `offers/new`, `invoices/new`, `invoices/[id]`, `employees/[id]`, `ledger`, `settings/import`, `orders/[id]` |
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-009 ergänzt._

## Quellen

- Inventar: [F-137 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-009 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
