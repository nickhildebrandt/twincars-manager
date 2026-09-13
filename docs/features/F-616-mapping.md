---
id: F-616
title: Mapping `Kunden` → `customers`
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: []
endpoints: []
tables: ['customers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-616 — Mapping `Kunden` → `customers`

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mapping `Kunden` → `customers`

## Erwartetes Verhalten

`Kunden-Nr` Pflicht (sonst Skip „Datensatz ohne Kunden-Nr.") → `customerNumber` = `legacyCustomerNumber`; `kind='ebay'` wenn `Name|Firma|Vorname|Nachname` „ebay" enthält, sonst `regular`; `Firma`(200), `Vorname`(100), `Nachname`(100), `Anrede`(30), `Strasse`(200), `Postleitzahl`(10), `Ort`(150), `Telefonnummer`→`phone`(30), `Natel ?? Telefon2`→`mobile`(30), `Faxnummer`(30), `Email`(254), `Geboren`→`birthday`, `Website`(2048), `UID`→`vatId`(30), `IBAN`(34), `BIC`(11), `BANK`(100), `zahlungsziel`→`paymentTermDays`; `notes` = `Anmerkungen` + „Kto: <KtoInhaber>" + `Auftragsarbeiten` (mit Leerzeilen); `country` bleibt Default „Deutschland"; `ebayHandle` nicht gesetzt

## Nutzersicht

_Wird mit T-033 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-033 ergänzt._

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
| Tabellen | `customers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-616 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
