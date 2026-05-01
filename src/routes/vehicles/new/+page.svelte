<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import VehicleForm, { type VehicleFormValues } from '../VehicleForm.svelte'
  import { createVehicleRemote } from '../vehicles.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  let busy = $state(false)

  const handleSave = async (values: VehicleFormValues) => {
    busy = true
    try {
      const created = await createVehicleRemote(values)
      toast.success('Fahrzeug angelegt.')
      goto(`/vehicles/${created.id}`)
    } catch (err) {
      handleClientError(err, 'Fahrzeug konnte nicht angelegt werden')
    } finally {
      busy = false
    }
  }
</script>

<PageHeader
  title="Neues Fahrzeug anlegen"
  subtitle="Stammdaten und Technik erfassen."
/>
<VehicleForm onSave={handleSave} onCancel={() => goto('/vehicles')} {busy} />
