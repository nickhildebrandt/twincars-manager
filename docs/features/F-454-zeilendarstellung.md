---
id: F-454
title: Zeilendarstellung
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-028
permission: offen
routes: ['/ledger']
endpoints: []
tables: ['ledger_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-454 — Zeilendarstellung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-028** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Zeilendarstellung

## Erwartetes Verhalten

Spalten Datum (ISO-Rohformat), Beleg-Nr. (mono, leer wenn null), Beschreibung, Quelle-Badge (`manuell`/Rohwert), Betrag mit `+`/`−` und Farbe, Zahlungsstatus-Badge (Bezahlt grün/Offen rot/Teilweise gezahlt gelb), Aktionen Bearbeiten/Löschen; keine Kategorie-, Netto-, Steuer- oder Zahlungsart-Spalte

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
| Routen | `/ledger` |
| Endpoints | — |
| Tabellen | `ledger_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-028 ergänzt._

## Quellen

- Inventar: [F-454 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-028 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
