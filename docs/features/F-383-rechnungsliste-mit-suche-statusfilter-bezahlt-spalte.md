---
id: F-383
title: Rechnungsliste mit Suche, Statusfilter, Bezahlt-Spalte
status: geplant
modul: Angebote, Rechnungen, Storno, PDF-Pipeline, XRechnung
paket: T-022
permission: offen
routes: ['/invoices']
endpoints: ['listInvoicesRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-383 — Rechnungsliste mit Suche, Statusfilter, Bezahlt-Spalte

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-022** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Rechnungsliste mit Suche, Statusfilter, Bezahlt-Spalte

## Erwartetes Verhalten

Filter Alle/Entwurf/Offen/Bezahlt/Storniert (Werte draft/open/paid/cancelled); Spalten inkl. Kunde, Kennzeichen, Bezahlt (Summe document_payments); Mobil-Karten

## Nutzersicht

_Wird mit T-022 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-022 ergänzt._

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
| Routen | `/invoices` |
| Endpoints | `listInvoicesRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-022 ergänzt._

## Quellen

- Inventar: [F-383 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-022 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
