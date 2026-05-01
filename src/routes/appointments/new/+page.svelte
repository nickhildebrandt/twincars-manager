<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import {
    createAppointmentRemote,
    getPickersRemote
  } from '../appointments.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  const now = new Date()
  const start = new Date(now.getTime() + 60 * 60 * 1000)
  start.setMinutes(0, 0, 0)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  const fmtLocalIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  let title = $state('')
  let customerId = $state('')
  let vehicleId = $state('')
  let employeeId = $state('')
  let startsAt = $state(fmtLocalIso(start))
  let endsAt = $state(fmtLocalIso(end))
  let notes = $state('')
  let status = $state<'scheduled' | 'completed' | 'cancelled'>('scheduled')

  let busy = $state(false)
  let errorMsg = $state<string | null>(null)

  const pickersQ = $derived(getPickersRemote())
  const pickers = $derived(
    pickersQ.current ?? { customers: [], vehicles: [], employees: [] }
  )

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
    busy = true
    try {
      await createAppointmentRemote({
        title: title.trim(),
        customerId: customerId || undefined,
        vehicleId: vehicleId || undefined,
        employeeId: employeeId || undefined,
        startsAt,
        endsAt,
        notes: notes.trim() || undefined,
        status
      })
      toast.success('Termin angelegt.')
      goto('/appointments')
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }
</script>

<PageHeader
  title="Neuer Termin"
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
        <label class="form-control">
          <span class="label-text">Kunde</span>
          <select class="select select-bordered" bind:value={customerId}>
            <option value="">— wählen —</option>
            {#each pickers.customers as c (c.id)}
              <option value={c.id}>{c.label}</option>
            {/each}
          </select>
        </label>
        <label class="form-control">
          <span class="label-text">Fahrzeug</span>
          <select class="select select-bordered" bind:value={vehicleId}>
            <option value="">— wählen —</option>
            {#each pickers.vehicles as v (v.id)}
              <option value={v.id}>{v.label}</option>
            {/each}
          </select>
        </label>
        <label class="form-control">
          <span class="label-text">Mitarbeiter</span>
          <select class="select select-bordered" bind:value={employeeId}>
            <option value="">— wählen —</option>
            {#each pickers.employees as e (e.id)}
              <option value={e.id}>{e.label}</option>
            {/each}
          </select>
        </label>
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
        disabled={busy}>Abbrechen</button
      >
      <button type="submit" class="btn btn-primary" disabled={busy}>
        {#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
        Speichern
      </button>
    </div>
  </div>
</form>
