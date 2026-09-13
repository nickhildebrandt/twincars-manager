---
id: F-473
title: DATEV: Feld-Sanitizing und Encoding
status: geplant
modul: Buchhaltung, Kategorien, DATEV-Export
paket: T-028
permission: offen
routes: []
endpoints: ['sanitizeBookingText', 'sanitizeBelegfeld', 'toCp1252LatinString']
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-473 — DATEV: Feld-Sanitizing und Encoding

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-028** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

DATEV: Feld-Sanitizing und Encoding

## Erwartetes Verhalten

Buchungstext: CR/LF/`;` → Leerzeichen, max 60; Belegfeld: nur `0-9A-Za-z$%&*+-/`, max 36; Umlaute/`€`/typografische Zeichen als CP1252-Bytes, nicht abbildbare Zeichen → `?`

## Nutzersicht

_Wird mit T-028 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-028 ergänzt._

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
| Endpoints | `sanitizeBookingText`, `sanitizeBelegfeld`, `toCp1252LatinString` |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-028 ergänzt._

## Quellen

- Inventar: [F-473 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-028 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
