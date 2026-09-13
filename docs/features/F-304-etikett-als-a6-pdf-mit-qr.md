---
id: F-304
title: Etikett als A6-PDF mit QR
status: geplant
modul: Artikel, Reifenkatalog, Reifeneinlagerung, Etiketten
paket: T-016
permission: offen
routes: ['/tire-storage/[id]']
endpoints: ['getTireStorageLabelPdfRemote']
tables: ['tire_storage']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-304 — Etikett als A6-PDF mit QR

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-016** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Etikett als A6-PDF mit QR

## Erwartetes Verhalten

Lagernummer lesbar und als QR; Dateiname `Reifenlager_<Nummer>.pdf`

## Nutzersicht

_Wird mit T-016 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-016 ergänzt._

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
| Routen | `/tire-storage/[id]` |
| Endpoints | `getTireStorageLabelPdfRemote` |
| Tabellen | `tire_storage` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-016 ergänzt._

## Quellen

- Inventar: [F-304 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-016 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
