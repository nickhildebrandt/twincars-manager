---
id: F-070
title: Seed-Rollen
status: geplant
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
paket: T-005
permission: offen
routes: []
endpoints: ['seedDefaults']
tables: ['roles', 'role_permissions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-070 — Seed-Rollen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-005** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Seed-Rollen

## Erwartetes Verhalten

Administrator(`*`), Werkstattleiter (alles außer settings/users, inkl. beider hours-Keys), Mitarbeiter (kuratierte Liste + `hours:write_own`); idempotent, nur additiv

## Nutzersicht

_Wird mit T-005 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-005 ergänzt._

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
| Endpoints | `seedDefaults` |
| Tabellen | `roles`, `role_permissions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-005 ergänzt._

## Quellen

- Inventar: [F-070 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-005 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
