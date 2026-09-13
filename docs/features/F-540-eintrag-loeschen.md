---
id: F-540
title: Eintrag löschen
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/calendar/[id]/edit']
endpoints: ['deleteCalendarEntryRemote']
tables: ['calendar_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-540 — Eintrag löschen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Eintrag löschen

## Erwartetes Verhalten

Button „Löschen" → `ConfirmDialog` „Eintrag löschen?" / „Der Eintrag wird unwiderruflich gelöscht." → Toast „Eintrag gelöscht." → `/calendar`. Kein Guard; verknüpfter Auftrag verliert `appointment_id` (SET NULL).

## Nutzersicht

_Wird mit T-019 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-019 ergänzt._

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
| Routen | `/calendar/[id]/edit` |
| Endpoints | `deleteCalendarEntryRemote` |
| Tabellen | `calendar_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-540 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
