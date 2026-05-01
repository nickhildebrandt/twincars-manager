<script lang="ts">
  import type { Vehicle } from '$lib/server/db/schema'

  type Props = {
    initial?: Partial<Vehicle>
    onSave: (values: VehicleFormValues) => Promise<void> | void
    onCancel?: () => void
    busy?: boolean
  }

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

  let make = $state(initial.make ?? '')
  let model = $state(initial.model ?? '')
  let licensePlate = $state(initial.licensePlate ?? '')
  let vin = $state(initial.vin ?? '')
  let firstRegistration = $state(initial.firstRegistration ?? '')
  let mileageKm = $state<number | string>(initial.mileageKm ?? '')
  let nextHu = $state(initial.nextHu ?? '')
  let hsn = $state(initial.hsn ?? '')
  let tsn = $state(initial.tsn ?? '')
  let displacementCcm = $state<number | string>(initial.displacementCcm ?? '')
  let powerKw = $state<number | string>(initial.powerKw ?? '')
  let fuelType = $state(initial.fuelType ?? '')
  let gearbox = $state(initial.gearbox ?? '')
  let bodyType = $state(initial.bodyType ?? '')
  let notes = $state(initial.notes ?? '')

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
            bind:value={displacementCcm}
          />
        </label>
        <label class="form-control">
          <span class="label-text">kW</span>
          <input
            class="input input-bordered"
            type="number"
            min="0"
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
