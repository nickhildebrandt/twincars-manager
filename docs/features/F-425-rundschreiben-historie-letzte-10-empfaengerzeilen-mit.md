---
id: F-425
title: Rundschreiben-Historie (letzte 10 Empfängerzeilen mit Status)
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-027
permission: offen
routes: ['/mailings']
endpoints: ['listBroadcastHistoryRemote']
tables: ['sent_messages']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-425 — Rundschreiben-Historie (letzte 10 Empfängerzeilen mit Status)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-027** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Rundschreiben-Historie (letzte 10 Empfängerzeilen mit Status)

## Erwartetes Verhalten

nur `documentType='mailing'`, `sentAt DESC`, Limit 10, keine Pagination, kein Link ins Detail

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
| Endpoints | `listBroadcastHistoryRemote` |
| Tabellen | `sent_messages` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-027 ergänzt._

## Quellen

- Inventar: [F-425 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-027 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
