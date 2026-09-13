---
id: F-586
title: Berechtigungen und Navigation
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-030
permission: offen
routes: ['/settings']
endpoints: ['MODULE_PERMISSIONS.posts', 'mailings']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-586 — Berechtigungen und Navigation

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-030** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Berechtigungen und Navigation

## Erwartetes Verhalten

Modul-Permission `posts` für alle Post-Remotes und den Sidebar-Eintrag „Aktuelle Informationen" (Gruppe Kommunikation); „Anfragen" unter Kommunikation und als Settings-Tab, beide mit `mailings`; kein Read/Write-Split

## Nutzersicht

_Wird mit T-030 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-030 ergänzt._

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
| Routen | `/settings` |
| Endpoints | `MODULE_PERMISSIONS.posts`, `mailings` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-030 ergänzt._

## Quellen

- Inventar: [F-586 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-030 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
