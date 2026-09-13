---
id: F-000
title: Kurzer Name der Funktion
status: geplant
modul: Bereich aus dem Inventar
paket: T-000
permission: modulschlüssel oder "keine"
routes: ['/beispiel']
endpoints: ['GET /api/beispiel']
tables: ['beispiel']
schemas: ['beispielCreateSchema']
components: ['BeispielFormular']
tests: ['test/integration/beispiel.test.ts']
updated: JJJJ-MM-TT
---

# F-000 — Kurzer Name der Funktion

## Zweck

Ein bis zwei Sätze: was der Betrieb damit erreicht.

## Erwartetes Verhalten

Die Regeln, prüfbar formuliert. Das ist die Spezifikation, gegen die die Tests
geschrieben werden.

## Nutzersicht

Schritt für Schritt, aus Sicht der Bedienung:

1. …
2. …

## Berechtigungen

Wer darf das, und was passiert, wenn nicht.

## Zustände

| Zustand            | Verhalten |
| ------------------ | --------- |
| Leer               |           |
| Laden              |           |
| Fehler             |           |
| Keine Berechtigung |           |

## Technischer Bezug

|           |     |
| --------- | --- |
| Routen    |     |
| Endpoints |     |
| Tabellen  |     |
| Schemata  |     |
| Tests     |     |

## Bekannte Grenzen

Was bewusst nicht geht.

## Quellen

- Inventar: [F-000 in 01-inventar.md](../rewrite/01-inventar.md)
