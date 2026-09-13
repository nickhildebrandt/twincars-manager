---
id: F-576
title: Beitrag anlegen
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-030
permission: offen
routes: ['/posts/new']
endpoints: ['createPostRemote']
tables: ['posts']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-576 — Beitrag anlegen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-030** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Beitrag anlegen

## Erwartetes Verhalten

Pflicht Titel (≤200) + Inhalt (≤50 000), optional Teaser (≤500), Titelbild (PNG/JPEG/WebP ≤ 5 MB), Checkbox Veröffentlicht; Slug automatisch; Toast „Beitrag angelegt."; `formDirty` vor `goto` gelöscht

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
| Routen | `/posts/new` |
| Endpoints | `createPostRemote` |
| Tabellen | `posts` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-030 ergänzt._

## Quellen

- Inventar: [F-576 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-030 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
