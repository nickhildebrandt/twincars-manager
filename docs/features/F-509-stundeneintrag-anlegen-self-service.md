---
id: F-509
title: Stundeneintrag anlegen (Self-Service)
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-018
permission: offen
routes: ['/hours/new']
endpoints: ['currentEmployeeRemote', 'createTimeEntryRemote']
tables: ['time_entries', 'employees.private_email']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-509 — Stundeneintrag anlegen (Self-Service)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-018** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Stundeneintrag anlegen (Self-Service)

## Erwartetes Verhalten

Mitarbeiter fest (Name read-only) über `privateEmail = users.email` (nicht archiviert); fremde `employeeId` → 403; kein Profil → 403 "Kein Mitarbeiterprofil verknüpft."

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
| Endpoints | `currentEmployeeRemote`, `createTimeEntryRemote` |
| Tabellen | `time_entries`, `employees.private_email` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-018 ergänzt._

## Quellen

- Inventar: [F-509 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-018 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
