---
id: F-492
title: Archivierungs-Flag (nur Datenmodell/Filter)
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-017
permission: offen
routes: []
endpoints: ['listEmployeesRemote({ archived })', 'pickEmployeesRemote']
tables: ['employees.archived']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-492 — Archivierungs-Flag (nur Datenmodell/Filter)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-017** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Archivierungs-Flag (nur Datenmodell/Filter)

## Erwartetes Verhalten

Liste liefert wahlweise active/archived/all; Picker, globale Suche und `resolveCurrentEmployeeId` schließen archivierte aus; **keine UI, um zu archivieren/reaktivieren**

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
| Routen | — |
| Endpoints | `listEmployeesRemote({ archived })`, `pickEmployeesRemote` |
| Tabellen | `employees.archived` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-017 ergänzt._

## Quellen

- Inventar: [F-492 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-017 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
