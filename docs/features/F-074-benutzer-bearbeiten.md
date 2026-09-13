---
id: F-074
title: Benutzer bearbeiten
status: geplant
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
paket: T-034
permission: offen
routes: ['/settings/users/[id]/edit']
endpoints: ['getUserRemote', 'updateUserRemote']
tables: ['users', 'user_roles']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-074 — Benutzer bearbeiten

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-034** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Benutzer bearbeiten

## Erwartetes Verhalten

Anzeigename (Pflicht) + Rollen (kompletter Ersatz); Username read-only; Toast „Benutzer gespeichert."

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
| Routen | `/settings/users/[id]/edit` |
| Endpoints | `getUserRemote`, `updateUserRemote` |
| Tabellen | `users`, `user_roles` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-034 ergänzt._

## Quellen

- Inventar: [F-074 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-034 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
