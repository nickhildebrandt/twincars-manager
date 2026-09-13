---
title: GET /api/me
kategorie: api
method: GET
path: /api/me
permission: offen
status: umgesetzt
features: []
schemas: []
updated: 2026-09-13
---

# GET /api/me

Wer angemeldet ist und welche Module diese Person sehen darf. Die Oberfläche
liest das einmal beim serverseitigen Rendern, damit Navigation und Schaltflächen
schon im ersten HTML stimmen.

## Berechtigung

`offen` — und trotzdem kein Loch: ohne Sitzung antwortet der Endpunkt mit einem
leeren Zustand. Die Anmeldeseite muss rendern, bevor es eine Sitzung gibt, und
kann nicht im Voraus wissen, ob es eine gibt.

## Ausgabe

Angemeldet:

```json
{
  "user": {
    "id": "…",
    "username": "mmustermann",
    "displayName": "Max Mustermann",
    "roles": ["Werkstattleiter"]
  },
  "permissions": ["customers", "orders"],
  "modules": { "customers": true, "orders": true, "settings": false }
}
```

Nicht angemeldet:

```json
{ "user": null, "permissions": [], "modules": {} }
```

`modules` beantwortet je Modul die Frage **„darf ich das sehen"** — dafür
genügt irgendein Schlüssel des Moduls. Was jemand darin tun darf, entscheidet
weiterhin der jeweilige Endpoint; `hours:write_own` lässt den Menüeintrag
erscheinen, aber keine fremden Zeiteinträge lesen.

Die erfundene Mailadresse und alles Passwortnahe stehen **nicht** in der
Antwort; ein Test hält das fest.

## Fehler

Keine. Der anonyme Fall ist ein gültiger Zustand, kein Fehler.

## Quelle

`nuxt/server/api/me.get.ts`. Geprüft in
`test/integration/auth-middleware.test.ts`.

Zurück zur [API-Übersicht](README.md) ·
[Anmeldung und Berechtigungen](../architecture/auth.md)
