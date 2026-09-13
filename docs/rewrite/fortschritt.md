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
