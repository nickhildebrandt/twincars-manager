---
id: F-508
title: Stundeneintrag anlegen (Manager)
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-018
permission: offen
routes: ['/hours/new']
endpoints: ['createTimeEntryRemote']
tables: ['time_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-508 — Stundeneintrag anlegen (Manager)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-018** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Stundeneintrag anlegen (Manager)

## Erwartetes Verhalten

Mitarbeiter-Picker, Datum (heute), Stunden (1; 0,01–24, gespeichert `toFixed(2)`), genau eine Verknüpfung (Beleg via Picker / Kunde via Picker / freie Aufgabe ≤ 200), Notiz ≤ 2000; Erfolg → Detail

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
| Routen | `/hours/new` |
| Endpoints | `createTimeEntryRemote` |
| Tabellen | `time_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-018 ergänzt._

## Quellen

- Inventar: [F-508 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-018 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
