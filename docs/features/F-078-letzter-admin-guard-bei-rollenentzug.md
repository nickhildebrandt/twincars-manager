---
id: F-078
title: Letzter-Admin-Guard bei Rollenentzug
status: geplant
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
paket: T-034
permission: offen
routes: []
endpoints: ['updateUserRemote({roleIds})']
tables: ['user_roles', 'role_permissions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-078 — Letzter-Admin-Guard bei Rollenentzug

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-034** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Letzter-Admin-Guard bei Rollenentzug

## Erwartetes Verhalten

409, wenn neuer Rollensatz kein `*` mehr ergibt und kein anderer Wildcard-Inhaber existiert

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
| Routen | — |
| Endpoints | `updateUserRemote({roleIds})` |
| Tabellen | `user_roles`, `role_permissions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-034 ergänzt._

## Quellen

- Inventar: [F-078 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-034 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
