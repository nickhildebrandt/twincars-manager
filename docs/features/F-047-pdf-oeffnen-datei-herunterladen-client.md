---
id: F-047
title: PDF öffnen / Datei herunterladen (Client)
status: geplant
modul: Plattform, Shell, Login, Dashboard, Suche
paket: T-023
permission: offen
routes: []
endpoints: ['pdf-download.ts']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-047 — PDF öffnen / Datei herunterladen (Client)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-023** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

PDF öffnen / Datei herunterladen (Client)

## Erwartetes Verhalten

Blob-URL in neuem Tab (`noopener`) bzw. `<a download>`; Revoke nach 60 s

## Nutzersicht

_Wird mit T-023 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-023 ergänzt._

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
| Endpoints | `pdf-download.ts` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-023 ergänzt._

## Quellen

- Inventar: [F-047 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-023 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
