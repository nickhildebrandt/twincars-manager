<script lang="ts" module>
  /**
   * ItemForm — Werkstattleistungen / Material / Artikel master form.
   *
   * Tires are no longer a kind here — the `tires` table has its own
   * module under `/tires`. The form intentionally stays minimal:
   * stammdaten, pricing, stock, free-form notes.
   */
  export type ItemFormValues = {
    articleNumber?: string
    description: string
    kind: 'service' | 'material' | 'article' | 'pass_through'
    unit?: string
    unitPriceNet?: number
    purchasePriceNet?: number
    stockOnHand?: number
    notes?: string
  }
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
  import { maxLength, minLength, object, pipe, string, trim } from 'valibot'

  type Item = {
    articleNumber?: string | null
    description?: string | null
    kind?: string | null
    unit?: string | null
    unitPriceNet?: string | number | null
    purchasePriceNet?: string | number | null
    stockOnHand?: number | null
    notes?: string | null
  }

  type Props = {
    initial?: Item
    onSave: (values: ItemFormValues) => Promise<void> | void
    onCancel?: () => void
  }

  const { initial = {}, onSave, onCancel }: Props = $props()

  const init = untrack(() => ({ ...initial }))

  let articleNumber = $state(init.articleNumber ?? '')
  let description = $state(init.description ?? '')
  let kind = $state<ItemFormValues['kind']>(
    (init.kind as ItemFormValues['kind']) ?? 'article'
  )
  let unit = $state(init.unit ?? 'Stk')
  let unitPriceNet = $state<number | string>(
    Number(init.unitPriceNet ?? '') || ''
  )
  let purchasePriceNet = $state<number | string>(
    Number(init.purchasePriceNet ?? '') || ''
  )
  let stockOnHand = $state<number | string>((init.stockOnHand as number) ?? 0)
  let notes = $state(init.notes ?? '')

  let errorMsg = $state<string | null>(null)

  const itemSchema = object({
    description: pipe(
      string('Bitte eine Beschreibung eingeben.'),
      trim(),
      minLength(1, 'Bitte eine Beschreibung eingeben.'),
      maxLength(500, 'Die Beschreibung darf maximal 500 Zeichen lang sein.')
    )
  })

  const fv = useFormValidation(itemSchema, () => ({ description }))
  const err = (k: string): string | null =>
    (fv.errors as Record<string, string | null>)[k] ?? null
  const wasTouched = (k: string): boolean =>
    (fv.touched as Record<string, boolean>)[k] === true

  const u = (v: string) => (v.trim() === '' ? undefined : v.trim())
  const n = (v: number | string) => (v === '' ? undefined : Number(v))

  const submit = async (e: Event) => {
    e.preventDefault()
    fv.markAllTouched()
    if (!fv.valid) {
      errorMsg =
        (Object.values(fv.errors).find((v) => v != null) as string | null) ??
        'Bitte prüfen Sie Ihre Eingabe.'
      return
    }
    errorMsg = null
    formDirty.clear()
    await onSave({
      articleNumber: u(articleNumber),
      description: description.trim(),
      kind,
      unit: u(unit),
      unitPriceNet: n(unitPriceNet),
      purchasePriceNet: n(purchasePriceNet),
      stockOnHand: n(stockOnHand),
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
  class="card border-base-300 bg-base-100 border"
>
  <div class="card-body gap-4">
    {#if errorMsg}<div class="alert alert-error"><span>{errorMsg}</span></div
      >{/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Stammdaten</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label="Art-Nr. (auto)">
          <input
            class="input input-bordered w-full"
            maxlength="50"
            placeholder="auto"
            bind:value={articleNumber}
          />
        </FormField>
        <FormField label="Typ">
          <select class="select select-bordered w-full" bind:value={kind}>
            <option value="service">Leistung</option>
            <option value="material">Material</option>
            <option value="article">Artikel</option>
            <option value="pass_through">Durchlaufposten</option>
          </select>
        </FormField>
        <FormField label="Einheit">
          <input
            class="input input-bordered w-full"
            maxlength="20"
            bind:value={unit}
          />
        </FormField>
        <FormField
          label="Beschreibung"
          required
          colSpan="sm:col-span-3"
          error={wasTouched('description') ? err('description') : null}
        >
          <input
            class={validationClasses(
              err('description'),
              wasTouched('description')
            )}
            maxlength="500"
            bind:value={description}
            onblur={() => fv.markTouched('description')}
          />
        </FormField>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Preise</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Einzelpreis netto (€)">
          <input
            class="input input-bordered w-full"
            type="number"
            min="0"
            step="0.01"
            bind:value={unitPriceNet}
          />
        </FormField>
        <FormField label="Einkaufspreis netto (€)">
          <input
            class="input input-bordered w-full"
            type="number"
            min="0"
            step="0.01"
            bind:value={purchasePriceNet}
          />
        </FormField>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Lager</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label="Bestand">
          <input
            class="input input-bordered w-full"
            type="number"
            bind:value={stockOnHand}
          />
        </FormField>
      </div>
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
        disabled={busy.active || !fv.valid}
      >
        {#if busy.active}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Speichern
      </button>
    </div>
  </div>
</form>
