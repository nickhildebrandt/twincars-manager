<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import { createAppointmentRemote } from '../appointments.remote'
  import {
    pickCustomersRemote,
    pickVehiclesRemote,
    pickEmployeesRemote
  } from '../../pickers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const now = new Date()
  const start = new Date(now.getTime() + 60 * 60 * 1000)
  start.setMinutes(0, 0, 0)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  const fmtLocalIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  let title = $state('')
  let customerId = $state('')
  let customerLabel = $state('')
  let vehicleId = $state('')
  let vehicleLabel = $state('')
  let employeeId = $state('')
  let employeeLabel = $state('')
  let startsAt = $state(fmtLocalIso(start))
  let endsAt = $state(fmtLocalIso(end))
  let notes = $state('')
  let status = $state<'scheduled' | 'completed' | 'cancelled'>('scheduled')

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
    if (new Date(endsAt) <= new Date(startsAt)) {
      errorMsg = 'Endzeit muss nach Startzeit liegen.'
      return
    }
    try {
      await busy.run(() =>
        createAppointmentRemote({
          title: title.trim(),
          customerId: customerId || undefined,
          vehicleId: vehicleId || undefined,
          employeeId: employeeId || undefined,
          startsAt,
          endsAt,
          notes: notes.trim() || undefined,
          status
        })
      )
      toast.success('Termin angelegt.')
      goto('/appointments')
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="Neuen Termin anlegen"
  subtitle="Werkstatt- oder Kundentermin anlegen."
/>

<form onsubmit={submit} class="card border-base-300 bg-base-100 border">
  <div class="card-body gap-4">
    {#if errorMsg}<div class="alert alert-error"><span>{errorMsg}</span></div
      >{/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Termin</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="form-control sm:col-span-2">
          <span class="label-text">Titel *</span>
          <input
            class="input input-bordered"
            maxlength="200"
            bind:value={title}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Beginn *</span>
          <input
            class="input input-bordered"
            type="datetime-local"
            bind:value={startsAt}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Ende *</span>
          <input
            class="input input-bordered"
            type="datetime-local"
            bind:value={endsAt}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Status</span>
          <select class="select select-bordered" bind:value={status}>
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
        <div class="form-control">
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
        <div class="form-control">
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
        <div class="form-control">
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

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Notiz</legend>
      <textarea
        class="textarea textarea-bordered min-h-24"
        maxlength="2000"
        bind:value={notes}
      ></textarea>
    </fieldset>

    <div class="card-actions justify-end gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        onclick={() => goto('/appointments')}
        disabled={busy.active}>Abbrechen</button
      >
      <button type="submit" class="btn btn-primary" disabled={busy.active}>
        {#if busy.active}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Speichern
      </button>
    </div>
  </div>
</form>
