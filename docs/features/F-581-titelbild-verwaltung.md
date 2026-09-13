---
id: F-581
title: Titelbild-Verwaltung
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-030
permission: offen
routes: ['/posts/new', '/posts/[id]/edit']
endpoints: ['postInputSchema.coverImage']
tables: ['posts.cover_image']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-581 — Titelbild-Verwaltung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-030** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Titelbild-Verwaltung

## Erwartetes Verhalten

Ein Bild, Upload/Entfernen im Formular ohne eigenen Roundtrip, Base64 im JSONB, Server-Allowlist + 7-Mio-Zeichen-Kappe; Anzeige im Detail (`max-h-72 object-cover`) und öffentlich als `coverImage.url`

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
| Routen | `/posts/new`, `/posts/[id]/edit` |
| Endpoints | `postInputSchema.coverImage` |
| Tabellen | `posts.cover_image` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-030 ergänzt._

## Quellen

- Inventar: [F-581 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-030 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
