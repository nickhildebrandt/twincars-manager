# TwinCarsManager (Nuxt)

Verwaltungsanwendung für einen kleinen Kfz-Betrieb: Werkstatt, Reifenhandel
und Gebrauchtwagenhandel. Diese Anwendung ersetzt schrittweise die
SvelteKit-Fassung im Repository-Wurzelverzeichnis.

> Der Umbau läuft nach dem Plan in [`../docs/rewrite/`](../docs/rewrite/).
> Verbindliche Regeln für die Entwicklung stehen in [`CLAUDE.md`](CLAUDE.md).

## Schnellstart

```bash
cp .env.example .env       # DATABASE_URL und APP_SECRET eintragen
pnpm install
pnpm dev                   # http://localhost:3000
```

Voraussetzungen: Node ≥ 24.11, pnpm, PostgreSQL ≥ 17.

## Stack

| Bereich | Wahl |
| --- | --- |
| Framework | Nuxt 4 |
| Oberfläche | Nuxt UI 4 (Tailwind v4, Reka UI) |
| Validierung | Valibot — an jeder Grenze |
| Datenbank | PostgreSQL + Drizzle ORM |
| Authentifizierung | better-auth (Benutzername + Passwort) |
| Tests | Vitest + `@nuxt/test-utils` + Playwright |
| Lint und Format | ESLint mit Stylistic — **kein Prettier** |
| Freigabe | semantic-release, Conventional Commits |

## Befehle

Siehe [`CLAUDE.md`](CLAUDE.md#befehle). Die wichtigsten:
`pnpm dev`, `pnpm verify`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Verzeichnisse

```
app/     Oberfläche (Seiten, Komponenten, Composables)
server/  API-Endpunkte, Fachlogik, Datenbank, Aufgaben
shared/  Valibot-Schemata, Berechtigungen, abgeleitete Typen
test/    unit · nuxt · browser · integration · e2e
```
