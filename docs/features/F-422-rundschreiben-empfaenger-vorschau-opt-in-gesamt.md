---
id: F-422
title: Rundschreiben: Empfänger-Vorschau (Opt-in gesamt, mit E-Mail, 5 Beispielnamen)
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-027
permission: offen
routes: ['/mailings']
endpoints: ['previewBroadcastRecipientsRemote']
tables: ['customers']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-422 — Rundschreiben: Empfänger-Vorschau (Opt-in gesamt, mit E-Mail, 5 Beispielnamen)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-027** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Rundschreiben: Empfänger-Vorschau (Opt-in gesamt, mit E-Mail, 5 Beispielnamen)

## Erwartetes Verhalten

`archived=false AND wantsBroadcast=true`; Hinweis auf übersprungene ohne E-Mail

## Nutzersicht

_Wird mit T-027 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-027 ergänzt._

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
| Routen | `/mailings` |
| Endpoints | `previewBroadcastRecipientsRemote` |
| Tabellen | `customers` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-027 ergänzt._

## Quellen

- Inventar: [F-422 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-027 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
