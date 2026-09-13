---
id: F-388
title: Rechnungsdetail: Kunde-/Fahrzeug-/Auftrag-Karten
status: geplant
modul: Angebote, Rechnungen, Storno, PDF-Pipeline, XRechnung
paket: T-022
permission: offen
routes: ['/invoices/[id]']
endpoints: ['getInvoiceRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-388 — Rechnungsdetail: Kunde-/Fahrzeug-/Auftrag-Karten

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-022** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Rechnungsdetail: Kunde-/Fahrzeug-/Auftrag-Karten

## Erwartetes Verhalten

Kunde (Nr, Name, Telefon, E-Mail, „Zum Kunden"), Fahrzeug (Kennzeichen aktuell, Marke/Modell, FIN, EZ, km, „Zum Fahrzeug"), Auftrag (Nr, Titel, „Zum Auftrag") nur wenn verknüpft

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
| Routen | `/invoices/[id]` |
| Endpoints | `getInvoiceRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-022 ergänzt._

## Quellen

- Inventar: [F-388 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-022 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
