---
id: F-418
title: Versandprotokoll `sent_messages` (pending → sent/failed, Fehlertext, Message-ID, Anhang-Metadaten)
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-026
permission: offen
routes: ['/sent']
endpoints: []
tables: ['sent_messages']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-418 — Versandprotokoll `sent_messages` (pending → sent/failed, Fehlertext, Message-ID, Anhang-Metadaten)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-026** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Versandprotokoll `sent_messages` (pending → sent/failed, Fehlertext, Message-ID, Anhang-Metadaten)

## Erwartetes Verhalten

Row vor Transportaufbau; Status-Flip danach; Rohfehler in `error_message`; kein Retry

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
| Endpoints | — |
| Tabellen | `sent_messages` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-026 ergänzt._

## Quellen

- Inventar: [F-418 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-026 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
