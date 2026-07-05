<script lang="ts" module>
  import { check, object, pipe, string } from 'valibot'

  /**
   * Client-side quick-create rule: at least one identifying field must
   * be present. The message mirrors the full VehicleForm but the check
   * is limited to the fields this compact form offers (no FIN field).
   */
  const quickVehicleSchema = pipe(
    object({ licensePlate: string(), make: string(), model: string() }),
    check(
      (v) => Boolean(v.licensePlate.trim() || v.make.trim() || v.model.trim()),
      'Bitte mindestens Kennzeichen, FIN oder Marke/Modell angeben.'
    )
  )
</script>

<script lang="ts">
  /**
   * Compact inline vehicle creation for the SearchablePicker create
   * mode. The holder is fixed to the customer already chosen in the
   * surrounding CustomerVehiclePicker — shown read-only, never
   * editable here. The full vehicle form stays at /vehicles/new.
   */
  import { untrack } from 'svelte'
  import FormField from './FormField.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'
  import { handleClientError } from '$lib/utils/client-error'
  import { useFormValidation } from '$lib/utils/form-validation.svelte'
  import { vehiclePickerLabel } from '$lib/utils/picker-labels'

  type Props = {
    /** Holder the new vehicle is created for (already chosen). */
    customerId: string
    /** Display label of the holder, shown read-only. */
    customerLabel: string
    /** Search text the user had typed — prefills the license plate. */
    initialQuery?: string
    /** Called with the picker item after a successful create. */
    onCreated: (item: {
      id: string
      label: string
      customerId: string
      customerLabel: string
    }) => void
    /** Returns to the picker's search mode without creating. */
    onCancel: () => void
  }

  const {
    customerId,
    customerLabel,
    initialQuery = '',
    onCreated,
    onCancel
  }: Props = $props()

  // Snapshot: the prefill is deliberately taken once at mount.
  let licensePlate = $state(untrack(() => initialQuery))
  let make = $state('')
  let model = $state('')

  const fv = useFormValidation(quickVehicleSchema, () => ({
    licensePlate,
    make,
    model
  }))

  const rootError = $derived(
    (fv.errors as Record<string, string | null>)._form ?? null
  )
  const anyTouched = $derived(Object.values(fv.touched).some(Boolean))

  const trimOrUndef = (v: string) => {
    const t = v.trim()
    return t === '' ? undefined : t
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    fv.markAllTouched()
    if (!fv.valid) return
    try {
      const row = await busy.run(async () => {
        // Deliberately a dynamic import: every picker embeds this form,
        // and a static import would drag the vehicles remote module
        // into every consumer's graph (and force every component test
        // to mock it) even when the create flow is never used.
        const { createVehicleRemote } =
          await import('../../../routes/vehicles/vehicles.remote')
        return createVehicleRemote({
          customerId,
          licensePlate: trimOrUndef(licensePlate),
          make: trimOrUndef(make),
          model: trimOrUndef(model)
        })
      })
      toast.success('Fahrzeug angelegt.')
      onCreated({
        id: row.id,
        label: vehiclePickerLabel(row),
        customerId,
        customerLabel
      })
    } catch (err) {
      handleClientError(err, 'Fahrzeug konnte nicht angelegt werden')
    }
  }
</script>

<form class="flex flex-col gap-3 p-4" onsubmit={submit}>
  {#if rootError && anyTouched}
    <div class="alert alert-error"><span>{rootError}</span></div>
  {/if}

  <div class="text-base-content/70 text-sm">
    Halter: {customerLabel}
  </div>

  <FormField label="Kennzeichen">
    <input
      class="input input-bordered w-full"
      maxlength="20"
      bind:value={licensePlate}
      onblur={() => fv.markTouched('licensePlate')}
    />
  </FormField>
  <FormField label="Marke">
    <input
      class="input input-bordered w-full"
      maxlength="100"
      bind:value={make}
      onblur={() => fv.markTouched('make')}
    />
  </FormField>
  <FormField label="Modell">
    <input
      class="input input-bordered w-full"
      maxlength="150"
      bind:value={model}
      onblur={() => fv.markTouched('model')}
    />
  </FormField>

  <div class="flex justify-end gap-2">
    <button
      type="button"
      class="btn btn-ghost"
      onclick={onCancel}
      disabled={busy.active}
    >
      Abbrechen
    </button>
    <button
      type="submit"
      class="btn btn-primary"
      disabled={busy.active || !fv.valid}
    >
      {#if busy.active}
        <span class="loading loading-spinner loading-sm"></span>
      {/if}
      Fahrzeug anlegen
    </button>
  </div>
</form>
