---
id: F-438
title: SMTP-Formular (Absender-Adresse/-Name, Host, Port mit Auto-Vorschlag je Modus, Verschlüsselung, Benutzer, Passwort „leer = behalten')
status: geplant
modul: E-Mail, Vorlagen, SMTP, Zahlungserinnerungen, Rundschreiben
paket: T-026
permission: offen
routes: ['/settings/smtp']
endpoints: ['updateSmtpRemote', 'upsertSmtpSettings']
tables: ['smtp_settings']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-438 — SMTP-Formular (Absender-Adresse/-Name, Host, Port mit Auto-Vorschlag je Modus, Verschlüsselung, Benutzer, Passwort „leer = behalten")

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-026** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

SMTP-Formular (Absender-Adresse/-Name, Host, Port mit Auto-Vorschlag je Modus, Verschlüsselung, Benutzer, Passwort „leer = behalten")

## Erwartetes Verhalten

Passwort nie zum Client (`hasPassword`); Save verschlüsselt, setzt `verified=false`; Reply-To nicht editierbar

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
| Endpoints | `updateSmtpRemote`, `upsertSmtpSettings` |
| Tabellen | `smtp_settings` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-026 ergänzt._

## Quellen

- Inventar: [F-438 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-026 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
