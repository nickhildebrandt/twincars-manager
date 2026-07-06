<script lang="ts">
  import { goto } from '$app/navigation'
  import { Info } from '@lucide/svelte'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import VehicleForm, { type VehicleFormValues } from '../VehicleForm.svelte'
  import { createVehicleRemote } from '../vehicles.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { creationFlow } from '$lib/stores/creation-flow.svelte'
  import { vehiclePickerLabel } from '$lib/utils/picker-labels'

  /**
   * Flow-leaf mode: another form started a full-page vehicle creation
   * (creation-flow stack top is 'vehicle'). Saving then returns to the
   * origin page with the new vehicle auto-selected; cancelling returns
   * with the origin draft only.
   */
  const inFlow = $derived(creationFlow.top?.entity === 'vehicle')

  const handleSave = async (values: VehicleFormValues) => {
    try {
      const created = await busy.run(() => createVehicleRemote(values))
      toast.success('Fahrzeug angelegt.')
      if (creationFlow.top?.entity === 'vehicle') {
        const returnUrl = creationFlow.finish({
          id: created.id,
          label: vehiclePickerLabel(created)
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
<VehicleForm mode="customer" onSave={handleSave} onCancel={handleCancel} />
