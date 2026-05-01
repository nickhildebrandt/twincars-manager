<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, Package, Pencil, Trash2 } from '@lucide/svelte'
  import { listItemsRemote, deleteItemRemote } from './items.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formatEuro } from '$lib/utils/money'

  let pageNum = $state(1)
  const size = 25
  let q = $state('')
  let kind = $state<
    'all' | 'service' | 'material' | 'article' | 'pass_through'
  >('all')

  const query = $derived(
    listItemsRemote({ page: pageNum, size, q: q || undefined, kind })
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

  let confirmOpen = $state(false)
  let toDelete = $state<{ id: string; name: string } | null>(null)

  const remove = async () => {
    if (!toDelete) return
    try {
      await busy.run(() =>
        deleteItemRemote({ id: toDelete!.id }).updates(listItemsRemote)
      )
      toast.success(`„${toDelete.name}" gelöscht.`)
      toDelete = null
    } catch (err) {
      handleClientError(err)
    }
  }

  const kindLabel = (k: string) =>
    k === 'service'
      ? 'Leistung'
      : k === 'material'
        ? 'Material'
        : k === 'pass_through'
          ? 'Durchlauf'
          : 'Artikel'
</script>

<PageHeader
  title="Leistungen, Material, Artikel"
  primaryAction={{ label: 'Neuer Artikel', href: '/items/new', icon: Plus }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Artikel suchen: Nr., Beschreibung ..."
      onQuery={() => (pageNum = 1)}
    >
      {#snippet filters()}
        <select
          class="select select-sm select-bordered"
          bind:value={kind}
          onchange={() => (pageNum = 1)}
        >
          <option value="all">Alle Typen</option>
          <option value="service">Leistung</option>
          <option value="material">Material</option>
          <option value="article">Artikel</option>
          <option value="pass_through">Durchlaufposten</option>
        </select>
      {/snippet}
    </Toolbar>
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if loading}
      <Loader variant="bar" />
    {/if}
    {#if items.length === 0}
      <EmptyState
        icon={Package}
        title="Noch keine Artikel"
        description="Legen Sie Ihren ersten Artikel oder Leistung an."
      >
        {#snippet action()}
          <a class="btn btn-primary btn-sm gap-2" href="/items/new">
            <Plus size={16} /> Neuer Artikel
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="overflow-x-auto">
        <table class="table-zebra table">
          <thead>
            <tr>
              <th>Art-Nr.</th>
              <th>Beschreibung</th>
              <th>Typ</th>
              <th>Einheit</th>
              <th class="text-right">Preis (netto)</th>
              <th class="text-right">Bestand</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as i (i.id)}
              <tr
                class="hover:bg-base-200/50 cursor-pointer"
                onclick={() => goto(`/items/${i.id}`)}
              >
                <td class="font-mono text-xs">{i.articleNumber}</td>
                <td class="font-medium">{i.description}</td>
                <td>
                  <span class="badge badge-ghost badge-sm"
                    >{kindLabel(i.kind)}</span
                  >
                </td>
                <td>{i.unit ?? ''}</td>
                <td class="text-right font-mono"
                  >{formatEuro(Number(i.unitPriceNet ?? 0))}</td
                >
                <td class="text-right">{i.stockOnHand}</td>
                <td onclick={(ev) => ev.stopPropagation()}>
                  <div class="flex justify-end gap-1">
                    <a
                      class="btn btn-ghost btn-sm btn-square"
                      href="/items/{i.id}/edit"
                      aria-label="Bearbeiten"
                    >
                      <Pencil size={16} />
                    </a>
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      onclick={() => {
                        toDelete = { id: i.id, name: i.description }
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
  title="Artikel löschen?"
  message={`Soll „${toDelete?.name ?? ''}" wirklich gelöscht werden?`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => (confirmOpen = false)}
/>
