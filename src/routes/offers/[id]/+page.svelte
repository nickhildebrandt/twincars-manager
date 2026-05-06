<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import { ArrowRight, FileText, Send, XCircle } from '@lucide/svelte'
  import {
    cancelOfferRemote,
    getOfferRemote,
    sendOfferRemote
  } from '../offers.remote'
  import PdfViewer from '$lib/components/ui/PdfViewer.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { formatEuro } from '$lib/utils/money'
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'
  import { handleClientError } from '$lib/utils/client-error'
  import {
    documentStatusBadge,
    documentStatusLabel,
    documentTypeLabel
  } from '$lib/utils/status-labels'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the data, hydration reuses the cache. */
  const data = await getOfferRemote({ id })

  const isConverted = $derived(
    data.doc.status === 'converted' || !!data.doc.convertedToInvoiceId
  )
  const isCancelled = $derived(data.doc.status === 'cancelled')
  const isCreated = $derived(
    data.doc.status === 'created' || data.doc.status === 'draft'
  )
  const isSent = $derived(data.doc.status === 'sent')

  /**
   * Header CTA chooses the next step in the documented lifecycle:
   *   created → versenden
   *   sent    → in Rechnung umwandeln
   *   converted/cancelled → no CTA
   */
  let sendOpen = $state(false)
  let cancelOpen = $state(false)

  const sendOffer = async () => {
    try {
      await busy.run(() => sendOfferRemote({ id }))
      toast.success('Versendet.')
    } catch (err) {
      handleClientError(err)
    }
  }

  const cancelOffer = async () => {
    try {
      await busy.run(() => cancelOfferRemote({ id }))
      toast.success('Kostenvoranschlag storniert.')
    } catch (err) {
      handleClientError(err)
    }
  }

  const headerAction = $derived.by(() => {
    if (isConverted || isCancelled) return undefined
    if (isCreated)
      return {
        label: 'Versenden',
        onClick: () => (sendOpen = true),
        icon: Send
      }
    if (isSent)
      return {
        label: 'In Rechnung umwandeln',
        href: `/offers/${id}/convert`,
        icon: ArrowRight
      }
    return undefined
  })
</script>

<PageHeader
  title={`${documentTypeLabel(data.doc.type)} ${data.doc.documentNumber}`}
  back="/offers"
  primaryAction={headerAction}
/>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
  {#if isConverted && data.doc.convertedToInvoiceId}
    <div class="alert alert-info lg:col-span-3">
      <FileText size={20} />
      <div>
        <div class="font-medium">In Rechnung überführt</div>
        <div class="text-sm">
          Dieser Kostenvoranschlag wurde bereits in eine Rechnung umgewandelt.
        </div>
      </div>
      <a
        class="btn btn-sm gap-1"
        href={`/invoices/${data.doc.convertedToInvoiceId}`}
      >
        Zur Rechnung
        <ArrowRight size={14} />
      </a>
    </div>
  {/if}

  <div class="card border-base-300 bg-base-100 border lg:col-span-2">
    <div class="card-body p-0">
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Beschreibung</th>
              <th class="text-right">Menge</th>
              <th class="text-right">Einzelpreis</th>
              <th class="text-right">MwSt</th>
              <th class="text-right">Brutto</th>
            </tr>
          </thead>
          <tbody>
            {#each data.items as it (it.id)}
              <tr
                class={it.articleNumber
                  ? 'hover:bg-base-200 cursor-pointer'
                  : ''}
                onclick={it.articleNumber
                  ? () =>
                      goto(`/items?q=${encodeURIComponent(it.articleNumber!)}`)
                  : undefined}
              >
                <td>{it.positionNumber}</td>
                <td>
                  <div>{it.description}</div>
                  {#if it.articleNumber}
                    <div class="text-base-content/50 font-mono text-xs">
                      {it.articleNumber}
                    </div>
                  {/if}
                </td>
                <td class="text-right">
                  {Number(it.quantity)}
                  {it.unit ?? ''}
                </td>
                <td class="text-right font-mono">
                  {formatEuro(Number(it.unitPriceNet))}
                </td>
                <td class="text-right">{Number(it.taxRate)} %</td>
                <td class="text-right font-mono">
                  {formatEuro(Number(it.lineTotalGross))}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body">
      <h3 class="card-title text-base">Summen</h3>
      <dl class="grid grid-cols-2 gap-y-1 text-sm">
        <dt class="text-base-content/60">Status</dt>
        <dd class="text-right">
          <span class="badge badge-sm {documentStatusBadge(data.doc.status)}">
            {documentStatusLabel(data.doc.status)}
          </span>
        </dd>
        <dt class="text-base-content/60">Datum</dt>
        <dd class="text-right">{data.doc.issueDate}</dd>
        <dt class="text-base-content/60">Gültig bis</dt>
        <dd class="text-right">{data.doc.dueDate ?? '—'}</dd>
        <dt class="text-base-content/60">Netto</dt>
        <dd class="text-right font-mono"
          >{formatEuro(Number(data.doc.netTotal))}</dd
        >
        <dt class="text-base-content/60">MwSt</dt>
        <dd class="text-right font-mono"
          >{formatEuro(Number(data.doc.taxTotal))}</dd
        >
        <dt class="text-base-content/60">Rabatt</dt>
        <dd class="text-right font-mono"
          >{formatEuro(Number(data.doc.discountTotal))}</dd
        >
        <dt class="font-semibold">Brutto</dt>
        <dd class="text-right font-mono font-semibold"
          >{formatEuro(Number(data.doc.grossTotal))}</dd
        >
      </dl>
      {#if isSent}
        <div class="card-actions mt-2 justify-end">
          <button
            type="button"
            class="btn btn-ghost btn-sm text-error gap-1"
            onclick={() => (cancelOpen = true)}
            disabled={busy.active}
          >
            <XCircle size={14} />
            Stornieren
          </button>
        </div>
      {/if}
    </div>
  </div>

  {#if data.doc.footer}
    <div class="card border-base-300 bg-base-100 border lg:col-span-3">
      <div class="card-body">
        <h3 class="card-title text-base">Endtext</h3>
        <p class="text-sm whitespace-pre-line">{data.doc.footer}</p>
      </div>
    </div>
  {/if}

  <div class="lg:col-span-3">
    <PdfViewer documentId={data.doc.id} />
  </div>
</div>

<ConfirmDialog
  bind:open={sendOpen}
  title="Per E-Mail senden?"
  message="Das Dokument wird mit der hinterlegten SMTP-Konfiguration an den Kunden geschickt."
  confirmLabel="Jetzt senden"
  variant="primary"
  onConfirm={sendOffer}
  onClose={() => {}}
/>

<ConfirmDialog
  bind:open={cancelOpen}
  title="Kostenvoranschlag stornieren?"
  message="Der Kostenvoranschlag bleibt zur Historie erhalten, ist aber als storniert gekennzeichnet."
  confirmLabel="Stornieren"
  variant="danger"
  onConfirm={cancelOffer}
  onClose={() => {}}
/>
