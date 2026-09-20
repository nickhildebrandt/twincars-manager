---
title: PUT /api/setup/tax
kategorie: api
method: PUT
path: /api/setup/tax
permission: offen
status: umgesetzt
features: []
schemas: []
updated: 2026-09-20
---

# /api/setup/tax

Schritt 3: Steuer und Bank.

## Körper

`companyTaxSchema` — Steuernummer (Pflicht), USt-IdNr., §19-Regelung,
Standard-Steuersatz, Bank, IBAN, BIC.

Der **Steuersatz** ist ein Feld und kein fester Wert: im Altbestand stehen 207
Rechnungen mit 16 % ([M-44](../../docs/rewrite/09-modellaenderungen.md)). Ein
Komma wird angenommen, wie es jemand tippt.

Die **§19-Regelung** steuert Summenblock und Hinweistext auf jedem Beleg sowie
die Kategorie in der XRechnung — nicht die Berechnung: wer sie nutzt, weist
gar keine Steuer aus.

## Berechtigung

`offen`, siehe [`GET /api/setup/state`](setup-state-get.md).

## Quelle

`server/api/setup/tax.ts`, Dienste in
`server/services/setup-service.ts` und `server/services/settings-service.ts`.
Geprüft in `test/integration/setup.test.ts` und
`test/unit/settings-schemas.test.ts`.

Zurück zur [API-Übersicht](README.md)
