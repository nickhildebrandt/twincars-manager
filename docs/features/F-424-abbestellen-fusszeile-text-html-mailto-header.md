---
id: F-424
title: Abbestellen-Fußzeile (Text+HTML) + `List-Unsubscribe`-mailto-Header; Opt-out manuell durch Operator
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-027
permission: offen
routes: ['/mailings']
endpoints: ['sendBroadcastEmail']
tables: ['company_settings.email', 'customers.wants_broadcast']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-424 — Abbestellen-Fußzeile (Text+HTML) + `List-Unsubscribe`-mailto-Header; Opt-out manuell durch Operator

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-027** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Abbestellen-Fußzeile (Text+HTML) + `List-Unsubscribe`-mailto-Header; Opt-out manuell durch Operator

## Erwartetes Verhalten

Adresse: Firmenmail → Reply-To → From; Ad-hoc-Mails ohne Fußzeile

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
| Endpoints | `sendBroadcastEmail` |
| Tabellen | `company_settings.email`, `customers.wants_broadcast` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-027 ergänzt._

## Quellen

- Inventar: [F-424 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-027 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
