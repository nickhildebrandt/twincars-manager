---
id: F-090
title: `hours:write_own`-Scoping
status: geplant
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
paket: T-018
permission: offen
routes: ['/hours']
endpoints: []
tables: ['employees']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-090 — `hours:write_own`-Scoping

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-018** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

`hours:write_own`-Scoping

## Erwartetes Verhalten

Nutzer ↔ Mitarbeiter über `employees.privateEmail == users.email`; ohne Treffer leere Liste bzw. 403 „Kein Mitarbeiterprofil verknüpft."

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
| Routen | `/hours` |
| Endpoints | — |
| Tabellen | `employees` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-018 ergänzt._

## Quellen

- Inventar: [F-090 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-018 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
