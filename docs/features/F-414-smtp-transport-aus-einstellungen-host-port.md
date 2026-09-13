---
id: F-414
title: SMTP-Transport aus Einstellungen (Host/Port/Modus none·STARTTLS·TLS/Auth)
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-026
permission: offen
routes: []
endpoints: ['buildTransport', 'mail-service.ts:196-217']
tables: ['smtp_settings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-414 — SMTP-Transport aus Einstellungen (Host/Port/Modus none·STARTTLS·TLS/Auth)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-026** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

SMTP-Transport aus Einstellungen (Host/Port/Modus none·STARTTLS·TLS/Auth)

## Erwartetes Verhalten

`TLS`→`secure:true`; `STARTTLS`→`requireTLS:true`; `none`→beides false; Auth nur bei Username; Passwort via `decryptSecretIfNeeded`; fehlt Host/From → deutscher Fehler; keine Timeouts

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
| Routen | — |
| Endpoints | `buildTransport`, `mail-service.ts:196-217` |
| Tabellen | `smtp_settings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-026 ergänzt._

## Quellen

- Inventar: [F-414 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-026 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
