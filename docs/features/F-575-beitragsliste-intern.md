---
id: F-575
title: Beitragsliste intern
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-030
permission: offen
routes: ['/posts']
endpoints: ['listPostsRemote']
tables: ['posts']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-575 — Beitragsliste intern

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-030** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Beitragsliste intern

## Erwartetes Verhalten

Suche (Titel/Teaser, ILIKE), Pagination 25, `created_at DESC`, Status-Badge Veröffentlicht/Entwurf, „Veröffentlicht am" (de-DE), Zeile klickbar → Detail, Aktionen Bearbeiten/Löschen; Desktop-Tabelle + Mobil-Kartenliste; stale-while-revalidate; kein Status-Filter in der UI

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
| Routen | `/posts` |
| Endpoints | `listPostsRemote` |
| Tabellen | `posts` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-030 ergänzt._

## Quellen

- Inventar: [F-575 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-030 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
