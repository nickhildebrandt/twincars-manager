## Abdeckungstabelle

Jede Feature-ID aus [01-inventar.md](01-inventar.md) mit dem Arbeitspaket, das
sie umsetzt. **Eine Feature-ID ohne Arbeitspaket ist ein Fehler im Plan.**

Ergebnis der Prüfung: **631 Feature-IDs, davon 631 zugeordnet, 0 ohne Paket.**

### Arbeitspakete nach Anzahl Features

| Paket | Titel | Features | IDs |
| --- | --- | --- | --- |
| **T-001** | Projektgerüst und Toolchain | 2 | F-052, F-447 |
| **T-002** | Teststack und Testdatenbank | 0 | – |
| **T-003** | Dokumentationsgerüst | 0 | – |
| **T-004** | Valibot-Fundament und Fehler-Trichter | 5 | F-007–F-008, F-044, F-444, F-526 |
| **T-005** | Datenbankschema, Baseline-Migration, Seeds | 10 | F-006, F-070, F-153–F-159, F-480 |
| **T-006** | Server-Grundgerüst und Infrastruktur-Helfer | 9 | F-045–F-046, F-048–F-049, F-053, F-170–F-171, F-406, F-411 |
| **T-007** | Authentifizierung, Sitzungen, Rechte | 24 | F-001–F-003, F-005, F-011–F-013, F-015–F-016, F-055–F-066, F-091–F-093 |
| **T-008** | App-Shell, Navigation, Zustände, Animationen | 24 | F-009–F-010, F-014, F-018–F-026, F-042, F-067, F-069, F-085–F-086, F-132–F-134, F-136, F-173–F-174, F-445 |
| **T-009** | Gemeinsame Komponenten und Picker | 35 | F-043, F-095–F-113, F-115–F-117, F-122–F-131, F-137, F-247 |
| **T-010** | Setup-Assistent und Firmeneinstellungen | 33 | F-017, F-068, F-071, F-094, F-138–F-152, F-160–F-169, F-172, F-176–F-177, F-446 |
| **T-011** | Kunden und Lieferanten | 43 | F-178–F-220 |
| **T-012** | Fahrzeuge, Dokumente, Fotos | 23 | F-118, F-221–F-240, F-255–F-256 |
| **T-013** | Bestand, Ankauf und Verkauf, Verkaufsschild | 9 | F-241–F-246, F-252–F-254 |
| **T-014** | Artikel und Leistungen | 24 | F-257–F-274, F-280, F-288, F-296–F-297, F-301, F-311 |
| **T-015** | Reifenkatalog | 15 | F-276–F-279, F-281–F-287, F-289–F-292 |
| **T-016** | Reifeneinlagerung, Etiketten, Erinnerungen | 17 | F-275, F-293–F-295, F-298–F-300, F-302–F-310, F-441 |
| **T-017** | Mitarbeiter und Abwesenheiten | 26 | F-481–F-505, F-524 |
| **T-018** | Zeiterfassung, Berichte, Öffnungszeiten | 20 | F-090, F-120, F-506–F-523 |
| **T-019** | Kalender, Feiertage, Terminplanung | 28 | F-250, F-525, F-527–F-549, F-554, F-556, F-587 |
| **T-020** | Aufträge (Kanban-Arbeitsaufträge) | 55 | F-312–F-366 |
| **T-021** | Belege-Grundlage und Angebote | 16 | F-367–F-382 |
| **T-022** | Rechnungen, Zahlungen, Storno | 14 | F-383–F-393, F-407–F-409 |
| **T-023** | PDF-Pipeline | 12 | F-047, F-121, F-395–F-404 |
| **T-024** | XRechnung | 1 | F-394 |
| **T-025** | Zahlungserinnerungen | 8 | F-428–F-435 |
| **T-026** | SMTP, Vorlagen, Versand, Gesendet | 17 | F-119, F-405, F-414–F-421, F-426–F-427, F-436–F-440 |
| **T-027** | Rundschreiben | 4 | F-422–F-425 |
| **T-028** | Buchhaltung und DATEV-Export | 30 | F-448–F-477 |
| **T-029** | Rechnungsausgangsbuch | 2 | F-410, F-478 |
| **T-030** | Beiträge und Kundenanfragen | 12 | F-575–F-586 |
| **T-031** | Öffentliche REST-API | 29 | F-004, F-088–F-089, F-175, F-248, F-412, F-442–F-443, F-550–F-552, F-557–F-574 |
| **T-032** | eBay-Anbindung | 19 | F-588–F-606 |
| **T-033** | Legacy-Import (KFZ-Kaufmann) | 29 | F-054, F-251, F-479, F-555, F-607–F-631 |
| **T-034** | Benutzer, Rollen, eigenes Konto | 15 | F-072–F-084, F-087, F-135 |
| **T-035** | Dashboard und globale Suche | 19 | F-027–F-041, F-114, F-249, F-413, F-553 |
| **T-036** | PWA und Service Worker | 2 | F-050–F-051 |
| **T-037** | Leistung, Indizes, Lastverhalten | 0 | – |
| **T-038** | Barrierefreiheit und Bewegungsreduktion | 0 | – |
| **T-039** | Golden Flows vollständig | 0 | – |
| **T-040** | Dokumentationsabschluss | 0 | – |
| **T-041** | Container, CI, Release | 0 | – |
| **T-042** | Datenübernahme und Cutover | 0 | – |

### Alle Feature-IDs

| Feature | Kurzbezeichnung | Paket |
| --- | --- | --- |
| F-001 | Auth-Gate für alle nicht-öffentlichen Routen | **T-007** |
| F-002 | Session-Populierung + sofortige Deaktivierungs-Sperre | **T-007** |
| F-003 | Brute-Force-Schutz Login | **T-007** |
| F-004 | Drossel Public-API + eBay-Compliance | **T-031** |
| F-005 | Deaktiviertes Konto beim Login abweisen | **T-007** |
| F-006 | Erst-Request-Seeding | **T-005** |
| F-007 | Validierungsfehler-Übersetzung | **T-004** |
| F-008 | Serverfehler-Funnel | **T-004** |
| F-009 | Client-Fehler-Funnel (Toast) | **T-008** |
| F-010 | Kuratierte Fehlerseite | **T-008** |
| F-011 | Login-Formular mit Klickzeit-Validierung | **T-007** |
| F-012 | Post-Login-Redirect mit Open-Redirect-Guard | **T-007** |
| F-013 | Idle-Hinweis auf Login | **T-007** |
| F-014 | Versionsanzeige | **T-008** |
| F-015 | Abmelden | **T-007** |
| F-016 | Idle-Logout 60 min | **T-007** |
| F-017 | Setup-Gate | **T-010** |
| F-018 | Layout-Kontext (Firmenname) | **T-008** |
| F-019 | Aktueller Nutzer + Permissions im Client | **T-008** |
| F-020 | Permission-gefilterte Sidebar (22 Items, 7 Gruppen) | **T-008** |
| F-021 | Header: Titel, Zurück, Primary-Action | **T-008** |
| F-022 | Einziger Ladebalken + Overlay-Tier | **T-008** |
| F-023 | Navigations-Busy | **T-008** |
| F-024 | Unsaved-Changes-Guard (In-App + beforeunload) | **T-008** |
| F-025 | Mobile Drawer | **T-008** |
| F-026 | Benutzermenü | **T-008** |
| F-027 | Globale Suche öffnen | **T-035** |
| F-028 | Globale Suche: Abfrage + Berechtigungsfilter | **T-035** |
| F-029 | Globale Suche: Ergebnisdarstellung + Tastatur | **T-035** |
| F-030 | Suche Kunden | **T-035** |
| F-031 | Suche Fahrzeuge inkl. Kennzeichen | **T-035** |
| F-032 | Suche Artikel/Leistungen | **T-035** |
| F-033 | Suche Reifenkatalog | **T-035** |
| F-034 | Suche Reifeneinlagerungen | **T-035** |
| F-035 | Suche Lieferanten | **T-035** |
| F-036 | Suche Mitarbeiter | **T-035** |
| F-037 | Suche Belege | **T-035** |
| F-038 | Suche Aktuelle Informationen | **T-035** |
| F-039 | Dashboard-KPIs (8 Kacheln) | **T-035** |
| F-040 | Dashboard „Schnelle Aktionen“ | **T-035** |
| F-041 | Dashboard „Anstehende Termine“ | **T-035** |
| F-042 | Toast-System | **T-008** |
| F-043 | Creation-Flow-Store (Rundreise-Infrastruktur) | **T-009** |
| F-044 | Form-Validierungs-Primitive | **T-004** |
| F-045 | Geld-/IBAN-/Nummernkreis-/Pagination-Helfer | **T-006** |
| F-046 | Statuslabel-Katalog (deutsch) | **T-006** |
| F-047 | PDF öffnen / Datei herunterladen (Client) | **T-023** |
| F-048 | Secrets-at-rest-Cipher | **T-006** |
| F-049 | In-Memory-Rate-Limiter | **T-006** |
| F-050 | PWA: Manifest + Icons + Installierbarkeit | **T-036** |
| F-051 | Service Worker: Pre-Cache + Network-first + Offline-Shell | **T-036** |
| F-052 | OTel-No-op-Shim | **T-001** |
| F-053 | Zahlungsarten-Konstante | **T-006** |
| F-054 | eBay-Namenserkennung (Import-Helfer) | **T-033** |
| F-055 | Login mit Benutzername + Passwort | **T-007** |
| F-056 | Deutsche Login-Fehlermeldungen | **T-007** |
| F-057 | Hinweis nach Idle-Logout | **T-007** |
| F-058 | Brute-Force-Schutz Login | **T-007** |
| F-059 | Sign-in-Sperre für deaktivierte Konten | **T-007** |
| F-060 | Session-Lebenszyklus | **T-007** |
| F-061 | Auth-Gate für Seiten | **T-007** |
| F-062 | Request-Kontext (`locals`) | **T-007** |
| F-063 | Logout | **T-007** |
| F-064 | Idle-Logout | **T-007** |
| F-065 | Server-Guards | **T-007** |
| F-066 | Permission-Modell | **T-007** |
| F-067 | Sidebar-Filter | **T-008** |
| F-068 | Settings-Tab-Filter | **T-010** |
| F-069 | 403-Fehlerseite | **T-008** |
| F-070 | Seed-Rollen | **T-005** |
| F-071 | Erst-Admin im Setup | **T-010** |
| F-072 | Benutzerliste | **T-034** |
| F-073 | Benutzer anlegen | **T-034** |
| F-074 | Benutzer bearbeiten | **T-034** |
| F-075 | Passwort-Reset durch Admin | **T-034** |
| F-076 | Benutzer deaktivieren/reaktivieren | **T-034** |
| F-077 | Benutzer löschen | **T-034** |
| F-078 | Letzter-Admin-Guard bei Rollenentzug | **T-034** |
| F-079 | Rollenliste | **T-034** |
| F-080 | Rolle anlegen | **T-034** |
| F-081 | Rolle bearbeiten | **T-034** |
| F-082 | Rolle löschen | **T-034** |
| F-083 | Berechtigungsmatrix-UI | **T-034** |
| F-084 | Eigenes Passwort ändern | **T-034** |
| F-085 | Benutzermenü | **T-008** |
| F-086 | Aktueller Benutzer für Layout | **T-008** |
| F-087 | Unsaved-Changes-Guard auf Auth-Formularen | **T-034** |
| F-088 | Public-API-Token-Auth | **T-031** |
| F-089 | Public-API-Rate-Limit | **T-031** |
| F-090 | `hours:write_own`-Scoping | **T-018** |
| F-091 | Passwort-Hashing | **T-007** |
| F-092 | Berechtigungs-Union über mehrere Rollen | **T-007** |
| F-093 | better-auth-Zusatzendpunkte (technisch) | **T-007** |
| F-094 | Setup-Gate | **T-010** |
| F-095 | Einzel-Picker-Dialog (SearchablePicker) mit Server-Suche, Debounce 250 ms, Seite 25, festen Maßen | **T-009** |
| F-096 | Auswahl entfernen am Picker-Trigger (Maus/Enter/Space) | **T-009** |
| F-097 | „Neu anlegen"-Affordance genau einmal im Dialog-Header | **T-009** |
| F-098 | Mehrfach-Picker (MultiSearchablePicker) transaktional | **T-009** |
| F-099 | Kombi-Picker Kunde/Fahrzeug mit Halter-Autofill und Kundenfilter | **T-009** |
| F-100 | Kunden-Picker | **T-009** |
| F-101 | Fahrzeug-Picker (allgemein) | **T-009** |
| F-102 | Fahrzeug-Picker relationsbewusst | **T-009** |
| F-103 | Lagerfahrzeug-Picker | **T-009** |
| F-104 | Mitarbeiter-Picker (auch für `orders`) | **T-009** |
| F-105 | Artikel-Picker mit Kategorie-Filter und aktuellem Preis | **T-009** |
| F-106 | Reifen-Picker mit Größe/Saison/Preis | **T-009** |
| F-107 | Lieferanten-Picker | **T-009** |
| F-108 | Beleg-Picker (Zeitbuchung) | **T-009** |
| F-109 | Picker-Argumentvalidierung | **T-009** |
| F-110 | Creation-Flow-Store (Stack, sessionStorage, 1 h, Zyklenschutz) | **T-009** |
| F-111 | Picker-Label-Formate zentral (Kunde/Fahrzeug) | **T-009** |
| F-112 | ConfirmDialog (nativ, Fokusfalle, Esc, Fokusrückgabe, Busy-Sperre, Fehler hält offen) | **T-009** |
| F-113 | Unsaved-Changes-Guard mit ConfirmDialog | **T-009** |
| F-114 | Globale Suche (Modal, Cmd/Ctrl+K, 9 Buckets, Tastaturnavigation) | **T-035** |
| F-115 | Bild-Upload Karte single-Modus (Logo/Beitragsbild) | **T-009** |
| F-116 | Bild-Upload Galerie-Modus mit Titelbild | **T-009** |
| F-117 | Bild-Validierung und Drag&Drop | **T-009** |
| F-118 | Fahrzeugdokumente: Liste/Upload/Anzeigen/Löschen | **T-012** |
| F-119 | E-Mail-Composer (Betreff ≤ 200, Text ≤ 50 000, HTML-Toggle, Anhänge ≤ 10 MiB je Datei als Base64) | **T-026** |
| F-120 | Arbeit erfassen (QuickTimeEntryModal) | **T-018** |
| F-121 | PDF-Vorschau per Blob-Iframe (document/reminder) | **T-023** |
| F-122 | TabGroup State-Modus mit `?tab=`-Deep-Link | **T-009** |
| F-123 | TabGroup Nav-Modus | **T-009** |
| F-124 | Listen-Filtertabs (bewusst kein TabGroup) | **T-009** |
| F-125 | Pagination fix 25 mit Phone-/Desktop-Join | **T-009** |
| F-126 | Toolbar (Suche 250 ms debounced, Filter-/Action-Slots) | **T-009** |
| F-127 | EmptyState randlos mit Icon/Titel/Beschreibung/Action | **T-009** |
| F-128 | FormField-Layout (Label oben, ` *`, Fehler vor Hint, `colSpan`) | **T-009** |
| F-129 | Validierungs-Handle `useFormValidation` + `validationClasses`-Familie | **T-009** |
| F-130 | StatCard Kennzahlkacheln mit Farb-Icon | **T-009** |
| F-131 | CompactCustomerCard | **T-009** |
| F-132 | Loader-Varianten (block/inline/overlay), einziger Ladebalken im AppShell | **T-008** |
| F-133 | Toast-System (Einzel-Toast, 4,5 s / Fehler 6 s, manuell schließbar) | **T-008** |
| F-134 | Busy-Store (`active`/`slow`, `run`/`begin`) inkl. Navigations-Kopplung | **T-008** |
| F-135 | MultiSelect (client-seitig) für Benutzerrollen | **T-034** |
| F-136 | PageHeader → globaler Titel/Back/Primary-Action im Header | **T-008** |
| F-137 | Route-lokale Modale (9 Dateien) | **T-009** |
| F-138 | Setup-Gate: App bis Abschluss auf `/setup` umleiten | **T-010** |
| F-139 | `/setup` und `/_app` ohne Session erreichbar | **T-010** |
| F-140 | Setup dauerhaft gesperrt nach Abschluss | **T-010** |
| F-141 | Wizard-Rahmen mit 8 Schritten, Indikator, Zurück/Weiter | **T-010** |
| F-142 | Schritt 1 Willkommen | **T-010** |
| F-143 | Schritt 2 Firmendaten mit Pflichtfeld-Validierung | **T-010** |
| F-144 | Schritt 3 Steuer & Bank mit IBAN/BIC-Prüfung | **T-010** |
| F-145 | Schritt 4 Logo & Anrede + Persistenz Firmendaten | **T-010** |
| F-146 | Schritt 5 SMTP optional (Überspringen) | **T-010** |
| F-147 | Schritt 6 Öffnungszeiten (7 Wochentage) | **T-010** |
| F-148 | Schritt 7 ersten Administrator anlegen | **T-010** |
| F-149 | Schritt 8 Verifikation mit Bearbeiten-Sprüngen | **T-010** |
| F-150 | Setup abschließen | **T-010** |
| F-151 | Click-Time-Validierungs-UX im Wizard | **T-010** |
| F-152 | Fehlerbehandlung beim Schritt-Speichern | **T-010** |
| F-153 | Seed Singleton-Zeilen beim ersten Request | **T-005** |
| F-154 | Seed Nummernkreise | **T-005** |
| F-155 | Seed Mail-Vorlagen (8) | **T-005** |
| F-156 | Seed Ledger-Kategorien (13) | **T-005** |
| F-157 | Seed Rollen + Permissions | **T-005** |
| F-158 | Seed Öffnungszeiten | **T-005** |
| F-159 | Seed Arbeitszeit-Artikel und Verknüpfung | **T-005** |
| F-160 | Settings-Shell: permission-gefilterte Tab-Leiste | **T-010** |
| F-161 | Legacy-Deep-Link-Redirect `?tab=` | **T-010** |
| F-162 | Firmenstammdaten bearbeiten (Allgemein) | **T-010** |
| F-163 | PDF-Endtext pflegen | **T-010** |
| F-164 | Logo hochladen (Settings) | **T-010** |
| F-165 | Logo entfernen | **T-010** |
| F-166 | Stundensatz anzeigen/setzen | **T-010** |
| F-167 | Link-Karte „Reifenwechsel-Erinnerungen" | **T-010** |
| F-168 | Unsaved-Changes-Guard auf Allgemein | **T-010** |
| F-169 | Kombinierte Settings-Query | **T-010** |
| F-170 | Atomare Nummernvergabe mit Self-Seed | **T-006** |
| F-171 | Nummernkreis-Konsumenten und Import-Anschluss | **T-006** |
| F-172 | Firmendaten-Konsumenten | **T-010** |
| F-173 | Sidebar-Eintrag Einstellungen | **T-008** |
| F-174 | Firmenname als Shell-Titel | **T-008** |
| F-175 | Öffentliche Firmen-/Geo-Daten | **T-031** |
| F-176 | Kleinunternehmer-Regelung (§19 UStG) | **T-010** |
| F-177 | Standard-MwSt., Zahlungsziel, Währung | **T-010** |
| F-178 | Kundenliste (Tabelle, Zeilenklick, Aktionsspalte) | **T-011** |
| F-179 | Mobile Kartenliste (< `lg`) | **T-011** |
| F-180 | Serverseitige Volltextsuche | **T-011** |
| F-181 | Kind-Filter-Tabs Alle/Privat/Firma/eBay | **T-011** |
| F-182 | Archiv-Tab | **T-011** |
| F-183 | Pagination fix 25 + Stale-while-revalidate | **T-011** |
| F-184 | Sortierung | **T-011** |
| F-185 | Leerzustände Liste | **T-011** |
| F-186 | Kunde anlegen (Standardkunde) | **T-011** |
| F-187 | Kunde anlegen (eBay-Kunde) | **T-011** |
| F-188 | Kundennummer aus Nummernkreis | **T-011** |
| F-189 | Creation-Flow-Blatt (Rücksprung mit Draft) | **T-011** |
| F-190 | Kunde bearbeiten | **T-011** |
| F-191 | Klick-Zeit-Validierung + Feldfehler | **T-011** |
| F-192 | Unsaved-Changes-Guard | **T-011** |
| F-193 | Detail: Übersicht (Anschrift/Kontakt/Notiz bzw. eBay-Karte) | **T-011** |
| F-194 | Detail: Tab Fahrzeuge | **T-011** |
| F-195 | Detail: Tab Rechnungen | **T-011** |
| F-196 | Detail: Tab Aufträge (paginiert) | **T-011** |
| F-197 | `?tab=`-Deep-Links | **T-011** |
| F-198 | Kunde archivieren/reaktivieren (Detail) | **T-011** |
| F-199 | Kunde reaktivieren (Archiv-Tab, inline) | **T-011** |
| F-200 | Kunde löschen (Liste) | **T-011** |
| F-201 | Lösch-Guard mit Zählungen | **T-011** |
| F-202 | E-Mail an Kunden (Composer) | **T-011** |
| F-203 | Opt-ins Newsletter / Reifenwechsel-Erinnerung | **T-011** |
| F-204 | Kundenpicker (`SearchablePicker`) | **T-011** |
| F-205 | Kombinierter Kunde/Fahrzeug-Picker | **T-011** |
| F-206 | Kompakte Kundenkarte (Halter) | **T-011** |
| F-207 | Kunden in der globalen Suche | **T-011** |
| F-208 | Kundenzähler | **T-011** |
| F-209 | Broadcast-Empfängermenge | **T-011** |
| F-210 | Berechtigung `customers` | **T-011** |
| F-211 | Import-Herkunft (Kfz-Kaufmann) | **T-011** |
| F-212 | Lieferantenliste | **T-011** |
| F-213 | Lieferant anlegen | **T-011** |
| F-214 | Lieferant bearbeiten | **T-011** |
| F-215 | Lieferantendetail | **T-011** |
| F-216 | Lieferant löschen | **T-011** |
| F-217 | Lieferanten-Archiv-Flag (ohne UI) | **T-011** |
| F-218 | Lieferantenpicker | **T-011** |
| F-219 | Lieferanten in der globalen Suche | **T-011** |
| F-220 | Berechtigung `suppliers` | **T-011** |
| F-221 | Fahrzeugliste (Kundenfahrzeuge) mit Suche und Pagination | **T-012** |
| F-222 | Listen-Suche über Kennzeichen (alle Versionen), VIN, Marke, Modell, HSN, TSN, Halter-Nachname/Vorname/Firma | **T-012** |
| F-223 | Archiv-Tab (Aktiv/Archiv) inkl. Inline-Reaktivieren | **T-012** |
| F-224 | Fahrzeug löschen mit Verknüpfungs-Guard | **T-012** |
| F-225 | Responsive Listen-Darstellung | **T-012** |
| F-226 | Kundenfahrzeug anlegen | **T-012** |
| F-227 | `/vehicles/new` als Creation-Flow-Leaf | **T-012** |
| F-228 | Kunden-Neuanlage aus Halter-/Vorbesitzer-Picker (Host) | **T-012** |
| F-229 | Fahrzeug bearbeiten | **T-012** |
| F-230 | Kennzeichen-Versionierung / aktuelles Kennzeichen | **T-012** |
| F-231 | Server-seitige Feldvalidierung mit deutschen Meldungen | **T-012** |
| F-232 | Detail: Übersicht (Stammdaten, Technik, Notiz) | **T-012** |
| F-233 | Detail: Header, CTA und Archiv-Banner | **T-012** |
| F-234 | Detail: Halter-Tab (nur Kundenfahrzeug) | **T-012** |
| F-235 | Detail: Rechnungen-Tab | **T-012** |
| F-236 | Detail: Aufträge-Tab | **T-012** |
| F-237 | Detail: Historie-Tab | **T-012** |
| F-238 | Detail: Fotos-Tab (nur Bestand) | **T-012** |
| F-239 | Detail: Dokumente-Tab (Kunde und Bestand) | **T-012** |
| F-240 | Archivieren/Reaktivieren vom Detail | **T-012** |
| F-241 | Ankauf eines Kundenfahrzeugs in den Bestand | **T-013** |
| F-242 | Verkaufsschild-PDF (A4 quer) | **T-013** |
| F-243 | Verkauf Bestand → Kunde über Rechnung | **T-013** |
| F-244 | Bestandsliste "Zu verkaufende Fahrzeuge" | **T-013** |
| F-245 | Verkaufsfahrzeug direkt anlegen | **T-013** |
| F-246 | Bestandsfahrzeug für Rechnungs-Vorbelegung laden | **T-013** |
| F-247 | Fahrzeug-Picker (3 Varianten) | **T-009** |
| F-248 | Öffentliche Gebrauchtwagen-API | **T-031** |
| F-249 | Globale Suche Bucket "Fahrzeuge" | **T-035** |
| F-250 | HU-Fälligkeit im Dashboard/Kalender | **T-019** |
| F-251 | Legacy-Import der Fahrzeuge | **T-033** |
| F-252 | Vorbesitzer-Relation | **T-013** |
| F-253 | Foto-Lebenszyklus (Stock-only-Invariante) | **T-013** |
| F-254 | Listing-Daten (Preis, §25a, Standort, Highlights, Status) — nur Lesepfade | **T-013** |
| F-255 | Berechtigungssplit `vehicles` vs. `inventory` | **T-012** |
| F-256 | Single-Flight-Refresh nach Mutationen | **T-012** |
| F-257 | Artikelliste mit Suche und Typfilter | **T-014** |
| F-258 | Artikelliste: Spalten, Zeilenklick, Aktionen | **T-014** |
| F-259 | Leerzustand Artikelliste | **T-014** |
| F-260 | Artikel anlegen | **T-014** |
| F-261 | Artikelnummer automatisch | **T-014** |
| F-262 | Artikeltypen | **T-014** |
| F-263 | Kennzeichen „online buchbar" | **T-014** |
| F-264 | Artikel bearbeiten | **T-014** |
| F-265 | Artikel löschen | **T-014** |
| F-266 | Artikel-Detail Stammdaten | **T-014** |
| F-267 | Artikel-Detail Preise und Lager | **T-014** |
| F-268 | Preisversionierung Artikel | **T-014** |
| F-269 | Preisverlauf Artikel, paginiert | **T-014** |
| F-270 | Preis zum Stichtag auflösen | **T-014** |
| F-271 | Artikel-Picker | **T-014** |
| F-272 | Öffentlicher Leistungskatalog | **T-014** |
| F-273 | Klick-Zeit-Validierung Artikelformular | **T-014** |
| F-274 | Unsaved-Changes-Guard | **T-014** |
| F-275 | Reifenliste mit Suche und Saisonfilter | **T-016** |
| F-276 | Reifenliste: Spalten und Aktionen | **T-015** |
| F-277 | Leerzustand Reifenliste | **T-015** |
| F-278 | Reifen anlegen | **T-015** |
| F-279 | Reifennummer aus Nummernkreis | **T-015** |
| F-280 | Größen-Trio und Bauart | **T-014** |
| F-281 | EU-Reifenlabel | **T-015** |
| F-282 | Reifeneigenschaften | **T-015** |
| F-283 | Reifen bearbeiten | **T-015** |
| F-284 | Reifen löschen | **T-015** |
| F-285 | Reifen-Detail | **T-015** |
| F-286 | Reifen-Preisversionen und Verlauf | **T-015** |
| F-287 | Reifengalerie | **T-015** |
| F-288 | Kennzeichen „online verkaufbar" | **T-014** |
| F-289 | Reifengrößen-Parser | **T-015** |
| F-290 | Öffentlicher Reifenkatalog | **T-015** |
| F-291 | Reifen-Picker | **T-015** |
| F-292 | Reifen in der globalen Suche | **T-015** |
| F-293 | Einlagerungsliste mit Tabs | **T-016** |
| F-294 | Einlagerungssuche | **T-016** |
| F-295 | Einlagerung anlegen | **T-016** |
| F-296 | Lagernummer aus Nummernkreis | **T-014** |
| F-297 | Verknüpfung Kunde und Fahrzeug | **T-014** |
| F-298 | Reifendaten der Einlagerung | **T-016** |
| F-299 | Fotos der Einlagerung | **T-016** |
| F-300 | Einlagerung bearbeiten | **T-016** |
| F-301 | Als abgeholt markieren | **T-014** |
| F-302 | Einlagerung löschen | **T-016** |
| F-303 | Einlagerungs-Detail | **T-016** |
| F-304 | Etikett als A6-PDF mit QR | **T-016** |
| F-305 | Scan-Route | **T-016** |
| F-306 | Einlagerung in der globalen Suche | **T-016** |
| F-307 | Kandidaten für Reifenerinnerungen | **T-016** |
| F-308 | Vorschau der Erinnerungen | **T-016** |
| F-309 | Erinnerungen versenden | **T-016** |
| F-310 | Einstellungsseite Reifenerinnerungen | **T-016** |
| F-311 | Berechtigungen und Navigation | **T-014** |
| F-312 | Kanban-Board mit drei festen Spalten | **T-020** |
| F-313 | Kanban-Volltextsuche | **T-020** |
| F-314 | Kanban-Mitarbeiterfilter | **T-020** |
| F-315 | Kanban-Karte | **T-020** |
| F-316 | Sortierung und Begrenzung | **T-020** |
| F-317 | Statuswechsel per Pfeil-Buttons (optimistisch) | **T-020** |
| F-318 | HTML5 Drag & Drop | **T-020** |
| F-319 | Rechnungslink auf done-Karten | **T-020** |
| F-320 | Auftrag anlegen | **T-020** |
| F-321 | Auftragsformular-Felder | **T-020** |
| F-322 | Regel Kunde ODER Fahrzeug | **T-020** |
| F-323 | Auto-Titel | **T-020** |
| F-324 | Kunde/Fahrzeug-Relation | **T-020** |
| F-325 | Creation-Flow "Neu anlegen" | **T-020** |
| F-326 | Unsaved-Changes-Guard | **T-020** |
| F-327 | Klick-Zeit-Validierung, Button nie gesperrt | **T-020** |
| F-328 | Auftrag bearbeiten | **T-020** |
| F-329 | Auftragsnummer | **T-020** |
| F-330 | Auftrag aus Termin | **T-020** |
| F-331 | Detail-Kopf und Statusaktionen | **T-020** |
| F-332 | Stammdaten-Karte | **T-020** |
| F-333 | Abgerechnet-Hinweis | **T-020** |
| F-334 | Positionen-Tabelle | **T-020** |
| F-335 | Positionsformular | **T-020** |
| F-336 | Katalog-Picker mit Kategorie | **T-020** |
| F-337 | Positions-Validierung (Client) | **T-020** |
| F-338 | Position bearbeiten | **T-020** |
| F-339 | Position löschen | **T-020** |
| F-340 | Server-Normalisierung der Position | **T-020** |
| F-341 | Zeiterfassungs-Write-Through | **T-020** |
| F-342 | Positionssperre | **T-020** |
| F-343 | Abschluss-Dialog | **T-020** |
| F-344 | Rechnungserzeugung aus Positionen | **T-020** |
| F-345 | Regel "max. eine aktive Rechnung" | **T-020** |
| F-346 | Storno öffnet Auftrag wieder | **T-020** |
| F-347 | Rechnungshistorie-Karte | **T-020** |
| F-348 | Wiederöffnen-Regeln | **T-020** |
| F-349 | Auftrag löschen mit GoBD-Guard | **T-020** |
| F-350 | Statusmaschine | **T-020** |
| F-351 | Berechtigungen | **T-020** |
| F-352 | Aufträge-Tab Kundendetail | **T-020** |
| F-353 | Aufträge-Tab Fahrzeugdetail | **T-020** |
| F-354 | Rückverweis auf Rechnungsdetail | **T-020** |
| F-355 | Kalender-Integration | **T-020** |
| F-356 | Zeiterfassungsmodul-Kopplung | **T-020** |
| F-357 | Stundensatz-Verwaltung | **T-020** |
| F-358 | Fahrzeug-Löschguard zählt Aufträge | **T-020** |
| F-359 | Unlöschbarkeit auftragsgebundener Rechnungen | **T-020** |
| F-360 | Paginierte Auftragsliste (Server) | **T-020** |
| F-361 | Formatierung | **T-020** |
| F-362 | Ladeverhalten | **T-020** |
| F-363 | Zuweisungen (Assignees) | **T-020** |
| F-364 | Terminplanung ohne Zeitzone | **T-020** |
| F-365 | Migrationen/Seeds | **T-020** |
| F-366 | Mitarbeiter-Roster für Positionsanzeige | **T-020** |
| F-367 | Angebotsliste mit Suche, Typfilter, Pagination | **T-021** |
| F-368 | Angebotsliste: Zeilen-Navigation, Mobil-Kartenliste, Status-Badges | **T-021** |
| F-369 | Angebot/KV/AB löschen (Liste) | **T-021** |
| F-370 | Angebot/KV/AB anlegen | **T-021** |
| F-371 | Kunde/Fahrzeug „Neu anlegen" aus dem Belegformular (creation-flow) | **T-021** |
| F-372 | Positionen-Editor: Quelle Frei/Artikel/Leistung/Fahrzeug | **T-021** |
| F-373 | Positionen-Editor: Felder und Live-Summen | **T-021** |
| F-374 | Lagerfahrzeug als Position + Dokument-Fahrzeuglink | **T-021** |
| F-375 | 0-€-Warnmodal | **T-021** |
| F-376 | Unsaved-changes-Guard | **T-021** |
| F-377 | Angebotsdetail: Positionen, Summen, Endtext, PDF | **T-021** |
| F-378 | Angebotslebenszyklus-CTA | **T-021** |
| F-379 | Angebot stornieren | **T-021** |
| F-380 | Konvertierungs-Banner | **T-021** |
| F-381 | Angebot → Rechnung konvertieren | **T-021** |
| F-382 | Arbeit erfassen / Stunden-Karte auf Beleg | **T-021** |
| F-383 | Rechnungsliste mit Suche, Statusfilter, Bezahlt-Spalte | **T-022** |
| F-384 | Rechnung löschen (Liste + Detail) | **T-022** |
| F-385 | Rechnung anlegen | **T-022** |
| F-386 | Rechnung aus Verkaufsbestand (`?vehicleId`) | **T-022** |
| F-387 | Rechnungsdetail: Positionen, Summen, Endtext | **T-022** |
| F-388 | Rechnungsdetail: Kunde-/Fahrzeug-/Auftrag-Karten | **T-022** |
| F-389 | Rechnungslebenszyklus-CTA + Barzahlung | **T-022** |
| F-390 | Fahrzeugübergabe bei Bezahlung | **T-022** |
| F-391 | Rechnung stornieren (GoBD) | **T-022** |
| F-392 | Storno-Banner beidseitig | **T-022** |
| F-393 | Überfällig-/Erinnerungs-Banner + Erinnerung senden | **T-022** |
| F-394 | XRechnung-Download | **T-024** |
| F-395 | PDF-Vorschau (nativer Viewer) | **T-023** |
| F-396 | PDF-Vorlage Rechnung/Angebot/KV/AB | **T-023** |
| F-397 | PDF-Vorlage Storno | **T-023** |
| F-398 | PDF-Vorlage Zahlungserinnerung | **T-023** |
| F-399 | PDF-Vorlage Verkaufsschild | **T-023** |
| F-400 | PDF-Vorlage Reifen-Etikett | **T-023** |
| F-401 | Kleinunternehmer-Modus (§19 UStG) | **T-023** |
| F-402 | Byte-deterministische PDFs + Input-Hash | **T-023** |
| F-403 | WinAnsi-Sanitizing / Wrap / Ellipsis | **T-023** |
| F-404 | Historisches Kennzeichen im PDF | **T-023** |
| F-405 | E-Mail-Versand mit PDF-Anhang und Protokoll | **T-026** |
| F-406 | Nummernkreise (atomar, selbstseedend) | **T-006** |
| F-407 | Zeilen-/Belegberechnung (Server) | **T-022** |
| F-408 | GoBD-Löschschutz | **T-022** |
| F-409 | Auftrag ↔ Rechnung (Backlink, Reopen) | **T-022** |
| F-410 | Rechnungsausgangsbuch | **T-029** |
| F-411 | Statuslabels/Badges/Typlabels (Deutsch) | **T-006** |
| F-412 | Public-API-Bestellung erzeugt Rechnungs-Entwurf | **T-031** |
| F-413 | Dashboard-Link „Neues Angebot" | **T-035** |
| F-414 | SMTP-Transport aus Einstellungen (Host/Port/Modus none·STARTTLS·TLS/Auth) | **T-026** |
| F-415 | Absender-Header From/Reply-To | **T-026** |
| F-416 | Platzhalter-Engine `{key}` mit Firmen-, Kunden-, Fahrzeug-, Beleg-Variablen, Anrede-Stil Sie/Du, `extra`-Override, unbekannte Keys bleiben stehen | **T-026** |
| F-417 | Vorlagen-Versand mit PDF-Anhang für Rechnung/Angebot/KV/AB | **T-026** |
| F-418 | Versandprotokoll `sent_messages` (pending → sent/failed, Fehlertext, Message-ID, Anhang-Metadaten) | **T-026** |
| F-419 | Ad-hoc-E-Mail an einen Kunden (Composer-Modal, Anhänge, HTML-Option) | **T-026** |
| F-420 | HTML-Versand opt-in mit automatischem Plain-Text-Fallback, Audit speichert nur Text | **T-026** |
| F-421 | Anhänge im Composer (Mehrfachauswahl, 10-MiB-Cap/Datei mit Toast, Entfernen, Größenanzeige) | **T-026** |
| F-422 | Rundschreiben: Empfänger-Vorschau (Opt-in gesamt, mit E-Mail, 5 Beispielnamen) | **T-027** |
| F-423 | Rundschreiben senden in BCC-Batches à 50 mit Teilfehler-Toleranz, Ergebnis `{sent, failed}` | **T-027** |
| F-424 | Abbestellen-Fußzeile (Text+HTML) + `List-Unsubscribe`-mailto-Header; Opt-out manuell durch Operator | **T-027** |
| F-425 | Rundschreiben-Historie (letzte 10 Empfängerzeilen mit Status) | **T-027** |
| F-426 | Gesendet-Liste: Suche (Empfänger/Betreff/Name), Typfilter, Monatsnavigation, Pagination 25 | **T-026** |
| F-427 | Gesendet-Detail: Kopfdaten, Status-Badge, SMTP-Fehlertext, Body-Text, PDF-Viewer (Beleg/Reminder) | **T-026** |
| F-428 | OP-Liste offener Rechnungen mit Verzugstagen, Offen-Betrag (abzgl. Teilzahlungen), Erinnerungszähler, letzte Erinnerung; StatCards Offene Beträge / Überfällige Rechnungen / Überfälliger Betrag | **T-025** |
| F-429 | Zahlungserinnerung manuell senden (OP-Liste ohne Dialog; Rechnung mit Banner-CTA und ConfirmDialog bei Wiederholung) | **T-025** |
| F-430 | Batch „Fällige jetzt versenden" (erste Erinnerung `dueDate + reminderDays1`, Folge `letzte + reminderRecurEveryDays`) | **T-025** |
| F-431 | Historie versendeter Zahlungserinnerungen (global + je Rechnung) | **T-025** |
| F-432 | Zahlungserinnerungs-Detail mit PDF-Viewer und Forderungsaufstellung | **T-025** |
| F-433 | Reminder-Banner auf der Rechnung (überfällig / N versendet, letzte am …) mit CTA und Link „Zur letzten Erinnerung" | **T-025** |
| F-434 | Zahlungserinnerungs-Einstellungen: Auto-Toggle, Kleinunternehmer-Toggle, Erste Erinnerung nach N Tagen (0–365), Folge alle N Tage (1–365) | **T-025** |
| F-435 | Inline-Editor der Vorlage `reminder_1` in den Zahlungserinnerungs-Einstellungen inkl. Reset | **T-025** |
| F-436 | Mailvorlagen-Verwaltung: 8 Vorlagen (Select mit deutschen Labels, „· angepasst"), Betreff ≤200, Body ≤20 000, Speichern (`isCustom=true`), Reset auf Seed-Default | **T-026** |
| F-437 | Seed der Standard-Vorlagen und leeren SMTP-Zeile bei Setup/erstem Request | **T-026** |
| F-438 | SMTP-Formular (Absender-Adresse/-Name, Host, Port mit Auto-Vorschlag je Modus, Verschlüsselung, Benutzer, Passwort „leer = behalten") | **T-026** |
| F-439 | SMTP-Passwort verschlüsselt at rest (AES-256-GCM, Legacy-Klartext toleriert) | **T-026** |
| F-440 | SMTP-Testversand mit 10-s-Timeouts, kuratierten deutschen Fehlermeldungen, Dirty-Hinweis, Empfänger-Prefill, Double-Fire-Guard (429) | **T-026** |
| F-441 | Reifenwechsel-Erinnerung (Vorlage `tire_reminder`, Saison-Idempotenz) | **T-016** |
| F-442 | Terminbestätigung nach öffentlicher Buchung (Berlin-Zeit, Bestätigungs-Code) | **T-031** |
| F-443 | Kontaktformular-Benachrichtigung an Firmenmail mit Referenzauflösung (Fahrzeug/Reifen/Artikel), Reply-To = Anfragender, Retry aus Anfragen-Liste | **T-031** |
| F-444 | Deutsche Feldlabels für Validierungsfehler der Mail-Schemas | **T-004** |
| F-445 | Navigation/Permissions: „Offene Rechnungen" (`reminders`), „Rundschreiben" (`mailings`), „Gesendet" (`invoices`), „Anfragen" (`mailings`), Settings-Tabs Mailvorlagen/Zahlungserinnerung/SMTP (`settings`) | **T-008** |
| F-446 | Legacy-Deep-Links `/settings?tab=mail\ | **T-010** |
| F-447 | Dev-Mail-Catcher für lokale Versandtests (.eml-Dateien) | **T-001** |
| F-448 | Buchungsliste als Monatsansicht mit Monatsnavigation | **T-028** |
| F-449 | Volltextsuche Beschreibung/Beleg-Nr. | **T-028** |
| F-450 | Art-Filter Alle/Einnahmen/Ausgaben | **T-028** |
| F-451 | Summen-Cards Einnahmen/Ausgaben/Saldo (gefiltert) | **T-028** |
| F-452 | Serverseitige Pagination 25 | **T-028** |
| F-453 | Leerzustand der Liste | **T-028** |
| F-454 | Zeilendarstellung | **T-028** |
| F-455 | Zeile klickbar → Bearbeiten | **T-028** |
| F-456 | Buchung aus Liste löschen (optimistisch) | **T-028** |
| F-457 | Neue Buchung anlegen | **T-028** |
| F-458 | Datum-Preset aus der Monatsansicht | **T-028** |
| F-459 | Richtungsabhängige Kategorienliste | **T-028** |
| F-460 | Brutto-basierte Netto/Steuer-Ableitung | **T-028** |
| F-461 | Zahlungsart und Zahlungsstatus | **T-028** |
| F-462 | Click-time-Validierung mit deutschen Meldungen | **T-028** |
| F-463 | Unsaved-Changes-Handling | **T-028** |
| F-464 | Buchung bearbeiten (manuelle Buchung) | **T-028** |
| F-465 | Read-only-Modus für System-Buchungen | **T-028** |
| F-466 | Buchung von der Edit-Seite löschen | **T-028** |
| F-467 | 404 für unbekannte Buchung | **T-028** |
| F-468 | Standard-Kategorien (Seed) | **T-028** |
| F-469 | DATEV-Export-Dialog | **T-028** |
| F-470 | DATEV-CSV Grundformat | **T-028** |
| F-471 | DATEV: Rechnungen exportieren | **T-028** |
| F-472 | DATEV: Ledger-Buchungen exportieren mit Kategorie-Mapping | **T-028** |
| F-473 | DATEV: Feld-Sanitizing und Encoding | **T-028** |
| F-474 | DATEV: Browser-Download | **T-028** |
| F-475 | Berechtigung und Navigation | **T-028** |
| F-476 | Single-Flight-Refresh | **T-028** |
| F-477 | Dashboard-KPIs aus dem Kassenbuch (Cross-Modul) | **T-028** |
| F-478 | Rechnungsausgangsbuch (Abgrenzung) | **T-029** |
| F-479 | Legacy-Import und Kassenbuch (Cross-Modul) | **T-033** |
| F-480 | Schema-Vorräte ohne UI | **T-005** |
| F-481 | Mitarbeiterliste mit Volltextsuche, Pagination | **T-017** |
| F-482 | Leerzustand Mitarbeiterliste | **T-017** |
| F-483 | Mitarbeiter anlegen (Stammdaten) | **T-017** |
| F-484 | Initiale Gehaltsversion beim Anlegen | **T-017** |
| F-485 | Gehalts-Autoberechnung im Formular | **T-017** |
| F-486 | Creation-Flow-Leaf "Mitarbeiter" | **T-017** |
| F-487 | Mitarbeiter-Detail: Karten Person & Anschrift, Beschäftigung, Steuer & SV, Bankverbindung | **T-017** |
| F-488 | Gehaltshistorie (read-only) | **T-017** |
| F-489 | Mitarbeiter bearbeiten | **T-017** |
| F-490 | Automatische neue Gehaltsversion bei Änderung | **T-017** |
| F-491 | Mitarbeiter löschen (hart) | **T-017** |
| F-492 | Archivierungs-Flag (nur Datenmodell/Filter) | **T-017** |
| F-493 | Mitarbeiter-Picker | **T-017** |
| F-494 | Abwesenheiten je Jahr anzeigen | **T-017** |
| F-495 | Resturlaub-Berechnung | **T-017** |
| F-496 | Krankheitstage-KPI | **T-017** |
| F-497 | Abwesenheit eintragen (Urlaub/Krankheit/Sonstiges, Status, Halbtag, Notiz) | **T-017** |
| F-498 | Validierung Abwesenheit (Client + Server) | **T-017** |
| F-499 | Kreuz-Konflikt Urlaub↔Krankheit mit Ersetzen-Dialog | **T-017** |
| F-500 | Abwesenheit stornieren | **T-017** |
| F-501 | Abwesenheit löschen | **T-017** |
| F-502 | Vergangene Jahre schreibgeschützt (UI) | **T-017** |
| F-503 | Abwesenheit ändern (Datum/Typ/Notiz/Halbtag) | **T-017** |
| F-504 | Abwesenheits-Anhang (AU-Scan) | **T-017** |
| F-505 | Abwesenheiten im Kalender | **T-017** |
| F-506 | Stundenliste (Manager) mit Scope-Tabs, Datumsfilter, Mitarbeiterfilter, Auftrags-Deep-Link | **T-018** |
| F-507 | Stundenliste (Self-Service) | **T-018** |
| F-508 | Stundeneintrag anlegen (Manager) | **T-018** |
| F-509 | Stundeneintrag anlegen (Self-Service) | **T-018** |
| F-510 | Kunde aus Stundenformular anlegen (Creation-Flow) | **T-018** |
| F-511 | Stundeneintrag-Detail | **T-018** |
| F-512 | Stundeneintrag bearbeiten | **T-018** |
| F-513 | Stundeneintrag löschen | **T-018** |
| F-514 | Auftrags-Write-Through-Zeilen read-only | **T-018** |
| F-515 | "Arbeit erfassen" vom Beleg (QuickTimeEntryModal) | **T-018** |
| F-516 | Karte "Erfasste Stunden" auf Beleg-Detail | **T-018** |
| F-517 | Auslastungs-Report | **T-018** |
| F-518 | Monatsauswertung | **T-018** |
| F-519 | Reports-Tabs mit Deep-Link | **T-018** |
| F-520 | Öffnungszeiten je Wochentag pflegen | **T-018** |
| F-521 | Öffnungszeiten-Defaults / Lazy-Seed | **T-018** |
| F-522 | Öffnungszeiten-Verwendung | **T-018** |
| F-523 | Zwei-Stufen-Berechtigung Stunden | **T-018** |
| F-524 | Berechtigung Mitarbeiter/Abwesenheiten | **T-017** |
| F-525 | Feiertagsberücksichtigung nach Firmen-Bundesland | **T-019** |
| F-526 | Deutsche Fehlerübersetzung der Feldnamen | **T-004** |
| F-527 | Monatsraster (Desktop ≥ `lg`) | **T-019** |
| F-528 | Agenda-Liste (Mobil < `lg`) | **T-019** |
| F-529 | Monatsnavigation | **T-019** |
| F-530 | Mitarbeiterfilter | **T-019** |
| F-531 | Event-Quellen, Farben, Klickziele | **T-019** |
| F-532 | Stale-while-revalidate | **T-019** |
| F-533 | Termin anlegen | **T-019** |
| F-534 | Ganztägiger Termin | **T-019** |
| F-535 | Termin-Status | **T-019** |
| F-536 | Verknüpfungen Kunde/Fahrzeug/Mitarbeiter inkl. Creation-Flow | **T-019** |
| F-537 | Überschneidungswarnung | **T-019** |
| F-538 | Betriebsschließung anlegen/bearbeiten | **T-019** |
| F-539 | Eintrag bearbeiten | **T-019** |
| F-540 | Eintrag löschen | **T-019** |
| F-541 | Termin → Auftrag | **T-019** |
| F-542 | Cross-Modul-Karten | **T-019** |
| F-543 | Unsaved-Changes-Guard | **T-019** |
| F-544 | Feiertage algorithmisch | **T-019** |
| F-545 | Feiertage in Arbeitstagen (Abwesenheiten) | **T-019** |
| F-546 | Abwesenheiten im Kalender | **T-019** |
| F-547 | HU-Fälligkeiten im Kalender | **T-019** |
| F-548 | Aufträge im Kalender | **T-019** |
| F-549 | Öffnungszeiten (Slot-Grundlage) | **T-019** |
| F-550 | Freie Slots (extern) | **T-031** |
| F-551 | Terminbuchung (extern) | **T-031** |
| F-552 | Bestätigungsmail | **T-031** |
| F-553 | Dashboard-Terminkacheln | **T-035** |
| F-554 | Paginierte Terminliste (Backend vorhanden, keine UI) | **T-019** |
| F-555 | Legacy-Import von Terminen | **T-033** |
| F-556 | Zugriff/Permission | **T-019** |
| F-557 | Bearer-Token-Authentifizierung aus `API_TOKENS` | **T-031** |
| F-558 | Einheitliches JSON-Envelope und Fehlercodes | **T-031** |
| F-559 | CORS für die Website | **T-031** |
| F-560 | Rate-Limiting | **T-031** |
| F-561 | Session-Whitelist für die API | **T-031** |
| F-562 | Gebrauchtwagen-Liste | **T-031** |
| F-563 | Gebrauchtwagen-Detail | **T-031** |
| F-564 | Reifenkatalog mit Filtern | **T-031** |
| F-565 | Reifen-Detail | **T-031** |
| F-566 | Leistungskatalog | **T-031** |
| F-567 | Leistungs-Detail | **T-031** |
| F-568 | Freie Terminslots | **T-031** |
| F-569 | Online-Terminbuchung | **T-031** |
| F-570 | Online-Reifenbestellung | **T-031** |
| F-571 | Kontaktformular-Eingang | **T-031** |
| F-572 | Firmendaten-Endpoint | **T-031** |
| F-573 | Öffentliche News-Liste | **T-031** |
| F-574 | Öffentliches News-Detail per Slug | **T-031** |
| F-575 | Beitragsliste intern | **T-030** |
| F-576 | Beitrag anlegen | **T-030** |
| F-577 | Beitrag-Detail mit Publish-Toggle | **T-030** |
| F-578 | Beitrag bearbeiten | **T-030** |
| F-579 | Beitrag löschen aus der Liste | **T-030** |
| F-580 | Slug-Regeln | **T-030** |
| F-581 | Titelbild-Verwaltung | **T-030** |
| F-582 | Anfragen-Posteingang | **T-030** |
| F-583 | Benachrichtigung erneut senden | **T-030** |
| F-584 | Interne Benachrichtigungsmail mit Bezugsauflösung | **T-030** |
| F-585 | Terminbestätigung an den Kunden | **T-030** |
| F-586 | Berechtigungen und Navigation | **T-030** |
| F-587 | Öffnungszeiten-Defaults und Feiertage | **T-019** |
| F-588 | eBay-Status-Karte mit drei Zuständen (nicht konfiguriert / getrennt / verbunden) | **T-032** |
| F-589 | Sandbox-Kennzeichnung | **T-032** |
| F-590 | Konfigurationsprüfung über Env | **T-032** |
| F-591 | Mit eBay verbinden (Consent-URL) | **T-032** |
| F-592 | OAuth-Callback verarbeiten | **T-032** |
| F-593 | Token-Austausch und verschlüsselte Ablage (Single-Row) | **T-032** |
| F-594 | Automatischer Access-Token-Refresh | **T-032** |
| F-595 | Callback-Flags als Toasts + URL-Bereinigung | **T-032** |
| F-596 | Verbindung trennen | **T-032** |
| F-597 | Listing-Import (Trading API `GetMyeBaySelling`) | **T-032** |
| F-598 | Listing-Feldmapping | **T-032** |
| F-599 | Kuratierte Fehlerklassen des Listing-Imports | **T-032** |
| F-600 | Import-Info-Karte | **T-032** |
| F-601 | Tabelle „Importierte Angebote" mit Suche, Status-Filter, Pagination 25, Row-Click | **T-032** |
| F-602 | Compliance: Challenge-Handshake | **T-032** |
| F-603 | Compliance: Notification-Empfang | **T-032** |
| F-604 | Whitelist + Rate-Limit für den Compliance-Endpoint | **T-032** |
| F-605 | Secrets-at-rest-Helfer | **T-032** |
| F-606 | Settings-Tabs „eBay" (`settings`) und „Import" (`import`) | **T-032** |
| F-607 | Import-Seite: Datei wählen + Hinweise | **T-033** |
| F-608 | Click-Time-Validierung ohne Datei | **T-033** |
| F-609 | Vorschau (Dry-Run) | **T-033** |
| F-610 | Echter Import mit Bestätigung | **T-033** |
| F-611 | Live-Fortschritt | **T-033** |
| F-612 | Ergebnis-Modal | **T-033** |
| F-613 | Upload-Transport | **T-033** |
| F-614 | Read-before-wipe | **T-033** |
| F-615 | Wipe-Semantik | **T-033** |
| F-616 | Mapping `Kunden` → `customers` | **T-033** |
| F-617 | Mapping `Autos` → `vehicles` + Kennzeichen-Version | **T-033** |
| F-618 | Mapping `Lieferanten` → `suppliers` | **T-033** |
| F-619 | Mapping `Artikel` → `items` + `item_price_versions` | **T-033** |
| F-620 | Mapping `Rechnungen` → `documents(type='invoice')` | **T-033** |
| F-621 | Mapping `RechnungDetails` → `document_items` | **T-033** |
| F-622 | Mapping `Teilzahlungen` → `document_payments` | **T-033** |
| F-623 | Mapping `Angebote`/`AngebotDetails` → `documents` + `document_items` + Sammel-Angebot | **T-033** |
| F-624 | Mapping `Mahnungen` → `reminders` | **T-033** |
| F-625 | Mapping `reifenlager` → `tire_storage` | **T-033** |
| F-626 | Mapping `mitarbeiter` → `employees` | **T-033** |
| F-627 | Mapping `termine` → `calendar_entries(kind='appointment')` | **T-033** |
| F-628 | Nummernkreise nach Import | **T-033** |
| F-629 | PDF-Vorab-Rendering | **T-033** |
| F-630 | Audit-Job und Skip-Report | **T-033** |
| F-631 | Container-Voraussetzungen | **T-033** |

### Befunde je Arbeitspaket

Nur Befunde mit der Einordnung „im Rewrite beheben". Jeder davon braucht einen Regressionstest mit der Befund-ID im Namen.

| Paket | Anzahl | Befund-IDs |
| --- | --- | --- |
| **T-001** | 0 | – |
| **T-002** | 0 | – |
| **T-003** | 0 | – |
| **T-004** | 6 | B-012, B-022, B-042, B-044, B-149, B-363 |
| **T-005** | 30 | B-015, B-079, B-137, B-139–B-140, B-411, B-560–B-565, B-567–B-568, B-570–B-571, B-574–B-575, B-577–B-579, B-582–B-589, B-594 |
| **T-006** | 6 | B-011, B-018, B-026, B-028, B-304, B-335 |
| **T-007** | 15 | B-002–B-003, B-013–B-014, B-018, B-041, B-051–B-052, B-054, B-056–B-058, B-071–B-072, B-080 |
| **T-008** | 13 | B-012, B-014, B-017, B-019–B-020, B-033–B-035, B-037–B-038, B-043, B-058, B-375 |
| **T-009** | 20 | B-082–B-084, B-086–B-087, B-091, B-093, B-096, B-100, B-106–B-109, B-111, B-113–B-116, B-216, B-225 |
| **T-010** | 24 | B-001, B-046, B-077, B-117–B-118, B-120–B-126, B-128–B-131, B-141–B-144, B-146, B-148, B-150, B-152 |
| **T-011** | 31 | B-153–B-157, B-159–B-162, B-165–B-166, B-170–B-174, B-176–B-179, B-181–B-186, B-189, B-191–B-194 |
| **T-012** | 14 | B-105, B-197, B-202–B-204, B-206, B-209–B-210, B-214–B-215, B-217–B-218, B-226, B-228 |
| **T-013** | 7 | B-197, B-203, B-207, B-210, B-213, B-216, B-225 |
| **T-014** | 21 | B-229, B-231, B-233, B-236–B-243, B-248–B-249, B-251, B-257–B-260, B-263–B-265 |
| **T-015** | 13 | B-232, B-234, B-239, B-242–B-243, B-245–B-247, B-250, B-257, B-260, B-263, B-265 |
| **T-016** | 17 | B-229–B-230, B-235, B-239–B-241, B-246–B-248, B-250, B-252–B-253, B-255, B-258–B-259, B-263–B-264 |
| **T-017** | 16 | B-420–B-423, B-426, B-428, B-430–B-433, B-449–B-451, B-453–B-455 |
| **T-018** | 14 | B-051, B-089–B-090, B-435–B-437, B-441–B-443, B-445–B-446, B-450–B-451, B-455 |
| **T-019** | 17 | B-456–B-458, B-460–B-462, B-470–B-472, B-477–B-479, B-482–B-485, B-516 |
| **T-020** | 22 | B-268–B-270, B-272–B-273, B-275–B-276, B-280–B-281, B-283, B-285–B-289, B-292–B-296, B-298–B-299 |
| **T-021** | 18 | B-303–B-304, B-306, B-312–B-317, B-325, B-327–B-328, B-333, B-338, B-340, B-342, B-346, B-348 |
| **T-022** | 14 | B-301, B-303–B-305, B-313–B-314, B-316–B-317, B-323, B-325, B-338–B-339, B-342–B-343 |
| **T-023** | 8 | B-031, B-103, B-304, B-308, B-313, B-326, B-330, B-333 |
| **T-024** | 2 | B-309, B-330 |
| **T-025** | 13 | B-349, B-352–B-355, B-369–B-373, B-377, B-381, B-384 |
| **T-026** | 19 | B-101, B-116, B-345, B-349–B-351, B-355, B-360–B-363, B-365–B-366, B-368, B-373, B-375–B-377, B-380 |
| **T-027** | 4 | B-351, B-358, B-380, B-383 |
| **T-028** | 20 | B-385–B-387, B-389–B-390, B-393–B-400, B-405–B-406, B-409–B-410, B-412, B-415, B-418 |
| **T-029** | 5 | B-319–B-320, B-336, B-405, B-417 |
| **T-030** | 9 | B-486, B-491, B-498, B-503–B-504, B-506, B-517, B-519–B-520 |
| **T-031** | 26 | B-003, B-054, B-205–B-206, B-225, B-351, B-380, B-463–B-464, B-466–B-467, B-469, B-484, B-488, B-490–B-493, B-495–B-496, B-498–B-499, B-501, B-503, B-510, B-516 |
| **T-032** | 13 | B-522–B-527, B-529, B-531–B-532, B-550–B-553 |
| **T-033** | 15 | B-480, B-526, B-533, B-535, B-537–B-538, B-542, B-545–B-549, B-554, B-558–B-559 |
| **T-034** | 18 | B-046–B-051, B-059–B-061, B-064–B-067, B-073, B-077–B-078, B-080, B-093 |
| **T-035** | 18 | B-006–B-011, B-028–B-029, B-035–B-036, B-042, B-045, B-088, B-093, B-109, B-113, B-475–B-476 |
| **T-036** | 2 | B-004, B-017 |
| **T-037** | 0 | – |
| **T-038** | 0 | – |
| **T-039** | 0 | – |
| **T-040** | 1 | B-021 |
| **T-041** | 19 | B-595–B-602, B-604, B-607–B-611, B-613–B-617 |
| **T-042** | 0 | – |
