---
title: POST /api/setup/admin
kategorie: api
method: POST
path: /api/setup/admin
permission: offen
status: umgesetzt
features: []
schemas: []
updated: 2026-09-20
---

# /api/setup/admin

Schritt 7: der erste Administrator.

## Körper

`firstAdminSchema` — Benutzername, vollständiger Name, Passwort.

Der **Benutzername** wird kleingeschrieben gespeichert; die getippte
Schreibweise bleibt als `display_username` erhalten. Erlaubt sind
Kleinbuchstaben, Ziffern, Punkt, Bindestrich und Unterstrich.

Das **Passwort** durchläuft alle drei Lagen aus P-14 und E-23 — siehe
[`POST /api/setup/password-check`](setup-password-check-post.md).

## Fehler

| Status | Bedingung |
| --- | --- |
| 400 | das Passwort hält der Prüfung nicht stand; die Meldung sagt warum |
| 409 | es gibt bereits ein Konto — der Assistent legt nur das erste an |
| 409 | die Rolle „Administrator" fehlt; die Vorgaben sind nicht eingespielt |

## Berechtigung

`offen`, und zwar notwendigerweise: es gibt per Definition noch kein Konto.
Dreifach abgesichert — das Setup-Tor, die Prüfung im Dienst und die Drossel,
die jeden Versuch mitzählt.

## Quelle

`server/api/setup/admin.ts`, Dienste in
`server/services/setup-service.ts` und `server/services/settings-service.ts`.
Geprüft in `test/integration/setup.test.ts` und
`test/unit/settings-schemas.test.ts`.

Zurück zur [API-Übersicht](README.md)
