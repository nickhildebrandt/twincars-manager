<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import { Plus, Car, Pencil, Trash2 } from '@lucide/svelte'
  import { listVehiclesRemote, deleteVehicleRemote } from './vehicles.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  let pageNum = $state(1)
  const size = 25 as const
  let q = $state('')

  // Only set filter keys carry into the arg object — the cache key of
  // the mutation-side instance must match this one exactly.
  const queryArgs = $derived({
    page: pageNum,
    size,
    ...(q ? { q } : {}),
    kind: 'customer' as const
  })

  // Top-level await: SvelteKit suspends rendering until the initial query
  // resolves so SSR carries the data, and hydration reuses the dehydrated
  // cache without re-fetching.
  const initial = await untrack(() => listVehiclesRemote(queryArgs))

  // Cache the last successful result across param changes so the table
  // stays populated during a refetch instead of dropping to empty state.
  let lastResult = $state<typeof initial>(initial)

  // Re-called on EVERY read (never memoized): a memoized remote proxy
  // holds a dead cache entry after init — `current` stays undefined and
  // optimistic overrides never render. See src/routes/orders/+page.svelte.
  const result = $derived.by(
    () => listVehiclesRemote(queryArgs).current ?? lastResult
  )
  const items = $derived(result.items)
  const total = $derived(result.total)
  const pageCount = $derived(result.pageCount)

  $effect(() => {
    const query = listVehiclesRemote(queryArgs)
    if (query.current) lastResult = query.current
    if (query.error) handleClientError(query.error)
  })

  const remove = async (id: string, label: string) => {
    try {
      // Optimistic single-flight: row vanishes immediately, server-flight
      // returns the authoritative list for the current filter/page combo.
      await busy.run(() =>
        deleteVehicleRemote({ id }).updates(
          listVehiclesRemote(queryArgs).withOverride((current) => ({
            ...current,
            items: current.items.filter((v) => v.id !== id),
            total: Math.max(0, current.total - 1)
          }))
        )
      )
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
      onQuery={() => (pageNum = 1)}
    />
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if items.length === 0}
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
      <!-- Desktop / tablet: full table. -->
      <div class="hidden overflow-x-auto lg:block">
        <table class="table">
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
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => goto(`/vehicles/${v.id}`)}
              >
                <td class="font-mono">{v.licensePlate ?? ''}</td>
                <td class="font-medium">
                  {[v.make, v.model].filter(Boolean).join(' ') || '-'}
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
      <!--
        Phone / small tablet: stacked card list — the whole row is an
        anchor for native keyboard / focus behaviour; the action cluster
        sits beside it for edit/delete.
      -->
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
              <span class="text-base-content/60 truncate font-mono text-xs">
                {v.licensePlate ?? '-'}
              </span>
              {#if v.firstRegistration || v.nextHu}
                <span class="text-base-content/70 mt-0.5 truncate text-xs">
                  {[
                    v.firstRegistration ? `EZ ${v.firstRegistration}` : null,
                    v.nextHu ? `HU ${v.nextHu}` : null
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              {/if}
            </a>
            <div class="flex shrink-0 items-start gap-1">
              <a
                class="btn btn-ghost btn-sm btn-square"
                href="/vehicles/{v.id}/edit"
                aria-label="Bearbeiten"
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
