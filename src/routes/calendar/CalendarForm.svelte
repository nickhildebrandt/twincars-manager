<script lang="ts" module>
  /** Payload the parent page sends to the create/update remote. */
  export type CalendarFormValues =
    | {
        kind: 'appointment'
        title: string
        startsAt: string
        endsAt: string
        allDay: boolean
        status: 'scheduled' | 'completed' | 'cancelled'
        customerId?: string
        vehicleId?: string
        employeeId?: string
        notes?: string
      }
    | {
        kind: 'closure'
        title: string
        startsAt: string
        endsAt: string
        allDay: true
        notes?: string
      }
</script>

<script lang="ts">
  import { untrack, type Snippet } from 'svelte'
  import { goto } from '$app/navigation'
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import CustomerVehiclePicker from '$lib/components/ui/CustomerVehiclePicker.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { findOverlappingAppointmentsRemote } from './calendar.remote'
  import { pickEmployeesRemote } from '../pickers.remote'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import { creationFlow, currentUrl } from '$lib/stores/creation-flow.svelte'

  /**
   * Shared calendar-entry form used by `/calendar/new` and
   * `/calendar/[id]/edit`. The `kind` selector toggles between the
   * appointment branch (with Ganztägig opt-in toggle, status, and
   * customer/vehicle/employee links) and the closure branch (always
   * all-day, no status, no links) — it is only offered in `new` mode;
   * the server rejects kind changes on update.
   *
   * The overlap-confirmation flow (warn, never refuse, when the time
   * window intersects another non-cancelled appointment) and the
   * click-time validation (rule 1.1: the submit button is never gated
   * on validity) live entirely inside this component. The
   * parent page owns the actual remote call (`onSave`), toast and
   * navigation; the edit page additionally passes its delete button
   * via the `deleteAction` snippet.
   *
   * Mitarbeiter-Urlaub und Krankheit *nicht* hier — die werden im
   * Mitarbeiterbereich gepflegt.
   */
  type Props = {
    mode: 'new' | 'edit'
    initial?: {
      id?: string
      kind: 'appointment' | 'closure'
      title: string
      allDay: boolean
      startsAt: Date | string
      endsAt: Date | string
      status?: string | null
      customerId?: string | null
      customerLabel?: string | null
      vehicleId?: string | null
      vehicleLabel?: string | null
      employeeId?: string | null
      employeeLabel?: string | null
      notes?: string | null
    }
    onSave: (values: CalendarFormValues) => Promise<void> | void
    onCancel?: () => void
    /** Rendered on the left of the action row (edit page: delete). */
    deleteAction?: Snippet
  }

  const { mode, initial, onSave, onCancel, deleteAction }: Props = $props()

  const fmtLocalIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  /**
   * Seed once at mount. New mode: next full hour, one hour long, both
   * closure dates today. Edit mode: from the loaded entry (all-day
   * entries carry plain dates, timed ones local datetime strings).
   */
  const init = untrack(() => {
    if (initial) {
      const start = new Date(initial.startsAt)
      const end = new Date(initial.endsAt)
      return {
        kind: initial.kind,
        title: initial.title,
        allDay: initial.allDay,
        startsAt: initial.allDay
          ? start.toISOString().slice(0, 10)
          : fmtLocalIso(start),
        endsAt: initial.allDay
          ? end.toISOString().slice(0, 10)
          : fmtLocalIso(end),
        dateFrom: start.toISOString().slice(0, 10),
        dateTo: end.toISOString().slice(0, 10),
        status: (initial.status ?? 'scheduled') as
          | 'scheduled'
          | 'completed'
          | 'cancelled',
        customerId: initial.customerId ?? '',
        customerLabel: initial.customerLabel ?? '',
        vehicleId: initial.vehicleId ?? '',
        vehicleLabel: initial.vehicleLabel ?? '',
        employeeId: initial.employeeId ?? '',
        employeeLabel: initial.employeeLabel ?? '',
        notes: initial.notes ?? ''
      }
    }
    const now = new Date()
    const start = new Date(now.getTime() + 60 * 60 * 1000)
    start.setMinutes(0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const todayIso = new Date().toISOString().slice(0, 10)
    return {
      kind: 'appointment' as const,
      title: '',
      allDay: false,
      startsAt: fmtLocalIso(start),
      endsAt: fmtLocalIso(end),
      dateFrom: todayIso,
      dateTo: todayIso,
      status: 'scheduled' as const,
      customerId: '',
      customerLabel: '',
      vehicleId: '',
      vehicleLabel: '',
      employeeId: '',
      employeeLabel: '',
      notes: ''
    }
  })

  /**
   * JSON-serializable snapshot of every form field — pushed into the
   * creation-flow store when the user jumps to a full-page create and
   * restored (below) when they come back. `returnUrl` distinguishes
   * `/calendar/new` from `/calendar/[id]/edit`, so both pages share
   * this host wiring.
   */
  type Draft = {
    kind: 'appointment' | 'closure'
    title: string
    allDay: boolean
    startsAt: string
    endsAt: string
    dateFrom: string
    dateTo: string
    status: 'scheduled' | 'completed' | 'cancelled'
    customerId: string
    customerLabel: string
    vehicleId: string
    vehicleLabel: string
    employeeId: string
    employeeLabel: string
    notes: string
  }

  // Returning from a full-page create? Consume the pending return for
  // THIS page exactly once — its draft wins over `initial`.
  const pending = untrack(() => creationFlow.pendingReturnFor(currentUrl()))
  const draft = (pending?.draft ?? null) as Draft | null

  let kind = $state<'appointment' | 'closure'>(draft?.kind ?? init.kind)
  let title = $state(draft?.title ?? init.title)
  let allDay = $state(draft?.allDay ?? init.allDay)
  let startsAt = $state(draft?.startsAt ?? init.startsAt)
  let endsAt = $state(draft?.endsAt ?? init.endsAt)
  let dateFrom = $state(draft?.dateFrom ?? init.dateFrom)
  let dateTo = $state(draft?.dateTo ?? init.dateTo)
  let status = $state(draft?.status ?? init.status)
  let customerId = $state(draft?.customerId ?? init.customerId)
  let customerLabel = $state(draft?.customerLabel ?? init.customerLabel)
  let vehicleId = $state(draft?.vehicleId ?? init.vehicleId)
  let vehicleLabel = $state(draft?.vehicleLabel ?? init.vehicleLabel)
  let employeeId = $state(draft?.employeeId ?? init.employeeId)
  let employeeLabel = $state(draft?.employeeLabel ?? init.employeeLabel)
  let notes = $state(draft?.notes ?? init.notes)

  // A successful create auto-selects the new entity in the picker
  // that started the flow.
  if (pending?.result) {
    if (pending.originField === 'customerId') {
      customerId = pending.result.id
      customerLabel = pending.result.label
    } else if (pending.originField === 'vehicleId') {
      vehicleId = pending.result.id
      vehicleLabel = pending.result.label
    }
  }
  // A restored draft is unsaved user input — re-arm the leave guard.
  if (draft) untrack(() => formDirty.set(true))

  let errorMsg = $state<string | null>(null)

  const buildDraft = (): Draft => ({
    kind,
    title,
    allDay,
    startsAt,
    endsAt,
    dateFrom,
    dateTo,
    status,
    customerId,
    customerLabel,
    vehicleId,
    vehicleLabel,
    employeeId,
    employeeLabel,
    notes
  })

  // Cycle guard: no create for an entity type already being created
  // somewhere in the active chain.
  const canCreateCustomer = $derived(
    !creationFlow.activeEntities().has('customer')
  )
  const canCreateVehicle = $derived(
    !creationFlow.activeEntities().has('vehicle')
  )

  const startCreate = (
    entity: 'customer' | 'vehicle',
    originField: string,
    target: string
  ) => {
    creationFlow.start({
      entity,
      returnUrl: currentUrl(),
      originField,
      draft: buildDraft(),
      createdAt: Date.now()
    })
    // The draft carries the input — silence the unsaved-changes guard.
    formDirty.clear()
    goto(target)
  }

  const searchEmployees = (params: { q: string; page: number; size: number }) =>
    pickEmployeesRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
    }).run()

  /**
   * Overlap-confirmation state. When the user submits an appointment
   * that intersects another non-cancelled appointment we open a
   * ConfirmDialog instead of saving straight away. `pendingSave` is
   * the closure that performs the actual save, captured at submit
   * time so we don't have to rebuild the payload after confirm. In
   * edit mode the current id is excluded so editing without moving
   * the time window doesn't trigger a self-collision warning.
   */
  let overlapOpen = $state(false)
  let overlapList = $state<
    Array<{ id: string; title: string; startsAt: Date; endsAt: Date }>
  >([])
  let pendingSave: (() => Promise<void>) | null = null

  const fmtRange = (s: Date, e: Date): string => {
    const f = (d: Date): string =>
      new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(d)
    return `${f(s)} bis ${f(e)}`
  }

  const overlapMessage = $derived.by(() => {
    if (overlapList.length === 0) return ''
    const lines = overlapList
      .map((o) => `  • ${o.title} (${fmtRange(o.startsAt, o.endsAt)})`)
      .join('\n')
    return `In diesem Zeitfenster gibt es bereits ${overlapList.length} Termin(e):\n${lines}\n\nTrotzdem speichern?`
  })

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null

    if (!title.trim()) {
      errorMsg = 'Bitte einen Titel angeben.'
      return
    }

    if (kind === 'appointment') {
      if (!startsAt || !endsAt) {
        errorMsg = 'Bitte Beginn und Ende angeben.'
        return
      }
      const startStr = allDay ? `${startsAt.slice(0, 10)}T00:00` : startsAt
      const endStr = allDay ? `${endsAt.slice(0, 10)}T00:00` : endsAt
      if (!allDay && new Date(endStr) <= new Date(startStr)) {
        errorMsg = 'Endzeit muss nach Startzeit liegen.'
        return
      }
      if (allDay && endStr.slice(0, 10) < startStr.slice(0, 10)) {
        errorMsg = 'Bis-Datum darf nicht vor dem Von-Datum liegen.'
        return
      }

      const values: CalendarFormValues = {
        kind: 'appointment',
        title: title.trim(),
        startsAt: startStr,
        endsAt: endStr,
        allDay,
        status,
        customerId: customerId || undefined,
        vehicleId: vehicleId || undefined,
        employeeId: employeeId || undefined,
        notes: notes.trim() || undefined
      }

      const doSave = async () => {
        formDirty.clear()
        await onSave(values)
      }

      // Overlap check is best-effort — if the lookup itself fails we
      // still let the user save (the warning is a courtesy, not a
      // hard gate; the server allows the double-booking anyway).
      try {
        const overlaps = await busy.run(() =>
          findOverlappingAppointmentsRemote({
            startsAt: startStr,
            endsAt: endStr,
            excludeId: initial?.id
          }).run()
        )
        if (overlaps.length > 0) {
          overlapList = overlaps.map((o) => ({
            id: o.id,
            title: o.title,
            startsAt: new Date(o.startsAt),
            endsAt: new Date(o.endsAt)
          }))
          pendingSave = doSave
          overlapOpen = true
          return
        }
      } catch {
        // Swallow — proceed to save without the warning.
      }

      await doSave()
      return
    }

    // kind === 'closure'
    if (!dateFrom || !dateTo) {
      errorMsg = 'Bitte Von- und Bis-Datum angeben.'
      return
    }
    if (dateTo < dateFrom) {
      errorMsg = 'Bis-Datum darf nicht vor dem Von-Datum liegen.'
      return
    }
    formDirty.clear()
    await onSave({
      kind: 'closure',
      title: title.trim(),
      startsAt: dateFrom,
      endsAt: dateTo,
      allDay: true,
      notes: notes.trim() || undefined
    })
  }

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())
</script>

<form
  onsubmit={submit}
  oninput={markDirty}
  onchange={markDirty}
  novalidate
  class="card border-base-300 bg-base-100 border"
>
  <div class="card-body gap-4">
    {#if errorMsg}
      <div class="alert alert-error">
        <span>{errorMsg}</span>
      </div>
    {/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Eintrag</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {#if mode === 'new'}
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Art *</span>
            <select class="select select-bordered w-full" bind:value={kind}>
              <option value="appointment">Termin</option>
              <option value="closure">Betriebsschließung</option>
            </select>
          </label>
        {/if}
        <label class="flex w-full flex-col gap-1 sm:col-span-2">
          <span class="label-text">Titel *</span>
          <input
            class="input input-bordered w-full"
            maxlength="200"
            placeholder={mode === 'new'
              ? kind === 'closure'
                ? 'z. B. Betriebsurlaub Sommer'
                : 'z. B. Ölwechsel Müller'
              : undefined}
            bind:value={title}
          />
        </label>
      </div>
    </fieldset>

    {#if kind === 'appointment'}
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Zeitraum</legend>
        <label class="label flex w-full items-center gap-2">
          <input
            type="checkbox"
            class="checkbox checkbox-sm"
            bind:checked={allDay}
          />
          <span class="label-text">Ganztägig</span>
        </label>
        <div class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Beginn *</span>
            {#if allDay}
              <input
                class="input input-bordered w-full"
                type="date"
                bind:value={startsAt}
              />
            {:else}
              <input
                class="input input-bordered w-full"
                type="datetime-local"
                bind:value={startsAt}
              />
            {/if}
          </label>
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Ende *</span>
            {#if allDay}
              <input
                class="input input-bordered w-full"
                type="date"
                bind:value={endsAt}
              />
            {:else}
              <input
                class="input input-bordered w-full"
                type="datetime-local"
                bind:value={endsAt}
              />
            {/if}
          </label>
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Status</span>
            <select class="select select-bordered w-full" bind:value={status}>
              <option value="scheduled">Geplant</option>
              <option value="completed">Abgeschlossen</option>
              <option value="cancelled">Abgesagt</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">Verknüpfungen</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CustomerVehiclePicker
            bind:customerId
            bind:customerLabel
            bind:vehicleId
            bind:vehicleLabel
            onChange={markDirty}
            onCreateCustomer={canCreateCustomer
              ? () => startCreate('customer', 'customerId', '/customers/new')
              : undefined}
            onCreateVehicle={canCreateVehicle
              ? () => startCreate('vehicle', 'vehicleId', '/vehicles/new')
              : undefined}
          />
          <div class="flex w-full flex-col gap-1">
            <span class="label-text">Mitarbeiter</span>
            <SearchablePicker
              bind:value={employeeId}
              bind:valueLabel={employeeLabel}
              dialogTitle="Mitarbeiter auswählen"
              search={searchEmployees}
              onSelect={() => {}}
            />
          </div>
        </div>
      </fieldset>
    {:else}
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Zeitraum</legend>
        {#if mode === 'new'}
          <p class="text-base-content/60 text-sm">
            Mehrtägige Schließungen werden in einem Eintrag gespeichert. Die
            Tage erscheinen automatisch im Kalender und in den Konfliktwarnungen
            beim Anlegen neuer Termine.
          </p>
        {/if}
        <div class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Von *</span>
            <input
              class="input input-bordered w-full"
              type="date"
              required
              bind:value={dateFrom}
            />
          </label>
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Bis *</span>
            <input
              class="input input-bordered w-full"
              type="date"
              required
              bind:value={dateTo}
            />
          </label>
        </div>
      </fieldset>
    {/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Notiz</legend>
      <textarea
        class="textarea textarea-bordered min-h-24 w-full"
        maxlength="2000"
        bind:value={notes}
      ></textarea>
    </fieldset>

    <div
      class="card-actions gap-2 {deleteAction
        ? 'justify-between'
        : 'justify-end'}"
    >
      {#if deleteAction}
        {@render deleteAction()}
      {/if}
      <div class="flex gap-2">
        {#if onCancel}
          <button
            type="button"
            class="btn btn-ghost"
            onclick={onCancel}
            disabled={busy.active}
          >
            Abbrechen
          </button>
        {/if}
        <button type="submit" class="btn btn-primary" disabled={busy.active}>
          {#if busy.active}
            <span class="loading loading-spinner loading-sm"></span>
          {/if}
          Speichern
        </button>
      </div>
    </div>
  </div>
</form>

<ConfirmDialog
  bind:open={overlapOpen}
  title="Terminkollision"
  message={overlapMessage}
  confirmLabel="Trotzdem speichern"
  cancelLabel="Abbrechen"
  variant="primary"
  onConfirm={async () => {
    const fn = pendingSave
    pendingSave = null
    if (fn) await fn()
  }}
  onClose={() => {
    pendingSave = null
  }}
/>
