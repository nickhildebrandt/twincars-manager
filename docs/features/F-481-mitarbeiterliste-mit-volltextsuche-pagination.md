---
id: F-481
title: Mitarbeiterliste mit Volltextsuche, Pagination
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-017
permission: offen
routes: ['/employees']
endpoints: ['listEmployeesRemote']
tables: ['employees', 'employee_salary_versions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-481 — Mitarbeiterliste mit Volltextsuche, Pagination

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-017** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mitarbeiterliste mit Volltextsuche, Pagination

## Erwartetes Verhalten

Nur `archived = false`; Suche (ilike, Teilstring) über Vorname, Nachname, Personalnr., Position, Abteilung, private E-Mail, Telefon, Mobil; Sortierung `created_at DESC`; 25/Seite; Suche setzt Seite 1; Spalten Personalnr., Name, Position, Abteilung, Eintritt; Zeile klickbar; Aktionen Bearbeiten/Löschen; stale-while-revalidate

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
| Routen | `/employees` |
| Endpoints | `listEmployeesRemote` |
| Tabellen | `employees`, `employee_salary_versions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-017 ergänzt._

## Quellen

- Inventar: [F-481 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-017 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
