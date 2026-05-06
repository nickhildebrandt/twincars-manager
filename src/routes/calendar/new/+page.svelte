<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import { Users2, ArrowRight } from '@lucide/svelte'
  import { createCalendarEntryRemote } from '../calendar.remote'
  import {
    pickCustomersRemote,
    pickVehiclesRemote,
    pickEmployeesRemote
  } from '../../pickers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  /**
   * Single calendar-entry form. The `kind` selector toggles between
   * the appointment branch (with Ganztägig opt-in toggle, status, and
   * customer/vehicle/employee links) and the closure branch (always
   * all-day, no status, no links). Both branches share title and
   * notes. Layout matches the customer/vehicle forms — one card,
   * fieldsets inside.
   *
   * Mitarbeiter-Urlaub und Krankheit *nicht* hier — die werden im
   * Mitarbeiterbereich gepflegt; ein Hinweisblock unten verlinkt
   * dorthin.
   */
  type Kind = 'appointment' | 'closure'
  let kind = $state<Kind>('appointment')

  // Default time range: next full hour, one hour long.
  const now = new Date()
  const start = new Date(now.getTime() + 60 * 60 * 1000)
  start.setMinutes(0, 0, 0)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const fmtLocalIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const todayIso = new Date().toISOString().slice(0, 10)

  let title = $state('')
  let allDay = $state(false)
  let startsAt = $state(fmtLocalIso(start))
  let endsAt = $state(fmtLocalIso(end))
  let dateFrom = $state(todayIso)
  let dateTo = $state(todayIso)
  let status = $state<'scheduled' | 'completed' | 'cancelled'>('scheduled')
  let customerId = $state('')
  let customerLabel = $state('')
  let vehicleId = $state('')
  let vehicleLabel = $state('')
  let employeeId = $state('')
  let employeeLabel = $state('')
  let notes = $state('')

  let errorMsg = $state<string | null>(null)

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
      if (new Date(endStr) <= new Date(startStr) && !allDay) {
        errorMsg = 'Endzeit muss nach Startzeit liegen.'
        return
      }
      if (allDay && endStr.slice(0, 10) < startStr.slice(0, 10)) {
        errorMsg = 'Bis-Datum darf nicht vor dem Von-Datum liegen.'
        return
      }
      try {
        formDirty.clear()
        await busy.run(() =>
          createCalendarEntryRemote({
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
          })
        )
        toast.success('Termin angelegt.')
        goto('/calendar')
      } catch (err) {
        handleClientError(err)
      }
      return
    }

    // kind === 'closure'
    if (dateTo < dateFrom) {
      errorMsg = 'Bis-Datum darf nicht vor dem Von-Datum liegen.'
      return
    }
    try {
      formDirty.clear()
      await busy.run(() =>
        createCalendarEntryRemote({
          kind: 'closure',
          title: title.trim(),
          startsAt: dateFrom,
          endsAt: dateTo,
          allDay: true,
          notes: notes.trim() || undefined
        })
      )
      toast.success('Betriebsschließung angelegt.')
      goto('/calendar')
    } catch (err) {
      handleClientError(err)
    }
  }

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())
</script>

<PageHeader title="Neuer Eintrag" back="/calendar" />

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
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Art *</span>
          <select class="select select-bordered w-full" bind:value={kind}>
            <option value="appointment">Termin</option>
            <option value="closure">Betriebsschließung</option>
          </select>
        </label>
        <label class="flex w-full flex-col gap-1 sm:col-span-2">
          <span class="label-text">Titel *</span>
          <input
            class="input input-bordered w-full"
            maxlength="200"
            placeholder={kind === 'closure'
              ? 'z. B. Betriebsurlaub Sommer'
              : 'z. B. Ölwechsel Müller'}
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
        <p class="text-base-content/60 text-sm">
          Mehrtägige Schließungen werden in einem Eintrag gespeichert. Die Tage
          erscheinen automatisch im Kalender und in den Konfliktwarnungen beim
          Anlegen neuer Termine.
        </p>
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

    <div class="card-actions justify-end gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        onclick={() => goto('/calendar')}
        disabled={busy.active}
      >
        Abbrechen
      </button>
      <button type="submit" class="btn btn-primary" disabled={busy.active}>
        {#if busy.active}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Speichern
      </button>
    </div>
  </div>
</form>

<!-- Hint card linking to the employees module for vacation / sick days. -->
<div class="alert alert-info mt-4">
  <Users2 size={20} />
  <div>
    <div class="font-medium">Urlaub oder Krankheit eintragen?</div>
    <div class="text-sm">
      Mitarbeiter-Abwesenheiten werden direkt im Mitarbeiter-Datenblatt gepflegt
      — sie erscheinen anschließend automatisch im Kalender.
    </div>
  </div>
  <a class="btn btn-sm gap-1" href="/employees">
    Zu den Mitarbeitern
    <ArrowRight size={14} />
  </a>
</div>
