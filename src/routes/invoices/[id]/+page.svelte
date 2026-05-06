<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import {
    ArrowRight,
    BellRing,
    Car,
    CheckCircle2,
    Send,
    User
  } from '@lucide/svelte'
  import {
    getInvoiceRemote,
    sendInvoiceRemote,
    setInvoiceStatusRemote
  } from '../invoices.remote'
  import {
    createReminderRemote,
    listRemindersForInvoiceRemote
  } from '../../reminders/reminders.remote'
  import PdfViewer from '$lib/components/ui/PdfViewer.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import {
    documentStatusBadge,
    documentStatusLabel,
    reminderLevelLabel
  } from '$lib/utils/status-labels'
  import { formatEuro } from '$lib/utils/money'

  const id = untrack(() => page.params.id!)

  /**
   * Top-level await on the remote query — SSR carries the rendered invoice
   * on first byte, hydration reuses the dehydrated cache without a fetch.
   * The reminder list is loaded in parallel; it's a small query and fits the
   * same SSR-hydration story.
   */
  const [data, invoiceReminders] = await Promise.all([
    getInvoiceRemote({ id }),
    listRemindersForInvoiceRemote({ invoiceId: id })
  ])

  /** Most recent reminder drives the banner CTA. */
  const latestReminder = $derived(
    invoiceReminders.length
      ? invoiceReminders[invoiceReminders.length - 1]
      : null
  )

  const markPaid = async () => {
    try {
      await busy.run(() => setInvoiceStatusRemote({ id, status: 'paid' }))
      toast.success('Rechnung als bezahlt markiert.')
    } catch (err) {
      handleClientError(err)
    }
  }

  let sendOpen = $state(false)
  let reminderOpen = $state(false)

  const sendInvoice = async () => {
    try {
      await busy.run(() => sendInvoiceRemote({ id }))
      toast.success('Rechnung versendet.')
    } catch (err) {
      handleClientError(err)
    }
  }

  /**
   * Erzeugt die nächste Mahnstufe (0 → Zahlungserinnerung,
   * 1 → 1. Mahnung, …). Der Server-Service ermittelt den Level
   * automatisch — wir müssen ihn nicht angeben.
   */
  const createReminder = async () => {
    try {
      const reminder = await busy.run(() =>
        createReminderRemote({ invoiceId: id })
      )
      toast.success('Mahnung angelegt.')
      goto(`/reminders/${reminder.id}`)
    } catch (err) {
      handleClientError(err)
    }
  }

  /** Rechnung ist überfällig wenn dueDate < heute und nicht bezahlt. */
  const isOverdue = $derived.by(() => {
    if (data.doc.status === 'paid' || data.doc.status === 'cancelled')
      return false
    if (!data.doc.dueDate) return false
    const today = new Date().toISOString().slice(0, 10)
    return data.doc.dueDate < today
  })
  const canEscalate = $derived(isOverdue && data.doc.reminderLevel < 4)

  /**
   * Header CTA reflects the next step in the lifecycle:
   *   created → versenden
   *   sent    → als bezahlt markieren
   *   paid    → no CTA (terminal)
   * Mahnstufen werden über das Mahnungs-Modul gestiegert; hier nicht.
   */
  const headerAction = $derived.by(() => {
    if (data.doc.status === 'paid' || data.doc.status === 'cancelled')
      return undefined
    if (data.doc.status === 'sent')
      return {
        label: 'Als bezahlt markieren',
        onClick: markPaid,
        icon: CheckCircle2
      }
    return { label: 'Versenden', onClick: () => (sendOpen = true), icon: Send }
  })
</script>

<PageHeader
  title={`Rechnung ${data.doc.documentNumber}`}
  back="/invoices"
  primaryAction={headerAction}
/>

{#if latestReminder}
  <!--
    Banner shows ONLY the link to the *latest* reminder. The full
    reminder history lives in the Mahnungen card below — keeps the
    banner short and the entry point unambiguous (Rechnung → aktuelle
    Mahnung; ältere Mahnungen → aktuelle Mahnung → Rechnung).
  -->
  <div class="alert alert-warning mb-4">
    <BellRing size={20} />
    <div>
      <div class="font-medium">
        Gemahnt — aktuelle Stufe: {reminderLevelLabel(latestReminder.level)}
      </div>
      <div class="text-sm">
        {invoiceReminders.length === 1
          ? 'Zu dieser Rechnung wurde 1 Mahnung erzeugt.'
          : `Zu dieser Rechnung wurden ${invoiceReminders.length} Mahnungen erzeugt.`}
      </div>
    </div>
    {#if canEscalate}
      <button
        type="button"
        class="btn btn-sm btn-warning gap-1"
        onclick={() => (reminderOpen = true)}
        disabled={busy.active}
      >
        <BellRing size={14} />
        Nächste Stufe erzeugen
      </button>
    {/if}
    <a class="btn btn-sm gap-1" href={`/reminders/${latestReminder.id}`}>
      Zur aktuellen Mahnung
      <ArrowRight size={14} />
    </a>
  </div>
{:else if isOverdue}
  <!--
    Erste Mahnstufe ist noch nie erzeugt worden. Banner blinkt nicht
    selbst — er bietet nur den klaren CTA, den ersten Schritt zu
    starten. Die Levels werden vom Server automatisch berechnet.
  -->
  <div class="alert alert-warning mb-4">
    <BellRing size={20} />
    <div>
      <div class="font-medium">Rechnung überfällig</div>
      <div class="text-sm">
        Die Fälligkeit ist überschritten. Eine Zahlungserinnerung kann jetzt
        erzeugt werden.
      </div>
    </div>
    <button
      type="button"
      class="btn btn-sm btn-warning gap-1"
      onclick={createReminder}
      disabled={busy.active}
    >
      <BellRing size={14} />
      Zahlungserinnerung erzeugen
    </button>
  </div>
{/if}

<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
              <!--
                Konsistent mit den anderen Tabellen der App: ganze
                Zeile ist klickbar wenn die Position auf einen festen
                Artikel/Leistung verweist (`articleNumber` gesetzt).
                Hover hebt die Zeile hervor wie bei Kunden/Fahrzeugen
                /Terminen. Free-Text-Positionen bleiben statisch.
              -->
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
        <dt class="text-base-content/60">Fällig</dt>
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
    </div>
  </div>

  <!--
    Kunde + Fahrzeug — Stammdaten zur Rechnung verknüpft. Identische
    Karten-Form wie auf der Vehicle-Detail-Seite, sodass die zwei
    Module visuell konsistent bleiben.
  -->
  {#if data.customer}
    {@const c = data.customer}
    <div class="card border-base-300 bg-base-100 border lg:col-span-2">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <h3 class="card-title text-base">
            <User size={18} class="text-base-content/60" />
            Kunde
          </h3>
          <a class="btn btn-ghost btn-sm" href={`/customers/${c.id}`}>
            Zum Kunden
          </a>
        </div>
        <dl class="grid grid-cols-3 gap-y-1 text-sm">
          <dt class="text-base-content/60">Kundennr.</dt>
          <dd class="col-span-2 font-mono">{c.customerNumber}</dd>
          <dt class="text-base-content/60">Name</dt>
          <dd class="col-span-2">
            {c.company ||
              `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() ||
              '—'}
          </dd>
          <dt class="text-base-content/60">Telefon</dt>
          <dd class="col-span-2">{c.phone ?? '—'}</dd>
          <dt class="text-base-content/60">E-Mail</dt>
          <dd class="col-span-2">{c.email ?? '—'}</dd>
        </dl>
      </div>
    </div>
  {/if}

  {#if data.vehicle}
    {@const v = data.vehicle}
    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <h3 class="card-title text-base">
            <Car size={18} class="text-base-content/60" />
            Fahrzeug
          </h3>
          <a class="btn btn-ghost btn-sm" href={`/vehicles/${v.id}`}>
            Zum Fahrzeug
          </a>
        </div>
        <dl class="grid grid-cols-3 gap-y-1 text-sm">
          <dt class="text-base-content/60">Kennzeichen</dt>
          <dd class="col-span-2 font-mono">{v.licensePlate ?? '—'}</dd>
          <dt class="text-base-content/60">Marke / Modell</dt>
          <dd class="col-span-2">
            {[v.make, v.model].filter(Boolean).join(' ') || '—'}
          </dd>
          <dt class="text-base-content/60">FIN</dt>
          <dd class="col-span-2 font-mono text-xs">{v.vin ?? '—'}</dd>
          <dt class="text-base-content/60">EZ</dt>
          <dd class="col-span-2">{v.firstRegistration ?? '—'}</dd>
          <dt class="text-base-content/60">km-Stand</dt>
          <dd class="col-span-2">
            {v.mileageKm
              ? Number(v.mileageKm).toLocaleString('de-DE') + ' km'
              : '—'}
          </dd>
        </dl>
      </div>
    </div>
  {/if}

  {#if data.doc.footer}
    <div class="card border-base-300 bg-base-100 border lg:col-span-3">
      <div class="card-body">
        <h3 class="card-title text-base">Endtext</h3>
        <p class="text-sm whitespace-pre-line">{data.doc.footer}</p>
      </div>
    </div>
  {/if}

  {#if invoiceReminders.length > 0}
    <div class="card border-base-300 bg-base-100 border lg:col-span-3">
      <div class="card-body p-0">
        <div class="border-base-300 border-b px-4 py-3">
          <h3 class="text-base font-semibold">Mahnungen-Verlauf</h3>
          <p class="text-base-content/60 text-sm">
            Vollständige Historie aller bisher zur Rechnung erzeugten
            Mahnstufen.
          </p>
        </div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Nummer</th>
                <th>Datum</th>
                <th>Stufe</th>
                <th class="text-right">Gebühr</th>
                <th class="text-right">Zinsen</th>
                <th>Zahlbar bis</th>
                <th class="text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {#each invoiceReminders as r (r.id)}
                <tr
                  class="hover:bg-base-200 cursor-pointer"
                  onclick={() => goto(`/reminders/${r.id}`)}
                >
                  <td class="font-mono text-xs font-medium"
                    >{r.documentNumber}</td
                  >
                  <td>{r.issueDate}</td>
                  <td>{reminderLevelLabel(r.level)}</td>
                  <td class="text-right font-mono"
                    >{formatEuro(Number(r.fee))}</td
                  >
                  <td class="text-right font-mono"
                    >{formatEuro(Number(r.interest))}</td
                  >
                  <td>{r.dueDate}</td>
                  <td class="text-right">
                    <a
                      class="btn btn-ghost btn-xs"
                      href={`/reminders/${r.id}`}
                      onclick={(e) => e.stopPropagation()}
                    >
                      Details
                    </a>
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
  title="Rechnung per E-Mail senden?"
  message="Die Rechnung wird mit der hinterlegten SMTP-Konfiguration an den Kunden geschickt."
  confirmLabel="Jetzt senden"
  variant="primary"
  onConfirm={sendInvoice}
  onClose={() => {}}
/>

<ConfirmDialog
  bind:open={reminderOpen}
  title="Nächste Mahnstufe erzeugen?"
  message="Es wird eine Mahnung der nächsthöheren Stufe für diese Rechnung angelegt."
  confirmLabel="Mahnung anlegen"
  variant="primary"
  onConfirm={createReminder}
  onClose={() => {}}
/>
