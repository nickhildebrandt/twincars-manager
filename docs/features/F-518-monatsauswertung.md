---
id: F-518
title: Monatsauswertung
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-018
permission: offen
routes: ['/hours/reports?tab=monthly']
endpoints: ['monthlyReportRemote']
tables: ['time_entries', 'employees']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-518 — Monatsauswertung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-018** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Monatsauswertung

## Erwartetes Verhalten

Jahr (aktuell − 9 … aktuell), Monat; je Mitarbeiter Stunden, Tage erfasst, Ø Std/Tag (2 NK); Summenzeile (Stunden, Tage)

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
| Routen | `/hours/reports?tab=monthly` |
| Endpoints | `monthlyReportRemote` |
| Tabellen | `time_entries`, `employees` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-018 ergänzt._

## Quellen

- Inventar: [F-518 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-018 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
