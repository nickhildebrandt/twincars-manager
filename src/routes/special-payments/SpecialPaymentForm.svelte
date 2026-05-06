<script lang="ts">
  import { untrack } from 'svelte'
  import { Plus, Search, X } from '@lucide/svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  type Initial = {
    label?: string
    kind?: 'one_time' | 'recurring'
    amount?: number | string
    startMonth?: string | null
    endMonth?: string | null
    targetAll?: boolean
    employeeIds?: string[]
    notes?: string | null
  }

  type Employee = { id: string; firstName: string; lastName: string }

  type Props = {
    initial?: Initial
    employees: Employee[]
    onSave: (values: SpecialPaymentValues) => Promise<void> | void
    onCancel?: () => void
  }

  export type SpecialPaymentValues = {
    label: string
    kind: 'one_time' | 'recurring'
    amount: number
    startMonth: string // YYYY-MM-01
    endMonth?: string
    targetAll: boolean
    employeeIds?: string[]
    notes?: string
  }

  const { initial = {}, employees, onSave, onCancel }: Props = $props()

  const init = untrack(() => {
    const todayMonth = new Date().toISOString().slice(0, 7) + '-01'
    const startIso = initial.startMonth
      ? initial.startMonth.slice(0, 7) + '-01'
      : todayMonth
    const endIso = initial.endMonth ? initial.endMonth.slice(0, 7) + '-01' : ''
    return {
      label: initial.label ?? '',
      kind: (initial.kind ?? 'one_time') as 'one_time' | 'recurring',
      amount:
        initial.amount === undefined || initial.amount === null
          ? ''
          : String(initial.amount),
      startMonth: startIso,
      endMonth: endIso,
      targetAll: initial.targetAll ?? true,
      employeeIds: new Set(initial.employeeIds ?? []),
      notes: initial.notes ?? ''
    }
  })

  let label = $state(init.label)
  let kind = $state(init.kind)
  let amount = $state<number | string>(init.amount)
  let startMonth = $state(init.startMonth)
  let endMonth = $state(init.endMonth)
  let targetAll = $state(init.targetAll)
  let employeeIds = $state<Set<string>>(init.employeeIds)
  let notes = $state(init.notes)
  let errorMsg = $state<string | null>(null)

  const toggle = (id: string) => {
    if (employeeIds.has(id)) employeeIds.delete(id)
    else employeeIds.add(id)
    employeeIds = new Set(employeeIds)
    formDirty.set(true)
  }

  /** Mitarbeiter-Picker-Dialog (Suche + Mehrfachauswahl). */
  let pickerOpen = $state(false)
  let pickerSearch = $state('')
  const filteredEmployees = $derived.by(() => {
    const q = pickerSearch.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((e) =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q)
    )
  })

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null
    if (!label.trim()) {
      errorMsg = 'Bitte eine Bezeichnung angeben.'
      return
    }
    const numAmount = Number(amount)
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      errorMsg = 'Bitte einen positiven Betrag angeben.'
      return
    }
    if (!targetAll && employeeIds.size === 0) {
      errorMsg = 'Bitte mindestens einen Mitarbeiter auswählen.'
      return
    }
    if (kind === 'recurring' && endMonth && endMonth < startMonth) {
      errorMsg = 'End-Monat darf nicht vor dem Start-Monat liegen.'
      return
    }

    formDirty.clear()
    await onSave({
      label: label.trim(),
      kind,
      amount: numAmount,
      startMonth,
      endMonth: kind === 'recurring' && endMonth ? endMonth : undefined,
      targetAll,
      employeeIds: targetAll ? undefined : Array.from(employeeIds),
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
  class="card border-base-300 bg-base-100 border"
>
  <div class="card-body gap-4">
    {#if errorMsg}
      <div class="alert alert-error"><span>{errorMsg}</span></div>
    {/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Sonderzahlung</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex w-full flex-col gap-1 sm:col-span-2">
          <span class="label-text">Bezeichnung *</span>
          <input
            class="input input-bordered w-full"
            maxlength="200"
            placeholder="z. B. Weihnachtsgeld 2026"
            bind:value={label}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Art *</span>
          <select class="select select-bordered w-full" bind:value={kind}>
            <option value="one_time">Einmalig</option>
            <option value="recurring">Wiederkehrend</option>
          </select>
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Betrag (€) *</span>
          <input
            class="input input-bordered w-full"
            type="number"
            step="0.01"
            min="0"
            bind:value={amount}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Zeitraum</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">
            {kind === 'one_time' ? 'Auszahlungs-Monat *' : 'Beginn (Monat) *'}
          </span>
          <input
            class="input input-bordered w-full"
            type="month"
            bind:value={startMonth}
          />
        </label>
        {#if kind === 'recurring'}
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Ende (optional)</span>
            <input
              class="input input-bordered w-full"
              type="month"
              bind:value={endMonth}
              placeholder="unbefristet"
            />
          </label>
        {/if}
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Empfänger</legend>
      <label class="label flex items-center gap-2">
        <input
          type="checkbox"
          class="checkbox checkbox-sm"
          bind:checked={targetAll}
        />
        <span class="label-text">Alle aktiven Mitarbeiter</span>
      </label>
      {#if !targetAll}
        <div class="mt-2 flex flex-col gap-2">
          <!-- Ausgewählte Mitarbeiter als Tags mit ×-Button. -->
          {#if employeeIds.size > 0}
            <div class="flex flex-wrap gap-1">
              {#each employees.filter( (e) => employeeIds.has(e.id) ) as emp (emp.id)}
                <span class="badge badge-primary gap-1 py-3">
                  {emp.firstName}
                  {emp.lastName}
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs btn-circle"
                    onclick={() => toggle(emp.id)}
                    aria-label="Mitarbeiter entfernen"
                  >
                    <X size={12} />
                  </button>
                </span>
              {/each}
            </div>
          {/if}
          <button
            type="button"
            class="btn btn-sm btn-outline gap-1 self-start"
            onclick={() => {
              pickerSearch = ''
              pickerOpen = true
            }}
          >
            <Plus size={14} />
            Mitarbeiter hinzufügen
          </button>
        </div>
      {/if}
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Notiz</legend>
      <textarea
        class="textarea textarea-bordered min-h-20 w-full"
        maxlength="2000"
        bind:value={notes}
      ></textarea>
    </fieldset>

    <div class="card-actions justify-end gap-2">
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
        Speichern
      </button>
    </div>
  </div>
</form>

<!--
  Mitarbeiter-Picker-Dialog. DaisyUI `modal` mit `modal-open`-Klasse,
  damit Open-/Close-Verhalten an `pickerOpen` gebunden bleibt — kein
  imperativer dialog.showModal()-Aufruf nötig.
-->
{#if pickerOpen}
  <div class="modal modal-open" role="dialog">
    <div class="modal-box max-w-md">
      <h3 class="text-base font-semibold">Mitarbeiter auswählen</h3>
      <div class="mt-3">
        <label class="input input-bordered input-sm flex items-center gap-2">
          <Search size={14} class="opacity-60" />
          <input
            type="search"
            class="grow"
            placeholder="Suche…"
            bind:value={pickerSearch}
          />
        </label>
      </div>
      <div class="border-base-300 mt-3 max-h-64 overflow-auto rounded border">
        {#if filteredEmployees.length === 0}
          <div class="text-base-content/60 px-3 py-6 text-center text-sm">
            Keine Mitarbeiter gefunden.
          </div>
        {:else}
          <ul class="divide-base-300 divide-y">
            {#each filteredEmployees as emp (emp.id)}
              <li>
                <label
                  class="hover:bg-base-200 flex cursor-pointer items-center gap-2 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    checked={employeeIds.has(emp.id)}
                    onchange={() => toggle(emp.id)}
                  />
                  <span class="text-sm">
                    {emp.firstName}
                    {emp.lastName}
                  </span>
                </label>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      <div class="modal-action">
        <span class="text-base-content/60 me-auto self-center text-xs">
          {employeeIds.size} ausgewählt
        </span>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          onclick={() => (pickerOpen = false)}
        >
          Schließen
        </button>
      </div>
    </div>
    <button
      type="button"
      class="modal-backdrop"
      onclick={() => (pickerOpen = false)}
      aria-label="Dialog schließen"
    ></button>
  </div>
{/if}
