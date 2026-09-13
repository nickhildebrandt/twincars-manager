---
id: F-360
title: Paginierte Auftragsliste (Server)
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: []
endpoints: ['listWorkOrdersRemote']
tables: ['work_orders']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-360 — Paginierte Auftragsliste (Server)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Paginierte Auftragsliste (Server)

## Erwartetes Verhalten

Filter `q` (inkl. Kennzeichen), `status`, `employeeId`, `customerId` (nur Service); Größe 10/25/50/100; Sortierung `created_at desc`; Rückgabe mit `customerLabel`, `vehiclePlate`, `assigneeNames` — **ohne UI** (B-266)

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
| Endpoints | `listWorkOrdersRemote` |
| Tabellen | `work_orders` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-360 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
