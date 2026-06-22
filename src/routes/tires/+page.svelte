<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, CircleDot, Pencil, Trash2 } from '@lucide/svelte'
  import { listTiresRemote, deleteTireRemote } from './tires.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formatEuro } from '$lib/utils/money'

  let pageNum = $state(1)
  const size = 25
  let q = $state('')
  let season = $state<'all' | 'Sommer' | 'Winter' | 'Ganzjahres'>('all')

  const query = $derived(
    listTiresRemote({
      page: pageNum,
      size,
      q: q || undefined,
      season: season === 'all' ? undefined : season
    })
  )

  /** Top-level await: SSR carries the data, hydration reuses the cache. */
  const initial = await untrack(() => query)

  /** Cache last successful result so paginating doesn't flash empty state. */
  let lastResult = $state<typeof initial>(initial)
  $effect(() => {
    if (query.current) lastResult = query.current
  })

  const result = $derived(query.current ?? lastResult)
  const tires = $derived(result.items)
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
        deleteTireRemote({ id }).updates(
          listTiresRemote({
            page: pageNum,
            size,
            q: q || undefined,
            season: season === 'all' ? undefined : season
          }).withOverride((current) => ({
            ...current,
            items: current.items.filter((t) => t.id !== id),
            total: Math.max(0, current.total - 1)
          }))
        )
      )
      toast.success(`Reifen „${name}" gelöscht.`)
      toDelete = null
    } catch (err) {
      handleClientError(err)
    }
  }

  const sizeOf = (t: {
    width: number
    aspectRatio: number
    construction: string
    diameterInch: number
  }) => `${t.width}/${t.aspectRatio}${t.construction}${t.diameterInch}`
</script>

<PageHeader
  title="Reifenkatalog"
  primaryAction={{ label: 'Neuer Reifen', href: '/tires/new', icon: Plus }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Reifen suchen: Marke, Modell, Art-Nr. …"
      onQuery={() => (pageNum = 1)}
    >
      {#snippet filters()}
        <select
          class="select select-sm select-bordered w-full"
          bind:value={season}
          onchange={() => (pageNum = 1)}
        >
          <option value="all">Alle Saisons</option>
          <option value="Sommer">Sommer</option>
          <option value="Winter">Winter</option>
          <option value="Ganzjahres">Ganzjahres</option>
        </select>
      {/snippet}
    </Toolbar>
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if tires.length === 0}
      <EmptyState
        icon={CircleDot}
        title="Noch keine Reifen"
        description="Legen Sie den ersten Reifen im Katalog an."
      >
        {#snippet action()}
          <a class="btn btn-primary btn-sm gap-2" href="/tires/new">
            <Plus size={16} /> Neuer Reifen
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Art-Nr.</th>
              <th>Marke / Modell</th>
              <th>Größe</th>
              <th>Saison</th>
              <th class="text-right">Preis (netto)</th>
              <th class="text-right">Bestand</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each tires as t (t.id)}
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => goto(`/tires/${t.id}`)}
              >
                <td class="font-mono text-xs">{t.articleNumber}</td>
                <td class="font-medium">{t.brand} {t.model}</td>
                <td class="font-mono text-xs">{sizeOf(t)}</td>
                <td>
                  <span class="badge badge-ghost badge-sm">{t.season}</span>
                </td>
                <td class="text-right font-mono">
                  {formatEuro(Number(t.unitPriceNet ?? 0))}
                </td>
                <td class="text-right">{t.stockOnHand}</td>
                <td onclick={(ev) => ev.stopPropagation()}>
                  <div class="flex justify-end gap-1">
                    <a
                      class="btn btn-ghost btn-sm btn-square"
                      href="/tires/{t.id}/edit"
                      aria-label="Bearbeiten"
                    >
                      <Pencil size={16} />
                    </a>
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      onclick={() => {
                        toDelete = { id: t.id, name: `${t.brand} ${t.model}` }
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
  title="Reifen löschen?"
  message={`Soll „${toDelete?.name ?? ''}" wirklich gelöscht werden?`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => (confirmOpen = false)}
/>
