# TwinCarsManager

Moderne Web-App für einen kleinen Kfz-Betrieb mit Werkstatt **und** Gebrauchtwagen-Handel — Nachfolger der alten Access-basierten "Kfz-Kaufmann"-Software.

Diese Anwendung verwaltet Kunden, Fahrzeuge, Aufträge (Kanban), Angebote, Rechnungen (inkl. Storno und Zahlungserinnerungen), Termine, Mitarbeiter mit Abwesenheiten, Zeiterfassung, Buchhaltung, Fahrzeugbestand mit Verkaufsschildern, Reifenkatalog und Reifeneinlagerung, Rundschreiben und News-Beiträge für die Website. Außerdem importiert sie alte `.mdb`-Datenbanken aus dem Vorgängersystem und bindet eBay an. Die ausführliche Wissensbasis liegt unter `docs/` (`docs/INDEX.md`).

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

| Bereich              | Wahl                                           | Warum                                                             |
| -------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| Framework            | **SvelteKit** + Svelte 5 (Runes)               | Modern, schnell, klare Reaktivität                                |
| Server-Kommunikation | **Remote Functions** (`*.remote.ts`)           | Typed query/command + automatischer HTTP/Cache                    |
| Validierung          | **Valibot**                                    | Modular, schnell, deutlich kleiner als Zod                        |
| Datenbank            | **PostgreSQL** + **Drizzle ORM** + Drizzle Kit | Saubere Migrationen, typsicher                                    |
| Styles               | **TailwindCSS v4** + **DaisyUI v5**            | Konsistentes Design-System, Theme-fähig                           |
| Icons                | **@lucide/svelte**                             | Modernes, einheitliches Icon-Set                                  |
| PDF                  | **pdf-lib**                                    | PDF-Erzeugung; Vorschau über den nativen Browser-Viewer im iframe |
| Mail                 | **nodemailer**                                 | Reiner SMTP-Versand                                               |
| Adapter              | **@sveltejs/adapter-node**                     | Plain Node-HTTP, einfach zu hosten                                |
| Tests                | **Vitest** + **@testing-library/svelte**       | Unit + Komponententest, Co-Lokation                               |
| Coverage             | **@vitest/coverage-v8**                        | Genaue Coverage-Reports                                           |
| Format / Hooks       | **Prettier** + **Husky** + **lint-staged**     | Pre-Commit-Hook formatiert automatisch                            |

Weitere Hilfen: `csv-parse`, `nanoid`, `qrcode`.

## Voraussetzungen

- Node.js **≥ 22**
- PostgreSQL **≥ 14** (lokal getestet mit 17)
- Optional: `mdbtools` (für MDB-Import)

## Installation und lokales Setup

```bash
git clone <repo> twincars-manager
cd twincars-manager
pnpm install
cp .env.example .env
# DATABASE_URL und APP_SECRET in .env anpassen
pnpm db:migrate
pnpm dev
```

Beim ersten Aufruf von `http://localhost:5173/` werden Sie automatisch zum **First Setup Wizard** weitergeleitet.

## Umgebungsvariablen

| Name           | Pflicht | Beschreibung                                                                                                                                                                                |
| -------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | ja      | Postgres-Connection-String                                                                                                                                                                  |
| `APP_SECRET`   | ja      | HMAC-Geheimnis für better-auth Session-Cookies (Signatur, keine Datenverschlüsselung)                                                                                                       |
| `API_TOKENS`   | nein    | Komma-separierte Liste der Bearer-Tokens für `/api/public/*`. Mindestens 8 Zeichen je Eintrag, ideal: kryptographisch zufällige ≥ 16 Zeichen. Leer/unset = öffentliche API blockiert alles. |
| `NODE_ENV`     | nein    | `development` / `production`                                                                                                                                                                |

Weitere optionale Variablen (`APP_ENCRYPTION_KEY` für Secrets-Verschlüsselung,
`EBAY_*` für die eBay-Anbindung, `BODY_SIZE_LIMIT=64M` für den MDB-Upload, …)
sind vollständig in `docs/operations/environment-variables.md` dokumentiert.

Beispiel `.env`:

```env
DATABASE_URL=postgres://admin:TwinCars2026!@localhost:5432/twincars-manager
APP_SECRET=please-change-me-in-production-32bytes
API_TOKENS=dev-token-please-change-me-aaaaaaaaaaaaaaaaaaaa
NODE_ENV=development
```

Die `API_TOKENS`-Liste wird bei jedem Request ausgewertet, ein Rotations-Workflow ist ein Config-Änderung + Server-Neustart — keine Admin-UI, keine Mint-/Revoke-Schritte mehr. Trennzeichen sind Komma, Semikolon und Zeilenumbruch.

`.env` und `.env.*` werden über `.gitignore` ausgeschlossen — `.env.example` ist die Vorlage.

## Datenbank-Setup und Migrationen

```bash
pnpm db:generate     # Drizzle-Migrations aus dem Schema erzeugen (drizzle-kit, dev only)
pnpm db:migrate      # Migrationen anwenden (drizzle-orm Runtime-Migrator, dev + prod)
pnpm db:push         # Schema direkt pushen (drizzle-kit, dev only — niemals in Production)
pnpm db:studio       # Drizzle Studio öffnen
```

`db:migrate` ruft `node scripts/migrate.js` auf und ist die einzige
Stelle, an der SQL-Migrationen angewendet werden — lokal genauso wie
im Container (siehe `Dockerfile` `CMD`). Die SvelteKit-App selbst
führt **keine** Migrationen aus; sie startet nur, wenn der vorgelagerte
Migrations-Schritt erfolgreich war.

Default-Datensätze (Mailvorlagen, Nummernkreise, Buchhaltungs-Kategorien)
werden idempotent beim ersten HTTP-Request via `seedDefaults()` aus
`src/hooks.server.ts` gesetzt. Das ist Inhalt, keine Schema-Änderung
und damit keine Migrations-Aufgabe.

## Start im Dev-Modus

```bash
pnpm dev          # Vite-Dev-Server auf http://localhost:5173
```

## Build und Produktionsbetrieb

```bash
pnpm build        # Build erzeugt einen Node-Server in /build
pnpm preview      # Lokal anschauen
pnpm db:migrate   # Migrationen anwenden (idempotent)
pnpm start            # Server starten (PORT=3000 default)
```

Im Container ist die Reihenfolge **migrate → start** ein einzelner
`CMD`. Schlägt die Migration fehl, startet die App nicht.

## Deployment mit adapter-node

Der erzeugte Output unter `/build` ist ein klassischer Node-HTTP-Server (`@sveltejs/adapter-node`).

- **Standard-HTTP**, kein eingebautes HTTPS, kein mTLS, keine Cipher-Konfiguration.
- TLS-Terminierung erfolgt — falls überhaupt benötigt — durch einen vorgelagerten **Reverse Proxy**
  (z. B. Caddy oder Nginx).
- Empfohlen: PM2 oder systemd zum Halten des Prozesses; `process.on('uncaughtException')` und
  `'unhandledRejection'` werden geloggt, der Prozess wird ggf. neu gestartet.

### Docker

Ein produktionsfähiger `Dockerfile` liegt im Repo-Root.

#### Aufbau des Images

Multi-stage Build auf Basis von `node:lts-alpine`:

| Stage     | Zweck                            | Was passiert                                                                                                                                                                                                                            |
| --------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`   | Vollständige Toolchain, einmalig | `pnpm install --frozen-lockfile` mit dev + prod Deps · `pnpm build` (Vite + adapter-node erzeugen `build/`) · `pnpm prune --prod` strippt drizzle-kit / vite / vitest / svelte-check / prettier / typescript / @types / testing-library |
| `runtime` | Schlankes Final-Image            | Übernimmt aus `build` ausschließlich: `build/`, `node_modules/` (production-only), `package.json`, `scripts/`, `drizzle/`. **Kein** Sourcecode (`src/`), **kein** drizzle-kit, **keine** Tests, **keine** Build-Tools.                  |

Caching-Reihenfolge: `package.json`/`package-lock.json` werden zuerst
kopiert, dann `pnpm install --frozen-lockfile` — so überleben App-Code-Änderungen die
pnpm-install-Layer. Nur wenn sich die Dependency-Lockdatei ändert,
läuft `pnpm install --frozen-lockfile` neu.

Ergebnis: Ein Image, das ausschließlich enthält, was zur Laufzeit
gebraucht wird — den kompilierten SvelteKit-Server, den
Migration-Runner, die generierten SQL-Migrationen und die
Production-Dependencies.

#### Startup-Sequenz

`CMD` ist eine einzelne Shell-Zeile:

```dockerfile
CMD ["sh", "-c", "node scripts/migrate.js && node build"]
```

1. `node scripts/migrate.js` wendet ausstehende SQL-Migrationen mit
   `drizzle-orm/postgres-js/migrator` an. Bei Fehler exit-code 1.
2. `&&` bricht ab, wenn die Migration scheitert — der App-Server
   startet dann gar nicht erst gegen eine halb-migrierte Datenbank.
3. `node build` startet den SvelteKit/adapter-node-Server (PORT=3000
   default).

`drizzle-kit` ist im Runtime-Image **nicht enthalten**. Migrationen
werden ausschließlich mit `drizzle-orm/postgres-js/migrator`
angewendet — derselbe Code, den `pnpm db:migrate` lokal ausführt.

#### Build und Run

```bash
docker build -t twincars-manager .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://admin:secret@db:5432/twincars-manager \
  -e APP_SECRET=$(openssl rand -hex 32) \
  twincars-manager
```

`.dockerignore` schließt `node_modules/`, `.svelte-kit/`, `build/`,
`.env*`, `tmp/`, `coverage/` und Markdown-Dokumentation aus dem
Build-Kontext aus — damit ein lokaler Dev-Build den Image-Build nicht
verlangsamt oder Secrets aus `.env` einschmuggelt. (`.env.example`
bleibt erlaubt.)

### Backups

Backups sind **nicht Teil der App** und nicht Teil des Containers.
Die Operations-Schicht (Host bzw. Postgres-Setup) ist verantwortlich:

- **Vor jedem Deployment** mit neuen Migrationen einen `pg_dump`
  ziehen (oder Volume-Snapshot).
- Snapshot in einer Staging-Umgebung mindestens einmal pro Release
  zurückspielen, um Restore-Pfade zu prüfen.
- Aufbewahrungs-/Rotationspolitik ist Ops-Sache, nicht Code-Sache.

Wenn eine Migration potenziell datenverlustig ist (Spalte droppen,
Typänderung, Rename ohne Inhaltsmigration), in der Release-Note
ausweisen, sodass Ops vor dem Deploy entscheiden kann.

## PWA-Hinweise

Die Anwendung ist eine installierbare PWA: Web-App-Manifest + Service Worker via
SvelteKit-nativem `src/service-worker.ts` (Precache der Build-Assets, im Dev-Modus
deregistriert). Details in `docs/architecture/pwa-service-worker.md`.

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
├── hooks.server.ts               Auth/Session, Setup-Gate, Rate-Limits, Seed beim 1. Request
├── lib/
│   ├── components/
│   │   ├── layout/               AppShell, PageHeader, Navigation
│   │   └── ui/                   Pagination, Toolbar, EmptyState, ConfirmDialog,
│   │                             StatCard, ToastTray, TabGroup, SearchablePicker,
│   │                             MultiSearchablePicker, PdfViewer, ImageUploader
│   ├── server/
│   │   ├── db/
│   │   │   ├── client.ts         Drizzle-Client (Postgres-Pool)
│   │   │   ├── schema.ts         vollständiges Schema
│   │   │   ├── validation.ts     wiederverwendbare Valibot-Schemas
│   │   │   ├── migrate.ts        Migrationsläufer
│   │   │   └── seed-defaults.ts  Default-Daten (Mailvorlagen, Kategorien, Nummernkreise)
│   │   ├── services/             Repository/Service-Layer pro Domäne
│   │   └── crypto.ts             AES-256-GCM für Secrets (SMTP-Passwort, eBay-Tokens)
│   ├── stores/                   $state-basierte Stores (busy, toast, formDirty, creation-flow)
│   └── utils/                    money, numbering, pagination, client-error, status-labels
└── routes/
    ├── +layout.svelte                 AppShell (Setup-Gate/Session via hooks.server.ts)
    ├── +page.svelte                   Dashboard
    ├── setup/                         First Setup Wizard
    ├── customers/                     Kunden (List/Detail/New/Edit)
    ├── vehicles/                      Fahrzeuge (List/Detail/New/Edit)
    └── … weitere Module (alle vollständig umgesetzt, keine Stubs)
```

**Remote Functions** (`*.remote.ts`):

- `query(schema?, fn)` — Lesen, mit reaktivem Cache
- `command(schema?, fn)` — Schreiben, mit `.refresh()` / optimistischem Update über `.withOverride()`
- Schemas immer mit Valibot, Fehler über `error(status, msg)`

## Datenmodell

Vollständiges Schema in `src/lib/server/db/schema.ts`. Auswahl der wichtigsten Tabellen:

| Tabelle                                                      | Zweck                                                                                   |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `company_settings`                                           | Firmen-Stammdaten + Setup-Status + Logo                                                 |
| `smtp_settings`                                              | SMTP-Konfiguration (Passwort verschlüsselt)                                             |
| `mail_templates`                                             | Editierbare Vorlagen für alle Mail-Anlässe                                              |
| `number_ranges`                                              | Format und nächster Wert je Nummernkreis                                                |
| `customers`                                                  | Kunden inkl. Bank, Anschrift, Notizen, Archiv-Flag                                      |
| `vehicles`                                                   | Eine Tabelle für Kunden- und Bestandsfahrzeuge (`customer_id` nullable; NULL = Bestand) |
| `vehicle_purchases / _listings / _photos / _sales`           | Bestand, Verkaufsschild-Daten, Foto-Galerie, Verkäufe                                   |
| `documents` + `document_items`                               | Gemeinsames Dokumentenmodell (Rechnung, Angebot, Mahnung …)                             |
| `document_payments`                                          | Zahlungseingänge je Dokument                                                            |
| `items` / `suppliers`                                        | Artikel/Leistungen, Lieferantenstamm                                                    |
| `calendar_entries`                                           | Diskriminierter Kalender (Termine + Betriebsschließungen); Feiertage werden berechnet   |
| `employees` / `employee_absences`                            | Mitarbeiter mit Abwesenheiten (Urlaub, Krank, halbe Tage)                               |
| `work_orders` / `work_order_items` / `time_entries`          | Aufträge (Kanban), Arbeitspositionen und Zeiterfassung                                  |
| `ledger_categories` / `ledger_entries` / `recurring_entries` | Buchhaltung mit wiederkehrenden Vorlagen                                                |
| `sent_messages`                                              | Versand-Historie für E-Mails                                                            |
| `access_import_jobs`                                         | Lauf-Protokoll des MDB-Imports                                                          |

## Module

Die UI ist über die linke **DaisyUI-Sidebar** in folgende Bereiche gegliedert:

| Bereich               | Module                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| Übersicht             | Start (Dashboard), Kalender                                                                            |
| Kunden & Fahrzeuge    | Kunden, Fahrzeuge, Zu verkaufende Fahrzeuge, Reifenlager                                               |
| Aufträge & Rechnungen | Aufträge (Kanban), Angebote / Kostenvoranschläge, Rechnungen, Offene Rechnungen, Rechnungsausgangsbuch |
| Stammdaten            | Leistungen, Material, Artikel; Reifenkatalog; Lieferanten                                              |
| Personal              | Mitarbeiter, Stunden (Zeiterfassung)                                                                   |
| Finanzen              | Buchhaltung                                                                                            |
| Kommunikation         | Rundschreiben, Gesendet, Aktuelle Informationen, Anfragen                                              |
| System                | Einstellungen (inkl. Import, eBay, Werkstattzeiten als Unterseiten/Tabs)                               |

Alle Module sind vollständig umgesetzt; die Sidebar wird pro Nutzer nach
Modul-Berechtigungen gefiltert. Das Modul "Offene Rechnungen" (Route
`/reminders`) versendet die freundliche "Zahlungserinnerung"; die
Artefakt-Bezeichnung bleibt auf Aktionen, PDFs und Mailvorlagen erhalten.
Forms folgen dem Pattern aus `CONTRIBUTING.md` §11 (Klick-Zeitpunkt-
Validierung mit deutscher Fehlerzusammenfassung, niemals deaktivierte
Buttons wegen fehlender Eingaben, w-full, unsaved-changes-Guard via
`formDirty`-Store).

### Start (Dashboard)

KPI-Kacheln (Kunden, Fahrzeuge, Monatsumsatz/-ausgaben/-saldo, offene Rechnungen,
Zahlungserinnerungen, Termine heute), Karte mit Schnell-Aktionen, und eine
"Anstehende Termine"-Karte mit den nächsten 10 fälligen HU-Terminen +
Werkstatt-Terminen, sortiert nach Datum.

### Kunden

- Liste mit serverseitiger Pagination (fix 25 pro Seite), Volltextsuche über
  Nummer/Name/Firma/Ort/PLZ/Straße/Telefon/E-Mail/eBay-Handle, Filter-Tabs
  Alle/Privatkunden/Firmenkunden/eBay plus **Archiv**-Tab (archivierte
  Kunden sind sonst überall ausgeblendet).
- Detailansicht mit Tabs Übersicht / Fahrzeuge / Rechnungen / Aufträge,
  Ad-hoc-E-Mail-Versand direkt vom Kunden.
- **Archivieren statt Löschen**: der Lösch-Guard verweigert mit deutscher
  Zählung verknüpfter Datensätze und verweist auf das Archiv.
- Form für Neu und Bearbeiten mit Klick-Zeitpunkt-Validierung; komplett
  über Remote Functions.

### Fahrzeuge

- Eine Stammdatentabelle für Kunden- und Bestandsfahrzeuge (`customerId` ist nullable;
  NULL = Bestand).
- Liste mit Suche über Kennzeichen (versioniert), FIN, Marke, Modell, HSN/TSN, Halter.
- Detailansicht mit Tabs Übersicht / Halter / Rechnungen / Aufträge / Fotos (nur
  Bestand) / Dokumente / Historie (Ankäufe, Verkäufe, Kennzeichen-Wechsel).
- Kennzeichen sind versioniert — alte Belege behalten das damals gültige Kennzeichen.

### Fahrzeugbestand / Gebrauchtwagen-Handel

Bestandsliste, Foto-Galerie (nur für Bestandsfahrzeuge; beim Verkauf wird
die Galerie gelöscht, ein Ankauf startet leer), Fahrzeug-Dokumente
(PDF/JPEG/PNG/WebP, max. 15 MB je Datei), optionaler Vorbesitzer-Bezug.
**Ankauf** übernimmt ein Kundenfahrzeug in den Bestand (Historienzeile mit
umbenennungssicherem Vorbesitzer-Snapshot, §25a UStG Differenzbesteuerung);
der **Verkauf** läuft über die bezahlte Verkaufs-Rechnung (Fahrzeug wandert
zum Käufer, `vehicle_sales`-Zeile mit Rechnungs-Backlink). Das
**A4-Verkaufsschild als PDF** (ein Klick auf der Detailseite) trägt
roten Kopfbalken, Logo-Chip, Preisbox, Faktenraster, Highlights in zwei
Spalten und einen QR-Code "Online ansehen".

### Aufträge (Werkstatt, Kanban)

Dreispaltiges Kanban (offen / in Bearbeitung / abgeschlossen) mit Drag & Drop,
Mehrfach-Zuweisung von Mitarbeitern, Arbeitspositionen (Arbeitszeit zum
konfigurierten Stundensatz, Material mit Preis-Snapshot) und Termin-Verknüpfung
(ein Auftrag pro Termin). **Abschließen erzeugt die Rechnung** aus den erfassten
Positionen; pro Auftrag existiert höchstens eine aktive Rechnung, Korrekturen
laufen über den Storno-Zyklus (Storno öffnet den Auftrag automatisch wieder;
Aufträge mit Rechnungshistorie sind GoBD-konform unlöschbar). Details in
`docs/domain/order-invoice-rules.md`.

### Kalender

Monatsraster + Terminliste über eine gemeinsame Tabelle (`Termin` |
`Betriebsschließung`), überlagert mit **berechneten Feiertagen** (Gauß-Formel,
alle 16 Bundesländer — `docs/architecture/holidays.md`), Mitarbeiter-Abwesenheiten,
HU-Fälligkeiten und geplanten Aufträgen. Website-Buchungen kommen über die
öffentliche API herein (freie Slots aus Öffnungszeiten minus Schließungen und
Feiertagen).

### Personal und Zeiterfassung

- Mitarbeiter-Stammdaten mit Steuer/SV und Bankverbindung; Gehälter
  **versioniert** (`employee_salary_versions`, stichtagsgenau).
- Abwesenheiten (Urlaub / Krankheit / Sonstiges) mit serverseitig berechneten,
  **feiertagsbewussten Arbeitstagen**, hartem Urlaubsbudget pro Kalenderjahr,
  halben Tagen und Konflikt-Logik (Ersetzen-Dialog bei Urlaub↔Krankheit).
- **Zeiterfassung** (`/hours`): Mitarbeiter erfassen Stunden (Selbst-Service über
  die Berechtigung `hours:write_own`), Auftrags-Arbeitspositionen schreiben
  automatisch durch; Auswertungen unter `/hours/reports` (Monatsbericht,
  Auslastung). Ein Payroll-Modul gibt es bewusst nicht mehr.

### Buchhaltung / Ein- und Ausgaben

- Eine Tabelle `ledger_entries` für alle Bewegungen (Einnahme/Ausgabe, brutto/
  netto/Steuer, Zahlungsart), kategorisiert über die beim Setup geseedeten
  `ledger_categories`.
- Buchungen werden **manuell erfasst** (`source='manual'`), optional verknüpft
  mit Beleg, Kunde oder Lieferant.
- Die Tabelle `recurring_entries` (wiederkehrende Vorlagen) existiert im Schema,
  hat aber noch keine UI/Automatik — geplante Automatisierung bliebe ohnehin
  bedienergesteuert (`docs/decisions/adr-009-no-in-process-scheduler.md`).
- Das **Rechnungsausgangsbuch** (`/sales-ledger`) ist eine Lese-Sicht über die
  Rechnungen; Export für den Steuerberater als **DATEV-Buchungsstapel-CSV**.

### Reifen

**Reifenkatalog** (`/tires`): eigene Reifen-Stammdaten mit typisierten
EU-Label-Feldern, versionierten Preisen und `onlineSellable`-Flag für den
Web-Shop. **Reifeneinlagerung** (`/tire-storage`): Einlagerungen mit
Nummernkreis, A6-QR-Etikett (Scan öffnet die Detailseite) und saisonalen
Erinnerungs-Mails an Kunden mit Opt-in.

### Gesendet

Zentrale Versand-Historie aller per E-Mail rausgehenden Nachrichten (Rechnung,
Angebot/KV, Zahlungserinnerung, Rundschreiben je Empfänger, Ad-hoc-Mails,
Terminbestätigungen) — nur Metadaten und Plain-Text-Audit, nie Anhang-Bytes.

### Aktuelle Informationen und öffentliche API

News-Beiträge (`/posts`) für die Website; ausgeliefert über die
Bearer-Token-geschützte REST-API `/api/public/*` (Gebrauchtwagen, Leistungen,
Reifen, Termine/freie Slots, Kontakt, Firma, Beiträge) — Tokens kommen aus der
Env-Variable `API_TOKENS`. Details in `docs/integrations/public-rest-api.md`.

### eBay

Anbindung des Verkäuferkontos unter `/settings/ebay`: OAuth-Connect
(Tokens AES-256-GCM-verschlüsselt), Compliance-Endpoint für
Marketplace-Account-Deletion und der **Angebots-Import** über die Trading-API
(idempotent, Beendet/Wiederaufleben-Semantik). Bidirektionale Reifen-Sync ist
Phase 3 und zurückgestellt. Details in `docs/integrations/ebay.md`.

### Einstellungen

Eine flache, berechtigungsgefilterte Tab-Leiste (`/settings/*`):
**Allgemein** (Firmendaten, §19 UStG, Logo, Stundensatz), **Mailvorlagen**,
**Zahlungserinnerung**, **SMTP** (inkl. Testversand), **Benutzer & Rollen**,
**Öffnungszeiten**, **Reifen-Erinnerungen**, **Anfragen**, **eBay**, **Import**
und **Konto** (eigenes Passwort). Alte `?tab=`-Links leiten auf die neuen
Routen um.

### MDB-Import

Der Kfz-Kaufmann-Import lebt unter `/settings/import` (Berechtigung `import`):

1. `.mdb` hochladen (Base64-Upload, reale MDB ~25-30 MB; benötigt
   `BODY_SIZE_LIMIT=64M` und `mdbtools`)
2. **"Vorschau (ohne Speichern)"** — Dry-Run parst, mappt und validiert alles,
   ohne zu schreiben
3. "Jetzt wirklich importieren" — alle 13 Tabellen werden **vor** dem Wipe
   gelesen (Read-before-Wipe), dann gemappt und eingefügt; Live-Fortschrittsbalken
4. Ergebnis-Modal mit Zählern je Tabelle und aufklappbarer Drop-Tabelle
   (Tabelle / Legacy-Schlüssel / deutscher Grund); Audit-Zeile in
   `access_import_jobs` auch bei Fehlschlag

Kunden mit "ebay" im Namen werden automatisch als `kind='ebay'` importiert.
Details in `docs/integrations/kfz-kaufmann-import.md`.
Test-Datei für die Entwicklung: `Daten/kfz-kaufmann-test.mdb` (nicht im Repo).

## E-Mail-Versand

Ausschließlich SMTP via **nodemailer** — kein IMAP/POP. Konfiguration in `smtp_settings`,
Passwort AES-256-GCM-verschlüsselt; unter `/settings/smtp` gibt es einen **Testversand**
mit kuratierten deutschen Fehlermeldungen (DNS, Verbindung, Auth, TLS, Timeout, Empfänger).

Beim Klick auf "Per E-Mail senden" öffnet sich ein **Sende-Dialog**, vollständig
**vorausgefüllt** aus der jeweiligen Mailvorlage (`mail_templates`) mit aufgelösten Platzhaltern
(`{firma}`, `{kundeAnredeName}`, `{rechnungNummer}`, `{fahrzeugKennzeichen}`, …).

Weitere Pfade: Ad-hoc-Mail vom Kundendatenblatt (optional HTML),
**Rundschreiben** an Opt-in-Kunden (BCC-Batches à 50, Abbestellen-Fußzeile +
`List-Unsubscribe`-Header) und Terminbestätigungen der öffentlichen API.
Ist das Dokument bereits versendet, wird ein Hinweis angezeigt und eine ausdrückliche
Bestätigung verlangt. Jeder Versand wird in `sent_messages` protokolliert
(Testversand bewusst nicht). Details in `docs/integrations/smtp-mail.md`.

## PDF-Erstellung und Vorschau

`pdf-lib` für Erstellung, Vorschau über den nativen PDF-Viewer des Browsers
(Blob-URL im iframe). Gerenderte Typen (`src/lib/server/services/pdf-service.ts`,
gecacht in Postgres, ausgeliefert über das globale `pdfs.remote.ts`):

- Rechnung (inkl. Storno), Angebot, Kostenvoranschlag, Auftragsbestätigung
  — mehrseitig mit wiederholten Tabellenköpfen, gemischten MwSt-Sätzen und
  "Seite X von Y"
- Zahlungserinnerung
- Verkaufsschild Fahrzeugbestand (1 Seite A4, quer)
- Reifeneinlagerungs-Etikett (A6 mit QR-Code)

Die Renderer sind byte-deterministisch und durch eine visuelle
Regressions-Suite abgesichert (`pdf-visual.test.ts`, Snapshots im Repo).
Keine PDFs, aber verwandte Exporte: **XRechnung**-XML (EN 16931) je Rechnung
und **DATEV**-CSV für die Buchhaltung. Details in
`docs/architecture/pdf-pipeline.md`.

## Validierung

- **Valibot** in jeder Remote Function (Server-seitig autoritativ)
- Wiederverwendbare Schemas in `src/lib/server/db/validation.ts`:
  `nameSchema`, `emailSchema`, `phoneSchema`, `ibanSchema`, `bicSchema`, `addressLineSchema`,
  `zipSchema`, `citySchema`, `notesSchema`, `longTextSchema`, `subjectSchema`,
  `dateStringSchema`, `moneySchema`, `percentSchema`, `licensePlateSchema`, `vinSchema`,
  `hsnSchema`, `tsnSchema`, `timeHHMMSchema`, `listParamsSchema`, `searchQuerySchema`, …
- Fehlermeldungen auf Deutsch, technische Logs auf Englisch.

## Listen, Pagination, Suche, Filter

Jede Liste lädt **serverseitig** über eine Remote Function mit `{ items, total, page, size, pageCount }`.

- Wiederverwendbare `Pagination`-Komponente mit Seitenzahlen `1, 2, 3, …` und
  Sprungbuttons. Seitengröße ist projektweit fix auf **25** Einträge —
  kein Selector. Wer mehr braucht, sucht/filtert.
- `Toolbar` mit prominenter Suchzeile (Lucide-Icon, Debounce 250 ms) und Filter-Slot.
- `clampPagination()` und `paginationButtons()` als Hilfen unter `src/lib/utils/pagination.ts`.
- Listen-Queries setzen ein Längen-Limit auf jedem Suchbegriff (max. 200 Zeichen).

## Eingabe- und Upload-Limits

- Strings haben harte `maxLength`-Limits gemäß `validation.ts`; numerische
  Felder realistische Obergrenzen (kein Integer-Overflow zum 500er).
- Datei-Uploads (jeweils Base64 durch die Remote Function):
  - Logo: Base64 auf ~7 MB gedeckelt
  - MDB-Import: Base64 auf 60 Mio. Zeichen gedeckelt (reale MDB ~30 MB);
    der Server braucht `BODY_SIZE_LIMIT=64M`
  - Fahrzeug-Dokumente: max. 15 MB je Datei, nur PDF/JPEG/PNG/WebP
- Pagination wird geclippt, wenn der Client unsinnige Werte sendet.
- Eingaben werden mit höflichen deutschen Meldungen abgewiesen.

## Globale Ladeanzeige

Ein einziger globaler `busy`-Store (`src/lib/stores/busy.svelte.ts`) treibt drei
gestufte Signale: dünner Fortschrittsbalken im Header (die **einzige**
Ladeleiste der App), deaktivierte Submit-Buttons mit Inline-Spinner und — erst
ab 250 ms — ein Overlay über dem Inhaltsbereich. Keine Skeleton-Loader, keine
lokalen Busy-Flags (CONTRIBUTING §6). Toast-Tray oben rechts für Erfolgs- und
Fehlermeldungen (`src/lib/stores/toast.svelte.ts`).

## Backup / Export

Backups liegen außerhalb der Anwendung — siehe Abschnitt
[Deployment mit adapter-node → Backups](#deployment-mit-adapter-node).
Die App selbst, der Migration-Runner und das Container-Image führen
**keine** Backup-Logik aus. Snapshots gehören in die Ops-Schicht
(Host-Volume, Postgres-Backup-Tooling, Cloud-Provider) und müssen
**vor** jedem Deployment mit neuen Migrationen gezogen werden.

## Testing

- **Vitest** mit `@testing-library/svelte` + `@testing-library/jest-dom` + `@testing-library/user-event`
- **Co-Lokation**: jede `<datei>.test.ts` liegt direkt neben der Quelldatei.
- Beispiel-Tests:
  - `src/lib/utils/money.test.ts` – Brutto/Netto/Rabatt/Format
  - `src/lib/utils/numbering.test.ts` – Nummernkreis-Renderer
  - `src/lib/server/services/number-range-service.test.ts` – atomare Nummernkreis-Vergabe
  - `src/lib/utils/pagination.test.ts` – Clamp + Buttons
  - `src/lib/server/utils/crypto.test.ts` – AES-GCM Round-Trip
  - `src/routes/customers/CustomerForm.test.ts` – Komponententest mit user-event
- **E2E**: echte `@playwright/test`-Suite im Repo (`e2e/`, 55 Tests / 12 Specs) gegen
  einen Production-Build und die committete anonymisierte Fixture-DB
  (`e2e/fixtures/seed.sql.gz`); Browser werden nie heruntergeladen (gecachtes Chromium).
  Details in `docs/operations/test-database.md` und `CONTRIBUTING.md` §13. Zusätzlich
  bleibt die interaktive Playwright-Begehung während der Entwicklung verpflichtend.

```bash
pnpm test               # einmalig (gesamte Vitest-Suite)
pnpm test:watch         # Watch-Modus
pnpm test:cov           # mit Coverage-Report
pnpm test:unit          # src/lib/server|stores|utils, hooks
pnpm test:components    # src/lib/components
pnpm test:integration   # src/routes
pnpm test:e2e           # Playwright-Suite (E2E_WEB_SERVER=1 SEED=1 für den Voll-Automatik-Lauf)
```

## Code-Formatierung mit Prettier + Husky

- `.prettierrc` (no semi, single quotes, no trailing comma, 2-space, LF, printWidth 80)
- Pre-Commit-Hook (`.husky/pre-commit`) ruft `pnpm exec lint-staged` auf, das bei jedem Commit
  `prettier --write --ignore-unknown` über alle gestageten Dateien laufen lässt.
- `pnpm format` formatiert alles, `pnpm format:check` für CI.

## Bekannte Einschränkungen

- Keine zertifizierte deutsche Lohnabrechnung — das Payroll-Modul wurde bewusst durch die
  Zeiterfassung (`/hours`) ersetzt (Migration 0015).
- eBay-Integration: Phase 3 (bidirektionale Reifen-Synchronisation) ist per ADR-014
  zurückgestellt; der Angebots-Import (Phase 2) ist gebaut, die Betreiber-Freigabe
  (Consent) steht noch aus.
- Urlaubs-Übertrag (Carryover) und automatische Betriebsschließungs-Anrechnung aus dem
  Abwesenheits-Design 2026-06-23 sind noch nicht umgesetzt (siehe
  `docs/modules/employees.md`).

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
