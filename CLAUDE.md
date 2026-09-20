# CLAUDE.md — TwinCarsManager (Nuxt)

Verwaltungsanwendung eines kleinen deutschen Kfz-Betriebs: Werkstatt,
Reifenhandel, Gebrauchtwagenhandel. **Oberfläche deutsch, Code englisch.**

- Plan für den Rewrite: `docs/rewrite/` — dort ist alles verbindlich
  festgelegt.
- Produktdokumentation: `docs/index.md`.
- **Der alte SvelteKit-Bestand ist seit dem 20.09.2026 nicht mehr Teil dieses
  Repositorys.** Er war ein Proof of Concept und liegt als Archiv außerhalb
  (`../twincars-manager-sveltekit-poc-2026-09-20.tar.gz`). Was er konnte,
  steht im Inventar (`docs/rewrite/01-inventar.md`) und in den Befunden
  (`02-befunde.md`) — dort wird nachgelesen, nicht im alten Code.

## Harte Regeln — nicht verhandelbar

1. **pnpm** ausschließlich. Kein npm, kein yarn, keine `package-lock.json`.
2. **ESLint formatiert.** Prettier existiert nicht — nicht als Abhängigkeit,
   nicht als Konfiguration, auch nicht mittelbar über `eslint-plugin-format`.
3. **Kein eigenes CSS.** Genau eine Datei: `app/assets/css/main.css` mit den
   beiden Pflicht-Imports und den Design-Tokens. **Keine `<style>`-Blöcke.**
   Aussehen und Varianten kommen aus `app/app.config.ts`. Tailwind-Klassen nur
   für Layout und so wenige wie möglich.
4. **Nuxt UI zuerst**, dann Nuxt/Nitro, dann Eigenbau, zuletzt ein Fremdpaket.
   Jedes neue Paket braucht einen Eintrag in
   `./docs/rewrite/08-entscheidungen.md`.

   **Nuxt UI wird benutzt, wie es kommt.** Keine Slot-Überschreibungen in
   `app.config.ts` außer den Farben, keine eigenen Varianten, kein Nachbau
   einer Komponente, die es schon gibt. Nuxt UI v4 hat **über 125**
   Komponenten — vor jedem Eigenbau wird dort nachgesehen, nicht geschätzt.
   Namentlich vorhanden und am 20.09.2026 als Nachbau vorgefunden: `UTable`,
   `UTimeline`, `UEmpty`, `UFileUpload` (`variant="area"`), `UPageCard`.

   Was Nuxt UI **nicht** kann, wird zur offenen Frage (Regel 15) — nicht zu
   einer eigenen Komponente, die nebenher so aussieht wie die anderen. Die
   einzige Ausnahme sind Lücken in der **Zugänglichkeit**: fehlt einem
   Fremdpaket ein `aria-busy`, wird es am eigenen umgebenden Element ergänzt,
   statt in das Paket hineinzugreifen.
5. **Valibot an jeder Grenze**: Body, Query, Routenparameter, Header,
   Formulare, Umgebungsvariablen, Antworten externer Dienste, Uploads.
   Schemata liegen **nur** in `shared/schemas/`. Typen mit `v.InferOutput`
   ableiten, niemals daneben deklarieren.
6. **Guard als erste Anweisung** in jedem Endpoint:
   `requirePermission(event, '<modul>')`.
7. **Serverseitige Pagination, fest 25.** Kein Größenwähler. Filterwechsel
   setzt auf Seite 1.
8. **Toast bei jeder Mutation** — Erfolg wie Fehler, über `useNotify()`.
9. **Ein einziger Ladezustand**, `useBusy()`, in drei Stufen — und keine
   zweite Anzeige daneben:

   | Stufe | Wann | Was der Nutzer sieht |
   | --- | --- | --- |
   | 1 | jede laufende Anfrage | der Balken von `<NuxtLoadingIndicator>` — die **einzige** Ladeleiste |
   | 2 | eine angeklickte Aktion | der Knopf selbst: `UButton :loading` bzw. `loading-auto` |
   | 3 | länger als 250 ms | Sperrfläche über dem Inhalt, **mit Symbol und deutschem Satz** |

   Dazu je Ort das Passende aus Nuxt UI: `UTable :loading` für die Tabelle,
   `UEmpty :loading` für die noch leere Liste, `USkeleton` für einen
   Platzhalter, der die spätere Form andeutet. Ein `let loading = ref(false)`
   in einer Seite ist ein Regelverstoß, keine Geschmacksfrage.
10. **Mehrfachauswahl immer im modalen Dialog.**
11. **Animationen** nach `./docs/rewrite/04-ux.md` §3.2, inklusive
    `prefers-reduced-motion`.
12. **Testselektoren**: `data-testid` oder Rolle mit zugänglichem Namen.
    Niemals interne Nuxt-UI-Klassen.
13. **Transaktion**, sobald mehr als eine Anweisung schreibt.
14. **Tests und Doku gehören zum Paket.** Ohne sie ist nichts fertig.
15. **Offene Fragen in eigene Dateien.** Alles, was einen Haken hat, über eine
    Vorgabe hinausgeht oder eine Entscheidung braucht, bekommt eine eigene
    Markdown-Datei unter `./docs/rewrite/offene-fragen/` und einen Eintrag in
    deren `README.md`. Nicht im Fließtext vergraben, nicht im Chat verloren.

## Befehle

```bash
pnpm dev              # Entwicklungsserver auf :3000
pnpm verify           # lint + typecheck + alle Tests + docs:check
pnpm lint             # ESLint; lint:fix formatiert
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

Skripte, die `[noch nicht umgesetzt]` melden, stammen aus einem Arbeitspaket,
das noch aussteht — die Meldung nennt es.

## Aufbau

```
app/       Oberfläche: pages, components, composables, layouts, middleware
server/    api/ (dünn) · services/ (Fachlogik) · database/ · utils/ · tasks/
shared/    schemas/ (Valibot) · permissions.ts · types/ — Client und Server
test/      unit/ nuxt/ browser/ integration/ e2e/ factories/
```

Drei Ebenen im Server, klar getrennt:

- `server/api/**` — Guard, Validierung, Service-Aufruf. Sonst nichts.
- `server/services/**` — Fachlogik und Drizzle. Bekommt einfache Argumente,
  **nie** das Event.
- `server/utils/**` — Infrastruktur: Verbindung, Krypto, Mail, PDF, Guards.

## Endpoint-Muster

```ts
export default defineEventHandler(async (event) => {
  requirePermission(event, 'customers')                      // 1. Guard
  const query = await useValidatedQuery(event, customerListSchema) // 2. Valibot
  return listCustomers(query)                                // 3. Service
})
```

## Fehler

Jeder Fehler entsteht über `server/utils/errors.ts` (`notFound`, `forbidden`,
`conflict`, `validationFailed`, …) und erreicht den Nutzer als **deutscher
Satz**. 422 trägt Feldfehler, die das Formular direkt anzeigt. 5xx geben nie
Interna preis. Im Client kapselt `useApi()` jeden Aufruf.

## Wo steht was

| Frage | Datei |
| --- | --- |
| Was muss ein Feature können? | `./docs/rewrite/01-inventar.md` (`F-nnn`) |
| Welche Fehler hatte der Vorgänger? | `./docs/rewrite/02-befunde.md` (`B-nnn`) |
| Wie ist es technisch gedacht? | `./docs/rewrite/03-architektur.md` |
| Wie soll es sich bedienen? | `./docs/rewrite/04-ux.md` |
| Was heißt „getestet"? | `./docs/rewrite/05-teststrategie.md` |
| Was ist als Nächstes dran? | `./docs/rewrite/06-arbeitsplan.md` |
| Wie arbeite ich ein Paket ab? | `./docs/rewrite/07-ausfuehrung.md` |
| Was wurde entschieden? | `./docs/rewrite/08-entscheidungen.md` |
