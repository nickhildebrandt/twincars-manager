---
id: F-507
title: Stundenliste (Self-Service)
status: geplant
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: T-018
permission: offen
routes: ['/hours']
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-507 — Stundenliste (Self-Service)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-018** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Stundenliste (Self-Service)

## Erwartetes Verhalten

Nur eigene Zeilen (Server erzwingt, `scope` ignoriert); keine Tabs, kein Mitarbeiterfilter, kein Reports-Link; ohne Profil leere Liste

## Nutzersicht

_Wird mit T-018 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-018 ergänzt._

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
| Routen | `/hours` |
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-018 ergänzt._

## Quellen

- Inventar: [F-507 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-018 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
