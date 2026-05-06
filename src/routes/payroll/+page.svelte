<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import { Wallet } from '@lucide/svelte'
  import {
    ensureAutoPayrollRemote,
    listAllPayrollEntriesRemote
  } from './payroll.remote'
  import { listEmployeesRemote } from '../employees/employees.remote'
  import { formatEuro } from '$lib/utils/money'
  import { handleClientError } from '$lib/utils/client-error'

  let pageNum = $state(1)
  const size = 25

  /**
   * Lazy auto-generation runs *first* on every visit. The query is
   * idempotent — periods + entries already in the DB are skipped, so
   * a no-op visit just walks the calendar and returns immediately.
   * After that we load the flat entry list.
   */
  await ensureAutoPayrollRemote()

  const currentYear = new Date().getFullYear()
  let yearFilter = $state<number | 'all'>('all')
  let employeeFilter = $state<string>('')

  /** Mitarbeiter-Liste für Filter-Dropdown — einmalig SSR. */
  const empListInitial = await listEmployeesRemote({
    page: 1,
    size: 100,
    archived: 'active'
  })
  const employees = $derived(empListInitial.items)

  /** Jahr-Filter spannt currentYear+1..currentYear-4. */
  const yearOptions = $derived.by(() => {
    const out: number[] = []
    for (let y = currentYear + 1; y >= currentYear - 4; y--) out.push(y)
    return out
  })

  const query = $derived(
    listAllPayrollEntriesRemote({
      page: pageNum,
      size,
      year: yearFilter === 'all' ? undefined : yearFilter,
      employeeId: employeeFilter || undefined
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

  const monthLabel = (m: number) =>
    [
      'Januar',
      'Februar',
      'März',
      'April',
      'Mai',
      'Juni',
      'Juli',
      'August',
      'September',
      'Oktober',
      'November',
      'Dezember'
    ][m - 1] ?? String(m)

  const statusLabel = (s: string) =>
    s === 'open'
      ? 'Angelegt'
      : s === 'sent'
        ? 'Versendet'
        : s === 'paid' || s === 'approved'
          ? 'Ausgezahlt'
          : s === 'cancelled'
            ? 'Storniert'
            : s
  const statusBadge = (s: string) =>
    s === 'cancelled'
      ? 'badge-ghost'
      : s === 'paid' || s === 'approved'
        ? 'badge-success'
        : s === 'sent'
          ? 'badge-info'
          : 'badge-warning'

  const fmtDate = (d: string | null) => {
    if (!d) return '—'
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
    return m ? `${m[3]}.${m[2]}.${m[1]}` : d
  }
</script>

<PageHeader
  title="Gehaltsabrechnung"
  subtitle="Lohnabrechnungen werden automatisch zum Stichtag pro Mitarbeiter angelegt."
/>

<!--
  Filter-Toolbar ohne Suchfeld — Gehaltsabrechnungen werden über
  Periode + Mitarbeiter eingegrenzt, nicht über Volltext.
-->
<div
  class="card border-base-300 bg-base-100 mb-4 flex flex-row flex-wrap items-center gap-2 border p-3"
>
  <label class="flex items-center gap-2 text-sm">
    <span class="text-base-content/60">Jahr</span>
    <select
      class="select select-sm select-bordered"
      bind:value={yearFilter}
      onchange={() => (pageNum = 1)}
    >
      <option value="all">Alle Jahre</option>
      {#each yearOptions as y (y)}
        <option value={y}>{y}</option>
      {/each}
    </select>
  </label>
  <label class="flex items-center gap-2 text-sm">
    <span class="text-base-content/60">Mitarbeiter</span>
    <select
      class="select select-sm select-bordered"
      bind:value={employeeFilter}
      onchange={() => (pageNum = 1)}
    >
      <option value="">Alle Mitarbeiter</option>
      {#each employees as e (e.id)}
        <option value={e.id}>{e.firstName} {e.lastName}</option>
      {/each}
    </select>
  </label>
</div>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if items.length === 0}
      <EmptyState
        icon={Wallet}
        title="Noch keine Gehaltsabrechnungen"
        description="Sobald ein Mitarbeiter angelegt ist und der Stichtag in den Firmendaten erreicht wird, erscheinen hier automatisch Einträge."
      />
    {:else}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Periode</th>
              <th>Mitarbeiter</th>
              <th class="text-right">Brutto</th>
              <th class="text-right">Netto</th>
              <th>Auszahlung</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {#each items as p (p.id)}
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() =>
                  goto(`/payroll/${p.periodId}/employee/${p.employeeId}`)}
              >
                <td class="font-medium">
                  {monthLabel(p.month)}
                  {p.year}
                </td>
                <td>
                  {p.employeeFirstName}
                  {p.employeeLastName}
                </td>
                <td class="text-right font-mono">
                  {formatEuro(Number(p.grossTotal))}
                </td>
                <td class="text-right font-mono">
                  {formatEuro(Number(p.netTotal))}
                </td>
                <td>{fmtDate(p.payoutDate)}</td>
                <td>
                  <span class="badge badge-sm {statusBadge(p.status)}">
                    {statusLabel(p.status)}
                  </span>
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
