<script lang="ts">
  import { untrack } from 'svelte'
  import type { Vehicle } from '$lib/server/db/schema'

  /**
   * Props for the vehicle form. `initial` is read once at mount time to seed
   * the editable state — subsequent prop changes do not reset the form.
   */
  type Props = {
    initial?: Partial<Vehicle>
    onSave: (values: VehicleFormValues) => Promise<void> | void
    onCancel?: () => void
    busy?: boolean
  }

  /**
   * Output of the vehicle form. Numeric fields use `string | number` while
   * editing because `<input type="number">` may briefly hold a non-numeric
   * intermediate value.
   */
  export type VehicleFormValues = {
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

  const { initial = {}, onSave, onCancel, busy = false }: Props = $props()

  /**
   * Read `initial` exactly once at component setup. `untrack` is the
   * documented Svelte 5 way to opt out of reactivity here — we deliberately
   * want the form to seed from the initial prop value, then become editable
   * state owned by this component.
   */
  const init = untrack(() => ({ ...initial }))

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
    await onSave({
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
</script>

<form onsubmit={submit} class="card border-base-300 bg-base-100 border">
  <div class="card-body gap-4">
    {#if errorMsg}
      <div class="alert alert-error"><span>{errorMsg}</span></div>
    {/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Stammdaten</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="form-control">
          <span class="label-text">Marke</span>
          <input
            class="input input-bordered"
            maxlength="100"
            bind:value={make}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Modell</span>
          <input
            class="input input-bordered"
            maxlength="150"
            bind:value={model}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Kennzeichen</span>
          <input
            class="input input-bordered"
            maxlength="20"
            bind:value={licensePlate}
          />
        </label>
        <label class="form-control">
          <span class="label-text">FIN</span>
          <input class="input input-bordered" maxlength="25" bind:value={vin} />
        </label>
        <label class="form-control">
          <span class="label-text">Erstzulassung</span>
          <input
            class="input input-bordered"
            type="date"
            bind:value={firstRegistration}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Kilometerstand</span>
          <input
            class="input input-bordered"
            type="number"
            min="0"
            max="9999999"
            step="1"
            bind:value={mileageKm}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Nächste HU</span>
          <input class="input input-bordered" type="date" bind:value={nextHu} />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Technik</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="form-control">
          <span class="label-text">HSN</span>
          <input class="input input-bordered" maxlength="10" bind:value={hsn} />
        </label>
        <label class="form-control">
          <span class="label-text">TSN</span>
          <input class="input input-bordered" maxlength="10" bind:value={tsn} />
        </label>
        <label class="form-control">
          <span class="label-text">Hubraum (ccm)</span>
          <input
            class="input input-bordered"
            type="number"
            min="0"
            max="99999"
            step="1"
            bind:value={displacementCcm}
          />
        </label>
        <label class="form-control">
          <span class="label-text">kW</span>
          <input
            class="input input-bordered"
            type="number"
            min="0"
            max="9999"
            step="1"
            bind:value={powerKw}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Kraftstoff</span>
          <select class="select select-bordered" bind:value={fuelType}>
            <option value="">—</option>
            <option>Benzin</option>
            <option>Diesel</option>
            <option>Elektro</option>
            <option>Hybrid</option>
            <option>LPG</option>
          </select>
        </label>
        <label class="form-control">
          <span class="label-text">Getriebe</span>
          <select class="select select-bordered" bind:value={gearbox}>
            <option value="">—</option>
            <option>Schaltgetriebe</option>
            <option>Automatik</option>
          </select>
        </label>
        <label class="form-control sm:col-span-3">
          <span class="label-text">Aufbau</span>
          <input
            class="input input-bordered"
            maxlength="50"
            bind:value={bodyType}
          />
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
      {#if onCancel}
        <button
          type="button"
          class="btn btn-ghost"
          onclick={onCancel}
          disabled={busy}>Abbrechen</button
        >
      {/if}
      <button type="submit" class="btn btn-primary" disabled={busy}>
        {#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
        Speichern
      </button>
    </div>
  </div>
</form>
