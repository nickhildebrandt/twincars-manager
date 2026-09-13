---
id: F-394
title: XRechnung-Download
status: geplant
modul: Angebote, Rechnungen, Storno, PDF-Pipeline, XRechnung
paket: T-024
permission: offen
routes: ['/invoices/[id]']
endpoints: ['getInvoiceXRechnungRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-394 — XRechnung-Download

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-024** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

XRechnung-Download

## Erwartetes Verhalten

UBL 2.1 / XRechnung 3.0 XML `<Nr>.xml`; Stammdaten-Pflichtprüfung (Firma E-Mail, Telefon, IBAN; Kunde Nr + E-Mail) mit deutschen 400-Meldungen; BuyerReference = Kundennummer

## Nutzersicht

_Wird mit T-024 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-024 ergänzt._

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
| Routen | `/invoices/[id]` |
| Endpoints | `getInvoiceXRechnungRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-024 ergänzt._

## Quellen

- Inventar: [F-394 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-024 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
