# 05 — Teststrategie

> Teil des Rewrite-Plans. Siehe [00-uebersicht.md](00-uebersicht.md) ·
> [01-inventar.md](01-inventar.md) · [02-befunde.md](02-befunde.md) ·
> [03-architektur.md](03-architektur.md) · [04-ux.md](04-ux.md) ·
> [06-arbeitsplan.md](06-arbeitsplan.md)

Der Testbestand der alten Anwendung ist **nicht** der Maßstab. Er deckt
ausgewählte Dienste und einige Komponenten ab, hat keine Coverage-Schwellen und
läuft gegen eine simulierte Datenbank, die sich an mehreren Stellen anders
verhält als PostgreSQL ([`inventar/ops.md`](inventar/ops.md) §7,
[`inventar/datamodel.md`](inventar/datamodel.md) B-575). Ziel hier ist die
höchstmögliche sinnvolle Abdeckung über alle Testarten, die das
Nuxt-Ökosystem vorsieht.

**Grundlage ist `@nuxt/test-utils`** (4.3.2), Nuxts eigene Test-Bibliothek.
Fremde Testframeworks kommen nicht zum Einsatz, wo Nuxt Bordmittel hat.

---

## 1. Die sechs Prüfebenen auf einen Blick

| Projekt       | Ort                 | Umgebung                          | Prüft                                                                     | Laufzeit-Ziel |
| ------------- | ------------------- | --------------------------------- | ------------------------------------------------------------------------- | ------------- |
| `unit`        | `test/unit/`        | Node                              | reine Funktionen, Valibot-Schemata, Berechnungen, Formatierung, Query-Bau | < 10 s        |
| `nuxt`        | `test/nuxt/`        | Nuxt-Runtime (happy-dom)          | eigene Komponenten, Composables, Seiten                                   | < 60 s        |
| `browser`     | `test/browser/`     | Chromium (Vitest Browser Mode)    | Fokus, Tastatur, Overlays, Scroll, Animationen                            | < 90 s        |
| `integration` | `test/integration/` | Node + echte Test-Datenbank       | jeder Endpoint: Schema, Rechte, Fehlercodes, Transaktionen, Pagination    | < 120 s       |
| `e2e`         | `test/e2e/`         | Playwright gegen Produktionsbuild | Golden Flows aus [04-ux.md](04-ux.md) §9                                  | < 5 min       |
| `regression`  | verteilt            | passend                           | **jeder** behobene Befund aus [02-befunde.md](02-befunde.md)              | —             |

`@nuxt/test-utils/runtime` und `@nuxt/test-utils/e2e` dürfen **niemals in
derselben Datei** verwendet werden. Die Projekttrennung setzt das baulich durch.

---

## 2. Einrichtung

### 2.1 Pakete

```bash
pnpm add -D @nuxt/test-utils vitest @vue/test-utils happy-dom \
            @vitest/coverage-v8 @vitest/browser-playwright \
            playwright-core @playwright/test
```

> **Achtung, neu in Vitest 5:** Die Browser-Provider sind in eigene Pakete
> aufgeteilt. Es heißt jetzt `@vitest/browser-playwright` und
> `provider: playwright()` — nicht mehr `@vitest/browser` mit
> `provider: 'playwright'`. `@vitest/coverage-v8` muss **exakt** die
> Vitest-Version tragen (Peer `"5.0.0"`, keine Bandbreite).

Browser werden **nie** heruntergeladen: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`,
das zwischengespeicherte Chromium wird über `CHROMIUM_PATH` eingebunden (wie im
Bestand, [`inventar/ops.md`](inventar/ops.md) §1).

### 2.2 Nuxt-Modul

`@nuxt/test-utils/module` wird in `nuxt.config.ts` eingetragen, damit die
Vitest-Integration in den Nuxt DevTools erscheint:

```ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint', '@nuxt/test-utils/module']
})
```

### 2.3 `vitest.config.ts` mit Vitest-Projekten

```ts
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    // Diese vier Optionen gelten NUR im Root, nicht je Projekt:
    globalSetup: ['test/setup/database.ts'],
    coverage: {
      /* §7 */
    },
    reporters: ['default'],
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['test/unit/**/*.test.ts']
        }
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/nuxt/**/*.test.ts'],
          environment: 'nuxt',
          environmentOptions: {
            nuxt: {
              domEnvironment: 'happy-dom',
              mock: { intersectionObserver: true, indexedDb: true }
            }
          },
          setupFiles: ['test/setup/nuxt.ts']
        }
      }),
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['test/integration/**/*.test.ts'],
          setupFiles: ['test/setup/db-per-worker.ts']
        }
      },
      await defineVitestProject({
        test: {
          name: 'browser',
          include: ['test/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }]
          },
          setupFiles: ['@nuxt/test-utils/browser']
        }
      }),
      {
        test: {
          name: 'e2e',
          environment: 'node',
          include: ['test/e2e/**/*.test.ts'],
          testTimeout: 60_000
        }
      }
    ]
  }
})
```

Wichtige Eigenheiten, die bei der Umsetzung Zeit sparen:

- `defineVitestProject` ist **asynchron** — deshalb `await` innerhalb des Arrays.
- **`coverage`, `reporters`, `globalSetup` und `resolveSnapshotPath` sind
  Root-Optionen.** In einem Projekt gesetzt werden sie ignoriert. Die
  einmalige Vorbereitung der Test-Datenbank gehört deshalb in den
  Root-`globalSetup`, die Vergabe je Worker in `setupFiles` des Projekts.
- `setupFiles` werden zwischen Root und Projekt **zusammengeführt**, nicht
  überschrieben; `name` und `projects` werden nie vererbt.
- `mock.intersectionObserver` ist in der Nuxt-Umgebung standardmäßig aktiv,
  `indexedDb` nicht — beides wird trotzdem explizit gesetzt, damit die Absicht
  im Code steht und nicht von einem Default abhängt.
- Einzelne Projekte laufen mit `vitest --project unit`; Ausschluss mit
  `vitest --project '!e2e'`.
- **`@nuxt/test-utils/runtime` und `@nuxt/test-utils/e2e` dürfen nicht in
  derselben Datei stehen.** Das bricht mit der alten Regel „Test liegt neben
  der Quelle": reine Unit-Tests dürfen weiterhin neben dem Quelltext liegen
  (das `unit`-Projekt nimmt zusätzlich `app/**/*.test.ts` und
  `server/**/*.test.ts` auf), alles mit Nuxt-Runtime liegt in `test/nuxt/`.

### 2.4 `.env.test`

Eine eigene, im Repository liegende `.env.test` (ohne echte Geheimnisse) setzt:

```
NODE_ENV=test
TZ=Europe/Berlin
DATABASE_URL=postgres://twincars:twincars@127.0.0.1:5432/twincars_test
APP_SECRET=test-secret-please-do-not-use-in-production-0000
APP_ENCRYPTION_KEY=test-encryption-key-0000000000000000000000
ORIGIN=http://localhost:3000
API_TOKENS=test-token-aaaaaaaaaaaaaaaa
EBAY_VERIFICATION_TOKEN=test-verification-token-aaaaaaaaaaaaaaaa
```

`TZ` ist Pflicht: mehrere Befunde (Slot-Berechnung, Verkaufsbuch-Grenzen)
hängen an der Zeitzone, und Tests, die das nicht festnageln, sind wertlos.

### 2.5 pnpm-Skripte

| Skript             | Inhalt                                                            |
| ------------------ | ----------------------------------------------------------------- |
| `test`             | alle Projekte nacheinander                                        |
| `test:unit`        | `vitest run --project unit`                                       |
| `test:nuxt`        | `vitest run --project nuxt`                                       |
| `test:integration` | `vitest run --project integration`                                |
| `test:browser`     | `vitest run --project browser`                                    |
| `test:e2e`         | `playwright test`                                                 |
| `test:watch`       | `vitest --project unit --project nuxt`                            |
| `test:cov`         | `vitest run --coverage`                                           |
| `test:cov:update`  | `vitest run --coverage --update` mit `thresholds.autoUpdate` (§7) |
| `test:befunde`     | Abgleich Regressionstests ↔ [02-befunde.md](02-befunde.md) (§6)   |
| `test:ci`          | `lint` + `typecheck` + alle Projekte + `docs:check`               |

---

## 3. Testdatenbank

**Echtes PostgreSQL, keine Simulation.** `pg-mem` entfällt ersatzlos
(B-575): Der Bestand musste Migrationen für die Simulation filtern und konnte
Transaktionen gar nicht testen — genau dort, wo die schwersten Befunde liegen.

Ablauf (`test/setup/database.ts`, `scripts/test-db.mjs`):

1. Einmal je Lauf: Datenbank `twincars_test_template` anlegen, **alle
   Migrationen ungefiltert anwenden**, `seedDefaults()` ausführen.
2. Je Vitest-Worker: `CREATE DATABASE twincars_test_w<n> TEMPLATE twincars_test_template`.
   Das ist in Postgres ein Dateikopie-Vorgang und dauert Millisekunden.
3. Jede Testdatei bekommt eine frische Verbindung; jeder Test läuft in einer
   Transaktion, die am Ende zurückgerollt wird — außer Tests, die selbst
   Transaktionsgrenzen prüfen; die räumen explizit auf.
4. Am Ende werden die Worker-Datenbanken verworfen.

In CI liefert ein `postgres:18`-Service-Container dieselbe Umgebung. Lokal
genügt das vorhandene PostgreSQL; `pnpm test:db:reset` stellt den Ausgangsstand
her.

Für E2E bleibt es beim bewährten Verfahren: ein anonymisierter Dump als
Fixture, vor dem Lauf eingespielt.

---

## 4. Die Ebenen im Einzelnen

### 4.1 Unit (`test/unit/`, Node)

Keine Nuxt-Auto-Imports, keine DOM-Abhängigkeit. Geprüft wird:

- **Valibot-Schemata** — für jedes Schema: ein gültiger Fall, **jeder**
  Grenzfall (Minimum, Maximum, genau darüber, leer, Whitespace) und **jeder**
  Ablehnungsfall mit der **erwarteten deutschen Meldung**. Das ist Pflicht aus
  Vorgabe A und die mit Abstand wertvollste Testmasse, weil die Schemata die
  gesamte Eingabefläche definieren.
- **Geld und Rundung** — `roundMoney`, Netto/Brutto, gemischte Steuersätze,
  Rabatte, Summen (Befunde B-027, B-338).
- **Nummernkreise** — Format, Jahreswechsel, Lückenfreiheit.
- **Feiertage** — alle 16 Bundesländer, Osterformel, Schaltjahre, Jahre weit
  außerhalb des Üblichen.
- **Arbeitstage, Soll-Stunden, Urlaubsberechnung**, Slot-Berechnung.
- **Import-Mapping** — Datumsformate, Kodierung, Beträge, Kennzeichen.
- **Reine Hilfsfunktionen** — Labels, Formatierung, Pagination-Fenster,
  Query-Bau (Filter → SQL-Bedingung, ohne Datenbank).

### 4.2 Nuxt-Runtime (`test/nuxt/`)

Jede eigene Komponente wird über `mountSuspended` bzw. `renderSuspended`
geprüft — **Props, Events, Slots, Leerzustand, Ladezustand, Fehlerzustand,
Berechtigungsvarianten**.

```ts
import {
  mountSuspended,
  mockNuxtImport,
  registerEndpoint,
  mockComponent
} from '@nuxt/test-utils/runtime'

registerEndpoint('/api/customers', () => ({
  items: [],
  total: 0,
  page: 1,
  size: 25,
  pageCount: 0
}))
mockNuxtImport('usePermissions', () => () => ({ can: () => true }))
```

Pflichtfälle je Komponente:

| Fall                    | Erwartung                                                   |
| ----------------------- | ----------------------------------------------------------- |
| Leerzustand             | `EmptyState` mit modulspezifischem Text und Primäraktion    |
| Ladezustand             | keine leere Tabelle, vorheriger Inhalt bleibt stehen        |
| Fehlerzustand           | deutsche Meldung, Wiederholen-Aktion, kein technischer Text |
| ohne Berechtigung       | Aktion nicht vorhanden (nicht nur deaktiviert)              |
| Mutation erfolgreich    | Erfolgs-Toast mit erwartetem Text                           |
| Mutation fehlgeschlagen | Fehler-Toast, Formular bleibt ausgefüllt                    |

Zusätzlich je Seite: ein Test, der die Seite mit `registerEndpoint`-Attrappen
rendert und prüft, dass die im Inventar dokumentierten Felder erscheinen.

### 4.3 Browser (`test/browser/`, Vitest Browser Mode)

Gerendert wird mit `render()` aus **`@nuxt/test-utils/browser`** (liefert
`container`, `locator`, `setupState`, `emitted()`, `rerender()`, `unmount()`),
gefahren von echtem Chromium.

Für alles, was echtes Browserverhalten braucht und in happy-dom nicht
belastbar ist:

- **Fokusfalle** in `UModal` — Tab läuft im Dialog um, Escape schließt, der
  Fokus kehrt auf den auslösenden Button zurück (im Bestand bei mehreren
  Dialogen nicht gegeben, B-104 ff.).
- **Tastaturbedienung** der Picker: Tippen, Pfeiltasten, Enter, Escape.
- **Globale Suche**: Tastenkürzel, Ergebnisnavigation, Schließen.
- **Kanban**: Ziehen und Ablegen, Tastaturalternative.
- **Stale-while-revalidate**: Beim Seitenwechsel ist zu keinem Zeitpunkt eine
  leere Tabelle sichtbar.
- **`prefers-reduced-motion`**: mit gesetzter Einstellung laufen keine
  Übergänge (Dauer 0).
- **Overlay-/Scroll-Verhalten**: Hintergrund scrollt nicht, wenn ein Dialog
  offen ist.

### 4.4 Integration (`test/integration/`)

**Jeder** Endpoint gegen die echte Test-Datenbank. Für jeden Endpoint
mindestens:

1. **Erfolgsfall** — erwarteter Statuscode, erwartete Antwortform.
2. **Validierung** — fehlendes Pflichtfeld, falscher Typ, zu langer Wert,
   ungültige UUID → 422 mit erwartetem Feldfehler auf Deutsch.
3. **Autorisierung** — ohne Sitzung 401; mit Sitzung ohne Modulrecht 403;
   mit Recht 200. Der Verweigerungsfall ist **nicht optional**.
4. **Fehlercodes** — 404 für unbekannte Id, 409 für Konflikte
   (z. B. zweite aktive Rechnung zu einem Auftrag).
5. **Pagination** — `page=1`, letzte Seite, Seite jenseits des Endes,
   `page=0`/negativ → 422 statt 500 (Befundklasse B-181), `size` nicht
   beeinflussbar.
6. **Transaktionsgrenzen** — ein erzwungener Fehler im zweiten Schritt darf
   keine Reste hinterlassen (Nummernvergabe, Beleg + Positionen, Storno,
   Auftragsabschluss).

Anmeldung im Test über einen Helfer, der gegen den echten Auth-Endpoint
anmeldet und das Sitzungs-Cookie weiterreicht — keine Attrappe, damit die
Guard-Kette mitgeprüft wird.

### 4.5 End-to-End (`test/e2e/`, Playwright)

Die Golden Flows aus [04-ux.md](04-ux.md) §9, jeweils durchgängig vom Login
bis zum Ergebnis. Grundlage ist der Nuxt-Runner:

```ts
import { test, expect } from '@nuxt/test-utils/playwright'

test('Rechnung aus Auftrag erzeugen und bezahlen', async ({ page, goto }) => {
  await goto('/orders', { waitUntil: 'hydration' })
  …
})
```

- `playwright.config.ts` setzt `use.nuxt.rootDir`; gewartet wird auf
  `hydration`, **nie** auf feste Zeiten.
- `setup({ browser: true })` für programmatische Fälle; die `host`-Option
  erlaubt Läufe gegen einen bereits gestarteten Server, was in CI Zeit spart.
- Aufräumen GoBD-konform: erzeugte Rechnungen werden bezahlt gesetzt oder
  storniert, erzeugte Kunden archiviert — nie gelöscht.

### 4.6 Querschnittstests über alle Schemata und Endpoints

Diese Tests haben keinen fachlichen Gegenstand, sondern sichern die Regeln aus
[03-architektur.md](03-architektur.md) mechanisch ab. Sie sind der Grund, warum
die Regeln nicht schleichend verfallen:

| Test                       | Prüft                                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `schemas-german-messages`  | Jeder Pipe-Schritt jedes Schemas trägt eine Meldung, und keine Meldung ist Valibots englischer Default                                  |
| `schemas-have-labels`      | Jeder Feldschlüssel aller Schemata hat ein deutsches Label in `field-labels.ts`                                                         |
| `schemas-derive-types`     | In `shared/schemas/**` existiert kein Typ, der nicht aus einem Schema abgeleitet ist                                                    |
| `endpoints-have-guard`     | Jede Datei unter `server/api/**` beginnt mit einem Guard — außer der dokumentierten Ausnahmeliste                                       |
| `endpoints-validate-input` | Jeder Endpoint, der Body/Query/Params liest, tut das über `useValidated*`                                                               |
| `endpoints-are-documented` | Jeder Endpoint hat eine Seite unter `docs/api/`                                                                                         |
| `features-are-documented`  | Jede Feature-ID hat eine Seite unter `docs/features/`                                                                                   |
| `schema-drift`             | `drizzle-valibot` gegen die handgeschriebenen Schemata: keine Tabellenspalte ohne Entsprechung, keine `maxLength` größer als die Spalte |
| `no-style-blocks`          | Keine `<style>`-Blöcke, genau eine CSS-Datei                                                                                            |
| `testids-unique`           | Keine doppelten `data-testid` innerhalb einer Seite                                                                                     |

---

## 5. Testdaten

- **Factories statt Objektliteralen.** `test/factories/` liefert
  `makeCustomer()`, `makeVehicle()`, `makeInvoice()` usw. mit sinnvollen
  Vorgaben und gezielten Überschreibungen.
- Jede Factory erzeugt Daten, die **gegen das zugehörige Valibot-Schema
  geprüft** werden. Eine Factory, die ungültige Daten baut, fällt beim ersten
  Lauf auf, nicht erst im Test.
- Deutsche Realdaten-Muster: Umlaute, Kennzeichen, IBAN, Postleitzahlen,
  lange Firmennamen — genau die Fälle, an denen der Bestand Fehler zeigt.
- Keine zufälligen Werte ohne festen Startwert. Tests müssen reproduzierbar
  sein.

---

## 6. Regressionstests für Befunde (verbindlich)

**Jeder Befund aus [02-befunde.md](02-befunde.md) mit der Einordnung „im
Rewrite beheben" bekommt genau einen Test, der ohne die Korrektur rot ist.**

- Der Testname beginnt mit der Befund-ID:
  `it('B-183: geleertes Feld wird als NULL gespeichert', …)`.
- Die Ebene richtet sich nach dem Befund: Schemafehler → `unit`,
  Autorisierungslücke → `integration`, Fokusfalle → `browser`,
  Flussfehler → `e2e`.
- `pnpm test:befunde` liest die Befundliste, sammelt alle Testnamen und meldet
  jede fehlende Befund-ID. Der Lauf ist Teil von `test:ci`. Ein Arbeitspaket
  gilt als unfertig, solange es einen Befund korrigiert, ohne ihn abzusichern.

Das ist die einzige Absicherung dagegen, dass eine Korrektur im weiteren
Verlauf des Rewrites wieder verloren geht.

---

## 7. Coverage

- Werkzeug: **`@vitest/coverage-v8`**, das Bordmittel. Kein zusätzliches
  Werkzeug, kein externer Dienst.
- Gemessen wird über alle Projekte hinweg in einen gemeinsamen Bericht.

**Startschwellen** (ab dem ersten fachlichen Paket verbindlich):

| Bereich              | Statements | Branches | Functions | Lines |
| -------------------- | ---------- | -------- | --------- | ----- |
| global               | 80         | 75       | 80        | 80    |
| `shared/schemas/**`  | 100        | 95       | 100       | 100   |
| `server/services/**` | 90         | 85       | 90        | 90    |
| `server/api/**`      | 90         | 85       | 90        | 90    |
| `app/composables/**` | 85         | 80       | 85        | 85    |

- **Schwellwerte dürfen nur steigen, nie sinken.** Wer sie senkt, hat das
  Paket nicht fertig. `pnpm test:cov:update` schreibt erreichte Werte nach
  oben fort (`thresholds.autoUpdate`); die Änderung wird mitcommittet. In CI
  ist das Fortschreiben **aus**, dort gelten die committeten Werte.
- **Begründete Ausnahmen** (aus der Messung genommen): generierter Code
  (`.nuxt/`, `.output/`), Konfigurationsdateien, Migrationen
  (`server/database/migrations/**` — sie werden durch die Integrationstests
  vollständig ausgeführt, aber Zeilenabdeckung ist dort bedeutungslos),
  `test/**`, Typdeklarationen, `scripts/**` (durch eigene Rauchtests
  abgedeckt).
- Coverage ist ein Frühwarnzeichen, kein Ziel. Ein Endpoint ohne
  Verweigerungstest ist unfertig, auch wenn die Zahl grün ist.

---

## 8. Selektoren

- **Nur `data-testid` oder Rolle plus zugänglicher Name.**
- **Niemals** interne Klassen oder die DOM-Struktur von Nuxt UI — das bricht
  beim nächsten Update.
- Konvention: `<bereich>-<gegenstand>[-<zustand>]`, kebab-case, englisch.
  Beispiele: `customer-list-row`, `customer-form-submit`,
  `confirm-dialog-accept`, `picker-search-input`, `pagination-next`.
- Die Konvention gilt **ab Paket eins**. Jede eigene Komponente reicht
  `data-testid` durch, damit aufrufende Seiten eigene Kennungen vergeben können.
- Wo eine Rolle mit zugänglichem Namen eindeutig ist
  (`getByRole('button', { name: 'Speichern' })`), ist sie vorzuziehen — sie
  prüft die Zugänglichkeit gleich mit.

---

## 9. Was nicht getestet wird

Bewusst ausgeklammert, damit die Suite schnell und aussagekräftig bleibt:

- Nuxt UI selbst und andere Fremdbibliotheken.
- Pixelgenaues Aussehen — **Ausnahme**: die PDF-Renderer, die eine
  Pixel-Regressionssuite gegen committete Vergleichsbilder behalten, weil dort
  Layoutfehler direkt beim Kunden landen.
- Der echte SMTP-Versand. Geprüft wird an der nodemailer-Grenze (Attrappe für
  `sendMail`, Prüfung der übergebenen Optionen) plus ein manueller Durchlauf
  gegen den lokalen Mail-Catcher.
- Die echte eBay-API. Geprüft werden die Antwort-Schemata gegen aufgezeichnete
  Antworten sowie der Challenge-Handshake.

---

## 10. Definition of Done (Testanteil)

Ein Arbeitspaket ist **nur dann** fertig, wenn:

1. jede Feature-ID des Pakets mindestens einen Test hat, der ihr dokumentiertes
   Verhalten prüft;
2. jeder Endpoint des Pakets Erfolg, Validierungsfehler und
   Berechtigungsverweigerung geprüft hat;
3. jeder im Paket behobene Befund einen Regressionstest mit Befund-ID trägt;
4. jede neue Komponente Leer-, Lade- und Fehlerzustand geprüft hat;
5. `pnpm lint`, `pnpm typecheck`, alle Testprojekte und `pnpm docs:check`
   grün sind;
6. die Coverage-Schwellen gehalten oder angehoben wurden.

**Tests werden nie entschärft, übersprungen oder auf später verschoben, damit
ein Paket als fertig gilt.** Wenn ein Test nicht schreibbar ist, ist das ein
Blocker nach `docs/rewrite/blocker.md`, kein Grund zum Weglassen.
