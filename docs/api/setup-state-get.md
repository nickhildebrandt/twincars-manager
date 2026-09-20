---
title: GET /api/setup/state
kategorie: api
method: GET
path: /api/setup/state
permission: offen
status: umgesetzt
features: []
schemas: []
updated: 2026-09-20
---

# /api/setup/state

Sagt, wo der Assistent steht und was noch fehlt.

## Antwort

| Feld | Bedeutung |
| --- | --- |
| `completed` | ob die Einrichtung abgeschlossen ist |
| `hasUser` | ob es schon ein Konto gibt — danach ist Schritt 7 gesperrt |
| `missing` | deutsche Sätze: was dem Abschluss noch im Weg steht |

`missing` ist die Liste, die Schritt 8 anzeigt. Sie schrumpft, während der
Assistent läuft.

## Berechtigung

`offen` — und das ist notwendig: vor dem Abschluss gibt es **kein Konto**, mit
dem man sich anmelden könnte. Ein Wächter hier wäre eine Tür ohne Schlüssel.

Geschützt ist der Weg über das Setup-Tor
([`04.setup-gate.ts`](../architecture/setup.md)): es lässt ihn nur offen,
solange die Einrichtung läuft, und antwortet danach mit **409**.

## Quelle

`server/api/setup/state.ts`, Dienste in
`server/services/setup-service.ts` und `server/services/settings-service.ts`.
Geprüft in `test/integration/setup.test.ts` und
`test/unit/settings-schemas.test.ts`.

Zurück zur [API-Übersicht](README.md)
