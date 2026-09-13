/**
 * Generates `docs/architecture/wertelisten.md` from `shared/domain.ts`.
 *
 * The value lists are the source; the page is a rendering of them. Writing the
 * page by hand would create a fourth place for the same knowledge to go stale,
 * next to the database constraint, the Valibot schema and the label map.
 *
 *   node scripts/docs-domain.mjs
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const out = join(root, '..', 'docs', 'architecture', 'wertelisten.md')

const domain = await import(join(root, 'shared', 'domain.ts'))

/** camelCase export name → readable heading. */
const HEADINGS = {
  documentTypes: 'Belegarten',
  documentStatuses: 'Belegstatus',
  paymentMethods: 'Zahlungsarten',
  itemLineKinds: 'Positionsarten im Beleg',
  itemKinds: 'Artikelarten im Katalog',
  workOrderStatuses: 'Auftragsstatus',
  workOrderItemKinds: 'Positionsarten im Auftrag',
  calendarKinds: 'Kalendereinträge',
  appointmentStatuses: 'Terminstatus',
  absenceTypes: 'Abwesenheitsarten',
  absenceStatuses: 'Abwesenheitsstatus',
  customerKinds: 'Kundenarten',
  messageStatuses: 'Versandstatus',
  messageKinds: 'Nachrichtenarten',
  inquiryReferenceTypes: 'Bezug einer Anfrage',
  reminderStatuses: 'Status einer Zahlungserinnerung',
  listingStatuses: 'Inseratstatus',
  tireSeasons: 'Reifensaison',
  tireConstructions: 'Reifenbauart',
  reminderSeasons: 'Saison der Reifen-Erinnerung',
  ledgerDirections: 'Richtung einer Buchung',
  ledgerPaymentStatuses: 'Zahlungsstatus einer Buchung',
  ledgerSources: 'Herkunft einer Buchung',
  numberKinds: 'Nummernkreise',
  ebayListingStatuses: 'eBay-Angebotsstatus',
  importRunStatuses: 'Status eines Importlaufs',
  ebayEnvironments: 'eBay-Umgebung',
  smtpSecurities: 'SMTP-Verschlüsselung',
  salutationStyles: 'Anrede',
}

const isDomain = value =>
  typeof value === 'object' && value !== null && Array.isArray(value.values) && value.labels

const lists = Object.entries(domain).filter(([, value]) => isDomain(value))

const escape = text => String(text).replace(/\|/g, '\\|')

const sections = lists.map(([name, list]) => {
  const heading = HEADINGS[name] ?? name
  const rows = list.values
    .map(value => `| \`${escape(value)}\` | ${escape(list.labels[value])} |`)
    .join('\n')
  return `### ${heading}\n\n`
    + `Export \`${name}\`.\n\n`
    + `| Wert | Beschriftung |\n| --- | --- |\n${rows}\n`
}).join('\n')

const page = `---
title: Wertelisten
kategorie: architecture
status: umgesetzt
updated: ${new Date().toISOString().slice(0, 10)}
---

# Wertelisten

Jeder Diskriminator der Anwendung: die erlaubten Werte und ihre deutschen
Beschriftungen. **Diese Seite entsteht aus \`nuxt/shared/domain.ts\`**
(\`pnpm docs:domain\`) — sie beschreibt nicht, was gelten soll, sondern was gilt.

Zurück zur [Architektur](README.md).

## Warum es diese Liste gibt

Drei Dinge werden aus derselben Quelle abgeleitet und können nicht
auseinanderlaufen:

1. die \`CHECK\`-Bedingung in der Datenbank
2. das Valibot-Schema an der Grenze
3. die Beschriftung, die der Nutzer liest

Der Vorgänger hatte nichts davon. Die Spalten waren \`varchar\` ohne Prüfung, ein
Dienst konnte jede Zeichenkette schreiben (B-335, B-411), und die
Beschriftungen lagen in zwei Karten, die sich widersprachen: \`order_confirmation\`
hieß einmal „Auftrag" und einmal „Auftragsbestätigung" (B-011).

**Codes sind englisch, Beschriftungen deutsch.** Der Vorgänger speicherte bei
der Zahlungsart die Beschriftung selbst, weshalb „Überweisung" in SQL-Abfragen
stand.

## Die Listen

${sections}
## Geprüft wird das so

\`test/unit/domain.test.ts\` hält fest, dass jeder Wert eine Beschriftung hat,
dass keine Beschriftung ihren Code durchreicht und dass die Schemata dieselben
Listen benutzen. \`test/integration/discriminators.test.ts\` vergleicht jede
\`CHECK\`-Bedingung in der Datenbank mit der Liste und weist nach, dass ein
erfundener Wert wirklich abgelehnt wird.

Siehe auch: [Serverschichten](server-schichten.md) ·
[Datenmodell](../data/README.md)
`

writeFileSync(out, page)
console.log(`Wertelisten: ${lists.length} Liste(n) nach docs/architecture/wertelisten.md`)
