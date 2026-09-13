---
id: F-120
title: Arbeit erfassen (QuickTimeEntryModal)
status: geplant
modul: Gemeinsame UI-Komponenten und Picker
paket: T-018
permission: offen
routes: ['invoices/[id]', 'offers/[id]']
endpoints: ['currentEmployeeRemote', 'createTimeEntryRemote', 'listTimeEntriesRemote.refresh']
tables: ['time_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-120 — Arbeit erfassen (QuickTimeEntryModal)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-018** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Arbeit erfassen (QuickTimeEntryModal)

## Erwartetes Verhalten

Felder/Defaults/Meldungen aus 4.2; Toast „Stunden erfasst."; Button nie validierungs-disabled

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
| Routen | `invoices/[id]`, `offers/[id]` |
| Endpoints | `currentEmployeeRemote`, `createTimeEntryRemote`, `listTimeEntriesRemote.refresh` |
| Tabellen | `time_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-018 ergänzt._

## Quellen

- Inventar: [F-120 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-018 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
