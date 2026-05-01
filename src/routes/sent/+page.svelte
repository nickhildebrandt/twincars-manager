<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import { Send } from '@lucide/svelte'
  import { listSentRemote } from './sent.remote'
  import { handleClientError } from '$lib/utils/client-error'

  let page = $state(1)
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

  const sQ = $derived(listSentRemote({ page, size, q: q || undefined, type }))
  const items = $derived(sQ.current?.items ?? [])
  const total = $derived(sQ.current?.total ?? 0)
  const pageCount = $derived(sQ.current?.pageCount ?? 1)
  const loading = $derived(sQ.loading)

  $effect(() => {
    if (sQ.error) handleClientError(sQ.error)
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
      onQuery={() => (page = 1)}
    >
      {#snippet filters()}
        <select
          class="select select-sm select-bordered"
          bind:value={type}
          onchange={() => (page = 1)}
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
    {#if loading && items.length > 0}
      <Loader variant="bar" />
    {/if}
    {#if loading && items.length === 0}
      <Loader />
    {:else if items.length === 0}
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
                    class="badge badge-sm"
                    class:badge-success={m.status === 'sent'}
                    class:badge-error={m.status === 'failed'}
                  >
                    {m.status}
                  </span>
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
