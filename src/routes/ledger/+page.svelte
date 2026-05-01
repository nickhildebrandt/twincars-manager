<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import StatCard from '$lib/components/ui/StatCard.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import {
    Plus,
    Calculator,
    Trash2,
    TrendingUp,
    TrendingDown,
    Wallet
  } from '@lucide/svelte'
  import {
    listLedgerEntriesRemote,
    deleteLedgerEntryRemote
  } from './ledger.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { formatEuro } from '$lib/utils/money'

  let page = $state(1)
  const size = 25
  let q = $state('')
  let direction = $state<'all' | 'income' | 'expense'>('all')

  const lQ = $derived(
    listLedgerEntriesRemote({ page, size, q: q || undefined, direction })
  )
  const items = $derived(lQ.current?.items ?? [])
  const total = $derived(lQ.current?.total ?? 0)
  const pageCount = $derived(lQ.current?.pageCount ?? 1)
  const incomeSum = $derived(
    (lQ.current as unknown as { incomeSum?: number })?.incomeSum ?? 0
  )
  const expenseSum = $derived(
    (lQ.current as unknown as { expenseSum?: number })?.expenseSum ?? 0
  )
  const loading = $derived(lQ.loading)

  $effect(() => {
    if (lQ.error) handleClientError(lQ.error)
  })

  let confirmOpen = $state(false)
  let toDelete = $state<{ id: string; desc: string } | null>(null)

  const remove = async () => {
    if (!toDelete) return
    try {
      await deleteLedgerEntryRemote({ id: toDelete.id }).updates(
        listLedgerEntriesRemote
      )
      toast.success(`Buchung gelöscht.`)
      toDelete = null
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="Buchhaltung"
  primaryAction={{ label: 'Neue Buchung', href: '/ledger/new', icon: Plus }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Buchungen suchen: Beschreibung, Belegnummer ..."
      onQuery={() => (page = 1)}
    >
      {#snippet filters()}
        <select
          class="select select-sm select-bordered"
          bind:value={direction}
          onchange={() => (page = 1)}
        >
          <option value="all">Alle</option>
          <option value="income">Einnahmen</option>
          <option value="expense">Ausgaben</option>
        </select>
      {/snippet}
    </Toolbar>
  {/snippet}
</PageHeader>

<div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
  <StatCard
    title="Einnahmen (gefiltert)"
    value={formatEuro(incomeSum)}
    icon={TrendingUp}
    color="success"
  />
  <StatCard
    title="Ausgaben (gefiltert)"
    value={formatEuro(expenseSum)}
    icon={TrendingDown}
    color="error"
  />
  <StatCard
    title="Saldo"
    value={formatEuro(incomeSum - expenseSum)}
    icon={Wallet}
    color={incomeSum - expenseSum >= 0 ? 'success' : 'error'}
  />
</div>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if loading && items.length > 0}
      <Loader variant="bar" />
    {/if}
    {#if loading && items.length === 0}
      <Loader />
    {:else if items.length === 0}
      <EmptyState
        icon={Calculator}
        title="Noch keine Buchungen"
        description="Legen Sie Ihre erste Ein- oder Ausgabe an."
      >
        {#snippet action()}
          <a class="btn btn-primary btn-sm gap-2" href="/ledger/new">
            <Plus size={16} /> Neue Buchung
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="overflow-x-auto">
        <table class="table-zebra table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Beleg-Nr.</th>
              <th>Beschreibung</th>
              <th>Quelle</th>
              <th class="text-right">Betrag</th>
              <th>Status</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as e (e.id)}
              <tr class="hover:bg-base-200/50">
                <td>{e.entryDate}</td>
                <td class="font-mono text-xs">{e.entryNumber ?? ''}</td>
                <td>{e.description}</td>
                <td>
                  <span class="badge badge-ghost badge-sm">
                    {e.source === 'manual' ? 'manuell' : e.source}
                  </span>
                </td>
                <td class="text-right font-mono">
                  <span
                    class:text-success={e.direction === 'income'}
                    class:text-error={e.direction === 'expense'}
                  >
                    {e.direction === 'income' ? '+' : '−'}{formatEuro(
                      Number(e.amountGross)
                    )}
                  </span>
                </td>
                <td>
                  <span
                    class="badge badge-sm"
                    class:badge-success={e.paymentStatus === 'paid'}
                    class:badge-warning={e.paymentStatus === 'open'}
                  >
                    {e.paymentStatus}
                  </span>
                </td>
                <td>
                  <div class="flex justify-end gap-1">
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      onclick={() => {
                        toDelete = { id: e.id, desc: e.description }
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
      />
    {/if}
  </div>
</div>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Buchung löschen?"
  message={`Soll die Buchung "${toDelete?.desc ?? ''}" wirklich gelöscht werden?`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => (confirmOpen = false)}
/>
