# 06 — Arbeitsplan

> Teil des Rewrite-Plans. Siehe [00-uebersicht.md](00-uebersicht.md) ·
> [01-inventar.md](01-inventar.md) · [02-befunde.md](02-befunde.md) ·
> [03-architektur.md](03-architektur.md) · [04-ux.md](04-ux.md) ·
> [05-teststrategie.md](05-teststrategie.md) · [07-ausfuehrung.md](07-ausfuehrung.md) ·
> **[06-abdeckung.md](06-abdeckung.md) — die vollständige Zuordnung jeder
> Feature-ID zu einem Arbeitspaket**

42 Arbeitspakete in drei Phasen. Jedes ist so geschnitten, dass es in einer
Sitzung erledigt werden kann, und hat maschinell oder durch einen Testlauf
prüfbare Akzeptanzkriterien.

## Definition of Done — gilt für **jedes** Paket

Ein Paket ist fertig, wenn **alle** Punkte zutreffen:

1. `pnpm lint` ohne Befund (ESLint formatiert mit).
2. `pnpm typecheck` ohne Fehler.
3. Alle betroffenen Testprojekte grün; Coverage-Schwellen gehalten oder
   angehoben ([05-teststrategie.md](05-teststrategie.md) §7).
4. Für **jede** Feature-ID des Pakets ein Test, der ihr im Inventar
   dokumentiertes Verhalten prüft.
5. Für **jeden** Endpoint: Erfolgsfall, Validierungsfehler und
   Berechtigungsverweigerung geprüft.
6. Für **jeden** behobenen Befund ein Regressionstest mit der Befund-ID im
   Namen; `pnpm test:befunde` meldet keine Lücke.
7. **Valibot-Schemata** für alle neuen Ein- und Ausgaben liegen in
   `shared/schemas/`, Typen sind abgeleitet, Feldlabels ergänzt.
8. **Dokumentation aktualisiert**: Feature-Seiten, API-Einträge,
   Komponentenseiten, betroffene Architektur-/Daten-/Anleitungsseiten,
   `docs/index.md` verlinkt. `pnpm docs:check` läuft durch.
9. Der Ablauf wurde **einmal im Browser** durchgespielt (Leer-, Lade-,
   Fehler-, Erfolgs- und Verweigerungszustand).
10. Ein Commit nach Conventional Commits, ein Eintrag in
    `docs/rewrite/fortschritt.md`.

Nicht erreichbare Kriterien werden **nicht** umdefiniert, sondern als Blocker
in `docs/rewrite/blocker.md` dokumentiert ([07-ausfuehrung.md](07-ausfuehrung.md) §6).

---

# Phase 0 — Fundament (T-001 … T-009)

Diese neun Pakete legen fest, wie alles Weitere aussieht. Sie enthalten wenig
Fachlichkeit, aber jede spätere Zeile hängt an ihnen.

## T-001 — Projektgerüst und Toolchain

**Features:** F-052, F-447 (2) · **Befunde:** –
**Vorbedingungen:** keine.

**Zu erstellen**

```
nuxt/package.json            nuxt/pnpm-workspace.yaml   nuxt/nuxt.config.ts
nuxt/tsconfig.json           nuxt/eslint.config.mjs     nuxt/app/app.vue
nuxt/app/app.config.ts       nuxt/app/assets/css/main.css
nuxt/app/layouts/default.vue nuxt/app/pages/index.vue   nuxt/.env.example
nuxt/CLAUDE.md               nuxt/README.md             nuxt/.gitignore
.husky/commit-msg            commitlint.config.mjs      .releaserc.json
.github/workflows/ci.yml     .github/workflows/release.yml
```

**Inhalt**

- Nuxt 4.5 mit `@nuxt/ui`, `@nuxt/eslint`, `@nuxt/test-utils/module`.
- `app/assets/css/main.css` mit genau `@import "tailwindcss";` und
  `@import "@nuxt/ui";` — die einzige CSS-Datei des Projekts.
- `app.vue` umschließt alles mit `<UApp :locale="de">`.
- `app.config.ts` legt die Farbpalette fest (ein Akzent, neutrale Grautöne)
  und die Vorgaben je Komponente (flache Karten mit Rahmen, keine Schatten).
- ESLint mit `stylistic: true` und `formatters: true`. **Prettier taucht
  nirgends auf.** Eigene Regeln: keine `<style>`-Blöcke, keine leeren
  Catch-Blöcke, kein direktes `process.env`, kein `readBody`/`getQuery`
  außerhalb der Validierungshelfer.
- `package.json` mit allen Skripten aus [07-ausfuehrung.md](07-ausfuehrung.md) §4
  (die Testskripte dürfen zunächst leer laufen, T-002 füllt sie).
- Husky: `pre-commit` → `lint-staged` (`eslint --fix`), `commit-msg` →
  `commitlint`, `pre-push` → `pnpm test:unit`.
- semantic-release mit Preset `conventionalcommits`, Zweig `main`, ohne
  npm-Veröffentlichung.
- GitHub Actions: ein Workflow für Prüfungen, einer für die Freigabe.
- `nuxt/CLAUDE.md` nach dem Entwurf in [07-ausfuehrung.md](07-ausfuehrung.md) §9.

**Akzeptanzkriterien**

| #   | Kriterium                                                               | Prüfung                                                                                                |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Abhängigkeiten installieren sich reproduzierbar                         | `pnpm install --frozen-lockfile`                                                                       |
| 2   | Entwicklungsserver startet und zeigt eine Seite mit Nuxt-UI-Komponenten | `pnpm dev`, Seite aufrufen                                                                             |
| 3   | Produktionsbau gelingt                                                  | `pnpm build`                                                                                           |
| 4   | Lint läuft und formatiert                                               | `pnpm lint` ohne Befund; eine absichtlich falsch formatierte Datei wird von `pnpm lint:fix` korrigiert |
| 5   | Typprüfung läuft                                                        | `pnpm typecheck`                                                                                       |
| 6   | Kein Prettier im Baum                                                   | `grep -ri prettier nuxt/package.json nuxt/*.mjs` findet nichts                                         |
| 7   | Genau eine CSS-Datei                                                    | `find nuxt -name '*.css' -not -path '*/node_modules/*'` liefert eine Datei                             |
| 8   | Ein Commit mit falscher Nachricht wird abgewiesen                       | `git commit -m "kaputt"` schlägt fehl                                                                  |
| 9   | CI-Workflow ist syntaktisch gültig                                      | Actions-Lauf auf dem Zweig                                                                             |

**Tests:** Rauchtest, der `nuxt.config.ts` lädt und die Modulliste prüft;
Test, der die Existenz genau einer CSS-Datei und das Fehlen von
`<style>`-Blöcken sicherstellt (wächst später mit).

**Doku:** `docs/index.md` (Gerüst), `docs/guides/entwicklungsumgebung.md`,
`docs/decisions/` für ESLint-statt-Prettier und für die Paketwahl.

---

## T-002 — Teststack und Testdatenbank

**Features:** – (0) · **Befunde:** –
**Vorbedingungen:** T-001.

**Zu erstellen**

```
nuxt/vitest.config.ts            nuxt/playwright.config.ts
nuxt/test/setup/nuxt.ts          nuxt/test/setup/database.ts
nuxt/test/setup/db-per-worker.ts nuxt/test/factories/index.ts
nuxt/scripts/test-db.mjs         nuxt/.env.test
nuxt/test/unit/smoke.test.ts     nuxt/test/nuxt/smoke.test.ts
nuxt/test/integration/smoke.test.ts nuxt/test/browser/smoke.test.ts
nuxt/test/e2e/smoke.test.ts      nuxt/scripts/check-befunde.mjs
```

**Inhalt**

- Vitest-Projekte `unit`, `nuxt`, `browser`, `integration`, `e2e` genau nach
  [05-teststrategie.md](05-teststrategie.md) §2.3. `coverage`, `reporters` und
  `globalSetup` **im Root**, nicht im Projekt.
- Testdatenbank: Vorlagendatenbank anlegen, migrieren, je Worker eine Kopie
  (§3 dort). `pnpm test:db:reset`.
- Coverage-Schwellen und Ausnahmen eintragen.
- `pnpm test:befunde` liest [02-befunde.md](02-befunde.md), sammelt alle
  Testnamen und meldet jede Befund-ID ohne Regressionstest.
- Playwright mit dem Nuxt-Runner, `waitUntil: 'hydration'`, zwischengespeichertes
  Chromium.

**Akzeptanzkriterien**

| #   | Kriterium                                                                | Prüfung                                                            |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1   | Jedes Projekt läuft einzeln                                              | `pnpm test:unit`, `:nuxt`, `:integration`, `:browser`, `:e2e`      |
| 2   | Nuxt-Projekt kann eine Komponente mounten                                | Rauchtest mit `mountSuspended`                                     |
| 3   | Browser-Projekt startet Chromium **ohne Download**                       | Lauf mit gesetztem `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`            |
| 4   | Integrationstest erreicht eine echte Datenbank und sieht die Migrationen | Rauchtest fragt `information_schema` ab                            |
| 5   | Zwei Integrationsdateien laufen parallel ohne sich zu stören             | zwei Dateien schreiben dieselbe Tabelle                            |
| 6   | Coverage-Bericht entsteht, Schwellen greifen                             | `pnpm test:cov` mit absichtlich zu niedriger Schwelle schlägt fehl |
| 7   | `pnpm test:befunde` erkennt eine fehlende Befund-ID                      | absichtlich einen Test umbenennen                                  |

**Doku:** `docs/guides/tests.md` (wie schreibe ich welchen Test, wo liegt was,
wie läuft die Testdatenbank).

---

## T-003 — Dokumentationsgerüst

**Features:** – (0) · **Befunde:** –
**Vorbedingungen:** T-001.

**Zu erstellen**

```
docs/index.md
docs/_templates/feature.md  api.md  component.md  decision.md  guide.md
docs/features/README.md  docs/api/README.md  docs/data/README.md
docs/ui/README.md        docs/architecture/README.md  docs/guides/README.md
nuxt/scripts/docs-check.mjs  nuxt/scripts/docs-api.mjs  nuxt/scripts/docs-data.mjs
```

**Inhalt**

- `docs/index.md` als Einstieg: jede Kategorie, jede wichtige Seite, die alten
  Bestandsseiten als „Bestand (alt)" gekennzeichnet. Alles in höchstens zwei
  Klicks erreichbar.
- Einheitliches Frontmatter je Kategorie. Für Features:

  ```yaml
  ---
  id: F-001
  title: Auth-Gate für alle nicht-öffentlichen Routen
  status: geplant | umgesetzt | blockiert
  modul: shell
  permission: '-'
  routes: []
  endpoints: []
  tables: []
  schemas: []
  tests: []
  updated: 2026-09-12
  ---
  ```

- `pnpm docs:check` bricht ab bei: Feature-ID ohne Seite, Endpoint ohne
  Eintrag, fehlendem Frontmatter-Feld, totem relativen Link, Seite ohne
  `updated`.
- `pnpm docs:api` erzeugt `docs/api/` aus den Dateien unter `server/api/**`
  und den referenzierten Valibot-Schemata; `pnpm docs:data` erzeugt
  `docs/data/tabellen.md` aus dem Drizzle-Schema.
- **Alle 631 Feature-Seiten werden angelegt** — zunächst als Rumpf
  mit `status: geplant`, Titel und Verweis auf die Inventarzeile. Damit ist die
  Abdeckungsprüfung ab sofort scharf, und jedes Paket füllt nur noch seine
  Seiten aus.

**Akzeptanzkriterien**

| #   | Kriterium                                               | Prüfung                           |
| --- | ------------------------------------------------------- | --------------------------------- |
| 1   | Für jede Feature-ID existiert eine Seite                | `pnpm docs:check`                 |
| 2   | Eine gelöschte Seite lässt die Prüfung fehlschlagen     | Probe                             |
| 3   | Ein toter relativer Link lässt die Prüfung fehlschlagen | Probe                             |
| 4   | `docs/index.md` erreicht jede Kategorie in einem Klick  | manuelle Sicht + Linkprüfung      |
| 5   | Erzeugte Seiten sind reproduzierbar                     | zweimal erzeugen, `git diff` leer |

**Doku:** `docs/guides/dokumentation.md` — wie Seiten entstehen, welche
Vorlage wann.

---

## T-004 — Valibot-Fundament und Fehler-Trichter

**Features:** F-007–F-008, F-044, F-444, F-526 (5) · **Befunde:** B-012, B-022, B-042, B-044, B-363
**Vorbedingungen:** T-001, T-002.

**Zu erstellen**

```
nuxt/shared/schemas/primitives.ts  pagination.ts  env.ts  upload.ts  field-labels.ts
nuxt/server/utils/validate.ts      nuxt/server/utils/errors.ts
nuxt/server/plugins/00.env.ts      nuxt/server/plugins/10.error.ts
nuxt/app/composables/useApi.ts     nuxt/app/composables/useNotify.ts
nuxt/app/error.vue
```

**Inhalt**

- Deutsche Standardmeldungen global: `@valibot/i18n/de` +
  `setGlobalConfig({ lang: 'de' })`.
- **Primitives** als Port der alten `validation.ts`: Name, E-Mail, Telefon,
  IBAN, BIC, PLZ, Ort, Geldbetrag, Prozent, Datum, Uhrzeit, Kennzeichen, FIN,
  HSN, TSN, Notiz, UUID, Suchbegriff. Jede mit Grenzwerten, die zu den
  Datenbankspalten passen.
- `listQuerySchema`: `page ≥ 1`, `size` fest 25, Suchbegriff ≤ 200 Zeichen,
  Sortierung als Auswahlliste. Behebt die ganze Klasse „negative Seite → 500".
- `useValidatedBody` / `useValidatedQuery` / `useValidatedParams` /
  `useValidatedHeader` — der **einzige** Weg, Eingaben zu lesen.
- Fehler-Helfer nach [03-architektur.md](03-architektur.md) §5.4 mit
  einheitlichem Format und `data.fields` bei 422.
- Umgebungsvariablen werden beim Start geprüft; fehlt etwas, startet die
  Anwendung nicht.
- `useApi()` im Client: 401 → Anmeldung, 422 → Feldfehler ans Formular,
  sonst Fehler-Toast; Original nur in die Konsole.
- `useNotify()` mit den Farben und Dauern aus [04-ux.md](04-ux.md) §3.1.

**Akzeptanzkriterien**

| #   | Kriterium                                                                        | Prüfung                                |
| --- | -------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | Jedes Primitive hat Tests für gültig, Grenzwert, ungültig samt deutscher Meldung | `pnpm test:unit`                       |
| 2   | Ein Endpoint mit ungültigem Body liefert 422 mit deutschem Feldfehler            | Integrationstest                       |
| 3   | `page=0` liefert 422, nicht 500                                                  | Integrationstest                       |
| 4   | Ein Serverfehler liefert dem Client **keinen** internen Text                     | Integrationstest                       |
| 5   | Fehlende Pflicht-Umgebungsvariable verhindert den Start mit klarer Meldung       | Test startet Nitro mit leerer Umgebung |
| 6   | Jeder Feldschlüssel hat ein deutsches Label                                      | Querschnittstest                       |
| 7   | Keine englische Standardmeldung erreicht den Nutzer                              | Querschnittstest über alle Schemata    |

**Doku:** `docs/architecture/validierung.md`,
`docs/architecture/fehlerbehandlung.md`, `docs/guides/schemata.md`.

---

## T-005 — Datenbankschema, Baseline-Migration, Seeds

**Features:** F-006, F-070, F-153–F-159, F-480 (10) · **Befunde:** B-015, B-079, B-137, B-139–B-140, B-411, B-560–B-565, B-567–B-568, B-570–B-571, B-574–B-575, B-577–B-579, B-582–B-589, B-594
**Vorbedingungen:** T-002, T-004.
**Modelländerungen:** M-01, M-05, M-06, M-08, M-10, M-11, M-15, M-17, M-19, M-22, M-25, M-29, M-33, M-34 ([09-modellaenderungen.md](09-modellaenderungen.md))

**Zu erstellen**

```
nuxt/server/database/schema/*.ts        (je Domäne eine Datei)
nuxt/server/database/migrations/0000_baseline.sql
nuxt/server/database/migrations/0001_cleanup_*.sql
nuxt/server/database/seed/index.ts
nuxt/drizzle.config.ts  nuxt/scripts/migrate.mjs  nuxt/scripts/seed.mjs
nuxt/test/unit/schema-drift.test.ts
```

**Inhalt**

- Portierung aller Tabellen nach [`inventar/datamodel.md`](inventar/datamodel.md),
  aufgeteilt nach Domänen statt einer Riesendatei.
- Baseline aus der Produktionsdatenbank ziehen (E-02), danach die
  Bereinigungen aus [03-architektur.md](03-architektur.md) §7.1 als eigene,
  idempotente Migrationen: Enums/CHECKs, fehlende Indizes, fehlende Uniques,
  fehlende Fremdschlüssel, tote Tabellen und Spalten entfernen, `$onUpdate`,
  `ON DELETE RESTRICT` für GoBD-Kindtabellen, Zeittypen.
- Seeds idempotent, als Startaufgabe **nach** der Migration — nicht im ersten
  Request.
- Drift-Test über `getTableColumns()`.

**Akzeptanzkriterien**

| #   | Kriterium                                                       | Prüfung                                     |
| --- | --------------------------------------------------------------- | ------------------------------------------- |
| 1   | Migrationen laufen auf einer leeren Datenbank vollständig durch | `pnpm db:migrate` gegen frische DB          |
| 2   | Migrationen sind wiederholbar                                   | zweiter Lauf ändert nichts, bricht nicht ab |
| 3   | Seeds sind idempotent                                           | zweimal ausführen, Zeilenzahlen gleich      |
| 4   | Drift-Test grün                                                 | `pnpm test:unit`                            |
| 5   | Jede Fremdschlüsselspalte hat einen Index                       | Test fragt `pg_indexes` ab                  |
| 6   | Jeder Statusdiskriminator ist durch Enum oder CHECK abgesichert | Test fragt den Katalog ab                   |
| 7   | Kein Schema-`maxLength` übersteigt die Spaltenbreite            | Drift-Test                                  |

**Doku:** `docs/data/` vollständig (Tabellenkatalog erzeugt,
Relationsdiagramm, Migrationsstrategie), `docs/decisions/` für die Baseline.

---

## T-006 — Server-Grundgerüst und Infrastruktur-Helfer

**Features:** F-045–F-046, F-048–F-049, F-053, F-170–F-171, F-406, F-411 (9) · **Befunde:** B-011, B-018, B-026, B-028, B-304, B-335
**Vorbedingungen:** T-004, T-005.
**Modelländerungen:** M-14, P-02 ([09-modellaenderungen.md](09-modellaenderungen.md))

**Zu erstellen**

```
nuxt/server/utils/db.ts        (Verbindung, withTransaction)
nuxt/server/utils/guards.ts    nuxt/server/utils/pagination.ts
nuxt/server/utils/crypto.ts    nuxt/server/utils/money.ts
nuxt/server/utils/numbering.ts nuxt/server/utils/rate-limit.ts
nuxt/server/utils/status-labels.ts  nuxt/server/utils/payment-methods.ts
nuxt/server/tasks/_registry.ts nuxt/server/api/health.get.ts
```

**Inhalt**

- Drizzle-Verbindung und `withTransaction`.
- Guards (`requireUser`, `requirePermission`, `requireAnyPermission`) —
  Umsetzung folgt in T-007, die Signaturen entstehen hier.
- Listenhelfer, der aus `listQuerySchema` `LIMIT`/`OFFSET`/`ORDER BY` baut und
  immer `{ items, total, page, size, pageCount }` zurückgibt.
- Geldrechnung auf Cent-Ganzzahlen im Kern (E-10), Umrechnung an der
  Datenbankgrenze; Rundung kaufmännisch, mit Tests gegen die bekannten
  Gleitkomma-Fälle.
- Nummernkreise atomar **in einer Transaktion**, ohne Lücken bei Fehlern.
- Verschlüsselung für Geheimnisse in der Datenbank, Format wie im Bestand.
- Aufgabenregister für wiederkehrende Arbeit (§9.4 der Architektur).
- Gesundheitsendpunkt für den Container.

**Akzeptanzkriterien**

| #   | Kriterium                                                                                      | Prüfung          |
| --- | ---------------------------------------------------------------------------------------------- | ---------------- |
| 1   | Ein Fehler mitten in einer Transaktion hinterlässt keine Reste                                 | Integrationstest |
| 2   | Nummernvergabe unter zehn gleichzeitigen Aufrufen ergibt zehn verschiedene, lückenlose Nummern | Integrationstest |
| 3   | Geldrechnung liefert für die bekannten Problemfälle exakte Werte                               | Unit-Test        |
| 4   | Verschlüsseln und Entschlüsseln ist rundlauffähig, alte Klartextwerte werden durchgereicht     | Unit-Test        |
| 5   | Der Listenhelfer begrenzt zuverlässig auf 25                                                   | Integrationstest |
| 6   | `/api/health` antwortet ohne Sitzung mit 200                                                   | Integrationstest |

**Doku:** `docs/architecture/server-schichten.md`, `docs/api/health.md`.

---

## T-007 — Authentifizierung, Sitzungen, Rechte

**Features:** F-001–F-003, F-005, F-011–F-013, F-015–F-016, F-055–F-066, F-091–F-093 (24) · **Befunde:** B-002–B-003, B-013–B-014, B-018, B-041, B-051–B-052, B-054, B-056–B-058, B-071–B-072, B-080
**Vorbedingungen:** T-005, T-006.
**Modelländerungen:** M-36 ([09-modellaenderungen.md](09-modellaenderungen.md))

**Zu erstellen**

```
nuxt/server/utils/auth.ts  auth-permissions.ts  auth-users.ts
nuxt/server/middleware/01.auth.ts  02.api-guard.ts
nuxt/server/api/auth/[...all].ts   nuxt/server/api/me.get.ts
nuxt/shared/permissions.ts
nuxt/app/composables/useAuth.ts  usePermissions.ts
nuxt/app/middleware/auth.global.ts  permission.ts
nuxt/app/pages/login.vue  nuxt/app/plugins/idle-logout.client.ts
nuxt/app/pages/403.vue
```

**Inhalt**

- better-auth nach [`inventar/research-auth.md`](inventar/research-auth.md) §4:
  gleiche Tabellen, gleiches Geheimnis, gleicher Cookie-Präfix — **keine
  Datenmigration**.
- Deaktivierte Konten werden vor der Sitzungserstellung abgewiesen und bei
  jedem Request erneut geprüft.
- Anmeldedrosselung, keine Rückschlüsse auf vorhandene Benutzernamen.
- Rechte einmal je Request laden, in `event.context.auth` ablegen.
- Anmeldeseite mit deutschen Fehlermeldungen; Weiterleitung auf das
  ursprüngliche Ziel, Schutz gegen Weiterleitung nach außen (auch `/\evil.com`).
- Abmelden, Abmeldung bei Untätigkeit **mit Vorwarnung und über Tabs hinweg**.
- 403-Seite statt leerem Bildschirm.

**Akzeptanzkriterien**

| #   | Kriterium                                                               | Prüfung                                      |
| --- | ----------------------------------------------------------------------- | -------------------------------------------- |
| 1   | Anmeldung mit einem Bestandsnutzer und dessen altem Passwort gelingt    | Integrationstest gegen die Fixture-Datenbank |
| 2   | Falsches Passwort und unbekannter Name liefern dieselbe Meldung         | Integrationstest                             |
| 3   | Elf Versuche in einer Minute führen zu 429                              | Integrationstest                             |
| 4   | Deaktivierung beendet laufende Sitzungen sofort                         | Integrationstest                             |
| 5   | Endpoint ohne Recht liefert 403, ohne Sitzung 401                       | Integrationstest                             |
| 6   | `?redirectTo=//evil.com` und `?redirectTo=/\evil.com` werden abgewiesen | Unit- und E2E-Test                           |
| 7   | Untätigkeit meldet ab, Vorwarnung erscheint, alle Tabs folgen           | Browsertest                                  |
| 8   | Jeder Endpoint beginnt mit einem Guard                                  | Querschnittstest                             |
| 9   | **P-13** — 20 Fehlversuche je Konto binnen einer Stunde sperren es 15 Minuten | Integrationstest                             |
| 10  | Entsperren wirkt sofort; der nächste Versuch kommt durch                | Integrationstest                             |

**Nachgetragen am 13.09.2026:** die gestaffelte Kontosperre aus **P-13**. Die
Minutengrenzen bleiben (10 je Adresse, 20 je Konto); darüber hinaus zählt eine
**Stunde**, und nach 20 Fehlversuchen darin ruht das Konto 15 Minuten. Die
Oberfläche zum Entsperren gehört zu T-034; der Dienst dahinter steht hier.

**Doku:** `docs/architecture/auth.md`, `docs/api/auth/*`, Entscheidungsseite
zu better-auth.

---

## T-008 — App-Shell, Navigation, Zustände, Animationen

**Features:** F-009–F-010, F-014, F-018–F-026, F-042, F-067, F-069, F-085–F-086, F-132–F-134, F-136, F-173–F-174, F-445 (24) · **Befunde:** B-012, B-014, B-017, B-019–B-020, B-033–B-035, B-038, B-043, B-058, B-375
**Vorbedingungen:** T-007.

**Zu erstellen**

```
nuxt/app/layouts/default.vue  blank.vue
nuxt/app/components/app/AppSidebar.vue  AppHeader.vue  AppUserMenu.vue
nuxt/app/components/app/NavigationTree.vue
nuxt/app/composables/useBusy.ts  useFormDirty.ts  useNavigation.ts
nuxt/app/error.vue  (ausbauen)
nuxt/shared/navigation.ts
```

**Inhalt**

- Shell mit den Dashboard-Bausteinen von Nuxt UI: Sidebar links, Kopfzeile
  oben, Inhaltsbereich; mobil als Schublade.
- Navigation exakt wie im Bestand: acht Gruppen, gleiche Reihenfolge,
  gleiche Beschriftungen, gleiche Icons, gefiltert nach Rechten.
- Ladeanzeige in drei Stufen ([04-ux.md](04-ux.md) §3.3), genau **eine**
  Ladeleiste.
- Toasts, Seitenübergänge und Dialog-Animationen mit den Werten aus
  [04-ux.md](04-ux.md) §3.2, inklusive Bewegungsreduktion.
- Warnung bei ungespeicherten Änderungen, zentral in der Shell.
- Fehlerseite mit statusabhängigem Text.

**Akzeptanzkriterien**

| #   | Kriterium                                                                         | Prüfung                    |
| --- | --------------------------------------------------------------------------------- | -------------------------- |
| 1   | Ein Nutzer ohne Modulrechte sieht nur „Start"                                     | Komponententest            |
| 2   | Jede Gruppe verschwindet, wenn alle ihre Einträge fehlen                          | Komponententest            |
| 3   | Es existiert genau eine Ladeleiste im Baum                                        | Komponententest            |
| 4   | Das Layout springt nicht, wenn die Ladeleiste erscheint                           | Browsertest misst die Höhe |
| 5   | Mit Bewegungsreduktion laufen keine Übergänge                                     | Browsertest                |
| 6   | Verlassen einer geänderten Seite fragt nach                                       | Browsertest                |
| 7   | Seitenwechsel zwischen zwei Detailseiten desselben Typs zeigt den neuen Datensatz | E2E-Test                   |

**Doku:** `docs/ui/` für jede Shell-Komponente,
`docs/architecture/oberflaeche.md`.

---

## T-009 — Gemeinsame Komponenten und Picker

**Features:** F-043, F-095–F-113, F-115–F-117, F-122–F-131, F-137, F-247 (35) · **Befunde:** B-082–B-084, B-086–B-087, B-091, B-093, B-096, B-100, B-106–B-109, B-111, B-113–B-116, B-216, B-225
**Vorbedingungen:** T-008.
**Modelländerungen:** M-02, M-35 ([09-modellaenderungen.md](09-modellaenderungen.md))

**Zu erstellen**

```
nuxt/app/components/data/ListPage.vue  DataTable.vue  FilterBar.vue
                          EmptyState.vue  ErrorState.vue  StatusBadge.vue
nuxt/app/components/form/FormPage.vue  DateField.vue  MoneyField.vue
nuxt/app/components/picker/EntityPicker.vue  MultiEntityPicker.vue
nuxt/app/components/ui/ConfirmDialog.vue  FileDropzone.vue  StatTile.vue
nuxt/app/composables/useListQuery.ts  useCreationFlow.ts  useConfirm.ts
nuxt/server/api/pickers/*.get.ts
nuxt/shared/utils/date.ts  picker-labels.ts
```

**Inhalt**

- `useListQuery` als **einzige** Umsetzung des Listenmusters: Filter in der
  URL, Seitenreset, vorheriges Ergebnis bleibt sichtbar, fest 25.
- `DataTable` auf `UTable`: ganze Zeile klickbar über `@select`,
  Aktionsspalte mit `@click.stop`, Summenzeile, mobile Kartenansicht.
- `EntityPicker` als modaler Dialog mit Serversuche (250 ms entprellt),
  Blätterleiste, „×" zum Leeren und **einer** Schaltfläche „Neu anlegen".
- `MultiEntityPicker` transaktional mit „Übernehmen (N)".
- Creation-Flow: Entwurf in `sessionStorage`, Rücksprung, automatische
  Auswahl, Schleifenschutz, Verfall nach einer Stunde.

  **Er trägt mehr als zwei Ebenen** (festgelegt am 20.09.2026). Der Stapel ist
  genau dafür ein Stapel und keine einzelne Rückkehradresse: wer beim Anlegen
  einer Rechnung einen Kunden anlegt und von dort aus dessen Fahrzeug, muss am
  Ende bei der Rechnung landen — mit Kunde **und** Fahrzeug eingetragen. Die
  Ketten, die vorkommen, sind höchstens drei Ebenen tief:

  | Kette | Tiefe |
  | --- | --- |
  | Auftrag → Kunde | 1 |
  | Auftrag → Kunde → Fahrzeug | 2 |
  | Rechnung → Kunde → Fahrzeug | 2 |
  | Auftrag → Fahrzeug → Kunde (Halter) | 2 |

  „Auftrag → Rechnung → Kunde → Fahrzeug" ist **keine** Kette dieser Art: eine
  Rechnung wird aus einem fertigen Auftrag erzeugt, nicht beim Anlegen des
  Auftrags aus einem Picker heraus. Der Stapel begrenzt die Tiefe trotzdem
  nicht künstlich — er zählt, und der Schleifenschutz (`activeEntities`)
  verhindert nur, dass dieselbe Art zweimal im Stapel steht.

  **Das Zurücknavigieren ist Teil des Vorgangs**: „Abbrechen" auf Ebene 3
  führt zurück auf Ebene 2, nicht zur Liste. Eine Brotkrumenleiste im Kopf des
  Formulars zeigt, wo man steht.
- Bestätigungsdialog über `useOverlay()` — liefert ein Promise.
- `DateField` kapselt die Umrechnung ISO ↔ `CalendarDate`
  ([03-architektur.md](03-architektur.md) §8.3).
- Picker-Endpoints für Kunden, Fahrzeuge (drei Varianten), Artikel, Reifen,
  Mitarbeiter, Lieferanten, Belege — jeweils mit Rechteprüfung, Serversuche,
  fester Seitengröße, ohne archivierte Datensätze.

**Akzeptanzkriterien**

| #   | Kriterium                                                                     | Prüfung                                              |
| --- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Beim Blättern ist zu keinem Zeitpunkt eine leere Tabelle sichtbar             | Browsertest                                          |
| 2   | Filterwechsel setzt auf Seite 1 und in die URL                                | Komponententest                                      |
| 3   | Neuladen stellt Filter und Seite wieder her                                   | E2E-Test                                             |
| 4   | Der Picker-Dialog fängt den Fokus, schließt mit Escape, gibt den Fokus zurück | Browsertest                                          |
| 5   | Der Picker sucht serverseitig, nie im Client                                  | Integrationstest: 300 Datensätze, Antwort enthält 25 |
| 6   | Creation-Flow über **drei** Ebenen stellt jeden Entwurf wieder her            | E2E-Test: Rechnung → Kunde → Fahrzeug und zurück     |
| 6a  | „Abbrechen" auf der tiefsten Ebene führt eine Ebene zurück, nicht zur Liste   | E2E-Test                                             |
| 6b  | Der Schleifenschutz weist dieselbe Art ein zweites Mal im Stapel ab           | Komponententest                                      |
| 7   | Der Mehrfach-Picker verwirft bei „Abbrechen"                                  | Komponententest                                      |
| 8   | Jeder Picker-Endpoint verweigert ohne Recht                                   | Integrationstest                                     |
| 9   | `DateField` rundet nicht und verschiebt keine Tage                            | Unit-Test über Zeitzonengrenzen                      |

**Testumfang (festgelegt am 20.09.2026).** Für dieses Paket gilt die volle
Breite aus [05-teststrategie.md](05-teststrategie.md), ohne Ausnahme:
Unit-Tests für die reinen Rechnungen, Komponententests für jede Komponente,
Integrationstests gegen echtes PostgreSQL für jeden Picker-Endpoint,
Browsertests für Fokus, Tastatur und Overlays, E2E-Tests für die Ketten oben,
**Barrierefreiheitstests** (Rollen, zugängliche Namen, Fokusreihenfolge,
`prefers-reduced-motion`) und je behobenem Befund ein Regressionstest.

**Nuxt UI wird dabei normal verwendet**, ohne Anpassungen: kein eigenes CSS,
kein Zusammensetzen mehrerer Komponenten zu einer neuen. Was Nuxt UI nicht
kann, wird nicht nachgebaut, sondern als offene Frage notiert (Regel 14).

**Doku:** `docs/ui/` je Komponente mit Props, Ereignissen, Slots und Beispiel.

---

# Phase 1 — Fachliche Slices (T-010 … T-035)

Jedes Paket folgt derselben inneren Reihenfolge: Schemata → Dienste →
Endpoints → Seiten → Tests → Doku ([07-ausfuehrung.md](07-ausfuehrung.md) §3).
Deshalb stehen unten nur die Besonderheiten.

## T-010 — Setup-Assistent und Firmeneinstellungen

**Features:** F-017, F-068, F-071, F-094, F-138–F-152, F-160–F-169, F-172, F-176–F-177, F-446 (33) · **Befunde:** B-001, B-046, B-077, B-117–B-118, B-120–B-126, B-128–B-131, B-141–B-144, B-148, B-150, B-152
**Vorbedingungen:** T-007, T-009.
**Modelländerungen:** M-22, P-14 ([09-modellaenderungen.md](09-modellaenderungen.md))

Acht Schritte, Zwischenspeicherung, Wiederaufnahme nach Neuladen, Abschluss
legt den ersten Administrator an und schaltet die Anwendung frei. Danach ist
`/setup` dauerhaft gesperrt. Firmenstammdaten, Logo, §19-Regelung,
Standard-Steuersatz, Zahlungsziel, Stundensatz, Endtext für Belege.
**Das Setup-Gate läuft serverseitig**, nicht im Client.

**Hier entsteht das erste Passwort der Anwendung** — und es ist die einzige
Hürde, weil es keinen zweiten Faktor gibt (M-36). Die Prüfung aus **P-14**
(Mindestanforderung, Abgleich gegen die mitgelieferte Liste bekannter
Passwörter, E-23) entsteht deshalb in diesem Paket und wird von T-034 und vom
eigenen Passwortwechsel mitbenutzt.

**Besondere Akzeptanzkriterien:** frische Datenbank → Assistent → Dashboard
ohne Umweg (E2E, Golden Flow G-01); ein zweiter Aufruf von `/setup` nach
Abschluss leitet um; ein Neuladen mitten im Assistenten verliert nichts;
**P-14** — `sommer2024` wird abgewiesen, mit einem Satz, der sagt warum, und
die Prüfung läuft **ohne Internet**.

## T-011 — Kunden und Lieferanten

**Features:** F-178–F-220 (43) · **Befunde:** B-153–B-157, B-159–B-162, B-165–B-166, B-170–B-174, B-176–B-179, B-181–B-186, B-189, B-191–B-194
**Vorbedingungen:** T-009.
**Modelländerungen:** M-07 ([09-modellaenderungen.md](09-modellaenderungen.md))

Das Referenzmodul: Liste mit Suche, Art-Filter, Archiv, Detailseite mit
Registerkarten, Formular, Archivieren und Reaktivieren. Lieferanten bekommen
dieselbe Archiv-Bedienung (A-10). **Kundenart ist ein ausdrückliches Feld**
`privat | firma | ebay` (E-16).

**Löschen nach E-11:** Ein Kunde lässt sich samt allem Zugehörigen löschen —
Fahrzeuge, Aufträge, Angebote, Termine, Reifeneinlagerungen, Anfragen,
Zeiteinträge. Der Dialog zählt vorher auf, was mitgeht (04-ux.md §3.11).
**Sobald eine ausgestellte Rechnung existiert, ist Löschen gesperrt** und die
Anwendung bietet nur Archivieren an.

**Besondere Akzeptanzkriterien:** ein geleertes Feld ist nach dem Speichern
leer (Regressionstest); der Löschdialog zählt jede betroffene Art mit der
richtigen Anzahl auf; ein Kunde mit ausgestellter Rechnung lässt sich
serverseitig **nicht** löschen (409), auch nicht an der Oberfläche vorbei;
nach dem Löschen bleibt kein verwaister Datensatz zurück (Integrationstest
zählt alle Fremdschlüssel nach); Golden Flow G-03.

## T-012 — Fahrzeuge, Dokumente, Fotos

**Features:** F-118, F-221–F-240, F-255–F-256 (23) · **Befunde:** B-105, B-197, B-202–B-204, B-206, B-209–B-210, B-214–B-215, B-217–B-218, B-226, B-228
**Vorbedingungen:** T-011.
**Modelländerungen:** M-05, M-06, P-11, P-12 ([09-modellaenderungen.md](09-modellaenderungen.md))

Fahrzeugliste mit Suche über alle Kennzeichen-Versionen, FIN, Marke, Modell,
Halter. Kennzeichen-Versionierung, Detailseite mit allen Registerkarten,
Dokumente (Upload als Multipart, Typprüfung über Magic Bytes), Fotos mit
serverseitiger Verkleinerung, Halter-Historie im Zeitstrahl (M-02, M-06).

**Archivieren und Löschen.** Archivieren ist der Alltagsweg; gelöscht wird nur,
was es nie hätte geben dürfen. Das Löschen läuft in **einer Transaktion** nach
E-22: Kostenvoranschläge, Termine und Aufträge verlieren ihren Fahrzeugverweis,
montierte Radsätze gehen mit, und **eine Rechnung oder ein eingelagerter
Radsatz sperrt**. Der Bestätigungsdialog **zeigt** nur, was geschieht — er
lässt nicht je Verweisart wählen.

**Besondere Akzeptanzkriterien:** Suche findet ein Fahrzeug über ein
**früheres** Kennzeichen; eine als PDF getarnte Datei wird abgewiesen; ein
6000-px-Bild landet verkleinert in der Datenbank; **P-11** — ein Fahrzeug mit
Rechnung lässt sich nicht löschen, auch nicht mit stornierter, und der Versuch
lässt die Rechnung unangetastet; **P-12** — ein eingelagerter Radsatz sperrt,
ein montierter geht mit; die Vorschau nennt die Zahlen, die danach wirklich
eintreten; Golden Flow G-04.

## T-013 — Bestand, Ankauf und Verkauf, Verkaufsschild

**Features:** F-241–F-246, F-252–F-254 (9) · **Befunde:** B-197, B-203, B-207, B-210, B-213, B-216, B-225
**Vorbedingungen:** T-012, T-022 (Verkauf über Rechnung), T-023 (Schild).

Ankauf eines Kundenfahrzeugs in den Bestand mit Vorbesitzer-Schnappschuss,
Differenzbesteuerung, **vollständige Inserat-Oberfläche** mit Preis,
§25a-Kennzeichen, Standort, Ausstattung, Highlights, internen Notizen und
Status (E-13), Verkaufsschild als A4-PDF, Verkauf über die bezahlte Rechnung.

**Besondere Akzeptanzkriterien:** Ankauf und Verkauf laufen je in einer
Transaktion; Fotos gibt es nur für Bestandsfahrzeuge (serverseitig
abgewiesen); der QR-Code des Schildes zeigt auf eine **erreichbare,
öffentliche** Adresse; Golden Flow G-12.

## T-014 — Artikel und Leistungen

**Features:** F-257–F-274, F-280, F-288, F-296–F-297, F-301, F-311 (24) · **Befunde:** B-229, B-231, B-233, B-236–B-243, B-248–B-249, B-251, B-257–B-260, B-263–B-265
**Vorbedingungen:** T-009.

Katalog mit Kategorien, Einheiten, Steuersatz, Preisversionen (gültig ab),
Bildern, Kennzeichen „online buchbar".

**Besondere Akzeptanzkriterien:** der zum Belegdatum gültige Preis wird
aufgelöst, nicht der heutige; eine Preisänderung verändert **keinen**
bestehenden Beleg.

## T-015 — Reifenkatalog

**Features:** F-276–F-279, F-281–F-287, F-289–F-292 (15) · **Befunde:** B-232, B-234, B-239, B-242–B-243, B-245–B-247, B-250, B-257, B-260, B-263, B-265
**Vorbedingungen:** T-014.

Eigene Stammdaten mit Dimension, Saison, Hersteller, EU-Label, Preisversionen
und Kennzeichen für den Onlineverkauf.

**Besondere Akzeptanzkriterien:** die Dimension wird zuverlässig zerlegt und
wieder zusammengesetzt (Unit-Tests über eine Tabelle realer Größen).

## T-016 — Reifeneinlagerung, Etiketten, Erinnerungen

**Features:** F-275, F-293–F-295, F-298–F-300, F-302–F-310, F-441 (17) · **Befunde:** B-229–B-230, B-235, B-239–B-241, B-246–B-248, B-250, B-252–B-253, B-255, B-258–B-259, B-263–B-264
**Vorbedingungen:** T-015, T-023, T-026.
**Modelländerungen:** M-13 ([09-modellaenderungen.md](09-modellaenderungen.md))

Einlagerungen mit Nummernkreis, Lagerplatz, QR-Etikett, Scan-Seite,
saisonale Erinnerungsmails an Kunden mit Zustimmung.

**Besondere Akzeptanzkriterien:** zweimaliges Auslösen der Erinnerung
verschickt **keine** zweite Mail; das Etikett enthält eine Adresse, die im
Betrieb tatsächlich erreichbar ist; Golden Flow G-13.

## T-017 — Mitarbeiter und Abwesenheiten

**Features:** F-481–F-505, F-524 (26) · **Befunde:** B-420–B-423, B-426, B-428, B-430–B-433, B-449–B-451, B-453–B-455
**Vorbedingungen:** T-009, T-019 (Feiertage).

Stammdaten mit versionierten Gehältern, Abwesenheiten mit
feiertagsbewusster Arbeitstagszählung, halben Tagen, Urlaubsbudget,
Konfliktbehandlung zwischen Urlaub und Krankheit.

**Besondere Akzeptanzkriterien:** die Arbeitstagszählung stimmt für
Jahreswechsel, Schaltjahre, Feiertage und halbe Tage (Unit-Tabelle); die
Abwesenheitsliste aktualisiert sich nach einer Änderung sofort (der bekannte
Fehler des Bestands).

## T-018 — Öffnungszeiten

**Features:** F-520–F-522 (3) · **Befunde:** B-051, B-089–B-090, B-435–B-437, B-441–B-443, B-445–B-446, B-450–B-451, B-455
**Vorbedingungen:** T-010.
**Modelländerungen:** M-10 ([09-modellaenderungen.md](09-modellaenderungen.md))

Öffnungszeiten je Wochentag: sieben Zeilen, Öffnet/Schließt oder geschlossen,
in **einer** Transaktion gespeichert. Sie sind die Grundlage für die freien
Termine der öffentlichen Schnittstelle und für nichts sonst.

**Die Zeiterfassung entfällt** (M-10). Es wird kein Controlling der
Arbeitszeit betrieben: weder Stundenliste noch Selbstbedienungsrecht, weder
Auslastungs- noch Monatsbericht, weder Innenzeiten noch eine Trennung zwischen
erfasster und abgerechneter Zeit. Die Zeit, die dem Kunden berechnet wird,
steht als Wert an der Auftragsposition (T-020) und wird dort gepflegt.
Gestrichen sind damit F-090, F-120, F-382, F-506–F-519 und F-523; die
Berechtigungen `hours` und `hours:write_own` entfallen ersatzlos. Der frei
gewordene Golden Flow **G-11** trägt jetzt die Rückspielprobe aus T-043.

**Besondere Akzeptanzkriterien:** ein offener Tag verlangt Öffnet **vor**
Schließt, serverseitig geprüft; das Speichern der sieben Zeilen ist eine
Transaktion, kein Reigen aus sieben Aufrufen (der bekannte Fehler des
Bestands); ein fehlender Wochentag wird beim Lesen ergänzt, ohne dass zwei
gleichzeitige Leser zwei Zeilen anlegen.

## T-019 — Kalender, Feiertage, Terminplanung

**Features:** F-250, F-525, F-527–F-549, F-554, F-556, F-587 (28) · **Befunde:** B-456–B-458, B-460–B-462, B-470–B-472, B-477–B-478, B-482–B-485, B-516
**Vorbedingungen:** T-009.
**Modelländerungen:** M-04, M-12, P-10 ([09-modellaenderungen.md](09-modellaenderungen.md))

Monatsraster und Agenda, Termine, Betriebsschließungen, Abwesenheiten,
HU-Fälligkeiten und geplante Aufträge in einer Ansicht; berechnete Feiertage
für alle sechzehn Bundesländer; Grundlage für freie Termine.

**Besondere Akzeptanzkriterien:** Feiertage stimmen für alle Bundesländer
über mehrere Jahre (Unit-Tabelle); die Slot-Berechnung ist von der
Server-Zeitzone unabhängig (Test mit abweichender Umgebungszeitzone);
Golden Flow G-10.

## T-020 — Aufträge (Kanban-Arbeitsaufträge)

**Features:** F-312–F-366 (55) · **Befunde:** B-268–B-270, B-272–B-273, B-275–B-276, B-280–B-281, B-283, B-285–B-289, B-292–B-296, B-298–B-299
**Vorbedingungen:** T-012, T-014, T-019.
**Modelländerungen:** M-03, M-09, M-21, P-01, P-05, P-06 ([09-modellaenderungen.md](09-modellaenderungen.md))

Kanban mit drei Spalten, Mehrfachzuweisung von Mitarbeitern,
Arbeitspositionen mit Preis-Schnappschuss, Terminverknüpfung, Abschluss
erzeugt die Rechnung.

**Besondere Akzeptanzkriterien:** je Auftrag höchstens **eine** aktive
Rechnung (durch die Datenbank abgesichert, nicht nur durch Code); Abschluss
und Rechnungserzeugung laufen in einer Transaktion; Ziehen und Ablegen hat
eine Tastaturalternative; Golden Flow G-05.

## T-021 — Belege-Grundlage und Kostenvoranschläge

**Features:** F-367–F-381 (15) · **Befunde:** B-303–B-304, B-306, B-312–B-317, B-325, B-327–B-328, B-333, B-338, B-340, B-342, B-346, B-348
**Vorbedingungen:** T-011, T-014, T-006.
**Modelländerungen:** M-15, M-21, P-05 ([09-modellaenderungen.md](09-modellaenderungen.md))

Gemeinsames Belegmodell, Positionen-Editor mit Live-Summen und gemischten
Steuersätzen, Kostenvoranschläge, Umwandlung in eine Rechnung.

Es gibt **genau zwei Belegarten**: Kostenvoranschlag und Rechnung (M-15).
Angebot und Auftragsbestätigung entfallen samt ihrer Felder; wo der Bestand
„Angebot" schrieb, ist der Kostenvoranschlag gemeint — die unverbindliche
Schätzung, nicht das rechtlich bindende Angebot. Durchlaufposten sind
umsatzsteuerfrei und werden gesondert ausgewiesen (M-21).

**Besondere Akzeptanzkriterien:** Positionsrechnung stimmt bei gemischten
Sätzen, Rabatten und Rundung auf den Cent (Unit-Tabelle); ein Steuersatz von
0 % bleibt 0 % (Regressionstest); die Umwandlung überträgt jede Position
unverändert; ein Kostenvoranschlag lässt sich nicht mit Mahnstufe oder
Zahlungsziel speichern (P-05).

## T-022 — Rechnungen, Zahlungen, Storno

**Features:** F-383–F-393, F-407–F-409 (14) · **Befunde:** B-301, B-303–B-305, B-313–B-314, B-316–B-317, B-323, B-325, B-338–B-339, B-342–B-343
**Vorbedingungen:** T-021, T-023.
**Modelländerungen:** M-16, P-07 ([09-modellaenderungen.md](09-modellaenderungen.md))

Rechnungen mit Statusautomat, **echte Zahlungserfassung inklusive
Teilzahlungen** (E-14): Datum, Betrag und Zahlungsart je Zahlung, „bezahlt"
ergibt sich aus der Summe statt aus einem Schalter. Storno mit Gegenbeleg und
automatischem Wiederöffnen des Auftrags, GoBD-Löschschutz.

**Besondere Akzeptanzkriterien:** jeder unerlaubte Statuswechsel wird
serverseitig mit 409 abgewiesen; Storno erzeugt Beleg **und** PDF in einer
Transaktion; eine ausgestellte Rechnung lässt sich nicht löschen; Golden
Flows G-06 und G-07.

## T-023 — PDF-Pipeline

**Features:** F-047, F-121, F-395–F-404 (12) · **Befunde:** B-031, B-103, B-304, B-308, B-313, B-326, B-330, B-333
**Vorbedingungen:** T-010 (Firmendaten), T-021.
**Modelländerungen:** M-15, M-31 ([09-modellaenderungen.md](09-modellaenderungen.md))

Portierung der verbleibenden Vorlagen: Rechnung, Storno, Kostenvoranschlag,
Zahlungserinnerung, Verkaufsschild, Reifenetikett. Angebot und
Auftragsbestätigung entfallen (M-15). Ein erneut erzeugtes PDF eines
importierten Belegs trägt den Vermerk **Nachdruck** (M-31).
Zwischenspeicher in der Datenbank, getrennte Endpoints für Metadaten und
Bytes, Vorschau im Browser.

**Besondere Akzeptanzkriterien:** die Ausgabe ist byte-gleich bei zwei Läufen;
die Pixel-Vergleichssuite gegen die übernommenen Vergleichsbilder ist grün;
Umlaute, lange Texte und mehrseitige Belege stimmen; Listenabfragen laden
niemals Bytes.

## T-024 — XRechnung

**Features:** F-394 (1) · **Befunde:** B-309, B-330
**Vorbedingungen:** T-022.
**Modelländerungen:** M-18, M-20, P-03, P-04 ([09-modellaenderungen.md](09-modellaenderungen.md))

EN-16931-konformes XML je Rechnung, mit den in
[02-befunde.md](02-befunde.md) belegten Formatfehlern behoben.

**Besondere Akzeptanzkriterien:** die erzeugte Datei besteht eine Prüfung
gegen das Schema; interne Notizen erscheinen **nicht** im XML; ein Storno
trägt den richtigen Belegtyp; Rabatte erscheinen als solche.

## T-025 — Zahlungserinnerungen

**Features:** F-428–F-435 (8) · **Befunde:** B-349, B-352–B-355, B-369–B-373, B-377, B-384
**Vorbedingungen:** T-022, T-026.

Liste offener Rechnungen mit Verzugstagen und offenem Betrag (Teilzahlungen
berücksichtigt), manueller und stapelweiser Versand, Wiederholung nach
Intervall, Einstellungen, Verlauf.

Der Versand läuft **werktags um 7:30 Uhr automatisch** (E-12); der Knopf
„Jetzt prüfen" bleibt zusätzlich.

**Besondere Akzeptanzkriterien:** ohne E-Mail-Adresse oder bei SMTP-Fehler
meldet die Oberfläche **keinen** Erfolg; zweimaliges Auslösen am selben Tag
verschickt nichts doppelt — beim Zeitplan ist das Voraussetzung, nicht Kür;
der offene Betrag zieht Teilzahlungen ab; Golden Flow G-09.

## T-026 — SMTP, Vorlagen, Versand, Gesendet

**Features:** F-119, F-405, F-414–F-421, F-426–F-427, F-436–F-440 (17) · **Befunde:** B-101, B-116, B-345, B-349–B-351, B-355, B-360–B-363, B-365–B-366, B-368, B-373, B-375–B-377, B-380
**Vorbedingungen:** T-006, T-010.

Transport mit Zeitüberschreitungen, verschlüsseltem Passwort und Testversand;
Vorlagen mit Platzhaltern; Versanddialog mit Anhängen; Protokoll aller
ausgehenden Nachrichten.

**Besondere Akzeptanzkriterien:** jeder Versand erzeugt genau einen
Protokolleintrag mit richtigem Typ; ein SMTP-Fehler landet als kuratierte
deutsche Meldung beim Nutzer und im Protokoll als Fehlschlag; Kopfzeilen sind
gegen Einschleusung geschützt.

## T-027 — Rundschreiben

**Features:** F-422–F-425 (4) · **Befunde:** B-351, B-358, B-380, B-383
**Vorbedingungen:** T-026.

Empfängerkreis aus zugestimmten Kunden, Versand in Blindkopie-Blöcken,
Abbestellhinweis und Kopfzeile, Verlauf je Empfänger.

**Besondere Akzeptanzkriterien:** ein fehlgeschlagener Block bricht den Rest
nicht ab; der Verlauf aktualisiert sich nach dem Versand ohne Neuladen; nur
Kunden mit Zustimmung erscheinen.

## T-028 — Buchhaltung und DATEV-Export

**Features:** F-448–F-477 (30) · **Befunde:** B-385–B-387, B-389–B-390, B-393–B-400, B-405–B-406, B-409–B-410, B-412, B-418
**Vorbedingungen:** T-006, T-022.
**Modelländerungen:** M-23, M-24, M-26, M-27, P-09 ([09-modellaenderungen.md](09-modellaenderungen.md))

Buchungen mit Kategorien, Monatsansicht, Summen, Export als
DATEV-Buchungsstapel.

**Besondere Akzeptanzkriterien:** die Exportdatei hat die erwartete Kopfzeile,
Zeichenkodierung und Feldreihenfolge (Vergleich gegen eine
Referenzdatei); Beträge und Datumsangaben sind exakt; der Download
funktioniert auch bei großen Zeiträumen; Golden Flow G-14.

## T-029 — Rechnungsausgangsbuch

**Features:** F-410, F-478 (2) · **Befunde:** B-319–B-320, B-405, B-417
**Vorbedingungen:** T-022, T-028.

Lesesicht über die Rechnungen mit Zeitraum, Summen und Blätterung.

**Besondere Akzeptanzkriterien:** Umsatz ist genauso definiert wie im
DATEV-Export (E-15); Zeitraumgrenzen stimmen auch am Monatsanfang und
-ende in deutscher Zeit.

## T-030 — Beiträge und Kundenanfragen

**Features:** F-575–F-586 (12) · **Befunde:** B-486, B-491, B-498, B-503–B-504, B-506, B-517, B-519–B-520
**Vorbedingungen:** T-009, T-026.

Nachrichtenbeiträge für die Website mit Veröffentlichungsstatus, Titelbild und
stabilen Adressen; Posteingang für Anfragen aus dem Kontaktformular
**mit sichtbarem Nachrichtentext und Bearbeitungsstatus** (A-13).

**Besondere Akzeptanzkriterien:** eine Titeländerung ändert die öffentliche
Adresse nicht; unveröffentlichte Beiträge sind von außen unsichtbar; eine
Anfrage lässt sich als erledigt markieren und einem Kunden zuordnen.

## T-031 — Öffentliche REST-API

**Features:** F-004, F-088–F-089, F-175, F-248, F-412, F-442–F-443, F-550–F-552, F-557–F-574 (29) · **Befunde:** B-003, B-054, B-205–B-206, B-225, B-351, B-380, B-463–B-464, B-466–B-467, B-469, B-484, B-488, B-490–B-493, B-495–B-496, B-498–B-499, B-501, B-503, B-510, B-516
**Vorbedingungen:** T-013, T-015, T-019, T-030.

Alle Endpunkte für die Website: Gebrauchtwagen, Reifen, Leistungen, freie
Termine, Terminbuchung, Bestellung, Kontakt, Firmendaten, Beiträge.
Token-Prüfung mit Zeitgleichheit, Drosselung je Token, **CORS auf die
Website begrenzt**, Cache-Kopfzeilen, Blätterung überall.

**Besondere Akzeptanzkriterien:** jede Liste ist geblättert und enthält keine
eingebetteten Bilddaten; eine Buchung auf denselben Termin gelingt nur einmal
(gleichzeitiger Test); ohne Token 401, mit falschem Token 401, ohne
konfigurierte Token 503; die Antwortform ist gegen ein Schema geprüft.

## T-032 — eBay-Anbindung

**Features:** F-588–F-606 (19) · **Befunde:** B-522–B-527, B-529, B-531–B-532, B-550–B-553
**Vorbedingungen:** T-006, T-010.

Verbindung über OAuth mit verschlüsselten Token, Pflichtendpunkt für
Kontolöschungen, Import der Angebote.

**Besondere Akzeptanzkriterien:** der Prüf-Handschlag erzeugt exakt den
erwarteten Hashwert (Test mit festen Werten); Token erscheinen in keinem
Protokoll; der Import ist wiederholbar, ohne Dubletten zu erzeugen.

## T-033 — Legacy-Import (KFZ-Kaufmann)

**Features:** F-054, F-251, F-479, F-555, F-607–F-631 (29) · **Befunde:** B-480, B-526, B-533, B-535, B-537–B-538, B-542, B-545–B-548, B-554, B-558–B-559
**Vorbedingungen:** alle fachlichen Slices, deren Tabellen der Import füllt.
**Modelländerungen:** M-28, M-30, M-31, M-32, P-08 ([09-modellaenderungen.md](09-modellaenderungen.md))

**Der Import wird zum wiederholbaren Abgleich** (E-19) — das ist die größte
fachliche Änderung gegenüber dem Bestand. Er leert nichts mehr:

| Fall | Verhalten |
| --- | --- |
| nur in Kfz-Kaufmann | wird angelegt |
| hier vorhanden, seit dem letzten Import nicht bearbeitet | wird ersetzt |
| hier vorhanden und hier bearbeitet | bleibt, erscheint im Bericht |
| nur hier angelegt | bleibt unberührt |
| in Kfz-Kaufmann gelöscht | bleibt hier bestehen |

Da die Access-Tabellen kein Änderungsdatum führen, merkt sich die Anwendung je
Datensatz den Stand des letzten Imports und vergleicht. Hochladen der Datei,
Vorschau ohne Speichern, Fortschritt und Bericht bleiben.

**Weil der Bestand ausschließlich über diesen Weg ins System kommt (E-20),
rückt das Paket in der Reihenfolge nach vorn** — sobald Kunden, Fahrzeuge,
Artikel und Belege stehen.

**Besondere Akzeptanzkriterien:** die Vorschau schreibt nachweislich nichts;
zwei Läufe mit derselben Datei ergeben denselben Stand; ein hier bearbeiteter
Datensatz überlebt den nächsten Import unverändert und steht im Bericht; ein
hier neu angelegter Datensatz wird nie angefasst; der Import löscht unter
keinen Umständen; Dateinamen werden nie in eine Shell gereicht.

## T-034 — Benutzer, Rollen, eigenes Konto

**Features:** F-072–F-084, F-087, F-135 (15) · **Befunde:** B-046–B-051, B-059–B-061, B-064–B-067, B-073, B-077–B-078, B-080, B-093
**Vorbedingungen:** T-007.
**Modelländerungen:** M-04, M-39, P-13, P-14, P-15, P-22 ([09-modellaenderungen.md](09-modellaenderungen.md))

Verwaltung von Benutzern und Rollen mit Rechtematrix, Passwortzurücksetzung
durch die Verwaltung, Deaktivierung, eigenes Passwort ändern.

**Die Benutzerseite trägt drei Dinge nebeneinander** (M-36): „Passwort neu
setzen", „Sperre aufheben" und die letzten Fehlversuche mit Zeitpunkt, Adresse
und Grund. Ein Zurücksetzen als Selbstbedienung gibt es nicht und soll es nicht
geben — der Administrator ist im Haus erreichbar, und ein Weg über die E-Mail
machte das Postfach zum Schlüssel für die Anwendung.

**Gesperrte Anschlüsse stehen in den Einstellungen** (P-15, festgelegt am
20.09.2026): eine Liste mit Adresse, Anzahl der Fehlversuche, Zeitpunkt des
letzten Versuchs und Art der Sperre, das Dringendste zuerst. Daneben je Zeile
ein Knopf „Sperre aufheben". Darüber das Feld **sicherer Adressbereich**
(P-22) — ein Eintrag je Zeile, geprüft beim Speichern; ein Eintrag, den die
Anwendung nicht versteht, wird abgewiesen, statt wirkungslos gespeichert zu
werden.

**Das Protokoll bekommt einen eigenen Menüpunkt** (M-39, festgelegt am
20.09.2026) — sichtbar **nur für Administratoren**, nicht als Reiter in den
Einstellungen vergraben:

- **Eine Liste, chronologisch**, mit Filter nach Gewicht (Sicherheit, Warnung,
  Hinweis), nach Handlung, nach Person, nach betroffenem Datensatz und nach
  Zeitraum. Serverseitige Pagination wie überall, fest 25.
- **Ein Zähler am Menüpunkt**, solange ungesehene gravierende Vorfälle
  anstehen — dieselbe Zahl, die auch die E-Mail auslöst.
- **Eine Kachel auf dem Dashboard** (T-035) mit denselben Zahlen, die auf die
  Liste führt.
- **Sicherheit ist nicht auf die Anmeldung beschränkt.** Auch Fehler,
  fehlgeschlagene Hintergrundläufe und verheerende Vorgänge (große
  Löschmengen, misslungene Sicherungen) werden erfasst und über das Gewicht
  eingeordnet.
- **Das Protokoll rotiert sich selbst** — der wiederkehrende Lauf steht in
  T-044, die Ansicht hier.

**Besondere Akzeptanzkriterien:** der letzte **aktive** Inhaber aller Rechte
lässt sich weder löschen noch deaktivieren noch entrechten (der Bestand prüft
den Aktiv-Zustand nicht); eine Passwortänderung beendet die übrigen
Sitzungen; Benutzernamen lassen sich nicht über einen Umweg selbst ändern;
**P-13** — „Sperre aufheben" wirkt sofort, und der nächste Versuch kommt durch;
**P-14** — ein Passwort von der Liste bekannter Passwörter wird abgewiesen, mit
einem Satz, der sagt warum; **P-15** — „Adresssperre aufheben" wirkt sofort,
und eine Adresse im sicheren Bereich taucht in der Liste gar nicht erst auf;
**M-39** — wer kein Administrator ist, sieht den Menüpunkt nicht und erhält
auf den Endpoint 403; Golden Flow G-15.

## T-035 — Dashboard und globale Suche

**Features:** F-027–F-041, F-114, F-249, F-413, F-553 (19) · **Befunde:** B-006–B-011, B-028–B-029, B-035–B-036, B-042, B-045, B-088, B-093, B-109, B-113, B-475–B-476
**Vorbedingungen:** alle Module, deren Zahlen das Dashboard zeigt.

Kennzahlen, Schnellaktionen, anstehende Termine; Suche über neun Bereiche mit
Tastaturbedienung.

**Besondere Akzeptanzkriterien:** jede Kachel respektiert die Modulrechte —
wer keine Buchhaltung darf, sieht **keine** Umsatzzahlen (heute nicht so);
die Suche liefert nur Treffer aus erlaubten Bereichen; Suchergebnisse sind
per Tastatur erreichbar.

---

# Phase 2 — Querschnitt und Abschluss (T-036 … T-042)

## T-036 — PWA und Service Worker

**Features:** F-050–F-051 (2) · **Befunde:** B-004, B-017
**Vorbedingungen:** T-008.

Installierbarkeit, Manifest, Symbole. **Der Zwischenspeicher fasst
ausschließlich statische Bestandteile** — keine Antworten mit Geschäftsdaten
und keine Sitzungsauskünfte (schwerer Befund des Bestands). Hinweis auf eine
neue Version mit Schaltfläche zum Neuladen.

**Besondere Akzeptanzkriterien:** nach dem Besuch mehrerer Seiten enthält der
Zwischenspeicher keinen Eintrag unter `/api/`; eine neue Version wird erkannt
und angeboten.

## T-037 — Leistung, Indizes, Lastverhalten

**Features:** — · **Befunde:** –
**Vorbedingungen:** alle fachlichen Slices.

Messung der Listen- und Detailabfragen gegen eine Datenbank mit realistischer
Menge, Beseitigung von N+1-Abfragen, Ergänzung fehlender Indizes,
Begrenzung der Antwortgrößen.

**Besondere Akzeptanzkriterien:** jede Listenabfrage bleibt unter 200 ms bei
50 000 Kunden und 100 000 Belegen; kein Endpoint erzeugt mehr als fünf
Abfragen; keine Antwort überschreitet 500 KB ohne Anhang.

## T-038 — Barrierefreiheit und Bewegungsreduktion

**Features:** — · **Befunde:** –
**Vorbedingungen:** alle Oberflächen-Pakete.

Durchgang über alle Seiten: Tastaturreihenfolge, Fokusfallen, zugängliche
Namen, Kontraste, Ankündigung von Toasts, Bewegungsreduktion.

**Besondere Akzeptanzkriterien:** eine automatische Prüfung meldet auf jeder
Hauptseite keinen schweren Verstoß; jeder Dialog ist mit der Tastatur
bedienbar; mit Bewegungsreduktion bewegt sich nichts.

## T-039 — Golden Flows vollständig

**Features:** — · **Befunde:** —
**Vorbedingungen:** T-010 … T-035.

Die fünfzehn Abläufe aus [04-ux.md](04-ux.md) §9 als durchgängige Tests,
zuzüglich des Integrationslaufs über die öffentliche Schnittstelle.

**Besondere Akzeptanzkriterien:** alle fünfzehn grün, Laufzeit unter fünf
Minuten, keine festen Wartezeiten im Code, dreimaliger Lauf ohne Wackler.

## T-040 — Dokumentationsabschluss

**Features:** — · **Befunde:** —
**Vorbedingungen:** T-003 und alle fachlichen Slices.

Jede Feature-Seite auf `status: umgesetzt`, jeder Endpoint dokumentiert,
Komponentenkatalog vollständig, Anleitungen geschrieben, Entscheidungen
festgehalten, das Netz aus Querverweisen geschlossen.

**Besondere Akzeptanzkriterien:** `pnpm docs:check` meldet keine Lücke; keine
Seite steht ohne eingehenden Link; jede Seite ist vom Einstieg in höchstens
zwei Klicks erreichbar (durch das Prüfskript gemessen).

## T-041 — Container, CI, Release

**Features:** — · **Befunde:** B-595–B-602, B-604, B-607–B-611, B-613–B-617
**Vorbedingungen:** T-039.

Mehrstufiges Abbild auf `node:24-slim`, ohne Rootrechte, mit
Gesundheitsprüfung und fester Zeitzone; Migration vor dem Start;
vollständige Pipeline; Freigabe über semantic-release mit passendem
Abbild-Etikett; Betriebsgeheimnisse werden vollständig bereitgestellt
(der Bestand schreibt das Sitzungsgeheimnis nicht in die Umgebung — die
Anwendung startet dann mit einem öffentlich bekannten Ersatzwert).

**Besondere Akzeptanzkriterien:** das Abbild startet lokal gegen eine leere
Datenbank; ohne Pflichtgeheimnis startet es **nicht**; die Pipeline blockiert
einen Zusammenführungsversuch bei rotem Test; eine Freigabe erzeugt Version,
Änderungsprotokoll und Etikett.

## T-042 — Datenübernahme und Cutover

**Features:** — · **Befunde:** —
**Vorbedingungen:** alle.

**Deutlich kleiner als ursprünglich geplant** (E-20): die neue Anwendung
startet mit leerer Datenbank, die Daten der jetzigen Installation werden nicht
übernommen. Es gibt also keine Datenmigration, keinen Abgleich der
Migrationstabelle und keinen Rückrollpfad für Bestandsdaten.

Bleibt: neue Datenbank anlegen, Baseline anwenden, Vorgaben einspielen, ersten
Administrator über den Assistenten anlegen, Bestand über den Import ziehen,
Container umschalten. Dazu die Verschiebung von `nuxt/` ins Repo-Root und das
Entfernen des Altbestands samt überholter Dokumentationsseiten.

**Besondere Akzeptanzkriterien:** eine leere Datenbank ist in einem Durchlauf
betriebsbereit (Migration, Vorgaben, Assistent, Import); der Weg ist einmal
vollständig geprobt; ein Rückweg auf die alte Installation ist beschrieben.

---

## T-043 — Datensicherung über die Oberfläche

**Features:** neu · **Befunde:** — · **Modelländerungen:** M-37 ([09-modellaenderungen.md](09-modellaenderungen.md))
**Vorbedingungen:** T-005, T-026 (Verschlüsselung), T-030 (Dateiablage).

**Zu erstellen**

```
nuxt/server/services/backup-service.ts   restore-service.ts
nuxt/server/tasks/backup.ts
nuxt/server/api/settings/backup/*.ts
nuxt/app/pages/settings/backup.vue
```

**Inhalt**

- **Export von Hand:** alle Daten **samt Anhängen und PDFs** in einem offenen
  Format. Ein Archiv, das sich ohne diese Anwendung öffnen lässt.
- **Import desselben Archivs auf eine leere Installation.** Ohne diesen Weg
  ist der Export kein Backup, sondern ein Download. Nummernkreise, Verweise
  und Dateien müssen danach stimmen.
- **Automatisch:** versionierte Sicherung über SSH, verschlüsselt, mit einer
  **Schlüsseldatei, die über die Oberfläche hochgeladen wird**. Zeitplan
  grafisch konfigurierbar, über das Aufgabenregister aus T-006.
- **Sichtbarer Zustand:** wann lief die letzte Sicherung, war sie erfolgreich.
  Es muss auffallen, wenn sie seit Wochen stillsteht.
- **Golden Flow G-11:** sichern, herunterladen, auf eine leere Installation
  zurückspielen und nachzählen. Eine Sicherung, die nie zurückgespielt wurde,
  ist eine Vermutung.
- Kein Schritt verlangt die Kommandozeile.

**Akzeptanzkriterien**

| #   | Kriterium                                                                      | Prüfung          |
| --- | ------------------------------------------------------------------------------ | ---------------- |
| 1   | Ein Export lässt sich auf eine **leere** Datenbank zurückspielen, alle Zahlen stimmen | Integrationstest |
| 2   | Anhänge und PDFs sind nach dem Zurückspielen unverändert lesbar                 | Integrationstest |
| 3   | Nummernkreise stehen danach oberhalb des höchsten zurückgespielten Werts        | Integrationstest |
| 4   | Eine fehlende oder falsche Schlüsseldatei bricht mit deutschem Satz ab          | Integrationstest |
| 5   | Der Zustand meldet eine seit über 48 Stunden ausgebliebene Sicherung als Warnung | Komponententest  |
| 6   | Beim Aufsetzen ist die Rückspielung **einmal erprobt** und protokolliert        | Ausführungsschritt |

## T-044 — Protokoll, Sicherheitsereignisse und Absicherung

**Features:** neu · **Befunde:** — · **Modelländerungen:** M-39, M-40, P-17–P-21 ([09-modellaenderungen.md](09-modellaenderungen.md))
**Vorbedingungen:** T-006, T-007.
**Reihenfolge:** **vor** den Fachpaketen. Jedes Paket danach schreibt ins
Protokoll; wird die Grundlage später gebaut, muss sie in jedes Paket
nachgetragen werden.

**Zu erstellen**

```
nuxt/server/utils/audit.ts
nuxt/server/middleware/03.security-headers.ts
nuxt/server/tasks/protokoll-rotieren.ts
nuxt/shared/schemas/audit.ts
```

**Inhalt**

- **Ein Protokoll für alles** (M-39): dieselbe Tabelle für die gewöhnliche
  Änderung und für das Sicherheitsereignis, unterschieden durch ein
  **Gewicht** (`info`, `warnung`, `sicherheit`).
- `recordChange(...)` vergleicht zwei Zustände und schreibt **einen** Eintrag
  mit den geänderten Feldern — nicht einen je Feld (P-17).
- `recordSecurity(...)` für alles ohne Datensatz: Anmeldung, Sperre,
  abgewiesener Zugriff, Export.
- **Der abgewiesene Zugriff wird protokolliert** (P-18). Ein 403 ist der
  interessanteste Eintrag, den es gibt: jemand hat etwas versucht, das er
  nicht darf.
- **Nie ändern** (P-19): kein Dienst schreibt ein `UPDATE` oder `DELETE` auf
  das Protokoll. Nur die Rotation löscht, nach Alter.
- **Rotation** als nächtliche Aufgabe (P-20), wiederholbar, mit eigenem
  Protokolleintrag über das, was sie gelöscht hat.
- **Sicherheits-Kopfzeilen** auf jeder Antwort (M-40, P-21).
- Protokollieren darf nie einen Vorgang aufhalten.

**Akzeptanzkriterien**

| #   | Kriterium | Prüfung |
| --- | --- | --- |
| 1   | **P-17** — eine Änderung an zwei Feldern erzeugt **einen** Eintrag mit beiden | Integrationstest |
| 2   | Unveränderte Felder stehen **nicht** im Eintrag | Integrationstest |
| 3   | **P-18** — ein 403 erzeugt einen Eintrag mit Gewicht `sicherheit`, Pfad und Adresse | Integrationstest |
| 4   | **P-19** — kein Dienst ändert oder löscht Protokolleinträge | Querschnittstest |
| 5   | **P-20** — die Rotation hält die drei Fristen ein und ist wiederholbar | Integrationstest |
| 6   | Ein Fehler beim Protokollieren hält den Vorgang nicht auf | Integrationstest |
| 7   | **P-21** — jede Antwort trägt die Kopfzeilen, HSTS nur über HTTPS | Integrationstest, E2E gegen den Build |
| 8   | Der eingefrorene Name überlebt den gelöschten Benutzer | Integrationstest |

**Doku:** `docs/architecture/protokoll.md`, Ergänzung in `auth.md`.

**Doku:** `docs/operations/datensicherung.md`, `docs/api/settings-backup-*`.

---

## Reihenfolge und Abhängigkeiten

```
T-001 ─┬─ T-002 ─┬─ T-004 ── T-005 ── T-006 ── T-007 ── T-008 ── T-009 ─┐
       └─ T-003 ─┘                                                      │
                                                                        ▼
   ┌──────────────── Phase 1, grob in dieser Reihenfolge ───────────────┐
   │ T-010 → T-011 → T-012 → T-014 → T-015 → T-019 → T-017 → T-018      │
   │ T-021 → T-023 → T-022 → T-013 → T-020 → T-024 → T-026 → T-025      │
   │ T-027 → T-028 → T-029 → T-016 → T-030 → T-031 → T-032 → T-033      │
   │ T-034 → T-035                                                      │
   └────────────────────────────────────────────────────────────────────┘
                                    ▼
        T-036 → T-037 → T-038 → T-039 → T-040 → T-041 → T-043 → T-042
```

Begründung der weniger offensichtlichen Kanten:

- **T-023 vor T-022**: Rechnungen speichern ihr PDF beim Ausstellen; ohne
  Renderer wäre der Statusautomat nur halb prüfbar.
- **T-019 vor T-017**: die Abwesenheitsrechnung braucht die Feiertage.
- **T-013 nach T-022**: der Fahrzeugverkauf läuft über eine bezahlte Rechnung.
- **T-033 zuletzt in Phase 1**: der Import füllt fast jede Tabelle.
- **T-035 zuletzt**: Dashboard und Suche greifen auf alle Module zu.
- **T-043 vor T-042**: eine Auslieferung ohne erprobte Rückspielung wäre eine
  Vermutung, keine Sicherung.
- **T-044 vor allen Fachpaketen**: jedes davon schreibt ins Protokoll. Später
  gebaut, müsste die Grundlage in jedes Paket nachgetragen werden — und in
  einem davon würde sie vergessen.
