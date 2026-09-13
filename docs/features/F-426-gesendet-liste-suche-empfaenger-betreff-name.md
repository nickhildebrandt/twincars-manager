---
id: F-426
title: Gesendet-Liste: Suche (Empfänger/Betreff/Name), Typfilter, Monatsnavigation, Pagination 25
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-026
permission: offen
routes: ['/sent']
endpoints: ['listSentRemote']
tables: ['sent_messages']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-426 — Gesendet-Liste: Suche (Empfänger/Betreff/Name), Typfilter, Monatsnavigation, Pagination 25

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-026** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Gesendet-Liste: Suche (Empfänger/Betreff/Name), Typfilter, Monatsnavigation, Pagination 25

## Erwartetes Verhalten

Filterwechsel → Seite 1; stale-while-revalidate; Zeile → Detail

## Nutzersicht

_Wird mit T-026 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-026 ergänzt._

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
| Routen | `/sent` |
| Endpoints | `listSentRemote` |
| Tabellen | `sent_messages` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-026 ergänzt._

## Quellen

- Inventar: [F-426 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-026 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
