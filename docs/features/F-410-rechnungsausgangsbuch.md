---
id: F-410
title: Rechnungsausgangsbuch
status: geplant
modul: Angebote, Rechnungen, Storno, PDF-Pipeline, XRechnung
paket: T-029
permission: offen
routes: ['/sales-ledger']
endpoints: ['getSalesLedgerRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-410 — Rechnungsausgangsbuch

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-029** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Rechnungsausgangsbuch

## Erwartetes Verhalten

Zeitraum-Presets; StatCards + Tabelle + Summenzeile; alle Rechnungs-Status inkl. Storno (negativ), Entwürfe, created; Permission `ledger`; kein Export, keine Pagination

## Nutzersicht

_Wird mit T-029 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-029 ergänzt._

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
| Routen | `/sales-ledger` |
| Endpoints | `getSalesLedgerRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-029 ergänzt._

## Quellen

- Inventar: [F-410 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-029 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
