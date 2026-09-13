---
id: F-605
title: Secrets-at-rest-Helfer
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-032
permission: offen
routes: []
endpoints: ['crypto.ts']
tables: ['ebay_credentials', 'smtp_settings.password', 'smtp-settings-service']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-605 — Secrets-at-rest-Helfer

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-032** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Secrets-at-rest-Helfer

## Erwartetes Verhalten

Key = SHA-256(`APP_ENCRYPTION_KEY` ‖ Fallback `APP_SECRET`); fail-closed ohne beides; `decryptSecretIfNeeded` lässt Plaintext-Altbestand durch

## Nutzersicht

_Wird mit T-032 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-032 ergänzt._

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
| Endpoints | `crypto.ts` |
| Tabellen | `ebay_credentials`, `smtp_settings.password`, `smtp-settings-service` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-032 ergänzt._

## Quellen

- Inventar: [F-605 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-032 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
