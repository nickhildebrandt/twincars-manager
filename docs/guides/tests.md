---
title: Tests schreiben und ausführen
kategorie: guide
status: umgesetzt
updated: 2026-09-13
---

# Tests schreiben und ausführen

Die verbindlichen Regeln stehen in
[../rewrite/05-teststrategie.md](../rewrite/05-teststrategie.md). Diese Seite
sagt, wie man sie im Alltag anwendet.

## Die fünf Projekte

| Projekt       | Ort                                                    | Umgebung                | Wofür                                            |
| ------------- | ------------------------------------------------------ | ----------------------- | ------------------------------------------------ |
| `unit`        | `test/unit/`, außerdem `*.test.ts` neben dem Quelltext | Node                    | reine Funktionen, Valibot-Schemata, Berechnungen |
| `nuxt`        | `test/nuxt/`                                           | Nuxt-Runtime, happy-dom | Komponenten, Composables, Seiten                 |
| `browser`     | `test/browser/`                                        | echtes Chromium         | Fokus, Tastatur, Overlays, Bewegungsreduktion    |
| `integration` | `test/integration/`                                    | Node + PostgreSQL       | Endpoints, Rechte, Transaktionen                 |
| `e2e`         | `test/e2e/`                                            | Produktionsbau          | durchgängige Abläufe                             |

**`@nuxt/test-utils/runtime` und `@nuxt/test-utils/e2e` dürfen nie in derselben
Datei stehen.** Die Projekttrennung setzt das baulich durch.

## Befehle

```bash
pnpm test              # alle Vitest-Projekte
pnpm test:unit         # einzeln
pnpm test:nuxt
pnpm test:integration  # braucht PostgreSQL
pnpm test:browser      # braucht ein zwischengespeichertes Chromium
pnpm test:e2e          # Playwright, baut die Anwendung
pnpm test:watch        # unit + nuxt im Beobachtungsmodus
pnpm test:cov          # Coverage samt Schwellwerten
pnpm test:cov:update   # erreichte Werte als neue Schwellen schreiben
pnpm test:befunde      # Regressionstest je behobenem Befund
pnpm test:db:reset     # Testdatenbanken neu aufbauen
pnpm test:db:status    # zeigt, was existiert
```

## Testdatenbank

Echtes PostgreSQL, keine Simulation. Der Ablauf:

1. Beim ersten Integrationstest entsteht die Vorlagendatenbank
   `twincars_test_template`, in die alle Migrationen laufen. Ein
   Postgres-Sperrobjekt sorgt dafür, dass parallele Worker sie nur einmal bauen.
2. Jeder Vitest-Worker bekommt daraus eine Kopie
   (`twincars_test_w1`, `…_w2`, …). Das Kopieren ist ein Dateikopiervorgang und
   dauert Millisekunden.
3. Die Worker-Datenbanken bleiben nach dem Lauf liegen, damit man einen Fehler
   nachsehen kann. `pnpm test:db:reset` räumt auf.

**Verbindung.** Lokal läuft es über den Unix-Socket, weil diese Rolle
Datenbanken anlegen darf:

```
DATABASE_URL=postgres:///twincars_test?host=/var/run/postgresql
```

In CI überschreibt die Umgebung den Wert mit der Verbindung zum
Dienst-Container. Der Test-Helfer übersetzt die `?host=`-Form selbst in
Verbindungsoptionen, weil der Postgres-Treiber sie in der URL nicht versteht.

Nach einer Schemaänderung: `pnpm test:db:reset`, sonst arbeitet die Vorlage mit
dem alten Stand weiter.

## Browser

Browser werden **nie** heruntergeladen. `test/setup/chromium.ts` sucht den
neuesten zwischengespeicherten Chromium-Build; `CHROMIUM_PATH` übersteuert das.
Verlangt eine Testausführung trotzdem einen Download, ist die Konfiguration
falsch, nicht die Umgebung.

## Selektoren

Nur `data-testid` oder Rolle mit zugänglichem Namen. **Niemals** interne
Klassen von Nuxt UI — die ändern sich beim nächsten Update.

```ts
page.getByTestId('customer-list-row')
page.getByRole('button', { name: 'Speichern' })
```

Konvention: `<bereich>-<gegenstand>[-<zustand>]`, kebab-case, englisch.

## Pflichtfälle

**Je Komponente:** Leerzustand, Ladezustand, Fehlerzustand,
Berechtigungsvariante, Erfolgs-Toast, Fehler-Toast.

**Je Endpoint:** Erfolg, Validierungsfehler (422 mit deutschem Feldfehler),
ohne Sitzung (401), ohne Recht (403), unbekannte Id (404), Pagination-Grenzen,
Transaktionsgrenze.

**Je Schema:** ein gültiger Fall, jeder Grenzfall, jeder Ablehnungsfall mit der
erwarteten deutschen Meldung.

## Regressionstests für Befunde

Jeder Befund aus [../rewrite/02-befunde.md](../rewrite/02-befunde.md) mit der
Einordnung „im Rewrite beheben" braucht einen Test, dessen Name mit der
Befund-ID beginnt:

```ts
it('B-183: geleertes Feld wird als NULL gespeichert', async () => { … })
```

`pnpm test:befunde` vergleicht die Liste mit allen Testnamen und meldet jede
Lücke. Geprüft werden nur Befunde, deren Arbeitspaket in
[../rewrite/fortschritt.md](../rewrite/fortschritt.md) als fertig steht;
`node scripts/check-befunde.mjs --all` zeigt den Gesamtstand.

## Coverage

Schwellwerte stehen in `vitest.config.ts`. **Sie dürfen nur steigen.**
`pnpm test:cov:update` schreibt erreichte Werte fort; die Änderung wird mit dem
Arbeitspaket committet. In CI ist das Fortschreiben aus.

Coverage ist ein Frühwarnzeichen, kein Ziel: ein Endpoint ohne
Verweigerungstest ist unfertig, auch wenn die Zahl grün ist.

## Zeitzone

Alle Tests laufen mit `TZ=Europe/Berlin`. Das Setup bricht ab, wenn die
Zeitzone abweicht — mehrere Fehler des Vorgängersystems hingen genau daran.
