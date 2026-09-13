---
id: F-461
title: Zahlungsart und Zahlungsstatus
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-028
permission: offen
routes: []
endpoints: []
tables: ['ledger_entries.payment_method/payment_status']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-461 — Zahlungsart und Zahlungsstatus

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-028** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Zahlungsart und Zahlungsstatus

## Erwartetes Verhalten

Zahlungsart optional aus `PAYMENT_METHODS` (deutsches Label als Wert); Status `paid`/`open`/`partial`, Default `paid`; Status hat keine Auswirkung auf Summen/Export

## Nutzersicht

_Wird mit T-028 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-028 ergänzt._

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
| Endpoints | — |
| Tabellen | `ledger_entries.payment_method/payment_status` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-028 ergänzt._

## Quellen

- Inventar: [F-461 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-028 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
