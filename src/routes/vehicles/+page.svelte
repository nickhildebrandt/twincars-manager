<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import { Plus, Car, Pencil, Trash2 } from '@lucide/svelte'
  import { listVehiclesRemote, deleteVehicleRemote } from './vehicles.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  let page = $state(1)
  const size = 25
  let q = $state('')

  const vehiclesQ = $derived(
    listVehiclesRemote({ page, size, q: q || undefined, archived: 'active' })
  )
  const items = $derived(vehiclesQ.current?.items ?? [])
  const total = $derived(vehiclesQ.current?.total ?? 0)
  const pageCount = $derived(vehiclesQ.current?.pageCount ?? 1)
  const loading = $derived(vehiclesQ.loading)

  $effect(() => {
    if (vehiclesQ.error) handleClientError(vehiclesQ.error)
  })

  const remove = async (id: string, label: string) => {
    try {
      // Single-flight: refresh the current filter/page combination as part
      // of the delete response, no extra round-trip.
      await deleteVehicleRemote({ id }).updates(listVehiclesRemote)
      toast.success(`Fahrzeug „${label}" gelöscht.`)
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="Fahrzeuge"
  primaryAction={{ label: 'Neues Fahrzeug', href: '/vehicles/new', icon: Plus }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Fahrzeuge suchen: Kennzeichen, FIN, Marke ..."
      onQuery={() => (page = 1)}
    />
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if loading && items.length > 0}
      <Loader variant="bar" />
    {/if}
    {#if loading && items.length === 0}
      <Loader />
    {:else if items.length === 0}
      <EmptyState
        icon={Car}
        title="Noch keine Fahrzeuge"
        description="Legen Sie das erste Fahrzeug an."
      >
        {#snippet action()}
          <a class="btn btn-primary btn-sm gap-2" href="/vehicles/new">
            <Plus size={16} /> Neues Fahrzeug
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="overflow-x-auto">
        <table class="table-zebra table">
          <thead>
            <tr>
              <th>Kennzeichen</th>
              <th>Marke / Modell</th>
              <th>FIN</th>
              <th>EZ</th>
              <th>HU</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as v (v.id)}
              <tr
                class="hover:bg-base-200/50 cursor-pointer"
                onclick={() => goto(`/vehicles/${v.id}`)}
              >
                <td class="font-mono">{v.licensePlate ?? ''}</td>
                <td class="font-medium">
                  {[v.make, v.model].filter(Boolean).join(' ') || '—'}
                </td>
                <td class="font-mono text-xs">{v.vin ?? ''}</td>
                <td>{v.firstRegistration ?? ''}</td>
                <td>{v.nextHu ?? ''}</td>
                <td onclick={(e) => e.stopPropagation()}>
                  <div class="flex justify-end gap-1">
                    <a
                      class="btn btn-ghost btn-sm btn-square"
                      href="/vehicles/{v.id}/edit"
                    >
                      <Pencil size={16} />
                    </a>
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      onclick={() => remove(v.id, v.licensePlate ?? v.id)}
                      aria-label="Löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <Pagination
        {total}
        {page}
        {pageCount}
        {size}
        onPage={(p) => (page = p)}
      />
    {/if}
  </div>
</div>
