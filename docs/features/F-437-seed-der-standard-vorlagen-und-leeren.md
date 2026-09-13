---
id: F-437
title: Seed der Standard-Vorlagen und leeren SMTP-Zeile bei Setup/erstem Request
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-026
permission: offen
routes: ['/setup']
endpoints: ['seedDefaults']
tables: ['mail_templates', 'smtp_settings', 'number_ranges']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-437 — Seed der Standard-Vorlagen und leeren SMTP-Zeile bei Setup/erstem Request

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-026** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Seed der Standard-Vorlagen und leeren SMTP-Zeile bei Setup/erstem Request

## Erwartetes Verhalten

idempotent (`onConflictDoNothing`); Reset nutzt dieselbe Quelle

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
| Routen | `/setup` |
| Endpoints | `seedDefaults` |
| Tabellen | `mail_templates`, `smtp_settings`, `number_ranges` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-026 ergänzt._

## Quellen

- Inventar: [F-437 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-026 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
