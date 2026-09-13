---
id: F-440
title: SMTP-Testversand mit 10-s-Timeouts, kuratierten deutschen Fehlermeldungen, Dirty-Hinweis, Empfänger-Prefill, Double-Fire-Guard (429)
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-026
permission: offen
routes: ['/settings/smtp']
endpoints: ['sendSmtpTestMailRemote', 'sendSmtpTestMail', 'mapSmtpTestError']
tables: ['smtp_settings', 'company_settings.email']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-440 — SMTP-Testversand mit 10-s-Timeouts, kuratierten deutschen Fehlermeldungen, Dirty-Hinweis, Empfänger-Prefill, Double-Fire-Guard (429)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-026** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

SMTP-Testversand mit 10-s-Timeouts, kuratierten deutschen Fehlermeldungen, Dirty-Hinweis, Empfänger-Prefill, Double-Fire-Guard (429)

## Erwartetes Verhalten

Nicht in `sent_messages`; Rohfehler nur Server-Log

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
| Routen | `/settings/smtp` |
| Endpoints | `sendSmtpTestMailRemote`, `sendSmtpTestMail`, `mapSmtpTestError` |
| Tabellen | `smtp_settings`, `company_settings.email` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-026 ergänzt._

## Quellen

- Inventar: [F-440 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-026 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
