<script lang="ts">
  import { untrack } from 'svelte'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import { Inbox, RefreshCw } from '@lucide/svelte'
  import {
    listInquiriesRemote,
    retryInquiryNotificationRemote
  } from '../inquiries.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  type Status = 'all' | 'pending' | 'sent' | 'failed'

  let pageNum = $state(1)
  const size = 25
  let status = $state<Status>('all')

  const query = $derived(
    listInquiriesRemote({
      page: pageNum,
      size,
      status: status === 'all' ? undefined : status
    })
  )

  /** Top-level await: SSR carries the data, hydration reuses the cache. */
  const initial = await untrack(() => query)

  /**
   * Cache last successful result so filter / pagination changes don't
   * flash an empty table while the refetch is in flight — same
   * stale-while-revalidate pattern as `/sent`.
   */
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

  const setStatus = (s: Status) => {
    status = s
    pageNum = 1
  }

  const retry = async (id: string) => {
    try {
      const res = await busy.run(() => retryInquiryNotificationRemote({ id }))
      if (res.ok) {
        toast.success('Benachrichtigung erneut gesendet.')
      } else {
        toast.error(`Versand fehlgeschlagen: ${res.error}`)
      }
    } catch (err) {
      handleClientError(
        err,
        'Benachrichtigung konnte nicht erneut gesendet werden'
      )
    }
  }

  const fmtDateTime = (d: Date | string | null | undefined): string => {
    if (!d) return '—'
    const dt = typeof d === 'string' ? new Date(d) : d
    return dt.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const statusBadge = (s: string): { label: string; cls: string } => {
    if (s === 'sent') return { label: 'Versendet', cls: 'badge-success' }
    if (s === 'failed') return { label: 'Fehlgeschlagen', cls: 'badge-error' }
    return { label: 'Ausstehend', cls: 'badge-ghost' }
  }
</script>

<PageHeader
  title="Anfragen"
  subtitle="Eingehende Kontaktanfragen von der Webseite und der Status der Benachrichtigungs-E-Mail."
  back="/settings"
/>

<div class="card border-base-300 bg-base-100 mb-4 border">
  <div class="card-body flex-row flex-wrap gap-2 p-3">
    <button
      type="button"
      class="btn btn-sm"
      class:btn-primary={status === 'all'}
      onclick={() => setStatus('all')}
    >
      Alle
    </button>
    <button
      type="button"
      class="btn btn-sm"
      class:btn-primary={status === 'pending'}
      onclick={() => setStatus('pending')}
    >
      Ausstehend
    </button>
    <button
      type="button"
      class="btn btn-sm"
      class:btn-primary={status === 'sent'}
      onclick={() => setStatus('sent')}
    >
      Versendet
    </button>
    <button
      type="button"
      class="btn btn-sm"
      class:btn-primary={status === 'failed'}
      onclick={() => setStatus('failed')}
    >
      Fehlgeschlagen
    </button>
  </div>
</div>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if items.length === 0}
      <EmptyState
        icon={Inbox}
        title="Keine Anfragen"
        description="Sobald Besucher der Webseite das Kontaktformular nutzen, erscheinen die Anfragen hier."
      />
    {:else}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Eingegangen</th>
              <th>Von</th>
              <th>Betreff</th>
              <th>Bezug</th>
              <th>Benachrichtigung</th>
              <th class="w-32 text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as inq (inq.id)}
              {@const s = statusBadge(inq.notificationStatus)}
              <tr>
                <td class="text-sm">{fmtDateTime(inq.createdAt)}</td>
                <td>
                  <div class="font-medium">{inq.customerName}</div>
                  <div class="text-base-content/60 text-xs">
                    {inq.customerEmail}
                  </div>
                </td>
                <td class="max-w-xs truncate">{inq.subject}</td>
                <td class="text-xs">
                  {inq.referenceType ?? '—'}
                </td>
                <td>
                  <span class="badge {s.cls} badge-sm">{s.label}</span>
                  {#if inq.notificationStatus === 'failed' && inq.notificationError}
                    <div
                      class="text-error mt-1 max-w-xs truncate text-xs"
                      title={inq.notificationError}
                    >
                      {inq.notificationError}
                    </div>
                  {/if}
                  {#if inq.notificationSentAt}
                    <div class="text-base-content/60 mt-1 text-xs">
                      {fmtDateTime(inq.notificationSentAt)}
                    </div>
                  {/if}
                </td>
                <td>
                  <div class="flex justify-end">
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm gap-1"
                      disabled={busy.active}
                      onclick={() => retry(inq.id)}
                      aria-label="Benachrichtigung erneut senden"
                    >
                      <RefreshCw size={14} /> Erneut senden
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <Pagination
        page={pageNum}
        {pageCount}
        {total}
        onPage={(p) => (pageNum = p)}
      />
    {/if}
  </div>
</div>
