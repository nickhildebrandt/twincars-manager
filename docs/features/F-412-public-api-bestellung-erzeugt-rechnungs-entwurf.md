---
id: F-412
title: Public-API-Bestellung erzeugt Rechnungs-Entwurf
status: geplant
modul: Angebote, Rechnungen, Storno, PDF-Pipeline, XRechnung
paket: T-031
permission: offen
routes: ['POST /api/public/orders']
endpoints: ['createDocument', 'setDocumentStatus('draft')']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-412 — Public-API-Bestellung erzeugt Rechnungs-Entwurf

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Public-API-Bestellung erzeugt Rechnungs-Entwurf

## Erwartetes Verhalten

Erscheint als „Entwurf" in `/invoices`; löschbar auf Detail; Nummer aus `invoice`-Kreis

## Nutzersicht

_Wird mit T-031 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-031 ergänzt._

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
| Routen | `POST /api/public/orders` |
| Endpoints | `createDocument`, `setDocumentStatus('draft')` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-412 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
