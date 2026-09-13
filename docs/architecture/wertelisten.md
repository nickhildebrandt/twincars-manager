---
title: Wertelisten
kategorie: architecture
status: umgesetzt
updated: 2026-09-13
---

# Wertelisten

Jeder Diskriminator der Anwendung: die erlaubten Werte und ihre deutschen
Beschriftungen. **Diese Seite entsteht aus `nuxt/shared/domain.ts`**
(`pnpm docs:domain`) — sie beschreibt nicht, was gelten soll, sondern was gilt.

Zurück zur [Architektur](README.md).

## Warum es diese Liste gibt

Drei Dinge werden aus derselben Quelle abgeleitet und können nicht
auseinanderlaufen:

1. die `CHECK`-Bedingung in der Datenbank
2. das Valibot-Schema an der Grenze
3. die Beschriftung, die der Nutzer liest

Der Vorgänger hatte nichts davon. Die Spalten waren `varchar` ohne Prüfung, ein
Dienst konnte jede Zeichenkette schreiben (B-335, B-411), und die
Beschriftungen lagen in zwei Karten, die sich widersprachen: `order_confirmation`
hieß einmal „Auftrag" und einmal „Auftragsbestätigung" (B-011).

**Codes sind englisch, Beschriftungen deutsch.** Der Vorgänger speicherte bei
der Zahlungsart die Beschriftung selbst, weshalb „Überweisung" in SQL-Abfragen
stand.

## Die Listen

### Abwesenheitsstatus

Export `absenceStatuses`.

| Wert        | Beschriftung |
| ----------- | ------------ |
| `planned`   | Geplant      |
| `approved`  | Genehmigt    |
| `cancelled` | Abgesagt     |

### Abwesenheitsarten

Export `absenceTypes`.

| Wert       | Beschriftung |
| ---------- | ------------ |
| `vacation` | Urlaub       |
| `sick`     | Krankheit    |
| `other`    | Sonstiges    |

### Terminstatus

Export `appointmentStatuses`.

| Wert        | Beschriftung  |
| ----------- | ------------- |
| `scheduled` | Geplant       |
| `completed` | Abgeschlossen |
| `cancelled` | Abgesagt      |

### Kalendereinträge

Export `calendarKinds`.

| Wert          | Beschriftung       |
| ------------- | ------------------ |
| `appointment` | Termin             |
| `closure`     | Betriebsschließung |

### Kundenarten

Export `customerKinds`.

| Wert     | Beschriftung |
| -------- | ------------ |
| `privat` | Privatkunde  |
| `firma`  | Firmenkunde  |
| `ebay`   | eBay-Käufer  |

### Belegstatus

Export `documentStatuses`.

| Wert        | Beschriftung          |
| ----------- | --------------------- |
| `created`   | Angelegt              |
| `sent`      | Versendet             |
| `paid`      | Bezahlt               |
| `cancelled` | Storniert             |
| `storno`    | Stornorechnung        |
| `converted` | In Rechnung überführt |

### Belegarten

Export `documentTypes`.

| Wert                 | Beschriftung        |
| -------------------- | ------------------- |
| `invoice`            | Rechnung            |
| `offer`              | Angebot             |
| `cost_estimate`      | Kostenvoranschlag   |
| `order_confirmation` | Auftragsbestätigung |

### eBay-Umgebung

Export `ebayEnvironments`.

| Wert         | Beschriftung |
| ------------ | ------------ |
| `production` | Produktion   |
| `sandbox`    | Testumgebung |

### eBay-Angebotsstatus

Export `ebayListingStatuses`.

| Wert     | Beschriftung |
| -------- | ------------ |
| `active` | Aktiv        |
| `ended`  | Beendet      |

### Status eines Importlaufs

Export `importRunStatuses`.

| Wert      | Beschriftung   |
| --------- | -------------- |
| `running` | Läuft          |
| `success` | Abgeschlossen  |
| `failed`  | Fehlgeschlagen |

### Bezug einer Anfrage

Export `inquiryReferenceTypes`.

| Wert       | Beschriftung |
| ---------- | ------------ |
| `used-car` | Fahrzeug     |
| `article`  | Artikel      |
| `tire`     | Reifen       |
| `general`  | Allgemein    |

### Artikelarten im Katalog

Export `itemKinds`.

| Wert           | Beschriftung    |
| -------------- | --------------- |
| `article`      | Artikel         |
| `service`      | Leistung        |
| `material`     | Material        |
| `pass_through` | Durchlaufposten |

### Positionsarten im Beleg

Export `itemLineKinds`.

| Wert           | Beschriftung    |
| -------------- | --------------- |
| `article`      | Artikel         |
| `service`      | Leistung        |
| `material`     | Material        |
| `pass_through` | Durchlaufposten |
| `vehicle`      | Fahrzeug        |

### Richtung einer Buchung

Export `ledgerDirections`.

| Wert      | Beschriftung |
| --------- | ------------ |
| `income`  | Einnahme     |
| `expense` | Ausgabe      |

### Zahlungsstatus einer Buchung

Export `ledgerPaymentStatuses`.

| Wert      | Beschriftung      |
| --------- | ----------------- |
| `paid`    | Bezahlt           |
| `open`    | Offen             |
| `partial` | Teilweise gezahlt |

### Herkunft einer Buchung

Export `ledgerSources`.

| Wert      | Beschriftung       |
| --------- | ------------------ |
| `manual`  | Manuell erfasst    |
| `invoice` | Aus einer Rechnung |

### Inseratstatus

Export `listingStatuses`.

| Wert        | Beschriftung |
| ----------- | ------------ |
| `available` | Verfügbar    |
| `sold`      | Verkauft     |

### Nachrichtenarten

Export `messageKinds`.

| Wert                       | Beschriftung        |
| -------------------------- | ------------------- |
| `invoice`                  | Rechnung            |
| `offer`                    | Angebot             |
| `cost_estimate`            | Kostenvoranschlag   |
| `order_confirmation`       | Auftragsbestätigung |
| `reminder`                 | Zahlungserinnerung  |
| `mailing`                  | Rundschreiben       |
| `tire_reminder`            | Reifen-Erinnerung   |
| `appointment_confirmation` | Terminbestätigung   |

### Versandstatus

Export `messageStatuses`.

| Wert      | Beschriftung     |
| --------- | ---------------- |
| `pending` | In Warteschlange |
| `sent`    | Gesendet         |
| `failed`  | Fehlgeschlagen   |

### Nummernkreise

Export `numberKinds`.

| Wert                 | Beschriftung        |
| -------------------- | ------------------- |
| `invoice`            | Rechnung            |
| `offer`              | Angebot             |
| `cost_estimate`      | Kostenvoranschlag   |
| `order_confirmation` | Auftragsbestätigung |
| `storno`             | Stornorechnung      |
| `reminder`           | Zahlungserinnerung  |
| `customer`           | Kunde               |
| `tire`               | Reifen              |
| `tire_storage`       | Reifeneinlagerung   |
| `work_order`         | Auftrag             |

### Zahlungsarten

Export `paymentMethods`.

| Wert           | Beschriftung |
| -------------- | ------------ |
| `transfer`     | Überweisung  |
| `cash`         | Bar          |
| `direct_debit` | Lastschrift  |
| `card`         | Karte        |

### Saison der Reifen-Erinnerung

Export `reminderSeasons`.

| Wert     | Beschriftung |
| -------- | ------------ |
| `spring` | Frühjahr     |
| `autumn` | Herbst       |

### Status einer Zahlungserinnerung

Export `reminderStatuses`.

| Wert        | Beschriftung  |
| ----------- | ------------- |
| `open`      | Angelegt      |
| `sent`      | Versendet     |
| `paid`      | Bezahlt       |
| `cancelled` | Zurückgezogen |

### Anrede

Export `salutationStyles`.

| Wert  | Beschriftung |
| ----- | ------------ |
| `Sie` | Sie          |
| `Du`  | Du           |

### SMTP-Verschlüsselung

Export `smtpSecurities`.

| Wert       | Beschriftung    |
| ---------- | --------------- |
| `none`     | Unverschlüsselt |
| `STARTTLS` | STARTTLS        |
| `TLS`      | TLS             |

### Reifenbauart

Export `tireConstructions`.

| Wert | Beschriftung |
| ---- | ------------ |
| `R`  | Radial       |
| `D`  | Diagonal     |

### Reifensaison

Export `tireSeasons`.

| Wert        | Beschriftung |
| ----------- | ------------ |
| `summer`    | Sommer       |
| `winter`    | Winter       |
| `allseason` | Ganzjahres   |

### Positionsarten im Auftrag

Export `workOrderItemKinds`.

| Wert       | Beschriftung |
| ---------- | ------------ |
| `labor`    | Arbeitszeit  |
| `material` | Material     |

### Auftragsstatus

Export `workOrderStatuses`.

| Wert          | Beschriftung   |
| ------------- | -------------- |
| `open`        | Offen          |
| `in_progress` | In Bearbeitung |
| `done`        | Abgeschlossen  |

## Geprüft wird das so

`test/unit/domain.test.ts` hält fest, dass jeder Wert eine Beschriftung hat,
dass keine Beschriftung ihren Code durchreicht und dass die Schemata dieselben
Listen benutzen. `test/integration/discriminators.test.ts` vergleicht jede
`CHECK`-Bedingung in der Datenbank mit der Liste und weist nach, dass ein
erfundener Wert wirklich abgelehnt wird.

Siehe auch: [Serverschichten](server-schichten.md) ·
[Datenmodell](../data/README.md)
