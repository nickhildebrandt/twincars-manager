<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import VehicleForm, { type VehicleFormValues } from '../../VehicleForm.svelte'
  import { getVehicleRemote, updateVehicleRemote } from '../../vehicles.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the form values, hydration reuses cache. */
  const v = await getVehicleRemote({ id })

  const handleSave = async (values: VehicleFormValues) => {
    try {
      await busy.run(() => updateVehicleRemote({ id, values }))
      toast.success('Fahrzeug gespeichert.')
      goto(`/vehicles/${id}`)
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader title="Fahrzeug bearbeiten" subtitle={v.licensePlate ?? ''} />

<VehicleForm
  initial={v}
  onSave={handleSave}
  onCancel={() => goto(`/vehicles/${v.id}`)}
/>
