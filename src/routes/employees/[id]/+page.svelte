<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import AbsenceSection, {
    type AbsenceStatus,
    type AbsenceSubmitValues
  } from './AbsenceSection.svelte'
  import {
    createAbsenceRemote,
    deleteAbsenceRemote,
    getAbsenceConflictsRemote,
    getEmployeeRemote,
    listAbsencesRemote,
    listEmployeeSalaryVersionsRemote,
    updateAbsenceRemote
  } from '../employees.remote'
  import { Pencil, CalendarDays, Stethoscope } from '@lucide/svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'
  import { handleClientError } from '$lib/utils/client-error'
  import { formatEuro } from '$lib/utils/money'

  const id = untrack(() => page.params.id!)
  const currentYear = new Date().getFullYear()
  let absenceYear = $state(currentYear)

  /**
   * Top-level await: SSR carries the data, hydration reuses the cache.
   * The year picker drives a reactive re-fetch through the `$derived`
   * query below.
   */
  const e = await getEmployeeRemote({ id })
  /**
   * Query args for the absence list. The query proxy itself is never
   * memoized (list-page recipe / CONTRIBUTING §5): a proxy stored in
   * its own `$derived` detaches from later `refresh()` cache updates —
   * the list then only changes on a full reload.
   */
  const absArgs = $derived({ employeeId: id, year: absenceYear })
  const initialAbs = await untrack(() => listAbsencesRemote(absArgs))
  const salaryVersionsQ = listEmployeeSalaryVersionsRemote({ employeeId: id })
  const initialSalaryVersions = await salaryVersionsQ
  let salaryVersions = $state<typeof initialSalaryVersions>(
    initialSalaryVersions
  )
  $effect(() => {
    if (salaryVersionsQ.current) salaryVersions = salaryVersionsQ.current
  })

  // Mirror customers' lastResult pattern: keep the previous result
  // visible across param changes so the table doesn't flash empty.
  let lastAbs = $state<typeof initialAbs>(initialAbs)
  $effect(() => {
    const q = listAbsencesRemote(absArgs)
    if (q.current) lastAbs = q.current
  })
  const absencesData = $derived.by(
    () => listAbsencesRemote(absArgs).current ?? lastAbs
  )
  const absences = $derived(absencesData.absences)
  const balance = $derived(absencesData.balance)

  /* — Konflikt-Modal für Urlaub vs. Krankheit am gleichen Tag — */
  type ConflictRow = {
    id: string
    type: 'vacation' | 'sick' | 'other'
    dateFrom: string
    dateTo: string
    status: string
  }
  let conflictOpen = $state(false)
  let conflictRows = $state<ConflictRow[]>([])
  /** Values held while the conflict modal awaits the user's decision. */
  let pendingValues = $state<AbsenceSubmitValues | null>(null)
  let absenceSection = $state<{ resetForm: () => void } | undefined>(undefined)

  /**
   * List keys for every calendar year an absence touches, excluding
   * the currently browsed one (that key is declared separately, with
   * an optimistic override where applicable). A cross-year absence
   * (max two years — spans are capped at one year) must refresh both
   * year caches, otherwise the neighbour year shows stale data.
   */
  const otherYearKeys = (fromIso: string, toIso: string) => {
    const years = new Set([
      Number(fromIso.slice(0, 4)),
      Number(toIso.slice(0, 4))
    ])
    years.delete(absenceYear)
    return Array.from(years, (y) =>
      listAbsencesRemote({ employeeId: id, year: y })
    )
  }

  const persistAbsence = async (
    values: AbsenceSubmitValues,
    replaceConflicting = false
  ) => {
    // Single-flight: the client declares the subscribed list keys via
    // `.updates(...)`; the server-side `requested(...).refreshAll()`
    // then returns the fresh lists (with workday counts and balance)
    // in the same round trip.
    await busy.run(() =>
      createAbsenceRemote({
        employeeId: id,
        ...values,
        replaceConflicting
      }).updates(
        listAbsencesRemote(absArgs),
        ...otherYearKeys(values.dateFrom, values.dateTo)
      )
    )
    toast.success('Abwesenheit eingetragen.')
  }

  /**
   * AbsenceSection submit hook — returns `true` when the entry was
   * created (form resets), `false` when a conflict modal is pending or
   * the server rejected (values stay editable).
   */
  const submitAbsence = async (
    values: AbsenceSubmitValues
  ): Promise<boolean> => {
    try {
      // Event-handler call site: queries must be executed via `.run()`
      // (only render-time calls create a reactive resource).
      const conflicts = await getAbsenceConflictsRemote({
        employeeId: id,
        type: values.type,
        dateFrom: values.dateFrom,
        dateTo: values.dateTo
      }).run()
      if (conflicts.length > 0) {
        pendingValues = values
        conflictRows = conflicts as ConflictRow[]
        conflictOpen = true
        return false
      }
      await persistAbsence(values, false)
      return true
    } catch (err) {
      handleClientError(err, 'Eintrag konnte nicht gespeichert werden')
      return false
    }
  }

  const confirmReplace = async () => {
    conflictOpen = false
    const values = pendingValues
    pendingValues = null
    if (!values) return
    try {
      await persistAbsence(values, true)
      absenceSection?.resetForm()
    } catch (err) {
      handleClientError(err, 'Eintrag konnte nicht gespeichert werden')
    }
  }

  const cancelReplace = () => {
    conflictOpen = false
    conflictRows = []
    pendingValues = null
  }

  /** Neighbour-year keys of an existing row (empty when not found). */
  const rowYearKeys = (rowId: string) => {
    const row = absences.find((a) => a.id === rowId)
    return row ? otherYearKeys(row.dateFrom, row.dateTo) : []
  }

  const setStatus = async (rowId: string, status: AbsenceStatus) => {
    try {
      // Optimistic status flip; the server flight replaces the override
      // with the authoritative list (incl. recalculated balance).
      await busy.run(() =>
        updateAbsenceRemote({ id: rowId, values: { status } }).updates(
          listAbsencesRemote(absArgs).withOverride((current) => ({
            ...current,
            absences: current.absences.map((a) =>
              a.id === rowId ? { ...a, status } : a
            )
          })),
          ...rowYearKeys(rowId)
        )
      )
      toast.success('Status aktualisiert.')
    } catch (err) {
      handleClientError(err)
    }
  }

  const remove = async (rowId: string) => {
    try {
      // Optimistic delete: the row vanishes immediately.
      await busy.run(() =>
        deleteAbsenceRemote({ id: rowId, employeeId: id }).updates(
          listAbsencesRemote(absArgs).withOverride((current) => ({
            ...current,
            absences: current.absences.filter((a) => a.id !== rowId)
          })),
          ...rowYearKeys(rowId)
        )
      )
      toast.success('Eintrag gelöscht.')
    } catch (err) {
      handleClientError(err)
    }
  }

  const typeLabel = (t: string) =>
    t === 'vacation' ? 'Urlaub' : t === 'sick' ? 'Krankheit' : 'Sonstiges'
  const statusLabel = (s: string) =>
    s === 'planned' ? 'Geplant' : s === 'cancelled' ? 'Abgesagt' : 'Genehmigt'
  const statusBadge = (s: string) =>
    s === 'cancelled'
      ? 'badge-ghost'
      : s === 'planned'
        ? 'badge-warning'
        : 'badge-success'
  const fmt = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
    return m ? `${m[3]}.${m[2]}.${m[1]}` : s
  }

  /* Gehaltshistorie ist read-only — neue Versionen entstehen
     ausschliesslich durch Bearbeiten der Mitarbeiter-Stammdaten
     (Form auf /employees/[id]/edit). Der Server hängt dann
     automatisch eine Version mit `valid_from = heute` an. */
</script>

<PageHeader
  title={`${e.firstName} ${e.lastName}`}
  back="/employees"
  primaryAction={{
    label: 'Bearbeiten',
    href: `/employees/${e.id}/edit`,
    icon: Pencil
  }}
/>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">Person & Anschrift</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
        <dt class="text-base-content/60">Geburtstag</dt><dd
          class="sm:col-span-2">{e.birthday ?? '-'}</dd
        >
        <dt class="text-base-content/60">Anschrift</dt><dd
          class="break-words sm:col-span-2"
          >{[e.street, e.zip, e.city].filter(Boolean).join(', ') || '-'}</dd
        >
        <dt class="text-base-content/60">E-Mail</dt><dd
          class="break-all sm:col-span-2">{e.privateEmail ?? '-'}</dd
        >
        <dt class="text-base-content/60">Telefon</dt><dd
          class="break-all sm:col-span-2">{e.privatePhone ?? '-'}</dd
        >
      </dl>
    </div>
  </div>
  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">Beschäftigung</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
        <dt class="text-base-content/60">Eintritt</dt><dd class="sm:col-span-2"
          >{e.hireDate ?? '-'}</dd
        >
        <dt class="text-base-content/60">Position</dt><dd
          class="break-words sm:col-span-2">{e.position ?? '-'}</dd
        >
        <dt class="text-base-content/60">Abteilung</dt><dd
          class="break-words sm:col-span-2">{e.department ?? '-'}</dd
        >
        <dt class="text-base-content/60">Art</dt><dd class="sm:col-span-2"
          >{e.employmentType ?? '-'}</dd
        >
        <dt class="text-base-content/60">Wochenstunden</dt><dd
          class="sm:col-span-2"
          >{e.weeklyHours != null
            ? Number(e.weeklyHours).toLocaleString('de-DE')
            : '-'}</dd
        >
        <dt class="text-base-content/60">Urlaub / Jahr</dt><dd
          class="sm:col-span-2">{e.vacationDaysPerYear ?? '-'}</dd
        >
      </dl>
    </div>
  </div>
  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">Steuer & SV</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
        <dt class="text-base-content/60">Steuer-ID</dt><dd
          class="font-mono break-all sm:col-span-2">{e.taxId ?? '-'}</dd
        >
        <dt class="text-base-content/60">Steuerklasse</dt><dd
          class="sm:col-span-2">{e.taxClass ?? '-'}</dd
        >
        <dt class="text-base-content/60">SV-Nummer</dt><dd
          class="font-mono break-all sm:col-span-2"
          >{e.socialInsuranceNumber ?? '-'}</dd
        >
        <dt class="text-base-content/60">Krankenkasse</dt><dd
          class="break-words sm:col-span-2">{e.healthInsurance ?? '-'}</dd
        >
      </dl>
    </div>
  </div>
  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">Bankverbindung</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
        <dt class="text-base-content/60">Inhaber</dt><dd
          class="break-words sm:col-span-2">{e.bankAccountHolder ?? '-'}</dd
        >
        <dt class="text-base-content/60">IBAN</dt><dd
          class="font-mono break-all sm:col-span-2">{e.bankIban ?? '-'}</dd
        >
        <dt class="text-base-content/60">BIC</dt><dd
          class="font-mono break-all sm:col-span-2">{e.bankBic ?? '-'}</dd
        >
        <dt class="text-base-content/60">Bank</dt><dd
          class="break-words sm:col-span-2">{e.bankName ?? '-'}</dd
        >
      </dl>
    </div>
  </div>
</div>

<!-- Gehaltshistorie — read-only Anzeige. Neue Versionen entstehen
     ausschließlich durch Bearbeiten der Stammdaten (siehe Edit-Seite);
     der Server hängt bei Änderung automatisch eine Version mit
     `valid_from = heute` an. -->
<div class="card border-base-300 bg-base-100 mt-4 border">
  <div class="card-body gap-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="card-title text-base">Gehaltshistorie</h3>
      <span class="text-base-content/60 text-sm">
        Aktuell:
        {e.monthlySalary
          ? `${formatEuro(Number(e.monthlySalary))} / Monat`
          : e.hourlyWage
            ? `${formatEuro(Number(e.hourlyWage))} / Std.`
            : 'kein Gehalt hinterlegt'}
      </span>
    </div>

    {#if salaryVersions.length === 0}
      <p class="text-base-content/60 text-sm">
        Noch keine Gehaltsversionen erfasst.
      </p>
    {:else}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Gültig ab</th>
              <th class="text-right">Monatslohn</th>
              <th class="text-right">Stundenlohn</th>
              <th>Erfasst</th>
            </tr>
          </thead>
          <tbody>
            {#each salaryVersions as v (v.id)}
              <tr>
                <td>{fmt(v.validFrom)}</td>
                <td class="text-right font-mono">
                  {v.monthlySalary ? formatEuro(Number(v.monthlySalary)) : '-'}
                </td>
                <td class="text-right font-mono">
                  {v.hourlyWage ? formatEuro(Number(v.hourlyWage)) : '-'}
                </td>
                <td class="text-base-content/60 text-sm">
                  {fmt(
                    typeof v.createdAt === 'string'
                      ? v.createdAt
                      : new Date(v.createdAt).toISOString()
                  )}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<!-- Abwesenheiten — Urlaub / Krankheit / Sonstiges, jahresweise.
     Die Karte (Jahr-Auswahl, Resturlaub, Formular, Liste) lebt in
     AbsenceSection; der Konflikt-Modal-Flow bleibt hier, weil er die
     Remote-Aufrufe orchestriert. -->
<AbsenceSection
  bind:this={absenceSection}
  bind:year={absenceYear}
  {absences}
  {balance}
  onSubmit={submitAbsence}
  onSetStatus={setStatus}
  onDelete={remove}
/>

<!--
  Konflikt-Modal: bestehende Urlaub/Krankheit-Einträge überlappen mit
  der neuen Eingabe. Nutzer entscheidet, welche Art gelten soll.
-->
{#if conflictOpen}
  <div class="modal modal-open" role="dialog" aria-modal="true">
    <div class="modal-box">
      <h3 class="text-lg font-bold">Konflikt mit bestehender Abwesenheit</h3>
      <p class="text-base-content/70 mt-2 text-sm">
        Für den gewählten Zeitraum existiert bereits {conflictRows.length === 1
          ? 'ein Eintrag'
          : 'mehrere Einträge'} einer anderen Art. Sollen die bestehenden Einträge
        ersetzt werden?
      </p>
      <ul class="border-base-300 mt-3 divide-y rounded border text-sm">
        {#each conflictRows as c (c.id)}
          <li class="flex items-center justify-between p-2">
            <span class="inline-flex items-center gap-2">
              {#if c.type === 'sick'}
                <Stethoscope size={14} class="text-error" />
              {:else}
                <CalendarDays size={14} class="text-info" />
              {/if}
              {typeLabel(c.type)}
            </span>
            <span class="font-mono text-xs">
              {fmt(c.dateFrom)} - {fmt(c.dateTo)}
            </span>
            <span class="badge badge-sm {statusBadge(c.status)}">
              {statusLabel(c.status)}
            </span>
          </li>
        {/each}
      </ul>
      <div class="modal-action">
        <button
          type="button"
          class="btn btn-ghost"
          onclick={cancelReplace}
          disabled={busy.active}
        >
          Eingabe verwerfen
        </button>
        <button
          type="button"
          class="btn btn-error"
          onclick={confirmReplace}
          disabled={busy.active}
        >
          Bestehende ersetzen
        </button>
      </div>
    </div>
    <button
      type="button"
      class="modal-backdrop"
      onclick={cancelReplace}
      aria-label="Schließen">close</button
    >
  </div>
{/if}
