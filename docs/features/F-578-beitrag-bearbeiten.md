---
id: F-578
title: Beitrag bearbeiten
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-030
permission: offen
routes: ['/posts/[id]/edit']
endpoints: ['getPostRemote', 'updatePostRemote']
tables: ['posts']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-578 — Beitrag bearbeiten

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-030** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Beitrag bearbeiten

## Erwartetes Verhalten

Vorbefüllt; Slug bleibt bei unverändertem Titel, sonst neu (mit Suffix bei Kollision); `publishedAt` nur beim ersten Live-Gang; Toast „Beitrag gespeichert."

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
| Routen | `/posts/[id]/edit` |
| Endpoints | `getPostRemote`, `updatePostRemote` |
| Tabellen | `posts` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-030 ergänzt._

## Quellen

- Inventar: [F-578 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-030 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
