<script lang="ts" module>
  import {
    check,
    maxLength,
    minLength,
    object,
    pipe,
    regex,
    string,
    trim,
    unknown
  } from 'valibot'

  export type ShippingOptionFormValues = {
    name: string
    description?: string
    priceNet: string
    freeAboveNet?: string
    active: boolean
    sortOrder: number
  }

  /** German money string: digits plus optional comma/dot and 1-2 decimals. */
  const moneyPattern = /^\d+([,.]\d{1,2})?$/

  /**
   * Client-side schema mirroring the rules previously enforced ad hoc
   * in `submit`: required name (max 150), a well-formed net price, an
   * optional well-formed free-shipping threshold and a non-negative
   * integer sort order.
   */
  const shippingOptionSchema = object({
    name: pipe(
      string(),
      trim(),
      minLength(1, 'Bitte einen Namen eingeben.'),
      maxLength(150, 'Der Name darf maximal 150 Zeichen lang sein.')
    ),
    priceNet: pipe(
      string(),
      trim(),
      regex(moneyPattern, 'Bitte einen gültigen Preis eingeben (z. B. 6,90).')
    ),
    freeAboveNet: pipe(
      string(),
      trim(),
      check(
        (v) => v === '' || moneyPattern.test(v),
        'Bitte einen gültigen Wert für „Frei ab Bestellwert" eingeben.'
      )
    ),
    sortOrder: pipe(
      unknown(),
      check((v) => {
        const n = typeof v === 'number' ? v : Number(v)
        return Number.isInteger(n) && n >= 0
      }, 'Reihenfolge muss eine ganze Zahl ≥ 0 sein.')
    )
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

  /**
   * Validation handle for the Submit button gate and the per-field
   * error display. Field errors only surface once the field was
   * touched (blur) or a submit was attempted.
   */
  const fv = useFormValidation(shippingOptionSchema, () => ({
    name,
    priceNet,
    freeAboveNet,
    sortOrder
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
    const priceTrimmed = priceNet.trim()
    const freeTrimmed = freeAboveNet.trim()
    const sortNum =
      typeof sortOrder === 'number' ? sortOrder : Number(sortOrder)
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
        <FormField
          label="Name"
          required
          colSpan="sm:col-span-2"
          error={wasTouched('name') ? err('name') : null}
        >
          <input
            class={validationClasses(err('name'), wasTouched('name'))}
            maxlength="150"
            bind:value={name}
            onblur={() => fv.markTouched('name')}
          />
        </FormField>
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
        <FormField
          label="Preis netto (EUR)"
          required
          error={wasTouched('priceNet') ? err('priceNet') : null}
        >
          <input
            class={validationClasses(err('priceNet'), wasTouched('priceNet'))}
            inputmode="decimal"
            maxlength="16"
            bind:value={priceNet}
            onblur={() => fv.markTouched('priceNet')}
          />
        </FormField>
        <FormField
          label="Frei ab Bestellwert netto (EUR)"
          error={wasTouched('freeAboveNet') ? err('freeAboveNet') : null}
        >
          <input
            class={validationClasses(
              err('freeAboveNet'),
              wasTouched('freeAboveNet')
            )}
            inputmode="decimal"
            maxlength="16"
            placeholder="optional"
            bind:value={freeAboveNet}
            onblur={() => fv.markTouched('freeAboveNet')}
          />
        </FormField>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Anzeige</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          label="Reihenfolge"
          error={wasTouched('sortOrder') ? err('sortOrder') : null}
        >
          <input
            type="number"
            class={validationClasses(err('sortOrder'), wasTouched('sortOrder'))}
            min="0"
            step="1"
            bind:value={sortOrder}
            onblur={() => fv.markTouched('sortOrder')}
          />
        </FormField>
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
