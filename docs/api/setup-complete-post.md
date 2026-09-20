---
title: POST /api/setup/complete
kategorie: api
method: POST
path: /api/setup/complete
permission: offen
status: umgesetzt
features: []
schemas: []
updated: 2026-09-20
---

# /api/setup/complete

Schritt 8: abschließen und freischalten.

Danach ist `/setup` **dauerhaft gesperrt** — es gibt keinen Weg zurück über
die Oberfläche.

## Bedingungen

Geprüft wird im **Dienst**, nicht im Formular: wer den Endpunkt direkt
aufruft, umgeht das Formular.

- Firmenname, Straße, PLZ, Ort und E-Mail stehen — ein Beleg ohne Absender ist
  keiner.
- Es gibt ein Administrator-Konto — sonst stünde eine freigeschaltete
  Anwendung da, in die niemand hineinkommt.

## Fehler

| Status | Bedingung |
| --- | --- |
| 400 | die Einrichtung ist noch nicht vollständig; die Meldung nennt, was fehlt |
| 409 | sie ist bereits abgeschlossen |

## Berechtigung

`offen`, siehe [`GET /api/setup/state`](setup-state-get.md).

## Quelle

`server/api/setup/complete.ts`, Dienste in
`server/services/setup-service.ts` und `server/services/settings-service.ts`.
Geprüft in `test/integration/setup.test.ts` und
`test/unit/settings-schemas.test.ts`.

Zurück zur [API-Übersicht](README.md)
