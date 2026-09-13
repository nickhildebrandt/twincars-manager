---
id: F-344
title: Rechnungserzeugung aus Positionen
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: []
endpoints: ['createDocument']
tables: ['documents', 'document_items', 'number_ranges']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-344 — Rechnungserzeugung aus Positionen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Rechnungserzeugung aus Positionen

## Erwartetes Verhalten

labor → `kind='service'`, `quantity = hours ?? quantity`, `unit='Std.'`, Text + " (ausgeführt von {Vorname Nachname})" wenn Mitarbeiter (Snapshot zur Abschlusszeit), `itemId = item.itemId ?? company_settings.labor_item_id`, `articleNumber` nur aus eigener Katalogzeile; material → `kind = Katalog.kind ?? 'article'`, `articleNumber` aus Katalog, `unit = unit ?? 'Stk'`; `taxRate = default_vat_rate` für alle; `discountPercent` 0; `serviceDate` = heute (UTC); `dueDate = issueDate + default_payment_term_days`; `workOrderId` Backlink; Rundung `round2` je Zeile; Rechnung `status='created'`; PDF persistiert

## Nutzersicht

_Wird mit T-020 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-020 ergänzt._

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
| Endpoints | `createDocument` |
| Tabellen | `documents`, `document_items`, `number_ranges` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-344 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
