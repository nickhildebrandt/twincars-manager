---
title: German domain glossary
tags: [domain, glossary, german]
updated: 2026-07-05
---

# Glossary - German domain terms

UI strings are German; code identifiers are English. This maps between them.

| German term                         | English / code                                                        | Where                                        |
| ----------------------------------- | --------------------------------------------------------------------- | -------------------------------------------- |
| Kunde                               | customer                                                              | [[customers]]                                |
| Fahrzeug                            | vehicle                                                               | [[vehicles]]                                 |
| Kennzeichen                         | license plate (versioned)                                             | `vehicle_license_plate_versions`             |
| HU / AU                             | Hauptuntersuchung / Abgasuntersuchung (statutory inspections)         | `vehicles.nextHu/nextAu`                     |
| HSN / TSN                           | Herstellerschlüsselnummer / Typschlüsselnummer (vehicle type keys)    | `vehicles.hsn/tsn`                           |
| EZ (Erstzulassung)                  | first registration                                                    | `vehicles.firstRegistration`                 |
| Beleg                               | (billing) document                                                    | [[document-types]]                           |
| Rechnung                            | invoice                                                               | `documents.type='invoice'`                   |
| Angebot                             | offer                                                                 | `documents.type='offer'`                     |
| Kostenvoranschlag (KV)              | cost estimate                                                         | `documents.type='cost_estimate'`             |
| Auftragsbestätigung (AB)            | order confirmation                                                    | `documents.type='order_confirmation'`        |
| Storno / Storno-Rechnung            | cancellation invoice                                                  | [[adr-015-storno-instead-of-delete]]         |
| Zahlungserinnerung                  | (friendly) payment reminder                                           | [[reminders]]                                |
| Mahnung                             | dunning letter (legacy term; the app only sends Zahlungserinnerungen) | legacy `Mahnungen` table in the MDB          |
| Teilzahlung                         | partial payment                                                       | `document_payments` (legacy `Teilzahlungen`) |
| Rechnungsausgangsbuch               | outgoing-invoice ledger                                               | [[sales-ledger]]                             |
| Buchhaltung                         | bookkeeping (income/expense ledger)                                   | [[ledger]]                                   |
| Leistung / Material / Artikel       | service / material / article                                          | `items.kind`                                 |
| Durchlaufposten                     | pass-through item (no margin)                                         | `items.kind` label                           |
| Reifen                              | tire                                                                  | [[tires]]                                    |
| Reifeneinlagerung / Reifenlager     | tire storage (customer sets)                                          | [[tire-storage]]                             |
| Reifenwechsel                       | tire change (the only online-bookable service kind)                   | `items.onlineBookable`                       |
| Sommer / Winter / Ganzjahres        | tire seasons (catalog, German values)                                 | `tires.season`                               |
| summer / winter / allseason         | storage seasons (English values)                                      | `tire_storage.season`                        |
| DOT                                 | tire production date marking                                          | `tire_storage.dotYear`                       |
| Profiltiefe                         | tread depth (mm)                                                      | `tire_storage.profileMm`                     |
| Lieferant                           | supplier                                                              | [[suppliers]]                                |
| Mitarbeiter                         | employee                                                              | [[employees]]                                |
| Stunden(-erfassung)                 | time tracking                                                         | [[hours]]                                    |
| Urlaub / Krankheit / Sonstiges      | vacation / sick / other absence                                       | `employee_absences.type`                     |
| Betriebsschließung                  | business closure                                                      | `calendar_entries.kind='closure'`            |
| Termin                              | appointment                                                           | `calendar_entries.kind='appointment'`        |
| Feiertag                            | public holiday                                                        | `public_holidays`                            |
| Rundschreiben                       | broadcast mailing / newsletter                                        | [[mailings]]                                 |
| Aktuelle Informationen              | news posts                                                            | [[posts]]                                    |
| Verkaufsschild                      | sale sign (A4 PDF for a stock car)                                    | [[inventory]], [[pdf-pipeline]]              |
| Differenzbesteuerung (§25a UStG)    | margin-scheme taxation for used goods                                 | `vehicle_listings.differentialTax`           |
| Kleinunternehmerregelung (§19 UStG) | small-business VAT exemption                                          | `company_settings.smallBusinessExempt`       |
| GoBD                                | German bookkeeping compliance rules                                   | [[adr-015-storno-instead-of-delete]]         |
| USt / MwSt                          | VAT                                                                   | `taxRate`, `vatId`                           |
| Steuernummer                        | tax number                                                            | `company_settings.taxNumber`                 |
| Werkstattleiter                     | workshop manager (seeded role)                                        | [[auth-and-permissions]]                     |
| Einstellungen                       | settings                                                              | [[settings]]                                 |
| Öffnungszeiten                      | opening hours                                                         | `workshop_hours`                             |
| Anrede (Sie/Du)                     | salutation style                                                      | `company_settings.salutationStyle`           |
| Kfz-Kaufmann                        | the legacy Access application                                         | [[kfz-kaufmann-import]]                      |
| Bestandskorrektur                   | inventory adjustment flag on legacy invoices                          | import summary field                         |
| Sammel-Angebot                      | synthetic collective offer for orphaned legacy positions              | [[kfz-kaufmann-import]]                      |
| Abbestellen                         | unsubscribe                                                           | [[adr-017-broadcast-unsubscribe-mailto]]     |
