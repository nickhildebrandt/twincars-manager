<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import VehicleForm, { type VehicleFormValues } from '../../VehicleForm.svelte'
  import { getVehicleRemote, updateVehicleRemote } from '../../vehicles.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  const q = $derived(getVehicleRemote({ id: $page.params.id ?? '' }))
  const v = $derived(q.current)
  const loading = $derived(q.loading)

  let busy = $state(false)

  $effect(() => {
    if (q.error) handleClientError(q.error)
  })

  const handleSave = async (values: VehicleFormValues) => {
    busy = true
    try {
      await updateVehicleRemote({ id: $page.params.id ?? '', values })
      toast.success('Fahrzeug gespeichert.')
      goto(`/vehicles/${$page.params.id ?? ''}`)
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="Fahrzeug bearbeiten" subtitle={v?.licensePlate ?? ''} />
{#if loading}
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body"><div class="skeleton h-6 w-1/3"></div></div>
  </div>
{:else if v}
  <VehicleForm
    initial={v}
    onSave={handleSave}
    onCancel={() => goto(`/vehicles/${v.id}`)}
    {busy}
  />
{/if}
