---
title: Anmeldung und Berechtigungen
kategorie: architecture
status: umgesetzt
updated: 2026-09-13
---

# Anmeldung und Berechtigungen

Benutzername und Passwort, sonst nichts. Keine Selbstregistrierung, kein
Zurücksetzen per Mail, keine Fremdanmeldung. Konten legt die Verwaltung an.

Zurück zur [Architektur](README.md) ·
[ADR-019: better-auth bleibt](../decisions/adr-019-better-auth-bleibt.md) ·
[ADR-013: nur Benutzername](../decisions/adr-013-username-only-auth.md)

## Die Bibliothek

better-auth 1.7.4 mit dem Benutzernamen-Zusatz. Vier Tabellen gehören ihr:
`users`, `sessions`, `accounts`, `verifications`. Das Rollenmodell ist
**nicht** ihres — `roles`, `user_roles` und `role_permissions` sind eigene
Tabellen, weil ein Rollenname als kommagetrennte Zeichenkette in einer Spalte
weniger kann als drei Tabellen.

Die erfundene Adresse `<benutzername>@twincars.local` verlässt den Server nie.
Es gibt keine Mail-Anmeldung, kein Zurücksetzen per Mail und keine Adresse
anzuzeigen.

## Der Weg einer Anfrage

| Reihenfolge | Datei                               | Aufgabe                                             |
| ----------- | ----------------------------------- | --------------------------------------------------- |
| 1           | `server/middleware/00.throttle.ts`  | zu viele Anmeldeversuche abweisen                   |
| 2           | `server/middleware/01.auth.ts`      | Sitzung lesen, Rechte laden, an das Ereignis hängen |
| 3           | `server/middleware/02.api-guard.ts` | 401 für alles unter `/api`, was keine Sitzung hat   |
| 4           | der Endpoint selbst                 | `requirePermission(event, '<schlüssel>')`           |

`event.context.auth` ist für die Dauer der Anfrage die einzige Wahrheit. Wer
angemeldet ist, steht dort — Endpoints, Wächter und `/api/me` lesen nur von da.

Der **Cookie-Zwischenspeicher ist aus**. Mit ihm bliebe eine zurückgezogene
Sitzung gültig, bis das Cookie abläuft. Ein Datenbankzugriff je Anfrage ist
billiger als diese Lücke.

## Zwei Fragen, die man nicht verwechseln darf

**Darf ich das Modul sehen?** — `hasModule(rechte, 'hours')`. Wahr, sobald
irgendein Schlüssel des Moduls vorliegt.

**Darf ich genau das hier?** — `hasPermission(rechte, 'hours')`. Wahr nur beim
genauen Schlüssel.

Der Unterschied ist nicht theoretisch: `hours:write_own` erlaubt, die eigene
Zeit zu erfassen, aber nicht, die aller anderen zu lesen. Der Vorgänger
verlangte im Menüeintrag genau `hours:write_own`, sodass eine Rolle mit vollem
Zugriff den Eintrag verlor (B-058). Aufgefallen war es nie, weil die drei
geseedeten Rollen zufällig beide Schlüssel hielten.

## Gesperrte Konten

Ein deaktiviertes Konto wird **vor** dem Anlegen der Sitzung abgewiesen — es
entsteht also gar keine Zeile. Und bei **jeder** Anfrage wird erneut geprüft,
sodass eine Deaktivierung die laufende Arbeit sofort beendet, nicht erst beim
nächsten Anmelden.

Ein unbekannter Benutzername und ein falsches Passwort ergeben dieselbe
Antwort, denselben Status und denselben Text. Jeder Unterschied wäre eine
Auskunft darüber, welche Zugänge es gibt.

## Die Drossel

Zehn Anmeldeversuche je Minute und Adresse, danach 429 mit `Retry-After`.

Gezählt wird **nicht** vom eingebauten Zähler der Bibliothek. Der liest
`x-forwarded-for` von sich aus und akzeptiert einen einwertigen Header; ohne
Proxy davor schickt ein Angreifer bei jedem Versuch eine andere Adresse, landet
nie im selben Eimer, und der Schutz tut nichts (B-003, B-054). Die eigene
Drossel glaubt den Header nur, wenn `TRUST_PROXY=on` gesetzt ist — sonst
entscheidet die Socket-Adresse, die niemand wählen kann.

## Nur vier Endpunkte der Bibliothek

| Endpunkt                          | Zweck                   |
| --------------------------------- | ----------------------- |
| `POST /api/auth/sign-in/username` | anmelden                |
| `POST /api/auth/sign-out`         | abmelden                |
| `GET /api/auth/get-session`       | Sitzung lesen           |
| `POST /api/auth/change-password`  | eigenes Passwort ändern |

Das ist eine **Zulassungsliste**, keine Sperrliste. Der Catch-all des
Vorgängers reichte alles durch, was die Bibliothek anbot: `update-user` ließ
einen Angemeldeten seinen Benutzernamen ändern, obwohl die Oberfläche das
ausschließt (B-051), und `is-username-available` antwortete ohne Sitzung, womit
sich durchprobieren ließ, welche Zugänge es gibt (B-052). Eine Sperrliste hätte
beim nächsten Versionssprung dasselbe Problem.

## Weiterleitung nach der Anmeldung

Das Ziel aus der Adresszeile wird geparst, nicht geprüft-und-geglaubt. Ein
Backslash ist für den Browser ein Schrägstrich, also wird `/\evil.example` zu
`//evil.example` — einem fremden Host. Der Vorgänger ließ genau das durch und
hätte den Nutzer mit gültiger Sitzung auf eine fremde Seite geschickt (B-002,
B-056). `safeRedirectTarget` nimmt nur, was eindeutig innerhalb dieser
Anwendung liegt; alles andere wird durch `/` ersetzt.

## Abmeldung bei Untätigkeit

Nach 60 Minuten ohne Aktivität, einstellbar über `IDLE_TIMEOUT_MINUTES`. Zwei
Minuten vorher erscheint eine Warnung mit Countdown; ein Klick oder ein
Tastendruck genügt.

Die letzte Aktivität steht im lokalen Speicher, den **alle Tabs derselben
Herkunft** lesen. Wer in einem Tab arbeitet, hält alle anderen wach. Beim
Vorgänger zählte jeder Tab für sich: ein im Hintergrund vergessener Tab meldete
den Nutzer ab, während er woanders tippte, und das halb ausgefüllte Formular
war weg (B-013, B-072). Die Abmeldung selbst wird über einen Kanal an alle Tabs
verteilt.

## Fehler, die der Nutzer sieht

| Lage                     | Antwort                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| keine Sitzung            | 401 „Bitte melden Sie sich an." — der Client leitet zur Anmeldung, mit dem ursprünglichen Ziel |
| Sitzung, aber kein Recht | 403 „Sie haben keine Berechtigung für Kunden."                                                 |
| zu viele Versuche        | 429 „Zu viele Versuche. Bitte warten Sie eine Minute."                                         |
| Konto gesperrt           | „Dieses Konto ist deaktiviert. Bitte wenden Sie sich an die Verwaltung."                       |

Eine 403 im Browser führt auf `/403` — eine Seite, die erklärt, was fehlt. Der
Vorgänger zeigte dort nichts.

## Geprüft wird das so

`test/integration/auth.test.ts` treibt die echte Bibliothek gegen ein echtes
PostgreSQL: Passwort hashen, Sitzung schreiben, Konto sperren, Passwort
zurücksetzen. `test/integration/auth-middleware.test.ts` hängt die drei
Middlewares und die echten Endpoint-Dateien in eine kleine h3-Anwendung und
prüft 401, 403, 429 und die Zulassungsliste über HTTP.
`test/unit/endpoint-guards.test.ts` liest jede Endpoint-Datei und besteht
darauf, dass die erste Anweisung ein Wächter ist.

Siehe auch: [Serverschichten](server-schichten.md) ·
[GET /api/me](../api/me-get.md) ·
[Die Endpunkte der Bibliothek](../api/auth-all-.md)
