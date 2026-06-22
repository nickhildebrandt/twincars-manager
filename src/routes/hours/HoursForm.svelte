<script lang="ts">
  import { untrack } from 'svelte'
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import {
    pickCustomersRemote,
    pickDocumentsRemote,
    pickEmployeesRemote
  } from '../pickers.remote'

  type LinkKind = 'document' | 'customer' | 'task'

  type Initial = {
    employeeId?: string | null
    employeeLabel?: string | null
    date?: string | null
    hours?: number | string | null
    documentId?: string | null
    documentLabel?: string | null
    customerId?: string | null
    customerLabel?: string | null
    task?: string | null
    note?: string | null
  }

  export type HoursFormValues = {
    employeeId: string
    date: string
    hours: number
    documentId?: string | null
    customerId?: string | null
    task?: string
    note?: string
  }

  type Props = {
    initial?: Initial
    /**
     * `:write_own`-only callers: render the employee row as a fixed
     * read-only field showing the caller's name. The form still posts
     * `employeeId`, but the picker is hidden.
     */
    lockedEmployee?: { id: string; label: string } | null
    onSave: (values: HoursFormValues) => Promise<void> | void
    onCancel?: () => void
  }

  const {
    initial = {},
    lockedEmployee = null,
    onSave,
    onCancel
  }: Props = $props()

  const init = untrack(() => ({ ...initial }))
  const lockedSnapshot = untrack(() =>
    lockedEmployee ? { ...lockedEmployee } : null
  )

  const todayIso = (): string => new Date().toISOString().slice(0, 10)

  let employeeId = $state(lockedSnapshot?.id ?? init.employeeId ?? '')
  let employeeLabel = $state(lockedSnapshot?.label ?? init.employeeLabel ?? '')
  let date = $state(init.date ?? todayIso())
  let hours = $state<number>(init.hours != null ? Number(init.hours) : 1)

  // Initial link kind: derive from whichever field is set.
  const initialLink: LinkKind = init.documentId
    ? 'document'
    : init.customerId
      ? 'customer'
      : 'task'
  let linkKind = $state<LinkKind>(initialLink)

  let documentId = $state(init.documentId ?? '')
  let documentLabel = $state(init.documentLabel ?? '')
  let customerId = $state(init.customerId ?? '')
  let customerLabel = $state(init.customerLabel ?? '')
  let task = $state(init.task ?? '')
  let note = $state(init.note ?? '')

  let errorMsg = $state<string | null>(null)

  /** Submit button validity gate — mirrors the rules in `submit`. */
  const valid = $derived.by(() => {
    if (!employeeId) return false
    if (!date) return false
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return false
    if (linkKind === 'document' && !documentId) return false
    if (linkKind === 'customer' && !customerId) return false
    if (linkKind === 'task' && !task.trim()) return false
    return true
  })

  const searchEmployees = (params: { q: string; page: number; size: number }) =>
    pickEmployeesRemote({ ...params, size: params.size as 10 | 25 | 50 | 100 })

  const searchDocuments = (params: { q: string; page: number; size: number }) =>
    pickDocumentsRemote({ ...params, size: params.size as 10 | 25 | 50 | 100 })

  const searchCustomers = (params: { q: string; page: number; size: number }) =>
    pickCustomersRemote({ ...params, size: params.size as 10 | 25 | 50 | 100 })

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null

    if (!employeeId) {
      errorMsg = 'Bitte einen Mitarbeiter auswählen.'
      return
    }
    if (!date) {
      errorMsg = 'Bitte ein Datum eingeben.'
      return
    }
    if (!Number.isFinite(hours) || hours <= 0) {
      errorMsg = 'Bitte eine positive Stundenzahl eingeben.'
      return
    }
    if (hours > 24) {
      errorMsg = 'Maximal 24 Stunden pro Eintrag.'
      return
    }

    let docOut: string | null = null
    let custOut: string | null = null
    let taskOut: string | undefined = undefined

    if (linkKind === 'document') {
      if (!documentId) {
        errorMsg = 'Bitte einen Auftrag bzw. eine Rechnung auswählen.'
        return
      }
      docOut = documentId
    } else if (linkKind === 'customer') {
      if (!customerId) {
        errorMsg = 'Bitte einen Kunden auswählen.'
        return
      }
      custOut = customerId
    } else {
      const t = task.trim()
      if (!t) {
        errorMsg = 'Bitte eine Aufgabe eingeben.'
        return
      }
      taskOut = t
    }

    formDirty.clear()
    await onSave({
      employeeId,
      date,
      hours,
      documentId: docOut,
      customerId: custOut,
      task: taskOut,
      note: note.trim() ? note.trim() : undefined
    })
  }

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())
</script>

<form
  onsubmit={submit}
  oninput={markDirty}
  onchange={markDirty}
  class="card border-base-300 bg-base-100 border"
>
  <div class="card-body gap-4">
    {#if errorMsg}
      <div class="alert alert-error"><span>{errorMsg}</span></div>
    {/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Grunddaten</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex w-full flex-col gap-1 sm:col-span-2">
          <span class="label-text">Mitarbeiter *</span>
          {#if lockedEmployee}
            <input
              class="input input-bordered w-full"
              value={lockedEmployee.label}
              readonly
            />
          {:else}
            <SearchablePicker
              bind:value={employeeId}
              bind:valueLabel={employeeLabel}
              placeholder="— Mitarbeiter suchen und auswählen —"
              dialogTitle="Mitarbeiter auswählen"
              search={searchEmployees}
              onSelect={() => {}}
            />
          {/if}
        </label>

        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Datum *</span>
          <input
            type="date"
            class="input input-bordered w-full"
            bind:value={date}
          />
        </label>

        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Stunden *</span>
          <input
            type="number"
            class="input input-bordered w-full"
            min="0.25"
            max="24"
            step="0.25"
            bind:value={hours}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Verknüpfung</legend>
      <div class="flex flex-wrap gap-4">
        <label class="label cursor-pointer gap-2">
          <input
            type="radio"
            class="radio radio-sm"
            value="document"
            checked={linkKind === 'document'}
            onchange={() => (linkKind = 'document')}
          />
          <span class="label-text">Auftrag / Rechnung</span>
        </label>
        <label class="label cursor-pointer gap-2">
          <input
            type="radio"
            class="radio radio-sm"
            value="customer"
            checked={linkKind === 'customer'}
            onchange={() => (linkKind = 'customer')}
          />
          <span class="label-text">Kunde</span>
        </label>
        <label class="label cursor-pointer gap-2">
          <input
            type="radio"
            class="radio radio-sm"
            value="task"
            checked={linkKind === 'task'}
            onchange={() => (linkKind = 'task')}
          />
          <span class="label-text">Freie Aufgabe</span>
        </label>
      </div>

      <div class="mt-3">
        {#if linkKind === 'document'}
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Auftrag / Rechnung *</span>
            <SearchablePicker
              bind:value={documentId}
              bind:valueLabel={documentLabel}
              placeholder="— Beleg suchen und auswählen —"
              dialogTitle="Beleg auswählen"
              search={searchDocuments}
              onSelect={() => {}}
            />
          </label>
        {:else if linkKind === 'customer'}
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Kunde *</span>
            <SearchablePicker
              bind:value={customerId}
              bind:valueLabel={customerLabel}
              placeholder="— Kunde suchen und auswählen —"
              dialogTitle="Kunde auswählen"
              search={searchCustomers}
              onSelect={() => {}}
            />
          </label>
        {:else}
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Aufgabe *</span>
            <input
              class="input input-bordered w-full"
              maxlength="200"
              placeholder="z. B. Werkstattorganisation"
              bind:value={task}
            />
          </label>
        {/if}
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Notiz</legend>
      <textarea
        class="textarea textarea-bordered min-h-24 w-full"
        maxlength="2000"
        bind:value={note}
      ></textarea>
    </fieldset>

    <div class="card-actions justify-end gap-2">
      {#if onCancel}
        <button
          type="button"
          class="btn btn-ghost"
          onclick={onCancel}
          disabled={busy.active}>Abbrechen</button
        >
      {/if}
      <button
        type="submit"
        class="btn btn-primary"
        disabled={busy.active || !valid}
      >
        {#if busy.active}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Speichern
      </button>
    </div>
  </div>
</form>
