---
title: POST /api/setup/password-check
kategorie: api
method: POST
path: /api/setup/password-check
permission: offen
status: umgesetzt
features: []
schemas: []
updated: 2026-09-20
---

# /api/setup/password-check

Wie gut ein Passwort ist (P-14, E-23) — damit das Formular sagen kann,
**woran** es liegt, bevor jemand auf „Weiter" drückt.

## Die drei Lagen

1. **Länge** — mindestens zwölf Zeichen. Keine Zusammensetzungsregeln: die
   erzeugen `Passwort1!` und sonst nichts.
2. **Muster** — Wort plus Jahreszahl, Tastaturreihe, Ziffernersetzung, der
   eigene Name, der Firmenname. Läuft **ohne Netz**.
3. **Abgleich gegen echte Datenlecks** über k-Anonymität. Nur fünf Zeichen des
   SHA-1 verlassen den Server.

Lage 3 läuft nur, wenn Lage 1 und 2 durch sind: wer schon an der Länge
scheitert, soll nicht zusätzlich auf einen Netzabruf warten.

## Antwort

| Feld | Bedeutung |
| --- | --- |
| `ok` | ob das Passwort genommen werden darf |
| `problems` | deutsche Sätze, was dagegen spricht |
| `notice` | gesetzt, wenn der Abgleich **nicht möglich** war |

`notice` ist der wichtige Teil: eine Prüfung, die still durchwinkt, erzeugt
Vertrauen, das sie nicht deckt.

Die Antwort trägt **nie** das Passwort und nie seinen Hash.

## Berechtigung

`offen`, siehe [`GET /api/setup/state`](setup-state-get.md).

## Quelle

`server/api/setup/password-check.ts`, Dienste in
`server/services/setup-service.ts` und `server/services/settings-service.ts`.
Geprüft in `test/integration/setup.test.ts` und
`test/unit/settings-schemas.test.ts`.

Zurück zur [API-Übersicht](README.md)
