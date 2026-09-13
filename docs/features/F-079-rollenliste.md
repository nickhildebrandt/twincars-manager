---
id: F-079
title: Rollenliste
status: geplant
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
paket: T-034
permission: offen
routes: ['/settings/users']
endpoints: ['listRolesRemote']
tables: ['roles', 'role_permissions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-079 — Rollenliste

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-034** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Rollenliste

## Erwartetes Verhalten

Name (+Badge „System" für Administrator), Beschreibung, Badges: „Voller Zugriff (*)" oder max. 3 Keys + „+N" oder „keine"; Löschen-Button für Admin-Rolle disabled; Leerzustand

## Nutzersicht

_Wird mit T-034 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-034 ergänzt._

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
| Routen | `/settings/users` |
| Endpoints | `listRolesRemote` |
| Tabellen | `roles`, `role_permissions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-034 ergänzt._

## Quellen

- Inventar: [F-079 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-034 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
