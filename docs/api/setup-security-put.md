---
title: PUT /api/setup/security
kategorie: api
method: PUT
path: /api/setup/security
permission: offen
status: umgesetzt
features: []
schemas: []
updated: 2026-09-20
---

# /api/setup/security

Schritt 7: Administrator-Adresse und sicherer Adressbereich.

## Körper

`securitySettingsSchema`:

| Feld | Bedeutung |
| --- | --- |
| `adminEmail` | wohin gravierende Vorfälle gemeldet werden (P-23) — getrennt von der Geschäftsadresse, die auf jeder Rechnung steht |
| `safeIpRanges` | Adressen, die nie gesperrt werden (P-22) |

Der sichere Bereich versteht einzelne Adressen (`10.0.0.5`), Netze
(`192.168.1.0/24`) und Bereiche (`192.168.2.10-50`), je Zeile einen Eintrag,
Notizen hinter `#`. **Leer ist die Voreinstellung** — die Sperre gilt dann
überall, auch im eigenen Netz.

Ein Eintrag, den die Anwendung nicht versteht, wird **beim Speichern**
abgewiesen. Gespeichert wirkte er nie, und niemand merkte es — bis sich jemand
aussperrt.

## Berechtigung

`offen`, siehe [`GET /api/setup/state`](setup-state-get.md).

## Quelle

`server/api/setup/security.ts`, Dienste in
`server/services/setup-service.ts` und `server/services/settings-service.ts`.
Geprüft in `test/integration/setup.test.ts` und
`test/unit/settings-schemas.test.ts`.

Zurück zur [API-Übersicht](README.md)
