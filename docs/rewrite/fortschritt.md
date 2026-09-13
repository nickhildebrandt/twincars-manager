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

---

## T-006 — Server-Grundgerüst und Infrastruktur-Helfer · fertig

**Datum:** 2026-09-13 · **Vorbedingungen:** T-004, T-005 (beide erfüllt)

Die Schicht, auf der jedes fachliche Paket danach aufsetzt: Verbindung,
Transaktion, Wächter, Listen, Nummern, Verschlüsselung, Drossel, Zeit,
Aufgabenregister, Gesundheitsendpunkt.

### Was entstanden ist

| Datei | Zweck |
| --- | --- |
| `shared/datetime.ts` | eine Geschäftszeitzone, Datumsrechnung, deutsche Formate |
| `shared/numbering.ts` | Nummernvorlagen rendern (Client und Server) |
| `shared/domain.ts` | alle Wertelisten mit deutschen Beschriftungen |
| `shared/schemas/domain.ts` | Valibot-Schemata aus denselben Listen |
| `server/utils/guards.ts` | `requireUser`, `requirePermission`, `requireAnyPermission` |
| `server/utils/pagination.ts` | `ORDER BY`/`LIMIT`/`OFFSET` mit Sortier-Weißliste |
| `server/utils/numbering.ts` | Nummernvergabe, atomar und transaktionsfähig |
| `server/utils/crypto.ts` | AES-256-GCM für Geheimnisse in der Datenbank |
| `server/utils/rate-limit.ts` | Ein-Minuten-Zähler für Anmeldung und öffentliche API |
| `server/utils/health.ts` | die Zustandsprüfung, ohne HTTP |
| `server/tasks/_registry.ts` | eine Erklärung je wiederkehrender Aufgabe |
| `server/api/health.get.ts` | der erste Endpoint |

### Entscheidungen, die dabei fielen

**Die Wertelisten haben eine eigene Datei bekommen.** Der Arbeitsplan sah
`server/utils/status-labels.ts` und `payment-methods.ts` vor. Beide Inhalte
gehören aber der Oberfläche genauso wie dem Server, also liegen sie in
`shared/domain.ts`. Aus derselben Liste entstehen jetzt drei Dinge: die
`CHECK`-Bedingung in der Datenbank, das Valibot-Schema und die deutsche
Beschriftung. Sie können nicht mehr auseinanderlaufen — genau das war B-011.

**Zahlungsarten sind jetzt Codes.** Der Vorgänger speicherte die Beschriftung
selbst („Überweisung" stand als Wert in der Spalte und damit in jeder
SQL-Abfrage). Da die Anwendung leer startet (E-20), kostet die Umstellung
nichts.

**Eine Saison, eine Schreibweise.** Der Katalog schrieb `Sommer`, die
Einlagerung `summer`, und die Suche hielt eine dritte Karte vor, um beides zu
verstehen. Jetzt: `summer` als Code, „Sommer" als Beschriftung.

**Ein Vokabular für Importläufe.** eBay meldete `success`, der
Access-Import `completed`.

**`no action` statt `restrict`** — siehe den T-005-Eintrag: die Prüfung läuft
erst am Ende der Anweisung, eine berechtigte Kaskade bleibt möglich.

**Geld liegt in `shared/money.ts`, nicht in `server/utils/money.ts`.** Die
Oberfläche formatiert und liest Beträge, also gehört die Rechenschicht nach
`shared/`.

### Was dabei auffiel

**Die Drossel ließ bei Grenzwert null einen Aufruf durch.** Der erste Aufruf
eines Zeitfensters wurde bedingungslos erlaubt. Ein Grenzwert von null heißt
aber „geschlossen". Der Test hat es gefunden, bevor es jemand benutzt hat.

**`sent_messages.status` widersprach sich selbst.** Die Spalte hatte den
Vorgabewert `sent`, während jeder Sendeweg ausdrücklich `pending` eintrug. Die
Zeile entsteht vor dem Versand, also ist `pending` richtig.

**`customer_inquiries.status` war tot.** Keine Schreibstelle, keine Lesestelle,
und F-582 hält ausdrücklich fest, dass der Posteingang keinen Status pflegt —
er filtert über den Benachrichtigungsstatus. Die Spalte ist weg.

**Die Wächter waren vollständig ungetestet.** Sie sind die erste Anweisung
jedes Endpoints und damit sicherheitsrelevant; jetzt prüfen 26 Tests jede
Verzweigung samt der deutschen Sätze.

**Verbindungsaufbau war doppelt.** Der Testaufbau baute seinen eigenen
Drizzle-Client. Jetzt geht beides durch `createDatabase` — eine Abweichung
zwischen Test- und Serververbindung ist damit ausgeschlossen.

### Behobene Befunde

| Befund | Was jetzt gilt |
| --- | --- |
| B-011 | eine Quelle für Werte und Beschriftungen, in `shared/domain.ts` |
| B-018 | ohne `APP_SECRET` startet nichts; kein eingebauter Ersatzschlüssel |
| B-026 | keine wählbare Seitengröße, auch nicht als toter Helfer |
| B-028 | eine Geschäftszeitzone entscheidet jede Tagesgrenze |
| B-304 | die Nummer wird in derselben Transaktion vergeben wie der Beleg |
| B-335 | 38 `CHECK`-Bedingungen; Alias-Status wie `open` sind abgeschafft |
| B-411 | dieselben Bedingungen auch auf den Buchungsspalten |

### Doku

`docs/architecture/server-schichten.md` (neu),
`docs/architecture/wertelisten.md` (**aus dem Code erzeugt**, `pnpm docs:domain`),
`docs/api/health-get.md` (ausgeschrieben statt Vorlage).

**Zahlen**

| | |
| --- | --- |
| Tabellen | 51, davon 38 Prüfbedingungen auf Diskriminatoren |
| Baseline | 228 wiederholbare Anweisungen |
| Tests | 650 (32 Dateien) |
| Coverage | 93,8 % Anweisungen · 85,0 % Zweige · 94,2 % Funktionen |
| Befund-Abdeckung | 33 von 33 fälligen Befunden mit Regressionstest |

---

## T-007 — Authentifizierung, Sitzungen, Rechte · fertig

**Datum:** 2026-09-13 · **Vorbedingungen:** T-005, T-006 (beide erfüllt)

better-auth 1.7.4, Benutzername und Passwort, eigenes Rollenmodell. Die
Entscheidung ist alt (ADR-013, Untersuchung in
[`inventar/research-auth.md`](inventar/research-auth.md)); neu ist, wie streng
sie hier umgesetzt wird.

### Was entstanden ist

| Datei | Zweck |
| --- | --- |
| `server/utils/auth.ts` | die Instanz der Bibliothek |
| `server/utils/auth-users.ts` | Konten, Rollen, Rechte, letzter Administrator |
| `server/utils/auth-accounts.ts` | Konto anlegen, Passwort setzen |
| `server/utils/auth-paths.ts` | was öffentlich ist, was die Bibliothek anbieten darf |
| `server/utils/client-ip.ts` | welche Adresse gezählt wird |
| `server/middleware/00.throttle.ts` | Anmeldedrossel |
| `server/middleware/01.auth.ts` | Sitzung einmal je Request |
| `server/middleware/02.api-guard.ts` | zweiter Riegel vor `/api` |
| `server/api/auth/[...all].ts` | die Bibliothek, gefiltert |
| `server/api/me.get.ts` | wer angemeldet ist, für die Oberfläche |
| `shared/redirect.ts` | wohin die Anmeldung weiterleiten darf |
| `shared/idle.ts` | wann eine Sitzung wegen Untätigkeit endet |
| `app/composables/useAuth.ts` | Anmelden, Abmelden, Sichtbarkeit |
| `app/middleware/auth.global.ts`, `permission.ts` | keine Seite ohne Sitzung |
| `app/pages/login.vue`, `403.vue` | Anmeldung und die Seite, die erklärt |
| `app/plugins/01.auth.ts`, `idle-logout.client.ts` | Zustand laden, Untätigkeit |

### Drei Dinge, die anders gelöst sind als geplant

**Die Drossel gehört uns, nicht der Bibliothek.** Beim Einbau fiel auf, dass
better-auth 1.7.4 `x-forwarded-for` **standardmäßig** liest und einen
einwertigen Header akzeptiert. Ohne Proxy davor schickt ein Angreifer bei jedem
Versuch eine andere Adresse, landet nie im selben Eimer, und der
Brute-Force-Schutz tut nichts — genau der Befund B-003. Der eingebaute Zähler
ist deshalb aus; gezählt wird in einer eigenen Middleware, die den Header nur
glaubt, wenn `TRUST_PROXY=on` gesetzt ist. Dasselbe gilt für die Adresse, die
in der Sitzungszeile landet.

**Nur vier Endpunkte der Bibliothek sind erreichbar**, als Zulassungsliste:
Anmelden, Abmelden, Sitzung lesen, Passwort ändern. Der Vorgänger reichte den
Catch-all durch und bot damit ungewollt `update-user` an — womit ein
Angemeldeter seinen Benutzernamen ändern konnte, obwohl die Oberfläche das
ausschließt (B-051) — und `is-username-available` ohne Sitzung, womit sich
durchprobieren ließ, welche Zugänge es gibt (B-052). Eine Sperrliste hätte
dasselbe Problem beim nächsten Versionssprung wieder.

**Sehen und Dürfen sind getrennt.** `hasPermission` prüft den genauen
Schlüssel, `hasModule` irgendeinen des Moduls. Der Vorgänger verlangte im
Sidebar-Eintrag genau `hours:write_own`, sodass eine Rolle mit vollem Zugriff
den Eintrag verlor (B-058); die geseedeten Rollen hielten zufällig beide
Schlüssel, deshalb fiel es nie auf.

### Was dabei auffiel

**Die vier Tabellen der Bibliothek sprechen `Date`.** Ihre Zeitstempel stehen
jetzt auf `mode: 'date'`, die fachlichen Tabellen weiter auf Zeichenketten. Am
Spaltentyp ändert das nichts.

**Der Drizzle-Adapter kann keine Joins gegen dieses Schema.** Er sucht ein
inline `.references()`; hier stehen die Fremdschlüssel als benannte
`foreignKey()`-Blöcke, damit die Namen stabil bleiben. Also zwei Abfragen statt
einer — bei einer Handvoll Konten kostenlos.

**`/api/me` braucht keine Sitzung, muss aber eine melden.** Das sind zwei
verschiedene Fragen; die Sitzungssuche läuft deshalb für alles außer
statischen Dateien und den Endpunkten der Bibliothek, die das Cookie selbst
lesen.

**`/api/healthy-profits` galt als öffentlich**, weil `/api/health` ein Präfix
davon ist. Präfixe enden jetzt an einer Segmentgrenze. Der Test fand es, bevor
es einen solchen Endpoint gab.

### Behobene Befunde

| Befund | Was jetzt gilt |
| --- | --- |
| B-002, B-056 | das Ziel wird geparst; Backslash, `//` und Kodierungen werden verworfen |
| B-003, B-054 | der Weiterleitungs-Header zählt nur hinter einem erklärten Proxy |
| B-013, B-072 | Aktivität gilt tabübergreifend, mit Vorwarnung zwei Minuten vorher |
| B-014, B-057 | 401 führt zur Anmeldung, mit dem ursprünglichen Ziel im Gepäck |
| B-018, B-071 | ohne Geheimnis startet nichts; kein eingebauter Ersatzschlüssel |
| B-041 | eine zweite Sperre vor `/api`: ein vergessener Wächter ist 401, nicht offen |
| B-051, B-052 | Zulassungsliste statt Catch-all |
| B-058 | Modul sehen und Modul dürfen sind getrennte Fragen |
| B-080 | jeder genannte Kernpfad hat jetzt einen Test, nachprüfbar |

### Doku

`docs/architecture/auth.md` (neu), `docs/api/auth-all-.md`,
`docs/api/me-get.md`, `docs/decisions/adr-019-better-auth-bleibt.md`.

### Ein Werkzeugproblem, kein Anwendungsproblem

Beim Laufenlassen mit gelöschtem Vite-Zwischenspeicher scheitert das
Browser-Projekt, bevor ein Test läuft. Vite optimiert die Abhängigkeiten,
entdeckt mitten im Lauf eine weitere, lädt die Seite neu — und die Aufbaudatei
hält danach eine veraltete Ausgabe von Vitest fest. Das lag schon vorher so
vor; aufgefallen ist es erst, weil dieser Durchgang den Zwischenspeicher
angefasst hat. Sechs Ansätze halfen nicht; die Umgehung wärmt den
Zwischenspeicher einmal vor. Kein Test wird übersprungen. Einzelheiten und der
Weg zurück: [blocker.md](blocker.md) W-01.

**Zahlen**

| | |
| --- | --- |
| Tests | 913 (45 Dateien) |
| Coverage | 96,4 % Anweisungen · 88,8 % Zweige · 98,0 % Funktionen |
| Schwellen | ab hier auf die erreichten Werte gezogen |
| Befund-Abdeckung | 48 von 48 fälligen Befunden mit Regressionstest |

---

## T-008 — App-Shell, Navigation, Zustände, Animationen · fertig

**Datum:** 2026-09-13 · **Vorbedingung:** T-007 (erfüllt)

Die Hülle, in der ab jetzt jede fachliche Seite liegt: Seitenleiste, Kopfzeile,
Inhaltsbereich, auf dem Telefon eine Schublade.

### Was entstanden ist

| Datei | Zweck |
| --- | --- |
| `shared/navigation.ts` | acht Gruppen, Reihenfolge und Beschriftungen wie im Bestand |
| `app/layouts/default.vue` | die Hülle |
| `app/layouts/blank.vue` | ohne Hülle, für Anmeldung und Ersteinrichtung |
| `app/components/app/AppSidebar.vue` | Leiste mit Logo, Navigation, Version |
| `app/components/app/AppHeader.vue` | Seitentitel, Benutzermenü, Griff zur Schublade |
| `app/components/app/AppUserMenu.vue` | wer angemeldet ist, und der Weg hinaus |
| `app/components/app/NavigationTree.vue` | die Einträge — einmal für Leiste und Schublade |
| `app/composables/useBusy.ts` | drei Stufen, ein Zähler |
| `app/composables/useFormDirty.ts` | ungespeicherte Änderungen, zentral |
| `app/composables/useNavigation.ts` | gefilterte Navigation und Seitentitel |

### Entscheidungen

**Ein Navigationseintrag nennt Module, keine einzelnen Schlüssel**, und darf
mehrere nennen. Das behebt zwei Befunde auf einmal: „Stunden" verlangte genau
`hours:write_own` (B-058), „Gesendet" stand nur unter `invoices`, obwohl die
Historie auch Rundschreiben zeigt (B-375).

**Markiert wird der längste passende Eintrag.** Der Vorgänger markierte per
Präfix und hatte auf `/settings/inquiries` zwei Einträge gleichzeitig
hervorgehoben (B-043).

**Die Ladeleiste ist die von Nuxt.** `useBusy()` steuert sie über
`useLoadingIndicator()`, statt eine zweite anzulegen. Jede Anfrage aus
`useApi()` zählt mit; lokale `busy`-Flags gibt es nicht.

**`NavigationTree` ist eine eigene Komponente**, damit Leiste und Schublade
denselben Baum zeigen. Der Vorgänger pflegte beide getrennt.

### Was dabei auffiel

**Fehler wurden höflich vorgelesen.** Reka meldet jeden Toast als
`type: 'foreground'`, also unterbrechend — was für Erfolge zu viel ist und für
Fehler richtig. `useNotify()` setzt die Dringlichkeit jetzt je nach Art. Der
Vorgänger machte es umgekehrt falsch und las alles höflich vor, auch Fehler
(B-035).

**Ein Test war grün, ohne etwas zu prüfen.** Die Attrappe für `useRoute` gab
ein einfaches Objekt zurück; die Hülle beobachtet aber `route.fullPath` und
bekam eine Änderung nie mit. Die Prüfung, ob sich die Schublade nach der
Navigation schließt, wäre so immer durchgegangen. Jetzt ist die Attrappe
reaktiv.

**Der Wächter für ungespeicherte Änderungen musste einfacher werden.** Er
antwortet nur mit ja oder nein und fasst den Verlauf nicht an — genau deshalb
kann der zusätzliche Vorwärtseintrag aus B-038 nicht mehr entstehen.

### Behobene Befunde

| Befund | Was jetzt gilt |
| --- | --- |
| B-012 | die Fehlerseite zeigt keine englische Framework-Meldung |
| B-014, B-057 | 401 führt zur Anmeldung, mit dem ursprünglichen Ziel |
| B-017 | kein Bild als Logo, also auch kein Megabyte beim ersten Aufruf |
| B-019 | die Schublade schließt sich nach Navigation und Klick |
| B-020 | eine Quelle für den aktuellen Pfad, eine Stelle für die Markierung |
| B-033 | die Einstellungszeile legt der Seed an, kein Lesepfad |
| B-034 | jede Seite trägt ihren eigenen Titel |
| B-035 | Fehler unterbrechen den Screenreader, Bestätigungen nicht |
| B-037 | nichts Totes übernommen: kein zweiter Titelzustand, kein ungenutztes Symbol |
| B-038 | der Wächter fasst den Verlauf nicht an |
| B-043 | markiert wird der längste passende Eintrag |
| B-058 | Modul sehen und Modul dürfen sind getrennt |
| B-375 | wer Rundschreiben verschickt, sieht die Versandhistorie |

### Doku

`docs/ui/app-shell.md` (neu), `docs/architecture/oberflaeche.md` (neu).

**Zahlen**

| | |
| --- | --- |
| Tests | 1053 (51 Dateien) |
| Coverage | 97,3 % Anweisungen · 90,1 % Zweige · 98,7 % Funktionen |
| Befund-Abdeckung | 58 von 58 fälligen Befunden mit Regressionstest |

---

## Nachbesserung — Löschregeln und ein fehlender Fremdschlüssel

**Datum:** 2026-09-13 · **Auslöser:** die Durchsicht des gesamten
Beziehungsgeflechts für die Entitätsübersicht

Beim Aufzeichnen aller 51 Tabellen und 60 Beziehungen fielen zwei Dinge auf,
die vorher niemand gesehen hatte.

**Ein Verweis hatte gar keinen Fremdschlüssel.**
`documents.converted_to_invoice_id` nennt die Rechnung, in die ein Angebot
überging — die Datenbank wusste davon nichts. Es gab einen Index darauf, aber
keine Beziehung. Jetzt ist er deklariert, und ein Test besteht darauf, dass
**jede** `uuid`-Spalte mit der Endung `_id` einen Fremdschlüssel hat.

**Neun Löschregeln setzten still auf `NULL`, wo Information verloren ging.**
B-190 verlangt genau das Gegenteil. Berichtigt:

| Beziehung | vorher | jetzt | warum |
| --- | --- | --- | --- |
| Stornokette der Belege (zwei Verweise) | `set null` | sperrt | eine Stornorechnung wird nicht gelöscht |
| Buchung → Beleg | `set null` | sperrt | die Buchung nennt ihre Herkunft |
| Buchung → Lieferant | `set null` | sperrt | ein Lieferant mit Buchungen wird archiviert |
| Buchung → Kategorie | `set null` | sperrt | eine Kategorie mit Buchungen bleibt |
| Termin → Mitarbeiter | `set null` | sperrt | wer zugeteilt war, ist eine Auskunft |
| Auftragsposition → Mitarbeiter | `set null` | sperrt | wer gearbeitet hat, ist eine Auskunft |
| Firmeneinstellung → Arbeitszeitposition | `set null` | sperrt | ohne sie funktioniert kein Auftrag |
| Beleg → erzeugender Auftrag | `set null` | sperrt | ein Auftrag mit Beleg verschwindet nicht spurlos |

**Und ein echter Widerspruch.** Ein Zeiteintrag verweist sowohl auf den Auftrag
als auch auf die Auftragsposition. Die eine Beziehung kaskadierte, die andere
setzte auf `NULL` — dieselbe Löschung, zwei verschiedene Folgen, je nachdem
welcher Verweis gefüllt war. Beide kaskadieren jetzt.

**Zehn `set null`-Regeln bleiben**, und jede ist die gemeinte Folge: ein
gelöschter Rechnungsentwurf macht die Arbeitszeit wieder unabgerechnet und den
Auftrag wieder abrechenbar; eine Belegposition trägt Bezeichnung und Preis als
eigene Kopie und bleibt ohne Katalogartikel lesbar. Alle zehn stehen jetzt
**namentlich mit Begründung** im Drift-Test. Eine elfte, die dort nicht steht,
lässt ihn scheitern — und wer sie hinzufügt, muss den Grund aufschreiben.

**Zahlen**

| | |
| --- | --- |
| Beziehungen | 61 (vorher 60) |
| davon kaskadierend | 35 |
| davon sperrend | 16 (vorher 6) |
| davon entkoppelnd | 10 (vorher 20) |
| Tests | 1059 |
