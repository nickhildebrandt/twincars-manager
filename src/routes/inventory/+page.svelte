<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import { Plus, Warehouse, Eye, Receipt } from '@lucide/svelte'
  import { listInventoryRemote } from './inventory.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { formatEuro } from '$lib/utils/money'

  let page = $state(1)
  const size = 25
  let q = $state('')

  const iQ = $derived(listInventoryRemote({ page, size, q: q || undefined }))
  const items = $derived(iQ.current?.items ?? [])
  const total = $derived(iQ.current?.total ?? 0)
  const pageCount = $derived(iQ.current?.pageCount ?? 1)
  const loading = $derived(iQ.loading)

  $effect(() => {
    if (iQ.error) handleClientError(iQ.error)
  })

  const sell = (vehicleId: string) => {
    goto(`/invoices/new?vehicleId=${vehicleId}`)
  }
</script>

<PageHeader
  title="Fahrzeugbestand"
  primaryAction={{ label: 'Neues Fahrzeug', href: '/vehicles/new', icon: Plus }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Bestand suchen: Marke, Modell, FIN, Kennzeichen ..."
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
        icon={Warehouse}
        title="Kein Fahrzeug im Bestand"
        description="Legen Sie ein Fahrzeug an und aktivieren Sie das Listing als „verfügbar“."
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
              <th>Fahrzeug</th>
              <th>Kennzeichen</th>
              <th>FIN</th>
              <th>EZ</th>
              <th class="text-right">km-Stand</th>
              <th>Standort</th>
              <th class="text-right">VK Brutto</th>
              <th>Steuer</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as v (v.id)}
              <tr class="hover:bg-base-200/50">
                <td class="font-medium">
                  {[v.make, v.model].filter(Boolean).join(' ') || '—'}
                </td>
                <td class="font-mono">{v.plate ?? ''}</td>
                <td class="font-mono text-xs">{v.vin ?? ''}</td>
                <td>{v.firstRegistration ?? ''}</td>
                <td class="text-right">
                  {v.mileageKm != null
                    ? new Intl.NumberFormat('de-DE').format(v.mileageKm) + ' km'
                    : ''}
                </td>
                <td>{v.location ?? ''}</td>
                <td class="text-right font-mono">
                  {formatEuro(v.salesPriceGross)}
                </td>
                <td>
                  {#if v.differentialTax}
                    <span class="badge badge-ghost badge-sm">§ 25a</span>
                  {:else}
                    <span class="badge badge-ghost badge-sm">Regelbest.</span>
                  {/if}
                </td>
                <td>
                  <div class="flex justify-end gap-1">
                    <a
                      class="btn btn-ghost btn-sm btn-square"
                      href="/vehicles/{v.id}"
                      aria-label="Details"
                    >
                      <Eye size={16} />
                    </a>
                    <button
                      type="button"
                      class="btn btn-primary btn-sm gap-1"
                      onclick={() => sell(v.id)}
                      aria-label="Verkaufen"
                    >
                      <Receipt size={14} /> Verkaufen
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
