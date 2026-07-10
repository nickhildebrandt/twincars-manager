<script module lang="ts">
  export type AbsenceType = 'vacation' | 'sick' | 'other'
  export type AbsenceStatus = 'planned' | 'approved' | 'cancelled'

  /** Row shape as served by `listAbsencesRemote` (workdays enriched). */
  export type AbsenceRow = {
    id: string
    type: string
    dateFrom: string
    dateTo: string
    halfDay: boolean
    notes?: string | null
    status: string
    /** Workdays over the full range (weekends + holidays skipped). */
    workdays: number
    /** Workdays clamped to the displayed year. */
    workdaysInYear: number
  }

  export type AbsenceSubmitValues = {
    type: AbsenceType
    dateFrom: string
    dateTo: string
    halfDay: boolean
    notes?: string
    status: AbsenceStatus
  }
</script>

<script lang="ts">
  import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Plus,
    Stethoscope,
    Trash2
  } from '@lucide/svelte'
  import { busy } from '$lib/stores/busy.svelte'

  let {
    year = $bindable(),
    absences,
    balance,
    onSubmit,
    onSetStatus,
    onDelete
  }: {
    year: number
    absences: AbsenceRow[]
    balance: { year: number; entitled: number; used: number; remaining: number }
    /**
     * Persist callback — returns `true` when the entry was created (the
     * form resets), `false` when it was not (conflict modal pending or
     * server rejection; the form keeps its values).
     */
    onSubmit: (values: AbsenceSubmitValues) => Promise<boolean>
    onSetStatus: (id: string, status: AbsenceStatus) => void
    onDelete: (id: string) => void
  } = $props()

  const currentYear = new Date().getFullYear()

  /**
   * Past years are read-only — the user can browse them but can't add,
   * edit, or delete. Only the current year (and future years, in case
   * the user wants to plan vacation early) is mutable.
   */
  const yearReadOnly = $derived(year < currentYear)

  /**
   * Krankheit im Folgejahr ist fachlich nicht zulässig (das wäre eine
   * Vorab-Krankmeldung) — Urlaubsplanung dagegen schon. Wir gaten den
   * Type-Selector entsprechend; der Server prüft zusätzlich.
   */
  const sickAllowed = $derived(year <= currentYear)

  /**
   * Explicit year navigation resets the form dates into the browsed
   * year (the add-form always targets the visible year). Date-input
   * changes deliberately do NOT reset the other date — otherwise a
   * cross-year range (e.g. 29.12.–05.01., the classic Christmas
   * vacation) could never be entered.
   */
  const setYear = (y: number) => {
    year = y
    const d = defaultDateFor(y)
    formFrom = d
    formTo = d
  }
  const goPrevYear = () => setYear(year - 1)
  const goNextYear = () => setYear(year + 1)
  const goCurrentYear = () => setYear(currentYear)

  /* — New-absence form state — */
  const todayIso = new Date().toISOString().slice(0, 10)
  /** Default-Datum für ein Zieljahr: heute, falls das aktuelle Jahr,
   * sonst der 1. Januar. */
  const defaultDateFor = (y: number): string =>
    y === currentYear ? todayIso : `${y}-01-01`
  let formType = $state<AbsenceType>('vacation')
  let formFrom = $state(todayIso)
  let formTo = $state(todayIso)
  let formHalfDay = $state(false)
  let formNotes = $state('')
  let formStatus = $state<AbsenceStatus>('approved')
  let formError = $state<string | null>(null)

  const reset = () => {
    formType = 'vacation'
    const d = defaultDateFor(year)
    formFrom = d
    formTo = d
    formHalfDay = false
    formNotes = ''
    formStatus = 'approved'
    formError = null
  }

  /** Parent hook: reset the form after a deferred create (e.g. once
   * the conflict modal was confirmed and the entry persisted). */
  export function resetForm(): void {
    reset()
  }

  /** Krankheit im Folgejahr nicht zulässig — auf Urlaub fallen, wenn
   * die Jahresauswahl in die Zukunft wandert. */
  $effect(() => {
    if (!sickAllowed && formType === 'sick') formType = 'vacation'
  })

  /** Wenn der User manuell ein Datum aus einem anderen Jahr wählt,
   * snappt die obere Jahresauswahl entsprechend mit — ohne die übrigen
   * Formularwerte anzufassen (Cross-Year-Bereiche bleiben erhalten). */
  const onDateChange = (val: string) => {
    const y = Number(val.slice(0, 4))
    if (Number.isFinite(y) && y !== year) year = y
  }

  /** Longest span a single entry may cover — mirrors the server. */
  const MAX_SPAN_DAYS = 366
  const DAY_MS = 24 * 60 * 60 * 1000

  /** Click-time validation with German messages — the submit button is
   * never disabled for invalid input (only `busy.active` may gate). */
  const validate = (): string | null => {
    if (!formFrom || !formTo) {
      return 'Bitte Von- und Bis-Datum angeben.'
    }
    if (formTo < formFrom) {
      return 'Bis-Datum darf nicht vor dem Von-Datum liegen.'
    }
    const span =
      Math.round(
        (Date.parse(`${formTo}T00:00:00Z`) -
          Date.parse(`${formFrom}T00:00:00Z`)) /
          DAY_MS
      ) + 1
    if (span > MAX_SPAN_DAYS) {
      return 'Der Zeitraum ist zu lang - bitte höchstens ein Jahr je Eintrag erfassen.'
    }
    if (formHalfDay && formFrom !== formTo) {
      return 'Ein halber Tag ist nur bei eintägigen Abwesenheiten möglich.'
    }
    if (formType === 'sick') {
      const fromY = Number(formFrom.slice(0, 4))
      const toY = Number(formTo.slice(0, 4))
      if (fromY > currentYear || toY > currentYear) {
        return 'Krankmeldungen für ein Folgejahr sind nicht zulässig - Urlaub kann vorausgeplant werden.'
      }
    }
    return null
  }

  const submit = async (ev: Event) => {
    ev.preventDefault()
    formError = validate()
    if (formError) return
    const notes = formNotes.trim()
    const ok = await onSubmit({
      type: formType,
      dateFrom: formFrom,
      dateTo: formTo,
      halfDay: formHalfDay,
      ...(notes ? { notes } : {}),
      status: formStatus
    })
    if (ok) reset()
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
  const fmtDays = (n: number) => n.toLocaleString('de-DE')

  const vacationTotal = $derived(
    absences
      .filter((a) => a.type === 'vacation')
      .reduce((s, a) => s + a.workdaysInYear, 0)
  )
  const sickTotal = $derived(
    absences
      .filter((a) => a.type === 'sick')
      .reduce((s, a) => s + a.workdaysInYear, 0)
  )
</script>

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
          {year}
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

    <!-- Resturlaub-Aufschlüsselung für das gewählte Jahr; Krankheits-
         tage laufen informativ nebenher (Spec: zählen nicht gegen den
         Urlaubsanspruch). -->
    <dl class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      <div>
        <dt class="text-base-content/60">Anspruch {balance.year}</dt>
        <dd class="font-semibold">{fmtDays(balance.entitled)} Tage</dd>
      </div>
      <div>
        <dt class="text-base-content/60">Genommen</dt>
        <dd class="font-semibold">{fmtDays(balance.used)} Tage</dd>
      </div>
      <div>
        <dt class="text-base-content/60">Resturlaub</dt>
        <dd class="font-semibold">{fmtDays(balance.remaining)} Tage</dd>
      </div>
      <div>
        <dt class="text-base-content/60">Krankheitstage</dt>
        <dd class="font-semibold">{fmtDays(sickTotal)} Tage</dd>
      </div>
    </dl>

    {#if yearReadOnly}
      <div class="alert alert-info py-2 text-sm">
        Vergangene Jahre sind schreibgeschützt.
      </div>
    {/if}

    {#if formError}
      <div class="alert alert-error" role="alert">
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
        class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]"
        novalidate
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
            bind:value={formFrom}
            onchange={(e) => onDateChange((e.target as HTMLInputElement).value)}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Bis</span>
          <input
            class="input input-bordered w-full"
            type="date"
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
        <label class="flex flex-col gap-1">
          <span class="label-text">Halbtags</span>
          <span class="flex h-10 items-center justify-center">
            <input
              type="checkbox"
              class="checkbox"
              bind:checked={formHalfDay}
            />
          </span>
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
        <label class="flex w-full flex-col gap-1 sm:col-span-full">
          <span class="label-text">Notiz (optional)</span>
          <input
            class="input input-bordered w-full"
            type="text"
            maxlength="500"
            placeholder="z. B. Fortbildung, AU liegt vor …"
            bind:value={formNotes}
          />
        </label>
      </form>
    {/if}

    {#if absences.length === 0}
      <p class="text-base-content/60 text-sm">
        Noch keine Abwesenheiten erfasst.
      </p>
    {:else}
      <div class="overflow-x-auto">
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
                <td>
                  <span class="inline-flex flex-wrap items-center gap-2">
                    {fmt(a.dateFrom)} - {fmt(a.dateTo)}
                    {#if a.halfDay}
                      <span class="badge badge-ghost badge-sm">halbtags</span>
                    {/if}
                    {#if a.notes}
                      <span
                        class="text-base-content/60 max-w-48 truncate text-xs"
                        title={a.notes}
                      >
                        {a.notes}
                      </span>
                    {/if}
                  </span>
                </td>
                <td class="text-right font-mono">{fmtDays(a.workdaysInYear)}</td
                >
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
                          onclick={() => onSetStatus(a.id, 'cancelled')}
                          disabled={busy.active}
                        >
                          Stornieren
                        </button>
                      {/if}
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs btn-square text-error"
                        onclick={() => onDelete(a.id)}
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
                Anspruch: {fmtDays(balance.entitled)} Tage · verbleibend
                <span class="font-semibold">{fmtDays(balance.remaining)}</span>
              </td>
              <td class="text-right font-mono">{fmtDays(vacationTotal)}</td>
              <td colspan="2"></td>
            </tr>
            <tr>
              <td>Krankheit gesamt</td>
              <td></td>
              <td class="text-right font-mono">{fmtDays(sickTotal)}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    {/if}
  </div>
</div>
