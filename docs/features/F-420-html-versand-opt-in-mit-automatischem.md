---
id: F-420
title: HTML-Versand opt-in mit automatischem Plain-Text-Fallback, Audit speichert nur Text
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-026
permission: offen
routes: ['/customers/[id]', '/mailings']
endpoints: ['sendAdHocCustomerEmail', 'sendBroadcastEmail']
tables: ['sent_messages']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-420 — HTML-Versand opt-in mit automatischem Plain-Text-Fallback, Audit speichert nur Text

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-026** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

HTML-Versand opt-in mit automatischem Plain-Text-Fallback, Audit speichert nur Text

## Erwartetes Verhalten

`asHtml=true` → `html` + `text`; Composer-Label „Nachricht (HTML-Quelltext)", Monospace

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
| Routen | `/customers/[id]`, `/mailings` |
| Endpoints | `sendAdHocCustomerEmail`, `sendBroadcastEmail` |
| Tabellen | `sent_messages` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-026 ergänzt._

## Quellen

- Inventar: [F-420 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-026 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
