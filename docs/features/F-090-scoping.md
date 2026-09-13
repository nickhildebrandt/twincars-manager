---
id: F-090
title: `hours:write_own`-Scoping
status: gestrichen
modul: Authentifizierung, Berechtigungen, Benutzer und Rollen
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

# F-090 — `hours:write_own`-Scoping

> **Status: gestrichen.** Dieses Feature des Vorgängersystems wird **nicht**
> übernommen. Die Entscheidung und ihre Begründung stehen als **M-10** in
> [09-modellaenderungen.md](../rewrite/09-modellaenderungen.md).

## Was der Vorgänger tat

Nutzer ↔ Mitarbeiter über `employees.privateEmail == users.email`; ohne Treffer leere Liste bzw. 403 „Kein Mitarbeiterprofil verknüpft."

## Warum es entfällt

Siehe [M-10 in 09-modellaenderungen.md](../rewrite/09-modellaenderungen.md)
und die Übersicht „Was gestrichen wird" im selben Dokument.

## Quellen

- Inventar: [F-090 in 01-inventar.md](../rewrite/01-inventar.md)
- Abdeckung: [06-abdeckung.md](../rewrite/06-abdeckung.md)
- Übersicht: [docs/index.md](../index.md)
