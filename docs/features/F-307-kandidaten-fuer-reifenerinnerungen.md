---
id: F-307
title: Kandidaten für Reifenerinnerungen
status: geplant
modul: Artikel, Reifenkatalog, Reifeneinlagerung, Etiketten
paket: T-016
permission: offen
routes: []
endpoints: ['findTireReminderCandidates']
tables: ['customers', 'tire_storage', 'tire_reminder_log']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-307 — Kandidaten für Reifenerinnerungen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-016** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Kandidaten für Reifenerinnerungen

## Erwartetes Verhalten

Zustimmung, nicht archiviert, E-Mail vorhanden, aktive Einlagerung, noch nicht benachrichtigt

## Nutzersicht

_Wird mit T-016 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-016 ergänzt._

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
| Endpoints | `findTireReminderCandidates` |
| Tabellen | `customers`, `tire_storage`, `tire_reminder_log` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-016 ergänzt._

## Quellen

- Inventar: [F-307 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-016 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
