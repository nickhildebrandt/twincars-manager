<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, FileText, Trash2 } from '@lucide/svelte'
  import { listOffersRemote, deleteOfferRemote } from './offers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { formatEuro } from '$lib/utils/money'

  let page = $state(1)
  let size = $state<10 | 25 | 50 | 100>(25)
  let q = $state('')
  let subtype = $state<
    'all' | 'offer' | 'cost_estimate' | 'order_confirmation'
  >('all')

  const oQ = $derived(
    listOffersRemote({ page, size, q: q || undefined, subtype })
  )
  const items = $derived(oQ.current?.items ?? [])
  const total = $derived(oQ.current?.total ?? 0)
  const pageCount = $derived(oQ.current?.pageCount ?? 1)
  const loading = $derived(oQ.loading)

  $effect(() => {
    if (oQ.error) handleClientError(oQ.error)
  })

  let confirmOpen = $state(false)
  let toDelete = $state<{ id: string; nr: string } | null>(null)

  const remove = async () => {
    if (!toDelete) return
    try {
      await deleteOfferRemote({ id: toDelete.id })
      toast.success(`„${toDelete.nr}" gelöscht.`)
      toDelete = null
    } catch (err) {
      handleClientError(err)
    }
  }

  const typeLabel = (t: string) =>
    t === 'offer'
      ? 'Angebot'
      : t === 'cost_estimate'
        ? 'Kostenvoranschlag'
        : 'Auftragsbestätigung'
</script>

<PageHeader
  title="Angebote / Kostenvoranschläge"
  primaryAction={{ label: 'Neues Angebot', href: '/offers/new', icon: Plus }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Angebote suchen: Nr., Kunde ..."
      onQuery={() => (page = 1)}
    >
      {#snippet filters()}
        <select
          class="select select-sm select-bordered"
          bind:value={subtype}
          onchange={() => (page = 1)}
        >
          <option value="all">Alle Typen</option>
          <option value="offer">Angebot</option>
          <option value="cost_estimate">Kostenvoranschlag</option>
          <option value="order_confirmation">Auftragsbestätigung</option>
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
        icon={FileText}
        title="Noch keine Angebote"
        description="Erstellen Sie Ihr erstes Angebot oder Kostenvoranschlag."
      >
        {#snippet action()}
          <a class="btn btn-primary btn-sm gap-2" href="/offers/new">
            <Plus size={16} /> Neues Angebot
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="overflow-x-auto">
        <table class="table-zebra table">
          <thead>
            <tr>
              <th>Nummer</th>
              <th>Datum</th>
              <th>Typ</th>
              <th class="text-right">Brutto</th>
              <th>Status</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as o (o.id)}
              <tr
                class="hover:bg-base-200/50 cursor-pointer"
                onclick={() => goto(`/offers/${o.id}`)}
              >
                <td class="font-mono text-xs">{o.documentNumber}</td>
                <td>{o.issueDate}</td>
                <td>
                  <span class="badge badge-ghost badge-sm"
                    >{typeLabel(o.type)}</span
                  >
                </td>
                <td class="text-right font-mono"
                  >{formatEuro(Number(o.grossTotal))}</td
                >
                <td>
                  <span class="badge badge-sm badge-info">{o.status}</span>
                </td>
                <td onclick={(ev) => ev.stopPropagation()}>
                  <div class="flex justify-end gap-1">
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      aria-label="Löschen"
                      onclick={() => {
                        toDelete = { id: o.id, nr: o.documentNumber }
                        confirmOpen = true
                      }}
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
  title="Dokument löschen?"
  message={`Soll "${toDelete?.nr ?? ''}" wirklich gelöscht werden?`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => (confirmOpen = false)}
/>
