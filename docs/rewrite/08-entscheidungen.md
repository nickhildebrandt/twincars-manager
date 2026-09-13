# 08 — Entscheidungen und Annahmen

> Teil des Rewrite-Plans. Siehe [00-uebersicht.md](00-uebersicht.md) ·
> [02-befunde.md](02-befunde.md) · [03-architektur.md](03-architektur.md) ·
> [06-arbeitsplan.md](06-arbeitsplan.md)

Zwei Listen:

- **A-nn — Annahmen.** Wurden getroffen, weil die Planung sonst nicht
  weiterlaufen konnte. Sie sind umgesetzt, bis jemand widerspricht.
- **E-nn — Entscheidungen.** Getroffen (`entschieden`) oder offen
  (`offen`). Offene Punkte blockieren den Rewrite nicht: es gibt für jeden
  eine Vorgehensempfehlung, die umgesetzt wird, solange nichts anderes gesagt
  wird.

Jede getroffene Entscheidung bekommt beim Umsetzen eine Seite unter
`docs/decisions/` (Kontext, Optionen, Entscheidung, Konsequenzen).

---

## Annahmen

| ID       | Annahme                                                                                                                                                          | Begründung                                                                                             | Rücknahme kostet                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| **A-01** | Die neue Anwendung entsteht in **`nuxt/`** im selben Repository; beim Cutover wandert sie ins Repo-Root                                                          | Der Altbestand darf nicht verändert werden, Root-Dateien sind belegt                                   | eine Verschiebung, kein inhaltlicher Aufwand |
| **A-02** | Die Produktdokumentation entsteht im **Repo-Root unter `docs/`** und übernimmt die vorhandene Wissensbasis schrittweise                                          | So vorgegeben; `docs/rewrite/` bleibt davon getrennt                                                   | —                                            |
| **A-03** | Es gibt eine neue Datei `docs/index.md` neben der alten `docs/INDEX.md`. Auf Dateisystemen, die Groß- und Kleinschreibung nicht unterscheiden, kollidieren beide | Der Einstiegspunkt wurde so vorgegeben; entwickelt wird auf Linux                                      | die alte Datei wird beim Cutover entfernt    |
| **A-04** | Gearbeitet wird auf dem Zweig **`rewrite/nuxt`**, ein Commit je Arbeitspaket                                                                                     | semantic-release veröffentlicht von `main`; der Rewrite läuft lange                                    | —                                            |
| **A-05** | Die Oberfläche bleibt **einsprachig deutsch**; kein i18n-Modul                                                                                                   | wie im Bestand                                                                                         | erheblicher Nachbau                          |
| **A-06** | Es gibt **eine** Installation, einen Betrieb, keine Mandantenfähigkeit                                                                                           | wie im Bestand                                                                                         | Datenmodell-Eingriff                         |
| **A-07** | Die Zeitzone ist fest **`Europe/Berlin`**                                                                                                                        | Der Betrieb arbeitet in Deutschland; heute hängt die Slot-Berechnung an der Container-Zeitzone (B-512) | —                                            |
| **A-08** | Die anonymisierte Testdatenbank des Bestands wird als Ausgangspunkt für die E2E-Fixture weiterverwendet                                                          | spart die Neuerzeugung aus der Legacy-Datei                                                            | Neuerzeugung, benötigt die `.mdb`            |

---

## Entschiedene Punkte

### E-01 — Authentifizierung bleibt better-auth · `entschieden`

**Kontext.** Der Bestand nutzt better-auth mit Benutzername-Plugin, eigenem
Rollenmodell und den Tabellen `users`, `sessions`, `accounts`, `verifications`.

**Optionen.** (a) better-auth behalten · (b) `nuxt-auth-utils` (versiegelte
Cookie-Sitzungen, sehr schlank) · (c) `@sidebase/nuxt-auth`.

**Entscheidung: (a).** Ausschlaggebend ist der Migrationsaufwand: Tabellen,
Passwort-Hashes (scrypt, Format `salt:key`), Cookie-Präfix und `APP_SECRET`
bleiben unverändert — **keine Datenmigration, keine Passwortzurücksetzung,
laufende Sitzungen bleiben gültig**. Serverseitige Sitzungen mit Widerruf,
Anmeldedrosselung und Schutz gegen Benutzernamen-Erkennung sind eingebaut;
bei (b) müsste jedes dieser Stücke nachgebaut werden und entspräche am Ende
dem heutigen Server-Hook in Nuxt-Form.

**Konsequenzen.** Abhängigkeit von einem Projekt mit hoher Änderungsrate →
Version exakt festnageln, Adapter-Diff als CI-Prüfung. Das
`admin`-Plugin wird **nicht** übernommen; das eigene Rechtemodell bleibt.
Cookie-Zwischenspeicher bleibt aus, damit ein Widerruf sofort wirkt.

### E-02 — Migrationen: Squash-Baseline · `entschieden`

**Kontext.** Die Drizzle-Snapshots des Bestands enden bei Migration 0007; 30
weitere sind handgeschrieben. `drizzle-kit generate` ist damit unbrauchbar
(B-543).

**Optionen.** (a) bestehende Kette ab 0038 fortführen · (b) neue Kette mit
einer aus der Produktionsdatenbank gezogenen Baseline.

**Entscheidung: (b).** Die Snapshot-Lücke müsste ohnehin geschlossen werden;
die Baseline liefert eine lesbare Historie und macht die Werkzeuge wieder
nutzbar.

**Konsequenzen.** Einmaliger Eingriff in die Migrationstabelle je Umgebung,
abgesichert durch ein Cutover-Skript und ein Backup davor (T-042). Sicherungen
aus der Zeit davor müssen zuerst mit der alten Kette hochgezogen werden.

### E-03 — Nitro-Zeitpläne vorhanden, aber ausgeschaltet · `entschieden`

Wiederkehrende Arbeit läuft weiterhin über „Jetzt prüfen". Die Aufgaben liegen
aber als Nitro-Tasks vor, sodass ein Zeitplan nur noch eine Einstellung ist.
Standardmäßig **aus**, damit der Umstieg das Verhalten nicht unbemerkt ändert.
Einschalten ist eine Betriebsentscheidung (siehe E-12).

### E-04 — TypeScript 6, nicht 7 · `entschieden`

TypeScript 7 ist erschienen, aber die Eignung von `vue-tsc` dafür ist nicht
belegt. Start mit `^6.0.3`; Aufstieg, sobald `pnpm typecheck` in einem Versuch
sauber durchläuft.

### E-05 — Nachgestellte Kommata bei Mehrzeilern · `entschieden`

ESLint Stylistic setzt `commaDangle: 'always-multiline'`, der Bestand hatte
„nie". Wir übernehmen die Vorgabe, statt sie zu überschreiben.

### E-06 — Testdatenbank: echtes PostgreSQL · `entschieden`

`pg-mem` entfällt. Der Bestand musste Migrationen für die Simulation filtern
und konnte Transaktionen überhaupt nicht prüfen — genau dort liegen die
schwersten Befunde. Geprüft wurde außerdem PGlite (echtes Postgres als
WebAssembly): reizvoll, aber die Produktion läuft auf Postgres 18, und für
Integrationstests zählt Produktionsnähe mehr als Startzeit.

### E-07 — pdf-lib bleibt · `entschieden`

Seit 2021 ohne Release, aber vollständig, ohne Systemabhängigkeiten und ohne
Browser. Die 16 committeten Pixel-Vergleichsbilder hängen daran und dienen als
Abnahmekriterium für den Port. Ein Wechsel würde sie alle entwerten.

### E-08 — Seitenumfang bleibt bei 25 · `entschieden`

Serverseitig, ohne Auswahlmöglichkeit — wie im Bestand.

### E-09 — Registerkarten laden verzögert · `entschieden`

Im Bestand bleiben alle Panels gemountet, sodass beim Öffnen einer Detailseite
sämtliche Nebenabfragen starten (B-104). Künftig lädt eine Registerkarte,
wenn sie zum ersten Mal geöffnet wird, und behält ihren Zustand danach.

---

## Offene Punkte

Für jeden steht, wie ohne Antwort verfahren wird. Diese Punkte sind die
Rückfragen am Ende der Planung.

### E-10 — Geldbeträge als Ganzzahl in Cent? · `offen`

**Kontext.** Heute `numeric(12,2)` in der Datenbank, `number` (Gleitkomma) in
der Anwendung, Rundung über eine eigene Hilfsfunktion mit den bekannten
Gleitkomma-Artefakten (B-027).

**Optionen.** (a) Ganzzahl in Cent, Umrechnung nur an der Oberfläche ·
(b) `numeric` behalten, aber im Server konsequent als Zeichenkette führen und
mit einer Dezimalbibliothek rechnen · (c) so lassen.

**Vorgehen ohne Antwort: (a) für alle _neuen_ Berechnungen vorbereiten, aber
die Spalten in dieser Runde nicht umstellen.** Heißt: eine Geld-Hilfsschicht
mit Cent-Ganzzahlen im Kern, Umrechnung an der Datenbankgrenze. Die
Spaltenumstellung wäre eine Datenmigration über alle Belege und ist das
Risiko in einem Rewrite nicht wert, solange die Rechenkerne stimmen.

### E-11 — Löschen oder nur archivieren? · `offen`

**Kontext.** Kunden und Fahrzeuge können archiviert **und** gelöscht werden.
Die Löschwächter zählen nur einen Teil der Verweise; sechs Fremdschlüssel
werden still auf `NULL` gesetzt, einer führt zu einem unbehandelten Fehler
(B-190). Belege sind aus GoBD-Gründen ohnehin unlöschbar.

**Optionen.** (a) Löschen ganz abschaffen, nur noch archivieren ·
(b) Löschen behalten, aber alle Verweise zählen und blockieren ·
(c) Löschen nur für Datensätze ohne jede Verknüpfung.

**Vorgehen ohne Antwort: (c)** — das entspricht der heutigen Absicht, nur
korrekt umgesetzt: alle Fremdschlüssel werden gezählt, die Meldung nennt sie
auf Deutsch, und nichts wird still entkoppelt.

### E-12 — Zeitplan für Erinnerungen einschalten? · `offen`

**Optionen.** (a) aus, wie heute (jemand drückt „Jetzt prüfen") ·
(b) werktags morgens automatisch, Knopf bleibt zusätzlich.

**Vorgehen ohne Antwort: (a)**, technisch so vorbereitet, dass (b) eine
Einstellung ist.

### E-13 — Anzeigen und Preise für Bestandsfahrzeuge · `offen`

**Kontext.** Die Tabelle für Verkaufsinserate (Preis, §25a, Standort,
Ausstattung, Status) existiert, hat aber **keine Oberfläche** (B-222).
Bestandsliste, Verkaufsschild und die öffentliche Schnittstelle laufen deshalb
faktisch immer ohne Preis.

**Optionen.** (a) Oberfläche bauen, Felder wie in der Tabelle ·
(b) Felder auf das Nötige eindampfen (Preis, §25a, Standort, Highlights) ·
(c) Tabelle entfernen und Preis ans Fahrzeug hängen.

**Vorgehen ohne Antwort: (b).**

### E-14 — Zahlungen: Teilzahlungen erfassen? · `offen`

**Kontext.** Die Tabelle für Zahlungseingänge wird nur vom Legacy-Import
befüllt; in der Anwendung ist „bezahlt" ein einfacher Schalter (B-314). Die
offenen Beträge in den Zahlungserinnerungen ignorieren Teilzahlungen.

**Optionen.** (a) echte Zahlungserfassung mit Datum, Betrag, Zahlungsart;
„bezahlt" ergibt sich aus der Summe · (b) Schalter behalten, Tabelle entfernen.

**Vorgehen ohne Antwort: (a)** — die Daten dafür existieren bereits, und die
Zahlungserinnerung wird erst damit korrekt.

### E-15 — Was zählt als Umsatz? · `offen`

**Kontext.** Das Rechnungsausgangsbuch zählt auch Entwürfe, der DATEV-Export
nur ausgestellte Rechnungen. Beide Auswertungen widersprechen sich (B-333).

**Optionen.** (a) nur ausgestellte (versendet, bezahlt, storniert) ·
(b) alles außer Entwürfen.

**Vorgehen ohne Antwort: (a).**

### E-16 — Kundenart sauber modellieren? · `offen`

**Kontext.** „Privat" und „Firma" sind keine gespeicherte Eigenschaft, sondern
werden daraus abgeleitet, ob das Firmenfeld gefüllt ist; „eBay" ist dagegen
eine eigene Art. Zwei Konzepte in einer Spalte plus Heuristik (B-200).

**Optionen.** (a) ausdrückliches Feld `privat | firma | ebay` mit Datenmigration ·
(b) so lassen.

**Vorgehen ohne Antwort: (a)** — die Migration ist eine einzelne, gut
prüfbare Anweisung, und die Filter der Kundenliste werden damit eindeutig.

### E-17 — Große Dateien: Datenbank oder Dateisystem? · `offen`

**Kontext.** PDFs, Fahrzeugfotos, Artikelbilder, Dokumente und das Firmenlogo
liegen als Binärdaten in PostgreSQL. Das hält Sicherungen einfach, lässt die
Datenbank aber wachsen und belastet Abfragen, die versehentlich die Bytes
mitladen.

**Optionen.** (a) so lassen · (b) Dateien auf ein Volume, Verweis in der
Datenbank · (c) Objektspeicher.

**Vorgehen ohne Antwort: (a)**, aber mit zwei Korrekturen: Bytes werden nie in
Listenabfragen geladen, und Bilder werden vor dem Speichern verkleinert.

### E-18 — eBay-Anbindung: Umfang · `offen`

**Kontext.** Der Angebotsimport ist gebaut, aber laut Dokumentation steht die
Freigabe des Betreibers aus; die beidseitige Synchronisierung ist
zurückgestellt.

**Optionen.** (a) unverändert portieren · (b) auf den Pflichtendpunkt und die
Verbindung eindampfen, Import später · (c) ganz weglassen.

**Vorgehen ohne Antwort: (a)** — der Rewrite soll keinen Umfang verlieren.

### E-19 — Legacy-Import nach dem Umstieg · `offen`

**Kontext.** Der Import aus der alten Access-Datenbank löscht die Zieltabellen
und liest alles neu ein. Nach dem produktiven Umstieg ist das gefährlich und
vermutlich einmalig gewesen.

**Optionen.** (a) unverändert portieren · (b) portieren, aber hinter eine
ausdrückliche Bestätigung und die Bedingung „Datenbank praktisch leer" legen ·
(c) als Skript aus der Anwendung herauslösen.

**Vorgehen ohne Antwort: (b).**

### E-20 — Umgang mit den Altdaten beim Umstieg · `offen`

**Optionen.** (a) dieselbe Datenbank weiterbenutzen, Baseline anwenden ·
(b) frische Datenbank, Daten per Dump übernehmen · (c) frisch anfangen.

**Vorgehen ohne Antwort: (a)** mit Sicherung davor — der Betrieb arbeitet
täglich mit diesen Daten.
