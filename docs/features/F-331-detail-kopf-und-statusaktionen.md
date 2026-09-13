---
id: F-331
title: Detail-Kopf und Statusaktionen
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/orders/[id]']
endpoints: ['moveWorkOrderStatusRemote']
tables: ['work_orders']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-331 — Detail-Kopf und Statusaktionen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Detail-Kopf und Statusaktionen

## Erwartetes Verhalten

Titel "AU-… · {title}", Back `/orders`, "Bearbeiten" (Pencil) nur wenn nicht done; Badge (`badge-ghost`/`badge-info`/`badge-success`); Buttons: open → "In Bearbeitung"; in_progress → "Zurück zu Offen"; done ohne Rechnung → "Wieder öffnen" (RotateCcw); "Löschen" (Trash, `text-error`) nur ohne `invoiceId`; optimistisches Status-Override

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
| Routen | `/orders/[id]` |
| Endpoints | `moveWorkOrderStatusRemote` |
| Tabellen | `work_orders` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-331 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
