---
id: F-381
title: Angebot → Rechnung konvertieren
status: geplant
modul: Angebote, Rechnungen, Storno, PDF-Pipeline, XRechnung
paket: T-021
permission: offen
routes: ['/offers/[id]/convert']
endpoints: ['convertOfferToInvoiceRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-381 — Angebot → Rechnung konvertieren

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-021** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Angebot → Rechnung konvertieren

## Erwartetes Verhalten

Positionen an-/abwählbar + editierbar; Konditionen; Texte; neue Rechnung `created`; Offer → `converted` + Link; Permission `invoices`

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
| Routen | `/offers/[id]/convert` |
| Endpoints | `convertOfferToInvoiceRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-021 ergänzt._

## Quellen

- Inventar: [F-381 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-021 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
