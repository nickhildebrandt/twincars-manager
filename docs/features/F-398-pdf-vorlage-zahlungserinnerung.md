---
id: F-398
title: PDF-Vorlage Zahlungserinnerung
status: geplant
modul: Angebote, Rechnungen, Storno, PDF-Pipeline, XRechnung
paket: T-023
permission: offen
routes: []
endpoints: ['renderReminderPdf']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-398 — PDF-Vorlage Zahlungserinnerung

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-023** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

PDF-Vorlage Zahlungserinnerung

## Erwartetes Verhalten

Einseitig; freundlicher Standardtext; Forderungsaufstellung Brutto; kein Mahngebühr/Zinsen; pdfFooter/Grußformel nur bei Platz

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
| Endpoints | `renderReminderPdf` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-023 ergänzt._

## Quellen

- Inventar: [F-398 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-023 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
