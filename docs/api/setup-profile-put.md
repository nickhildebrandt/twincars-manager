---
title: PUT /api/setup/profile
kategorie: api
method: PUT
path: /api/setup/profile
permission: offen
status: umgesetzt
features: []
schemas: []
updated: 2026-09-20
---

# /api/setup/profile

Schritt 2 des Assistenten: die Firmendaten.

## Körper

`companyProfileSchema` — Firmenname, Inhaber, Straße, PLZ, Ort, Bundesland,
Telefon, Mobil, Fax, E-Mail, Web. Pflicht sind Firmenname, Straße, PLZ, Ort,
Bundesland, Telefon und E-Mail.

Das **Bundesland** ist eine Auswahl aus sechzehn Werten, kein Freitext: es
steht auf dem Briefkopf und geht in die öffentliche Schnittstelle.

## Antwort

Der Zustand wie bei [`GET /api/setup/state`](setup-state-get.md).

## Berechtigung

`offen`, siehe [`GET /api/setup/state`](setup-state-get.md). Zusätzlich ruft
der Endpunkt `refuseAfterSetup()` als erste Anweisung auf.

## Quelle

`server/api/setup/profile.ts`, Dienste in
`server/services/setup-service.ts` und `server/services/settings-service.ts`.
Geprüft in `test/integration/setup.test.ts` und
`test/unit/settings-schemas.test.ts`.

Zurück zur [API-Übersicht](README.md)
