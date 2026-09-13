---
id: F-391
title: Rechnung stornieren (GoBD)
status: geplant
modul: Angebote, Rechnungen, Storno, PDF-Pipeline, XRechnung
paket: T-022
permission: offen
routes: ['/invoices/[id]']
endpoints: ['cancelInvoiceRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-391 — Rechnung stornieren (GoBD)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-022** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Rechnung stornieren (GoBD)

## Erwartetes Verhalten

Pflichtgrund ≤500; Storno `S-{N}`, negierte Beträge/Mengen, `issueDate` heute, `dueDate` null, Verkettung beidseitig, Original `cancelled`; Auftrag wieder `in_progress`; Storno-PDF „STORNORECHNUNG … zu Rechnung <Nr>"; Redirect auf Storno

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
| Routen | `/invoices/[id]` |
| Endpoints | `cancelInvoiceRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-022 ergänzt._

## Quellen

- Inventar: [F-391 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-022 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
