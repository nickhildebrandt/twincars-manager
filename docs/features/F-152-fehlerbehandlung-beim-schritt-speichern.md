---
id: F-152
title: Fehlerbehandlung beim Schritt-Speichern
status: geplant
modul: Setup-Wizard, Firmeneinstellungen, Nummernkreise
paket: T-010
permission: offen
routes: ['/setup']
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-152 — Fehlerbehandlung beim Schritt-Speichern

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-010** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Fehlerbehandlung beim Schritt-Speichern

## Erwartetes Verhalten

Toast über `handleClientError(e, 'Schritt konnte nicht gespeichert werden')`; Schritt bleibt; Abschlussfehler „Setup konnte nicht abgeschlossen werden".

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
| Routen | `/setup` |
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-010 ergänzt._

## Quellen

- Inventar: [F-152 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-010 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
