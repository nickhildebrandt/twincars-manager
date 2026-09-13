---
title: GET /api/auth/:all*
kategorie: api
method: GET
path: /api/auth/:all*
permission: offen
status: umgesetzt
features: []
schemas: []
updated: 2026-09-13
---

# /api/auth/…

Die Endpunkte der Anmeldebibliothek, gefiltert. Die Datei ist ein Catch-all,
aber sie reicht **nur vier** Pfade weiter.

## Was erreichbar ist

| Methode | Pfad | Zweck |
| --- | --- | --- |
| POST | `/api/auth/sign-in/username` | anmelden |
| POST | `/api/auth/sign-out` | abmelden |
| GET | `/api/auth/get-session` | Sitzung lesen |
| POST | `/api/auth/change-password` | eigenes Passwort ändern |

Alles andere antwortet **404**, auch wenn die Bibliothek es anbietet.

## Warum eine Zulassungsliste

Der Vorgänger reichte den Catch-all durch. Damit war ungewollt erreichbar:

- `update-user` — ein Angemeldeter konnte seinen Benutzernamen ändern, obwohl
  die Oberfläche das ausschließt (B-051).
- `is-username-available` — ohne Sitzung, also ließ sich durchprobieren, welche
  Zugänge es gibt (B-052).
- `list-sessions`, `revoke-session` — Verwaltungsaufgaben ohne Verwaltung.

Eine Sperrliste hätte beim nächsten Versionssprung dasselbe Problem: was neu
hinzukommt, wäre offen. Mit einer Zulassungsliste bleibt es zu, bis jemand es
bewusst öffnet.

## Berechtigung

`offen`. Die Anmeldung prüft das Passwort selbst.

## Drossel

Zehn Anmeldeversuche je Minute und Adresse, sechzig für die übrigen Pfade.
Gezählt wird in `server/middleware/00.throttle.ts`, nicht von der Bibliothek —
Begründung unter [Anmeldung und Berechtigungen](../architecture/auth.md).

## Fehler

| Status | Bedingung | Nachricht |
| --- | --- | --- |
| 401 | Benutzername oder Passwort falsch | identisch für beide Fälle |
| 403 | Konto deaktiviert | Dieses Konto ist deaktiviert. |
| 404 | Endpunkt nicht zugelassen | Die Seite nicht gefunden. |
| 429 | zu viele Versuche | Zu viele Versuche. Bitte warten Sie eine Minute. |

## Quelle

`nuxt/server/api/auth/[...all].ts`, Liste in `nuxt/server/utils/auth-paths.ts`.
Geprüft in `test/integration/auth-middleware.test.ts` und
`test/unit/auth-paths.test.ts`.

Zurück zur [API-Übersicht](README.md) ·
[Anmeldung und Berechtigungen](../architecture/auth.md)
