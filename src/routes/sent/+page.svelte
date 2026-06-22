<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import { ChevronLeft, ChevronRight, Send } from '@lucide/svelte'
  import { listSentRemote } from './sent.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import {
    documentTypeLabel,
    sentMessageStatusBadge,
    sentMessageStatusLabel
  } from '$lib/utils/status-labels'

  let pageNum = $state(1)
  const size = 25
  let q = $state('')
  let type = $state<
    'all' | 'invoice' | 'offer' | 'cost_estimate' | 'reminder' | 'mailing'
  >('all')

  /**
   * Monatsauswahl analog zu Kalender / Buchhaltung. Server bekommt
   * `from = monatsanfang`, `to = monatsende`.
   */
  const today = new Date()
  let viewYear = $state(today.getFullYear())
  let viewMonth = $state(today.getMonth() + 1)
  const monthLabels = [
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
  ]
  const monthLabel = (m: number) => monthLabels[m - 1] ?? String(m)
  const fromIso = $derived(
    `${viewYear}-${String(viewMonth).padStart(2, '0')}-01`
  )
  const toIso = $derived.by(() => {
    const last = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate()
    return `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  })
  const isCurrentMonth = $derived(
    viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1
  )
  const prevMonth = () => {
    pageNum = 1
    if (viewMonth === 1) {
      viewMonth = 12
      viewYear -= 1
    } else viewMonth -= 1
  }
  const nextMonth = () => {
    pageNum = 1
    if (viewMonth === 12) {
      viewMonth = 1
      viewYear += 1
    } else viewMonth += 1
  }
  const goToday = () => {
    pageNum = 1
    viewYear = today.getFullYear()
    viewMonth = today.getMonth() + 1
  }

  const query = $derived(
    listSentRemote({
      page: pageNum,
      size,
      q: q || undefined,
      type,
      from: fromIso,
      to: toIso
    })
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

  const fmt = (d: Date | string) => new Date(d).toLocaleString('de-DE')
</script>

<PageHeader
  title="Gesendet"
  subtitle="Zentrale Versand-Historie aller per E-Mail verschickten Dokumente."
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Suchen: Empfänger, Betreff ..."
      onQuery={() => (pageNum = 1)}
    >
      {#snippet filters()}
        <select
          class="select select-sm select-bordered w-full"
          bind:value={type}
          onchange={() => (pageNum = 1)}
        >
          <option value="all">Alle Typen</option>
          <option value="invoice">Rechnung</option>
          <option value="offer">Angebot</option>
          <option value="cost_estimate">Kostenvoranschlag</option>
          <option value="reminder">Zahlungserinnerung</option>
          <option value="mailing">Serienbrief</option>
        </select>
      {/snippet}
    </Toolbar>
  {/snippet}
</PageHeader>

<!-- Monatsauswahl analog Kalender / Buchhaltung. -->
<div class="card border-base-300 bg-base-100 mb-4 border">
  <div class="card-body flex flex-row items-center gap-2 p-3">
    <div class="join">
      <button
        class="btn btn-sm join-item"
        onclick={prevMonth}
        aria-label="Voriger Monat"
      >
        <ChevronLeft size={14} />
      </button>
      <button
        class="btn btn-sm join-item"
        onclick={goToday}
        disabled={isCurrentMonth}
      >
        Heute
      </button>
      <button
        class="btn btn-sm join-item"
        onclick={nextMonth}
        aria-label="Nächster Monat"
      >
        <ChevronRight size={14} />
      </button>
    </div>
    <h2 class="ms-auto text-lg font-semibold">
      {monthLabel(viewMonth)}
      {viewYear}
    </h2>
  </div>
</div>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if items.length === 0}
      <EmptyState
        icon={Send}
        title="Noch keine versendeten Dokumente"
        description="Sobald Sie Dokumente per E-Mail versenden, erscheinen sie hier."
      />
    {:else}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Typ</th>
              <th>Empfänger</th>
              <th>Betreff</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {#each items as m (m.id)}
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => goto(`/sent/${m.id}`)}
              >
                <td class="whitespace-nowrap">{fmt(m.sentAt)}</td>
                <td>
                  <span class="badge badge-ghost badge-sm">
                    {documentTypeLabel(m.documentType)}
                  </span>
                </td>
                <td>{m.recipientName ?? ''} &lt;{m.recipientEmail}&gt;</td>
                <td>{m.subject}</td>
                <td>
                  <span
                    class="badge badge-sm {sentMessageStatusBadge(m.status)}"
                  >
                    {sentMessageStatusLabel(m.status)}
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
