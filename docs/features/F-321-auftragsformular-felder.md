---
id: F-321
title: Auftragsformular-Felder
status: geplant
modul: Aufträge (Kanban-Arbeitsaufträge)
paket: T-020
permission: offen
routes: ['/orders/new', '/orders/[id]/edit']
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-321 — Auftragsformular-Felder

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-020** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Auftragsformular-Felder

## Erwartetes Verhalten

Fieldset "Auftrag": Titel* (`maxlength=200`), Beschreibung (`textarea maxlength=10000`); Fieldset "Verknüpfungen": Kunde, Fahrzeug, "Geplant am" (`date`), "Beginn (Uhrzeit)" (`time`, disabled ohne Datum, wird ohne Datum nicht gesendet); Fieldset "Zugewiesene Mitarbeiter": MultiSearchablePicker "Mitarbeiter auswählen"/"Mitarbeiter zuweisen" (max. 50 serverseitig)

## Nutzersicht

_Wird mit T-020 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-020 ergänzt._

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
| Routen | `/orders/new`, `/orders/[id]/edit` |
| Endpoints | — |
| Tabellen | — |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-020 ergänzt._

## Quellen

- Inventar: [F-321 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-020 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
