---
id: F-523
title: Zwei-Stufen-Berechtigung Stunden
status: gestrichen
modul: Mitarbeiter, Abwesenheiten, Zeiterfassung, Öffnungszeiten
paket: gestrichen
permission: entfällt
routes: []
endpoints: []
tables: []
schemas: []
components: []
tests: []
updated: 2026-09-13
---

# F-523 — Zwei-Stufen-Berechtigung Stunden

> **Status: gestrichen.** Dieses Feature des Vorgängersystems wird **nicht**
> übernommen. Die Entscheidung und ihre Begründung stehen als **M-10** in
> [09-modellaenderungen.md](../rewrite/09-modellaenderungen.md).

## Was der Vorgänger tat

`hours` = alles sehen/bearbeiten + Reports; `hours:write_own` = nur eigene Einträge, keine Reports, kein Mitarbeiterfilter; Nav "Stunden" an `hours:write_own` gebunden; Rollen-Seed: Administrator `*`, Werkstattleiter beides, Mitarbeiter nur `write_own`

## Warum es entfällt

Siehe [M-10 in 09-modellaenderungen.md](../rewrite/09-modellaenderungen.md)
und die Übersicht „Was gestrichen wird" im selben Dokument.

## Quellen

- Inventar: [F-523 in 01-inventar.md](../rewrite/01-inventar.md)
- Abdeckung: [06-abdeckung.md](../rewrite/06-abdeckung.md)
- Übersicht: [docs/index.md](../index.md)
