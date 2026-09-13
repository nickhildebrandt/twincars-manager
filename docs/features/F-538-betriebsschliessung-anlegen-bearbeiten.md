---
id: F-538
title: Betriebsschließung anlegen/bearbeiten
status: geplant
modul: Kalender, Termine, Feiertage, freie Slots
paket: T-019
permission: offen
routes: ['/calendar/new', '/calendar/[id]/edit']
endpoints: ['kind:'closure'']
tables: ['calendar_entries']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-538 — Betriebsschließung anlegen/bearbeiten

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-019** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Betriebsschließung anlegen/bearbeiten

## Erwartetes Verhalten

Von*/Bis* (`date`), Titel*, Notiz; immer `all_day=true`, `status=null`, keine FKs (Server 400 bei Verstoß); Grenzen `00:00:00Z`–`23:59:59Z`; Grid-Chip je Tag; blockiert Public-Slots vollständig; Toast „Betriebsschließung angelegt."/„… gespeichert.".

## Nutzersicht

_Wird mit T-019 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-019 ergänzt._

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
| Routen | `/calendar/new`, `/calendar/[id]/edit` |
| Endpoints | `kind:'closure'` |
| Tabellen | `calendar_entries` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-019 ergänzt._

## Quellen

- Inventar: [F-538 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-019 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
