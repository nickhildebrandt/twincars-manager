---
id: F-319
title: Rechnungslink auf done-Karten
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/orders']
endpoints: ['kanbanBoardRemote']
tables: ['documents']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-319 — Rechnungslink auf done-Karten

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Rechnungslink auf done-Karten

## Erwartetes Verhalten

done-Karte mit `invoiceId` zeigt Link "Rechnung {nr}" (Receipt-Icon) → `/invoices/{id}`; open/in_progress nie

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
| Routen | `/orders` |
| Endpoints | `kanbanBoardRemote` |
| Tabellen | `documents` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-319 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
