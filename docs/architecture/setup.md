---
title: Einrichtung und Setup-Tor
kategorie: architecture
status: umgesetzt
updated: 2026-09-20
---

# Einrichtung und Setup-Tor

Bis `company_settings.setup_completed` gesetzt ist, ist die Anwendung **nicht
benutzbar**. Danach ist der Assistent **dauerhaft gesperrt**.

## Das Tor entscheidet der Server

`server/middleware/04.setup-gate.ts`, als viertes Zwischenstück — nach der
Sitzung (02) und nach dem Riegel vor `/api` (03).

| Zustand | Weg | Antwort |
| --- | --- | --- |
| nicht abgeschlossen | `/setup`, `/api/setup/…` | durch |
| nicht abgeschlossen | alles andere | **302** auf `/setup` |
| abgeschlossen | `/setup` | **302** auf `/` |
| abgeschlossen | `/api/setup/…` | **409** mit deutschem Satz |
| immer offen | `/_nuxt`, `/_ipx`, `/api/health`, `/api/auth` | durch |

**Warum nicht im Layout.** Beim Vorgänger leitete das Wurzel-Layout per
`goto('/setup')` um, und der Server schickte Anonyme nur zur Anmeldung. Wer
die Adresse eines Endpunkts kannte, kam daran vorbei: die Daten lagen offen,
bevor überhaupt jemand eingerichtet hatte (**B-001**). Eine Umleitung im
Client ist ein Vorschlag, kein Tor.

**Warum die Antwort zwischengespeichert wird.** Der Zustand ändert sich genau
einmal im Leben einer Installation. Ihn bei jedem Bild, jedem Skript und jeder
Abfrage neu zu lesen, wäre eine Abfrage je Anfrage für eine Antwort, die immer
dieselbe ist. Gespeichert wird nur das **Ja**: das Nein muss jederzeit kippen
können, sobald der Assistent fertig ist. `POST /api/setup/complete` ist der
eine Augenblick, in dem das geschieht.

## Warum die Endpunkte ohne Wächter auskommen

Vor dem Abschluss gibt es **kein Konto**, mit dem man sich anmelden könnte.
Ein `requirePermission` dort wäre eine Tür ohne Schlüssel.

Abgesichert ist jeder dieser Wege dreifach:

1. das Setup-Tor lässt sie nur offen, solange die Einrichtung läuft;
2. `refuseAfterSetup()` steht zusätzlich im Endpunkt, falls jemand das Tor
   umbaut;
3. `createFirstAdmin` weist ab, sobald ein Benutzer existiert.

`test/unit/endpoint-guards.test.ts` zählt die **Flächen**, an denen man ohne
Anmeldung hereinkommt — nicht die Dateien. `setup/*` ist eine einzige, hinter
einem einzigen Tor.

## Die acht Schritte

| # | Schritt | Endpunkt |
| --- | --- | --- |
| 1 | Willkommen | — |
| 2 | Firmendaten | [`PUT /api/setup/profile`](../api/setup-profile-put.md) |
| 3 | Steuer & Bank | [`PUT /api/setup/tax`](../api/setup-tax-put.md) |
| 4 | Belege, Nummernkreise, Stundensatz | [`PUT /api/setup/documents`](../api/setup-documents-put.md) |
| 5 | Öffnungszeiten | [`PUT /api/setup/hours`](../api/setup-hours-put.md) |
| 6 | E-Mail | SMTP, folgt mit T-026 |
| 7 | Zugang | [`PUT /api/setup/security`](../api/setup-security-put.md), [`POST /api/setup/admin`](../api/setup-admin-post.md) |
| 8 | Prüfen und abschließen | [`POST /api/setup/complete`](../api/setup-complete-post.md) |

Nach dem Abschluss ist **jede** dieser Einstellungen über `/settings`
wiederfindbar — mit denselben Schemata. Der Assistent ist kein zweiter Weg in
dieselben Felder, sondern derselbe Weg in anderer Reihenfolge.

## Was der Abschluss verlangt

Firmenname, Straße, PLZ, Ort, E-Mail und ein Administrator-Konto. Nicht alles:
eine Firma ohne Faxnummer kann arbeiten. Aber ein Beleg ohne Absender ist
keiner, und eine Anwendung ohne Administrator ist eine, in die niemand
hineinkommt.

Zurück zur [Architektur-Übersicht](README.md) ·
[Anmeldung und Berechtigungen](auth.md)
