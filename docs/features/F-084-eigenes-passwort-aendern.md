---
id: F-084
title: Eigenes Passwort ändern
status: geplant
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
paket: T-034
permission: offen
routes: ['/settings/account']
endpoints: ['changeOwnPasswordRemote']
tables: ['accounts']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-084 — Eigenes Passwort ändern

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-034** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Eigenes Passwort ändern

## Erwartetes Verhalten

jeder Angemeldete; aktuelles Passwort wird verifiziert; neu ≠ alt, 8..128, Bestätigung; Toast „Passwort aktualisiert."; Sessions bleiben

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
| Routen | `/settings/account` |
| Endpoints | `changeOwnPasswordRemote` |
| Tabellen | `accounts` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-034 ergänzt._

## Quellen

- Inventar: [F-084 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-034 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
