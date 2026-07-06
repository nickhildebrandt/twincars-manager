<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import { Plus, Warehouse, Receipt } from '@lucide/svelte'
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
  title="Zu verkaufende Fahrzeuge"
  primaryAction={{
    label: 'Neues Fahrzeug',
    href: '/inventory/new',
    icon: Plus
  }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Zu verkaufende Fahrzeuge suchen: Marke, Modell, FIN, Kennzeichen ..."
      onQuery={() => (pageNum = 1)}
    />
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if items.length === 0}
      <EmptyState
        icon={Warehouse}
        title="Keine zu verkaufenden Fahrzeuge"
        description={'Legen Sie hier ein Fahrzeug an, das verkauft werden soll. Kundenfahrzeuge werden separat unter „Fahrzeuge“ geführt.'}
      >
        {#snippet action()}
          <a class="btn btn-primary btn-sm gap-2" href="/inventory/new">
            <Plus size={16} /> Neues Fahrzeug
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <!-- Desktop / tablet: full table. Hidden below `lg`. -->
      <div class="hidden overflow-x-auto lg:block">
        <table class="table">
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
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => goto(`/vehicles/${v.id}`)}
              >
                <td class="font-medium">
                  {[v.make, v.model].filter(Boolean).join(' ') || '-'}
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
                <td onclick={(e) => e.stopPropagation()}>
                  <div class="flex justify-end gap-1">
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
      <!-- Phone / small tablet: stacked card list with the essentials. -->
      <ul class="divide-base-300 divide-y lg:hidden">
        {#each items as v (v.id)}
          <li class="hover:bg-base-200 flex items-stretch gap-2 p-3">
            <a
              href={`/vehicles/${v.id}`}
              class="flex min-w-0 flex-1 flex-col gap-0.5"
            >
              <span class="truncate text-sm font-medium">
                {[v.make, v.model].filter(Boolean).join(' ') || '-'}
              </span>
              {#if v.plate}
                <span class="text-base-content/60 truncate font-mono text-xs">
                  {v.plate}
                </span>
              {/if}
              <span class="mt-0.5 flex items-center gap-2">
                <span class="font-mono text-xs">
                  {formatEuro(v.salesPriceGross)}
                </span>
                {#if v.differentialTax}
                  <span class="badge badge-ghost badge-sm">§ 25a</span>
                {:else}
                  <span class="badge badge-ghost badge-sm">Regelbest.</span>
                {/if}
              </span>
            </a>
            <div class="flex shrink-0 items-start">
              <button
                type="button"
                class="btn btn-primary btn-sm gap-1"
                onclick={() => sell(v.id)}
                aria-label="Verkaufen"
              >
                <Receipt size={14} /> Verkaufen
              </button>
            </div>
          </li>
        {/each}
      </ul>
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
