---
title: PUT /api/setup/hours
kategorie: api
method: PUT
path: /api/setup/hours
permission: offen
status: umgesetzt
features: []
schemas: []
updated: 2026-09-20
---

# /api/setup/hours

Schritt 5: die Öffnungszeiten.

## Körper

`workshopWeekSchema` — **alle sieben** Tage, jeder mit `weekday`, `closed`,
`opensAt`, `closesAt`. Eine Woche mit sechs Tagen ist keine Woche.

**Sonntag ist 0, Samstag ist 6** — dieselbe Zählweise wie `businessWeekday()`
und wie der Seed. Nicht ISO 8601, wo Montag die 1 wäre: eine zweite Zählweise
hieße, an jeder Stelle umzurechnen, an der geprüft wird, ob gerade offen ist.
Genau dort entstehen Fehler, die sich als „montags geschlossen" zeigen.

Die **Anzeige** beginnt trotzdem bei Montag; das ist eine Frage der
Reihenfolge, nicht der Speicherung.

An einem **geschlossenen** Tag werden die Zeiten nicht geprüft.

## Berechtigung

`offen`, siehe [`GET /api/setup/state`](setup-state-get.md).

## Quelle

`server/api/setup/hours.ts`, Dienste in
`server/services/setup-service.ts` und `server/services/settings-service.ts`.
Geprüft in `test/integration/setup.test.ts` und
`test/unit/settings-schemas.test.ts`.

Zurück zur [API-Übersicht](README.md)
