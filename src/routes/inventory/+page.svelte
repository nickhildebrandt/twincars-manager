<script lang="ts">
  import { untrack } from 'svelte'
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

  let pageNum = $state(1)
  const size = 25
  let q = $state('')

  const query = $derived(
    listInventoryRemote({ page: pageNum, size, q: q || undefined })
  )

  /** Top-level await: SSR carries the data, hydration reuses the cache. */
  const initial = await untrack(() => query)

  /** Cache last successful result so paginating doesn't flash empty state. */
  let lastResult = $state<typeof initial>(initial)
  $effect(() => {
    if (query.current) lastResult = query.current
  })

  const result = $derived(query.current ?? lastResult)
  const items = $derived(result.items)
  const total = $derived(result.total)
  const pageCount = $derived(result.pageCount)
  const loading = $derived(query.loading)

  $effect(() => {
    if (query.error) handleClientError(query.error)
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
      onQuery={() => (pageNum = 1)}
    />
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if loading}
      <Loader variant="bar" />
    {/if}
    {#if items.length === 0}
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
        page={pageNum}
        {pageCount}
        {size}
        onPage={(p) => (pageNum = p)}
      />
    {/if}
  </div>
</div>
