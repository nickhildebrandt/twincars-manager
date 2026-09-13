---
id: F-570
title: Online-Reifenbestellung
status: geplant
modul: Öffentliche REST-API, Beiträge, Anfragen
paket: T-031
permission: offen
routes: ['/api/public/orders']
endpoints: ['handlePublicOrder', 'createDocument', 'setDocumentStatus']
tables: ['tires', 'tire_price_versions', 'customers', 'company_settings', 'documents', 'document_items', 'number_ranges']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-570 — Online-Reifenbestellung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-031** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Online-Reifenbestellung

## Erwartetes Verhalten

Positionen nur `online_sellable`-Reifen mit aktuellem Preis (404/400/409), Menge 1..10 000, Lieferadresse Pflicht; Kunde find-or-create (Adresse nur bei Neuanlage); Rechnungsentwurf (`invoice`/`draft`) mit Rechnungsnummer + PDF, Notiz „Online-Bestellung / Lieferadresse …"; MwSt aus `default_vat_rate`; Antwort `orderId`, `orderNumber`, `totalNet`, `totalGross`, `shippingNet: 0`, `estimatedDelivery` = +7 Tage; kein Lagerabgang, keine Kundenmail

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
| Routen | `/api/public/orders` |
| Endpoints | `handlePublicOrder`, `createDocument`, `setDocumentStatus` |
| Tabellen | `tires`, `tire_price_versions`, `customers`, `company_settings`, `documents`, `document_items`, `number_ranges` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-031 ergänzt._

## Quellen

- Inventar: [F-570 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-031 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
