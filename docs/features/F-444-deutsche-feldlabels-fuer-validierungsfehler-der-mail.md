---
id: F-444
title: Deutsche Feldlabels für Validierungsfehler der Mail-Schemas
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-004
permission: offen
routes: []
endpoints: ['FIELD_LABELS', 'hooks.server.ts:278-287']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-444 — Deutsche Feldlabels für Validierungsfehler der Mail-Schemas

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-004** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Deutsche Feldlabels für Validierungsfehler der Mail-Schemas

## Erwartetes Verhalten

Abgedeckt: subject, body, filename, attachments, username, password, host, port, fromName; nicht: recipient, fromAddress, replyTo, secure, mime, base64Data, key, reminderDays1, reminderRecurEveryDays

## Nutzersicht

_Wird mit T-004 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-004 ergänzt._

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
| Endpoints | `FIELD_LABELS`, `hooks.server.ts:278-287` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-004 ergänzt._

## Quellen

- Inventar: [F-444 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-004 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
