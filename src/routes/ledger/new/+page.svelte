<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import {
    createLedgerEntryRemote,
    listCategoriesRemote
  } from '../ledger.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const today = new Date().toISOString().slice(0, 10)

  let direction = $state<'income' | 'expense'>('expense')
  let entryDate = $state(today)
  let amountGross = $state<number | string>('')
  let taxRate = $state<number>(19)
  let categoryId = $state<string>('')
  let description = $state('')
  let paymentMethod = $state('')
  let paymentStatus = $state<'paid' | 'open' | 'partial'>('paid')

  let errorMsg = $state<string | null>(null)

  const cats = $derived(listCategoriesRemote({ direction }))
  const categories = $derived(cats.current ?? [])

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null
    if (!description.trim()) {
      errorMsg = 'Bitte eine Beschreibung eingeben.'
      return
    }
    if (amountGross === '' || Number(amountGross) <= 0) {
      errorMsg = 'Bitte einen Betrag größer 0 eingeben.'
      return
    }
    try {
      await busy.run(() =>
        createLedgerEntryRemote({
          direction,
          entryDate,
          amountGross: Number(amountGross),
          taxRate,
          categoryId: categoryId || undefined,
          description: description.trim(),
          paymentMethod: paymentMethod || undefined,
          paymentStatus
        })
      )
      toast.success('Buchung gespeichert.')
      goto('/ledger')
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="Neue Buchung anlegen"
  subtitle="Manuelle Ein- oder Ausgabe erfassen."
/>

<form onsubmit={submit} class="card border-base-300 bg-base-100 border">
  <div class="card-body gap-4">
    {#if errorMsg}<div class="alert alert-error"><span>{errorMsg}</span></div
      >{/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Buchungsdaten</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="form-control">
          <span class="label-text">Art</span>
          <select class="select select-bordered" bind:value={direction}>
            <option value="expense">Ausgabe</option>
            <option value="income">Einnahme</option>
          </select>
        </label>
        <label class="form-control">
          <span class="label-text">Datum *</span>
          <input
            class="input input-bordered"
            type="date"
            required
            bind:value={entryDate}
          />
        </label>
        <label class="form-control sm:col-span-2">
          <span class="label-text">Beschreibung *</span>
          <input
            class="input input-bordered"
            maxlength="500"
            bind:value={description}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Kategorie</span>
          <select class="select select-bordered" bind:value={categoryId}>
            <option value="">— wählen —</option>
            {#each categories as c (c.id)}
              <option value={c.id}>{c.name}</option>
            {/each}
          </select>
        </label>
        <label class="form-control">
          <span class="label-text">Steuersatz (%)</span>
          <select class="select select-bordered" bind:value={taxRate}>
            <option value={19}>19 %</option>
            <option value={7}>7 %</option>
            <option value={0}>0 %</option>
          </select>
        </label>
        <label class="form-control">
          <span class="label-text">Brutto (€) *</span>
          <input
            class="input input-bordered"
            type="number"
            min="0"
            step="0.01"
            required
            bind:value={amountGross}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Zahlungsart</span>
          <select class="select select-bordered" bind:value={paymentMethod}>
            <option value="">—</option>
            <option>Überweisung</option>
            <option>Bar</option>
            <option>Lastschrift</option>
            <option>Karte</option>
          </select>
        </label>
        <label class="form-control sm:col-span-2">
          <span class="label-text">Zahlungsstatus</span>
          <select class="select select-bordered" bind:value={paymentStatus}>
            <option value="paid">Bezahlt</option>
            <option value="open">Offen</option>
            <option value="partial">Teilweise gezahlt</option>
          </select>
        </label>
      </div>
    </fieldset>

    <div class="card-actions justify-end gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        onclick={() => goto('/ledger')}
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
