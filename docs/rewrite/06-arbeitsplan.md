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

**Features:** <!--IDS:T-001--> (<!--ANZAHL:T-001-->) · **Befunde:** <!--BEFUNDE:T-001-->
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

**Features:** <!--IDS:T-002--> (<!--ANZAHL:T-002-->) · **Befunde:** <!--BEFUNDE:T-002-->
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

**Features:** <!--IDS:T-003--> (<!--ANZAHL:T-003-->) · **Befunde:** <!--BEFUNDE:T-003-->
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
- **Alle <!--GESAMT--> Feature-Seiten werden angelegt** — zunächst als Rumpf
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

**Features:** <!--IDS:T-004--> (<!--ANZAHL:T-004-->) · **Befunde:** <!--BEFUNDE:T-004-->
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

**Features:** <!--IDS:T-005--> (<!--ANZAHL:T-005-->) · **Befunde:** <!--BEFUNDE:T-005-->
**Vorbedingungen:** T-002, T-004.

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

**Features:** <!--IDS:T-006--> (<!--ANZAHL:T-006-->) · **Befunde:** <!--BEFUNDE:T-006-->
**Vorbedingungen:** T-004, T-005.

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

**Features:** <!--IDS:T-007--> (<!--ANZAHL:T-007-->) · **Befunde:** <!--BEFUNDE:T-007-->
**Vorbedingungen:** T-005, T-006.

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

**Doku:** `docs/architecture/auth.md`, `docs/api/auth/*`, Entscheidungsseite
zu better-auth.

---

## T-008 — App-Shell, Navigation, Zustände, Animationen

**Features:** <!--IDS:T-008--> (<!--ANZAHL:T-008-->) · **Befunde:** <!--BEFUNDE:T-008-->
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

**Features:** <!--IDS:T-009--> (<!--ANZAHL:T-009-->) · **Befunde:** <!--BEFUNDE:T-009-->
**Vorbedingungen:** T-008.

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
| 6   | Creation-Flow über zwei Ebenen stellt den Entwurf wieder her                  | E2E-Test                                             |
| 7   | Der Mehrfach-Picker verwirft bei „Abbrechen"                                  | Komponententest                                      |
| 8   | Jeder Picker-Endpoint verweigert ohne Recht                                   | Integrationstest                                     |
| 9   | `DateField` rundet nicht und verschiebt keine Tage                            | Unit-Test über Zeitzonengrenzen                      |

**Doku:** `docs/ui/` je Komponente mit Props, Ereignissen, Slots und Beispiel.

---

# Phase 1 — Fachliche Slices (T-010 … T-035)

Jedes Paket folgt derselben inneren Reihenfolge: Schemata → Dienste →
Endpoints → Seiten → Tests → Doku ([07-ausfuehrung.md](07-ausfuehrung.md) §3).
Deshalb stehen unten nur die Besonderheiten.

## T-010 — Setup-Assistent und Firmeneinstellungen

**Features:** <!--IDS:T-010--> (<!--ANZAHL:T-010-->) · **Befunde:** <!--BEFUNDE:T-010-->
**Vorbedingungen:** T-007, T-009.

Acht Schritte, Zwischenspeicherung, Wiederaufnahme nach Neuladen, Abschluss
legt den ersten Administrator an und schaltet die Anwendung frei. Danach ist
`/setup` dauerhaft gesperrt. Firmenstammdaten, Logo, §19-Regelung,
Standard-Steuersatz, Zahlungsziel, Stundensatz, Endtext für Belege.
**Das Setup-Gate läuft serverseitig**, nicht im Client.

**Besondere Akzeptanzkriterien:** frische Datenbank → Assistent → Dashboard
ohne Umweg (E2E, Golden Flow G-01); ein zweiter Aufruf von `/setup` nach
Abschluss leitet um; ein Neuladen mitten im Assistenten verliert nichts.

## T-011 — Kunden und Lieferanten

**Features:** <!--IDS:T-011--> (<!--ANZAHL:T-011-->) · **Befunde:** <!--BEFUNDE:T-011-->
**Vorbedingungen:** T-009.

Das Referenzmodul: Liste mit Suche, Art-Filter, Archiv, Detailseite mit
Registerkarten, Formular, Archivieren und Reaktivieren, Löschwächter mit
vollständiger Zählung aller Verweise. Lieferanten bekommen dieselbe
Archiv-Bedienung (A-10). Kundenart wird ein ausdrückliches Feld (E-16).

**Besondere Akzeptanzkriterien:** ein geleertes Feld ist nach dem Speichern
leer (Regressionstest); der Löschwächter nennt **alle** verknüpften Arten auf
Deutsch und löscht nichts still; Golden Flow G-03.

## T-012 — Fahrzeuge, Dokumente, Fotos

**Features:** <!--IDS:T-012--> (<!--ANZAHL:T-012-->) · **Befunde:** <!--BEFUNDE:T-012-->
**Vorbedingungen:** T-011.

Fahrzeugliste mit Suche über alle Kennzeichen-Versionen, FIN, Marke, Modell,
Halter. Kennzeichen-Versionierung, Detailseite mit allen Registerkarten,
Dokumente (Upload als Multipart, Typprüfung über Magic Bytes), Fotos mit
serverseitiger Verkleinerung.

**Besondere Akzeptanzkriterien:** Suche findet ein Fahrzeug über ein
**früheres** Kennzeichen; eine als PDF getarnte Datei wird abgewiesen; ein
6000-px-Bild landet verkleinert in der Datenbank; Golden Flow G-04.

## T-013 — Bestand, Ankauf und Verkauf, Verkaufsschild

**Features:** <!--IDS:T-013--> (<!--ANZAHL:T-013-->) · **Befunde:** <!--BEFUNDE:T-013-->
**Vorbedingungen:** T-012, T-022 (Verkauf über Rechnung), T-023 (Schild).

Ankauf eines Kundenfahrzeugs in den Bestand mit Vorbesitzer-Schnappschuss,
Differenzbesteuerung, Verkaufsinserat mit eigener Oberfläche (E-13),
Verkaufsschild als A4-PDF, Verkauf über die bezahlte Rechnung.

**Besondere Akzeptanzkriterien:** Ankauf und Verkauf laufen je in einer
Transaktion; Fotos gibt es nur für Bestandsfahrzeuge (serverseitig
abgewiesen); der QR-Code des Schildes zeigt auf eine **erreichbare,
öffentliche** Adresse; Golden Flow G-12.

## T-014 — Artikel und Leistungen

**Features:** <!--IDS:T-014--> (<!--ANZAHL:T-014-->) · **Befunde:** <!--BEFUNDE:T-014-->
**Vorbedingungen:** T-009.

Katalog mit Kategorien, Einheiten, Steuersatz, Preisversionen (gültig ab),
Bildern, Kennzeichen „online buchbar".

**Besondere Akzeptanzkriterien:** der zum Belegdatum gültige Preis wird
aufgelöst, nicht der heutige; eine Preisänderung verändert **keinen**
bestehenden Beleg.

## T-015 — Reifenkatalog

**Features:** <!--IDS:T-015--> (<!--ANZAHL:T-015-->) · **Befunde:** <!--BEFUNDE:T-015-->
**Vorbedingungen:** T-014.

Eigene Stammdaten mit Dimension, Saison, Hersteller, EU-Label, Preisversionen
und Kennzeichen für den Onlineverkauf.

**Besondere Akzeptanzkriterien:** die Dimension wird zuverlässig zerlegt und
wieder zusammengesetzt (Unit-Tests über eine Tabelle realer Größen).

## T-016 — Reifeneinlagerung, Etiketten, Erinnerungen

**Features:** <!--IDS:T-016--> (<!--ANZAHL:T-016-->) · **Befunde:** <!--BEFUNDE:T-016-->
**Vorbedingungen:** T-015, T-023, T-026.

Einlagerungen mit Nummernkreis, Lagerplatz, QR-Etikett, Scan-Seite,
saisonale Erinnerungsmails an Kunden mit Zustimmung.

**Besondere Akzeptanzkriterien:** zweimaliges Auslösen der Erinnerung
verschickt **keine** zweite Mail; das Etikett enthält eine Adresse, die im
Betrieb tatsächlich erreichbar ist; Golden Flow G-13.

## T-017 — Mitarbeiter und Abwesenheiten

**Features:** <!--IDS:T-017--> (<!--ANZAHL:T-017-->) · **Befunde:** <!--BEFUNDE:T-017-->
**Vorbedingungen:** T-009, T-019 (Feiertage).

Stammdaten mit versionierten Gehältern, Abwesenheiten mit
feiertagsbewusster Arbeitstagszählung, halben Tagen, Urlaubsbudget,
Konfliktbehandlung zwischen Urlaub und Krankheit.

**Besondere Akzeptanzkriterien:** die Arbeitstagszählung stimmt für
Jahreswechsel, Schaltjahre, Feiertage und halbe Tage (Unit-Tabelle); die
Abwesenheitsliste aktualisiert sich nach einer Änderung sofort (der bekannte
Fehler des Bestands).

## T-018 — Zeiterfassung, Berichte, Öffnungszeiten

**Features:** <!--IDS:T-018--> (<!--ANZAHL:T-018-->) · **Befunde:** <!--BEFUNDE:T-018-->
**Vorbedingungen:** T-017.

Stundenerfassung mit Selbstbedienungsrecht, Auftragsbezug, Berichte über
Auslastung und Monat, Öffnungszeiten je Wochentag.

**Besondere Akzeptanzkriterien:** wer nur das Selbstbedienungsrecht hat,
sieht und ändert ausschließlich eigene Einträge — geprüft auf Endpoint-Ebene,
nicht nur in der Oberfläche; Golden Flow G-11.

## T-019 — Kalender, Feiertage, Terminplanung

**Features:** <!--IDS:T-019--> (<!--ANZAHL:T-019-->) · **Befunde:** <!--BEFUNDE:T-019-->
**Vorbedingungen:** T-009.

Monatsraster und Agenda, Termine, Betriebsschließungen, Abwesenheiten,
HU-Fälligkeiten und geplante Aufträge in einer Ansicht; berechnete Feiertage
für alle sechzehn Bundesländer; Grundlage für freie Termine.

**Besondere Akzeptanzkriterien:** Feiertage stimmen für alle Bundesländer
über mehrere Jahre (Unit-Tabelle); die Slot-Berechnung ist von der
Server-Zeitzone unabhängig (Test mit abweichender Umgebungszeitzone);
Golden Flow G-10.

## T-020 — Aufträge (Kanban-Arbeitsaufträge)

**Features:** <!--IDS:T-020--> (<!--ANZAHL:T-020-->) · **Befunde:** <!--BEFUNDE:T-020-->
**Vorbedingungen:** T-012, T-014, T-018, T-019.

Kanban mit drei Spalten, Mehrfachzuweisung von Mitarbeitern,
Arbeitspositionen mit Preis-Schnappschuss, Terminverknüpfung, Abschluss
erzeugt die Rechnung.

**Besondere Akzeptanzkriterien:** je Auftrag höchstens **eine** aktive
Rechnung (durch die Datenbank abgesichert, nicht nur durch Code); Abschluss
und Rechnungserzeugung laufen in einer Transaktion; Ziehen und Ablegen hat
eine Tastaturalternative; Golden Flow G-05.

## T-021 — Belege-Grundlage und Angebote

**Features:** <!--IDS:T-021--> (<!--ANZAHL:T-021-->) · **Befunde:** <!--BEFUNDE:T-021-->
**Vorbedingungen:** T-011, T-014, T-006.

Gemeinsames Belegmodell, Positionen-Editor mit Live-Summen und gemischten
Steuersätzen, Angebote und Kostenvoranschläge, Umwandlung in eine Rechnung.

**Besondere Akzeptanzkriterien:** Positionsrechnung stimmt bei gemischten
Sätzen, Rabatten und Rundung auf den Cent (Unit-Tabelle); ein Steuersatz von
0 % bleibt 0 % (Regressionstest); die Umwandlung überträgt jede Position
unverändert.

## T-022 — Rechnungen, Zahlungen, Storno

**Features:** <!--IDS:T-022--> (<!--ANZAHL:T-022-->) · **Befunde:** <!--BEFUNDE:T-022-->
**Vorbedingungen:** T-021, T-023.

Rechnungen mit Statusautomat, echte Zahlungserfassung inklusive Teilzahlungen
(E-14), Storno mit Gegenbeleg und automatischem Wiederöffnen des Auftrags,
GoBD-Löschschutz.

**Besondere Akzeptanzkriterien:** jeder unerlaubte Statuswechsel wird
serverseitig mit 409 abgewiesen; Storno erzeugt Beleg **und** PDF in einer
Transaktion; eine ausgestellte Rechnung lässt sich nicht löschen; Golden
Flows G-06 und G-07.

## T-023 — PDF-Pipeline

**Features:** <!--IDS:T-023--> (<!--ANZAHL:T-023-->) · **Befunde:** <!--BEFUNDE:T-023-->
**Vorbedingungen:** T-010 (Firmendaten), T-021.

Portierung aller Vorlagen: Rechnung, Storno, Angebot, Kostenvoranschlag,
Auftragsbestätigung, Zahlungserinnerung, Verkaufsschild, Reifenetikett.
Zwischenspeicher in der Datenbank, getrennte Endpoints für Metadaten und
Bytes, Vorschau im Browser.

**Besondere Akzeptanzkriterien:** die Ausgabe ist byte-gleich bei zwei Läufen;
die Pixel-Vergleichssuite gegen die übernommenen Vergleichsbilder ist grün;
Umlaute, lange Texte und mehrseitige Belege stimmen; Listenabfragen laden
niemals Bytes.

## T-024 — XRechnung

**Features:** <!--IDS:T-024--> (<!--ANZAHL:T-024-->) · **Befunde:** <!--BEFUNDE:T-024-->
**Vorbedingungen:** T-022.

EN-16931-konformes XML je Rechnung, mit den in
[02-befunde.md](02-befunde.md) belegten Formatfehlern behoben.

**Besondere Akzeptanzkriterien:** die erzeugte Datei besteht eine Prüfung
gegen das Schema; interne Notizen erscheinen **nicht** im XML; ein Storno
trägt den richtigen Belegtyp; Rabatte erscheinen als solche.

## T-025 — Zahlungserinnerungen

**Features:** <!--IDS:T-025--> (<!--ANZAHL:T-025-->) · **Befunde:** <!--BEFUNDE:T-025-->
**Vorbedingungen:** T-022, T-026.

Liste offener Rechnungen mit Verzugstagen und offenem Betrag (Teilzahlungen
berücksichtigt), manueller und stapelweiser Versand, Wiederholung nach
Intervall, Einstellungen, Verlauf.

**Besondere Akzeptanzkriterien:** ohne E-Mail-Adresse oder bei SMTP-Fehler
meldet die Oberfläche **keinen** Erfolg; zweimaliges Auslösen am selben Tag
verschickt nichts doppelt; der offene Betrag zieht Teilzahlungen ab; Golden
Flow G-09.

## T-026 — SMTP, Vorlagen, Versand, Gesendet

**Features:** <!--IDS:T-026--> (<!--ANZAHL:T-026-->) · **Befunde:** <!--BEFUNDE:T-026-->
**Vorbedingungen:** T-006, T-010.

Transport mit Zeitüberschreitungen, verschlüsseltem Passwort und Testversand;
Vorlagen mit Platzhaltern; Versanddialog mit Anhängen; Protokoll aller
ausgehenden Nachrichten.

**Besondere Akzeptanzkriterien:** jeder Versand erzeugt genau einen
Protokolleintrag mit richtigem Typ; ein SMTP-Fehler landet als kuratierte
deutsche Meldung beim Nutzer und im Protokoll als Fehlschlag; Kopfzeilen sind
gegen Einschleusung geschützt.

## T-027 — Rundschreiben

**Features:** <!--IDS:T-027--> (<!--ANZAHL:T-027-->) · **Befunde:** <!--BEFUNDE:T-027-->
**Vorbedingungen:** T-026.

Empfängerkreis aus zugestimmten Kunden, Versand in Blindkopie-Blöcken,
Abbestellhinweis und Kopfzeile, Verlauf je Empfänger.

**Besondere Akzeptanzkriterien:** ein fehlgeschlagener Block bricht den Rest
nicht ab; der Verlauf aktualisiert sich nach dem Versand ohne Neuladen; nur
Kunden mit Zustimmung erscheinen.

## T-028 — Buchhaltung und DATEV-Export

**Features:** <!--IDS:T-028--> (<!--ANZAHL:T-028-->) · **Befunde:** <!--BEFUNDE:T-028-->
**Vorbedingungen:** T-006, T-022.

Buchungen mit Kategorien, Monatsansicht, Summen, Export als
DATEV-Buchungsstapel.

**Besondere Akzeptanzkriterien:** die Exportdatei hat die erwartete Kopfzeile,
Zeichenkodierung und Feldreihenfolge (Vergleich gegen eine
Referenzdatei); Beträge und Datumsangaben sind exakt; der Download
funktioniert auch bei großen Zeiträumen; Golden Flow G-14.

## T-029 — Rechnungsausgangsbuch

**Features:** <!--IDS:T-029--> (<!--ANZAHL:T-029-->) · **Befunde:** <!--BEFUNDE:T-029-->
**Vorbedingungen:** T-022, T-028.

Lesesicht über die Rechnungen mit Zeitraum, Summen und Blätterung.

**Besondere Akzeptanzkriterien:** Umsatz ist genauso definiert wie im
DATEV-Export (E-15); Zeitraumgrenzen stimmen auch am Monatsanfang und
-ende in deutscher Zeit.

## T-030 — Beiträge und Kundenanfragen

**Features:** <!--IDS:T-030--> (<!--ANZAHL:T-030-->) · **Befunde:** <!--BEFUNDE:T-030-->
**Vorbedingungen:** T-009, T-026.

Nachrichtenbeiträge für die Website mit Veröffentlichungsstatus, Titelbild und
stabilen Adressen; Posteingang für Anfragen aus dem Kontaktformular
**mit sichtbarem Nachrichtentext und Bearbeitungsstatus** (A-13).

**Besondere Akzeptanzkriterien:** eine Titeländerung ändert die öffentliche
Adresse nicht; unveröffentlichte Beiträge sind von außen unsichtbar; eine
Anfrage lässt sich als erledigt markieren und einem Kunden zuordnen.

## T-031 — Öffentliche REST-API

**Features:** <!--IDS:T-031--> (<!--ANZAHL:T-031-->) · **Befunde:** <!--BEFUNDE:T-031-->
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

**Features:** <!--IDS:T-032--> (<!--ANZAHL:T-032-->) · **Befunde:** <!--BEFUNDE:T-032-->
**Vorbedingungen:** T-006, T-010.

Verbindung über OAuth mit verschlüsselten Token, Pflichtendpunkt für
Kontolöschungen, Import der Angebote.

**Besondere Akzeptanzkriterien:** der Prüf-Handschlag erzeugt exakt den
erwarteten Hashwert (Test mit festen Werten); Token erscheinen in keinem
Protokoll; der Import ist wiederholbar, ohne Dubletten zu erzeugen.

## T-033 — Legacy-Import (KFZ-Kaufmann)

**Features:** <!--IDS:T-033--> (<!--ANZAHL:T-033-->) · **Befunde:** <!--BEFUNDE:T-033-->
**Vorbedingungen:** alle fachlichen Slices, deren Tabellen der Import füllt.

Hochladen der Access-Datei, Vorschau ohne Speichern, Import mit Fortschritt
und Bericht, Nummernkreise werden fortgeführt. Zusätzlich abgesichert durch
ausdrückliche Bestätigung und die Bedingung „Datenbank praktisch leer" (E-19).

**Besondere Akzeptanzkriterien:** die Vorschau schreibt nachweislich nichts;
der Import läuft in einer Transaktion oder bricht folgenlos ab; alle Tabellen
werden **vor** dem Leeren gelesen; Dateinamen werden nie in eine Shell
gereicht.

## T-034 — Benutzer, Rollen, eigenes Konto

**Features:** <!--IDS:T-034--> (<!--ANZAHL:T-034-->) · **Befunde:** <!--BEFUNDE:T-034-->
**Vorbedingungen:** T-007.

Verwaltung von Benutzern und Rollen mit Rechtematrix, Passwortzurücksetzung
durch die Verwaltung, Deaktivierung, eigenes Passwort ändern.

**Besondere Akzeptanzkriterien:** der letzte **aktive** Inhaber aller Rechte
lässt sich weder löschen noch deaktivieren noch entrechten (der Bestand prüft
den Aktiv-Zustand nicht); eine Passwortänderung beendet die übrigen
Sitzungen; Benutzernamen lassen sich nicht über einen Umweg selbst ändern;
Golden Flow G-15.

## T-035 — Dashboard und globale Suche

**Features:** <!--IDS:T-035--> (<!--ANZAHL:T-035-->) · **Befunde:** <!--BEFUNDE:T-035-->
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

**Features:** <!--IDS:T-036--> (<!--ANZAHL:T-036-->) · **Befunde:** <!--BEFUNDE:T-036-->
**Vorbedingungen:** T-008.

Installierbarkeit, Manifest, Symbole. **Der Zwischenspeicher fasst
ausschließlich statische Bestandteile** — keine Antworten mit Geschäftsdaten
und keine Sitzungsauskünfte (schwerer Befund des Bestands). Hinweis auf eine
neue Version mit Schaltfläche zum Neuladen.

**Besondere Akzeptanzkriterien:** nach dem Besuch mehrerer Seiten enthält der
Zwischenspeicher keinen Eintrag unter `/api/`; eine neue Version wird erkannt
und angeboten.

## T-037 — Leistung, Indizes, Lastverhalten

**Features:** — · **Befunde:** <!--BEFUNDE:T-037-->
**Vorbedingungen:** alle fachlichen Slices.

Messung der Listen- und Detailabfragen gegen eine Datenbank mit realistischer
Menge, Beseitigung von N+1-Abfragen, Ergänzung fehlender Indizes,
Begrenzung der Antwortgrößen.

**Besondere Akzeptanzkriterien:** jede Listenabfrage bleibt unter 200 ms bei
50 000 Kunden und 100 000 Belegen; kein Endpoint erzeugt mehr als fünf
Abfragen; keine Antwort überschreitet 500 KB ohne Anhang.

## T-038 — Barrierefreiheit und Bewegungsreduktion

**Features:** — · **Befunde:** <!--BEFUNDE:T-038-->
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

**Features:** — · **Befunde:** <!--BEFUNDE:T-041-->
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

Sicherung, Anwendung der Baseline auf die Produktionsdatenbank,
Übernahme-Skript für die Migrationstabelle, Umschalten des Containers,
Nachlauf; Verschiebung von `nuxt/` ins Repo-Root, Entfernen des Altbestands
und der überholten Dokumentationsseiten.

**Besondere Akzeptanzkriterien:** der Umstieg ist an einer Kopie der
Produktionsdatenbank vollständig geprobt; bestehende Anmeldungen
funktionieren ohne Passwortzurücksetzung; ein Rückweg ist beschrieben und
einmal durchgespielt.

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
        T-036 → T-037 → T-038 → T-039 → T-040 → T-041 → T-042
```

Begründung der weniger offensichtlichen Kanten:

- **T-023 vor T-022**: Rechnungen speichern ihr PDF beim Ausstellen; ohne
  Renderer wäre der Statusautomat nur halb prüfbar.
- **T-019 vor T-017**: die Abwesenheitsrechnung braucht die Feiertage.
- **T-013 nach T-022**: der Fahrzeugverkauf läuft über eine bezahlte Rechnung.
- **T-033 zuletzt in Phase 1**: der Import füllt fast jede Tabelle.
- **T-035 zuletzt**: Dashboard und Suche greifen auf alle Module zu.
