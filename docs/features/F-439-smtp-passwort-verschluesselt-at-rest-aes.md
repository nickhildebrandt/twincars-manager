---
id: F-439
title: SMTP-Passwort verschlüsselt at rest (AES-256-GCM, Legacy-Klartext toleriert)
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-026
permission: offen
routes: []
endpoints: ['encryptSecret', 'decryptSecretIfNeeded']
tables: ['smtp_settings.password']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-439 — SMTP-Passwort verschlüsselt at rest (AES-256-GCM, Legacy-Klartext toleriert)

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-026** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

SMTP-Passwort verschlüsselt at rest (AES-256-GCM, Legacy-Klartext toleriert)

## Erwartetes Verhalten

Key aus `APP_ENCRYPTION_KEY`/`APP_SECRET`; Setup-Wizard nutzt denselben Upsert

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
| Endpoints | `encryptSecret`, `decryptSecretIfNeeded` |
| Tabellen | `smtp_settings.password` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-026 ergänzt._

## Quellen

- Inventar: [F-439 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-026 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
