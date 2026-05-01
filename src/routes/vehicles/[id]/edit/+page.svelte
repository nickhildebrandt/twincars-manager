<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import VehicleForm, { type VehicleFormValues } from '../../VehicleForm.svelte'
  import { getVehicleRemote, updateVehicleRemote } from '../../vehicles.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the form values, hydration reuses cache. */
  const v = await getVehicleRemote({ id })

  let busy = $state(false)

  const handleSave = async (values: VehicleFormValues) => {
    busy = true
    try {
      await updateVehicleRemote({ id, values })
      toast.success('Fahrzeug gespeichert.')
      goto(`/vehicles/${id}`)
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="Fahrzeug bearbeiten" subtitle={v.licensePlate ?? ''} />

<VehicleForm
  initial={v}
  onSave={handleSave}
  onCancel={() => goto(`/vehicles/${v.id}`)}
  {busy}
/>
