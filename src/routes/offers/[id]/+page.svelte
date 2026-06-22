<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import {
    ArrowRight,
    Clock,
    FileText,
    Send,
    Trash2,
    XCircle
  } from '@lucide/svelte'
  import {
    cancelOfferRemote,
    getOfferRemote,
    sendOfferRemote
  } from '../offers.remote'
  import {
    deleteTimeEntryRemote,
    listTimeEntriesRemote
  } from '../../hours/hours.remote'
  import { getCurrentUserRemote } from '../../layout.remote'
  import PdfViewer from '$lib/components/ui/PdfViewer.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import QuickTimeEntryModal from '$lib/components/ui/QuickTimeEntryModal.svelte'
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
  const [data, currentUser] = await Promise.all([
    getOfferRemote({ id }),
    getCurrentUserRemote()
  ])

  const timeEntriesQ = $derived(
    listTimeEntriesRemote({ page: 1, size: 25, documentId: id })
  )
  const timeEntriesInitial = await untrack(() => timeEntriesQ)
  let lastTimeEntries = $state(timeEntriesInitial)
  $effect(() => {
    if (timeEntriesQ.current) lastTimeEntries = timeEntriesQ.current
  })
  const timeEntries = $derived(timeEntriesQ.current ?? lastTimeEntries)

  const callerPermissions = $derived(new Set(currentUser?.permissions ?? []))
  const hasAny = (...keys: string[]): boolean =>
    callerPermissions.has('*') || keys.some((k) => callerPermissions.has(k))
  const canLogHours = $derived(hasAny('hours', 'hours:write_own'))

  const fmtDate = (s: string | null | undefined) => {
    if (!s) return '—'
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
    return m ? `${m[3]}.${m[2]}.${m[1]}` : s
  }

  const removeTimeEntry = async (entryId: string) => {
    try {
      await busy.run(() => deleteTimeEntryRemote({ id: entryId }))
      toast.success('Eintrag gelöscht.')
    } catch (err) {
      handleClientError(err, 'Eintrag konnte nicht gelöscht werden')
    }
  }

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
  let logHoursOpen = $state(false)

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

{#if canLogHours}
  <div class="mb-4 flex justify-end">
    <button
      type="button"
      class="btn btn-sm gap-2"
      onclick={() => (logHoursOpen = true)}
      disabled={busy.active}
    >
      <Clock size={14} />
      Arbeit erfassen
    </button>
  </div>
{/if}

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

  {#if timeEntries.items.length > 0}
    <div class="card border-base-300 bg-base-100 border lg:col-span-3">
      <div class="card-body p-0">
        <div class="border-base-300 border-b px-4 py-3">
          <h3 class="text-base font-semibold">Erfasste Stunden</h3>
          <p class="text-base-content/60 text-sm">
            Stundeneinträge, die auf dieses Dokument verbucht wurden.
          </p>
        </div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Mitarbeiter</th>
                <th>Aufgabe</th>
                <th class="text-right">Stunden</th>
                <th class="text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {#each timeEntries.items as t (t.id)}
                {@const mine = t.employeeId === currentUser?.id}
                {@const canDelete =
                  callerPermissions.has('*') ||
                  callerPermissions.has('hours') ||
                  (callerPermissions.has('hours:write_own') && mine)}
                <tr>
                  <td>{fmtDate(t.date)}</td>
                  <td>
                    {[t.employeeFirstName, t.employeeLastName]
                      .filter(Boolean)
                      .join(' ') || t.employeeNumber}
                  </td>
                  <td>{t.task ?? '—'}</td>
                  <td class="text-right font-mono"
                    >{Number(t.hours).toFixed(2)}</td
                  >
                  <td class="text-right">
                    {#if canDelete}
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs text-error gap-1"
                        onclick={() => removeTimeEntry(t.id)}
                        disabled={busy.active}
                      >
                        <Trash2 size={14} />
                        Löschen
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
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

<QuickTimeEntryModal
  bind:open={logHoursOpen}
  documentId={data.doc.id}
  onClose={() => {}}
/>
