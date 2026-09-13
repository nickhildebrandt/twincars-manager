---
id: F-075
title: Passwort-Reset durch Admin
status: geplant
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
paket: T-034
permission: offen
routes: ['/settings/users/[id]/edit']
endpoints: ['updateUserRemote({password})']
tables: ['accounts']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-075 — Passwort-Reset durch Admin

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-034** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Passwort-Reset durch Admin

## Erwartetes Verhalten

eigenes Sub-Formular, 8..128 + Bestätigung, Hash via better-auth, legt Credential-Zeile bei Bedarf an; keine Benachrichtigung, keine Session-Revokation

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
| Endpoints | `updateUserRemote({password})` |
| Tabellen | `accounts` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-034 ergänzt._

## Quellen

- Inventar: [F-075 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-034 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
