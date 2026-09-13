---
id: F-121
title: PDF-Vorschau per Blob-Iframe (document/reminder)
status: geplant
modul: Gemeinsame UI-Komponenten und Picker
paket: T-023
permission: offen
routes: []
endpoints: ['getDocumentPdfBytesRemote', 'getReminderPdfBytesRemote']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-121 — PDF-Vorschau per Blob-Iframe (document/reminder)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-023** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

PDF-Vorschau per Blob-Iframe (document/reminder)

## Erwartetes Verhalten

Ladeplatzhalter, Iframe mit `#dateiname.pdf`, Fehler-Alert + Toast, Revoke, `height` Prop

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
| Endpoints | `getDocumentPdfBytesRemote`, `getReminderPdfBytesRemote` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-023 ergänzt._

## Quellen

- Inventar: [F-121 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-023 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
