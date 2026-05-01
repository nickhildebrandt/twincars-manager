<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, Package, Pencil, Trash2 } from '@lucide/svelte'
  import { listItemsRemote, deleteItemRemote } from './items.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { formatEuro } from '$lib/utils/money'

  let page = $state(1)
  let size = $state<10 | 25 | 50 | 100>(25)
  let q = $state('')
  let kind = $state<
    'all' | 'service' | 'material' | 'article' | 'pass_through'
  >('all')

  const iQ = $derived(listItemsRemote({ page, size, q: q || undefined, kind }))
  const items = $derived(iQ.current?.items ?? [])
  const total = $derived(iQ.current?.total ?? 0)
  const pageCount = $derived(iQ.current?.pageCount ?? 1)
  const loading = $derived(iQ.loading)

  $effect(() => {
    if (iQ.error) handleClientError(iQ.error)
  })

  let confirmOpen = $state(false)
  let toDelete = $state<{ id: string; name: string } | null>(null)

  const remove = async () => {
    if (!toDelete) return
    try {
      await deleteItemRemote({ id: toDelete.id })
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
  subtitle={total > 0
    ? `${total.toLocaleString('de-DE')} Einträge`
    : 'Stammdaten für Leistungen und Artikel.'}
>
  {#snippet actions()}
    <a class="btn btn-primary btn-sm gap-2" href="/items/new">
      <Plus size={16} /> Neuer Artikel
    </a>
  {/snippet}
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Artikel suchen: Nr., Beschreibung ..."
      onQuery={() => (page = 1)}
    >
      {#snippet filters()}
        <select
          class="select select-sm select-bordered"
          bind:value={kind}
          onchange={() => (page = 1)}
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
    {#if loading && items.length === 0}
      <div class="text-base-content/60 flex h-32 items-center justify-center">
        <span class="loading loading-spinner"></span>
      </div>
    {:else if items.length === 0}
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
              <tr class="hover:bg-base-200/50">
                <td class="font-mono text-xs">{i.articleNumber}</td>
                <td>
                  <a href="/items/{i.id}" class="link link-hover font-medium">
                    {i.description}
                  </a>
                </td>
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
                <td>
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
        {page}
        {pageCount}
        {size}
        onPage={(p) => (page = p)}
        onSize={(s) => {
          size = s as 10 | 25 | 50 | 100
          page = 1
        }}
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
