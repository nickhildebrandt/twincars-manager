---
id: F-497
title: Abwesenheit eintragen (Urlaub/Krankheit/Sonstiges, Status, Halbtag, Notiz)
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-017
permission: offen
routes: ['/employees/[id]']
endpoints: ['getAbsenceConflictsRemote', 'createAbsenceRemote']
tables: ['employee_absences']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-497 — Abwesenheit eintragen (Urlaub/Krankheit/Sonstiges, Status, Halbtag, Notiz)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-017** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Abwesenheit eintragen (Urlaub/Krankheit/Sonstiges, Status, Halbtag, Notiz)

## Erwartetes Verhalten

Defaults: Typ Urlaub, Von/Bis = heute (bzw. 01.01. bei anderem Jahr), Status Genehmigt; Datumswahl in anderem Jahr schaltet Jahr um; Erfolg → Toast, Formular-Reset, Listen beider berührten Jahre aktualisiert

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
| Endpoints | `getAbsenceConflictsRemote`, `createAbsenceRemote` |
| Tabellen | `employee_absences` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-017 ergänzt._

## Quellen

- Inventar: [F-497 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-017 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
