<script lang="ts">
  import { untrack } from 'svelte'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import { Send } from '@lucide/svelte'
  import { listSentRemote } from './sent.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import {
    sentMessageStatusBadge,
    sentMessageStatusLabel
  } from '$lib/utils/status-labels'

  let pageNum = $state(1)
  const size = 25
  let q = $state('')
  let type = $state<
    | 'all'
    | 'invoice'
    | 'offer'
    | 'cost_estimate'
    | 'reminder'
    | 'payslip'
    | 'mailing'
  >('all')

  const query = $derived(
    listSentRemote({ page: pageNum, size, q: q || undefined, type })
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
          class="select select-sm select-bordered"
          bind:value={type}
          onchange={() => (pageNum = 1)}
        >
          <option value="all">Alle Typen</option>
          <option value="invoice">Rechnung</option>
          <option value="offer">Angebot</option>
          <option value="cost_estimate">Kostenvoranschlag</option>
          <option value="reminder">Mahnung</option>
          <option value="payslip">Lohnzettel</option>
          <option value="mailing">Serienbrief</option>
        </select>
      {/snippet}
    </Toolbar>
  {/snippet}
</PageHeader>

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
        <table class="table-zebra table">
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
              <tr>
                <td class="whitespace-nowrap">{fmt(m.sentAt)}</td>
                <td
                  ><span class="badge badge-ghost badge-sm"
                    >{m.documentType}</span
                  ></td
                >
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
