---
id: F-080
title: Rolle anlegen
status: geplant
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
paket: T-034
permission: offen
routes: ['/settings/users/roles/new']
endpoints: ['createRoleRemote']
tables: ['roles', 'role_permissions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-080 — Rolle anlegen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-034** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Rolle anlegen

## Erwartetes Verhalten

Name (Client ≥2, Server 1..100, eindeutig/409), Beschreibung ≤500, Permissions nur bekannte Keys, Wildcard ersetzt Auswahl; Toast „Rolle angelegt."

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
| Routen | `/settings/users/roles/new` |
| Endpoints | `createRoleRemote` |
| Tabellen | `roles`, `role_permissions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-034 ergänzt._

## Quellen

- Inventar: [F-080 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-034 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
