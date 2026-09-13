---
id: F-580
title: Slug-Regeln
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-030
permission: offen
routes: []
endpoints: ['slugify', 'uniqueSlug']
tables: ['posts']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-580 — Slug-Regeln

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-030** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Slug-Regeln

## Erwartetes Verhalten

Kleinbuchstaben, `ä→ae ö→oe ü→ue ß→ss`, Diakritika entfernt, Nicht-Alnum → `-`, max 200, Fallback `beitrag`, Kollision → `-2`, `-3`, …, eindeutig per Unique-Index

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
| Routen | — |
| Endpoints | `slugify`, `uniqueSlug` |
| Tabellen | `posts` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-030 ergänzt._

## Quellen

- Inventar: [F-580 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-030 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
