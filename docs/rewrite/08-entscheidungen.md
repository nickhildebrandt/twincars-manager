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
| **A-01** | ~~Die neue Anwendung entsteht in **`nuxt/`**; beim Cutover wandert sie ins Repo-Root~~ — **eingetreten am 20.09.2026**, früher als geplant: der SvelteKit-Bestand ist aus dem Repository entfernt, die Anwendung liegt im Root | Der Altbestand durfte nicht verändert werden, Root-Dateien waren belegt                                   | erledigt; Auslieferung und Container schreibt T-041 neu |
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

## Entschieden am 2026-09-13 (Rückfragerunde)

Die elf offenen Punkte sind beantwortet. Die Antworten stehen hier mit ihren
Folgen; die betroffenen Arbeitspakete sind in
[06-arbeitsplan.md](06-arbeitsplan.md) nachgezogen.

### E-10 — Geldbeträge als Ganzzahl in Cent · `entschieden`

**Entscheidung: vollständig auf Cent umstellen**, auch die Spalten. Aus
`numeric(12,2)` wird eine Ganzzahl, die Cent zählt; umgerechnet wird nur an der
Oberfläche.

**Konsequenzen.** Betrifft 22 Spalten (Belegsummen, Positionen, Preise,
Einkaufspreise, Gehälter, Stundenlohn, Buchungsbeträge, Zahlungen). Die sonst
nötige Datenmigration über alle Belege entfällt, weil die Anwendung ohnehin mit
leerer Datenbank startet (E-20). Rundungsfehler verschwinden damit an der
Wurzel statt durch eine Hilfsfunktion. Prozentsätze, Mengen, Stunden,
Profiltiefen und Geokoordinaten bleiben `numeric` — das sind keine Geldbeträge.

### E-11 — Löschen bleibt, mit Kaskade und Vorschau · `entschieden`

**Entscheidung.** Löschen ist ausdrücklich erwünscht:

- **Kunde löschen** entfernt alles, was zu ihm gehört: Fahrzeuge, Aufträge,
  Angebote, Termine, Reifeneinlagerungen, Anfragen, Zeiteinträge. Der
  Bestätigungsdialog **zählt vorher genau auf, was mitgeht**.
- **Sobald eine ausgestellte Rechnung existiert, ist Löschen gesperrt.** Die
  Anwendung bietet dann nur noch Archivieren an und sagt auch warum
  (Aufbewahrungspflicht).
- **Fahrzeug löschen** entfernt nur dieses Fahrzeug, **Auftrag löschen** nur
  diesen Auftrag samt seiner Positionen — nicht die daraus entstandenen
  Rechnungen.
- **Archivieren bleibt in jedem Fall möglich** und ist der ruhige Weg.

**Konsequenzen.** Der Löschwächter zählt künftig **alle** Fremdschlüssel, nicht
mehr nur drei. Nichts wird still auf `NULL` gesetzt (B-190). Die Löschregeln in
der Datenbank werden entsprechend gesetzt: Kaskade für das, was zum Kunden
gehört, Sperre für alles Belegnahe.

### E-12 — Erinnerungen laufen automatisch · `entschieden`

**Entscheidung: werktags morgens automatisch**, der Knopf „Jetzt prüfen" bleibt
zusätzlich. Vorgeschlagene Zeit: **werktags 7:30 Uhr** (Europe/Berlin).

**Konsequenzen.** Nitro-Zeitplan statt reiner Bedienerauslösung. Jede Aufgabe
muss wiederholsicher sein: zweimal ausgeführt verschickt sie nichts doppelt.
Der Zeitplan ist über die Konfiguration abschaltbar.

### E-13 — Verkaufsinserate mit allen Feldern · `entschieden`

**Entscheidung: die vollständige Oberfläche**, also alle Felder der Tabelle —
Preis, §25a-Kennzeichen, Standort, Ausstattung, Highlights, interne Notizen,
Status.

**Konsequenzen.** Die in T-005 entfernten Spalten `equipment` und
`internal_notes` kommen zurück, da sie jetzt eine Oberfläche bekommen.
Bestandsliste, Verkaufsschild und die öffentliche Schnittstelle führen endlich
einen Preis (B-222).

### E-14 — Echte Zahlungserfassung · `entschieden`

**Entscheidung: Zahlungen mit Datum, Betrag und Zahlungsart erfassen**;
„bezahlt" ergibt sich aus der Summe der Zahlungen.

**Konsequenzen.** Teilzahlungen werden möglich. Die Zahlungserinnerung nennt
den tatsächlich offenen Betrag statt des vollen Rechnungsbetrags (B-314). Der
Status einer Rechnung wird berechnet, nicht geschaltet.

### E-15 — Umsatz sind ausgestellte Rechnungen · `entschieden`

**Entscheidung: nur ausgestellte Rechnungen** zählen — versendet, bezahlt,
storniert. Entwürfe nicht.

**Konsequenzen.** Rechnungsausgangsbuch und DATEV-Export benutzen dieselbe
Definition und widersprechen sich nicht mehr (B-333).

### E-16 — Kundenart wird ein echtes Feld · `entschieden`

**Entscheidung: ein ausdrückliches Feld** mit den Werten `privat`, `firma`
oder `ebay`.

**Konsequenzen.** Die Filter der Kundenliste werden eindeutig. Ein leeres
Firmenfeld macht aus einer Firma keinen Privatkunden mehr (B-200). Der Import
setzt das Feld beim Anlegen.

### E-17 — Dateien bleiben in der Datenbank · `entschieden`

**Entscheidung: so lassen**, mit zwei Auflagen: Bytes werden **nie** in einer
Listenabfrage geladen, und Bilder werden vor dem Speichern verkleinert.

**Konsequenzen.** Eine Sicherung umfasst weiterhin alles, es gibt keinen
zweiten Speicherort im Betrieb.

### E-18 — eBay unverändert · `entschieden`

**Entscheidung: vollständig portieren** — Pflichtendpunkt, OAuth-Verbindung und
Angebotsimport. Der Rewrite verliert keinen Umfang.

### E-19 — Der Import wird ein wiederholbarer Abgleich · `entschieden`

**Das ist die größte Änderung gegenüber dem Bestand.** Der Import leert nichts
mehr. Er gleicht ab, und zwar wiederholt, während die Anwendung eingeführt wird.

**Regeln.**

| Fall | Verhalten |
| --- | --- |
| Datensatz nur in Kfz-Kaufmann | wird angelegt |
| Datensatz hier vorhanden, seit dem letzten Import **nicht** bearbeitet | wird durch den Importstand ersetzt |
| Datensatz hier vorhanden und seit dem letzten Import **hier bearbeitet** | bleibt unverändert, erscheint im Importbericht als übersprungen |
| Datensatz nur hier angelegt | bleibt unberührt |
| Datensatz in Kfz-Kaufmann gelöscht | bleibt hier bestehen; der Import löscht nie |

**Warum diese Regel.** Die Access-Tabellen führen **kein Änderungsdatum**
(geprüft: `kunden` hat nur `geboren`). „Neuer" lässt sich also nicht aus den
Importdaten ableiten. Stattdessen merkt sich die Anwendung je Datensatz den
Stand des letzten Imports und vergleicht ihn mit dem aktuellen: wurde hier
nichts geändert, gewinnt Kfz-Kaufmann; wurde hier etwas geändert, gewinnt die
hiesige Fassung.

**Konsequenzen.** Ersetzt ADR-004 („wipe-first") vollständig. Jede importierte
Zeile braucht einen stabilen Legacy-Schlüssel (Kunden-Nr., Rechnungsnummer,
Artikelnummer, Fahrzeug-Id — alle vorhanden) und einen gespeicherten
Importstand. Der Importbericht bekommt eine dritte Kategorie neben „angelegt"
und „übersprungen": **„ersetzt"** und **„wegen lokaler Änderung behalten"**.

### E-20 — Leerer Start, Bestand aus dem Import · `entschieden`

**Entscheidung.** Die neue Anwendung startet mit **leerer Datenbank**. Die
Daten der jetzigen Installation (produktiv seit Juni 2026) werden **nicht**
übernommen. Der Bestand kommt aus Kfz-Kaufmann und wird während der Einführung
mehrfach nachgezogen (E-19).

**Konsequenzen.** Das Cutover-Paket T-042 wird deutlich kleiner: keine
Datenmigration, kein Abgleich der Migrationstabelle, kein Rückrollpfad für
Bestandsdaten. Dafür wird der Import (T-033) zum zentralen Weg, auf dem die
Daten ins System kommen, und rückt in der Reihenfolge nach vorn. E-10 verliert
sein Risiko, weil es keine Altbeträge umzustellen gibt.

### E-21 — `@internationalized/date` als einziges Datumspaket · `entschieden`

**Entscheidung.** Für Kalendertage wird `@internationalized/date` benutzt, und
sonst nichts. Kein `date-fns`, kein `dayjs`, kein `luxon` — und vor allem kein
`Date` in der Umrechnung.

**Warum überhaupt ein Paket.** Nuxt UI bringt es ohnehin mit: `UInputDate` und
`UCalendar` sprechen `CalendarDate`. Es selbst zu bauen hieße, dieselbe Klasse
noch einmal zu schreiben, nur schlechter.

**Warum ausgerechnet dieses.** `CalendarDate` ist ein Tag **ohne Uhrzeit und
ohne Zeitzone** — genau das, was ein Rechnungs-, Leistungs- oder HU-Datum ist.
Wer stattdessen ein `Date` nimmt, hat immer einen Zeitpunkt, und in
Europe/Berlin rutscht jeder Tag zwischen 00:00 und 02:00 über die UTC-Grenze auf
den Vortag. Genau daraus entstand B-028.

**Konsequenzen.** Die Umrechnung `YYYY-MM-DD` ↔ `CalendarDate` steht an einer
Stelle (`shared/calendar-date.ts`) und geht nie durch `Date`.
`test/unit/calendar-date.test.ts` rechnet jeden Tag eines Jahres hin und
zurück. Alles, was eine **Uhrzeit** braucht — Termine, Protokolle,
Zeitstempel — bleibt bei `Date` und der einen Betriebszeitzone (B-028).

### E-22 — Löschregeln in einer Transaktion · `hinfällig seit 17.09.2026`

> **Hinfällig.** **M-38** macht die Löschregel unabhängig von jedem Feldwert:
> ein eigener Vorgang sperrt, Beiwerk geht mit, und das steht je Beziehung
> fest. Damit reicht der Fremdschlüssel allein, und die ausdrücklichen
> `UPDATE`-Schritte entfallen. **Der geprüfte Befund am Ende bleibt lesenswert
> und gilt weiter** — er ist der Grund, warum eine feldwertabhängige Löschregel
> nicht deklarativ geht, und bewahrt den Nächsten davor, es zu versuchen.

<details>
<summary>Die ursprüngliche Entscheidung</summary>

**Entscheidung.** Die Löschregeln für ein Fahrzeug (M-05, P-11, P-12) hängen von
einem **Feldwert** ab: eine Rechnung sperrt, ein Kostenvoranschlag nicht; ein
eingelagerter Radsatz sperrt, ein montierter geht mit. Ein Fremdschlüssel kann
das nicht ausdrücken. Umgesetzt wird es als **ausdrückliche Schritte in einer
Transaktion**, und der Fremdschlüssel bleibt auf **„sperrt"**.

```
UPDATE documents        SET vehicle_id = NULL WHERE vehicle_id = … AND type = 'cost_estimate'
UPDATE calendar_entries SET vehicle_id = NULL WHERE vehicle_id = …
UPDATE work_orders      SET vehicle_id = NULL WHERE vehicle_id = …
DELETE FROM wheel_sets  WHERE vehicle_id = … AND state = 'montiert'
DELETE FROM vehicles    WHERE id = …
```

**Warum kein `ON DELETE SET NULL`.** Dann würde ein vergessener Programmschritt
den Fahrzeugverweis einer **Rechnung** still auf NULL setzen — genau die
Fehlerklasse, wegen der neun solche Regeln bereits gestrichen wurden (B-190). So
herum ist die Datenbank die Absicherung: bleibt eine Rechnung oder ein
eingelagerter Radsatz stehen, scheitert der letzte Schritt, die Transaktion wird
zurückgerollt, und der Dienst macht daraus einen 409 mit einem deutschen Satz.

**Warum kein Auslöser (Trigger).** Er wäre die andere richtige Lösung. Dagegen
spricht: die Anwendung hat bisher **keine** Datenbankfunktionen, und ein
Löschverbot, das im Code nicht steht, sucht beim nächsten Mal jemand lange. Die
Schritte oben stehen dort, wo man sie sucht, und sind lesbar.

**Was nicht funktioniert — geprüft, nicht vermutet.** Der naheliegende
Kunstgriff, eine erzeugte Spalte (`CASE WHEN type = 'invoice' THEN vehicle_id
END`) mit einem eigenen Fremdschlüssel auf „sperrt" zu legen, geht **nicht**:
PostgreSQL erlaubt den Fremdschlüssel zwar, aber die Aktion der anderen
Beziehung (`SET NULL` oder „geht mit") läuft zuerst und rechnet die erzeugte
Spalte auf NULL — die Sperre greift nie. Mit `RESTRICT` ebenso wenig.

</details>

### E-23 — Passwortgüte: online geprüft, ohne das Passwort preiszugeben · `entschieden`

**Entscheidung.** Beim Setzen eines Passworts (P-14) gilt eine
Mindestanforderung, und das Passwort wird **online** gegen die Sammlung
bekannter Passwörter aus Datenlecks geprüft — mit dem
**k-Anonymitäts-Verfahren**, das das Passwort dabei nicht preisgibt.

**Wie das geht.** Vom SHA-1 des Passworts gehen nur die **ersten fünf Zeichen**
an den Dienst. Der antwortet mit allen Hashes, die so beginnen — einige
hundert. Verglichen wird **lokal**. Der Dienst erfährt weder das Passwort noch
seinen vollständigen Hash, und aus fünf Zeichen lässt sich nichts
zurückrechnen.

**Warum überhaupt.** Ohne zweiten Faktor ist das Passwort die einzige Hürde.
Eine Bremse hilft gegen Geduld, nicht gegen `sommer2024` — das findet man mit
drei Versuchen. Ein Abgleich gegen echte Lecks fängt genau die Passwörter, die
in der Praxis fallen, und er fängt sie **bevor** sie in Gebrauch sind.

**Was bei fehlendem Internet passiert.** Die Anwendung läuft im Haus; der
Server kommt möglicherweise nicht hinaus. Dann gilt:

- Die Mindestanforderung greift weiterhin — sie ist reine Rechnung.
- Der Abgleich wird **übersprungen**, mit einem **sichtbaren Hinweis** am
  Formular: „Der Abgleich gegen bekannte Passwörter war nicht möglich (kein
  Internet). Die Mindestanforderung ist erfüllt."

Das Wichtige daran ist der Hinweis. Eine Prüfung, die still durchwinkt, erzeugt
Vertrauen, das sie nicht deckt — und genau das wäre schlimmer als gar keine.

**Konsequenzen.** Die Prüfung liegt in `shared/schemas/`, der Abruf in
`server/utils/`. Sie gilt an jeder Stelle, an der ein Passwort gesetzt wird: im
Einrichtungsassistenten (T-010), in der Benutzerverwaltung (T-034) und beim
eigenen Passwortwechsel. Der Abruf hat eine **kurze Zeitgrenze** — ein
langsamer Dienst darf das Anlegen eines Benutzers nicht aufhalten.

---

## E-24 — Abhängigkeiten bleiben so, wie Nuxt sie aufsetzt

**Datum:** 20.09.2026 · **Status:** festgelegt

**Entscheidung.** Das Projekt bleibt auf dem Stand, den das Nuxt-Aufsetzskript
erzeugt: neueste stabile Fassung des Rahmenwerks, und darunter genau die
Fassungen, die Nuxt selbst mitbringt. Zusätzliche Pakete sind erlaubt, wenn sie
für Nuxt gedacht sind und die Rangfolge aus `CLAUDE.md` Regel 4 sie
zulässt. Nicht erlaubt sind Pakete, die zufällig dasselbe können, aber aus
einer anderen Welt stammen, und von Hand nachgezogene Fassungen einzelner
Abhängigkeiten.

**Warum.** Das Ziel ist ein Projekt, das sich in zwei Jahren mit einem Befehl
anheben lässt. Jede von Hand gesetzte Fassung und jedes fremde Paket ist eine
Stelle, an der das dann nicht geht — und man merkt es erst, wenn es zu spät
ist. Beim Vorgänger war genau das der Grund, warum eine einzelne
Rahmenwerk-Fassung (`svelte` 5.55.5) eine ganze Klasse von Listenfehlern
auslöste und nicht einfach zurückgedreht werden konnte.

**Was geprüft wurde.** Der Abhängigkeitsbaum ist sauber: `h3` steht auf genau
der Fassung, die Nuxt selbst verlangt, exakt gepinnt. Die einzige doppelte
Fassung im Baum liegt innerhalb von `@nuxt/eslint` und betrifft nur die
Entwicklung. `pnpm outdated` war an diesem Tag nicht nutzbar — die Registry
antwortete mit Zeitüberschreitungen; geprüft wurde deshalb lokal über
`pnpm why`.

**Konsequenzen.** Wo ein Fremdpaket an seine Grenze stößt, wird die Grenze
dokumentiert statt umgangen. Zwei Fälle stehen schon so da: die englischen
Segmentbeschriftungen des Datumsfelds
([offene-fragen/03](offene-fragen/03-datumsfeld-englische-beschriftung.md)) und
`'unsafe-inline'` für Stile
([offene-fragen/02](offene-fragen/02-stile-unsafe-inline.md)).

---

## E-25 — Diagramme kommen aus `nuxt-charts`

**Datum:** 20.09.2026 · **Status:** festgelegt

**Entscheidung.** Alle Diagramme (M-35) werden mit **`nuxt-charts`**
gezeichnet. Ein eigenes SVG gibt es nicht mehr, und ein anderes Diagrammpaket
— namentlich Chart.js — kommt nicht in Frage.

**Warum dieses und kein anderes.** `nuxt-charts` ist ein echtes Nuxt-Modul:
`modules: ['nuxt-charts']`, die Komponenten werden auto-importiert, und die
Beispiele der Doku benutzen Nuxt UI daneben. Damit erfüllt es Regel 4 und
E-24: kein zufälliges Paket aus einer anderen Welt, sondern eines, das für
dieses Rahmenwerk gebaut ist.

**Was es ersetzt.** Bis zum 20.09.2026 stand in `TrendChart.vue` ein eigenes
SVG mit Pfaden, Rastern und Achsenbeschriftung — rund 180 Zeilen. Es war
lesbar und es funktionierte, aber es war ein Nachbau, und das Kassenbuch
(M-35) braucht darüber hinaus gestapelte Balken und Kreisdiagramme. Die hätte
der Eigenbau auch noch bekommen müssen.

**Was es kostet, gemessen statt geschätzt.** Die Abhängigkeitskette ist
schwer: `nuxt-charts` → `vue-chrts` → `@unovis/ts` + `@unovis/vue`, und daran
hängen `proj4`, `d3-geo`, `@turf/boolean-point-in-polygon`, MapLibre und
Emotion. 155 Pakete kamen dazu. Der gebaute Stand sagt aber etwas anderes als
der Paketbaum:

| | vorher | nachher |
| --- | --- | --- |
| Bau gesamt | 8,92 MB | 9,01 MB |
| **gzip gesamt** | **2,03 MB** | **2,03 MB** |
| Diagramm-Brocken | — | 928 KB / **307 KB gzip**, **nachgeladen** |

MapLibre, `d3-geo` und Turf sind vollständig herausgeschüttelt; `proj4` und
Emotion stecken im Diagramm-Brocken. Entscheidend ist, dass dieser Brocken
**nicht im Einstieg** liegt: die Anmeldeseite und jede Liste ohne Diagramm
laden ihn nicht. Wer eine Seite mit Diagramm öffnet, zahlt 307 KB — einmal,
danach aus dem Zwischenspeicher.

**Was dabei auffiel.** Unovis verträgt sich nicht mit happy-dom (**W-04**).
Die Verlaufskurve wird deshalb im Browser-Projekt geprüft, in echtem
Chromium. Das ist die richtige Ebene, keine Abschwächung.

**Was daneben stehen bleibt.** Die Zahlen des Diagramms als `sr-only`-Tabelle.
Ein Diagramm ist ein Bild; `role="img"` sagt, **worum** es geht, nicht **was
darin steht**. Die Tabelle ist eine Ergänzung daneben, kein Eingriff in das
Paket — Regel 4 lässt das für Zugänglichkeit ausdrücklich zu.

**Nicht genommen:** **Vue Flow**. Es ist ein Editor für Knotengraphen —
Kästen mit Verbindungslinien, die man zieht. Der Zeitstrahl ist das Gegenteil
(eine chronologische Liste, `UTimeline` macht sie), und die Auftragstafel
(T-020) ist kein Graph, sondern Spalten mit Karten. Sollte je ein
Ablaufdiagramm gebraucht werden — etwa eine Statusmaschine zum Anschauen —,
wird das hier neu bewertet.

---

## Was danach noch entschieden wurde

Am 13.09.2026 ist der Inhaber die fertige Modellübersicht durchgegangen und hat
eine ganze Reihe weiterer Festlegungen getroffen — vom Ereignisprotokoll bis zur
Datensicherung. Sie stehen vollständig in
[09-modellaenderungen.md](09-modellaenderungen.md) und **gewinnen gegen jede
frühere Festlegung hier**, wo sie ihr widersprechen.

Betroffen sind namentlich:

| Frühere Festlegung | Was sich ändert |
| --- | --- |
| E-11 (Löschen mit Kaskade) | Das Fahrzeug geht **nicht** mehr mit dem Kunden (M-05). Der Rest gilt. |
| E-14 (echte Zahlungserfassung) | Zahlungen bekommen eine Zahlart; nur bar geht ins Kassenbuch (M-16). |
| E-16 (Kundenart als Feld) | Bleibt. Die Art steuert zusätzlich die Oberfläche (M-07). |
| E-19 (Import als Abgleich) | Bleibt. Dazu: alles übernehmen, Nummern trennen, Belege unveränderlich (M-28 bis M-32). |

---

## Was daraus folgt

| Paket | Änderung |
| --- | --- |
| T-005 | Geldspalten auf Ganzzahl-Cent; `equipment` und `internal_notes` bleiben; Kundenart als Feld; Löschregeln nach E-11 |
| T-006 | Geld-Hilfsschicht rechnet in Cent, Formatierung nur an der Oberfläche |
| T-011 | Löschen mit Kaskade und Vorschau, Sperre bei ausgestellter Rechnung, Kundenart-Feld |
| T-013 | vollständige Inserat-Oberfläche |
| T-022 | Zahlungen statt Schalter; Status wird berechnet |
| T-025 | Zeitplan werktags 7:30 Uhr, Knopf bleibt |
| T-028, T-029 | eine Umsatzdefinition für Ausgangsbuch und DATEV |
| T-033 | Abgleich statt Leeren; rückt in der Reihenfolge nach vorn |
| T-042 | nur noch Auslieferung, keine Datenübernahme |
