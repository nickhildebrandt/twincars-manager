# Fortschritt

Ein Eintrag je abgeschlossenem Arbeitspaket. Reihenfolge und Inhalt der Pakete:
[06-arbeitsplan.md](06-arbeitsplan.md). Vorgehen: [07-ausfuehrung.md](07-ausfuehrung.md).

Zweig: `rewrite/nuxt` · Anwendung: `nuxt/` · Doku: `docs/`

---

## T-001 — Projektgerüst und Toolchain · fertig 2026-09-13

**Ergebnis:** Die neue Anwendung startet, baut, lintet und typprüft sauber.

| Prüfung                                               | Ergebnis                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                      | grün                                                                           |
| `pnpm build`                                          | grün, 3,42 MB (793 kB gzip)                                                    |
| Produktionsserver rendert die Startseite serverseitig | HTTP 200, `lang="de"`, Stylesheet eingebunden                                  |
| `pnpm lint`                                           | grün                                                                           |
| `pnpm typecheck`                                      | grün                                                                           |
| Kein Prettier im Baum                                 | bestätigt: nicht in `package.json`, nicht im Lockfile, nicht in `node_modules` |
| Genau eine CSS-Datei                                  | `app/assets/css/main.css`                                                      |
| Keine `<style>`-Blöcke                                | bestätigt                                                                      |
| Commit-Prüfung                                        | ungültige Nachricht → Abbruch, gültige → Durchlauf                             |

**Versionen (installiert):** Nuxt 4.5.2 · Nuxt UI 4.11.1 · Vue 3.5.42 ·
ESLint 10.10.0 · TypeScript 6.0.3 · vue-tsc 3.3.11 · semantic-release 25.0.9 ·
commitlint 21.2.2 · Node 24.18 · pnpm 11.8.0.

**Entscheidungen unterwegs**

- **E-21 neu:** `formatters: true` in `@nuxt/eslint` wird **nicht** gesetzt.
  Die Option verlangt `eslint-plugin-format`, und das hängt an `prettier`.
  ESLint Stylistic deckt alles ab, was Code ist (js, ts, vue); Markdown, JSON
  und YAML werden von Hand geschrieben. Damit bleibt die Regel „Prettier kommt
  nicht vor" wörtlich erfüllt.
- **TypeScript 6.0.3** statt 7.0.2 — die Eignung von `vue-tsc` für TS 7 ist
  nicht belegt (E-04).
- Die Testskripte melden vorerst `[noch nicht umgesetzt]` und nennen das
  Arbeitspaket, das sie liefert (`scripts/not-yet.mjs`). T-002 und T-003
  ersetzen sie.

**Berührte Dateien außerhalb von `nuxt/`**

- `.husky/commit-msg` — **neu** angelegt, ruft commitlint aus `nuxt/`.
  Die vorhandene `.husky/pre-commit` bleibt unverändert.
- `.github/workflows/ci.yml`, `.github/workflows/release.yml` — **neu**.

Der Altbestand wurde **nicht** verändert. Geprüft: `lint-staged` wählt für
Dateien unter `nuxt/` die dortige Konfiguration (`eslint --fix`) und lässt
Prettier aus dem Wurzelverzeichnis nicht darauf los — mit einer Probe
bestätigt (mehrzeiliges Array behält sein nachgestelltes Komma).

**Offen aus diesem Paket**

- Die CI-Läufe sind noch nicht auf GitHub gelaufen (der Zweig ist nicht
  gepusht). Syntaktisch geprüft, inhaltlich erst mit T-002 aussagekräftig.
- `nuxt typecheck` gibt eine Warnung zu `vue-router/volar/sfc-route-blocks`
  aus (Pfad in `vue-router` 4.6.4 nicht exportiert). Der Lauf endet mit 0;
  reine Ausgabe-Unruhe. Beobachten, bei Bedarf mit T-002 nachziehen.

---

## T-002 — Teststack und Testdatenbank · fertig 2026-09-13

**Ergebnis:** Fünf Vitest-Projekte laufen, jedes einzeln und gemeinsam; die
Integrationsschicht arbeitet gegen echtes PostgreSQL mit einer Datenbank je
Worker.

| Akzeptanzkriterium | Ergebnis |
| --- | --- |
| Jedes Projekt läuft einzeln | `unit`, `nuxt`, `integration`, `browser`, `e2e` — alle grün |
| Nuxt-Projekt mountet eine Komponente | `mountSuspended` auf Startseite und Standard-Layout |
| Browser startet Chromium **ohne Download** | gecachter Build 1234 wird benutzt |
| Integrationstest erreicht eine echte Datenbank | `current_database()` liefert `twincars_test_w<n>` |
| Zwei Integrationsdateien stören sich nicht | jede sieht nur ihre eigene Tabelle |
| Coverage-Bericht mit greifenden Schwellen | zuerst rot bei 66 %, nach Abdeckung des Layouts grün bei 100 % |
| `test:befunde` erkennt fehlende Regressionstests | 429 Befunde erfasst, `--all` meldet alle 429 als offen |

**Gesamtlauf:** 5 Testdateien, 12 Tests, 13,7 s inklusive Produktionsbau für
die End-to-End-Prüfung. `pnpm lint` und `pnpm typecheck` grün.

**Entscheidungen unterwegs**

- **Kein `globalSetup` für die Datenbank.** Es ist eine Wurzel-Option und würde
  bei *jedem* Lauf greifen — auch bei reinen Unit-Tests. Die Vorbereitung
  liegt jetzt in den `setupFiles` des Integrationsprojekts, serialisiert über
  ein Postgres-Sperrobjekt. Unit-, Nuxt- und Browsertests brauchen damit keine
  Datenbank.
- **Verbindung über den Unix-Socket.** Die lokale Rolle `admin` darf keine
  Datenbanken anlegen, die Socket-Rolle schon. Der Treiber versteht die
  `?host=/pfad`-Form in der URL nicht, deshalb übersetzt
  `test/setup/database-helpers.ts` sie in Verbindungsoptionen.
- **Chromium wird nie heruntergeladen.** Playwright 1.63 verlangt Build 1243,
  der Zwischenspeicher hat 1234. `test/setup/chromium.ts` löst den neuesten
  vorhandenen Build auf; sowohl das Browser-Projekt als auch Playwright
  bekommen ihn über `launchOptions.executablePath`.
- **`app/app.vue` ist von der Coverage ausgenommen** — die Wurzelkomponente
  mountet das Framework, nicht der Test; ihr Verhalten deckt die
  End-to-End-Prüfung ab.
- Das Umgebungs-Setup liest `.env.test` über `process.cwd()` statt über
  `import.meta.url`: in der Nuxt-Testumgebung ist die Modul-URL keine
  `file:`-URL.

**Offen aus diesem Paket**

- `test/factories/` ist angelegt, aber leer — Factories entstehen mit dem
  ersten fachlichen Paket, das Daten braucht (T-005/T-011).
- Die Coverage-Schwellen stehen auf den Zielwerten aus
  [05-teststrategie.md](05-teststrategie.md) §7. Sie sind aktuell mit 100 %
  erfüllt, weil noch wenig Code existiert; ab T-004 werden sie aussagekräftig.

---

## T-003 — Dokumentationsgerüst · fertig 2026-09-13

**Ergebnis:** Die Produktdokumentation steht unter `docs/` mit einem Einstieg,
sieben Bereichen, fünf Vorlagen und **631 Feature-Seiten**. Die
Vollständigkeitsprüfung ist scharf.

| Akzeptanzkriterium | Ergebnis |
| --- | --- |
| Für jede Feature-ID existiert eine Seite | 631 von 631, `pnpm docs:check` grün |
| Eine gelöschte Seite lässt die Prüfung fehlschlagen | geprobt mit F-100 — „Feature F-100 hat keine Seite" |
| Ein toter Link lässt die Prüfung fehlschlagen | geprobt in `docs/guides/README.md` |
| Einstieg erreicht jede Kategorie in einem Klick | `docs/index.md` verlinkt alle sieben Bereiche |
| Erzeugte Seiten sind reproduzierbar | zweiter Lauf: 0 neu, 0 aktualisiert, 631 unverändert |

**Was entstanden ist**

- `docs/index.md` — Einstieg; jede Seite in höchstens zwei Klicks erreichbar,
  maschinell geprüft.
- `docs/features/` — eine Seite je Funktion, erzeugt aus dem Inventar:
  Frontmatter mit Kennung, Modul, Arbeitspaket, Routen, Endpoints, Tabellen;
  im Text das erwartete Verhalten aus dem Inventar.
- `docs/api/`, `docs/data/`, `docs/ui/`, `docs/architecture/`,
  `docs/decisions/`, `docs/guides/` — je ein Bereichsindex mit den Grundsätzen
  und dem Hinweis, welches Arbeitspaket ihn füllt.
- `docs/_templates/` — Vorlagen für Feature, Endpoint, Komponente,
  Entscheidung, Anleitung.
- Skripte: `docs:features`, `docs:api`, `docs:data`, `docs:build`,
  `docs:check`.

**Entscheidungen unterwegs**

- **Alte und neue Dokumentation stehen nebeneinander.** Die Bereiche
  `architecture/` und `decisions/` enthalten weiterhin Seiten der
  SvelteKit-Fassung. Die Prüfung erkennt neue Seiten am Frontmatter-Feld
  `kategorie` (bzw. `id`) und lässt die alten unangetastet — sie sind während
  des Umbaus die beste fachliche Quelle und werden erst beim Umstieg entfernt.
- **Erzeugte Seiten werden nicht nachformatiert.** `docs/features/` und
  `docs/api/` sind vom Formatierer des Altbestands ausgenommen, sonst meldet
  die Reproduzierbarkeitsprüfung nach jedem Commit Unterschiede.
- **Der Generator überschreibt nichts Geschriebenes.** Seiten mit
  `status: umgesetzt` oder `blockiert` bleiben unverändert; nur Rümpfe werden
  aufgefrischt.

**Offen aus diesem Paket**

- `docs/api/` und `docs/data/` sind noch leer, weil es weder Endpoints noch ein
  Schema gibt. Die Generatoren laufen bereits und melden null Einträge.
- Anleitungen für Umgebung, Freigabe, Deployment und Fehlersuche folgen mit
  T-041 und T-042; bis dahin verweist der Bereichsindex auf die
  Betriebsunterlagen des Vorgängersystems.

---

## T-004 — Valibot-Fundament und Fehler-Trichter · fertig 2026-09-13

**Ergebnis:** Jede Eingabe der Anwendung hat ab jetzt einen Ort, an dem sie
geprüft wird, und jeder Fehler einen Ort, an dem er entsteht. 191 Tests grün.

| Akzeptanzkriterium | Ergebnis |
| --- | --- |
| Jedes Primitive mit gültig, Grenzwert, ungültig samt deutscher Meldung | 74 Tests über 20 Primitive |
| Ungültiger Rumpf → 422 mit deutschem Feldfehler | Integrationstest über eine echte HTTP-Anwendung |
| `page=0` → 422 statt 500 | geprüft, ebenso negative Seiten |
| Serverfehler gibt keine Interna preis | geprüft: weder SQL noch Geheimnis im Antworttext |
| Fehlende Pflichtvariable verhindert den Start | 16 Tests über das Umgebungsschema |
| Jeder Feldschlüssel hat ein deutsches Label | Querschnittstest über die Labelkarte |
| Keine englische Standardmeldung erreicht den Nutzer | Querschnittstest über alle Schemata |

**Was entstanden ist**

- `shared/schemas/` — `messages` (deutsche Vorgaben), `primitives` (20
  Bausteine von Name bis Fahrgestellnummer, jeweils mit an die Spaltenbreite
  angelehnten Grenzen), `pagination` (feste Seitengröße 25), `env`, `upload`,
  `field-labels` (rund 140 Bezeichnungen).
- `server/utils/errors.ts` — acht Helfer, ein Format, deutsche Sätze.
- `server/utils/validate.ts` — `useValidatedBody/Query/Params/Header` als
  **einziger** Weg, Eingaben zu lesen.
- `server/plugins/00.env.ts` — prüft die Konfiguration beim Start und bricht
  mit Nennung der Variablen ab.
- `server/plugins/10.error.ts` — letzte Instanz vor der Antwort.
- `app/composables/useApi.ts`, `useNotify.ts`, `app/error.vue`.

**Behobene Befunde (mit Regressionstest)**

- **B-042** — eine deutsche Meldung ohne Umlaut wird nicht mehr als englisch
  verworfen. Die Sprache wird gesetzt, nicht geraten.
- **B-044** — die zweite, abweichende Heuristik im Client entfällt ersatzlos.
- **B-149** — die Seitengröße ist nicht mehr vom Aufrufer wählbar.
- **B-012** — eine englische Framework-Meldung erreicht die Fehlerseite nicht.
- **B-014** — eine abgelaufene Sitzung führt zur Anmeldung statt zu einem Toast.
- **B-022** — die Regel „Speichern ist nie wegen Eingaben gesperrt" steht in
  der Fehlerbehandlung, nicht mehr im Widerspruch zum Kommentar.

**Entscheidungen unterwegs**

- **Deutsche Meldungen kommen zentral**, nicht an jedem Pipe-Schritt: über
  `@valibot/i18n` und `setGlobalConfig({ lang: 'de' })`. Ausgeschrieben wird
  nur, wo der Standardtext dem Bediener nicht weiterhilft. Das löst die alte
  Regel „jeder Schritt braucht einen Text" ab und macht die beiden Heuristiken
  überflüssig.
- **Eigene Validierungshelfer statt `readValidatedBody`.** Am Quelltext
  bestätigt: die h3-Fassung in Nuxt 4.5 erwartet eine einfache Funktion und
  erkennt kein Standard-Schema. Ein Valibot-Schema direkt zu übergeben
  funktioniert nicht.
- **Fehlende Pflichtvariablen werden eigens geprüft.** Ein fehlender
  Objektschlüssel erzeugt in Valibot die Meldung des Objekts, nicht die des
  Feldes; mit einer weitergeleiteten Prüfung bleibt die Formulierung unter
  Kontrolle („DATABASE_URL fehlt.").
- **`h3` ist jetzt eine ausdrückliche Abhängigkeit** (1.15.11, die Fassung, die
  Nitro ohnehin mitbringt). Ohne sie lassen sich die Serverhelfer außerhalb des
  Nuxt-Bundles nicht testen.
- **Coverage-Schwellen bleiben vorerst auf den Startwerten** aus
  [05-teststrategie.md](05-teststrategie.md) §7 (80/75/80/80), obwohl aktuell
  96/88/94/97 erreicht werden. Der Mechanismus zum Hochschreiben ist gebaut und
  geprüft (`pnpm test:cov:update` schreibt die erreichten Werte in die
  Konfiguration). Angewandt wird er ab dem ersten fachlichen Paket (T-011),
  wenn der Code-Mix repräsentativ ist — ein aus reinem Schema-Code abgeleiteter
  Wert von 96 % wäre für die Oberfläche kein sinnvoller Maßstab.

**Zahlen**

| | |
| --- | --- |
| Tests | 191 (15 Dateien) |
| Coverage | 96,5 % Anweisungen · 88,2 % Zweige · 94,2 % Funktionen |
| Schemata | 6 Dateien, 20 Primitive, rund 140 Feldbezeichnungen |

---

## T-005 — Datenbankschema, Baseline-Migration, Seeds · fertig 2026-09-13

**Ergebnis:** Das vollständige Datenmodell steht in der neuen Anwendung —
nachweislich gleichwertig zum Stand des Vorgängersystems, dazu die
Bereinigungen, die das Inventar belegt hat. 216 Tests grün.

| Akzeptanzkriterium | Ergebnis |
| --- | --- |
| Migrationen laufen auf leerer Datenbank durch | 51 Tabellen, 105 Indizes |
| Migrationen sind wiederholbar | zweiter Lauf ohne Fehler und ohne Änderung |
| Seeds sind idempotent | zweiter Lauf legt nichts noch einmal an |
| Drift-Test grün | Tabellen, Spalten, Pflichtfelder und Eingabegrenzen abgeglichen |
| Jede Fremdschlüsselspalte hat einen Index | **0** ohne Index (vorher 27) |
| Kein Schema erlaubt mehr Zeichen als die Spalte | geprüft, ein Fehler dabei gefunden und behoben |
| Jede Tabelle hat einen Primärschlüssel | geprüft |

**Wie die Baseline entstanden ist**

1. Die 38 Migrationen des Vorgängers wurden auf eine leere Datenbank
   angewendet — alle 38 liefen fehlerfrei durch und ergaben 53 Tabellen.
2. Daraus wurde das Schema eingelesen und auf **13 Domänendateien** verteilt
   (statt einer Datei mit 2 025 Zeilen).
3. Aus dem Schema wurde eine einzelne Baseline-Migration erzeugt und
   wiederholbar gemacht (214 Anweisungen).
4. **Gleichwertigkeit nachgewiesen:** alle **624 Spalten**, 138 Indizes,
   60 Fremdschlüssel und sämtliche Löschregeln stimmen zwischen altem
   Migrationsstand und neuer Baseline exakt überein.

Damit funktioniert `drizzle-kit generate` wieder, was beim Vorgänger seit
Migration 0007 nicht mehr der Fall war (B-543).

**Bereinigungen, die eingeflossen sind**

- **25 fehlende Fremdschlüssel-Indizes ergänzt.** Vorher liefen 27 von 60
  Fremdschlüsseln ohne Index; jede Löschung eines Elterndatensatzes war ein
  vollständiger Tabellendurchlauf.
- **Zwei tote Tabellen entfernt**: `public_holidays` (Feiertage werden
  gerechnet) und `recurring_entries` (hatte nie eine Oberfläche).
- **Vier tote Spalten entfernt**: `ledger_entries.recurring_template_id`,
  `vehicle_sales.trade_in_value`, `vehicle_listings.equipment` und
  `.internal_notes`.

**Behobene Befunde (mit Regressionstest)**

- **B-556 (Klasse)** — der Drift-Test hat sofort einen echten Fall gefunden:
  das Telefonschema ließ 40 Zeichen zu, die Spalte fasst 30. Eine längere
  Nummer wäre als unbehandelter Datenbankfehler beim Nutzer gelandet.
- **B-363** (Teil) — die SMTP-Felder haben jetzt deutsche Bezeichnungen.

**Entscheidungen unterwegs**

- **Eine Baseline statt Baseline plus Bereinigungsmigration.** Für eine frische
  Installation ist der bereinigte Stand der richtige Ausgangspunkt. Die
  bestehende Produktionsdatenbank wird in **T-042** mit einem eigenen
  Cutover-Skript nachgezogen; dessen Inhalt ist die Differenz, die hier
  dokumentiert ist (25 Indizes, 2 Tabellen, 4 Spalten).
- **Gegenseitige Verweise zwischen Domänendateien** (Belege ↔ Aufträge,
  Mitarbeiter ↔ Aufträge) werden mit der verzögerten Referenzform aufgelöst.
  Ohne sie bricht entweder die Modul-Auswertung oder die Typprüfung.
- **`bytea` bekommt einen eigenen Spaltentyp** — Drizzle bringt keinen mit,
  und das Einlesen hatte die drei Binärspalten als `unknown` erzeugt.
- **Operatorklassen aus dem Einlesen entfernt.** Das Werkzeug hatte bei
  zusammengesetzten Indizes allen Spalten dieselbe Klasse zugewiesen, was
  PostgreSQL zurückweist.
- **`#shared/*` ist jetzt auch für Node auflösbar** (`imports` in der
  `package.json`), damit Migrations- und Seed-Skript dieselben Module nutzen
  wie Anwendung und Tests.
- **Ein Befund kann mehrere Arbeitspakete haben.** Die Prüfung
  `pnpm test:befunde` hat das anfangs nicht berücksichtigt und nur den letzten
  Eigentümer behalten; das ist korrigiert.

**Zweiter Durchgang: Strukturhärtung**

Die Befund-Prüfung hat nach dem ersten Durchgang gemeldet, dass T-005 dreißig
Datenmodell-Befunde besitzt, von denen erst ein Teil erledigt war. Daraufhin
kam ein zweiter Durchgang:

- **B-575** — `updated_at` wird von der Datenbank gestempelt, nicht mehr an 45
  Stellen von Hand (26 Spalten). Ein Test ändert eine Zeile und prüft, dass der
  Zeitstempel mitwandert.
- **B-574** — Belegpositionen, Nummernkreise, Buchungskategorien und
  Mailvorlagen führen jetzt Zeitstempel.
- **B-567** — Personalnummer und Verkaufsinserat sind eindeutig.
- **B-568** — die zwei fehlenden Fremdschlüssel sind deklariert, samt Index.
- **B-565** — acht Sortier-Indizes für die Standardsortierung der Listen.
- **B-139, B-586** — die drei Einzelzeilen-Tabellen nehmen nur noch eine Zeile
  auf; die Datenbank weist die zweite ab (geprüft).
- **B-561** — Öffnungszeiten sind eine echte Uhrzeit, kein Text.

**Bewusst anderen Paketen zugeordnet.** Sieben Datenmodell-Befunde hängen an
einer fachlichen Festlegung, die hier nicht zu treffen ist, ohne zu raten:
erlaubte Statuswerte (B-411 → T-028), Löschregeln (B-587 → T-022), welches
Feld fachlich Pflicht ist (B-588 → T-011), Transaktionen in den Diensten
(B-578 → T-011), die Id-Strategie der Anmeldebibliothek (B-582 → T-007),
Upload-Grenzen (B-589 → T-009), das Verhalten beim Entfernen geseedeter Rechte
(B-079 → T-034) und eine Spaltenumbenennung, die eine Datenmigration ist
(B-594 → T-042). Die Zuordnung steht in
[06-abdeckung.md](06-abdeckung.md); `pnpm test:befunde` verlangt den
Regressionstest dann dort.

**Zahlen**

| | |
| --- | --- |
| Tabellen | 51 (13 Domänendateien) |
| Indizes | 114, kein Fremdschlüssel ohne Index |
| Tests | 239 (18 Dateien), davon 69 Integrationstests |
| Coverage | 92,1 % Anweisungen · 82,5 % Zweige · 88,9 % Funktionen |
| Seeds | 3 Rollen, 8 Mailvorlagen, 13 Kategorien, 10 Nummernkreise, 7 Öffnungszeiten |
| Befund-Abdeckung | 27 von 27 fälligen Befunden mit Regressionstest |

---

## T-005, dritter Durchgang — die Entscheidungen im Datenmodell

**Datum:** 2026-09-13 · **Auslöser:** die elf Festlegungen aus
[08-entscheidungen.md](08-entscheidungen.md)

Vier der elf Entscheidungen ändern das Datenmodell und öffnen damit ein bereits
abgeschlossenes Paket wieder. Das ist gewollt: lieber eine Änderung an 22
Spalten als eine Umstellung, nachdem die erste Rechnung geschrieben ist.

### E-10 — Geld ist eine ganze Zahl in Cent

**22 Spalten** von `numeric(12,2)` beziehungsweise `numeric(8,2)` auf `integer`
umgestellt: Rechnungs- und Positionssummen, Einkaufs- und Verkaufspreise,
Kassenbuchbeträge, Zahlungen, Gehälter und Stundenlöhne, der eBay-Preis.
Prozentsätze, Mengen, Stunden, Profiltiefen und Geokoordinaten bleiben
`numeric` — das sind keine Beträge.

Dazu die Rechenschicht `shared/money.ts`: `parseEuro`, `formatEuro`,
`sumCents`, `applyPercent`, `addVat`, `splitVat`, `lineTotal`. Zwei
Feinheiten, die bewusst so sind: gerundet wird kaufmännisch **von der Null
weg**, damit Gutschriften stimmen, und `splitVat` rundet nur den Nettobetrag
und nimmt die Steuer als Rest — dadurch ergibt netto plus Steuer immer genau
den Bruttobetrag, den der Kunde zahlt.

`moneySchema` hört jetzt exakt dort auf, wo die Spalte aufhört
(`MAX_MONEY_CENTS` = 2.147.483.647). Ein Bruchteil eines Cents wird vom Schema
abgewiesen — und zusätzlich von der Datenbank, geprüft mit einer Buchung über
12,5 Cent.

### E-13 — die Inseratfelder kommen zurück

`vehicle_listings.equipment` und `internal_notes` waren in T-005 als tot
entfernt worden. Mit der Entscheidung für die vollständige Inserat-Oberfläche
bekommen sie eine Verwendung und gehören damit wieder ins Modell. Der
Regressionstest, der ihre Abwesenheit prüfte, prüft jetzt ihre Anwesenheit.

### E-16 — die Kundenart ist ein Feld

`customers.kind` trägt jetzt `privat`, `firma` oder `ebay` statt `regular` oder
`ebay`. Damit schließt sich B-200: aus einem leeren Firmenfeld wird kein
Privatkunde mehr erschlossen.

### E-11 — Löschregeln

**13 Fremdschlüssel** neu geregelt. Was zum Kunden gehört, geht mit ihm:
Fahrzeuge, Aufträge, Termine, Anfragen, Zeiteinträge, Reifeneinlagerung,
Verkäufe. Was belegnah ist, sperrt: Belege und Kassenbuchzeilen. Dasselbe für
das Fahrzeug — die eigenen Unterlagen gehen mit, Belege und Aufträge sperren.

**Kein Verweis wird mehr stillschweigend auf `NULL` gesetzt** (B-190).

Die Sperre ist `no action`, nicht `restrict`. Der Unterschied ist der
Zeitpunkt: `no action` prüft erst am Ende der Anweisung, `restrict` sofort.
Eine berechtigte Kaskade, die die verweisende Zeile im selben Zug entfernt,
bleibt dadurch möglich; mit `restrict` wäre schon das Löschen eines Kunden
samt seiner Aufträge gescheitert. Beide Fälle sind als Verhalten geprüft, nicht
nur als Deklaration.

### Was dabei auffiel

**Der Drift-Test hätte die ganze Umstellung nicht bemerkt.** Er verglich
Existenz, Pflichtfeld und Spaltenbreite — nicht den Typ. 22 Spalten wechselten
von `numeric` auf `integer`, und die Prüfung blieb grün. Der Test vergleicht
jetzt für jede Spalte `format_type` aus PostgreSQL mit dem, was Drizzle
deklariert, und listet die verbliebenen `numeric`-Spalten namentlich auf.

Nebenbei: `vehicle_listings` trug zwei Indizes auf derselben Spalte, einen
eindeutigen und einen gewöhnlichen. Der gewöhnliche ist weg.

### Dokumentation

Zwei neue Seiten im Wissensnetz:
[Geldbeträge](../architecture/money.md) und
[Löschen und Archivieren](../architecture/loeschen-und-archivieren.md). Das
Entscheidungsregister führt jetzt E-10 bis E-20 und hält fest, welche ADRs des
Vorgängers dadurch abgelöst sind: ADR-004 durch E-19, ADR-009 durch E-12. Der
Datenkatalog nennt nicht mehr T-005 als ausstehend, weil er es nicht mehr ist.

**Zahlen**

| | |
| --- | --- |
| Tabellen | 51 (13 Domänendateien) |
| Baseline | 229 wiederholbare Anweisungen, 118 Indizes, 60 Fremdschlüssel |
| Geldspalten | 22, alle `integer` in Cent |
| Tests | 310 (20 Dateien), davon 92 Integrationstests |
| Coverage | 92,7 % Anweisungen · 84,0 % Zweige · 90,0 % Funktionen |
| `shared/money.ts` | 100 % Anweisungen, Zweige, Funktionen und Zeilen |
| Befund-Abdeckung | 27 von 27 fälligen Befunden mit Regressionstest |
