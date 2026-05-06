<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import VehicleForm, {
    type VehicleFormValues
  } from '../../vehicles/VehicleForm.svelte'
  import { createVehicleRemote } from '../../vehicles/vehicles.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  /**
   * Stock-Vehicle-Anlage. Nutzt dieselbe `VehicleForm` wie das
   * Kunden-Anlage-Pendant unter `/vehicles/new`, aber mit
   * `mode="stock"` — dadurch wird der Halter-Picker ausgeblendet
   * und `customerId` server-seitig zwingend `null`. So kann ein
   * Fahrzeug, das hier angelegt wird, nicht versehentlich als
   * Kundenfahrzeug enden.
   */
  const handleSave = async (values: VehicleFormValues) => {
    try {
      const created = await busy.run(() => createVehicleRemote(values))
      toast.success('Verkaufsfahrzeug angelegt.')
      goto(`/vehicles/${created.id}`, { replaceState: true })
    } catch (err) {
      handleClientError(err, 'Fahrzeug konnte nicht angelegt werden')
    }
  }
</script>

<PageHeader
  title="Neues Verkaufsfahrzeug anlegen"
  subtitle={'Wird unter „Zu verkaufende Fahrzeuge“ geführt — kein Halter.'}
/>
<VehicleForm
  mode="stock"
  onSave={handleSave}
  onCancel={() => goto('/inventory')}
/>
