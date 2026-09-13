---
id: F-494
title: Abwesenheiten je Jahr anzeigen
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-017
permission: offen
routes: ['/employees/[id]']
endpoints: ['listAbsencesRemote']
tables: ['employee_absences', 'company_settings.state']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-494 — Abwesenheiten je Jahr anzeigen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-017** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Abwesenheiten je Jahr anzeigen

## Erwartetes Verhalten

Jahr-Navigation (‹, Jahr = aktuelles Jahr, ›); Liste aller Einträge, die das Jahr berühren; Spalten Typ (Icon), Zeitraum (+ Badge "halbtags", Notiz gekürzt), Tage (`workdaysInYear`), Status-Badge (Geplant=warning, Genehmigt=success, Abgesagt=ghost), Aktion; Leerzustand "Noch keine Abwesenheiten erfasst."

## Nutzersicht

_Wird mit T-017 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-017 ergänzt._

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
| Routen | `/employees/[id]` |
| Endpoints | `listAbsencesRemote` |
| Tabellen | `employee_absences`, `company_settings.state` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-017 ergänzt._

## Quellen

- Inventar: [F-494 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-017 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
