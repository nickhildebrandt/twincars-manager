<script lang="ts">
  import { goto } from '$app/navigation'
  import { Info } from '@lucide/svelte'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import VehicleForm, { type VehicleFormValues } from '../VehicleForm.svelte'
  import { createVehicleRemote } from '../vehicles.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import { creationFlow } from '$lib/stores/creation-flow.svelte'
  import { vehiclePickerLabel } from '$lib/utils/picker-labels'

  /**
   * Flow-leaf mode: another form started a full-page vehicle creation
   * (creation-flow stack top is 'vehicle'). Saving then returns to the
   * origin page with the new vehicle auto-selected; cancelling returns
   * with the origin draft only.
   */
  const inFlow = $derived(creationFlow.top?.entity === 'vehicle')

  /**
   * Host-provided prefill: a host that already picked a customer hands
   * it over so the holder starts preselected. Snapshotted once at init
   * — the frame does not change while this leaf is open.
   */
  const leafInitial =
    creationFlow.top?.entity === 'vehicle'
      ? (creationFlow.top.leafInitial ?? null)
      : null

  const handleSave = async (values: VehicleFormValues) => {
    try {
      // customerLabel is a UI-only companion for the flow result below
      // — never sent to the server.
      const { customerLabel, ...payload } = values
      const created = await busy.run(() => createVehicleRemote(payload))
      // Saved — release the unsaved-changes guard before the goto
      // (§11: clear AFTER success, BEFORE navigating; the catch path
      // leaves the form dirty so cancel/navigation still warns).
      formDirty.clear()
      toast.success('Fahrzeug angelegt.')
      if (creationFlow.top?.entity === 'vehicle') {
        const returnUrl = creationFlow.finish({
          id: created.id,
          label: vehiclePickerLabel(created),
          // Hand the holder back so the host re-syncs its customer
          // picker when it differs (same rule as picking an existing
          // vehicle).
          holder: values.customerId
            ? { id: values.customerId, label: customerLabel ?? '' }
            : null
        })
        goto(returnUrl ?? `/vehicles/${created.id}`, { replaceState: true })
        return
      }
      goto(`/vehicles/${created.id}`, { replaceState: true })
    } catch (err) {
      handleClientError(err, 'Fahrzeug konnte nicht angelegt werden')
    }
  }

  const handleCancel = () => {
    if (creationFlow.top?.entity === 'vehicle') {
      const returnUrl = creationFlow.cancel()
      goto(returnUrl ?? '/vehicles')
      return
    }
    goto('/vehicles')
  }
</script>

<PageHeader
  title="Neues Fahrzeug anlegen"
  subtitle={'Kundenfahrzeug - Halter ist Pflicht. Für Verkaufsfahrzeuge ohne Halter siehe „Zu verkaufende Fahrzeuge“.'}
/>
{#if inFlow}
  <div class="alert alert-info mb-4">
    <Info size={16} />
    <span>
      Dieses Fahrzeug wird nach dem Speichern automatisch im vorherigen Formular
      ausgewählt.
    </span>
  </div>
{/if}
<VehicleForm
  mode="customer"
  initial={leafInitial
    ? {
        customerId: leafInitial.customerId,
        customerLabel: leafInitial.customerLabel
      }
    : {}}
  onSave={handleSave}
  onCancel={handleCancel}
/>
