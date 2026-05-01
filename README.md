# TwinCarsManager

Moderne Web-App für einen kleinen Kfz-Betrieb mit Werkstatt **und** Gebrauchtwagen-Handel — Nachfolger der alten Access-basierten "Kfz-Kaufmann"-Software.

Diese Anwendung verwaltet Kunden, Fahrzeuge, Angebote, Rechnungen, Mahnungen, Termine, Mitarbeiter, Lohn, Buchhaltung, Fahrzeugbestand mit Verkaufsschildern, Serienbriefe und liefert Controlling-Auswertungen. Außerdem importiert sie alte `.mdb`-Datenbanken aus dem Vorgängersystem.

## Inhaltsverzeichnis

1. [Technologiestack](#technologiestack)
2. [Voraussetzungen](#voraussetzungen)
3. [Installation und lokales Setup](#installation-und-lokales-setup)
4. [Umgebungsvariablen](#umgebungsvariablen)
5. [Datenbank-Setup und Migrationen](#datenbank-setup-und-migrationen)
6. [Start im Dev-Modus](#start-im-dev-modus)
7. [Build und Produktionsbetrieb](#build-und-produktionsbetrieb)
8. [Deployment mit adapter-node](#deployment-mit-adapter-node)
9. [PWA-Hinweise](#pwa-hinweise)
10. [First Setup Wizard](#first-setup-wizard)
11. [Architekturübersicht](#architekturübersicht)
12. [Datenmodell](#datenmodell)
13. [Module](#module)
14. [E-Mail-Versand](#e-mail-versand)
15. [PDF-Erstellung und Vorschau](#pdf-erstellung-und-vorschau)
16. [Validierung](#validierung)
17. [Listen, Pagination, Suche, Filter](#listen-pagination-suche-filter)
18. [Eingabe- und Upload-Limits](#eingabe--und-upload-limits)
19. [Globale Ladeanzeige](#globale-ladeanzeige)
20. [Backup / Export](#backup--export)
21. [Testing](#testing)
22. [Code-Formatierung mit Prettier + Husky](#code-formatierung-mit-prettier--husky)
23. [Bekannte Einschränkungen](#bekannte-einschränkungen)
24. [Hinweise zur Weiterentwicklung](#hinweise-zur-weiterentwicklung)

---

## Technologiestack

| Bereich              | Wahl                                           | Warum                                          |
| -------------------- | ---------------------------------------------- | ---------------------------------------------- |
| Framework            | **SvelteKit** + Svelte 5 (Runes)               | Modern, schnell, klare Reaktivität             |
| Server-Kommunikation | **Remote Functions** (`*.remote.ts`)           | Typed query/command + automatischer HTTP/Cache |
| Validierung          | **Valibot**                                    | Modular, schnell, deutlich kleiner als Zod     |
| Datenbank            | **PostgreSQL** + **Drizzle ORM** + Drizzle Kit | Saubere Migrationen, typsicher                 |
| Styles               | **TailwindCSS v4** + **DaisyUI v5**            | Konsistentes Design-System, Theme-fähig        |
| Icons                | **@lucide/svelte**                             | Modernes, einheitliches Icon-Set               |
| Charts               | **Chart.js**                                   | Verbreitet, anpassbar (für Controlling-Modul)  |
| PDF                  | **pdf-lib** + **pdfjs-dist**                   | PDF-Erzeugung und Vorschau im Browser          |
| Mail                 | **nodemailer**                                 | Reiner SMTP-Versand                            |
| Adapter              | **@sveltejs/adapter-node**                     | Plain Node-HTTP, einfach zu hosten             |
| Tests                | **Vitest** + **@testing-library/svelte**       | Unit + Komponententest, Co-Lokation            |
| Coverage             | **@vitest/coverage-v8**                        | Genaue Coverage-Reports                        |
| Format / Hooks       | **Prettier** + **Husky** + **lint-staged**     | Pre-Commit-Hook formatiert automatisch         |

Weitere Hilfen: `date-fns`, `nanoid`, `file-type`, `ibantools`, `sanitize-filename`, `mime`.

## Voraussetzungen

- Node.js **≥ 22**
- PostgreSQL **≥ 14** (lokal getestet mit 17)
- Optional: `mdbtools` (für MDB-Import)

## Installation und lokales Setup

```bash
git clone <repo> twincars-manager
cd twincars-manager
npm install
cp .env.example .env
# DATABASE_URL und APP_ENCRYPTION_KEY in .env anpassen
npm run db:migrate
npm run dev
```

Beim ersten Aufruf von `http://localhost:5173/` werden Sie automatisch zum **First Setup Wizard** weitergeleitet.

## Umgebungsvariablen

| Name                 | Pflicht | Beschreibung                                             |
| -------------------- | ------- | -------------------------------------------------------- |
| `DATABASE_URL`       | ja      | Postgres-Connection-String                               |
| `APP_ENCRYPTION_KEY` | ja      | Schlüssel für AES-GCM-Verschlüsselung des SMTP-Passworts |
| `NODE_ENV`           | nein    | `development` / `production`                             |

Beispiel `.env`:

```env
DATABASE_URL=postgres://admin:TwinCars2026!@localhost:5432/twincars-manager
APP_ENCRYPTION_KEY=please-change-me-in-production-32bytes
NODE_ENV=development
```

`.env` und `.env.*` werden über `.gitignore` ausgeschlossen — `.env.example` ist die Vorlage.

## Datenbank-Setup und Migrationen

```bash
npm run db:generate     # Drizzle-Migrations aus dem Schema erzeugen
npm run db:migrate      # Migrationen auf der Ziel-DB anwenden
npm run db:push         # Schema direkt pushen (Dev only)
npm run db:studio       # Drizzle Studio öffnen
```

Beim Start des SvelteKit-Servers werden ausstehende Migrationen automatisch durch den Server-Hook
`src/hooks.server.ts → runMigrations()` angewendet, anschließend werden Default-Datensätze
(Mailvorlagen, Nummernkreise, Buchhaltungs-Kategorien usw.) per `seedDefaults()` nachgezogen — idempotent.

## Start im Dev-Modus

```bash
npm run dev          # Vite-Dev-Server auf http://localhost:5173
```

## Build und Produktionsbetrieb

```bash
npm run build        # Build erzeugt einen Node-Server in /build
npm run preview      # Lokal anschauen
node build           # Server starten (PORT=3000 default)
```

## Deployment mit adapter-node

Der erzeugte Output unter `/build` ist ein klassischer Node-HTTP-Server (`@sveltejs/adapter-node`).

- **Standard-HTTP**, kein eingebautes HTTPS, kein mTLS, keine Cipher-Konfiguration.
- TLS-Terminierung erfolgt — falls überhaupt benötigt — durch einen vorgelagerten **Reverse Proxy**
  (z. B. Caddy oder Nginx).
- Empfohlen: PM2 oder systemd zum Halten des Prozesses; `process.on('uncaughtException')` und
  `'unhandledRejection'` werden geloggt, der Prozess wird ggf. neu gestartet.

## PWA-Hinweise

Die Anwendung kann als PWA erweitert werden (Service Worker via SvelteKit nativ, kein
zusätzliches Paket). Aktuell ist noch kein Manifest und Service Worker ausgeliefert — diese
Bausteine werden in einer Folgeiteration ergänzt.

## First Setup Wizard

Solange `setupCompleted` in `company_settings` `false` ist, leitet die App jede Route auf `/setup`.
Der Wizard hat **6 Schritte**:

1. **Willkommen**
2. **Firmen-Kerndaten** (Pflicht: Name, Anschrift, Telefon, E-Mail, Bundesland)
3. **Steuer und Bank** (Pflicht: Steuernummer, IBAN, BIC, Bankname)
4. **Logo und Anrede-Stil** (Logo-Upload Pflicht, Sie/Du)
5. **E-Mail-Versand (SMTP)** (Host, Port, Auth, Absender — Passwort wird AES-GCM-verschlüsselt gespeichert)
6. **Daten aus Kfz-Kaufmann importieren** (Jetzt / Später / Frischstart) und Abschluss

Beim Abschluss werden u. a. **deutsche Standard-Mailvorlagen**, Standardkategorien für die
Buchhaltung und Standard-Nummernkreise in der Datenbank gesetzt — die App ist sofort produktiv.

## Architekturübersicht

```
src/
├── app.css                       Tailwind + DaisyUI-Imports
├── app.d.ts / app.html
├── hooks.ts                      Remote-Function-Transport-Map
├── hooks.server.ts               Migrationen & Seed beim Start
├── lib/
│   ├── components/
│   │   ├── layout/               AppShell, PageHeader, Navigation
│   │   └── ui/                   Pagination, Toolbar, EmptyState, ConfirmDialog,
│   │                             StatCard, ToastTray, ComingSoon
│   ├── server/
│   │   ├── db/
│   │   │   ├── client.ts         Drizzle-Client (Postgres-Pool)
│   │   │   ├── schema.ts         vollständiges Schema
│   │   │   ├── validation.ts     wiederverwendbare Valibot-Schemas
│   │   │   ├── migrate.ts        Migrationsläufer
│   │   │   └── seed-defaults.ts  Default-Daten (Mailvorlagen, Kategorien, Nummernkreise)
│   │   ├── services/             Repository/Service-Layer pro Domäne
│   │   └── utils/crypto.ts       AES-GCM für SMTP-Passwort
│   ├── stores/                   $state-basierte Stores (Toast)
│   └── utils/                    money, numbering, pagination, client-error
└── routes/
    ├── +layout.{server.ts,svelte}     Setup-Gate / AppShell
    ├── +page.svelte                   Dashboard
    ├── setup/                         First Setup Wizard
    ├── customers/                     Kunden (List/Detail/New/Edit)
    ├── vehicles/                      Fahrzeuge (List/Detail/New/Edit)
    └── … weitere Module (Stub-Pages mit `ComingSoon`)
```

**Remote Functions** (`*.remote.ts`):

- `query(schema?, fn)` — Lesen, mit reaktivem Cache
- `command(schema?, fn)` — Schreiben, mit `.refresh()` / optimistischem Update über `.withOverride()`
- Schemas immer mit Valibot, Fehler über `error(status, msg)`

## Datenmodell

Vollständiges Schema in `src/lib/server/db/schema.ts`. Auswahl der wichtigsten Tabellen:

| Tabelle                                                      | Zweck                                                       |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| `company_settings`                                           | Firmen-Stammdaten + Setup-Status + Logo                     |
| `smtp_settings`                                              | SMTP-Konfiguration (Passwort verschlüsselt)                 |
| `mail_templates`                                             | Editierbare Vorlagen für alle Mail-Anlässe                  |
| `number_ranges`                                              | Format und nächster Wert je Nummernkreis                    |
| `customers`                                                  | Kunden inkl. Bank, Anschrift, Notizen, Archiv-Flag          |
| `vehicles`                                                   | Eine Tabelle für Kunden- und Bestandsfahrzeuge              |
| `vehicle_purchases / _listings / _photos / _sales`           | Bestand, Verkaufsschild-Daten, Foto-Galerie, Verkäufe       |
| `documents` + `document_items`                               | Gemeinsames Dokumentenmodell (Rechnung, Angebot, Mahnung …) |
| `document_payments`                                          | Zahlungseingänge je Dokument                                |
| `items` / `suppliers`                                        | Artikel/Leistungen, Lieferantenstamm                        |
| `appointments` / `business_closures` / `public_holidays`     | Kalender                                                    |
| `employees` / `employee_absences`                            | Mitarbeiter mit Abwesenheiten (Urlaub, Krank)               |
| `payroll_periods` / `payroll_entries`                        | Lohnperioden und Lohnabrechnungen                           |
| `ledger_categories` / `ledger_entries` / `recurring_entries` | Buchhaltung mit wiederkehrenden Vorlagen                    |
| `sent_messages`                                              | Versand-Historie für E-Mails                                |
| `access_import_jobs`                                         | Lauf-Protokoll des MDB-Imports                              |

## Module

Die UI ist über die linke **DaisyUI-Sidebar** in folgende Bereiche gegliedert:

| Bereich               | Module                                                           | Status                                          |
| --------------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| Übersicht             | Dashboard, Kalender                                              | Dashboard live, Kalender Stub                   |
| Kunden & Fahrzeuge    | Kunden, Fahrzeuge, Fahrzeugbestand, Termine                      | Kunden + Fahrzeuge live, Bestand + Termine Stub |
| Aufträge & Rechnungen | Angebote/KV, Rechnungen, Offene/Mahnungen, Rechnungsausgangsbuch | Stubs                                           |
| Stammdaten            | Leistungen/Material/Artikel, Lieferanten                         | Stubs                                           |
| Personal              | Mitarbeiter, Lohn und Gehalt                                     | Stubs                                           |
| Finanzen              | Buchhaltung, Controlling                                         | Stubs                                           |
| Kommunikation         | Serienbriefe, Gesendet                                           | Stubs                                           |
| System                | Einstellungen, Import (Kfz-Kaufmann)                             | Stubs                                           |

**Kunden** und **Fahrzeuge** sind end-to-end implementiert (Liste mit serverseitiger Pagination,
Suche, Filter, sortierte Tabelle, Detailansicht, Form für Neu/Bearbeiten, Lösch-Bestätigung,
Toast-Feedback). Sie dienen als verbindliche Vorlage für die übrigen Module.

Die Stub-Module zeigen einen einheitlichen "In Vorbereitung"-Block mit konkreter Feature-Liste,
sodass beim Ausbau klar ist, was zu liefern ist.

### Dashboard

KPI-Kacheln (Kunden, Fahrzeuge, offene Rechnungen, Mahnungen, Umsatz aktueller Monat, Termine heute),
eine Karte mit Schnell-Aktionen und ein Hinweisbereich. Die Werte werden in einer Folgeiteration aus
den jeweiligen Repositories befüllt.

### Kunden

- Liste mit Pagination (10/25/50/100), Volltextsuche über Name/Kundennr./Ort/Telefon/E-Mail,
  Filter aktiv/archiviert/alle.
- Detailansicht mit Anschrift, Kontakt, Notizen.
- Form für Neu und Bearbeiten mit Inline-Validierung (mind. Firma oder Nachname, gültige E-Mail).
- Lösch-Bestätigung über `ConfirmDialog`, anschließend Toast-Erfolg.
- Komplett über Remote Functions.

### Fahrzeuge

- Eine Stammdatentabelle für Kunden- und Bestandsfahrzeuge (`customerId` ist nullable).
- Liste mit Suche über Kennzeichen, FIN, Marke, Modell.
- Form mit allen Kfz-Daten: Erstzulassung, km-Stand, HU, HSN/TSN, Hubraum, kW, Kraftstoff, Getriebe.
- Detailansicht mit getrennten Kacheln für Stammdaten und Technik.

### Fahrzeugbestand / Gebrauchtwagen-Handel

Tabellen sind bereits angelegt (`vehicle_purchases`, `vehicle_listings`, `vehicle_photos`,
`vehicle_sales`). Funktionen folgen: Bestandsliste, Foto-Galerie, **A4-Verkaufsschild als PDF**,
"Verkaufen"-Aktion mit automatischer Übergabe Bestand → Kunde und Rechnung.

### Lohn und Gehalt

- Mitarbeiter-Stammdaten mit Steuer/SV, Bankverbindung, Beschäftigungsart, Wochenstunden.
- Abwesenheiten (Urlaub, Krankheit) via `employee_absences`.
- Periodenverwaltung über `payroll_periods` + `payroll_entries` (Brutto/Abzüge/Netto).
- **Lohnzettel-PDF** im deutschen Standard wird in einer Folgeiteration aus diesen Daten erzeugt.
- Bei vorhandener `private_email` des Mitarbeiters wird der Lohnzettel automatisch per SMTP versendet
  (Eintrag in `sent_messages`). Wiederversand erfordert ausdrückliche Bestätigung.

### Buchhaltung / Ein- und Ausgaben

- Eine Tabelle `ledger_entries` für alle Bewegungen, kategorisiert über `ledger_categories`.
- **App-interne** Vorgänge (Rechnungen, Lohnabrechnung, Fahrzeug-Verkauf/Ankauf) erzeugen automatisch
  `ledger_entries` mit `source` ungleich `'manual'`.
- **Manuelle externe** Buchungen für Ausgaben/Einnahmen, die nicht aus App-Modulen stammen.
- **Wiederkehrende** Buchungen mit Intervall (täglich/wöchentlich/monatlich/quartal/halbjährlich/jährlich)
  über `recurring_entries`. Ein Server-Job erzeugt fällige Einträge zum Stichtag.

### Controlling / Statistik

Eigenes Modul mit **Chart.js**: KPI-Kacheln, Pflicht-Charts (Einnahmen/Ausgaben, Cashflow,
Kategorien, Top-Kunden/Lieferanten, Mahnstufen, Auftragsvolumen, Fahrzeugmargen, Auslastungs-Heatmap,
Lohnaufwand, USt/Vorsteuer-Verlauf), Forecast mit What-if-Slider, Drill-Down, PDF-Bericht.

### Gesendet

Zentrale Versand-Historie aller per E-Mail rausgehenden Dokumente (Rechnung, KV, Mahnung, Serienbrief,
Lohnzettel, Bericht). Wiederversand fordert eine ausdrückliche Bestätigung.

### Einstellungen

Untergliedert in: Firmendaten, Erscheinungsbild, Bank/Zahlung, Steuern, Nummernkreise,
Textbausteine/Mailvorlagen, Kfz-Freifelder, Fahrzeugbestand/Verkaufsschild, E-Mail/SMTP, Controlling,
Lohn, Buchhaltung, Import, PDF, Backup/Export, System.

### MDB-Import

Strikt **In-Memory** — die hochgeladene Datei wird nicht persistiert.

1. `.mdb` hochladen (max. 200 MB; Magic-Bytes-Check)
2. Schema analysieren, Mapping-Vorschau anzeigen
3. Daten-Vorschau mit Beispielzeilen, Validierungsfehler markiert
4. Nutzer bestätigt → Import läuft, Fehlerprotokoll
5. Datei wird verworfen

Test-Datei für die Entwicklung: `Daten/kfz-kaufmann-test.mdb` (nicht im Repo).

## E-Mail-Versand

Ausschließlich SMTP via **nodemailer** — kein IMAP/POP. Konfiguration in `smtp_settings`,
Passwort AES-GCM-verschlüsselt.

Beim Klick auf "Per E-Mail senden" öffnet sich ein **Sende-Dialog**, vollständig
**vorausgefüllt** aus der jeweiligen Mailvorlage (`mail_templates`) mit aufgelösten Platzhaltern
(`{firma}`, `{kundeAnredeName}`, `{rechnungNummer}`, `{fahrzeugKennzeichen}`, `{periode}`, …).

Ist das Dokument bereits versendet, wird ein Hinweis angezeigt und eine ausdrückliche
Bestätigung verlangt. Jeder Versand wird in `sent_messages` protokolliert.

## PDF-Erstellung und Vorschau

`pdf-lib` für Erstellung, `pdfjs-dist` für In-App-Vorschau. Vorgesehene Typen:

- Rechnung, Kostenvoranschlag, Angebot, Auftragsbestätigung, Mahnung, Serienbrief
- Verkaufsschild Fahrzeugbestand (1 Seite A4)
- Bestandsliste Fahrzeuge
- Lohnzettel
- Lohnjournal je Periode, Jahreslohnkonto
- Einnahmen-/Ausgabenliste, Saldenübersicht, Kategorien-Auswertung
- USt/Vorsteuer-Auswertung, Lohnaufwand-Auswertung, Belegjournal
- Controlling-Bericht (Monats-/Quartals-Bericht)

## Validierung

- **Valibot** in jeder Remote Function (Server-seitig autoritativ)
- Wiederverwendbare Schemas in `src/lib/server/db/validation.ts`:
  `nameSchema`, `emailSchema`, `phoneSchema`, `ibanSchema`, `bicSchema`, `addressLineSchema`,
  `zipSchema`, `citySchema`, `notesSchema`, `longTextSchema`, `subjectSchema`,
  `dateStringSchema`, `moneySchema`, `percentSchema`, `listParamsSchema`, `searchQuerySchema`
- Fehlermeldungen auf Deutsch, technische Logs auf Englisch.

## Listen, Pagination, Suche, Filter

Jede Liste lädt **serverseitig** über eine Remote Function mit `{ items, total, page, size, pageCount }`.

- Wiederverwendbare `Pagination`-Komponente mit Seitenzahlen `1, 2, 3, …`, Sprungbuttons,
  Seitengrößenauswahl 10/25/50/100.
- `Toolbar` mit prominenter Suchzeile (Lucide-Icon, Debounce 250 ms) und Filter-Slot.
- `clampPagination()` und `paginationButtons()` als Hilfen unter `src/lib/utils/pagination.ts`.
- Listen-Queries setzen ein Längen-Limit auf jedem Suchbegriff (max. 200 Zeichen).

## Eingabe- und Upload-Limits

- Strings haben harte `maxLength`-Limits gemäß `validation.ts`.
- Datei-Uploads:
  - Logo: max. 5 MB, MIME `image/png|jpeg|svg+xml`
  - MDB: max. 200 MB, In-Memory, Magic-Bytes-Check
- Pagination wird geclippt, wenn der Client unsinnige Werte sendet.
- Eingaben werden mit höflichen deutschen Meldungen abgewiesen.

## Globale Ladeanzeige

Skeleton-Loader und kleine Spinner an den jeweiligen Ladestellen; Toast-Tray oben rechts für
Erfolgs- und Fehlermeldungen (`src/lib/stores/toast.svelte.ts`).

## Backup / Export

`pg_dump` für Voll-Backups; ein Backup-/Restore-Modul wird in einer Folgeiteration ergänzt.

## Testing

- **Vitest** mit `@testing-library/svelte` + `@testing-library/jest-dom` + `@testing-library/user-event`
- **Co-Lokation**: jede `<datei>.test.ts` liegt direkt neben der Quelldatei.
- Beispiel-Tests:
  - `src/lib/utils/money.test.ts` – Brutto/Netto/Rabatt/Format
  - `src/lib/utils/numbering.test.ts` – Nummernkreis-Renderer
  - `src/lib/utils/pagination.test.ts` – Clamp + Buttons
  - `src/lib/server/utils/crypto.test.ts` – AES-GCM Round-Trip
  - `src/routes/customers/CustomerForm.test.ts` – Komponententest mit user-event
- E2E erfolgt **extern** durch das Playwright-Plugin des AI-Coding-Agents — **kein** Playwright im Projekt.

```bash
npm test           # einmalig
npm run test:watch # Watch-Modus
npm run test:cov   # mit Coverage-Report
```

## Code-Formatierung mit Prettier + Husky

- `.prettierrc` (no semi, single quotes, no trailing comma, 2-space, LF, printWidth 80)
- Pre-Commit-Hook (`.husky/pre-commit`) ruft `npx lint-staged` auf, das bei jedem Commit
  `prettier --write --ignore-unknown` über alle gestageten Dateien laufen lässt.
- `npm run format` formatiert alles, `npm run format:check` für CI.

## Bekannte Einschränkungen

- Stub-Module sind funktional **nicht** ausgeliefert (die Datenstruktur und Routen stehen).
- Lohnabrechnung übernimmt aktuell keine zertifizierte deutsche Lohnberechnung — die Sätze
  sind konfigurierbar; Brutto/Netto-Berechnung ist als Schema vorbereitet.
- Service Worker / PWA-Manifest sind noch nicht eingebunden.

## Hinweise zur Weiterentwicklung

- Die wichtigsten Patterns (Remote Function, Service-Layer, Form-Komponente, Listen-Pattern) sind
  in den Modulen **Kunden** und **Fahrzeuge** vollständig demonstriert. Neue Module folgen exakt
  diesem Pattern.
- Komponenten kommen über den **DaisyUI Blueprint MCP** des Coding-Agents — niemals "von Grund auf"
  designen.
- **Svelte 5 + Runes** ist verbindlich — kein `export let`, kein `$:`, keine `on:event`-Direktiven.
- Beim Bauen neuer Funktionen den Dev-Server starten und mit dem Playwright-Plugin testen
  (Flow, Validierung, Performance, Optik).

---

© 2026 — Erstellt mit dem AI-Coding-Agent.
