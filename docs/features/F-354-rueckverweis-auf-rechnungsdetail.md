---
id: F-354
title: Rückverweis auf Rechnungsdetail
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/invoices/[id]']
endpoints: ['getInvoiceRemote']
tables: ['documents', 'work_orders']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-354 — Rückverweis auf Rechnungsdetail

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Rückverweis auf Rechnungsdetail

## Erwartetes Verhalten

Karte "Auftrag" (Auftragsnr., Titel, Button "Zum Auftrag") für aktive, stornierte und Storno-Rechnungen mit `work_order_id`; auftragsabgeleitete Stunden dort read-only mit Badge "Auftrag"

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
| Routen | `/invoices/[id]` |
| Endpoints | `getInvoiceRemote` |
| Tabellen | `documents`, `work_orders` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-354 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
