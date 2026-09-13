---
id: F-367
title: Angebotsliste mit Suche, Typfilter, Pagination
status: geplant
modul: Angebote, Rechnungen, Storno, PDF-Pipeline, XRechnung
paket: T-021
permission: offen
routes: ['/offers']
endpoints: ['listOffersRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-367 — Angebotsliste mit Suche, Typfilter, Pagination

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-021** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Angebotsliste mit Suche, Typfilter, Pagination

## Erwartetes Verhalten

25/Seite, Sortierung `issueDate desc, createdAt desc`; Filter Alle/Angebot/KV/AB; bei „Alle" Suche nur nach Nummer, sonst Nummer/Firma/Nachname/Kennzeichen; Filterwechsel setzt Seite 1; stale-while-revalidate

## Nutzersicht

_Wird mit T-021 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-021 ergänzt._

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
| Routen | `/offers` |
| Endpoints | `listOffersRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-021 ergänzt._

## Quellen

- Inventar: [F-367 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-021 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
