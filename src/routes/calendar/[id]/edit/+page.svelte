<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Trash2 } from '@lucide/svelte'
  import {
    deleteCalendarEntryRemote,
    findOverlappingAppointmentsRemote,
    getCalendarEntryRemote,
    updateCalendarEntryRemote
  } from '../../calendar.remote'
  import {
    pickCustomersRemote,
    pickVehiclesRemote,
    pickEmployeesRemote
  } from '../../../pickers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  const id = untrack(() => page.params.id!)

  /**
   * Top-level await: SSR carries the entry, hydration reuses cache.
   * The form below seeds its state from `entry` once at mount via
   * `untrack` — same pattern as CustomerForm/VehicleForm.
   */
  const entry = await getCalendarEntryRemote({ id })

  /** Kind kann nicht nachträglich geändert werden (Server lehnt ab). */
  const kind = entry.kind as 'appointment' | 'closure'

  const fmtLocalIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  const init = untrack(() => {
    const start = new Date(entry.startsAt)
    const end = new Date(entry.endsAt)
    return {
      title: entry.title,
      allDay: entry.allDay,
      startsAt: entry.allDay
        ? start.toISOString().slice(0, 10)
        : fmtLocalIso(start),
      endsAt: entry.allDay ? end.toISOString().slice(0, 10) : fmtLocalIso(end),
      status: (entry.status ?? 'scheduled') as
        | 'scheduled'
        | 'completed'
        | 'cancelled',
      customerId: entry.customerId ?? '',
      vehicleId: entry.vehicleId ?? '',
      employeeId: entry.employeeId ?? '',
      notes: entry.notes ?? ''
    }
  })

  let title = $state(init.title)
  let allDay = $state(init.allDay)
  let startsAt = $state(init.startsAt)
  let endsAt = $state(init.endsAt)
  let status = $state(init.status)
  let customerId = $state(init.customerId)
  let customerLabel = $state('')
  let vehicleId = $state(init.vehicleId)
  let vehicleLabel = $state('')
  let employeeId = $state(init.employeeId)
  let employeeLabel = $state('')
  let notes = $state(init.notes)

  let errorMsg = $state<string | null>(null)

  /** Submit button validity gate — mirrors the rules in `submit`. */
  const valid = $derived.by(() => {
    if (!title.trim()) return false
    if (kind === 'appointment') {
      const startStr = allDay ? `${startsAt.slice(0, 10)}T00:00` : startsAt
      const endStr = allDay ? `${endsAt.slice(0, 10)}T00:00` : endsAt
      if (!allDay && new Date(endStr) <= new Date(startStr)) return false
      if (allDay && endStr.slice(0, 10) < startStr.slice(0, 10)) return false
    }
    return true
  })

  const searchCustomers = (params: { q: string; page: number; size: number }) =>
    pickCustomersRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
    }).run()
  const searchVehicles = (params: { q: string; page: number; size: number }) =>
    pickVehiclesRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
    }).run()
  const searchEmployees = (params: { q: string; page: number; size: number }) =>
    pickEmployeesRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
    }).run()

  /**
   * Same overlap-confirmation flow as on the new-appointment page —
   * exclude the current id so editing without moving the time window
   * doesn't trigger a self-collision warning.
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
    return `${f(s)} – ${f(e)}`
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

      const doSave = async () => {
        try {
          formDirty.clear()
          await busy.run(() =>
            updateCalendarEntryRemote({
              id,
              values: {
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
            })
          )
          toast.success('Termin gespeichert.')
          goto('/calendar')
        } catch (err) {
          handleClientError(err)
        }
      }

      try {
        const overlaps = await busy.run(() =>
          findOverlappingAppointmentsRemote({
            startsAt: startStr,
            endsAt: endStr,
            excludeId: id
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
    if (endsAt < startsAt) {
      errorMsg = 'Bis-Datum darf nicht vor dem Von-Datum liegen.'
      return
    }
    try {
      formDirty.clear()
      await busy.run(() =>
        updateCalendarEntryRemote({
          id,
          values: {
            kind: 'closure',
            title: title.trim(),
            startsAt,
            endsAt,
            allDay: true,
            notes: notes.trim() || undefined
          }
        })
      )
      toast.success('Betriebsschließung gespeichert.')
      goto('/calendar')
    } catch (err) {
      handleClientError(err)
    }
  }

  let confirmOpen = $state(false)

  const remove = async () => {
    try {
      formDirty.clear()
      await busy.run(() => deleteCalendarEntryRemote({ id }))
      toast.success('Eintrag gelöscht.')
      goto('/calendar')
    } catch (err) {
      handleClientError(err)
    }
  }

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())
</script>

<PageHeader
  title={kind === 'appointment'
    ? 'Termin bearbeiten'
    : 'Betriebsschließung bearbeiten'}
  back="/calendar"
/>

<form
  onsubmit={submit}
  oninput={markDirty}
  onchange={markDirty}
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
        <label class="flex w-full flex-col gap-1 sm:col-span-2">
          <span class="label-text">Titel *</span>
          <input
            class="input input-bordered w-full"
            maxlength="200"
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
        <div class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="flex w-full flex-col gap-1">
            <span class="label-text">Kunde</span>
            <SearchablePicker
              bind:value={customerId}
              bind:valueLabel={customerLabel}
              placeholder="— wählen —"
              dialogTitle="Kunden auswählen"
              search={searchCustomers}
              onSelect={() => {}}
            />
          </div>
          <div class="flex w-full flex-col gap-1">
            <span class="label-text">Fahrzeug</span>
            <SearchablePicker
              bind:value={vehicleId}
              bind:valueLabel={vehicleLabel}
              placeholder="— wählen —"
              dialogTitle="Fahrzeug auswählen"
              search={searchVehicles}
              onSelect={() => {}}
            />
          </div>
          <div class="flex w-full flex-col gap-1">
            <span class="label-text">Mitarbeiter</span>
            <SearchablePicker
              bind:value={employeeId}
              bind:valueLabel={employeeLabel}
              placeholder="— wählen —"
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
        <div class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Von *</span>
            <input
              class="input input-bordered w-full"
              type="date"
              required
              bind:value={startsAt}
            />
          </label>
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Bis *</span>
            <input
              class="input input-bordered w-full"
              type="date"
              required
              bind:value={endsAt}
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

    <div class="card-actions justify-between gap-2">
      <button
        type="button"
        class="btn btn-ghost text-error gap-1"
        onclick={() => (confirmOpen = true)}
        disabled={busy.active}
      >
        <Trash2 size={14} />
        Löschen
      </button>
      <div class="flex gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          onclick={() => goto('/calendar')}
          disabled={busy.active}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={busy.active || !valid}
        >
          Speichern
        </button>
      </div>
    </div>
  </div>
</form>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Eintrag löschen?"
  message="Der Eintrag wird unwiderruflich gelöscht."
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => {}}
/>

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
