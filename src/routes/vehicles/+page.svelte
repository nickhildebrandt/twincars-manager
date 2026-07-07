<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, Car, Pencil, Trash2, ArchiveRestore } from '@lucide/svelte'
  import {
    listVehiclesRemote,
    deleteVehicleRemote,
    setVehicleArchivedRemote
  } from './vehicles.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  let pageNum = $state(1)
  const size = 25 as const
  let q = $state('')
  /**
   * View tab: active customer vehicles (default) or the archive. The
   * archive view spans customer AND stock vehicles — the one surface
   * where archived rows stay findable and reactivatable.
   */
  let viewFilter = $state<'active' | 'archived'>('active')
  const isArchiveTab = $derived(viewFilter === 'archived')

  // Only set filter keys carry into the arg object — the cache key of
  // the mutation-side instance must match this one exactly.
  const queryArgs = $derived({
    page: pageNum,
    size,
    ...(q ? { q } : {}),
    kind: 'customer' as const,
    ...(viewFilter === 'archived' ? { archived: 'archived' as const } : {})
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

  /** Delete confirmation state (dialog, not instant delete). */
  let confirmOpen = $state(false)
  let toDelete = $state<{ id: string; label: string } | null>(null)

  const askDelete = (id: string, label: string) => {
    toDelete = { id, label }
    confirmOpen = true
  }

  const performDelete = async () => {
    if (!toDelete) return
    const { id, label } = toDelete
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
      toDelete = null
    } catch (err) {
      handleClientError(err, 'Fahrzeug konnte nicht gelöscht werden')
    }
  }

  /**
   * Reactivate straight from the Archiv tab — optimistic single-flight:
   * the row leaves the archive list immediately, the same response
   * refreshes the authoritative list.
   */
  const reactivate = async (id: string, label: string) => {
    try {
      await busy.run(() =>
        setVehicleArchivedRemote({ id, archived: false }).updates(
          listVehiclesRemote(queryArgs).withOverride((current) => ({
            ...current,
            items: current.items.filter((v) => v.id !== id),
            total: Math.max(0, current.total - 1)
          }))
        )
      )
      toast.success(`Fahrzeug „${label}" reaktiviert.`)
    } catch (err) {
      handleClientError(err, 'Fahrzeug konnte nicht reaktiviert werden')
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
    >
      {#snippet filters()}
        <div role="tablist" class="tabs tabs-box">
          <button
            type="button"
            role="tab"
            class="tab"
            class:tab-active={viewFilter === 'active'}
            onclick={() => {
              if (viewFilter === 'active') return
              viewFilter = 'active'
              pageNum = 1
            }}
          >
            Aktiv
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            class:tab-active={viewFilter === 'archived'}
            onclick={() => {
              if (viewFilter === 'archived') return
              viewFilter = 'archived'
              pageNum = 1
            }}
          >
            Archiv
          </button>
        </div>
      {/snippet}
    </Toolbar>
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if items.length === 0}
      {#if isArchiveTab}
        <EmptyState
          icon={Car}
          title="Keine archivierten Fahrzeuge"
          description="Archivierte Fahrzeuge erscheinen hier und lassen sich jederzeit reaktivieren."
        />
      {:else}
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
      {/if}
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
                  {#if v.archived}
                    <span class="badge badge-ghost badge-sm ml-1">
                      Archiviert
                    </span>
                  {/if}
                </td>
                <td class="font-mono text-xs">{v.vin ?? ''}</td>
                <td>{v.firstRegistration ?? ''}</td>
                <td>{v.nextHu ?? ''}</td>
                <td onclick={(e) => e.stopPropagation()}>
                  <div class="flex justify-end gap-1">
                    {#if v.archived}
                      <button
                        class="btn btn-ghost btn-sm btn-square"
                        aria-label="Reaktivieren"
                        title="Reaktivieren"
                        onclick={() => reactivate(v.id, v.licensePlate ?? v.id)}
                      >
                        <ArchiveRestore size={16} />
                      </button>
                    {/if}
                    <a
                      class="btn btn-ghost btn-sm btn-square"
                      href="/vehicles/{v.id}/edit"
                      aria-label="Bearbeiten"
                    >
                      <Pencil size={16} />
                    </a>
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      onclick={() => askDelete(v.id, v.licensePlate ?? v.id)}
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
                {#if v.archived}
                  <span class="badge badge-ghost badge-sm ml-1">Archiviert</span
                  >
                {/if}
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
              {#if v.archived}
                <button
                  class="btn btn-ghost btn-sm btn-square"
                  aria-label="Reaktivieren"
                  title="Reaktivieren"
                  onclick={() => reactivate(v.id, v.licensePlate ?? v.id)}
                >
                  <ArchiveRestore size={16} />
                </button>
              {/if}
              <a
                class="btn btn-ghost btn-sm btn-square"
                href="/vehicles/{v.id}/edit"
                aria-label="Bearbeiten"
              >
                <Pencil size={16} />
              </a>
              <button
                class="btn btn-ghost btn-sm btn-square text-error"
                onclick={() => askDelete(v.id, v.licensePlate ?? v.id)}
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

<ConfirmDialog
  bind:open={confirmOpen}
  title="Fahrzeug löschen?"
  message={`Soll das Fahrzeug "${toDelete?.label ?? ''}" wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={performDelete}
  onClose={() => (confirmOpen = false)}
/>
