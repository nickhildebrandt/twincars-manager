/**
 * Lohn-/Gehaltsabrechnung — Service.
 *
 * Per `anforderungen.md` §13 the app provides a *correct, druckfertige*
 * payroll workflow but is **not** a certified Lohnabrechnungssystem.
 * The user pflegt Lohnarten und Abzüge selbst (the schema is open) and
 * the service computes period totals, vacation/sick days and net pay
 * from those line items.
 *
 * Lifecycle:
 *   period.status:  open → approved → closed (Periode gesperrt)
 *   entry.status:   open → approved (immutable) — Storno via separate
 *                                                  Folgeabrechnung
 *
 * Day counting: vacation / sick days are derived automatically from
 * `employeeAbsences` for the period via {@link absenceDaysInPeriod}, so
 * the entry editor doesn't have to repeat the data.
 */

import { and, asc, count, desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import {
  companySettings,
  employees,
  payrollDeductions,
  payrollEntries,
  payrollLineItems,
  payrollPeriods,
  type Employee,
  type PayrollDeduction,
  type PayrollEntry,
  type PayrollLineItem,
  type PayrollPeriod
} from '$lib/server/db/schema'
import { absenceDaysInPeriod } from './absence-service'
import { getEffectiveSalary } from './employee-service'
import { applicableSpecialPaymentsFor } from './special-payment-service'

const round2 = (v: number): number => Math.round(v * 100) / 100

/* ── Periodengrenzen ─────────────────────────────────────────────── */

export const periodBoundsIso = (
  year: number,
  month: number
): { fromIso: string; toIso: string } => {
  const mm = String(month).padStart(2, '0')
  const fromIso = `${year}-${mm}-01`
  // Last day of month — JavaScript: day 0 of next month.
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const toIso = `${year}-${mm}-${String(last).padStart(2, '0')}`
  return { fromIso, toIso }
}

/* ── Periods ─────────────────────────────────────────────────────── */

export const listPayrollPeriods = async (): Promise<PayrollPeriod[]> =>
  db
    .select()
    .from(payrollPeriods)
    .orderBy(desc(payrollPeriods.year), desc(payrollPeriods.month))

export const getPayrollPeriod = async (
  id: string
): Promise<PayrollPeriod | null> => {
  const [row] = await db
    .select()
    .from(payrollPeriods)
    .where(eq(payrollPeriods.id, id))
    .limit(1)
  return row ?? null
}

export const ensurePayrollPeriod = async (
  year: number,
  month: number
): Promise<PayrollPeriod> => {
  const [existing] = await db
    .select()
    .from(payrollPeriods)
    .where(and(eq(payrollPeriods.year, year), eq(payrollPeriods.month, month)))
    .limit(1)
  if (existing) return existing
  const [row] = await db
    .insert(payrollPeriods)
    .values({ year, month, status: 'open' })
    .returning()
  return row
}

export const setPeriodStatus = async (
  id: string,
  status: 'open' | 'approved' | 'closed'
): Promise<PayrollPeriod> => {
  const [row] = await db
    .update(payrollPeriods)
    .set({ status })
    .where(eq(payrollPeriods.id, id))
    .returning()
  if (!row) throw new Error('Periode nicht gefunden.')
  return row
}

/* ── Entries (joined view) ───────────────────────────────────────── */

export type PayrollEntryFull = PayrollEntry & {
  lineItems: PayrollLineItem[]
  deductions: PayrollDeduction[]
}

export const listEntriesForPeriod = async (
  periodId: string
): Promise<PayrollEntry[]> =>
  db.select().from(payrollEntries).where(eq(payrollEntries.periodId, periodId))

export const getPayrollEntry = async (
  id: string
): Promise<PayrollEntryFull | null> => {
  const [entry] = await db
    .select()
    .from(payrollEntries)
    .where(eq(payrollEntries.id, id))
    .limit(1)
  if (!entry) return null
  const [lineItems, deductions] = await Promise.all([
    db
      .select()
      .from(payrollLineItems)
      .where(eq(payrollLineItems.entryId, id))
      .orderBy(asc(payrollLineItems.positionNumber)),
    db
      .select()
      .from(payrollDeductions)
      .where(eq(payrollDeductions.entryId, id))
      .orderBy(asc(payrollDeductions.positionNumber))
  ])
  return { ...entry, lineItems, deductions }
}

/** Find an existing entry for this employee+period or null. */
export const findEntryFor = async (
  periodId: string,
  employeeId: string
): Promise<PayrollEntry | null> => {
  const [row] = await db
    .select()
    .from(payrollEntries)
    .where(
      and(
        eq(payrollEntries.periodId, periodId),
        eq(payrollEntries.employeeId, employeeId)
      )
    )
    .limit(1)
  return row ?? null
}

/* ── Mutations ───────────────────────────────────────────────────── */

export type EntryUpsertInput = {
  periodId: string
  employeeId: string
  workingDays?: number | null
  payoutDate?: string | null
  payoutMethod?: string
  notes?: string | null
  lineItems: Array<{
    kind: string
    label: string
    quantity?: number | null
    unit?: string | null
    rate?: number | null
    amount: number
    notes?: string | null
  }>
  deductions: Array<{
    kind: string
    label: string
    amount: number
    isEmployer?: boolean
    notes?: string | null
  }>
}

/**
 * Create or replace a payroll entry. Replacing wipes the entry's items
 * and deductions and rebuilds them from the input — simpler than
 * diffing and the only way the editor uses this. The period has to be
 * `open`; once `approved` the entry becomes immutable.
 */
export const upsertPayrollEntry = async (
  input: EntryUpsertInput
): Promise<PayrollEntryFull> => {
  const period = await getPayrollPeriod(input.periodId)
  if (!period) throw new Error('Periode nicht gefunden.')
  if (period.status === 'closed') {
    throw new Error('Diese Periode ist geschlossen.')
  }

  const existing = await findEntryFor(input.periodId, input.employeeId)
  if (existing && existing.status === 'approved') {
    // Idempotenz: bereits final freigegebene Abrechnung wird nicht
    // überschrieben — die Auto-Generation darf gefahrlos mehrfach
    // laufen und liefert die bestehende Zeile zurück.
    const full = await getPayrollEntry(existing.id)
    if (!full) throw new Error('Eintrag konnte nicht geladen werden.')
    return full
  }

  // Compute totals from the inputs.
  const grossTotal = round2(
    input.lineItems.reduce((s, l) => s + Number(l.amount || 0), 0)
  )
  let taxTotal = 0
  let socialEmployeeTotal = 0
  let socialEmployerTotal = 0
  for (const d of input.deductions) {
    const a = Number(d.amount || 0)
    if (d.isEmployer) {
      socialEmployerTotal += a
      continue
    }
    if (d.kind.startsWith('tax_')) taxTotal += a
    else socialEmployeeTotal += a
  }
  taxTotal = round2(taxTotal)
  socialEmployeeTotal = round2(socialEmployeeTotal)
  socialEmployerTotal = round2(socialEmployerTotal)
  const deductionsTotal = round2(taxTotal + socialEmployeeTotal)
  const netTotal = round2(grossTotal - deductionsTotal)

  // Auto-derive vacation / sick days from absences.
  const { fromIso, toIso } = periodBoundsIso(period.year, period.month)
  const [vacDays, sickDays] = await Promise.all([
    absenceDaysInPeriod(input.employeeId, 'vacation', fromIso, toIso),
    absenceDaysInPeriod(input.employeeId, 'sick', fromIso, toIso)
  ])

  const baseValues = {
    periodId: input.periodId,
    employeeId: input.employeeId,
    workingDays: input.workingDays ?? null,
    vacationDaysUsed: String(vacDays),
    sickDays: String(sickDays),
    grossTotal: String(grossTotal),
    taxTotal: String(taxTotal),
    socialEmployeeTotal: String(socialEmployeeTotal),
    socialEmployerTotal: String(socialEmployerTotal),
    deductionsTotal: String(deductionsTotal),
    netTotal: String(netTotal),
    payoutAmount: String(netTotal),
    payoutDate: input.payoutDate ?? null,
    payoutMethod: input.payoutMethod ?? 'Überweisung',
    notes: input.notes ?? null,
    // Auto-Freigabe: Abrechnungen entstehen direkt als 'approved'.
    // Der ehemals zweistufige Workflow open → approved entfällt;
    // Berechnungen sind durch die versionierte Stamm-Daten ohnehin
    // deterministisch und werden nicht manuell editiert.
    status: 'approved' as const,
    approvedAt: new Date(),
    updatedAt: new Date()
  }

  let entry: PayrollEntry
  if (existing) {
    const [row] = await db
      .update(payrollEntries)
      .set(baseValues)
      .where(eq(payrollEntries.id, existing.id))
      .returning()
    entry = row
    await db
      .delete(payrollLineItems)
      .where(eq(payrollLineItems.entryId, existing.id))
    await db
      .delete(payrollDeductions)
      .where(eq(payrollDeductions.entryId, existing.id))
  } else {
    const [row] = await db.insert(payrollEntries).values(baseValues).returning()
    entry = row
  }

  if (input.lineItems.length) {
    await db
      .insert(payrollLineItems)
      .values(
        input.lineItems.map((l, i) => ({
          entryId: entry.id,
          positionNumber: i + 1,
          kind: l.kind,
          label: l.label,
          quantity: l.quantity != null ? String(l.quantity) : null,
          unit: l.unit ?? null,
          rate: l.rate != null ? String(l.rate) : null,
          amount: String(l.amount),
          notes: l.notes ?? null
        }))
      )
  }
  if (input.deductions.length) {
    await db
      .insert(payrollDeductions)
      .values(
        input.deductions.map((d, i) => ({
          entryId: entry.id,
          positionNumber: i + 1,
          kind: d.kind,
          label: d.label,
          amount: String(d.amount),
          isEmployer: d.isEmployer ?? false,
          notes: d.notes ?? null
        }))
      )
  }

  const full = await getPayrollEntry(entry.id)
  if (!full) throw new Error('Eintrag konnte nicht geladen werden.')
  return full
}

export const approvePayrollEntry = async (
  id: string
): Promise<PayrollEntry> => {
  const [row] = await db
    .update(payrollEntries)
    .set({ status: 'approved', approvedAt: new Date() })
    .where(eq(payrollEntries.id, id))
    .returning()
  if (!row) throw new Error('Eintrag nicht gefunden.')
  return row
}

export const cancelPayrollEntry = async (id: string): Promise<PayrollEntry> => {
  const [row] = await db
    .update(payrollEntries)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(payrollEntries.id, id))
    .returning()
  if (!row) throw new Error('Eintrag nicht gefunden.')
  return row
}

export const deletePayrollEntry = async (id: string): Promise<void> => {
  await db.delete(payrollEntries).where(eq(payrollEntries.id, id))
}

/* ── Auto-generation ─────────────────────────────────────────────── */

/**
 * Build a default `EntryUpsertInput` for an employee from their master
 * data. Used by the auto-generation flow — the user can still revise
 * the entry afterwards.
 *
 * The defaults are intentionally conservative: monthly base salary
 * goes in as a `pauschal` line item; no synthetic taxes / SV are added
 * because the user pflegt those values themselves (we are not a
 * certified Lohnabrechner — see anforderungen.md §13).
 */
/**
 * Variante mit explizit übergebenem Gehalt — nötig, weil das Gehalt
 * über `employee_salary_versions` zeitabhängig ist und der Caller die
 * Periodenstart-Version bereits aufgelöst hat.
 */
export const seedEntryFromEmployee = (
  emp: Employee,
  periodId: string,
  salary: { monthlySalary: string | null; hourlyWage: string | null },
  workingDays = 22
): EntryUpsertInput => ({
  periodId,
  employeeId: emp.id,
  workingDays,
  payoutMethod: 'Überweisung',
  lineItems: salary.monthlySalary
    ? [
        {
          kind: 'base',
          label: 'Grundlohn',
          unit: 'pauschal',
          amount: Number(salary.monthlySalary)
        }
      ]
    : salary.hourlyWage && emp.weeklyHours
      ? [
          {
            kind: 'hourly',
            label: 'Stundenlohn',
            unit: 'Std',
            quantity: round2(Number(emp.weeklyHours) * 4.33),
            rate: Number(salary.hourlyWage),
            amount: round2(
              Number(emp.weeklyHours) * 4.33 * Number(salary.hourlyWage)
            )
          }
        ]
      : [],
  deductions: []
})

/**
 * Create draft payroll entries for every active employee that has been
 * hired by the period's end and isn't yet booked in this period. The
 * caller (UI button or scheduler) decides when to fire this; we keep
 * the function idempotent by skipping already-booked employees.
 *
 * Returns `{ created, skipped }` so the UI can report what happened.
 */
export const generateEntriesForPeriod = async (
  periodId: string
): Promise<{ created: number; skipped: number }> => {
  const period = await getPayrollPeriod(periodId)
  if (!period) throw new Error('Periode nicht gefunden.')
  if (period.status !== 'open') {
    throw new Error('Nur offene Perioden können automatisch befüllt werden.')
  }

  // Pull every active employee who was already hired by the end of
  // this period. Termination date may be null or past the period end.
  const { fromIso, toIso } = periodBoundsIso(period.year, period.month)
  const allActive = await db
    .select()
    .from(employees)
    .where(eq(employees.archived, false))
  /**
   * Anti-Backfill: ein Mitarbeiter bekommt **frühestens ab dem Monat
   * NACH seiner Anlage** im System eine automatisch generierte
   * Lohnabrechnung — auch wenn sein `hireDate` weiter zurückliegt.
   * Damit entstehen für neu angelegte (oder importierte) Mitarbeiter
   * keine rückwirkenden Abrechnungen für Monate, in denen das System
   * sie noch gar nicht kannte.
   *
   * Vergleich auf (Jahr, Monat) als ein Skalar `year*12 + month`,
   * damit Monatsgrenzen sauber sortieren.
   */
  const periodKey = period.year * 12 + period.month
  const firstEligibleKey = (createdAt: Date | string | null): number => {
    if (!createdAt) return periodKey // ohne createdAt nicht herausfiltern
    const d = typeof createdAt === 'string' ? new Date(createdAt) : createdAt
    // erster zulässiger Monat = createdAt-Monat + 1
    return d.getUTCFullYear() * 12 + (d.getUTCMonth() + 1) + 1
  }
  const eligible = allActive.filter((e) => {
    if (e.hireDate && e.hireDate > toIso) return false
    if (e.terminationDate && e.terminationDate < fromIso) return false
    if (firstEligibleKey(e.createdAt) > periodKey) return false
    return true
  })

  let created = 0
  let skipped = 0
  for (const emp of eligible) {
    const existing = await findEntryFor(periodId, emp.id)
    if (existing) {
      skipped += 1
      continue
    }
    // Gehaltsversion zum Periodenstart auflösen — so bleibt eine
    // spätere Gehaltserhöhung ohne Wirkung auf zurückliegende Perioden.
    const v = await getEffectiveSalary(emp.id, fromIso)
    const seed = seedEntryFromEmployee(emp, periodId, {
      monthlySalary: v?.monthlySalary ?? null,
      hourlyWage: v?.hourlyWage ?? null
    })
    // Applicable Sonderzahlungen für diesen Mitarbeiter in der
    // Periode als zusätzliche Position einbauen.
    const specials = await applicableSpecialPaymentsFor(
      emp.id,
      period.year,
      period.month
    )
    for (const s of specials) {
      seed.lineItems.push({
        kind: 'special',
        label: s.label,
        unit: 'pauschal',
        amount: s.amount
      })
    }
    await upsertPayrollEntry(seed)
    created += 1
  }
  return { created, skipped }
}

/* ── Auto-generation ─────────────────────────────────────────────── */

/**
 * Lazy auto-generation: walk every month from the earliest active
 * employee's `hireDate` (capped at 24 months back) up to the current
 * month — but only including the current month once today is at or
 * past the configured `payrollGenerationDay`. For each month we
 * `ensurePayrollPeriod` and `generateEntriesForPeriod`, both
 * idempotent. Cancelled / past-termination employees are skipped per
 * period via the existing eligibility filter in
 * `generateEntriesForPeriod`.
 *
 * Returns aggregate counts so the caller can flash a toast or just
 * silently swallow.
 */
export const autoGeneratePayrollEntries = async (
  today: Date = new Date()
): Promise<{ periodsProcessed: number; entriesCreated: number }> => {
  const [settings] = await db.select().from(companySettings).limit(1)
  const generationDay = settings?.payrollGenerationDay ?? 25

  // Earliest hire date from active, salary-bearing employees. Anyone
  // without a hireDate is treated as "starts today" — they can still
  // auto-generate going forward.
  const active = await db
    .select({ hireDate: employees.hireDate })
    .from(employees)
    .where(eq(employees.archived, false))
  if (active.length === 0) return { periodsProcessed: 0, entriesCreated: 0 }

  const earliest = active.reduce<string | null>((m, e) => {
    if (!e.hireDate) return m
    return !m || e.hireDate < m ? e.hireDate : m
  }, null)
  if (!earliest) return { periodsProcessed: 0, entriesCreated: 0 }

  const earliestDate = new Date(`${earliest}T00:00:00Z`)
  const cap = new Date(today)
  cap.setUTCMonth(cap.getUTCMonth() - 24)
  const startCursor = earliestDate < cap ? cap : earliestDate
  let year = startCursor.getUTCFullYear()
  let month = startCursor.getUTCMonth() + 1

  // The "current" month only joins once we're past the generation day.
  const currentYear = today.getUTCFullYear()
  const currentMonth = today.getUTCMonth() + 1
  const includesCurrent = today.getUTCDate() >= generationDay
  const lastYear = includesCurrent
    ? currentYear
    : currentMonth === 1
      ? currentYear - 1
      : currentYear
  const lastMonth = includesCurrent
    ? currentMonth
    : currentMonth === 1
      ? 12
      : currentMonth - 1

  let periodsProcessed = 0
  let entriesCreated = 0
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    const period = await ensurePayrollPeriod(year, month)
    if (period.status !== 'closed') {
      const { created } = await generateEntriesForPeriod(period.id)
      entriesCreated += created
    }
    periodsProcessed += 1
    if (month === 12) {
      month = 1
      year += 1
    } else {
      month += 1
    }
  }
  return { periodsProcessed, entriesCreated }
}

/**
 * Schickt freigegebene, aber noch nicht versendete Lohnabrechnungen
 * per Mail an den Mitarbeiter. Idempotent: pro Eintrag wird auf den
 * Status `sent` umgeschaltet, sobald die Mail erfolgreich rausgegangen
 * ist — danach wird sie nicht mehr gesendet.
 *
 * Nur Mitarbeiter mit hinterlegter `private_email` bekommen Mail; ohne
 * Adresse landet der Eintrag im Skip-Zähler. Die SMTP-Versandlogik
 * trägt den Versand wie bei Belegen ohnehin in `sent_messages` ein —
 * von dort speist sich die Gesendet-Übersicht.
 */
export const autoSendPayrollEmails = async (): Promise<{
  sent: number
  skipped: number
  failed: number
}> => {
  // Lazy-Imports verhindern Zirkel zwischen mail-service ↔ payroll-service.
  const { sendDocumentEmail } = await import('./mail-service')
  const due = await db
    .select({
      entryId: payrollEntries.id,
      status: payrollEntries.status,
      year: payrollPeriods.year,
      month: payrollPeriods.month,
      employeeId: payrollEntries.employeeId,
      firstName: employees.firstName,
      lastName: employees.lastName,
      email: employees.privateEmail,
      salutation: employees.salutation
    })
    .from(payrollEntries)
    .innerJoin(payrollPeriods, eq(payrollEntries.periodId, payrollPeriods.id))
    .innerJoin(employees, eq(employees.id, payrollEntries.employeeId))
    .where(eq(payrollEntries.status, 'approved'))

  let sent = 0
  let skipped = 0
  let failed = 0
  for (const row of due) {
    if (!row.email) {
      skipped += 1
      continue
    }
    const result = await sendDocumentEmail({
      documentId: row.entryId,
      documentType: 'payslip',
      to: { email: row.email, name: `${row.firstName} ${row.lastName}`.trim() },
      context: {
        customer: {
          firstName: row.firstName,
          lastName: row.lastName,
          company: null,
          salutation: row.salutation ?? null
        },
        extra: {
          monat: String(row.month).padStart(2, '0'),
          jahr: String(row.year)
        }
      }
    })
    if (result.ok) {
      await db
        .update(payrollEntries)
        .set({ status: 'sent', updatedAt: new Date() })
        .where(eq(payrollEntries.id, row.entryId))
      sent += 1
    } else {
      failed += 1
    }
  }
  return { sent, skipped, failed }
}

/* ── Cross-period entry list (für /payroll Hauptansicht) ────────── */

export type AnyPayrollEntryRow = PayrollEntry & {
  year: number
  month: number
  employeeFirstName: string
  employeeLastName: string
}

export const listAllPayrollEntries = async (
  page: number,
  size: number,
  filters: { year?: number | null; employeeId?: string | null } = {}
): Promise<{
  items: AnyPayrollEntryRow[]
  total: number
  page: number
  size: number
  pageCount: number
}> => {
  const offset = Math.max(0, (page - 1) * size)
  const conditions = []
  if (filters.year != null) {
    conditions.push(eq(payrollPeriods.year, filters.year))
  }
  if (filters.employeeId) {
    conditions.push(eq(payrollEntries.employeeId, filters.employeeId))
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined
  const [items, totalRow] = await Promise.all([
    db
      .select({
        id: payrollEntries.id,
        periodId: payrollEntries.periodId,
        employeeId: payrollEntries.employeeId,
        workingDays: payrollEntries.workingDays,
        vacationDaysUsed: payrollEntries.vacationDaysUsed,
        sickDays: payrollEntries.sickDays,
        grossTotal: payrollEntries.grossTotal,
        deductionsTotal: payrollEntries.deductionsTotal,
        taxTotal: payrollEntries.taxTotal,
        socialEmployeeTotal: payrollEntries.socialEmployeeTotal,
        socialEmployerTotal: payrollEntries.socialEmployerTotal,
        netTotal: payrollEntries.netTotal,
        payoutAmount: payrollEntries.payoutAmount,
        payoutDate: payrollEntries.payoutDate,
        payoutMethod: payrollEntries.payoutMethod,
        status: payrollEntries.status,
        notes: payrollEntries.notes,
        approvedAt: payrollEntries.approvedAt,
        createdAt: payrollEntries.createdAt,
        updatedAt: payrollEntries.updatedAt,
        year: payrollPeriods.year,
        month: payrollPeriods.month,
        employeeFirstName: employees.firstName,
        employeeLastName: employees.lastName
      })
      .from(payrollEntries)
      .innerJoin(payrollPeriods, eq(payrollPeriods.id, payrollEntries.periodId))
      .innerJoin(employees, eq(employees.id, payrollEntries.employeeId))
      .where(where)
      .orderBy(
        desc(payrollPeriods.year),
        desc(payrollPeriods.month),
        asc(employees.lastName)
      )
      .limit(size)
      .offset(offset),
    db
      .select({ value: count() })
      .from(payrollEntries)
      .innerJoin(payrollPeriods, eq(payrollPeriods.id, payrollEntries.periodId))
      .where(where)
  ])
  const total = Number(totalRow[0]?.value ?? 0)
  return {
    items: items as AnyPayrollEntryRow[],
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size))
  }
}
