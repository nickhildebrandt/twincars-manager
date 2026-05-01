<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, Receipt, Trash2 } from '@lucide/svelte'
  import { listInvoicesRemote, deleteInvoiceRemote } from './invoices.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { formatEuro } from '$lib/utils/money'

  let pageNum = $state(1)
  const size = 25
  let q = $state('')
  let status = $state<'all' | 'draft' | 'open' | 'paid' | 'cancelled'>('all')

  const query = $derived(
    listInvoicesRemote({ page: pageNum, size, q: q || undefined, status })
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
  let toDelete = $state<{ id: string; nr: string } | null>(null)

  const remove = async () => {
    if (!toDelete) return
    try {
      await deleteInvoiceRemote({ id: toDelete.id }).updates(listInvoicesRemote)
      toast.success(`Rechnung „${toDelete.nr}" gelöscht.`)
      toDelete = null
    } catch (err) {
      handleClientError(err)
    }
  }

  const statusBadge = (s: string) => {
    if (s === 'paid') return 'badge-success'
    if (s === 'open') return 'badge-warning'
    if (s === 'cancelled') return 'badge-ghost'
    return 'badge-info'
  }
  const statusLabel = (s: string) =>
    s === 'paid'
      ? 'Bezahlt'
      : s === 'open'
        ? 'Offen'
        : s === 'cancelled'
          ? 'Storniert'
          : 'Entwurf'
</script>

<PageHeader
  title="Rechnungen"
  primaryAction={{ label: 'Neue Rechnung', href: '/invoices/new', icon: Plus }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Rechnungen suchen: Nr., Kunde ..."
      onQuery={() => (pageNum = 1)}
    >
      {#snippet filters()}
        <select
          class="select select-sm select-bordered"
          bind:value={status}
          onchange={() => (pageNum = 1)}
        >
          <option value="all">Alle Status</option>
          <option value="draft">Entwurf</option>
          <option value="open">Offen</option>
          <option value="paid">Bezahlt</option>
          <option value="cancelled">Storniert</option>
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
        icon={Receipt}
        title="Noch keine Rechnungen"
        description="Erstellen Sie Ihre erste Rechnung."
      >
        {#snippet action()}
          <a class="btn btn-primary btn-sm gap-2" href="/invoices/new">
            <Plus size={16} /> Neue Rechnung
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="overflow-x-auto">
        <table class="table-zebra table">
          <thead>
            <tr>
              <th>Rechnungsnr.</th>
              <th>Datum</th>
              <th>Kunde</th>
              <th>Fahrzeug</th>
              <th class="text-right">Brutto</th>
              <th class="text-right">Bezahlt</th>
              <th>Status</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as i (i.id)}
              <tr
                class="hover:bg-base-200/50 cursor-pointer"
                onclick={() => goto(`/invoices/${i.id}`)}
              >
                <td class="font-mono text-xs font-medium">{i.documentNumber}</td
                >
                <td>{i.issueDate}</td>
                <td>{i.customerName ?? ''}</td>
                <td class="font-mono">{i.vehiclePlate ?? ''}</td>
                <td class="text-right font-mono"
                  >{formatEuro(Number(i.grossTotal))}</td
                >
                <td class="text-right font-mono">{formatEuro(i.totalPaid)}</td>
                <td>
                  <span class="badge badge-sm {statusBadge(i.status)}"
                    >{statusLabel(i.status)}</span
                  >
                </td>
                <td onclick={(ev) => ev.stopPropagation()}>
                  <div class="flex justify-end gap-1">
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      aria-label="Löschen"
                      onclick={() => {
                        toDelete = { id: i.id, nr: i.documentNumber }
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
  title="Rechnung löschen?"
  message={`Soll die Rechnung "${toDelete?.nr ?? ''}" wirklich gelöscht werden?`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => (confirmOpen = false)}
/>
