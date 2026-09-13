---
id: F-533
title: Termin anlegen
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/calendar/new']
endpoints: ['createCalendarEntryRemote', 'findOverlappingAppointmentsRemote']
tables: ['calendar_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-533 — Termin anlegen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Termin anlegen

## Erwartetes Verhalten

Felder: Art (Termin/Betriebsschließung), Titel* (max 200), Ganztägig, Beginn*, Ende*, Status (Geplant/Abgeschlossen/Abgesagt), Kunde, Fahrzeug, Mitarbeiter, Notiz (max 2000). Defaults nächste volle Stunde / +1 h / Geplant. Toast „Termin angelegt.", danach `/calendar`. Server: `endsAt >= startsAt`, lokal-naives Parsen.

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
| Routen | `/calendar/new` |
| Endpoints | `createCalendarEntryRemote`, `findOverlappingAppointmentsRemote` |
| Tabellen | `calendar_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-533 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
