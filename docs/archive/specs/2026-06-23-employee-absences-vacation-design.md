# Mitarbeiter-Abwesenheiten & Urlaubsverwaltung — Design

**Datum:** 2026-06-23
**Status:** Approved (Brainstorming abgeschlossen)
**Scope:** Teil A von zwei. Teil B („Aufträge / Work-Items"-Modul) ist ein
eigenes Projekt mit eigenem Spec und wird danach angegangen.

## Ziel

Die Erfassung von Urlaub, Krankheit und Sonstigem für Mitarbeiter soll
korrekt funktionieren. Kernstück ist eine **wiederverwendbare
„Arbeitstag"-Logik** (Unternehmenstage), die überall im System genutzt
werden kann, plus eine korrekte Resturlaubsberechnung inklusive
Jahresübertrag und Betriebsschließungen.

## Ist-Zustand (vorhanden, wird umgebaut)

- `absence-service.ts` existiert: Typen `vacation`/`sick`/`other`,
  Anlegen/Ändern/Löschen, Konflikt-Erkennung (Urlaub vs. Krankheit),
  `remainingVacationDays`. **Aber:** Arbeitstage werden simpel als
  Mo–Fr gezählt — ohne Feiertage, ohne echte Werkstatt-Öffnungstage,
  ohne Betriebsschließungen; **kein** Übertrag; **keine**
  Pro-Mitarbeiter-Einstellung.
- `employee_absences` (Tabelle): `type`, `date_from`, `date_to`,
  `half_day`, `notes`, `status` (default `approved`), Anhang-Felder.
- `employees`: u. a. `vacation_days_per_year`, `archived`. **Kein**
  Carryover-Feld.
- `workshop_hours` (`weekday`, `opens_at`, `closes_at`, `closed`) =
  Definition der Öffnungstage. `public_holidays` (`state`, `date`,
  `name`) = Feiertage.
- Betriebsschließungen = `calendar_entries` mit `kind='closure'`,
  `starts_at`/`ends_at` (Timestamps), `all_day`.

## Entscheidungen (vom Nutzer bestätigt)

1. **Arbeitstag-Modell: global** über `workshop_hours` + `public_holidays`
   (für alle Mitarbeiter gleich). Kein Pro-Mitarbeiter-Wochenplan.
2. **Übertrag: unbegrenzt**, pro Mitarbeiter aktivierbar; optionaler
   Anfangsbestand für Altdaten.
3. **Betriebsschließungen** rechnen pro aktivem Mitarbeiter automatisch
   einen Urlaubstag an, **außer** der Mitarbeiter ist an dem Tag krank.
   „Sonstiges" schützt nicht. Schließungen werden **nicht** als
   Mitarbeiter-Abwesenheiten gespeichert, sondern berechnet und
   transparent ausgewiesen.
4. **Validierung:** Urlaub eines Mitarbeiters = **harte Sperre** bei
   Überschreitung. Betriebsschließung = **Warnung + Override** (Modal):
   anlegbar trotz fehlender Tage; überzählige Schließungstage werden
   beim betroffenen Mitarbeiter **nicht angerechnet** (kein Minus).

## Komponenten

### 1. `workday-service.ts` (neu, wiederverwendbar)

Zentrale, seiteneffektfreie Logik für „Unternehmenstage". Single source
of truth, überall einsetzbar (Abwesenheiten, Schließungen, später
Dashboard/Work-Items).

```
loadWorkdayContext(fromIso, toIso): Promise<WorkdayContext>
  // lädt einmalig: geöffnete Wochentage aus workshop_hours
  // + Feiertage (public_holidays) im Bereich → in-memory Set/Map.

isWorkday(ctx, iso): boolean
  // true, wenn Wochentag geöffnet (workshop_hours.closed=false)
  //       UND iso kein Feiertag.

countWorkdays(ctx, fromIso, toIso): number
  // Anzahl Arbeitstage inkl. beider Enden.

eachWorkday(ctx, fromIso, toIso): string[]
  // Liste der Arbeitstag-ISO-Daten (für Schnittmengen mit Schließungen
  // und Krank-Tagen).
```

Begründung für den Kontext-Ansatz: ein Aufruf lädt Öffnungstage +
Feiertage einmal; danach sind `isWorkday`/`countWorkdays` rein
synchron und ohne weitere DB-Treffer — damit auch in Schleifen über
viele Mitarbeiter günstig.

### 2. Schema (Migration 0030)

`employees` erhält:

- `vacation_carryover boolean NOT NULL DEFAULT false` — ob Resturlaub
  ins Folgejahr übertragen wird.
- `vacation_carryover_days integer NOT NULL DEFAULT 0` — einmaliger
  Anfangsbestand (Alturlaub) zum Start der Erfassung im Eintrittsjahr.

Abwesenheitstypen bleiben `vacation`/`sick`/`other`. `half_day` bleibt
erhalten (optional in der Maske, niedrige Priorität — Fokus liegt auf
Von/Bis-Bereichen). `status` bleibt intern, die Maske nutzt aber nur
Anlegen/Löschen (kein Genehmigungs-Workflow).

### 3. Resturlaubsberechnung (`absence-service.ts`, erweitert)

Pro Mitarbeiter und Jahr `Y`:

```
remaining(Y) = entitlement(Y) + carryIn(Y) − usedVacation(Y) − closureVacation(Y)

entitlement(Y)   = employees.vacation_days_per_year (0 wenn null)
carryIn(Y)       = vacation_carryover
                     ? (Y == startYear ? vacation_carryover_days
                                       : max(0, remaining(Y−1)))
                     : 0
startYear        = Jahr von hire_date (fällt hire_date weg: aktuelles Jahr)
usedVacation(Y)  = Summe der Arbeitstage aller vacation-Abwesenheiten
                   (status ≠ cancelled), geschnitten mit [Y-01-01, Y-12-31]
                   und mit isWorkday gefiltert.
closureVacation(Y) = min( closureWorkdaysNotSick(Y),
                          max(0, entitlement + carryIn − usedVacation) )
```

`closureWorkdaysNotSick(Y)` = Arbeitstage innerhalb von
`calendar_entries(kind=closure)` im Jahr `Y`, an denen der Mitarbeiter
keine `sick`-Abwesenheit hat und an denen nicht ohnehin schon Urlaub
eingetragen ist (keine Doppelzählung). Die Deckelung auf den
verfügbaren Rest stellt sicher, dass Schließungen den Resturlaub **nie**
negativ machen.

Rückgabe ist eine **transparente Aufschlüsselung** (für die UI):

```
{ year, entitled, carriedIn, openingBalance, usedVacation,
  closureWorkdays, closureCounted, remaining, sickDays /* informativ */ }
```

`carryIn`-Rekursion ist durch `startYear` (Eintrittsjahr) begrenzt; pro
Request werden die Jahresergebnisse gecacht, sodass max. wenige
Jahresschritte je Mitarbeiter anfallen.

### 4. Validierung (harte Sperre + Warn-Override)

**Urlaub anlegen/ändern** (`createAbsence`/`updateAbsence`, type=vacation):
Vor dem Schreiben `remaining(Y)` für die betroffenen Jahre berechnen
(ein Urlaub kann Jahresgrenzen überspannen → je Jahr prüfen). Würden die
neuen Arbeitstage den Rest überschreiten → `error(400, …)` mit
„Nur noch X Urlaubstage verfügbar (Jahr Y)." Harte Sperre.

**Betriebsschließung anlegen** (Kalender, kind=closure):
Neuer Service `previewClosureImpact(fromIso, toIso)` liefert pro aktivem
Mitarbeiter: Schließungs-Arbeitstage, davon krank, anrechenbar, Rest
vorher/nachher, und ob er **nicht genug** Tage hat. Die Kalender-Maske
zeigt vor dem Speichern einen **Modal-Warndialog**, wenn ≥ 1 Mitarbeiter
nicht genug hat (Liste der Betroffenen + „X von Y Tagen anrechenbar").
Der Nutzer kann **trotzdem speichern**. Die Schließung wird wie bisher
als Kalendereintrag gespeichert; die Anrechnung passiert **rechnerisch**
über (3) und ist automatisch auf den verfügbaren Rest gedeckelt.

### 5. UI-Überarbeitung

**Mitarbeiter-Detailseite** (`/employees/[id]`):

- **Abwesenheit anlegen:** klare Typ-Auswahl **Urlaub / Krankheit /
  Sonstiges**, Von-/Bis-Datum (Pflicht), optional Notiz + Anhang.
  Anlegen-Button.
- **Abwesenheitsliste:** je Zeile Typ-Badge, Zeitraum, Arbeitstage,
  „Löschen" (optimistisch, harte Löschung).
- **Resturlaub-Karte:** Jahr-Auswahl + Aufschlüsselung aus (3):
  Anspruch, Übertrag/Anfangsbestand, genommener Urlaub,
  Betriebsschließung („X von Y Tagen angerechnet"), Rest. Krankheitstage
  informativ daneben.

**Mitarbeiter-Formular** (`EmployeeForm.svelte`): neue Felder
„Resturlaub übertragen" (Schalter) und „Resturlaub-Anfangsbestand".

**Kalender** (`/calendar/new` bzw. Schließungs-Anlage): Vorab-Prüfung +
Modal-Warndialog aus (4).

### 6. Tests

- `workday-service.test.ts`: geöffneter/geschlossener Wochentag,
  Feiertag, Bereichszählung, leere Bereiche.
- `absence-service.test.ts` (erweitert): Resturlaub mit/ohne Übertrag,
  Anfangsbestand, Schließungsabzug, Krank-Ausnahme, Doppelzählungs-
  Vermeidung, Deckelung (kein Minus), Mehrjahres-Übertrag.
- Validierung: harte Sperre Urlaub; `previewClosureImpact` korrekt.
- Component-Test: Abwesenheits-Maske (Typ/Anlegen/Löschen),
  Resturlaub-Karte; Schließungs-Warn-Modal.
- Headless-E2E: Urlaub anlegen → Rest sinkt → löschen → Rest steigt;
  Schließung mit zu wenig Tagen → Warn-Modal → trotzdem anlegbar.

## Nicht im Scope (bewusst)

- Pro-Mitarbeiter-Wochenpläne (Teilzeit Mo/Mi/Fr) — Modell A ist global.
- Übertrags-Deckel / Verfallsdatum (31.03.) — Übertrag ist unbegrenzt.
- Genehmigungs-Workflow (planned→approved) — nur Anlegen/Löschen.
- Teil B („Aufträge / Work-Items") — eigenes Projekt.

## Migrationen

- `0030_employee_vacation_carryover.sql`: zwei Spalten auf `employees`
  (idempotent `ADD COLUMN IF NOT EXISTS`), Journal-Eintrag anhängen.
