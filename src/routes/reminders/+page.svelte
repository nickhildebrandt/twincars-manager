<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import StatCard from '$lib/components/ui/StatCard.svelte'
  import { AlertTriangle, Receipt, FileWarning } from '@lucide/svelte'
  import { listOpenInvoicesRemote } from './reminders.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { formatEuro } from '$lib/utils/money'

  const oQ = $derived(listOpenInvoicesRemote())
  const items = $derived(oQ.current ?? [])
  const loading = $derived(oQ.loading)
  $effect(() => {
    if (oQ.error) handleClientError(oQ.error)
  })

  const totals = $derived.by(() => {
    const open = items.reduce((s, i) => s + i.openAmount, 0)
    const overdue = items.filter((i) => i.overdueDays > 0)
    const overdueSum = overdue.reduce((s, i) => s + i.openAmount, 0)
    return { open, overdue: overdue.length, overdueSum }
  })

  const reminderBadge = (lvl: number) => {
    if (lvl === 0) return 'badge-info'
    if (lvl === 1) return 'badge-warning'
    return 'badge-error'
  }
  const reminderLabel = (lvl: number) =>
    lvl === 0 ? 'noch nicht fällig' : `Mahnstufe ${lvl}`
</script>

<PageHeader
  title="Offene Rechnungen & Mahnungen"
  subtitle="OP-Liste mit automatisch berechneten Verzugstagen und Mahnstufen."
/>

<div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
  <StatCard
    title="Offene Beträge"
    value={formatEuro(totals.open)}
    icon={Receipt}
    color="warning"
  />
  <StatCard
    title="Überfällige Rechnungen"
    value={totals.overdue.toString()}
    icon={AlertTriangle}
    color="error"
  />
  <StatCard
    title="Überfälliger Betrag"
    value={formatEuro(totals.overdueSum)}
    icon={FileWarning}
    color="error"
  />
</div>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if loading && items.length === 0}
      <Loader />
    {:else if items.length === 0}
      <EmptyState
        icon={Receipt}
        title="Keine offenen Rechnungen"
        description="Alle Rechnungen sind bezahlt."
      />
    {:else}
      <div class="overflow-x-auto">
        <table class="table-zebra table">
          <thead>
            <tr>
              <th>Rechnungsnr.</th>
              <th>Datum</th>
              <th>Fällig</th>
              <th>Kunde</th>
              <th class="text-right">Brutto</th>
              <th class="text-right">Bezahlt</th>
              <th class="text-right">Offen</th>
              <th>Verzug</th>
              <th>Mahnstufe</th>
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
                <td>{i.dueDate ?? '—'}</td>
                <td>{i.customerName ?? ''}</td>
                <td class="text-right font-mono">{formatEuro(i.grossTotal)}</td>
                <td class="text-right font-mono">{formatEuro(i.totalPaid)}</td>
                <td class="text-right font-mono font-semibold"
                  >{formatEuro(i.openAmount)}</td
                >
                <td>
                  {#if i.overdueDays > 0}
                    <span class="text-error">{i.overdueDays} Tage</span>
                  {:else}
                    <span class="text-base-content/40">—</span>
                  {/if}
                </td>
                <td>
                  <span class="badge badge-sm {reminderBadge(i.reminderLevel)}">
                    {reminderLabel(i.reminderLevel)}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
