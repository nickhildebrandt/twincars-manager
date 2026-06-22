<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import {
    deleteLedgerEntryRemote,
    getLedgerEntryRemote,
    listCategoriesRemote,
    updateLedgerEntryRemote
  } from '../../ledger.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import { PAYMENT_METHODS, type PaymentMethod } from '$lib/payment-methods'
  import { Trash2 } from '@lucide/svelte'

  const id = untrack(() => page.params.id!)
  const entry = await getLedgerEntryRemote({ id })

  const init = untrack(() => ({
    direction: entry.direction as 'income' | 'expense',
    entryDate: entry.entryDate,
    amountGross: Number(entry.amountGross),
    taxRate: Number(entry.taxRate),
    categoryId: entry.categoryId ?? '',
    description: entry.description,
    paymentMethod: (entry.paymentMethod ?? '') as PaymentMethod | '',
    paymentStatus: (entry.paymentStatus ?? 'paid') as
      | 'paid'
      | 'open'
      | 'partial'
  }))

  let direction = $state(init.direction)
  let entryDate = $state(init.entryDate)
  let amountGross = $state<number | string>(init.amountGross)
  let taxRate = $state<number>(init.taxRate)
  let categoryId = $state<string>(init.categoryId)
  let description = $state(init.description)
  let paymentMethod = $state(init.paymentMethod)
  let paymentStatus = $state(init.paymentStatus)

  let errorMsg = $state<string | null>(null)

  /** Submit button validity gate — mirrors the rules in `submit`. */
  const valid = $derived(
    Boolean(description.trim()) && amountGross !== '' && Number(amountGross) > 0
  )

  const cats = $derived(listCategoriesRemote({ direction }))
  const categories = $derived(cats.current ?? [])

  /** Auto-Generierte Buchungen (source != manual) sind read-only. */
  const isManual = entry.source === 'manual'

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null
    if (!isManual) {
      errorMsg =
        'System-generierte Buchungen können nicht direkt bearbeitet werden.'
      return
    }
    if (!description.trim()) {
      errorMsg = 'Bitte eine Beschreibung eingeben.'
      return
    }
    if (amountGross === '' || Number(amountGross) <= 0) {
      errorMsg = 'Bitte einen Betrag größer 0 eingeben.'
      return
    }
    try {
      formDirty.clear()
      await busy.run(() =>
        updateLedgerEntryRemote({
          id,
          values: {
            direction,
            entryDate,
            amountGross: Number(amountGross),
            taxRate,
            categoryId: categoryId || undefined,
            description: description.trim(),
            paymentMethod: paymentMethod || undefined,
            paymentStatus
          }
        })
      )
      toast.success('Buchung gespeichert.')
      goto('/ledger')
    } catch (err) {
      handleClientError(err)
    }
  }

  let confirmOpen = $state(false)

  const remove = async () => {
    try {
      formDirty.clear()
      await busy.run(() => deleteLedgerEntryRemote({ id }))
      toast.success('Buchung gelöscht.')
      goto('/ledger')
    } catch (err) {
      handleClientError(err)
    }
  }

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())
</script>

<PageHeader title="Buchung bearbeiten" back="/ledger" />

{#if !isManual}
  <div class="alert alert-info mb-4">
    <span>
      Diese Buchung wurde vom System angelegt (Quelle:
      <span class="font-mono">{entry.source}</span>) und kann hier nur angesehen
      werden. Änderungen erfolgen am Ursprungsdokument.
    </span>
  </div>
{/if}

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

    <fieldset class="fieldset" disabled={!isManual}>
      <legend class="fieldset-legend">Buchungsdaten</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Art</span>
          <select class="select select-bordered w-full" bind:value={direction}>
            <option value="expense">Ausgabe</option>
            <option value="income">Einnahme</option>
          </select>
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Datum *</span>
          <input
            class="input input-bordered w-full"
            type="date"
            required
            bind:value={entryDate}
          />
        </label>
        <label class="flex w-full flex-col gap-1 sm:col-span-2">
          <span class="label-text">Beschreibung *</span>
          <input
            class="input input-bordered w-full"
            maxlength="500"
            bind:value={description}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Kategorie</span>
          <select class="select select-bordered w-full" bind:value={categoryId}>
            <option value="">— wählen —</option>
            {#each categories as c (c.id)}
              <option value={c.id}>{c.name}</option>
            {/each}
          </select>
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Steuersatz (%)</span>
          <select class="select select-bordered w-full" bind:value={taxRate}>
            <option value={19}>19 %</option>
            <option value={7}>7 %</option>
            <option value={0}>0 %</option>
          </select>
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Brutto (€) *</span>
          <input
            class="input input-bordered w-full"
            type="number"
            min="0"
            step="0.01"
            required
            bind:value={amountGross}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Zahlungsart</span>
          <select
            class="select select-bordered w-full"
            bind:value={paymentMethod}
          >
            <option value="">—</option>
            {#each PAYMENT_METHODS as method (method)}
              <option>{method}</option>
            {/each}
          </select>
        </label>
        <label class="flex w-full flex-col gap-1 sm:col-span-2">
          <span class="label-text">Zahlungsstatus</span>
          <select
            class="select select-bordered w-full"
            bind:value={paymentStatus}
          >
            <option value="paid">Bezahlt</option>
            <option value="open">Offen</option>
            <option value="partial">Teilweise gezahlt</option>
          </select>
        </label>
      </div>
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
          onclick={() => goto('/ledger')}
          disabled={busy.active}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={busy.active || !isManual || !valid}
        >
          Speichern
        </button>
      </div>
    </div>
  </div>
</form>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Buchung löschen?"
  message="Die Buchung wird unwiderruflich gelöscht."
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => {}}
/>
