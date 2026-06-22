<script lang="ts" module>
  /**
   * TireForm — master form for the dedicated `tires` table.
   *
   * Captures the full EU-Reifenkennzeichnung set: size triple
   * (width / aspectRatio / diameterInch) plus construction kind,
   * load + speed index, season, EU label letters, M+S / 3PMSF /
   * Run-Flat / Reinforced / EV flags, plus pricing + stock.
   */
  export type TireFormValues = {
    articleNumber?: string
    legacyArticleNumber?: string
    brand: string
    model: string
    width: number
    aspectRatio: number
    construction: 'R' | 'D'
    diameterInch: number
    loadIndex?: string
    speedIndex?: string
    season: 'Sommer' | 'Winter' | 'Ganzjahres'
    ean?: string
    manufacturerPartNumber?: string
    fuelEfficiency?: string
    wetGrip?: string
    noiseClass?: string
    noiseDb?: number
    runFlat?: boolean
    reinforced?: boolean
    studdedWinter?: boolean
    mSMarking?: boolean
    snowFlake?: boolean
    evCertified?: boolean
    description?: string
    purchasePriceNet?: number
    unitPriceNet?: number
    stockOnHand?: number
    onlineSellable?: boolean
    shippingOptionId?: string | null
    notes?: string
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import FormField from '$lib/components/ui/FormField.svelte'
  import { pickShippingOptionsRemote } from '../pickers.remote'

  type Tire = {
    articleNumber?: string | null
    legacyArticleNumber?: string | null
    brand?: string | null
    model?: string | null
    width?: number | null
    aspectRatio?: number | null
    construction?: string | null
    diameterInch?: number | null
    loadIndex?: string | null
    speedIndex?: string | null
    season?: string | null
    ean?: string | null
    manufacturerPartNumber?: string | null
    fuelEfficiency?: string | null
    wetGrip?: string | null
    noiseClass?: string | null
    noiseDb?: number | null
    runFlat?: boolean | null
    reinforced?: boolean | null
    studdedWinter?: boolean | null
    mSMarking?: boolean | null
    snowFlake?: boolean | null
    evCertified?: boolean | null
    description?: string | null
    purchasePriceNet?: string | number | null
    unitPriceNet?: string | number | null
    stockOnHand?: number | null
    onlineSellable?: boolean | null
    shippingOptionId?: string | null
    notes?: string | null
  }

  type Props = {
    initial?: Tire
    onSave: (values: TireFormValues) => Promise<void> | void
    onCancel?: () => void
  }

  const { initial = {}, onSave, onCancel }: Props = $props()

  /** Snapshot the initial prop once at mount. */
  const init = untrack(() => ({ ...initial }))

  let articleNumber = $state(init.articleNumber ?? '')
  let legacyArticleNumber = $state(init.legacyArticleNumber ?? '')
  let brand = $state(init.brand ?? '')
  let model = $state(init.model ?? '')
  let width = $state<number | string>((init.width as number) ?? '')
  let aspectRatio = $state<number | string>((init.aspectRatio as number) ?? '')
  let construction = $state<'R' | 'D'>((init.construction as 'R' | 'D') ?? 'R')
  let diameterInch = $state<number | string>(
    (init.diameterInch as number) ?? ''
  )
  let loadIndex = $state(init.loadIndex ?? '')
  let speedIndex = $state(init.speedIndex ?? '')
  let season = $state<'Sommer' | 'Winter' | 'Ganzjahres'>(
    (init.season as 'Sommer' | 'Winter' | 'Ganzjahres') ?? 'Sommer'
  )
  let ean = $state(init.ean ?? '')
  let manufacturerPartNumber = $state(init.manufacturerPartNumber ?? '')
  let fuelEfficiency = $state(init.fuelEfficiency ?? '')
  let wetGrip = $state(init.wetGrip ?? '')
  let noiseClass = $state(init.noiseClass ?? '')
  let noiseDb = $state<number | string>((init.noiseDb as number) ?? '')
  let runFlat = $state(Boolean(init.runFlat))
  let reinforced = $state(Boolean(init.reinforced))
  let studdedWinter = $state(Boolean(init.studdedWinter))
  let mSMarking = $state(Boolean(init.mSMarking))
  let snowFlake = $state(Boolean(init.snowFlake))
  let evCertified = $state(Boolean(init.evCertified))
  let description = $state(init.description ?? '')
  let purchasePriceNet = $state<number | string>(
    Number(init.purchasePriceNet ?? '') || ''
  )
  let unitPriceNet = $state<number | string>(
    Number(init.unitPriceNet ?? '') || ''
  )
  let stockOnHand = $state<number | string>((init.stockOnHand as number) ?? 0)
  let onlineSellable = $state(Boolean(init.onlineSellable))
  let shippingOptionId = $state(init.shippingOptionId ?? '')
  let shippingOptionLabel = $state('')
  let notes = $state(init.notes ?? '')

  let errorMsg = $state<string | null>(null)

  const u = (v: string) => (v.trim() === '' ? undefined : v.trim())
  const n = (v: number | string) => (v === '' ? undefined : Number(v))

  const LABEL_LETTERS = /^[A-E]?$/i

  /**
   * Pragmatic client-side validity gate for the Submit button. The same
   * rules are also re-checked in `submit` to produce a curated error
   * message for screen readers; the server-side schema is authoritative.
   */
  const valid = $derived.by(() => {
    if (!brand.trim()) return false
    if (!model.trim()) return false
    const w = Number(width)
    const ar = Number(aspectRatio)
    const di = Number(diameterInch)
    if (!Number.isFinite(w) || w <= 0) return false
    if (!Number.isFinite(ar) || ar <= 0) return false
    if (!Number.isFinite(di) || di <= 0) return false
    for (const value of [fuelEfficiency, wetGrip, noiseClass]) {
      if (value && !LABEL_LETTERS.test(value.trim())) return false
    }
    return true
  })

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null
    if (!brand.trim()) {
      errorMsg = 'Bitte die Marke angeben.'
      return
    }
    if (!model.trim()) {
      errorMsg = 'Bitte das Modell angeben.'
      return
    }
    const w = Number(width)
    const ar = Number(aspectRatio)
    const di = Number(diameterInch)
    if (!Number.isFinite(w) || w <= 0) {
      errorMsg = 'Bitte die Breite in mm angeben.'
      return
    }
    if (!Number.isFinite(ar) || ar <= 0) {
      errorMsg = 'Bitte den Querschnitt in % angeben.'
      return
    }
    if (!Number.isFinite(di) || di <= 0) {
      errorMsg = 'Bitte den Felgendurchmesser in Zoll angeben.'
      return
    }
    for (const [label, value] of [
      ['Kraftstoffeffizienz', fuelEfficiency],
      ['Nasshaftung', wetGrip],
      ['Geräuschklasse', noiseClass]
    ] as const) {
      if (value && !LABEL_LETTERS.test(value.trim())) {
        errorMsg = `${label}: bitte einen einzelnen Buchstaben (A–E) angeben.`
        return
      }
    }
    formDirty.clear()
    await onSave({
      articleNumber: u(articleNumber),
      legacyArticleNumber: u(legacyArticleNumber),
      brand: brand.trim(),
      model: model.trim(),
      width: w,
      aspectRatio: ar,
      construction,
      diameterInch: di,
      loadIndex: u(loadIndex),
      speedIndex: u(speedIndex),
      season,
      ean: u(ean),
      manufacturerPartNumber: u(manufacturerPartNumber),
      fuelEfficiency: u(fuelEfficiency)?.toUpperCase(),
      wetGrip: u(wetGrip)?.toUpperCase(),
      noiseClass: u(noiseClass)?.toUpperCase(),
      noiseDb: n(noiseDb),
      runFlat,
      reinforced,
      studdedWinter,
      mSMarking,
      snowFlake,
      evCertified,
      description: u(description),
      purchasePriceNet: n(purchasePriceNet),
      unitPriceNet: n(unitPriceNet),
      stockOnHand: n(stockOnHand),
      onlineSellable,
      shippingOptionId:
        onlineSellable && shippingOptionId ? shippingOptionId : null,
      notes: u(notes)
    })
  }

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())

  const searchShipping = (params: { q: string; page: number; size: number }) =>
    pickShippingOptionsRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
    }).run()
</script>

<form
  onsubmit={submit}
  oninput={markDirty}
  onchange={markDirty}
  class="card border-base-300 bg-base-100 border"
>
  <div class="card-body gap-4">
    {#if errorMsg}<div class="alert alert-error"><span>{errorMsg}</span></div
      >{/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Stammdaten</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Art-Nr. (auto)</span>
          <input
            class="input input-bordered w-full"
            maxlength="50"
            placeholder="auto"
            bind:value={articleNumber}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Alte Art-Nr.</span>
          <input
            class="input input-bordered w-full"
            maxlength="50"
            bind:value={legacyArticleNumber}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Saison *</span>
          <select class="select select-bordered w-full" bind:value={season}>
            <option value="Sommer">Sommer</option>
            <option value="Winter">Winter</option>
            <option value="Ganzjahres">Ganzjahres</option>
          </select>
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Marke *</span>
          <input
            class="input input-bordered w-full"
            maxlength="80"
            bind:value={brand}
          />
        </label>
        <label class="flex w-full flex-col gap-1 sm:col-span-2">
          <span class="label-text">Modell *</span>
          <input
            class="input input-bordered w-full"
            maxlength="120"
            bind:value={model}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Größe & Index</legend>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Breite (mm) *</span>
          <input
            class="input input-bordered w-full"
            type="number"
            min="50"
            max="500"
            bind:value={width}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Querschnitt (%) *</span>
          <input
            class="input input-bordered w-full"
            type="number"
            min="10"
            max="100"
            bind:value={aspectRatio}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Bauart</span>
          <select
            class="select select-bordered w-full"
            bind:value={construction}
          >
            <option value="R">R (Radial)</option>
            <option value="D">D (Diagonal)</option>
          </select>
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Zoll *</span>
          <input
            class="input input-bordered w-full"
            type="number"
            min="8"
            max="30"
            bind:value={diameterInch}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Lastindex</span>
          <input
            class="input input-bordered w-full"
            maxlength="10"
            placeholder="z. B. 91"
            bind:value={loadIndex}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Geschwindigkeitsindex</span>
          <input
            class="input input-bordered w-full"
            maxlength="5"
            placeholder="z. B. V"
            bind:value={speedIndex}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">EAN</span>
          <input
            class="input input-bordered w-full"
            maxlength="20"
            bind:value={ean}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Hersteller-Art-Nr.</span>
          <input
            class="input input-bordered w-full"
            maxlength="50"
            bind:value={manufacturerPartNumber}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">EU-Reifenlabel</legend>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Kraftstoffeffizienz (A–E)</span>
          <input
            class="input input-bordered w-full"
            maxlength="1"
            bind:value={fuelEfficiency}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Nasshaftung (A–E)</span>
          <input
            class="input input-bordered w-full"
            maxlength="1"
            bind:value={wetGrip}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Geräuschklasse (A–C)</span>
          <input
            class="input input-bordered w-full"
            maxlength="1"
            bind:value={noiseClass}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Geräusch (dB)</span>
          <input
            class="input input-bordered w-full"
            type="number"
            min="0"
            max="150"
            bind:value={noiseDb}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Eigenschaften</legend>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label class="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            class="checkbox checkbox-sm checkbox-primary"
            bind:checked={runFlat}
          />
          <span>Run-Flat (RFT/SSR)</span>
        </label>
        <label class="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            class="checkbox checkbox-sm checkbox-primary"
            bind:checked={reinforced}
          />
          <span>Verstärkt (XL/RF)</span>
        </label>
        <label class="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            class="checkbox checkbox-sm checkbox-primary"
            bind:checked={mSMarking}
          />
          <span>M+S</span>
        </label>
        <label class="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            class="checkbox checkbox-sm checkbox-primary"
            bind:checked={snowFlake}
          />
          <span>3PMSF (Schneeflocke)</span>
        </label>
        <label class="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            class="checkbox checkbox-sm checkbox-primary"
            bind:checked={studdedWinter}
          />
          <span>Spike-tauglich</span>
        </label>
        <label class="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            class="checkbox checkbox-sm checkbox-primary"
            bind:checked={evCertified}
          />
          <span>E-Fahrzeug-optimiert</span>
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Preise & Lager</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Einzelpreis netto (€)</span>
          <input
            class="input input-bordered w-full"
            type="number"
            min="0"
            step="0.01"
            bind:value={unitPriceNet}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Einkaufspreis netto (€)</span>
          <input
            class="input input-bordered w-full"
            type="number"
            min="0"
            step="0.01"
            bind:value={purchasePriceNet}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Bestand</span>
          <input
            class="input input-bordered w-full"
            type="number"
            bind:value={stockOnHand}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Online-Shop</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="label cursor-pointer justify-start gap-3 sm:col-span-2">
          <input
            type="checkbox"
            class="checkbox checkbox-primary"
            bind:checked={onlineSellable}
          />
          <span>Online verkaufbar</span>
        </label>
        {#if onlineSellable}
          <label class="flex w-full flex-col gap-1 sm:col-span-2">
            <span class="label-text">Versandoption</span>
            <SearchablePicker
              bind:value={shippingOptionId}
              bind:valueLabel={shippingOptionLabel}
              placeholder="— Versandoption wählen —"
              dialogTitle="Versandoption auswählen"
              search={searchShipping}
              onSelect={() => formDirty.set(true)}
            />
          </label>
        {/if}
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Beschreibung</legend>
      <textarea
        class="textarea textarea-bordered min-h-20 w-full"
        maxlength="1000"
        bind:value={description}
      ></textarea>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Notiz</legend>
      <textarea
        class="textarea textarea-bordered min-h-24 w-full"
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
