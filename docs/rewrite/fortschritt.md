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
