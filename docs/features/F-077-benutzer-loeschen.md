---
id: F-077
title: Benutzer löschen
status: geplant
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
paket: T-034
permission: offen
routes: ['/settings/users', '/settings/users/[id]/edit']
endpoints: ['deleteUserRemote']
tables: ['users']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-077 — Benutzer löschen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-034** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Benutzer löschen

## Erwartetes Verhalten

ConfirmDialog; letzter Wildcard-Inhaber nicht löschbar (409); optimistischer Listen-Override

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
| Routen | `/settings/users`, `/settings/users/[id]/edit` |
| Endpoints | `deleteUserRemote` |
| Tabellen | `users` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-034 ergänzt._

## Quellen

- Inventar: [F-077 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-034 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
