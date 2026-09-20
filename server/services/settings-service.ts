/**
 * Firmeneinstellungen, Nummernkreise, Öffnungszeiten, Stundensatz (T-010).
 *
 * Die Einstellungen sind eine **Einzelzeile** — das erzwingt der eindeutige
 * Index `company_settings_singleton`. Dieser Dienst legt sie an, wenn sie
 * fehlt, und schreibt sonst darauf. Ein zweiter Datensatz kann nicht
 * entstehen, auch nicht bei zwei gleichzeitigen Speichervorgängen.
 *
 * **Jedes Schreiben hinterlässt eine Spur.** Die Firmeneinstellungen stehen
 * auf jeder Rechnung; wer die Steuernummer ändert, ändert jeden künftigen
 * Beleg. Deshalb ein Protokolleintrag (M-01) **und** ein Stand im Zeitstrahl
 * (M-45) — die Einstellungen sind ausdrücklich versioniert, damit ein
 * versehentlich gelöschter Endtext zurückholbar ist.
 */
import { eq, sql } from 'drizzle-orm'
import {
  companySettings,
  itemPriceVersions,
  items,
  numberRanges,
  workshopHours,
} from '../database/schema/index.ts'
import type { Executor, Transaction } from '../utils/db.ts'
import { useDatabase, withTransaction } from '../utils/db.ts'
import { recordChange } from '../utils/audit.ts'
import { recordVersion } from './record-version-service.ts'
import { conflict, notFound } from '../utils/errors.ts'
import { isoDate } from '#shared/datetime'
import type {
  CompanyProfile,
  CompanyTax,
  DocumentDefaults,
  NumberRangeInput,
  SecuritySettings,
  WorkshopDay,
} from '#shared/schemas/settings'
import type { H3Event } from 'h3'

export type Settings = typeof companySettings.$inferSelect

/**
 * Die Einstellungszeile, angelegt falls sie fehlt.
 *
 * `onConflictDoNothing` auf den Singleton-Index: zwei gleichzeitige Aufrufe
 * erzeugen keine zweite Zeile, und keiner von beiden scheitert.
 */
export async function loadSettings(executor: Executor = useDatabase()): Promise<Settings> {
  const [existing] = await executor.select().from(companySettings).limit(1)
  if (existing) return existing

  await executor
    .insert(companySettings)
    .values({})
    .onConflictDoNothing()

  const [created] = await executor.select().from(companySettings).limit(1)
  if (!created) throw notFound('Die Firmeneinstellungen')
  return created
}

/** Ob die Einrichtung abgeschlossen ist. Das Tor liest genau das. */
export async function isSetupComplete(executor: Executor = useDatabase()): Promise<boolean> {
  const [row] = await executor
    .select({ done: companySettings.setupCompleted })
    .from(companySettings)
    .limit(1)

  return row?.done ?? false
}

/** Wer gerade handelt — für Protokoll und Zeitstrahl. */
type Author = { userId?: string | null, userName?: string | null }

/**
 * Schreibt Felder der Einstellungen und hält den Vorgang fest.
 *
 * Alles in **einer** Transaktion: die Zeile, der Protokolleintrag und der
 * Stand im Zeitstrahl. Ein Stand ohne die zugehörige Änderung wäre eine
 * Lüge, eine Änderung ohne Stand ein Loch im Zeitstrahl.
 */
export async function saveSettings(
  patch: Partial<typeof companySettings.$inferInsert>,
  author: Author = {},
  event?: H3Event,
  executor?: Executor,
): Promise<Settings> {
  const run = async (tx: Transaction): Promise<Settings> => {
    const before = await loadSettings(tx)

    const [updated] = await tx
      .update(companySettings)
      .set(patch)
      .where(eq(companySettings.id, before.id))
      .returning()

    const after = updated!

    await recordChange({
      entity: 'company_settings',
      entityId: after.id,
      action: 'geaendert',
      before,
      after,
    }, event, tx)

    await recordVersion('company_settings', after.id, after, author, tx)

    return after
  }

  return executor && 'rollback' in executor
    ? run(executor as Transaction)
    : withTransaction(run)
}

/* ── Die einzelnen Schritte ───────────────────────────────────────────── */

export const saveCompanyProfile = (
  input: CompanyProfile,
  author?: Author,
  event?: H3Event,
  executor?: Executor,
) => saveSettings({
  companyName: input.companyName,
  owner: input.owner ?? null,
  street: input.street,
  zip: input.zip,
  city: input.city,
  state: input.state,
  phone: input.phone,
  mobile: input.mobile ?? null,
  fax: input.fax ?? null,
  email: input.email,
  website: input.website ?? null,
}, author, event, executor)

export const saveCompanyTax = (
  input: CompanyTax,
  author?: Author,
  event?: H3Event,
  executor?: Executor,
) => saveSettings({
  taxNumber: input.taxNumber,
  vatId: input.vatId ?? null,
  smallBusinessExempt: input.smallBusinessExempt,
  // `numeric` will eine Zeichenkette; 19 wird zu '19.00'.
  defaultVatRate: input.defaultVatRate.toFixed(2),
  bankName: input.bankName ?? null,
  iban: input.iban ?? null,
  bic: input.bic ?? null,
}, author, event, executor)

export const saveSecuritySettings = (
  input: SecuritySettings,
  author?: Author,
  event?: H3Event,
  executor?: Executor,
) => saveSettings({
  adminEmail: input.adminEmail ?? null,
  safeIpRanges: input.safeIpRanges,
}, author, event, executor)

/**
 * Die Belegvorgaben — und was daran **nicht** in die Einstellungen gehört.
 *
 * Anrede, Zahlungsziel und Endtext stehen in der Einstellungszeile. Die
 * Nummernkreise haben eine eigene Tabelle, und der Stundensatz ist der Preis
 * eines Artikels (M-22). Alles drei wandert deshalb weiter, statt hier
 * hineingeschrieben zu werden — in **einer** Transaktion, damit der
 * Assistent nicht mit halb gesetzten Vorgaben endet.
 */
export async function saveDocumentDefaults(
  input: DocumentDefaults,
  author?: Author,
  event?: H3Event,
  executor?: Executor,
): Promise<Settings> {
  const run = async (tx: Transaction): Promise<Settings> => {
    const settings = await saveSettings({
      salutationStyle: input.salutationStyle,
      defaultPaymentTermDays: input.defaultPaymentTermDays,
      pdfFooter: input.pdfFooter ?? '',
    }, author, event, tx)

    if (input.numberRanges.length > 0) await saveNumberRanges(input.numberRanges, tx)
    if (input.laborRate !== undefined) await saveLaborRate(input.laborRate, undefined, tx)

    return settings
  }

  return executor && 'rollback' in executor
    ? run(executor as Transaction)
    : withTransaction(run)
}

/* ── Nummernkreise ────────────────────────────────────────────────────── */

/**
 * Schreibt die Kreise, die der Assistent mitbringt.
 *
 * Nur die genannten: wer im Assistenten drei Kreise anfasst, soll die übrigen
 * fünf auf ihren Vorgaben lassen und sie nicht stillschweigend zurücksetzen.
 */
export async function saveNumberRanges(
  ranges: NumberRangeInput[],
  executor: Executor = useDatabase(),
): Promise<number> {
  if (ranges.length === 0) return 0

  for (const range of ranges) {
    await executor
      .insert(numberRanges)
      .values({
        kind: range.kind,
        formatTemplate: range.formatTemplate,
        nextValue: range.nextValue,
      })
      .onConflictDoUpdate({
        target: numberRanges.kind,
        set: { formatTemplate: range.formatTemplate, nextValue: range.nextValue },
      })
  }

  return ranges.length
}

/** Die Kreise, wie sie gerade stehen — für Assistent und Einstellungen. */
export async function loadNumberRanges(executor: Executor = useDatabase()) {
  return executor
    .select({
      kind: numberRanges.kind,
      formatTemplate: numberRanges.formatTemplate,
      nextValue: numberRanges.nextValue,
    })
    .from(numberRanges)
    .orderBy(numberRanges.kind)
}

/* ── Öffnungszeiten ───────────────────────────────────────────────────── */

/**
 * Schreibt alle sieben Tage.
 *
 * Alle sieben, nicht die geänderten: eine Woche mit sechs Tagen ist keine
 * Woche, und das Schema verlangt sie deshalb vollständig.
 */
export async function saveWorkshopHours(
  week: WorkshopDay[],
  executor: Executor = useDatabase(),
): Promise<number> {
  for (const day of week) {
    await executor
      .insert(workshopHours)
      .values({
        weekday: day.weekday,
        opensAt: day.opensAt,
        closesAt: day.closesAt,
        closed: day.closed,
      })
      .onConflictDoUpdate({
        target: workshopHours.weekday,
        set: { opensAt: day.opensAt, closesAt: day.closesAt, closed: day.closed },
      })
  }

  return week.length
}

/** Die Woche, montags zuerst — so, wie sie jemand liest. */
export async function loadWorkshopHours(executor: Executor = useDatabase()) {
  const rows = await executor.select().from(workshopHours)

  // Gespeichert ist Sonntag die 0 (`businessWeekday`), gelesen wird ab Montag.
  const order = [1, 2, 3, 4, 5, 6, 0]
  return rows.slice().sort((a, b) => order.indexOf(a.weekday) - order.indexOf(b.weekday))
}

/* ── Stundensatz ──────────────────────────────────────────────────────── */

/**
 * Setzt den Stundensatz der Werkstatt (M-22).
 *
 * Der Satz ist keine Einstellung, sondern der **Preis eines Artikels** — und
 * Preise sind versioniert. Ein Satz, der ab heute gilt, überschreibt den von
 * heute; ein Satz von gestern bleibt stehen, damit alte Belege ihre Rechnung
 * behalten.
 *
 * Ohne Arbeitszeit-Artikel gibt es nichts zu setzen. Das ist ein 409 und kein
 * stilles Nichts: der Artikel kommt aus dem Seed, und wenn er fehlt, stimmt
 * etwas anderes nicht.
 */
export async function saveLaborRate(
  cents: number,
  validFrom: string = isoDate(),
  executor: Executor = useDatabase(),
): Promise<void> {
  const settings = await loadSettings(executor)

  const itemId = settings.laborItemId
  if (!itemId) throw conflict('Es ist kein Arbeitszeit-Artikel hinterlegt.')

  const [item] = await executor.select({ id: items.id }).from(items).where(eq(items.id, itemId)).limit(1)
  if (!item) throw conflict('Der hinterlegte Arbeitszeit-Artikel fehlt.')

  await executor
    .insert(itemPriceVersions)
    .values({ itemId, validFrom, unitPriceNet: cents })
    .onConflictDoUpdate({
      target: [itemPriceVersions.itemId, itemPriceVersions.validFrom],
      set: { unitPriceNet: cents },
    })
}

/** Der heute geltende Stundensatz in Cent, oder `null`. */
export async function loadLaborRate(executor: Executor = useDatabase()): Promise<number | null> {
  const settings = await loadSettings(executor)
  if (!settings.laborItemId) return null

  const [row] = await executor
    .select({ unitPriceNet: itemPriceVersions.unitPriceNet })
    .from(itemPriceVersions)
    .where(sql`${itemPriceVersions.itemId} = ${settings.laborItemId}
      AND ${itemPriceVersions.validFrom} <= ${isoDate()}`)
    .orderBy(sql`${itemPriceVersions.validFrom} DESC`)
    .limit(1)

  return row?.unitPriceNet ?? null
}
