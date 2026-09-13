---
id: F-475
title: Berechtigung und Navigation
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-028
permission: offen
routes: []
endpoints: []
tables: ['role_permissions']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-475 — Berechtigung und Navigation

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-028** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Berechtigung und Navigation

## Erwartetes Verhalten

Modul-Key `ledger` (`permissions.ts:38`); Administrator (`*`) und Werkstattleiter haben es, Mitarbeiter nicht; Nav-Items "Buchhaltung" (`/ledger`) und "Rechnungsausgangsbuch" (`/sales-ledger`) beide hinter `ledger`

## Nutzersicht

_Wird mit T-028 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-028 ergänzt._

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
| Endpoints | — |
| Tabellen | `role_permissions` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-028 ergänzt._

## Quellen

- Inventar: [F-475 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-028 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
