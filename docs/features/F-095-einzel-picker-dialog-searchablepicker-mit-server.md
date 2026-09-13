---
id: F-095
title: Einzel-Picker-Dialog (SearchablePicker) mit Server-Suche, Debounce 250 ms, Seite 25, festen Maßen
status: geplant
modul: Gemeinsame UI-Komponenten und Picker
paket: T-009
permission: offen
routes: []
endpoints: ['pickXRemote', '.run()']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-095 — Einzel-Picker-Dialog (SearchablePicker) mit Server-Suche, Debounce 250 ms, Seite 25, festen Maßen

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-009** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Einzel-Picker-Dialog (SearchablePicker) mit Server-Suche, Debounce 250 ms, Seite 25, festen Maßen

## Erwartetes Verhalten

Trigger sieht wie Input aus; Dialog `h-[80dvh] max-h-[640px] max-w-2xl`; Fokus im Suchfeld; Initialsuche; Auswahl schließt und setzt `value`/`valueLabel`; „ausgewählt"-Badge

## Nutzersicht

_Wird mit T-009 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-009 ergänzt._

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
| Endpoints | `pickXRemote`, `.run()` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-009 ergänzt._

## Quellen

- Inventar: [F-095 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-009 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
