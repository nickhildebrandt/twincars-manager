---
id: F-157
title: Seed Rollen + Permissions
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-005
permission: offen
routes: []
endpoints: ['seedDefaultRoles']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-157 — Seed Rollen + Permissions

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-005** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Seed Rollen + Permissions

## Erwartetes Verhalten

Administrator `*`, Werkstattleiter alle außer settings/users (dynamisch aus `MODULE_PERMISSIONS`), Mitarbeiter kuratierte 12 Keys; nur fehlende Permissions ergänzt, nie entfernt.

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
| Endpoints | `seedDefaultRoles` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-005 ergänzt._

## Quellen

- Inventar: [F-157 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-005 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
