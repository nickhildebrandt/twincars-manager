---
id: F-138
title: Setup-Gate: App bis Abschluss auf `/setup` umleiten
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-010
permission: offen
routes: []
endpoints: ['getLayoutContext']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-138 — Setup-Gate: App bis Abschluss auf `/setup` umleiten

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-010** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Setup-Gate: App bis Abschluss auf `/setup` umleiten

## Erwartetes Verhalten

Solange `setup_completed=false`: Root-Layout rendert ohne AppShell und leitet **clientseitig** per `goto('/setup')` um (`+layout.svelte:26-30`); Server leitet Anonyme nur nach `/login` (Flash `/`→`/login`→`/setup`).

## Nutzersicht

_Wird mit T-010 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-010 ergänzt._

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
| Endpoints | `getLayoutContext` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-010 ergänzt._

## Quellen

- Inventar: [F-138 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-010 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
