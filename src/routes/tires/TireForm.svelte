<script lang="ts" module>
  import {
    check,
    minLength,
    object,
    pipe,
    string,
    trim,
    unknown
  } from 'valibot'

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
    notes?: string
  }

  /** True when the value is a finite number greater than zero. */
  const positiveNumber = (message: string) =>
    pipe(
      unknown(),
      check((v) => {
        const n = Number(v)
        return Number.isFinite(n) && n > 0
      }, message)
    )

  /** A single optional EU-label letter A-E (case-insensitive). */
  const labelLetter = pipe(
    string(),
    trim(),
    check(
      (v) => /^[A-E]?$/i.test(v),
      'Bitte einen einzelnen Buchstaben (A-E) angeben.'
    )
  )

  /**
   * Client-side schema mirroring the rules previously enforced ad hoc
   * in `submit`: brand + model + the size triple are required, EU-label
   * letters must be single letters. The server-side schema stays
   * authoritative.
   */
  const tireSchema = object({
    brand: pipe(string(), trim(), minLength(1, 'Bitte die Marke angeben.')),
    model: pipe(string(), trim(), minLength(1, 'Bitte das Modell angeben.')),
    width: positiveNumber('Bitte die Breite in mm angeben.'),
    aspectRatio: positiveNumber('Bitte den Querschnitt in % angeben.'),
    diameterInch: positiveNumber(
      'Bitte den Felgendurchmesser in Zoll angeben.'
    ),
    fuelEfficiency: labelLetter,
    wetGrip: labelLetter,
    noiseClass: labelLetter
  })
</script>

<script lang="ts">
  import { untrack } from 'svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import FormField from '$lib/components/ui/FormField.svelte'
  import {
    useFormValidation,
    validationClasses
  } from '$lib/utils/form-validation.svelte'

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
  let notes = $state(init.notes ?? '')

  let errorMsg = $state<string | null>(null)

  const u = (v: string) => (v.trim() === '' ? undefined : v.trim())
  const n = (v: number | string) => (v === '' ? undefined : Number(v))

  /**
   * Validation handle for the per-field error display — NOT for gating
   * the submit button (rule 1.1: always clickable except while busy).
   * Field errors only surface once the field was
   * touched (blur) or a submit was attempted; the server-side schema
   * stays authoritative.
   */
  const fv = useFormValidation(tireSchema, () => ({
    brand,
    model,
    width,
    aspectRatio,
    diameterInch,
    fuelEfficiency,
    wetGrip,
    noiseClass
  }))

  const err = (k: string): string | null =>
    (fv.errors as Record<string, string | null>)[k] ?? null
  const wasTouched = (k: string): boolean =>
    (fv.touched as Record<string, boolean>)[k] === true

  const submit = async (e: Event) => {
    e.preventDefault()
    fv.markAllTouched()
    if (!fv.valid) {
      const errs = fv.errors as Record<string, string | null>
      errorMsg =
        errs._form ??
        Object.values(errs).find((v) => v != null) ??
        'Bitte prüfen Sie Ihre Eingaben.'
      return
    }
    errorMsg = null
    const w = Number(width)
    const ar = Number(aspectRatio)
    const di = Number(diameterInch)
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
      notes: u(notes)
    })
  }

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())
</script>

<form
  onsubmit={submit}
  oninput={markDirty}
  onchange={markDirty}
  novalidate
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
        <FormField
          label="Marke"
          required
          error={wasTouched('brand') ? err('brand') : null}
        >
          <input
            class={validationClasses(err('brand'), wasTouched('brand'))}
            maxlength="80"
            bind:value={brand}
            onblur={() => fv.markTouched('brand')}
          />
        </FormField>
        <FormField
          label="Modell"
          required
          colSpan="sm:col-span-2"
          error={wasTouched('model') ? err('model') : null}
        >
          <input
            class={validationClasses(err('model'), wasTouched('model'))}
            maxlength="120"
            bind:value={model}
            onblur={() => fv.markTouched('model')}
          />
        </FormField>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Größe & Index</legend>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FormField
          label="Breite (mm)"
          required
          error={wasTouched('width') ? err('width') : null}
        >
          <input
            class={validationClasses(err('width'), wasTouched('width'))}
            type="number"
            min="50"
            max="500"
            bind:value={width}
            onblur={() => fv.markTouched('width')}
          />
        </FormField>
        <FormField
          label="Querschnitt (%)"
          required
          error={wasTouched('aspectRatio') ? err('aspectRatio') : null}
        >
          <input
            class={validationClasses(
              err('aspectRatio'),
              wasTouched('aspectRatio')
            )}
            type="number"
            min="10"
            max="100"
            bind:value={aspectRatio}
            onblur={() => fv.markTouched('aspectRatio')}
          />
        </FormField>
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
        <FormField
          label="Zoll"
          required
          error={wasTouched('diameterInch') ? err('diameterInch') : null}
        >
          <input
            class={validationClasses(
              err('diameterInch'),
              wasTouched('diameterInch')
            )}
            type="number"
            min="8"
            max="30"
            bind:value={diameterInch}
            onblur={() => fv.markTouched('diameterInch')}
          />
        </FormField>
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
        <FormField
          label="Kraftstoffeffizienz (A-E)"
          error={wasTouched('fuelEfficiency') ? err('fuelEfficiency') : null}
        >
          <input
            class={validationClasses(
              err('fuelEfficiency'),
              wasTouched('fuelEfficiency')
            )}
            maxlength="1"
            bind:value={fuelEfficiency}
            onblur={() => fv.markTouched('fuelEfficiency')}
          />
        </FormField>
        <FormField
          label="Nasshaftung (A-E)"
          error={wasTouched('wetGrip') ? err('wetGrip') : null}
        >
          <input
            class={validationClasses(err('wetGrip'), wasTouched('wetGrip'))}
            maxlength="1"
            bind:value={wetGrip}
            onblur={() => fv.markTouched('wetGrip')}
          />
        </FormField>
        <FormField
          label="Geräuschklasse (A-C)"
          error={wasTouched('noiseClass') ? err('noiseClass') : null}
        >
          <input
            class={validationClasses(
              err('noiseClass'),
              wasTouched('noiseClass')
            )}
            maxlength="1"
            bind:value={noiseClass}
            onblur={() => fv.markTouched('noiseClass')}
          />
        </FormField>
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
      <label class="label cursor-pointer justify-start gap-3">
        <input
          type="checkbox"
          class="checkbox checkbox-primary"
          bind:checked={onlineSellable}
        />
        <span>Online verkaufbar</span>
      </label>
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
      <button type="submit" class="btn btn-primary" disabled={busy.active}>
        {#if busy.active}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Speichern
      </button>
    </div>
  </div>
</form>
