---
id: F-423
title: Rundschreiben senden in BCC-Batches à 50 mit Teilfehler-Toleranz, Ergebnis `{sent, failed}`
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-027
permission: offen
routes: ['/mailings']
endpoints: ['sendBroadcastEmailRemote', 'sendBroadcastEmail']
tables: ['customers', 'sent_messages', 'smtp_settings', 'company_settings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-423 — Rundschreiben senden in BCC-Batches à 50 mit Teilfehler-Toleranz, Ergebnis `{sent, failed}`

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-027** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Rundschreiben senden in BCC-Batches à 50 mit Teilfehler-Toleranz, Ergebnis `{sent, failed}`

## Erwartetes Verhalten

ConfirmDialog mit Empfängerzahl; Toast success/warning; Formular geleert; `to`=Absender selbst

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
| Endpoints | `sendBroadcastEmailRemote`, `sendBroadcastEmail` |
| Tabellen | `customers`, `sent_messages`, `smtp_settings`, `company_settings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-027 ergänzt._

## Quellen

- Inventar: [F-423 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-027 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
