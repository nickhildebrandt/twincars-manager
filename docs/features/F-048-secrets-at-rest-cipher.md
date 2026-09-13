---
id: F-048
title: Secrets-at-rest-Cipher
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-006
permission: offen
routes: []
endpoints: ['crypto.ts']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-048 — Secrets-at-rest-Cipher

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-006** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Secrets-at-rest-Cipher

## Erwartetes Verhalten

AES-256-GCM `v1:iv:tag:data`; Legacy-Klartext durchreichen; fail-closed ohne Secret

## Nutzersicht

_Wird mit T-006 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-006 ergänzt._

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
| Endpoints | `crypto.ts` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-006 ergänzt._

## Quellen

- Inventar: [F-048 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-006 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
