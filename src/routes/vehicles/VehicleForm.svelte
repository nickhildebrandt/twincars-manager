<script lang="ts">
  import { untrack } from 'svelte'
  import type { Vehicle } from '$lib/server/db/schema'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import { pickCustomersRemote } from '../pickers.remote'

  /**
   * Mode controls the customer-picker:
   *   - `'customer'`: picker is shown and **required**. Used on
   *     /vehicles/new — every customer-vehicle must have an owner.
   *   - `'stock'`: picker is hidden and customer is forced to null.
   *     Used on /inventory/new — stock vehicles are *for sale* and
   *     don't belong to anyone yet.
   *   - `'edit'`: picker shown, value seeded from `initial`, not
   *     required. Lets the user reassign or clear the owner during
   *     a vehicle edit. Default.
   */
  type Mode = 'customer' | 'stock' | 'edit'

  type Props = {
    /**
     * `Vehicle` ohne `licensePlate` — die zuletzt gültige Plate wird
     * separat als String mitgereicht, weil sie aus
     * `vehicle_license_plate_versions` stammt und nicht mehr Teil der
     * `vehicles`-Tabelle ist.
     */
    initial?: Partial<Vehicle> & { licensePlate?: string | null }
    mode?: Mode
    onSave: (values: VehicleFormValues) => Promise<void> | void
    onCancel?: () => void
  }

  export type VehicleFormValues = {
    customerId?: string
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

  /**
   * Read `initial` exactly once at component setup. `untrack` is the
   * documented Svelte 5 way to opt out of reactivity here — we deliberately
   * want the form to seed from the initial prop value, then become editable
   * state owned by this component.
   */
  const init = untrack(() => ({ ...initial }))

  let customerId = $state(init.customerId ?? '')
  let customerLabel = $state('')
  let make = $state(init.make ?? '')
  let model = $state(init.model ?? '')
  let licensePlate = $state(init.licensePlate ?? '')
  let vin = $state(init.vin ?? '')
  let firstRegistration = $state(init.firstRegistration ?? '')
  let mileageKm = $state<number | string>(init.mileageKm ?? '')
  let nextHu = $state(init.nextHu ?? '')
  let hsn = $state(init.hsn ?? '')
  let tsn = $state(init.tsn ?? '')
  let displacementCcm = $state<number | string>(init.displacementCcm ?? '')
  let powerKw = $state<number | string>(init.powerKw ?? '')
  let fuelType = $state(init.fuelType ?? '')
  let gearbox = $state(init.gearbox ?? '')
  let bodyType = $state(init.bodyType ?? '')
  let notes = $state(init.notes ?? '')

  let errorMsg = $state<string | null>(null)

  const trimOrUndef = (v: string) => {
    const t = v.trim()
    return t === '' ? undefined : t
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null
    if (!licensePlate.trim() && !vin.trim() && !make.trim() && !model.trim()) {
      errorMsg = 'Bitte mindestens Kennzeichen, FIN oder Marke/Modell angeben.'
      return
    }
    if (mode === 'customer' && !customerId) {
      errorMsg = 'Bitte einen Kunden auswählen.'
      return
    }
    // Stock-Vehicle: customerId hart auf undefined zwingen, egal was
    // im State ist (das kann passieren wenn dieselbe Form woanders
    // wiederverwendet wird).
    const resolvedCustomerId =
      mode === 'stock' ? undefined : customerId || undefined
    formDirty.clear()
    await onSave({
      customerId: resolvedCustomerId,
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
>
  <div class="card-body gap-4">
    {#if errorMsg}
      <div class="alert alert-error"><span>{errorMsg}</span></div>
    {/if}

    {#if mode !== 'stock'}
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Halter</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex w-full flex-col gap-1 sm:col-span-2">
            <span class="label-text">
              Kunde {mode === 'customer' ? '*' : ''}
            </span>
            <SearchablePicker
              bind:value={customerId}
              bind:valueLabel={customerLabel}
              placeholder="— Kunde wählen —"
              dialogTitle="Kunden auswählen"
              search={searchCustomers}
              onSelect={() => {}}
            />
          </div>
        </div>
      </fieldset>
    {/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Stammdaten</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Marke</span>
          <input
            class="input input-bordered w-full"
            maxlength="100"
            bind:value={make}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Modell</span>
          <input
            class="input input-bordered w-full"
            maxlength="150"
            bind:value={model}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Kennzeichen</span>
          <input
            class="input input-bordered w-full"
            maxlength="20"
            bind:value={licensePlate}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">FIN</span>
          <input
            class="input input-bordered w-full"
            maxlength="25"
            bind:value={vin}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Erstzulassung</span>
          <input
            class="input input-bordered w-full"
            type="date"
            bind:value={firstRegistration}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Kilometerstand</span>
          <input
            class="input input-bordered w-full"
            type="number"
            min="0"
            max="9999999"
            step="1"
            bind:value={mileageKm}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Nächste HU</span>
          <input
            class="input input-bordered w-full"
            type="date"
            bind:value={nextHu}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Technik</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">HSN</span>
          <input
            class="input input-bordered w-full"
            maxlength="10"
            bind:value={hsn}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">TSN</span>
          <input
            class="input input-bordered w-full"
            maxlength="10"
            bind:value={tsn}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Hubraum (ccm)</span>
          <input
            class="input input-bordered w-full"
            type="number"
            min="0"
            max="99999"
            step="1"
            bind:value={displacementCcm}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">kW</span>
          <input
            class="input input-bordered w-full"
            type="number"
            min="0"
            max="9999"
            step="1"
            bind:value={powerKw}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Kraftstoff</span>
          <select class="select select-bordered w-full" bind:value={fuelType}>
            <option value="">—</option>
            <option>Benzin</option>
            <option>Diesel</option>
            <option>Elektro</option>
            <option>Hybrid</option>
            <option>LPG</option>
          </select>
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Getriebe</span>
          <select class="select select-bordered w-full" bind:value={gearbox}>
            <option value="">—</option>
            <option>Schaltgetriebe</option>
            <option>Automatik</option>
          </select>
        </label>
        <label class="flex w-full flex-col gap-1 sm:col-span-3">
          <span class="label-text">Aufbau</span>
          <input
            class="input input-bordered w-full"
            maxlength="50"
            bind:value={bodyType}
          />
        </label>
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
      <button type="submit" class="btn btn-primary" disabled={busy.active}>
        {#if busy.active}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Speichern
      </button>
    </div>
  </div>
</form>
