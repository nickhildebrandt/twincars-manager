<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import {
    createAbsenceRemote,
    deleteAbsenceRemote,
    getAbsenceConflictsRemote,
    getEmployeeRemote,
    listAbsencesRemote,
    listEmployeeSalaryVersionsRemote,
    updateAbsenceRemote
  } from '../employees.remote'
  import {
    Pencil,
    Plus,
    Trash2,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Stethoscope
  } from '@lucide/svelte'
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
  const absencesQ = $derived(
    listAbsencesRemote({ employeeId: id, year: absenceYear })
  )
  const initialAbs = await untrack(() => absencesQ)
  const salaryVersionsQ = listEmployeeSalaryVersionsRemote({ employeeId: id })
  const initialSalaryVersions = await salaryVersionsQ
  let salaryVersions = $state<typeof initialSalaryVersions>(
    initialSalaryVersions
  )
  $effect(() => {
    if (salaryVersionsQ.current) salaryVersions = salaryVersionsQ.current
  })

  /**
   * Imperative state mirror — same trick as the reminders list (see
   * CONTRIBUTING §7): top-level-await seeds, mutations re-fetch via
   * `.run()` and assign back. Avoids the brittle reactive `query.current`
   * path entirely.
   */
  // Mirror customers' lastResult pattern: keep the previous result
  // visible across param changes so the table doesn't flash empty.
  let lastAbs = $state<typeof initialAbs>(initialAbs)
  $effect(() => {
    if (absencesQ.current) lastAbs = absencesQ.current
  })
  const absencesData = $derived(absencesQ.current ?? lastAbs)
  const absences = $derived(absencesData.absences)
  const balance = $derived(absencesData.balance)

  /**
   * Past years are read-only — the user can browse them but can't add,
   * edit, or delete. Only the current year (and future years, in case
   * the user wants to plan vacation early) is mutable.
   */
  const yearReadOnly = $derived(absenceYear < currentYear)

  /**
   * Krankheit im Folgejahr ist fachlich nicht zulässig (das wäre eine
   * Vorab-Krankmeldung) — Urlaubsplanung dagegen schon. Wir gaten den
   * Type-Selector entsprechend; der Server prüft zusätzlich.
   */
  const sickAllowed = $derived(absenceYear <= currentYear)

  /**
   * Frei navigierbare Jahres-Auswahl: prev/Heute/next, ohne fixe
   * Range. Auch mehrere Jahre im Voraus geplante Urlaube sind so
   * sichtbar; das Backend filtert ohnehin per `year` und liefert
   * leere Listen zurück, wenn nichts existiert.
   */
  const goPrevYear = () => (absenceYear -= 1)
  const goNextYear = () => (absenceYear += 1)
  const goCurrentYear = () => (absenceYear = currentYear)

  const monthLabel = (m: number) =>
    [
      'Januar',
      'Februar',
      'März',
      'April',
      'Mai',
      'Juni',
      'Juli',
      'August',
      'September',
      'Oktober',
      'November',
      'Dezember'
    ][m - 1] ?? String(m)

  /* — New-absence form state — */
  const todayIso = new Date().toISOString().slice(0, 10)
  /** Default-Datum für ein Zieljahr: heute, falls das aktuelle Jahr,
   * sonst der 1. Januar. */
  const defaultDateFor = (year: number): string =>
    year === currentYear ? todayIso : `${year}-01-01`
  let formType = $state<'vacation' | 'sick' | 'other'>('vacation')
  let formFrom = $state(todayIso)
  let formTo = $state(todayIso)
  let formStatus = $state<'planned' | 'approved' | 'cancelled'>('approved')
  let formError = $state<string | null>(null)

  const reset = () => {
    formType = 'vacation'
    const d = defaultDateFor(absenceYear)
    formFrom = d
    formTo = d
    formStatus = 'approved'
    formError = null
  }

  /** Bei Jahres-Wechsel: Formular-Datum auf das gewählte Jahr ziehen,
   * solange der User es nicht bereits manuell auf dieses Jahr gesetzt
   * hat. */
  $effect(() => {
    const y = absenceYear
    const fromY = Number(formFrom.slice(0, 4))
    const toY = Number(formTo.slice(0, 4))
    if (fromY !== y) formFrom = defaultDateFor(y)
    if (toY !== y) formTo = defaultDateFor(y)
    // Krankheit im Folgejahr nicht zulässig — auf Urlaub fallen.
    if (!sickAllowed && formType === 'sick') formType = 'vacation'
  })

  /** Wenn der User manuell ein Datum aus einem anderen Jahr wählt,
   * snappt die obere Jahresauswahl entsprechend mit. */
  const onDateChange = (val: string) => {
    const y = Number(val.slice(0, 4))
    if (Number.isFinite(y) && y !== absenceYear) absenceYear = y
  }

  /** Refresh the active query — used after every mutation. */
  const refresh = () => absencesQ.refresh()

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

  const persistAbsence = async (replaceConflicting = false) => {
    await busy.run(async () => {
      await createAbsenceRemote({
        employeeId: id,
        type: formType,
        dateFrom: formFrom,
        dateTo: formTo,
        status: formStatus,
        replaceConflicting
      })
      await refresh()
    })
    reset()
    toast.success('Abwesenheit eingetragen.')
  }

  const submit = async (ev: Event) => {
    ev.preventDefault()
    formError = null
    if (formTo < formFrom) {
      formError = 'Bis-Datum darf nicht vor dem Von-Datum liegen.'
      return
    }
    if (formType === 'sick') {
      const fromY = Number(formFrom.slice(0, 4))
      const toY = Number(formTo.slice(0, 4))
      if (fromY > currentYear || toY > currentYear) {
        formError =
          'Krankmeldungen für ein Folgejahr sind nicht zulässig — Urlaub kann vorausgeplant werden.'
        return
      }
    }
    try {
      const conflicts = await getAbsenceConflictsRemote({
        employeeId: id,
        type: formType,
        dateFrom: formFrom,
        dateTo: formTo
      })
      if (conflicts.length > 0) {
        conflictRows = conflicts as ConflictRow[]
        conflictOpen = true
        return
      }
      await persistAbsence(false)
    } catch (err) {
      handleClientError(err, 'Eintrag konnte nicht gespeichert werden')
    }
  }

  const confirmReplace = async () => {
    conflictOpen = false
    try {
      await persistAbsence(true)
    } catch (err) {
      handleClientError(err, 'Eintrag konnte nicht gespeichert werden')
    }
  }

  const cancelReplace = () => {
    conflictOpen = false
    conflictRows = []
  }

  const setStatus = async (
    rowId: string,
    status: 'planned' | 'approved' | 'cancelled'
  ) => {
    try {
      await busy.run(async () => {
        await updateAbsenceRemote({ id: rowId, values: { status } })
        await refresh()
      })
      toast.success('Status aktualisiert.')
    } catch (err) {
      handleClientError(err)
    }
  }

  const remove = async (rowId: string) => {
    try {
      await busy.run(async () => {
        await deleteAbsenceRemote({ id: rowId, employeeId: id })
        await refresh()
      })
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

  /** Business days (Mon–Fri) for an inclusive YYYY-MM-DD range. */
  const businessDays = (fromIso: string, toIso: string): number => {
    const start = new Date(`${fromIso}T00:00:00Z`).getTime()
    const end = new Date(`${toIso}T00:00:00Z`).getTime()
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0
    let n = 0
    for (let t = start; t <= end; t += 24 * 60 * 60 * 1000) {
      const d = new Date(t).getUTCDay()
      if (d !== 0 && d !== 6) n += 1
    }
    return n
  }
  const absenceDays = (a: {
    dateFrom: string
    dateTo: string
    status: string
  }) => (a.status === 'cancelled' ? 0 : businessDays(a.dateFrom, a.dateTo))

  const vacationTotal = $derived(
    absences
      .filter((a) => a.type === 'vacation')
      .reduce((s, a) => s + absenceDays(a), 0)
  )
  const sickTotal = $derived(
    absences
      .filter((a) => a.type === 'sick')
      .reduce((s, a) => s + absenceDays(a), 0)
  )

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
          class="sm:col-span-2">{e.birthday ?? '—'}</dd
        >
        <dt class="text-base-content/60">Anschrift</dt><dd
          class="break-words sm:col-span-2"
          >{[e.street, e.zip, e.city].filter(Boolean).join(', ') || '—'}</dd
        >
        <dt class="text-base-content/60">E-Mail</dt><dd
          class="break-all sm:col-span-2">{e.privateEmail ?? '—'}</dd
        >
        <dt class="text-base-content/60">Telefon</dt><dd
          class="break-all sm:col-span-2">{e.privatePhone ?? '—'}</dd
        >
      </dl>
    </div>
  </div>
  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">Beschäftigung</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
        <dt class="text-base-content/60">Eintritt</dt><dd class="sm:col-span-2"
          >{e.hireDate ?? '—'}</dd
        >
        <dt class="text-base-content/60">Position</dt><dd
          class="break-words sm:col-span-2">{e.position ?? '—'}</dd
        >
        <dt class="text-base-content/60">Abteilung</dt><dd
          class="break-words sm:col-span-2">{e.department ?? '—'}</dd
        >
        <dt class="text-base-content/60">Art</dt><dd class="sm:col-span-2"
          >{e.employmentType ?? '—'}</dd
        >
        <dt class="text-base-content/60">Wochenstunden</dt><dd
          class="sm:col-span-2">{e.weeklyHours ?? '—'}</dd
        >
        <dt class="text-base-content/60">Urlaub / Jahr</dt><dd
          class="sm:col-span-2">{e.vacationDaysPerYear ?? '—'}</dd
        >
      </dl>
    </div>
  </div>
  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">Steuer & SV</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
        <dt class="text-base-content/60">Steuer-ID</dt><dd
          class="font-mono break-all sm:col-span-2">{e.taxId ?? '—'}</dd
        >
        <dt class="text-base-content/60">Steuerklasse</dt><dd
          class="sm:col-span-2">{e.taxClass ?? '—'}</dd
        >
        <dt class="text-base-content/60">SV-Nummer</dt><dd
          class="font-mono break-all sm:col-span-2"
          >{e.socialInsuranceNumber ?? '—'}</dd
        >
        <dt class="text-base-content/60">Krankenkasse</dt><dd
          class="break-words sm:col-span-2">{e.healthInsurance ?? '—'}</dd
        >
      </dl>
    </div>
  </div>
  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">Bankverbindung</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
        <dt class="text-base-content/60">Inhaber</dt><dd
          class="break-words sm:col-span-2">{e.bankAccountHolder ?? '—'}</dd
        >
        <dt class="text-base-content/60">IBAN</dt><dd
          class="font-mono break-all sm:col-span-2">{e.bankIban ?? '—'}</dd
        >
        <dt class="text-base-content/60">BIC</dt><dd
          class="font-mono break-all sm:col-span-2">{e.bankBic ?? '—'}</dd
        >
        <dt class="text-base-content/60">Bank</dt><dd
          class="break-words sm:col-span-2">{e.bankName ?? '—'}</dd
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

    <div class="border-base-300 rounded-box overflow-x-auto border">
      {#if salaryVersions.length === 0}
        <p class="text-base-content/60 px-4 py-6 text-sm">
          Noch keine Gehaltsversionen erfasst.
        </p>
      {:else}
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
                  {v.monthlySalary ? formatEuro(Number(v.monthlySalary)) : '—'}
                </td>
                <td class="text-right font-mono">
                  {v.hourlyWage ? formatEuro(Number(v.hourlyWage)) : '—'}
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
      {/if}
    </div>
  </div>
</div>

<!-- Abwesenheiten — Urlaub / Krankheit / Sonstiges, jahresweise -->
<div class="card border-base-300 bg-base-100 mt-4 border">
  <div class="card-body gap-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="card-title text-base">Abwesenheiten</h3>
      <div class="join">
        <button
          type="button"
          class="btn btn-sm join-item"
          onclick={goPrevYear}
          aria-label="Vorheriges Jahr"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          class="btn btn-sm join-item w-20 font-mono"
          onclick={goCurrentYear}
          title="Aktuelles Jahr"
        >
          {absenceYear}
        </button>
        <button
          type="button"
          class="btn btn-sm join-item"
          onclick={goNextYear}
          aria-label="Nächstes Jahr"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>

    {#if yearReadOnly}
      <div class="alert alert-info py-2 text-sm">
        Vergangene Jahre sind schreibgeschützt.
      </div>
    {/if}

    {#if formError}
      <div class="alert alert-error">
        <span>{formError}</span>
      </div>
    {/if}

    {#if !yearReadOnly}
      <!--
        Add-form fills the whole card width with equal-weight columns —
        only rendered for the current/future year. Past years are
        read-only and don't show the form.
      -->
      <form
        onsubmit={submit}
        class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
      >
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Typ</span>
          <select class="select select-bordered w-full" bind:value={formType}>
            <option value="vacation">Urlaub</option>
            {#if sickAllowed}
              <option value="sick">Krankheit</option>
            {/if}
            <option value="other">Sonstiges</option>
          </select>
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Von</span>
          <input
            class="input input-bordered w-full"
            type="date"
            required
            bind:value={formFrom}
            onchange={(e) => onDateChange((e.target as HTMLInputElement).value)}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Bis</span>
          <input
            class="input input-bordered w-full"
            type="date"
            required
            bind:value={formTo}
            onchange={(e) => onDateChange((e.target as HTMLInputElement).value)}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Status</span>
          <select class="select select-bordered w-full" bind:value={formStatus}>
            <option value="planned">Geplant</option>
            <option value="approved">Genehmigt</option>
            <option value="cancelled">Abgesagt</option>
          </select>
        </label>
        <div class="flex items-end">
          <button
            type="submit"
            class="btn btn-primary gap-1"
            disabled={busy.active}
          >
            <Plus size={14} />
            Eintragen
          </button>
        </div>
      </form>
    {/if}

    <!-- Table is wrapped in its own bordered container to set it off
         visually from the form above. -->
    <div class="border-base-300 rounded-box overflow-x-auto border">
      {#if absences.length === 0}
        <p class="text-base-content/60 px-4 py-6 text-sm">
          Noch keine Abwesenheiten erfasst.
        </p>
      {:else}
        <table class="table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Zeitraum</th>
              <th class="text-right">Tage</th>
              <th>Status</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each absences as a (a.id)}
              {@const days = absenceDays(a)}
              <tr>
                <td>
                  <span class="inline-flex items-center gap-2">
                    {#if a.type === 'sick'}
                      <Stethoscope size={14} class="text-error" />
                    {:else}
                      <CalendarDays size={14} class="text-info" />
                    {/if}
                    {typeLabel(a.type)}
                  </span>
                </td>
                <td>{fmt(a.dateFrom)} – {fmt(a.dateTo)}</td>
                <td class="text-right font-mono">{days}</td>
                <td>
                  <span class="badge badge-sm {statusBadge(a.status)}">
                    {statusLabel(a.status)}
                  </span>
                </td>
                <td>
                  {#if !yearReadOnly}
                    <div class="flex justify-end gap-1">
                      {#if a.status !== 'cancelled'}
                        <button
                          type="button"
                          class="btn btn-ghost btn-xs"
                          onclick={() => setStatus(a.id, 'cancelled')}
                          disabled={busy.active}
                        >
                          Stornieren
                        </button>
                      {/if}
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs btn-square text-error"
                        onclick={() => remove(a.id)}
                        disabled={busy.active}
                        aria-label="Löschen"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
          <tfoot
            class="border-base-300 bg-base-200/30 border-t-2 font-semibold"
          >
            <tr>
              <td>Urlaub gesamt</td>
              <td class="text-base-content/60 font-normal">
                Anspruch: {balance.entitled} Tage · verbleibend
                <span class="font-semibold">{balance.remaining}</span>
              </td>
              <td class="text-right font-mono">{vacationTotal}</td>
              <td colspan="2"></td>
            </tr>
            <tr>
              <td>Krankheit gesamt</td>
              <td></td>
              <td class="text-right font-mono">{sickTotal}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      {/if}
    </div>
  </div>
</div>

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
              {fmt(c.dateFrom)} – {fmt(c.dateTo)}
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
