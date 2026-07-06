<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, Package, Pencil, Trash2 } from '@lucide/svelte'
  import { listItemsRemote, deleteItemRemote } from './items.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formatEuro } from '$lib/utils/money'

  let pageNum = $state(1)
  const size = 25 as const
  let q = $state('')
  let kind = $state<
    'all' | 'service' | 'material' | 'article' | 'pass_through'
  >('all')

  // Only set filter keys carry into the arg object — the cache key of
  // the mutation-side instance must match this one exactly.
  const queryArgs = $derived({ page: pageNum, size, ...(q ? { q } : {}), kind })

  /** Top-level await: SSR carries the data, hydration reuses the cache. */
  const initial = await untrack(() => listItemsRemote(queryArgs))

  /** Cache last successful result so paginating doesn't flash empty state. */
  let lastResult = $state<typeof initial>(initial)

  // Re-called on EVERY read (never memoized): a memoized remote proxy
  // holds a dead cache entry after init — `current` stays undefined and
  // optimistic overrides never render. See src/routes/orders/+page.svelte.
  const result = $derived.by(
    () => listItemsRemote(queryArgs).current ?? lastResult
  )
  const items = $derived(result.items)
  const total = $derived(result.total)
  const pageCount = $derived(result.pageCount)

  $effect(() => {
    const query = listItemsRemote(queryArgs)
    if (query.current) lastResult = query.current
    if (query.error) handleClientError(query.error)
  })

  let confirmOpen = $state(false)
  let toDelete = $state<{ id: string; name: string } | null>(null)

  const remove = async () => {
    if (!toDelete) return
    const { id, name } = toDelete
    try {
      // Optimistic single-flight: row vanishes immediately, server-flight
      // returns the authoritative list for the current filter/page combo.
      await busy.run(() =>
        deleteItemRemote({ id }).updates(
          listItemsRemote(queryArgs).withOverride((current) => ({
            ...current,
            items: current.items.filter((i) => i.id !== id),
            total: Math.max(0, current.total - 1)
          }))
        )
      )
      toast.success(`„${name}" gelöscht.`)
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
          class="select select-sm select-bordered w-full"
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
      <!-- Desktop / tablet: full table. Hidden below `lg`. -->
      <div class="hidden overflow-x-auto lg:block">
        <table class="table">
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
                class="hover:bg-base-200 cursor-pointer"
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
      <!-- Phone / small tablet: stacked card list with the essentials. -->
      <ul class="divide-base-300 divide-y lg:hidden">
        {#each items as i (i.id)}
          <li class="hover:bg-base-200 flex items-stretch gap-2 p-3">
            <a
              href={`/items/${i.id}`}
              class="flex min-w-0 flex-1 flex-col gap-0.5"
            >
              <span class="truncate text-sm font-medium">{i.description}</span>
              <span class="text-base-content/60 truncate font-mono text-xs">
                {i.articleNumber}
              </span>
              <span class="mt-0.5 flex items-center gap-2">
                <span class="badge badge-ghost badge-sm">
                  {kindLabel(i.kind)}
                </span>
                <span class="font-mono text-xs">
                  {formatEuro(Number(i.unitPriceNet ?? 0))}
                </span>
              </span>
            </a>
            <div class="flex shrink-0 items-start gap-1">
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
  title="Artikel löschen?"
  message={`Soll „${toDelete?.name ?? ''}" wirklich gelöscht werden?`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => (confirmOpen = false)}
/>
