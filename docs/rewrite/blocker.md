# Blocker und offene Werkzeugfragen

Dinge, die nicht aus der Anwendung kommen, sondern aus den Werkzeugen — und
die jemand irgendwann wieder entfernen sollte. Fachliche Entscheidungen stehen
in [08-entscheidungen.md](08-entscheidungen.md), fachliche Befunde in
[02-befunde.md](02-befunde.md).

Kein echter Blocker offen. Ein Werkzeugproblem ist umgangen:

---

## W-01 — Das Browser-Projekt scheitert bei kaltem Vite-Zwischenspeicher

**Gefunden:** 2026-09-13, Arbeitspaket T-007 · **Zustand:** umgangen, Ursache
liegt im Werkzeug

**Was passiert.** Ist `node_modules/.cache/vite` nicht vorhanden, scheitert das
Browser-Projekt, bevor ein einziger Test läuft:

```
Error: Failed to import test file test/setup/browser.ts
Caused by: Error: Vitest failed to find the runner.
  ❯ beforeEach .../deps/plugins.Cigb0uSy-D4Y62LXd.js?v=87a1bd18:4166:35
  ❯ .../@nuxt/test-utils/dist/browser/index.mjs?v=87a1bd18:9:1
  ❯ runSetupFiles .../deps/plugins.Cigb0uSy-D4Y62LXd.js?v=048a0cfb:5528:35
```

**Warum.** Die beiden `?v=`-Werte im Aufrufpfad sind verschieden. Vite
optimiert die Abhängigkeiten, entdeckt währenddessen eine weitere, optimiert
erneut und lädt die Seite neu. Die Aufbaudatei — `@nuxt/test-utils/browser`
meldet beim Laden ein `beforeEach` an — hält danach die **vorige** Ausgabe von
Vitest fest, in der kein Runner eingetragen ist. Der zweite Lauf gelingt immer,
weil der Zwischenspeicher dann vollständig ist.

**Reproduktion**

```bash
cd nuxt
rm -rf node_modules/.cache/vite
pnpm exec vitest run --project browser   # scheitert
pnpm exec vitest run --project browser   # gelingt
```

**Was nicht geholfen hat.** `optimizeDeps.exclude` für `@nuxt/test-utils`;
`optimizeDeps.include` derselben Pakete (der Browser verbindet sich dann gar
nicht mehr); `optimizeDeps.holdUntilCrawlEnd`;
`server.deps.inline`; die Aufbaudatei in eine eigene Quelldatei kapseln;
`--no-file-parallelism`.

**Wie es umgangen ist.** `pnpm test` ruft über `pretest`
`scripts/warm-vite-cache.mjs` auf. Das Skript lässt das Browser-Projekt
**einmal** vorlaufen, wenn der Zwischenspeicher fehlt **oder älter ist als**
`vitest.config.ts`, `nuxt.config.ts`, `package.json` oder `pnpm-lock.yaml` —
denn eine Konfigurationsänderung oder eine Installation verwirft ihn genauso
gründlich wie ein Löschen. Der eigentliche Lauf findet danach einen
vollständigen Zwischenspeicher; ist er bereits frisch, kostet die Prüfung
nichts.

**Wichtig:** Es wird kein Test übersprungen und keiner entschärft. Jeder Test
läuft danach und muss bestehen. Die Umgehung kostet beim ersten Lauf einer
frischen Arbeitskopie etwa vier Sekunden.

**Wann es weg kann.** Sobald Vitest oder `@nuxt/test-utils` den Neuladevorgang
behebt. Dann `pretest` aus `nuxt/package.json` und
`nuxt/scripts/warm-vite-cache.mjs` entfernen und die Reproduktion oben noch
einmal durchspielen.

**Betroffene Fassungen:** Vitest 5.0.0, `@vitest/browser-playwright` 5.0.0,
`@nuxt/test-utils` 4.3.2, Vite über Nuxt 4.5.2.

---

## W-02 — Die Segmente des Datumsfeldes heißen für den Screenreader englisch

**Stand:** 13.09.2026 · **Betrifft:** T-009 · **Schwere:** klein, nicht
umgangen

**Was passiert.** `UInputDate` (Nuxt UI 4.11.1 über Reka UI) baut ein Datum aus
drei Segmenten. Mit `:locale="de"` an `UApp` stimmen **Reihenfolge und
Trenner**: `01.03.2026`, Tag vor Monat, Punkt als Trenner. Die
`aria-label`-Werte der Segmente bleiben aber englisch — `day,`, `month,`,
`year,` — und die Vorlesehilfe eines Monats lautet `1 - January`.

**Warum es hier steht.** Die Oberfläche ist deutsch. Ein Screenreader liest an
dieser einen Stelle englisch vor.

**Warum es nicht umgangen wird.** Reka UI erzeugt diese Beschriftungen im
Inneren der Komponente; es gibt keine Eigenschaft dafür. Die einzigen Wege
wären, nach dem Rendern im DOM herumzuschreiben oder die Komponente
nachzubauen. Beides wäre schlimmer als der Mangel: Regel 4 sagt Nuxt UI zuerst,
und ein nachgebautes Datumsfeld verliert Tastaturbedienung, Fokusführung und
Zeitzonenfestigkeit — also genau das, wofür die Komponente da ist.

**Was stattdessen abgesichert ist.** `test/nuxt/form-fields.test.ts` nagelt die
Reihenfolge Tag–Monat–Jahr und den Punkt als Trenner fest. Das ist der Teil,
an dem ein Fehler Daten verfälscht: `01/03/2026` und `01.03.2026` bezeichnen
zwei verschiedene Tage.

**Wann es weg kann.** Sobald Reka UI die Segmentbeschriftungen aus der
Sprachdatei nimmt. Dann die Zusage in `test/nuxt/form-fields.test.ts` um die
deutschen `aria-label`-Werte erweitern und diesen Eintrag streichen.

**Betroffene Fassungen:** Nuxt UI 4.11.1, Reka UI in der davon gezogenen
Fassung.
