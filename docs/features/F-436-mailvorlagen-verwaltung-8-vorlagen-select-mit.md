---
id: F-436
title: Mailvorlagen-Verwaltung: 8 Vorlagen (Select mit deutschen Labels, „· angepasst'), Betreff ≤200, Body ≤20 000, Speichern (`isCustom=true`), Reset auf Seed-Default
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-026
permission: offen
routes: ['/settings/mail']
endpoints: ['listMailTemplatesRemote', 'updateMailTemplateRemote', 'resetMailTemplateRemote']
tables: ['mail_templates']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-436 — Mailvorlagen-Verwaltung: 8 Vorlagen (Select mit deutschen Labels, „· angepasst"), Betreff ≤200, Body ≤20 000, Speichern (`isCustom=true`), Reset auf Seed-Default

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-026** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mailvorlagen-Verwaltung: 8 Vorlagen (Select mit deutschen Labels, „· angepasst"), Betreff ≤200, Body ≤20 000, Speichern (`isCustom=true`), Reset auf Seed-Default

## Erwartetes Verhalten

Sortierung alphabetisch nach Key; Platzhalter-Hinweisliste statisch; kein Preview/Testversand der Vorlage

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
| Routen | `/settings/mail` |
| Endpoints | `listMailTemplatesRemote`, `updateMailTemplateRemote`, `resetMailTemplateRemote` |
| Tabellen | `mail_templates` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-026 ergänzt._

## Quellen

- Inventar: [F-436 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-026 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
