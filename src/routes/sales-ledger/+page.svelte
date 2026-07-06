<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import StatCard from '$lib/components/ui/StatCard.svelte'
  import { BookOpen, TrendingUp } from '@lucide/svelte'
  import { getSalesLedgerRemote } from './sales-ledger.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { formatEuro } from '$lib/utils/money'
  import {
    documentStatusBadge,
    documentStatusLabel
  } from '$lib/utils/status-labels'

  let period = $state<'this_month' | 'last_month' | 'this_year' | 'all'>(
    'this_month'
  )

  const queryArgs = $derived({ period })

  /** Top-level await: SSR carries the data; hydration reuses the cache. */
  const initial = await untrack(() => getSalesLedgerRemote(queryArgs))

  /** Cache last successful result so changing the period doesn't flash empty. */
  let lastData = $state<typeof initial>(initial)

  // Re-called on EVERY read (never memoized): a memoized remote proxy
  // holds a dead cache entry after init — `current` stays undefined and
  // refreshes never render. See src/routes/orders/+page.svelte.
  const data = $derived.by(
    () => getSalesLedgerRemote(queryArgs).current ?? lastData
  )
  const rows = $derived(data.rows)
  const totals = $derived(data.totals)

  $effect(() => {
    const query = getSalesLedgerRemote(queryArgs)
    if (query.current) lastData = query.current
    if (query.error) handleClientError(query.error)
  })
</script>

<PageHeader
  title="Rechnungsausgangsbuch"
  subtitle="Auswertung aller Rechnungen im Zeitraum."
>
  {#snippet toolbar()}
    <div
      class="card border-base-300 bg-base-100 flex flex-row items-center gap-2 border p-3"
    >
      <span class="text-base-content/60 text-sm">Zeitraum:</span>
      <select
        class="select select-sm select-bordered w-full sm:w-56"
        bind:value={period}
      >
        <option value="this_month">Dieser Monat</option>
        <option value="last_month">Letzter Monat</option>
        <option value="this_year">Dieses Jahr</option>
        <option value="all">Alle</option>
      </select>
    </div>
  {/snippet}
</PageHeader>

<div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
    {#if rows.length === 0}
      <EmptyState icon={BookOpen} title="Keine Rechnungen im Zeitraum" />
    {:else}
      <!-- Desktop / tablet: full table, hidden below lg. -->
      <div class="hidden overflow-x-auto lg:block">
        <table class="table">
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
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => goto(`/invoices/${r.id}`)}
              >
                <td class="font-mono text-xs">{r.documentNumber}</td>
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
                <td>
                  <span class="badge badge-sm {documentStatusBadge(r.status)}">
                    {documentStatusLabel(r.status)}
                  </span>
                </td>
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
      <!-- Phone / small tablet: stacked card list with a Summe footer row. -->
      <ul class="divide-base-300 divide-y lg:hidden">
        {#each rows as r (r.id)}
          <li>
            <a
              href={`/invoices/${r.id}`}
              class="hover:bg-base-200 flex min-w-0 flex-col gap-0.5 p-3"
            >
              <span class="truncate font-mono text-xs font-medium">
                {r.documentNumber}
              </span>
              <span class="text-base-content/70 truncate text-xs">
                {[r.issueDate, r.customerName].filter(Boolean).join(' · ')}
              </span>
              <span class="mt-0.5 flex flex-wrap items-center gap-2">
                <span class="badge badge-sm {documentStatusBadge(r.status)}">
                  {documentStatusLabel(r.status)}
                </span>
                <span class="font-mono text-sm font-semibold">
                  {formatEuro(Number(r.grossTotal))}
                </span>
              </span>
            </a>
          </li>
        {/each}
        <li
          class="bg-base-200/30 flex items-center justify-between p-3 font-semibold"
        >
          <span>Summe</span>
          <span class="font-mono">{formatEuro(totals.gross)}</span>
        </li>
      </ul>
    {/if}
  </div>
</div>
