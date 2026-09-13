---
id: F-290
title: Öffentlicher Reifenkatalog
status: geplant
modul: Artikel, Reifenkatalog, Reifeneinlagerung, Etiketten
paket: T-015
permission: offen
routes: ['/api/public/tires', '/api/public/tires/[id]']
endpoints: ['listPublicTires', 'getPublicTire']
tables: ['tires', 'tire_photos']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-290 — Öffentlicher Reifenkatalog

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-015** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Öffentlicher Reifenkatalog

## Erwartetes Verhalten

nur `online_sellable`; Filter Größe, Saison, Marke, Höchstpreis; liefert Größenbezeichnung, aktuellen Preis und bis zu sieben Fotos

## Nutzersicht

_Wird mit T-015 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-015 ergänzt._

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
| Routen | `/api/public/tires`, `/api/public/tires/[id]` |
| Endpoints | `listPublicTires`, `getPublicTire` |
| Tabellen | `tires`, `tire_photos` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-015 ergänzt._

## Quellen

- Inventar: [F-290 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-015 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
