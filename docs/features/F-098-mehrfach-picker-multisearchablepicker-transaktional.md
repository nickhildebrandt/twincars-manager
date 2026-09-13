---
id: F-098
title: Mehrfach-Picker (MultiSearchablePicker) transaktional
status: geplant
modul: Gemeinsame UI-Komponenten und Picker
paket: T-009
permission: offen
routes: ['orders/WorkOrderForm']
endpoints: ['pickEmployeesRemote']
tables: ['employees']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-098 — Mehrfach-Picker (MultiSearchablePicker) transaktional

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-009** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mehrfach-Picker (MultiSearchablePicker) transaktional

## Erwartetes Verhalten

Checkbox-Zeilen, Auswahl über Seiten, „Übernehmen (N)" schreibt, Abbrechen/Backdrop/Esc verwirft; Triggertext ≤ 2 Labels sonst „N ausgewählt"; Clear ohne Dialog

## Nutzersicht

_Wird mit T-009 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-009 ergänzt._

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
| Routen | `orders/WorkOrderForm` |
| Endpoints | `pickEmployeesRemote` |
| Tabellen | `employees` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-009 ergänzt._

## Quellen

- Inventar: [F-098 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-009 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
