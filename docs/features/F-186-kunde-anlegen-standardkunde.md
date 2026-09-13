---
id: F-186
title: Kunde anlegen (Standardkunde)
status: geplant
modul: Kunden und Lieferanten
paket: T-011
permission: offen
routes: ['/customers/new']
endpoints: ['createCustomerRemote']
tables: ['customers', 'number_ranges']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-186 — Kunde anlegen (Standardkunde)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-011** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kunde anlegen (Standardkunde)

## Erwartetes Verhalten

Felder Firma/Anrede/Vorname/Nachname/Straße/PLZ/Ort/Telefon/Mobil/E-Mail/Website/Notiz/2 Opt-ins; Regel "Firma oder Nachname" (client); leere Felder → `undefined`; Nummer automatisch; Toast "Kunde angelegt."; Redirect Detail (replaceState)

## Nutzersicht

_Wird mit T-011 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-011 ergänzt._

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
| Routen | `/customers/new` |
| Endpoints | `createCustomerRemote` |
| Tabellen | `customers`, `number_ranges` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-011 ergänzt._

## Quellen

- Inventar: [F-186 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-011 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
