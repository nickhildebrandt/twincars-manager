<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import StatCard from '$lib/components/ui/StatCard.svelte'
  import { BookOpen, TrendingUp } from '@lucide/svelte'
  import { getSalesLedgerRemote } from './sales-ledger.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { formatEuro } from '$lib/utils/money'

  let period = $state<'this_month' | 'last_month' | 'this_year' | 'all'>(
    'this_month'
  )

  const lQ = $derived(getSalesLedgerRemote({ period }))
  const data = $derived(lQ.current)
  const rows = $derived(data?.rows ?? [])
  const totals = $derived(data?.totals ?? { net: 0, tax: 0, gross: 0 })
  const loading = $derived(lQ.loading)

  $effect(() => {
    if (lQ.error) handleClientError(lQ.error)
  })
</script>

<PageHeader
  title="Rechnungsausgangsbuch"
  subtitle="Auswertung aller Rechnungen im Zeitraum."
>
  {#snippet toolbar()}
    <div
      class="border-base-300 bg-base-100 flex items-center gap-2 rounded-lg border p-3"
    >
      <span class="text-base-content/60 text-sm">Zeitraum:</span>
      <select class="select select-sm select-bordered" bind:value={period}>
        <option value="this_month">Dieser Monat</option>
        <option value="last_month">Letzter Monat</option>
        <option value="this_year">Dieses Jahr</option>
        <option value="all">Alle</option>
      </select>
    </div>
  {/snippet}
</PageHeader>

<div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
  <StatCard
    title="Netto-Umsatz"
    value={formatEuro(totals.net)}
    icon={TrendingUp}
    color="info"
  />
  <StatCard
    title="MwSt"
    value={formatEuro(totals.tax)}
    icon={TrendingUp}
    color="warning"
  />
  <StatCard
    title="Brutto-Umsatz"
    value={formatEuro(totals.gross)}
    icon={TrendingUp}
    color="success"
  />
</div>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if loading}
      <Loader />
    {:else if rows.length === 0}
      <EmptyState icon={BookOpen} title="Keine Rechnungen im Zeitraum" />
    {:else}
      <div class="overflow-x-auto">
        <table class="table-zebra table">
          <thead>
            <tr>
              <th>Rechnungsnr.</th>
              <th>Datum</th>
              <th>Kunde</th>
              <th class="text-right">Netto</th>
              <th class="text-right">MwSt</th>
              <th class="text-right">Brutto</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as r (r.id)}
              <tr>
                <td class="font-mono text-xs"
                  ><a class="link link-hover" href="/invoices/{r.id}"
                    >{r.documentNumber}</a
                  ></td
                >
                <td>{r.issueDate}</td>
                <td>{r.customerName ?? ''}</td>
                <td class="text-right font-mono"
                  >{formatEuro(Number(r.netTotal))}</td
                >
                <td class="text-right font-mono"
                  >{formatEuro(Number(r.taxTotal))}</td
                >
                <td class="text-right font-mono font-semibold"
                  >{formatEuro(Number(r.grossTotal))}</td
                >
                <td><span class="badge badge-sm">{r.status}</span></td>
              </tr>
            {/each}
          </tbody>
          <tfoot
            class="border-base-300 bg-base-200/30 border-t-2 font-semibold"
          >
            <tr>
              <td colspan="3">Summe</td>
              <td class="text-right font-mono">{formatEuro(totals.net)}</td>
              <td class="text-right font-mono">{formatEuro(totals.tax)}</td>
              <td class="text-right font-mono">{formatEuro(totals.gross)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    {/if}
  </div>
</div>
