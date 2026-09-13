---
id: F-539
title: Eintrag bearbeiten
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/calendar/[id]/edit']
endpoints: ['getCalendarEntryRemote', 'updateCalendarEntryRemote']
tables: ['calendar_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-539 — Eintrag bearbeiten

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Eintrag bearbeiten

## Erwartetes Verhalten

Formular vorbefüllt inkl. Picker-Labels; Art nicht änderbar (Server: „Die Art eines Eintrags kann nicht nachträglich geändert werden. Bitte neu anlegen."); 404 → Fehlerseite; Toast „Termin gespeichert."; Rückkehr `/calendar`.

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
| Endpoints | `getCalendarEntryRemote`, `updateCalendarEntryRemote` |
| Tabellen | `calendar_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-539 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
