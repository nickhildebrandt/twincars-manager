---
id: F-409
title: Auftrag ↔ Rechnung (Backlink, Reopen)
status: geplant
modul: Angebote, Rechnungen, Storno, PDF-Pipeline, XRechnung
paket: T-022
permission: offen
routes: []
endpoints: ['cancelInvoice', 'completeWorkOrder']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-409 — Auftrag ↔ Rechnung (Backlink, Reopen)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-022** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Auftrag ↔ Rechnung (Backlink, Reopen)

## Erwartetes Verhalten

Storno erbt `workOrderId`; Auftrag zurück auf `in_progress`, `invoiceId` null, Stunden entbilliert

## Nutzersicht

_Wird mit T-022 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-022 ergänzt._

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
| Endpoints | `cancelInvoice`, `completeWorkOrder` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-022 ergänzt._

## Quellen

- Inventar: [F-409 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-022 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
