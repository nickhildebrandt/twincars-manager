---
id: F-377
title: Angebotsdetail: Positionen, Summen, Endtext, PDF
status: geplant
modul: Angebote, Rechnungen, Storno, PDF-Pipeline, XRechnung
paket: T-021
permission: offen
routes: ['/offers/[id]']
endpoints: ['getOfferRemote', 'getDocumentPdfBytesRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-377 — Angebotsdetail: Positionen, Summen, Endtext, PDF

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-021** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Angebotsdetail: Positionen, Summen, Endtext, PDF

## Erwartetes Verhalten

Tabelle #/Beschreibung(+ArtNr)/Menge Einheit/Einzelpreis/MwSt/Brutto; Zeile mit ArtNr klickbar → `/items?q=`; Summen Status/Datum/Gültig bis/Netto/MwSt/Rabatt/Brutto

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
| Routen | `/offers/[id]` |
| Endpoints | `getOfferRemote`, `getDocumentPdfBytesRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-021 ergänzt._

## Quellen

- Inventar: [F-377 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-021 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
