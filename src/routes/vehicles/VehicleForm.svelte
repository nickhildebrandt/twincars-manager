<script lang="ts" module>
  import { check, minLength, object, optional, pipe, string } from 'valibot'

  /**
   * Client-side schema mirroring the business rules previously enforced
   * ad hoc in `submit`: at least one of licensePlate / vin / make /
   * model must be present (root-level check, surfaces as `_form`), and
   * in `customer` mode a customer must be picked (per-field error).
   */
  const identifierMessage =
    'Bitte mindestens Kennzeichen, FIN oder Marke/Modell angeben.'

  const hasIdentifier = (v: {
    make: string
    model: string
    licensePlate: string
    vin: string
  }) =>
    Boolean(
      v.licensePlate.trim() || v.vin.trim() || v.make.trim() || v.model.trim()
    )

  const identifierShape = {
    make: string(),
    model: string(),
    licensePlate: string(),
    vin: string()
  }

  const customerModeSchema = pipe(
    object({
      ...identifierShape,
      customerId: pipe(string(), minLength(1, 'Bitte einen Kunden auswählen.'))
    }),
    // Inline param type: valibot's CheckAction is invariant in its
    // input, so the callback must name the full object incl. customerId.
    check(
      (v: { customerId: string } & Parameters<typeof hasIdentifier>[0]) =>
        hasIdentifier(v),
      identifierMessage
    )
  )

  const defaultModeSchema = pipe(
    object({ ...identifierShape, customerId: optional(string()) }),
    check(hasIdentifier, identifierMessage)
  )
</script>

<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import type { Vehicle } from '$lib/server/db/schema'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import { creationFlow, currentUrl } from '$lib/stores/creation-flow.svelte'
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import FormField from '$lib/components/ui/FormField.svelte'
  import { useFormValidation } from '$lib/utils/form-validation.svelte'
  import { pickCustomersRemote } from '../pickers.remote'

  /**
   * Mode controls the customer-picker:
   *   - `'customer'`: picker is shown and **required**. Used on
   *     /vehicles/new — every customer-vehicle must have an owner.
   *   - `'stock'`: picker is hidden and customer is forced to null.
   *     Used on /inventory/new — stock vehicles are *for sale* and
   *     don't belong to anyone yet. Shows the optional Vorbesitzer
   *     picker instead (the customer the car was bought from).
   *   - `'edit'`: picker shown, value seeded from `initial`, not
   *     required. Lets the user reassign or clear the owner during
   *     a vehicle edit. Also shows the optional Vorbesitzer picker.
   *     Default.
   */
  type Mode = 'customer' | 'stock' | 'edit'

  type Props = {
    initial?: Partial<Vehicle> & {
      licensePlate?: string | null
      /** Picker label of the current owner — seeds the customer picker
       *  in edit mode so an existing Halter renders with its name. */
      customerLabel?: string | null
      /** Picker label of the previous owner — seeds the Vorbesitzer
       *  picker in edit mode. */
      previousOwnerLabel?: string | null
    }
    mode?: Mode
    onSave: (values: VehicleFormValues) => Promise<void> | void
    onCancel?: () => void
  }

  export type VehicleFormValues = {
    customerId?: string
    /**
     * Picker label of the chosen holder — UI-only companion of
     * `customerId` so creation-flow leaves can hand the holder back to
     * their host form. Callers strip it before server calls (the
     * server schemas would ignore it anyway).
     */
    customerLabel?: string
    /**
     * Optional Vorbesitzer. `null` clears the relation (picker shown
     * but empty), `undefined` leaves it untouched (picker hidden in
     * customer mode).
     */
    previousOwnerCustomerId?: string | null
    /**
     * Ankauf data — only sent in stock mode. `purchaseDate` defaults
     * to today and triggers a `vehicle_purchases` history row on the
     * server; `purchasePrice` is the paid gross amount (optional,
     * recorded as 0,00 when unknown). Never blocks creation.
     */
    purchasePrice?: number
    purchaseDate?: string
    make?: string
    model?: string
    licensePlate?: string
    vin?: string
    firstRegistration?: string
    mileageKm?: number
    nextHu?: string
    hsn?: string
    tsn?: string
    displacementCcm?: number
    powerKw?: number
    colorCode?: string
    fuelType?: string
    gearbox?: string
    bodyType?: string
    notes?: string
  }

  const { initial = {}, mode = 'edit', onSave, onCancel }: Props = $props()

  const init = untrack(() => ({ ...initial }))

  /**
   * JSON-serializable snapshot of every form field — pushed into the
   * creation-flow store when the user jumps to a full-page create and
   * restored (below) when they come back.
   */
  type Draft = {
    customerId: string
    customerLabel: string
    previousOwnerCustomerId: string
    previousOwnerLabel: string
    purchasePrice: number | string
    purchaseDate: string
    make: string
    model: string
    licensePlate: string
    vin: string
    firstRegistration: string
    mileageKm: number | string
    nextHu: string
    hsn: string
    tsn: string
    displacementCcm: number | string
    powerKw: number | string
    fuelType: string
    gearbox: string
    bodyType: string
    notes: string
  }

  // Returning from a full-page create? Consume the pending return for
  // THIS page exactly once — its draft wins over `initial`.
  const pending = untrack(() => creationFlow.pendingReturnFor(currentUrl()))
  const draft = (pending?.draft ?? null) as Draft | null

  let customerId = $state(draft?.customerId ?? init.customerId ?? '')
  let customerLabel = $state(draft?.customerLabel ?? init.customerLabel ?? '')
  let previousOwnerCustomerId = $state(
    draft?.previousOwnerCustomerId ?? init.previousOwnerCustomerId ?? ''
  )
  let previousOwnerLabel = $state(
    draft?.previousOwnerLabel ?? init.previousOwnerLabel ?? ''
  )
  const todayIso = (): string => new Date().toISOString().slice(0, 10)
  /** Ankauf fields — rendered in stock mode only. */
  let purchasePrice = $state<number | string>(draft?.purchasePrice ?? '')
  let purchaseDate = $state(draft?.purchaseDate ?? todayIso())
  let make = $state(draft?.make ?? init.make ?? '')
  let model = $state(draft?.model ?? init.model ?? '')
  let licensePlate = $state(draft?.licensePlate ?? init.licensePlate ?? '')
  let vin = $state(draft?.vin ?? init.vin ?? '')
  let firstRegistration = $state(
    draft?.firstRegistration ?? init.firstRegistration ?? ''
  )
  let mileageKm = $state<number | string>(
    draft?.mileageKm ?? init.mileageKm ?? ''
  )
  let nextHu = $state(draft?.nextHu ?? init.nextHu ?? '')
  let hsn = $state(draft?.hsn ?? init.hsn ?? '')
  let tsn = $state(draft?.tsn ?? init.tsn ?? '')
  let displacementCcm = $state<number | string>(
    draft?.displacementCcm ?? init.displacementCcm ?? ''
  )
  let powerKw = $state<number | string>(draft?.powerKw ?? init.powerKw ?? '')
  let fuelType = $state(draft?.fuelType ?? init.fuelType ?? '')
  let gearbox = $state(draft?.gearbox ?? init.gearbox ?? '')
  let bodyType = $state(draft?.bodyType ?? init.bodyType ?? '')
  let notes = $state(draft?.notes ?? init.notes ?? '')

  // A successful create auto-selects the new entity in the picker
  // that started the flow.
  if (pending?.result && pending.originField === 'customerId') {
    customerId = pending.result.id
    customerLabel = pending.result.label
  }
  if (pending?.result && pending.originField === 'previousOwnerCustomerId') {
    previousOwnerCustomerId = pending.result.id
    previousOwnerLabel = pending.result.label
  }
  // A restored draft is unsaved user input — re-arm the leave guard.
  if (draft) untrack(() => formDirty.set(true))

  let errorMsg = $state<string | null>(null)

  const buildDraft = (): Draft => ({
    customerId,
    customerLabel,
    previousOwnerCustomerId,
    previousOwnerLabel,
    purchasePrice,
    purchaseDate,
    make,
    model,
    licensePlate,
    vin,
    firstRegistration,
    mileageKm,
    nextHu,
    hsn,
    tsn,
    displacementCcm,
    powerKw,
    fuelType,
    gearbox,
    bodyType,
    notes
  })

  /** Cycle guard: no customer create while one is already in flight. */
  const canCreateCustomer = $derived(
    !creationFlow.activeEntities().has('customer')
  )

  /**
   * Vorbesitzer is shown for stock vehicles and in edit mode. Edit
   * always shows it (instead of sniffing whether the vehicle is a
   * stock vehicle) — the field is optional either way and a customer
   * vehicle may legitimately carry the previous owner it was bought
   * from before it was sold.
   */
  const showPreviousOwner = $derived(mode !== 'customer')

  /**
   * Start the full-page customer creation flow for one of the two
   * customer pickers (Halter / Vorbesitzer). `originField` decides
   * which picker auto-selects the created customer on return.
   */
  const startCustomerCreateFor = (
    originField: 'customerId' | 'previousOwnerCustomerId'
  ) => {
    creationFlow.start({
      entity: 'customer',
      returnUrl: currentUrl(),
      originField,
      draft: buildDraft(),
      createdAt: Date.now()
    })
    // The draft carries the input — silence the unsaved-changes guard.
    formDirty.clear()
    goto('/customers/new')
  }

  /**
   * Validation handle for the Submit button gate and the per-field
   * error display. Field errors only surface once the field was
   * touched (blur / selection) or a submit was attempted.
   */
  const fv = useFormValidation(
    () => (mode === 'customer' ? customerModeSchema : defaultModeSchema),
    () => ({ customerId, make, model, licensePlate, vin })
  )

  const err = (k: string): string | null =>
    (fv.errors as Record<string, string | null>)[k] ?? null
  const wasTouched = (k: string): boolean =>
    (fv.touched as Record<string, boolean>)[k] === true

  const trimOrUndef = (v: string) => {
    const t = v.trim()
    return t === '' ? undefined : t
  }

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
    // Click-time check for the optional Ankaufspreis: an empty field
    // never blocks creation, but a garbled/negative value surfaces a
    // German error instead of a server 400.
    if (
      mode === 'stock' &&
      purchasePrice !== '' &&
      (!Number.isFinite(Number(purchasePrice)) || Number(purchasePrice) < 0)
    ) {
      errorMsg = 'Bitte einen gültigen Ankaufspreis (mindestens 0) eingeben.'
      return
    }
    errorMsg = null
    const resolvedCustomerId =
      mode === 'stock' ? undefined : customerId || undefined
    formDirty.clear()
    await onSave({
      customerId: resolvedCustomerId,
      customerLabel: resolvedCustomerId ? customerLabel : undefined,
      previousOwnerCustomerId: showPreviousOwner
        ? previousOwnerCustomerId || null
        : undefined,
      ...(mode === 'stock'
        ? {
            purchaseDate: purchaseDate || todayIso(),
            ...(purchasePrice !== ''
              ? { purchasePrice: Number(purchasePrice) }
              : {})
          }
        : {}),
      make: trimOrUndef(make),
      model: trimOrUndef(model),
      licensePlate: trimOrUndef(licensePlate),
      vin: trimOrUndef(vin),
      firstRegistration: trimOrUndef(firstRegistration),
      mileageKm: mileageKm === '' ? undefined : Number(mileageKm),
      nextHu: trimOrUndef(nextHu),
      hsn: trimOrUndef(hsn),
      tsn: trimOrUndef(tsn),
      displacementCcm:
        displacementCcm === '' ? undefined : Number(displacementCcm),
      powerKw: powerKw === '' ? undefined : Number(powerKw),
      fuelType: trimOrUndef(fuelType),
      gearbox: trimOrUndef(gearbox),
      bodyType: trimOrUndef(bodyType),
      notes: trimOrUndef(notes)
    })
  }

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())

  const searchCustomers = (params: { q: string; page: number; size: number }) =>
    pickCustomersRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
    }).run()
</script>

<form
  onsubmit={submit}
  oninput={markDirty}
  onchange={markDirty}
  class="card border-base-300 bg-base-100 border"
  novalidate
>
  <div class="card-body gap-4">
    {#if errorMsg}
      <div class="alert alert-error" role="alert"><span>{errorMsg}</span></div>
    {/if}

    {#if mode !== 'stock'}
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Halter</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Kunde"
            required={mode === 'customer'}
            colSpan="sm:col-span-2"
            error={wasTouched('customerId') ? err('customerId') : null}
          >
            <SearchablePicker
              bind:value={customerId}
              bind:valueLabel={customerLabel}
              placeholder="- Kunde wählen -"
              dialogTitle="Kunden auswählen"
              search={searchCustomers}
              onSelect={() => fv.markTouched('customerId')}
              createLabel={canCreateCustomer
                ? 'Neuen Kunden anlegen'
                : undefined}
              onCreateNew={canCreateCustomer
                ? () => startCustomerCreateFor('customerId')
                : undefined}
            />
          </FormField>
        </div>
      </fieldset>
    {/if}

    {#if showPreviousOwner}
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Vorbesitzer</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Kunde (optional)" colSpan="sm:col-span-2">
            <SearchablePicker
              bind:value={previousOwnerCustomerId}
              bind:valueLabel={previousOwnerLabel}
              placeholder="- Vorbesitzer wählen -"
              dialogTitle="Vorbesitzer auswählen"
              search={searchCustomers}
              onSelect={() => {}}
              createLabel={canCreateCustomer
                ? 'Neuen Kunden anlegen'
                : undefined}
              onCreateNew={canCreateCustomer
                ? () => startCustomerCreateFor('previousOwnerCustomerId')
                : undefined}
            />
          </FormField>
        </div>
      </fieldset>
    {/if}

    {#if mode === 'stock'}
      <!--
        Ankauf data for a fresh stock vehicle: both fields are
        optional and never block creation. The server writes a
        vehicle_purchases history row (price 0,00 when left empty,
        Vorbesitzer name snapshotted from the picker above).
      -->
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Ankauf</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Ankaufspreis (brutto, EUR, optional)">
            <input
              class="input input-bordered w-full"
              type="number"
              min="0"
              step="0.01"
              bind:value={purchasePrice}
            />
          </FormField>
          <FormField label="Ankaufsdatum">
            <input
              class="input input-bordered w-full"
              type="date"
              bind:value={purchaseDate}
            />
          </FormField>
        </div>
      </fieldset>
    {/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Stammdaten</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Marke">
          <input
            class="input input-bordered w-full"
            maxlength="100"
            bind:value={make}
          />
        </FormField>
        <FormField label="Modell">
          <input
            class="input input-bordered w-full"
            maxlength="150"
            bind:value={model}
          />
        </FormField>
        <FormField label="Kennzeichen">
          <input
            class="input input-bordered w-full"
            maxlength="20"
            bind:value={licensePlate}
          />
        </FormField>
        <FormField label="FIN">
          <input
            class="input input-bordered w-full"
            maxlength="25"
            bind:value={vin}
          />
        </FormField>
        <FormField label="Erstzulassung">
          <input
            class="input input-bordered w-full"
            type="date"
            bind:value={firstRegistration}
          />
        </FormField>
        <FormField label="Kilometerstand">
          <input
            class="input input-bordered w-full"
            type="number"
            min="0"
            max="9999999"
            step="1"
            bind:value={mileageKm}
          />
        </FormField>
        <FormField label="Nächste HU">
          <input
            class="input input-bordered w-full"
            type="date"
            bind:value={nextHu}
          />
        </FormField>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Technik</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label="HSN">
          <input
            class="input input-bordered w-full"
            maxlength="10"
            bind:value={hsn}
          />
        </FormField>
        <FormField label="TSN">
          <input
            class="input input-bordered w-full"
            maxlength="10"
            bind:value={tsn}
          />
        </FormField>
        <FormField label="Hubraum (ccm)">
          <input
            class="input input-bordered w-full"
            type="number"
            min="0"
            max="99999"
            step="1"
            bind:value={displacementCcm}
          />
        </FormField>
        <FormField label="kW">
          <input
            class="input input-bordered w-full"
            type="number"
            min="0"
            max="9999"
            step="1"
            bind:value={powerKw}
          />
        </FormField>
        <FormField label="Kraftstoff">
          <select class="select select-bordered w-full" bind:value={fuelType}>
            <option value="">-</option>
            <option>Benzin</option>
            <option>Diesel</option>
            <option>Elektro</option>
            <option>Hybrid</option>
            <option>LPG</option>
          </select>
        </FormField>
        <FormField label="Getriebe">
          <select class="select select-bordered w-full" bind:value={gearbox}>
            <option value="">-</option>
            <option>Schaltgetriebe</option>
            <option>Automatik</option>
          </select>
        </FormField>
        <FormField label="Aufbau" colSpan="sm:col-span-3">
          <input
            class="input input-bordered w-full"
            maxlength="50"
            bind:value={bodyType}
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
      <!--
        Rule 1.1: the submit button stays enabled (except while busy) —
        clicking it runs the validation, marks every field touched and
        surfaces the German error summary above the form.
      -->
      <button type="submit" class="btn btn-primary" disabled={busy.active}>
        {#if busy.active}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Speichern
      </button>
    </div>
  </div>
</form>
