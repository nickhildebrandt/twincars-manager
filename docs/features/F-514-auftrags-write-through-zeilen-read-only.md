---
id: F-514
title: Auftrags-Write-Through-Zeilen read-only
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-018
permission: offen
routes: ['/hours', '/hours/[id]', '/invoices/[id]']
endpoints: ['updateTimeEntryRemote', 'deleteTimeEntryRemote']
tables: ['time_entries.work_order_item_id']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-514 — Auftrags-Write-Through-Zeilen read-only

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-018** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Auftrags-Write-Through-Zeilen read-only

## Erwartetes Verhalten

Badge "Auftrag"; Hinweis "Dieser Eintrag stammt aus einem Auftrag und wird dort gepflegt."; Server 409 gleicher Text; Pflege am Auftrag (Orders-Modul)

## Nutzersicht

_Wird mit T-018 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-018 ergänzt._

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
| Routen | `/hours`, `/hours/[id]`, `/invoices/[id]` |
| Endpoints | `updateTimeEntryRemote`, `deleteTimeEntryRemote` |
| Tabellen | `time_entries.work_order_item_id` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-018 ergänzt._

## Quellen

- Inventar: [F-514 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-018 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
