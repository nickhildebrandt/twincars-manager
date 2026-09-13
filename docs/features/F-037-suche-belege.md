---
id: F-037
title: Suche Belege
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-035
permission: offen
routes: []
endpoints: ['searchDocuments']
tables: ['documents', 'customers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-037 — Suche Belege

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-035** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Suche Belege

## Erwartetes Verhalten

Belegnummer/Kundenfirma/-nachname/-nummer für invoice/offer/cost_estimate/order_confirmation/credit_note; `type` steuert Route

## Nutzersicht

_Wird mit T-035 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-035 ergänzt._

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
| Endpoints | `searchDocuments` |
| Tabellen | `documents`, `customers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-035 ergänzt._

## Quellen

- Inventar: [F-037 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-035 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
