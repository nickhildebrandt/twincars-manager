---
id: F-573
title: Öffentliche News-Liste
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-031
permission: offen
routes: ['/api/public/posts']
endpoints: ['handlePublicPosts', 'listPublicPosts']
tables: ['posts']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-573 — Öffentliche News-Liste

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Öffentliche News-Liste

## Erwartetes Verhalten

Nur `published`, `published_at DESC, created_at DESC`; `page` ≥1 (Default 1), `pageSize` 1..50 (Default 10, größere Werte geklemmt), nicht-positive Werte 400; Envelope `posts/total/page/pageSize/pageCount`; Cover als Data-URL

## Nutzersicht

_Wird mit T-031 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-031 ergänzt._

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
| Routen | `/api/public/posts` |
| Endpoints | `handlePublicPosts`, `listPublicPosts` |
| Tabellen | `posts` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-573 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
