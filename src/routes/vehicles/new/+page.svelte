<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import VehicleForm, { type VehicleFormValues } from '../VehicleForm.svelte'
  import { createVehicleRemote } from '../vehicles.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const handleSave = async (values: VehicleFormValues) => {
    try {
      const created = await busy.run(() => createVehicleRemote(values))
      toast.success('Fahrzeug angelegt.')
      goto(`/vehicles/${created.id}`, { replaceState: true })
    } catch (err) {
      handleClientError(err, 'Fahrzeug konnte nicht angelegt werden')
    }
  }
</script>

<PageHeader
  title="Neues Fahrzeug anlegen"
  subtitle={'Kundenfahrzeug — Halter ist Pflicht. Für Verkaufsfahrzeuge ohne Halter siehe „Zu verkaufende Fahrzeuge“.'}
/>
<VehicleForm
  mode="customer"
  onSave={handleSave}
  onCancel={() => goto('/vehicles')}
/>
