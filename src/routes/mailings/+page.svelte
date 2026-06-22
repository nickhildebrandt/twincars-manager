<script lang="ts">
  import { untrack } from 'svelte'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import EmailComposer, {
    type ComposerAttachment
  } from '$lib/components/ui/EmailComposer.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import { Send } from '@lucide/svelte'
  import {
    listBroadcastHistoryRemote,
    previewBroadcastRecipientsRemote,
    sendBroadcastEmailRemote
  } from './mailings.remote'
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'
  import { handleClientError } from '$lib/utils/client-error'
  import {
    sentMessageStatusBadge,
    sentMessageStatusLabel
  } from '$lib/utils/status-labels'

  /**
   * SSR-friendly parallel load. Server hands us both the recipient
   * preview AND the recent broadcast history in one round-trip; both
   * queries are cheap (bounded by Limit 10).
   */
  const previewQuery = untrack(() => previewBroadcastRecipientsRemote())
  const historyQuery = untrack(() => listBroadcastHistoryRemote())
  const [preview, history] = await Promise.all([previewQuery, historyQuery])

  let subject = $state('')
  let body = $state('')
  let asHtml = $state(false)
  let attachments = $state<ComposerAttachment[]>([])

  let confirmOpen = $state(false)

  const canCompose = $derived(preview.totalWithEmail > 0)
  const canSend = $derived(
    canCompose && subject.trim().length > 0 && body.trim().length > 0
  )

  const sendBroadcast = async () => {
    try {
      const result = await busy.run(() =>
        sendBroadcastEmailRemote({
          subject: subject.trim(),
          body,
          asHtml,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            mime: a.mime,
            base64Data: a.base64Data
          }))
        })
      )
      if (result.failed.length === 0) {
        toast.success(`Serienbrief versendet an ${result.sent} Empfänger.`)
      } else {
        toast.warning(
          `Serienbrief: ${result.sent} erfolgreich, ${result.failed.length} fehlgeschlagen.`
        )
      }
      subject = ''
      body = ''
      asHtml = false
      attachments = []
    } catch (err) {
      handleClientError(err, 'Serienbrief konnte nicht versendet werden')
    }
  }

  const fmt = (d: Date | string) => new Date(d).toLocaleString('de-DE')
</script>

<PageHeader
  title="Serienbriefe"
  subtitle="Newsletter / Rundschreiben an Kunden mit Newsletter-Opt-in."
/>

<div class="grid grid-cols-1 gap-4">
  <!-- Recipient-count card -->
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-2">
      <h3 class="card-title text-base">Empfänger</h3>
      {#if preview.totalWithEmail === 0}
        <p class="text-base-content/70 text-sm">
          Aktuell ist kein Kunde mit Newsletter-Opt-in und hinterlegter
          E-Mail-Adresse vorhanden. Aktivieren Sie das Häkchen „Newsletter" auf
          einer Kundenkarte, um Empfänger hinzuzufügen.
        </p>
      {:else}
        <p class="text-sm">
          <span class="font-semibold">{preview.totalWithEmail}</span>
          {preview.totalWithEmail === 1 ? 'Kunde' : 'Kunden'} mit Newsletter-Opt-in.
          {#if preview.totalOptIn > preview.totalWithEmail}
            <span class="text-base-content/60">
              ({preview.totalOptIn - preview.totalWithEmail} ohne hinterlegte E-Mail-Adresse
              werden übersprungen.)
            </span>
          {/if}
        </p>
        {#if preview.sampleNames.length > 0}
          <p class="text-base-content/60 text-xs">
            z.&nbsp;B. {preview.sampleNames.join(', ')}
            {#if preview.totalWithEmail > preview.sampleNames.length}
              und {preview.totalWithEmail - preview.sampleNames.length} weitere
            {/if}
          </p>
        {/if}
      {/if}
    </div>
  </div>

  <!-- Composer card -->
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-4">
      <h3 class="card-title text-base">Nachricht verfassen</h3>
      <EmailComposer
        bind:subject
        bind:body
        bind:attachments
        bind:asHtml
        allowHtml
        disabled={!canCompose}
        hint="Empfänger erhalten die Nachricht via BCC — Adressen werden nicht untereinander sichtbar. Eine Abbestellen-Fußzeile wird automatisch angehängt."
      />
      <div class="card-actions justify-end">
        <button
          type="button"
          class="btn btn-primary gap-2"
          onclick={() => (confirmOpen = true)}
          disabled={!canSend || busy.active}
        >
          {#if busy.active}
            <span class="loading loading-spinner loading-sm"></span>
          {/if}
          <Send size={14} />
          Senden
        </button>
      </div>
    </div>
  </div>

  <!-- History card -->
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body p-0">
      <div class="border-base-300 border-b px-4 py-3">
        <h3 class="text-base font-semibold">Letzte Versände</h3>
        <p class="text-base-content/60 text-sm">
          Die jüngsten zehn Empfänger-Zeilen aus den Serienbrief-Versänden.
        </p>
      </div>
      {#if history.length === 0}
        <EmptyState
          icon={Send}
          title="Noch keine Serienbriefe versendet"
          description="Sobald Sie einen Newsletter versenden, erscheinen die Empfänger hier."
        />
      {:else}
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Empfänger</th>
                <th>Betreff</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {#each history as h (h.id)}
                <tr>
                  <td class="whitespace-nowrap">{fmt(h.sentAt)}</td>
                  <td>
                    {h.recipientName ?? ''}
                    &lt;{h.recipientEmail}&gt;
                  </td>
                  <td>{h.subject}</td>
                  <td>
                    <span
                      class="badge badge-sm {sentMessageStatusBadge(h.status)}"
                    >
                      {sentMessageStatusLabel(h.status)}
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
</div>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Serienbrief senden"
  message={`${preview.totalWithEmail} ${preview.totalWithEmail === 1 ? 'Empfänger' : 'Empfänger'} anschreiben?`}
  confirmLabel="Jetzt senden"
  variant="primary"
  onConfirm={sendBroadcast}
  onClose={() => (confirmOpen = false)}
/>
