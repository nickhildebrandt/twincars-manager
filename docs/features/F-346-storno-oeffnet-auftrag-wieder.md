---
id: F-346
title: Storno öffnet Auftrag wieder
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/invoices/[id]', 'cancelInvoice']
endpoints: []
tables: ['work_orders', 'time_entries', 'documents']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-346 — Storno öffnet Auftrag wieder

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Storno öffnet Auftrag wieder

## Erwartetes Verhalten

`status='in_progress'`, `completed_at=null`, `invoice_id=null` (nur wenn Pointer auf das Original zeigt), Zeitbuchungen entbilligt; Storno erbt `work_order_id`; danach Positionen editierbar und Neuabschluss möglich

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
| Routen | `/invoices/[id]`, `cancelInvoice` |
| Endpoints | — |
| Tabellen | `work_orders`, `time_entries`, `documents` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-346 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
