<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import PdfViewer from '$lib/components/ui/PdfViewer.svelte'
  import { AlertTriangle } from '@lucide/svelte'
  import { getSentMessageRemote } from '../sent.remote'
  import { documentTypeLabel } from '$lib/utils/status-labels'

  const id = untrack(() => page.params.id!)

  /** SSR-friendly load. */
  const msg = await getSentMessageRemote({ id })

  const fmtDateTime = (d: Date | string) => {
    const dt = typeof d === 'string' ? new Date(d) : d
    return dt.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const statusBadge = (s: string) =>
    s === 'failed'
      ? 'badge-error'
      : s === 'sent'
        ? 'badge-success'
        : 'badge-warning'
  const statusLabel = (s: string) =>
    s === 'failed'
      ? 'Fehlgeschlagen'
      : s === 'sent'
        ? 'Versendet'
        : s === 'pending'
          ? 'In Versand'
          : s
</script>

<PageHeader title={msg.subject} back="/sent" />

<div class="flex flex-col gap-4">
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-2">
      <h3 class="card-title text-base">Kopfdaten</h3>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt class="text-base-content/60">Empfänger</dt>
        <dd>
          {#if msg.recipientName}
            {msg.recipientName} —
          {/if}
          <span class="font-mono text-xs">{msg.recipientEmail}</span>
        </dd>
        <dt class="text-base-content/60">Datum</dt>
        <dd>{fmtDateTime(msg.sentAt)}</dd>
        <dt class="text-base-content/60">Typ</dt>
        <dd>{documentTypeLabel(msg.documentType)}</dd>
        <dt class="text-base-content/60">Status</dt>
        <dd>
          <span class="badge badge-sm {statusBadge(msg.status)}">
            {statusLabel(msg.status)}
          </span>
        </dd>
        {#if msg.smtpMessageId}
          <dt class="text-base-content/60">Message-ID</dt>
          <dd class="font-mono text-xs break-all">{msg.smtpMessageId}</dd>
        {/if}
      </dl>
      {#if msg.status === 'failed' && msg.errorMessage}
        <div class="alert alert-error mt-2 text-sm">
          <AlertTriangle size={16} />
          <div>
            <div class="font-medium">SMTP-Fehler</div>
            <div class="font-mono text-xs">{msg.errorMessage}</div>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-2">
      <h3 class="card-title text-base">Nachricht</h3>
      <pre class="font-sans text-sm whitespace-pre-wrap">{msg.bodyText}</pre>
    </div>
  </div>

  {#if msg.pdfKind && msg.documentId}
    <PdfViewer documentId={msg.documentId} kind={msg.pdfKind} />
  {/if}
</div>
