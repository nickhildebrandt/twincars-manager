<script lang="ts" module>
  export type ShippingOptionFormValues = {
    name: string
    description?: string
    priceNet: string
    freeAboveNet?: string
    active: boolean
    sortOrder: number
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  type ShippingOption = {
    name?: string | null
    description?: string | null
    priceNet?: string | number | null
    freeAboveNet?: string | number | null
    active?: boolean | null
    sortOrder?: number | null
  }

  type Props = {
    initial?: ShippingOption
    onSave: (values: ShippingOptionFormValues) => Promise<void> | void
    onCancel?: () => void
  }

  const { initial = {}, onSave, onCancel }: Props = $props()

  /** Snapshot the initial prop once at mount — see CustomerForm for rationale. */
  const init = untrack(() => ({ ...initial }))

  /** Format a stored decimal-string / number as a German money string. */
  const toGerman = (v: string | number | null | undefined): string => {
    if (v === null || v === undefined || v === '') return ''
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n)) return ''
    return n.toFixed(2).replace('.', ',')
  }

  let name = $state(init.name ?? '')
  let description = $state(init.description ?? '')
  let priceNet = $state(toGerman(init.priceNet) || '0,00')
  let freeAboveNet = $state(toGerman(init.freeAboveNet))
  let active = $state(init.active ?? true)
  let sortOrder = $state<number | string>(init.sortOrder ?? 0)

  let errorMsg = $state<string | null>(null)

  /** Submit button validity gate — mirrors the rules in `submit`. */
  const valid = $derived.by(() => {
    if (!name.trim() || name.trim().length > 150) return false
    if (!/^\d+([,.]\d{1,2})?$/.test(priceNet.trim())) return false
    const free = freeAboveNet.trim()
    if (free !== '' && !/^\d+([,.]\d{1,2})?$/.test(free)) return false
    const sortNum =
      typeof sortOrder === 'number' ? sortOrder : Number(sortOrder)
    if (!Number.isInteger(sortNum) || sortNum < 0) return false
    return true
  })

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null
    if (!name.trim()) {
      errorMsg = 'Bitte einen Namen eingeben.'
      return
    }
    if (name.trim().length > 150) {
      errorMsg = 'Der Name darf maximal 150 Zeichen lang sein.'
      return
    }
    const priceTrimmed = priceNet.trim()
    if (!/^\d+([,.]\d{1,2})?$/.test(priceTrimmed)) {
      errorMsg = 'Bitte einen gültigen Preis eingeben (z. B. 6,90).'
      return
    }
    const freeTrimmed = freeAboveNet.trim()
    if (freeTrimmed !== '' && !/^\d+([,.]\d{1,2})?$/.test(freeTrimmed)) {
      errorMsg = 'Bitte einen gültigen Wert für „Frei ab Bestellwert" eingeben.'
      return
    }
    const sortNum =
      typeof sortOrder === 'number' ? sortOrder : Number(sortOrder)
    if (!Number.isInteger(sortNum) || sortNum < 0) {
      errorMsg = 'Reihenfolge muss eine ganze Zahl ≥ 0 sein.'
      return
    }
    formDirty.clear()
    await onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      priceNet: priceTrimmed,
      freeAboveNet: freeTrimmed === '' ? undefined : freeTrimmed,
      active,
      sortOrder: sortNum
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
      <legend class="fieldset-legend">Stammdaten</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex w-full flex-col gap-1 sm:col-span-2">
          <span class="label-text">Name *</span>
          <input
            class="input input-bordered w-full"
            maxlength="150"
            bind:value={name}
          />
        </label>
        <label class="flex w-full flex-col gap-1 sm:col-span-2">
          <span class="label-text">Beschreibung</span>
          <textarea
            class="textarea textarea-bordered min-h-24 w-full"
            maxlength="2000"
            bind:value={description}
          ></textarea>
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Konditionen</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Preis netto (EUR) *</span>
          <input
            class="input input-bordered w-full"
            inputmode="decimal"
            maxlength="16"
            bind:value={priceNet}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Frei ab Bestellwert netto (EUR)</span>
          <input
            class="input input-bordered w-full"
            inputmode="decimal"
            maxlength="16"
            placeholder="optional"
            bind:value={freeAboveNet}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Anzeige</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Reihenfolge</span>
          <input
            type="number"
            class="input input-bordered w-full"
            min="0"
            step="1"
            bind:value={sortOrder}
          />
        </label>
        <label class="flex cursor-pointer items-center gap-3 sm:mt-7">
          <input
            type="checkbox"
            class="checkbox checkbox-primary"
            bind:checked={active}
          />
          <span class="label-text">Aktiv</span>
        </label>
      </div>
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
