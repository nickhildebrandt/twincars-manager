---
id: F-051
title: Service Worker: Pre-Cache + Network-first + Offline-Shell
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-036
permission: offen
routes: []
endpoints: ['service-worker.ts']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-051 — Service Worker: Pre-Cache + Network-first + Offline-Shell

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-036** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Service Worker: Pre-Cache + Network-first + Offline-Shell

## Erwartetes Verhalten

Cache-Version pro Deploy, sofortige Übernahme, Navigation-Fallback `/`, nur Prod registriert, Dev unregistriert

## Nutzersicht

_Wird mit T-036 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-036 ergänzt._

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
| Endpoints | `service-worker.ts` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-036 ergänzt._

## Quellen

- Inventar: [F-051 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-036 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
