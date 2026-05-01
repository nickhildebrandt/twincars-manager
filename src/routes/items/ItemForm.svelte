<script lang="ts">
  import { untrack } from 'svelte'

  type Item = {
    articleNumber?: string | null
    description?: string | null
    kind?: string | null
    unit?: string | null
    unitPriceNet?: string | number | null
    purchasePriceNet?: string | number | null
    stockOnHand?: number | null
    stockMin?: number | null
    stockMax?: number | null
    discontinued?: boolean | null
    notes?: string | null
  }

  type Props = {
    initial?: Item
    onSave: (values: ItemFormValues) => Promise<void> | void
    onCancel?: () => void
    busy?: boolean
  }

  export type ItemFormValues = {
    articleNumber?: string
    description: string
    kind: 'service' | 'material' | 'article' | 'pass_through'
    unit?: string
    unitPriceNet?: number
    purchasePriceNet?: number
    stockOnHand?: number
    stockMin?: number
    stockMax?: number
    discontinued?: 'true' | 'false'
    notes?: string
  }

  const { initial = {}, onSave, onCancel, busy = false }: Props = $props()

  /** Snapshot the initial prop once at mount — see CustomerForm for rationale. */
  const init = untrack(() => ({ ...initial }))

  let articleNumber = $state(init.articleNumber ?? '')
  let description = $state(init.description ?? '')
  let kind = $state<'service' | 'material' | 'article' | 'pass_through'>(
    (init.kind as 'service' | 'material' | 'article' | 'pass_through') ??
      'article'
  )
  let unit = $state(init.unit ?? 'Stk')
  let unitPriceNet = $state<number | string>(
    Number(init.unitPriceNet ?? '') || ''
  )
  let purchasePriceNet = $state<number | string>(
    Number(init.purchasePriceNet ?? '') || ''
  )
  let stockOnHand = $state<number | string>((init.stockOnHand as number) ?? 0)
  let stockMin = $state<number | string>((init.stockMin as number) ?? '')
  let stockMax = $state<number | string>((init.stockMax as number) ?? '')
  let discontinued = $state(Boolean(init.discontinued))
  let notes = $state(init.notes ?? '')

  let errorMsg = $state<string | null>(null)

  const u = (v: string) => (v.trim() === '' ? undefined : v.trim())
  const n = (v: number | string) => (v === '' ? undefined : Number(v))

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null
    if (!description.trim()) {
      errorMsg = 'Bitte eine Beschreibung eingeben.'
      return
    }
    await onSave({
      articleNumber: u(articleNumber),
      description: description.trim(),
      kind,
      unit: u(unit),
      unitPriceNet: n(unitPriceNet),
      purchasePriceNet: n(purchasePriceNet),
      stockOnHand: n(stockOnHand),
      stockMin: n(stockMin),
      stockMax: n(stockMax),
      discontinued: discontinued ? 'true' : 'false',
      notes: u(notes)
    })
  }
</script>

<form onsubmit={submit} class="card border-base-300 bg-base-100 border">
  <div class="card-body gap-4">
    {#if errorMsg}<div class="alert alert-error"><span>{errorMsg}</span></div
      >{/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Stammdaten</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="form-control">
          <span class="label-text">Art-Nr. (auto)</span>
          <input
            class="input input-bordered"
            maxlength="50"
            placeholder="auto"
            bind:value={articleNumber}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Typ</span>
          <select class="select select-bordered" bind:value={kind}>
            <option value="service">Leistung</option>
            <option value="material">Material</option>
            <option value="article">Artikel</option>
            <option value="pass_through">Durchlaufposten</option>
          </select>
        </label>
        <label class="form-control">
          <span class="label-text">Einheit</span>
          <input
            class="input input-bordered"
            maxlength="20"
            bind:value={unit}
          />
        </label>
        <label class="form-control sm:col-span-3">
          <span class="label-text">Beschreibung *</span>
          <input
            class="input input-bordered"
            maxlength="500"
            bind:value={description}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Preise</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="form-control">
          <span class="label-text">Einzelpreis netto (€)</span>
          <input
            class="input input-bordered"
            type="number"
            min="0"
            step="0.01"
            bind:value={unitPriceNet}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Einkaufspreis netto (€)</span>
          <input
            class="input input-bordered"
            type="number"
            min="0"
            step="0.01"
            bind:value={purchasePriceNet}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Lager</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="form-control">
          <span class="label-text">Bestand</span>
          <input
            class="input input-bordered"
            type="number"
            bind:value={stockOnHand}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Mindestbestand</span>
          <input
            class="input input-bordered"
            type="number"
            min="0"
            bind:value={stockMin}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Maximalbestand</span>
          <input
            class="input input-bordered"
            type="number"
            min="0"
            bind:value={stockMax}
          />
        </label>
        <label class="label cursor-pointer justify-start gap-3 sm:col-span-3">
          <input
            type="checkbox"
            class="checkbox checkbox-primary"
            bind:checked={discontinued}
          />
          <span>Auslaufartikel</span>
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
      {#if onCancel}<button
          type="button"
          class="btn btn-ghost"
          onclick={onCancel}
          disabled={busy}>Abbrechen</button
        >{/if}
      <button type="submit" class="btn btn-primary" disabled={busy}>
        {#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
        Speichern
      </button>
    </div>
  </div>
</form>
