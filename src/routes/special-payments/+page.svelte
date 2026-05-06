<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, Gift, Pencil, Trash2 } from '@lucide/svelte'
  import {
    deleteSpecialPaymentRemote,
    listSpecialPaymentsRemote
  } from './special-payments.remote'
  import { formatEuro } from '$lib/utils/money'
  import { handleClientError } from '$lib/utils/client-error'
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'

  let pageNum = $state(1)
  const size = 25
  let kindFilter = $state<'all' | 'one_time' | 'recurring'>('all')
  let q = $state('')

  const query = $derived(
    listSpecialPaymentsRemote({
      page: pageNum,
      size,
      kind: kindFilter,
      q: q || undefined
    })
  )
  const initial = await untrack(() => query)
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

  const refresh = () => query.refresh()

  let confirmOpen = $state(false)
  let toDelete = $state<{ id: string; label: string } | null>(null)

  const remove = async () => {
    if (!toDelete) return
    try {
      await busy.run(() => deleteSpecialPaymentRemote({ id: toDelete!.id }))
      await refresh()
      toast.success('Sonderzahlung gelöscht.')
    } catch (err) {
      handleClientError(err)
    } finally {
      toDelete = null
    }
  }

  const fmtMonth = (iso: string) => {
    const [y, m] = iso.split('-')
    const labels = [
      'Jan',
      'Feb',
      'Mär',
      'Apr',
      'Mai',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Okt',
      'Nov',
      'Dez'
    ]
    return `${labels[Number(m) - 1] ?? m} ${y}`
  }

  const kindLabel = (k: string) =>
    k === 'one_time' ? 'Einmalig' : k === 'recurring' ? 'Wiederkehrend' : k
</script>

<PageHeader
  title="Sonderzahlungen"
  primaryAction={{
    label: 'Neue Sonderzahlung',
    href: '/special-payments/new',
    icon: Plus
  }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Sonderzahlung suchen: Bezeichnung ..."
      onQuery={() => (pageNum = 1)}
    >
      {#snippet filters()}
        <select
          class="select select-sm select-bordered w-full"
          bind:value={kindFilter}
          onchange={() => (pageNum = 1)}
        >
          <option value="all">Alle Arten</option>
          <option value="one_time">Einmalig</option>
          <option value="recurring">Wiederkehrend</option>
        </select>
      {/snippet}
    </Toolbar>
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if items.length === 0}
      <EmptyState
        icon={Gift}
        title="Noch keine Sonderzahlungen"
        description="Boni, Prämien und sonstige Zahlungen werden hier angelegt und beim nächsten Lohnlauf automatisch berücksichtigt."
      >
        {#snippet action()}
          <a class="btn btn-primary btn-sm gap-2" href="/special-payments/new">
            <Plus size={16} /> Neue Sonderzahlung
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Bezeichnung</th>
              <th>Art</th>
              <th class="text-right">Betrag</th>
              <th>Zeitraum</th>
              <th>Empfänger</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as p (p.id)}
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => goto(`/special-payments/${p.id}/edit`)}
              >
                <td class="font-medium">{p.label}</td>
                <td>
                  <span class="badge badge-ghost badge-sm">
                    {kindLabel(p.kind)}
                  </span>
                </td>
                <td class="text-right font-mono">
                  {formatEuro(Number(p.amount))}
                </td>
                <td>
                  {fmtMonth(p.startMonth)}
                  {#if p.kind === 'recurring'}
                    – {p.endMonth ? fmtMonth(p.endMonth) : 'unbefristet'}
                  {/if}
                </td>
                <td>
                  {#if p.targetAll}
                    <span class="badge badge-info badge-sm">
                      Alle Mitarbeiter
                    </span>
                  {:else}
                    <span class="text-base-content/60 text-sm">
                      {p.employeeIds.length}
                      {p.employeeIds.length === 1
                        ? 'Mitarbeiter'
                        : 'Mitarbeiter'}
                    </span>
                  {/if}
                </td>
                <td onclick={(e) => e.stopPropagation()}>
                  <div class="flex justify-end gap-1">
                    <a
                      class="btn btn-ghost btn-sm btn-square"
                      href={`/special-payments/${p.id}/edit`}
                      aria-label="Bearbeiten"
                    >
                      <Pencil size={16} />
                    </a>
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      onclick={() => {
                        toDelete = { id: p.id, label: p.label }
                        confirmOpen = true
                      }}
                      disabled={busy.active}
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
  title="Sonderzahlung löschen?"
  message={toDelete ? `„${toDelete.label}" wird unwiderruflich gelöscht.` : ''}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => (toDelete = null)}
/>
