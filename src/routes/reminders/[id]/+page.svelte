<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import PdfViewer from '$lib/components/ui/PdfViewer.svelte'
  import { ArrowRight, Receipt } from '@lucide/svelte'
  import { formatEuro } from '$lib/utils/money'
  import { getReminderRemote } from '../reminders.remote'

  const id = untrack(() => page.params.id!)

  /** SSR-friendly load via top-level await; reminder rows are small. */
  const reminder = await getReminderRemote({ id })

  const total = $derived(reminder.invoiceGross)

  /**
   * Each Zahlungserinnerung is the N-th friendly reminder for its
   * invoice — there is no escalation, so the badge just shows the
   * sequence number.
   */
  const typeLabel = $derived(
    reminder.level === 1
      ? 'Zahlungserinnerung'
      : `Zahlungserinnerung (${reminder.level}. Erinnerung)`
  )

  const fmt = (s: string | null | undefined) => {
    if (!s) return '—'
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
    return m ? `${m[3]}.${m[2]}.${m[1]}` : s
  }
</script>

<PageHeader
  title={`${typeLabel} ${reminder.documentNumber}`}
  back="/reminders"
/>

<div class="alert alert-info mb-4">
  <Receipt size={20} />
  <div>
    <div class="font-medium">
      Zahlungserinnerung zur Rechnung {reminder.invoiceNumber}
    </div>
    <div class="text-sm">
      Diese Zahlungserinnerung bezieht sich auf eine offene Rechnung. Über die
      Schaltfläche gelangen Sie direkt zur Rechnung.
    </div>
  </div>
  <a class="btn btn-sm gap-1" href={`/invoices/${reminder.invoiceId}`}>
    Zur Rechnung
    <ArrowRight size={14} />
  </a>
</div>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
  <div class="space-y-4">
    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body gap-3">
        <h3 class="card-title text-base">Forderungsaufstellung</h3>
        <table class="table-sm table">
          <tbody>
            <tr>
              <td>Offene Rechnung {reminder.invoiceNumber}</td>
              <td class="text-right font-mono"
                >{formatEuro(reminder.invoiceGross)}</td
              >
            </tr>
            <tr>
              <td class="font-semibold">Offener Betrag</td>
              <td class="text-right font-mono font-semibold"
                >{formatEuro(total)}</td
              >
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <PdfViewer documentId={reminder.id} kind="reminder" />
  </div>

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-2 text-sm">
      <h3 class="card-title text-base">Details</h3>
      <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt class="text-base-content/60">Typ</dt>
        <dd>
          <span class="badge badge-sm badge-info">
            {reminder.level}. Zahlungserinnerung
          </span>
        </dd>
        <dt class="text-base-content/60">Datum</dt>
        <dd>{fmt(reminder.issueDate)}</dd>
        <dt class="text-base-content/60">Zahlbar bis</dt>
        <dd>{fmt(reminder.dueDate)}</dd>
        <dt class="text-base-content/60">Kunde</dt>
        <dd>{reminder.customerName ?? '—'}</dd>
        <dt class="text-base-content/60">Rechnung</dt>
        <dd>
          <a class="link link-primary" href={`/invoices/${reminder.invoiceId}`}>
            {reminder.invoiceNumber}
          </a>
        </dd>
      </dl>
      {#if reminder.notes}
        <p class="text-base-content/70 mt-2 whitespace-pre-line">
          {reminder.notes}
        </p>
      {/if}
    </div>
  </div>
</div>
