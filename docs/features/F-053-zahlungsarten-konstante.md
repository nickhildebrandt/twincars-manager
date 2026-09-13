---
id: F-053
title: Zahlungsarten-Konstante
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-006
permission: offen
routes: []
endpoints: ['payment-methods.ts']
tables: ['documents.payment_method', 'ledger_entries.payment_method']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-053 — Zahlungsarten-Konstante

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-006** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Zahlungsarten-Konstante

## Erwartetes Verhalten

Vier deutsche Klartextwerte als Picklist

## Nutzersicht

_Wird mit T-006 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-006 ergänzt._

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
| Endpoints | `payment-methods.ts` |
| Tabellen | `documents.payment_method`, `ledger_entries.payment_method` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-006 ergänzt._

## Quellen

- Inventar: [F-053 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-006 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
