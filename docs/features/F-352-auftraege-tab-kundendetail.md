---
id: F-352
title: Aufträge-Tab Kundendetail
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/customers/[id]?tab=auftraege']
endpoints: ['listCustomerWorkOrdersRemote']
tables: ['work_orders']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-352 — Aufträge-Tab Kundendetail

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Aufträge-Tab Kundendetail

## Erwartetes Verhalten

25/Seite, Zähler "N Einträge", Spalten Nummer/Titel/Status/Kennzeichen/Termin ("dd.MM.yyyy, HH:MM"), Zeilenklick → Detail, Leer "Bisher keine Aufträge für diesen Kunden.", Sortierung `created_at desc`

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
| Routen | `/customers/[id]?tab=auftraege` |
| Endpoints | `listCustomerWorkOrdersRemote` |
| Tabellen | `work_orders` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-352 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
