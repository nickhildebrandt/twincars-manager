<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, Truck, Pencil, Trash2, Check } from '@lucide/svelte'
  import {
    listShippingOptionsRemote,
    deleteShippingOptionRemote
  } from './shipping.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formatEuro } from '$lib/utils/money'

  let pageNum = $state(1)
  const size = 25
  let q = $state('')

  const query = $derived(
    listShippingOptionsRemote({ page: pageNum, size, q: q || undefined })
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

  $effect(() => {
    if (query.error) handleClientError(query.error)
  })

  let confirmOpen = $state(false)
  let toDelete = $state<{ id: string; name: string } | null>(null)

  const remove = async () => {
    if (!toDelete) return
    const { id, name } = toDelete
    try {
      await busy.run(() =>
        deleteShippingOptionRemote({ id }).updates(
          listShippingOptionsRemote({
            page: pageNum,
            size,
            q: q || undefined
          }).withOverride((current) => ({
            ...current,
            items: current.items.filter((s) => s.id !== id),
            total: Math.max(0, current.total - 1)
          }))
        )
      )
      toast.success(`Versandoption „${name}" gelöscht.`)
      toDelete = null
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="Versandoptionen"
  back="/settings"
  primaryAction={{
    label: 'Neue Versandoption',
    href: '/settings/shipping/new',
    icon: Plus
  }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Versandoptionen suchen: Name, Beschreibung ..."
      onQuery={() => (pageNum = 1)}
    />
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if items.length === 0}
      <EmptyState
        icon={Truck}
        title="Noch keine Versandoptionen"
        description="Legen Sie Ihre erste Versandoption an."
      >
        {#snippet action()}
          <a class="btn btn-primary btn-sm gap-2" href="/settings/shipping/new">
            <Plus size={16} /> Neue Versandoption
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th class="text-right">Preis</th>
              <th class="text-right">Ab Bestellwert frei</th>
              <th>Aktiv</th>
              <th class="text-right">Reihenfolge</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as s (s.id)}
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => goto(`/settings/shipping/${s.id}/edit`)}
              >
                <td class="font-medium">{s.name}</td>
                <td class="text-right font-mono"
                  >{formatEuro(Number(s.priceNet ?? 0))}</td
                >
                <td class="text-right font-mono">
                  {s.freeAboveNet != null
                    ? formatEuro(Number(s.freeAboveNet))
                    : '—'}
                </td>
                <td>
                  {#if s.active}
                    <span class="badge badge-success badge-sm gap-1">
                      <Check size={12} /> Aktiv
                    </span>
                  {:else}
                    <span class="badge badge-ghost badge-sm">Inaktiv</span>
                  {/if}
                </td>
                <td class="text-right">{s.sortOrder}</td>
                <td onclick={(e) => e.stopPropagation()}>
                  <div class="flex justify-end gap-1">
                    <a
                      class="btn btn-ghost btn-sm btn-square"
                      href="/settings/shipping/{s.id}/edit"
                      aria-label="Bearbeiten"
                    >
                      <Pencil size={16} />
                    </a>
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      onclick={() => {
                        toDelete = { id: s.id, name: s.name }
                        confirmOpen = true
                      }}
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
  title="Versandoption löschen?"
  message={`Soll die Versandoption "${toDelete?.name ?? ''}" wirklich gelöscht werden?`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => (confirmOpen = false)}
/>
