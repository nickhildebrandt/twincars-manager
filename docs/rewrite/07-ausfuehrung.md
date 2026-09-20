# 07 — Umsetzungsanleitung

> Diese Datei richtet sich an eine Sitzung, die den Altbestand **nicht** kennt,
> diese Unterhaltung **nicht** gesehen hat und **niemanden fragen kann**.
> Alles, was zum Arbeiten nötig ist, steht hier oder ist von hier verlinkt.

---

## 1. Worum es geht

Im Verzeichnis `/home/nick/tc/twincars-manager` liegt **TwinCarsManager**, die
Verwaltungsanwendung eines kleinen deutschen Kfz-Betriebs mit Werkstatt,
Reifenhandel und Gebrauchtwagenhandel. Sie war in SvelteKit geschrieben und
wird auf **Nuxt** umgeschrieben.

**Der Altbestand ist seit dem 20.09.2026 nicht mehr im Repository.** Er war
ein Proof of Concept und liegt als Archiv daneben
(`../twincars-manager-sveltekit-poc-<Datum>.tar.gz`). Wie sich etwas verhalten
hat, liest du **nicht** im alten Code nach, sondern im Inventar
([01-inventar.md](01-inventar.md)) und in den Befunden
([02-befunde.md](02-befunde.md)) — beide wurden genau dafür geschrieben, und
sie sind vollständiger als ein Blick in eine einzelne Datei.

Das Repository **ist** die Anwendung: `app/`, `server/`, `shared/`, `test/`,
`scripts/`, dazu `docs/`. Schreiben darfst du überall, mit einer Ausnahme:

- `docs/inventar/**`, `01-inventar.md` und `02-befunde.md` beschreiben den
  **Vorgänger**. Sie sind Bestandsaufnahme, kein Plan, und werden nicht
  fortgeschrieben.
- `docs/rewrite/fortschritt.md` und `docs/rewrite/blocker.md` sind dagegen
  ausdrücklich zum Weiterschreiben da.

---

## 2. Reihenfolge beim Einlesen (30 Minuten)

1. **[03-architektur.md](03-architektur.md)** — die verbindlichen technischen
   Vorgaben. Wenn etwas davon mit vorgefundenem Code kollidiert, gewinnt das
   Dokument.
2. **[06-arbeitsplan.md](06-arbeitsplan.md)** — such dir das erste
   Arbeitspaket, dessen Vorbedingungen erfüllt sind.
3. **[04-ux.md](04-ux.md)** — wie sich die Oberfläche verhalten muss.
4. **[05-teststrategie.md](05-teststrategie.md)** — was „getestet" heißt.
5. Für das konkrete Paket: die genannten Feature-IDs in
   **[01-inventar.md](01-inventar.md)** und die genannten Befund-IDs in
   **[02-befunde.md](02-befunde.md)**.
6. Bei fachlichen Fragen: das ausführliche Modul-Inventar unter
   **[`inventar/`](inventar/)**. Dort steht für jedes Modul, welche Routen,
   Endpoints, Services, Komponenten, Abläufe, Nebenwirkungen und Tests der
   Bestand hat — mit Fundstellen der Form `pfad/datei.ts:zeile`.
7. **[08-entscheidungen.md](08-entscheidungen.md)** — was bereits entschieden
   ist und wie mit offenen Punkten zu verfahren ist.

Lies **nicht** das alte `CONTRIBUTING.md` als Regelwerk. Es beschreibt
SvelteKit. Es ist nur als Quelle für fachliche Regeln brauchbar, und die
stehen ohnehin in den Modul-Inventaren.

---

## 3. Ein Arbeitspaket abarbeiten — Schritt für Schritt

### Schritt 0 — Stand prüfen

```bash
cd /home/nick/tc/twincars-manager
git status --short                      # muss sauber sein
git branch --show-current               # erwartet: rewrite/nuxt
cat docs/rewrite/fortschritt.md         # welches Paket ist zuletzt fertig geworden?
cat docs/rewrite/blocker.md 2>/dev/null # gibt es Blocker, die dieses Paket betreffen?
```

Existiert der Zweig noch nicht:
`git switch -c rewrite/nuxt`

### Schritt 1 — Paket lesen und verstehen

Im Arbeitsplan stehen für jedes Paket: abgedeckte Feature-IDs, behobene
Befund-IDs, Vorbedingungen, zu erstellende Dateien, Akzeptanzkriterien und die
zugehörigen Tests. **Lies zuerst alle genannten Feature-Zeilen im Inventar.**
Die Spalte „Erwartetes Verhalten" ist die Spezifikation — nicht der alte Code
und nicht dein Gefühl.

Sind die Vorbedingungen eines Pakets nicht erfüllt, nimm das nächste, dessen
Vorbedingungen erfüllt sind.

### Schritt 2 — Schemata zuerst

Für jedes fachliche Paket gilt dieselbe Reihenfolge, weil sie Nacharbeit
vermeidet:

1. **Valibot-Schemata** in `shared/schemas/<domäne>.ts` —
   Anlegen, Ändern, Listenabfrage, Filter. Typen mit `v.InferOutput` ableiten,
   **nie** parallel deklarieren.
2. **Datenbankzugriff** in `server/services/<domäne>-service.ts` — reine
   Funktionen mit einfachen Argumenten, kein `event`.
3. **Endpoints** in `server/api/<domäne>/…` — Guard, Validierung,
   Service-Aufruf, mehr nicht.
4. **Seiten und Komponenten** in `app/…`.
5. **Tests** auf allen zutreffenden Ebenen.
6. **Dokumentation** unter `docs/`.

### Schritt 3 — Umsetzen

Die harten Regeln, die für jede Zeile Code gelten:

| Regel                                    | Bedeutung                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **pnpm**                                 | Niemals `npm` oder `yarn`. Keine `package-lock.json`.                                                                           |
| **Kein eigenes CSS**                     | Keine `<style>`-Blöcke, keine zweite CSS-Datei. Aussehen über Nuxt UI und `app/app.config.ts`. Tailwind-Klassen nur für Layout. |
| **Nuxt UI zuerst**                       | Erst prüfen, ob Nuxt UI oder Nuxt es kann. Neues Fremdpaket nur mit Eintrag in `08-entscheidungen.md`.                          |
| **Valibot überall**                      | Jede Grenze validiert: Body, Query, Routenparameter, Header, Formular, Umgebungsvariablen, externe Antworten, Uploads.          |
| **Guard zuerst**                         | Jeder Endpoint beginnt mit `requireUser`, `requirePermission` oder `requireAnyPermission`.                                      |
| **Pagination**                           | Jede Liste serverseitig, 25 pro Seite, kein Größenwähler.                                                                       |
| **Toast**                                | Jede Mutation meldet sich — Erfolg wie Fehler.                                                                                  |
| **Mehrfachauswahl**                      | Immer im modalen Dialog.                                                                                                        |
| **Animationen**                          | Werte aus [04-ux.md](04-ux.md) §3.2, `prefers-reduced-motion` respektieren.                                                     |
| **Testselektoren**                       | `data-testid` oder Rolle mit Namen. Niemals interne Nuxt-UI-Klassen.                                                            |
| **Transaktion**                          | Sobald mehr als eine Anweisung schreibt.                                                                                        |
| **Deutsch für Nutzer, Englisch im Code** | Oberflächentexte und Fehlermeldungen deutsch; Bezeichner, Kommentare, Commits englisch.                                         |

### Schritt 4 — Prüfen

```bash
cd nuxt
pnpm lint                 # ESLint inkl. Formatierung; --fix behebt das meiste
pnpm typecheck            # nuxt typecheck
pnpm test:unit
pnpm test:nuxt
pnpm test:integration     # braucht eine laufende PostgreSQL-Instanz
pnpm test:browser
pnpm test:e2e             # nur, wenn das Paket Golden Flows berührt
pnpm test:cov             # Coverage-Schwellen
pnpm test:befunde         # jeder behobene Befund hat einen Regressionstest
pnpm docs:check           # jede Feature-ID hat eine Seite, jeder Endpoint einen Eintrag
```

Kurzform für den Abschluss eines Pakets:

```bash
pnpm verify               # lint + typecheck + alle Tests + docs:check
```

**Alles muss grün sein.** Ein Test, der nicht läuft, wird nicht übersprungen,
nicht entschärft und nicht auf später verschoben. Wenn er nicht schreibbar ist,
ist das ein Blocker (§6).

### Schritt 5 — Die Anwendung wirklich ansehen

Bei jeder Änderung an der Oberfläche:

```bash
pnpm dev     # http://localhost:3000
```

Geh den betroffenen Ablauf einmal selbst durch: Leerzustand, Ladezustand,
Validierungsfehler, Erfolgsfall, Fehlerfall, fehlende Berechtigung. Prüfe
Toasts, Übergänge und dass keine Tabelle beim Blättern weiß wird. Ein
Screenshot des fertigen Zustands gehört in den Fortschrittseintrag.

### Schritt 6 — Dokumentieren

Ohne aktualisierte Dokumentation ist ein Paket nicht fertig. Für jedes Paket:

- je Feature-ID eine Seite `docs/features/F-nnn-<kurzname>.md` nach Vorlage,
- je Endpoint ein Eintrag unter `docs/api/`,
- je neuer eigener Komponente eine Seite unter `docs/ui/`,
- bei jeder Architekturentscheidung eine Seite unter `docs/decisions/`,
- betroffene Seiten unter `docs/architecture/`, `docs/data/`, `docs/guides/`
  aktualisieren,
- `docs/index.md` verlinkt alles Neue.

`pnpm docs:check` prüft das mechanisch.

### Schritt 7 — Commit

Ein Commit je Paket, Conventional Commits:

```
feat(customers): Kundenliste, Detail und Formular auf Nuxt

Setzt T-011 um: F-178 bis F-220, behebt B-183, B-186, B-190.

- Serverseitige Liste mit Suche, Kind-Filter, Archiv-Tab
- Detailseite mit Registerkarten, tolerant ladenden Nebenkarten
- Leeren eines Feldes wird jetzt gespeichert (B-183)

Tests: 34 unit, 12 nuxt, 18 integration, 1 e2e
Doku: docs/features/F-178..F-220, docs/api/customers/*
```

Regeln:

- **Typ** aus `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`,
  `ci`, `chore`, `revert`.
- **Scope** ist das Modul oder das Arbeitspaket.
- **Breaking Changes** mit `!` und einem `BREAKING CHANGE:`-Absatz — sie
  erzeugen eine neue Hauptversion, sobald der Zweig nach `main` läuft.
- `commitlint` prüft das im `commit-msg`-Hook. **Niemals `--no-verify`.**

### Schritt 8 — Fortschritt festhalten

Am Ende jedes Pakets eine Zeile in `docs/rewrite/fortschritt.md`:

```markdown
## T-011 — Kunden und Lieferanten · fertig 2026-09-14

- Features: F-178 … F-220 (43)
- Behobene Befunde: B-183, B-186, B-190, B-192
- Tests: 34 unit · 12 nuxt · 18 integration · 1 e2e — alle grün
- Coverage: 86,4 % Statements (Schwelle 80 %, nicht angehoben)
- Doku: 43 Feature-Seiten, 9 API-Einträge, 2 Komponenten
- Offen: E-16 (Kundenart) nach Empfehlung umgesetzt, Migration vorbereitet
```

---

## 4. Die Prüfbefehle müssen existieren

Paket **T-001** legt sie an. Sie sind Teil der Abnahme dieses Pakets:

| Skript                                                      | Inhalt                                    |
| ----------------------------------------------------------- | ----------------------------------------- |
| `pnpm dev`                                                  | Entwicklungsserver                        |
| `pnpm build` · `pnpm preview`                               | Produktionsbau, lokal starten             |
| `pnpm lint` · `pnpm lint:fix`                               | ESLint (Formatierung inbegriffen)         |
| `pnpm typecheck`                                            | `nuxt typecheck`                          |
| `pnpm test` … `pnpm test:e2e`                               | die fünf Testprojekte, einzeln und gesamt |
| `pnpm test:cov` · `pnpm test:cov:update`                    | Coverage, Schwellen anheben               |
| `pnpm test:befunde`                                         | Regressionstests gegen die Befundliste    |
| `pnpm docs:check` · `pnpm docs:api` · `pnpm docs:data`      | Doku prüfen und erzeugen                  |
| `pnpm db:generate` · `db:migrate` · `db:studio` · `db:seed` | Drizzle                                   |
| `pnpm test:db:reset`                                        | Testdatenbank neu aufbauen                |
| `pnpm verify`                                               | alles zusammen, für den Paketabschluss    |

---

## 5. Voraussetzungen der Umgebung

| Was                | Stand                                             | Prüfen mit            |
| ------------------ | ------------------------------------------------- | --------------------- |
| Node               | ≥ 24.11                                           | `node -v`             |
| pnpm               | über corepack                                     | `pnpm -v`             |
| PostgreSQL         | läuft lokal auf 5432                              | `pg_isready`          |
| Chromium für Tests | zwischengespeichert, **wird nie heruntergeladen** | `echo $CHROMIUM_PATH` |
| `mdbtools`         | nur für den Legacy-Import                         | `which mdb-export`    |

`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` ist gesetzt. Wenn ein Testlauf einen
Browser herunterladen will, ist die Konfiguration falsch — nicht die Umgebung.

---

## 6. Wenn ein Akzeptanzkriterium nicht erreichbar ist

**Nicht raten. Nicht umdefinieren. Nicht stillschweigend weglassen.**

1. Trag den Blocker in `docs/rewrite/blocker.md` ein:

```markdown
## BL-003 — UTable liefert keine serverseitige Sortierung wie erwartet

- **Paket:** T-011
- **Kriterium:** „Spaltenklick sortiert serverseitig"
- **Beobachtung:** `sorting`-State wird nur clientseitig angewendet; die
  dokumentierte Manual-Mode-Option greift in Version 4.11.1 nicht wie
  beschrieben.
- **Belege:** `app/components/data/DataTable.vue:88`, Testlauf
  `test/nuxt/data-table.test.ts` schlägt fehl mit „…"
- **Versucht:** kontrollierter State, `pagination-options`, `tableApi`
- **Auswirkung:** F-184 (Sortierung) bleibt offen; der Rest von T-011 ist fertig
- **Vorschlag:** eigener Spaltenkopf mit Sortierknopf, der die Abfrage ändert
- **Entscheidung nötig von:** niemandem — Vorschlag umsetzbar
```

2. Setz **alles andere** aus dem Paket fertig um.
3. Markiere die betroffene Feature-Seite unter `docs/features/` mit
   `status: blockiert` und verweise auf die Blocker-ID.
4. Mach mit dem nächsten Paket weiter, dessen Vorbedingungen erfüllt sind.

Ein Blocker ist kein Scheitern. Ein stillschweigend weggelassenes Kriterium
schon.

---

## 7. Umgang mit dem Altbestand

Der alte Code ist die **Referenz für Verhalten**, nicht die Vorlage für
Struktur. Wenn das Inventar eine Frage offenlässt:

```bash
# So verhält sich der Bestand — nachlesen, nicht kopieren:
sed -n '120,180p' src/lib/server/services/customer-service.ts
grep -rn "archived" src/routes/customers/
```

- **Fachliche Regeln** (Rechenwege, Statusübergänge, Textbausteine,
  Nummernformate) werden **übernommen**.
- **Technische Muster** (Remote Functions, Stores, DaisyUI-Klassen,
  Base64-Uploads) werden **nicht** übernommen.
- Findest du beim Nachlesen einen Fehler, der nicht in
  [02-befunde.md](02-befunde.md) steht: trag ihn dort mit der nächsten freien
  ID nach, samt Fundstelle und Einordnung, und behandle ihn wie jeden anderen
  Befund.

---

## 8. Umgang mit der vorhandenen Dokumentation

Unter `docs/` liegt bereits eine gepflegte Wissensbasis der alten Anwendung
(`docs/architecture/`, `docs/modules/`, `docs/domain/`, `docs/integrations/`,
`docs/operations/`, `docs/decisions/`, `docs/INDEX.md`).

- **Nicht löschen, nicht überschreiben.** Diese Seiten sind während des
  Rewrites die beste fachliche Quelle.
- Die neue Struktur entsteht **daneben** (`docs/index.md`, `docs/features/`,
  `docs/api/`, `docs/data/`, `docs/ui/`, `docs/guides/`).
- Fachliche Inhalte (Geschäftsregeln, Belegarten, Feiertage, Import-Eigenheiten)
  werden in die neuen Seiten **übernommen**, mit Quellenangabe.
- `docs/index.md` kennzeichnet die alten Seiten als „Bestand (alt)".
- Erst im Cutover-Paket (T-042) werden die überholten Seiten entfernt.

---

## 9. Entwurf für `CLAUDE.md`

Diese Datei legt Paket T-001 an. Sie ist die Kurzfassung, die jede spätere
Sitzung ohne Umweg liest.

````markdown
# CLAUDE.md — TwinCarsManager (Nuxt)

Verwaltungsanwendung eines kleinen deutschen Kfz-Betriebs: Werkstatt,
Reifenhandel, Gebrauchtwagenhandel. **Oberfläche deutsch, Code englisch.**
Der Plan für den Rewrite liegt in `../docs/rewrite/`, die Produktdoku in
`../docs/`.

## Harte Regeln — nicht verhandelbar

1. **pnpm** ausschließlich. Kein npm, kein yarn, keine package-lock.json.
2. **ESLint formatiert.** Prettier existiert nicht — auch nicht als
   Abhängigkeit, auch nicht als Konfigurationsdatei.
3. **Kein eigenes CSS.** Genau eine Datei: `app/assets/css/main.css` mit den
   beiden Pflicht-Imports. Keine `<style>`-Blöcke. Aussehen über
   `app/app.config.ts`. Tailwind-Klassen nur für Layout, so wenige wie möglich.
4. **Nuxt UI zuerst**, dann Nuxt/Nitro, dann Eigenbau, zuletzt ein Fremdpaket.
   Ein neues Paket braucht einen Eintrag in `../docs/rewrite/08-entscheidungen.md`.
5. **Valibot an jeder Grenze.** Body, Query, Routenparameter, Header,
   Formulare, Umgebungsvariablen, Antworten externer Dienste, Uploads.
   Schemata liegen **nur** in `shared/schemas/`. Typen mit `v.InferOutput`
   ableiten, niemals daneben deklarieren.
6. **Guard als erste Anweisung** in jedem Endpoint:
   `requirePermission(event, '<modul>')`.
7. **Serverseitige Pagination, fix 25.** Kein Größenwähler. Filterwechsel
   setzt auf Seite 1.
8. **Toast bei jeder Mutation** — Erfolg wie Fehler, über `useNotify()`.
9. **Mehrfachauswahl im modalen Dialog.**
10. **Animationen** nach `../docs/rewrite/04-ux.md` §3.2, inklusive
    `prefers-reduced-motion`.
11. **Testselektoren**: `data-testid` oder Rolle mit zugänglichem Namen.
    Niemals interne Nuxt-UI-Klassen.
12. **Transaktion**, sobald mehr als eine Anweisung schreibt.
13. **Tests und Doku gehören zum Paket.** Ohne sie ist nichts fertig.
14. **`../src/` ist read-only** — der alte SvelteKit-Bestand.

## Befehle

```bash
pnpm dev              # Entwicklungsserver auf :3000
pnpm verify           # lint + typecheck + alle Tests + docs:check
pnpm lint             # ESLint, formatiert mit --fix
pnpm typecheck        # nuxt typecheck
pnpm test:unit        # reine Funktionen, Schemata (Node)
pnpm test:nuxt        # Komponenten in der Nuxt-Runtime
pnpm test:integration # Endpoints gegen echtes PostgreSQL
pnpm test:browser     # Fokus, Tastatur, Overlays (Chromium)
pnpm test:e2e         # Golden Flows
pnpm test:befunde     # Regressionstest je behobenem Befund
pnpm docs:check       # Doku-Abdeckung
pnpm db:migrate       # Migrationen anwenden
```

## Aufbau

```
app/       Oberfläche (Seiten, Komponenten, Composables, Layouts, Middleware)
server/    api/ (dünn) · services/ (Fachlogik) · database/ · utils/ · tasks/
shared/    schemas/ (Valibot) · permissions.ts · types/ — von beiden Seiten genutzt
test/      unit/ nuxt/ browser/ integration/ e2e/ factories/
```

Drei Ebenen im Server, klar getrennt: `api` macht Guard + Validierung +
Aufruf; `services` kennt die Fachlogik und Drizzle; `utils` die Infrastruktur.
Services bekommen einfache Argumente, nie das Event.

## Fehler

Jeder Fehler entsteht über `server/utils/errors.ts`
(`notFound`, `forbidden`, `conflict`, `validationFailed`, …) und erreicht den
Nutzer als **deutscher Satz**. 422 trägt Feldfehler, die das Formular direkt
anzeigt. 5xx geben nie Interna preis. Im Client kapselt `useApi()` jeden
Aufruf.

## Wo steht was

- Zielverhalten je Feature: `../docs/rewrite/01-inventar.md` (`F-nnn`)
- Bekannte Fehler des Vorgängers: `../docs/rewrite/02-befunde.md` (`B-nnn`)
- Technische Vorgaben: `../docs/rewrite/03-architektur.md`
- Bedienung und Abläufe: `../docs/rewrite/04-ux.md`
- Testregeln: `../docs/rewrite/05-teststrategie.md`
- Arbeitspakete: `../docs/rewrite/06-arbeitsplan.md`
- Produktdoku: `../docs/index.md`
````

---

## 10. Häufige Fallen

| Falle                                                       | Richtig                                                                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `readValidatedBody(event, schema)` mit einem Valibot-Schema | Die h3-Version in Nuxt 4.5 erkennt kein Standard Schema. Immer `useValidatedBody(event, schema)` aus `server/utils/validate.ts`. |
| `UPagination` ohne `items-per-page`                         | Der Vorgabewert ist 10. Immer 25 setzen.                                                                                         |
| `UInputDate` mit `Date` oder ISO-Zeichenkette               | Braucht `CalendarDate` aus `@internationalized/date`. Über `DateField` gehen.                                                    |
| `@nuxt/test-utils/runtime` und `/e2e` in derselben Datei    | Verboten. Getrennte Projekte, getrennte Dateien.                                                                                 |
| `coverage`/`globalSetup` in einem Vitest-Projekt            | Sind Root-Optionen und werden dort ignoriert.                                                                                    |
| Eigener `busy`-Zustand je Komponente                        | `useBusy()` ist die einzige Quelle; einzelne Buttons dürfen `loading-auto` nutzen.                                               |
| Eigener Dirty-Zustand im Formular                           | `UForm` kennt `form.dirty`.                                                                                                      |
| Eigener Bestätigungsdialog                                  | `useOverlay().create(ConfirmDialog)` liefert ein Promise.                                                                        |
| Bytes in einer Listenabfrage mitladen                       | PDFs und Bilder haben eigene Endpoints.                                                                                          |
| `process.env` irgendwo außerhalb der Env-Prüfung            | `runtimeConfig` benutzen.                                                                                                        |
