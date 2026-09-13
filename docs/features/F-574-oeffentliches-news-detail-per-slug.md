---
id: F-574
title: Öffentliches News-Detail per Slug
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-031
permission: offen
routes: ['/api/public/posts/[slug]']
endpoints: ['handlePublicPostDetail', 'getPublicPostBySlug']
tables: ['posts']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-574 — Öffentliches News-Detail per Slug

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Öffentliches News-Detail per Slug

## Erwartetes Verhalten

Slug 1..220 Zeichen (400), Entwurf/unbekannt → 404

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
| Routen | `/api/public/posts/[slug]` |
| Endpoints | `handlePublicPostDetail`, `getPublicPostBySlug` |
| Tabellen | `posts` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-574 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
