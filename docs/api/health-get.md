---
title: GET /api/health
kategorie: api
method: GET
path: /api/health
permission: offen
status: umgesetzt
features: []
schemas: []
updated: 2026-09-13
---

# GET /api/health

Sagt, ob der Prozess antwortet und die Datenbank erreichbar ist. Mehr nicht.

Gedacht für den Container und den vorgelagerten Webserver. **Ohne Anmeldung** —
eine Zustandsprüfung, die Anmeldedaten braucht, ist keine Zustandsprüfung.

## Berechtigung

`offen`. Der einzige Endpunkt ohne Wächter neben der eBay-Pflichtschnittstelle.

## Eingabe

Keine.

## Ausgabe

```json
{ "status": "ok", "database": "ok", "latencyMs": 3 }
```

`latencyMs` ist die Dauer der Prüfabfrage `SELECT 1`.

Die Antwort enthält **bewusst** weder Version noch Konfiguration noch Zahlen
aus dem Betrieb. Der Endpunkt ist öffentlich; jede zusätzliche Angabe wäre eine
Auskunft an jeden, der ihn aufruft. Ein Test hält die Antwort auf genau diese
drei Felder fest.

## Fehler

| Status | Bedingung | Nachricht |
| --- | --- | --- |
| 503 | Datenbank antwortet nicht | Die Datenbank ist nicht erreichbar. |

Der Grund des Ausfalls steht im Serverprotokoll, nicht in der Antwort:
Verbindungsfehler nennen Rechnernamen und Benutzer.

## Quelle

`nuxt/server/api/health.get.ts` — die Verdrahtung.
`nuxt/server/utils/health.ts` — die Prüfung selbst, getestet in
`test/integration/health.test.ts` gegen eine echte und eine unerreichbare
Datenbank. Der Endpunkt wird in `test/e2e/ssr.test.ts` gegen die gebaute
Anwendung geprüft.

Zurück zur [API-Übersicht](README.md) ·
[Serverschichten](../architecture/server-schichten.md)
