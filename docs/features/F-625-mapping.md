---
id: F-625
title: Mapping `reifenlager` → `tire_storage`
status: geplant
modul: eBay-Anbindung und KFZ-Kaufmann-Import
paket: T-033
permission: offen
routes: []
endpoints: []
tables: ['tire_storage']
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-625 — Mapping `reifenlager` → `tire_storage`

> **Status: geplant.** Diese Seite hält das Zielverhalten fest, wie es im
> Inventar des Vorgängersystems erhoben wurde. Sie wird mit Arbeitspaket
> **T-033** ausgefüllt und auf `status: umgesetzt` gesetzt.

## Zweck

Mapping `reifenlager` → `tire_storage`

## Erwartetes Verhalten

`IDKunde` = Kunden-Nr, Pflicht + auflösbar (Skip); `Nummer`→`storageNumber` (fehlend → `RL-IMPORT-<Id|uuid8>` + Note; Duplikat → Suffix `-2`, `-3`… + Note); `ID_Auto`→`vehicleId` (optional); `Eingelagert=true` → `retrievedAt=null`, sonst `Abholdatum ?? storedAt`; `Annahmedatum ?? '1900-01-01'`→`storedAt`; `RMarke`→`brand`(80); `Grösse`→`size`(40); `min(VL,VR,HL,HR)`→`profileMm`; `Art`→`season`; `Menge ?? 4`→`quantity`; `notes` = Dup-Note, `Notiz`, „Zustand: …", „Felge: <FMarke>", `AluStahlLose`, „Lagerort: …", „Profil VL/VR/HL/HR: … mm", „DOT: …"

## Nutzersicht

_Wird mit T-033 ergänzt: was der Bediener sieht und tut, Schritt für Schritt._

## Berechtigungen

_Wird mit T-033 ergänzt._

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
| Endpoints | — |
| Tabellen | `tire_storage` |
| Schemata | _offen_ |
| Tests | _offen_ |

## Bekannte Grenzen

_Wird mit T-033 ergänzt._

## Quellen

- Inventar: [F-625 in 01-inventar.md](../rewrite/01-inventar.md)
- Arbeitspaket: [T-033 in 06-arbeitsplan.md](../rewrite/06-arbeitsplan.md)
- Übersicht: [docs/index.md](../index.md)
