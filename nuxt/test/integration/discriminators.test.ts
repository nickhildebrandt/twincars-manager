/**
 * The database refuses a value the application does not know.
 *
 * B-335 and B-411: every discriminator was a plain `varchar` with no
 * constraint, so a service could write `status = 'irgendwas'` and nothing
 * noticed until a label map fell back to the English value in front of the
 * user. Each check below is generated from the same list in `shared/domain.ts`
 * that the Valibot schema and the German label come from.
 */
import { afterAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import * as domain from '#shared/domain'
import type { Domain } from '#shared/domain'
import { testDatabaseOptions } from '../setup/db-per-worker'

const sql = postgres(testDatabaseOptions())
afterAll(() => sql.end({ timeout: 5 }))

/** table.column → the list it must agree with. */
const GUARDED: [string, string, Domain<string>][] = [
  ['documents', 'type', domain.documentTypes],
  ['documents', 'status', domain.documentStatuses],
  ['documents', 'payment_method', domain.paymentMethods],
  ['document_items', 'kind', domain.itemLineKinds],
  ['document_payments', 'method', domain.paymentMethods],
  ['reminders', 'status', domain.reminderStatuses],
  ['items', 'kind', domain.itemKinds],
  ['tires', 'season', domain.tireSeasons],
  ['tires', 'construction', domain.tireConstructions],
  ['work_orders', 'status', domain.workOrderStatuses],
  ['work_order_items', 'kind', domain.workOrderItemKinds],
  ['calendar_entries', 'kind', domain.calendarKinds],
  ['calendar_entries', 'status', domain.appointmentStatuses],
  ['employee_absences', 'type', domain.absenceTypes],
  ['employee_absences', 'status', domain.absenceStatuses],
  ['customers', 'kind', domain.customerKinds],
  ['customer_inquiries', 'reference_type', domain.inquiryReferenceTypes],
  ['customer_inquiries', 'status', domain.inquiryStatuses],
  ['customer_inquiries', 'notification_status', domain.messageStatuses],
  ['sent_messages', 'status', domain.messageStatuses],
  ['sent_messages', 'document_type', domain.messageKinds],
  ['sent_messages', 'subject_type', domain.messageSubjects],
  ['smtp_settings', 'secure', domain.smtpSecurities],
  ['vehicle_listings', 'status', domain.listingStatuses],
  ['vehicles', 'status', domain.vehicleStatuses],
  ['audit_log', 'action', domain.auditActions],
  ['wheel_sets', 'season', domain.tireSeasons],
  ['wheel_sets', 'state', domain.wheelSetStates],
  ['tire_reminder_log', 'season', domain.reminderSeasons],
  ['ledger_categories', 'direction', domain.ledgerDirections],
  ['ledger_entries', 'direction', domain.ledgerDirections],
  ['ledger_entries', 'payment_status', domain.ledgerPaymentStatuses],
  ['ledger_entries', 'payment_method', domain.paymentMethods],
  ['ledger_entries', 'source', domain.ledgerSources],
  ['number_ranges', 'kind', domain.numberKinds],
  ['ebay_credentials', 'environment', domain.ebayEnvironments],
  ['ebay_listings', 'status', domain.ebayListingStatuses],
  ['ebay_listings', 'environment', domain.ebayEnvironments],
  ['ebay_import_runs', 'status', domain.importRunStatuses],
  ['ebay_import_runs', 'environment', domain.ebayEnvironments],
  ['access_import_jobs', 'status', domain.importRunStatuses],
  ['company_settings', 'salutation_style', domain.salutationStyles],
]

/** The CHECK expression PostgreSQL stores for one column, if any. */
async function constraintFor(table: string, column: string): Promise<string | null> {
  const rows = await sql<{ definition: string }[]>`
    SELECT pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    WHERE c.contype = 'c'
      AND c.conrelid = ${table}::regclass
      AND c.conname = ${`${table}_${column}_check`}
  `
  return rows[0]?.definition ?? null
}

describe('jeder Diskriminator ist in der Datenbank abgesichert', () => {
  it.each(GUARDED)('%s.%s hat eine Prüfbedingung', async (table, column) => {
    expect(await constraintFor(table, column)).toBeTruthy()
  })

  it.each(GUARDED)('%s.%s lässt genau die erklärten Werte zu', async (table, column, list) => {
    const definition = await constraintFor(table, column)
    expect(definition).toBeTruthy()

    const quoted = [...(definition ?? '').matchAll(/'((?:[^']|'')*)'/g)]
      .map(match => match[1]!.replace(/''/g, '\''))
    expect(new Set(quoted)).toEqual(new Set(list.values))
  })
})

describe('die Prüfbedingung wirkt auch wirklich', () => {
  it('weist einen erfundenen Belegstatus ab', async () => {
    await expect(sql`
      INSERT INTO documents (type, status, issue_date)
      VALUES ('invoice', 'irgendwas', CURRENT_DATE)
    `).rejects.toThrow()
  })

  it('weist eine erfundene Belegart ab', async () => {
    // `credit_note` stand beim Vorgänger in einem Suchfilter, wurde aber nie
    // geschrieben — und hatte in der Statusliste keine Bezeichnung (B-011).
    await expect(sql`
      INSERT INTO documents (type, issue_date)
      VALUES ('credit_note', CURRENT_DATE)
    `).rejects.toThrow()
  })

  it('nimmt einen erklärten Belegstatus an', async () => {
    await sql`
      INSERT INTO documents (document_number, type, status, issue_date)
      VALUES ('CHK-3', 'invoice', 'sent', CURRENT_DATE)
    `
    const rows = await sql`SELECT 1 FROM documents WHERE document_number = 'CHK-3'`
    expect(rows).toHaveLength(1)
    await sql`DELETE FROM documents WHERE document_number = 'CHK-3'`
  })

  it('weist eine deutsche Zahlungsart als Wert ab', async () => {
    // Der Vorgänger speicherte die Beschriftung selbst; jetzt steht ein Code
    // in der Spalte und die Beschriftung in der Oberfläche.
    await expect(sql`
      INSERT INTO documents (type, payment_method, issue_date)
      VALUES ('invoice', 'Bar', CURRENT_DATE)
    `).rejects.toThrow()
  })

  it('lässt eine offene Zahlungsart zu', async () => {
    await sql`
      INSERT INTO documents (document_number, type, issue_date)
      VALUES ('CHK-5', 'invoice', CURRENT_DATE)
    `
    await sql`DELETE FROM documents WHERE document_number = 'CHK-5'`
  })

  it('weist eine negative Erinnerungsstufe ab', async () => {
    await expect(sql`
      INSERT INTO documents (type, reminder_level, issue_date)
      VALUES ('invoice', -1, CURRENT_DATE)
    `).rejects.toThrow()
  })
})

describe('Aufräumen aus dem Inventar', () => {
  it('M-33: die Anfrage führt wieder einen Bearbeitungsstand', async () => {
    // In T-006 als tot entfernt, weil niemand sie pflegte. Anfragen werden
    // jetzt in der Anwendung bearbeitet statt im Postfach — damit bekommt der
    // Stand eine Aufgabe: neu, in Bearbeitung, erledigt.
    const rows = await sql<{ column_default: string }[]>`
      SELECT column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'customer_inquiries'
        AND column_name = 'status'
    `
    expect(rows[0]?.column_default).toContain('neu')
  })

  it('legt eine Nachricht als wartend an, nicht als gesendet', async () => {
    // Der Vorgabewert stand auf `sent`, während jeder Sendeweg `pending`
    // eintrug. Die Zeile entsteht vor dem Versand.
    const rows = await sql<{ column_default: string }[]>`
      SELECT column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sent_messages'
        AND column_name = 'status'
    `
    expect(rows[0]?.column_default).toContain('wartend')
  })
})

describe('Regression', () => {
  it('B-335: Belegart und Belegstatus sind in der Datenbank festgelegt', async () => {
    // Beim Vorgänger waren `type` und `status` reine `varchar`-Spalten. Die
    // Aliaswerte `open` und `overdue` existierten nur in einer Beschriftungs-
    // karte, und die Dokumentation beschrieb einen dritten Lebenslauf.
    expect(await constraintFor('documents', 'type')).toBeTruthy()
    expect(await constraintFor('documents', 'status')).toBeTruthy()

    for (const alias of ['open', 'overdue', 'offen']) {
      await expect(sql`
        INSERT INTO documents (document_number, type, status, issue_date)
        VALUES (${`B335-${alias}`}, 'invoice', ${alias}, CURRENT_DATE)
      `).rejects.toThrow()
    }
  })

  it('B-411: auch die Buchungsspalten sind festgelegt', async () => {
    for (const column of ['direction', 'payment_status', 'source']) {
      expect(await constraintFor('ledger_entries', column), column).toBeTruthy()
    }
    await expect(sql`
      INSERT INTO ledger_entries (booking_date, description, amount_gross, amount_net, direction)
      VALUES (CURRENT_DATE, 'Falsche Richtung', 100, 100, 'seitwärts')
    `).rejects.toThrow()
  })
})
