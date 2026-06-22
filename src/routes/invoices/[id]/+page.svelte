<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import {
    ArrowRight,
    Ban,
    BellRing,
    Car,
    CheckCircle2,
    Clock,
    Send,
    Trash2,
    User
  } from '@lucide/svelte'
  import {
    cancelInvoiceRemote,
    deleteInvoiceRemote,
    getInvoiceRemote,
    sendInvoiceRemote,
    setInvoiceStatusRemote
  } from '../invoices.remote'
  import { getInvoiceXRechnungRemote } from '../xrechnung.remote'
  import {
    createPaymentReminderRemote,
    listRemindersForInvoiceRemote
  } from '../../reminders/reminders.remote'
  import {
    deleteTimeEntryRemote,
    listTimeEntriesRemote
  } from '../../hours/hours.remote'
  import { getCurrentUserRemote } from '../../layout.remote'
  import PdfViewer from '$lib/components/ui/PdfViewer.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import QuickTimeEntryModal from '$lib/components/ui/QuickTimeEntryModal.svelte'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { downloadBase64File } from '$lib/utils/pdf-download'
  import { FileCode } from '@lucide/svelte'
  import {
    documentStatusBadge,
    documentStatusLabel
  } from '$lib/utils/status-labels'
  import { formatEuro } from '$lib/utils/money'

  const id = untrack(() => page.params.id!)

  /**
   * Top-level await on the remote query — SSR carries the rendered invoice
   * on first byte, hydration reuses the dehydrated cache without a fetch.
   * The reminder list is loaded in parallel; it's a small query and fits the
   * same SSR-hydration story.
   */
  const [data, invoiceReminders, currentUser] = await Promise.all([
    getInvoiceRemote({ id }),
    listRemindersForInvoiceRemote({ invoiceId: id }),
    getCurrentUserRemote()
  ])

  /**
   * Reactive list of time entries logged against this document. The
   * size cap matches the global pagination contract (25) — it's enough
   * to show recent work without making the detail page scroll
   * forever. Filtering happens server-side via the existing
   * `documentId` filter on `listTimeEntries`.
   */
  const timeEntriesQ = $derived(
    listTimeEntriesRemote({ page: 1, size: 25, documentId: id })
  )
  const timeEntriesInitial = await untrack(() => timeEntriesQ)
  let lastTimeEntries = $state(timeEntriesInitial)
  $effect(() => {
    if (timeEntriesQ.current) lastTimeEntries = timeEntriesQ.current
  })
  const timeEntries = $derived(timeEntriesQ.current ?? lastTimeEntries)

  /** Permission set granted to the caller via assigned roles. */
  const callerPermissions = $derived(new Set(currentUser?.permissions ?? []))
  const hasAny = (...keys: string[]): boolean =>
    callerPermissions.has('*') || keys.some((k) => callerPermissions.has(k))
  const canLogHours = $derived(hasAny('hours', 'hours:write_own'))

  /** Most recent reminder drives the banner copy. */
  const latestReminder = $derived(
    invoiceReminders.length
      ? invoiceReminders[invoiceReminders.length - 1]
      : null
  )
  const reminderCount = $derived(invoiceReminders.length)

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
  let logHoursOpen = $state(false)
  /** Stornieren-Dialog state — Begründung ist Pflicht. */
  let stornoOpen = $state(false)
  let stornoReason = $state('')
  let stornoSubmitting = $state(false)
  /** Löschen-Dialog state — nur für Entwürfe (`status='draft'`). */
  let deleteOpen = $state(false)

  /**
   * Delete a single time entry. The remote function enforces ownership
   * — `:write_own`-only callers can only delete their own rows, so the
   * UI doesn't need to gate the button per-row beyond the explicit
   * comparison below (which keeps the action discoverable to managers
   * while staying honest about who owns what).
   */
  const removeTimeEntry = async (entryId: string) => {
    try {
      await busy.run(() => deleteTimeEntryRemote({ id: entryId }))
      toast.success('Eintrag gelöscht.')
    } catch (err) {
      handleClientError(err, 'Eintrag konnte nicht gelöscht werden')
    }
  }

  const sendInvoice = async () => {
    try {
      await busy.run(() => sendInvoiceRemote({ id }))
      toast.success('Rechnung versendet.')
    } catch (err) {
      handleClientError(err)
    }
  }

  /**
   * GoBD-konformes Stornieren einer ausgestellten Rechnung. Der Server
   * erzeugt eine neue Storno-Rechnung, negiert alle Beträge und
   * verkettet beide Belege (`cancelsDocumentId` ↔
   * `cancelledByDocumentId`). Anschließend navigieren wir direkt auf
   * den neuen Storno-Beleg.
   */
  const cancelInvoice = async () => {
    const reason = stornoReason.trim()
    if (reason.length === 0) {
      toast.error('Bitte einen Stornogrund angeben.')
      return
    }
    stornoSubmitting = true
    try {
      const res = await busy.run(() => cancelInvoiceRemote({ id, reason }))
      toast.success(`Stornorechnung ${res.stornoNumber} erstellt.`)
      stornoOpen = false
      stornoReason = ''
      goto(`/invoices/${res.stornoId}`)
    } catch (err) {
      handleClientError(err, 'Rechnung konnte nicht storniert werden')
    } finally {
      stornoSubmitting = false
    }
  }

  /**
   * Entwurfs-Rechnung löschen. Bei ausgestellten Rechnungen verweigert
   * der Server mit HTTP 409 — die Toast-Nachricht aus
   * `handleClientError` weist den Anwender dann auf den Storno-Pfad
   * hin.
   */
  const deleteInvoice = async () => {
    try {
      await busy.run(() => deleteInvoiceRemote({ id }))
      toast.success('Rechnung gelöscht.')
      goto('/invoices')
    } catch (err) {
      handleClientError(err, 'Rechnung konnte nicht gelöscht werden')
    }
  }

  /**
   * E-Rechnung (XRechnung 3.0 UBL) als XML herunterladen. Pflicht für
   * B2B-Rechnungen ab 2026. Reuses denselben Loader wie der PDF-Render,
   * sodass PDF + XML aus identischen Stammdaten kommen.
   */
  const downloadXRechnung = async () => {
    try {
      const res = await busy.run(() => getInvoiceXRechnungRemote({ id }))
      downloadBase64File(res)
      toast.success('E-Rechnung (XRechnung) heruntergeladen.')
    } catch (err) {
      handleClientError(err, 'E-Rechnung-Download')
    }
  }

  /**
   * Sendet die Zahlungserinnerung. Es gibt KEINE Mahn-Stufen —
   * solange die Rechnung offen ist, geht dieselbe freundliche
   * Erinnerung in regelmäßigen Abständen erneut raus. Jeder Klick
   * legt eine neue Zahlungserinnerung an.
   */
  const sendReminder = async () => {
    try {
      const reminder = await busy.run(() =>
        createPaymentReminderRemote({ invoiceId: id })
      )
      toast.success('Zahlungserinnerung versendet.')
      goto(`/reminders/${reminder.id}`)
    } catch (err) {
      handleClientError(err)
    }
  }

  const fmtDate = (s: string | null | undefined) => {
    if (!s) return '—'
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
    return m ? `${m[3]}.${m[2]}.${m[1]}` : s
  }

  /** Rechnung ist überfällig wenn dueDate < heute und nicht bezahlt. */
  const isOverdue = $derived.by(() => {
    if (data.doc.status === 'paid' || data.doc.status === 'cancelled')
      return false
    if (!data.doc.dueDate) return false
    const today = new Date().toISOString().slice(0, 10)
    return data.doc.dueDate < today
  })

  /**
   * Header CTA reflects the next step in the lifecycle:
   *   created → versenden
   *   sent    → als bezahlt markieren
   *   paid    → no CTA (terminal)
   * Zahlungserinnerungen werden über das Mahnwesen-Modul versendet;
   * der Banner oben bietet den direkten CTA dafür.
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
    Es gibt keine Eskalation: derselbe freundliche Erinnerungstext geht
    in regelmäßigen Abständen erneut raus. Banner zeigt nur Anzahl +
    Datum der letzten Erinnerung und bietet einen klaren CTA, falls die
    nächste manuell ausgelöst werden soll.
  -->
  <div class="alert alert-warning mb-4 flex-wrap">
    <BellRing size={20} />
    <div class="min-w-0 flex-1">
      <div class="font-medium">
        {reminderCount === 1
          ? '1 Zahlungserinnerung versendet'
          : `${reminderCount} Zahlungserinnerungen versendet`}
      </div>
      <div class="text-sm">
        Letzte Erinnerung am {fmtDate(latestReminder.issueDate)}.
      </div>
    </div>
    <button
      type="button"
      class="btn btn-sm btn-warning gap-1"
      onclick={() => (reminderOpen = true)}
      disabled={busy.active}
    >
      <BellRing size={14} />
      Erneut senden
    </button>
    <a
      class="btn btn-sm btn-ghost gap-1"
      href={`/reminders/${latestReminder.id}`}
    >
      Zur letzten Erinnerung
      <ArrowRight size={14} />
    </a>
  </div>
{:else if isOverdue}
  <!--
    Noch nie erinnert. Banner bietet den CTA, die erste Zahlungs-
    erinnerung zu versenden.
  -->
  <div class="alert alert-warning mb-4 flex-wrap">
    <BellRing size={20} />
    <div class="min-w-0 flex-1">
      <div class="font-medium">Rechnung überfällig</div>
      <div class="text-sm">
        Die Fälligkeit ist überschritten. Eine freundliche Zahlungserinnerung
        kann jetzt versendet werden.
      </div>
    </div>
    <button
      type="button"
      class="btn btn-sm btn-warning gap-1"
      onclick={sendReminder}
      disabled={busy.active}
    >
      <BellRing size={14} />
      Zahlungserinnerung senden
    </button>
  </div>
{/if}

<!--
  Storno-Banner — drei Zustände in einer einzigen Sektion:

  1. `originalDoc` gesetzt: dies IST eine Stornorechnung. Zurücklink
     auf das Original.
  2. `cancelledAt` gesetzt: das Original wurde storniert. Forward-Link
     auf die Stornorechnung.

  Aktive (nicht-stornierte) Rechnungen rendern keinen Banner.
-->
{#if data.originalDoc}
  <div class="alert alert-error mb-4 flex-wrap">
    <Ban size={20} />
    <div class="min-w-0 flex-1">
      <div class="font-medium">
        Stornorechnung zu Rechnung {data.originalDoc.documentNumber}
      </div>
      <div class="text-sm">
        Diese Rechnung negiert das Original gemäß § 14 UStG.
      </div>
    </div>
    <a
      class="btn btn-sm btn-ghost gap-1"
      href={`/invoices/${data.originalDoc.id}`}
    >
      Zur Original-Rechnung
      <ArrowRight size={14} />
    </a>
  </div>
{:else if data.doc.cancelledAt}
  <div class="alert alert-error mb-4 flex-wrap">
    <Ban size={20} />
    <div class="min-w-0 flex-1">
      <div class="font-medium">
        Diese Rechnung wurde am {fmtDate(
          data.doc.cancelledAt instanceof Date
            ? data.doc.cancelledAt.toISOString()
            : data.doc.cancelledAt
        )} storniert.
      </div>
      {#if data.stornoDoc}
        <div class="text-sm">
          Stornorechnung: <a
            class="link link-hover font-mono"
            href={`/invoices/${data.stornoDoc.id}`}
            >{data.stornoDoc.documentNumber}</a
          >
        </div>
      {/if}
      {#if data.doc.cancellationReason}
        <div class="text-base-content/70 mt-1 text-sm">
          Grund: {data.doc.cancellationReason}
        </div>
      {/if}
    </div>
    {#if data.stornoDoc}
      <a
        class="btn btn-sm btn-ghost gap-1"
        href={`/invoices/${data.stornoDoc.id}`}
      >
        Zur Stornorechnung
        <ArrowRight size={14} />
      </a>
    {/if}
  </div>
{/if}

<!--
  Stornieren / Löschen actions — GoBD-Logik:
  - `draft` → klassisches Löschen erlaubt.
  - `cancelled` / `storno` → keine destruktive Action (Storno-Belege
    sind aufbewahrungspflichtig).
  - Alles dazwischen (`created`, `sent`, `paid`) → nur Stornieren.
-->
{#if data.doc.status !== 'cancelled' && data.doc.status !== 'storno'}
  <div class="mb-4 flex flex-col justify-end gap-2 sm:flex-row">
    {#if canLogHours}
      <button
        type="button"
        class="btn btn-sm gap-2"
        onclick={() => (logHoursOpen = true)}
        disabled={busy.active}
      >
        <Clock size={14} />
        Arbeit erfassen
      </button>
    {/if}
    {#if data.doc.status === 'draft'}
      <button
        type="button"
        class="btn btn-sm btn-ghost text-error gap-2"
        onclick={() => (deleteOpen = true)}
        disabled={busy.active}
      >
        <Trash2 size={14} />
        Löschen
      </button>
    {:else}
      <button
        type="button"
        class="btn btn-sm btn-ghost text-error gap-2"
        onclick={() => {
          stornoReason = ''
          stornoOpen = true
        }}
        disabled={busy.active}
      >
        <Ban size={14} />
        Stornieren
      </button>
    {/if}
  </div>
{:else if canLogHours}
  <div class="mb-4 flex flex-col justify-end gap-2 sm:flex-row">
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
  <div class="card border-base-300 bg-base-100 min-w-0 border lg:col-span-2">
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

  <div class="card border-base-300 bg-base-100 min-w-0 border">
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
    <div class="card border-base-300 bg-base-100 min-w-0 border lg:col-span-2">
      <div class="card-body">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="card-title text-base">
            <User size={18} class="text-base-content/60" />
            Kunde
          </h3>
          <a class="btn btn-ghost btn-sm" href={`/customers/${c.id}`}>
            Zum Kunden
          </a>
        </div>
        <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
          <dt class="text-base-content/60">Kundennr.</dt>
          <dd class="font-mono break-all sm:col-span-2">{c.customerNumber}</dd>
          <dt class="text-base-content/60">Name</dt>
          <dd class="break-words sm:col-span-2">
            {c.company ||
              `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() ||
              '—'}
          </dd>
          <dt class="text-base-content/60">Telefon</dt>
          <dd class="break-all sm:col-span-2">{c.phone ?? '—'}</dd>
          <dt class="text-base-content/60">E-Mail</dt>
          <dd class="break-all sm:col-span-2">{c.email ?? '—'}</dd>
        </dl>
      </div>
    </div>
  {/if}

  {#if data.vehicle}
    {@const v = data.vehicle}
    <div class="card border-base-300 bg-base-100 min-w-0 border">
      <div class="card-body">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="card-title text-base">
            <Car size={18} class="text-base-content/60" />
            Fahrzeug
          </h3>
          <a class="btn btn-ghost btn-sm" href={`/vehicles/${v.id}`}>
            Zum Fahrzeug
          </a>
        </div>
        <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
          <dt class="text-base-content/60">Kennzeichen</dt>
          <dd class="font-mono break-all sm:col-span-2"
            >{v.licensePlate ?? '—'}</dd
          >
          <dt class="text-base-content/60">Marke / Modell</dt>
          <dd class="break-words sm:col-span-2">
            {[v.make, v.model].filter(Boolean).join(' ') || '—'}
          </dd>
          <dt class="text-base-content/60">FIN</dt>
          <dd class="font-mono text-xs break-all sm:col-span-2"
            >{v.vin ?? '—'}</dd
          >
          <dt class="text-base-content/60">EZ</dt>
          <dd class="sm:col-span-2">{v.firstRegistration ?? '—'}</dd>
          <dt class="text-base-content/60">km-Stand</dt>
          <dd class="sm:col-span-2">
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
          <h3 class="text-base font-semibold"
            >Versendete Zahlungserinnerungen</h3
          >
          <p class="text-base-content/60 text-sm">
            Vollständige Historie aller bisher zu dieser Rechnung versendeten
            Erinnerungen. Es gibt keine Eskalation — derselbe freundliche Text
            geht in regelmäßigen Abständen erneut raus.
          </p>
        </div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Nummer</th>
                <th>Datum</th>
                <th>Nr. der Erinnerung</th>
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
                  <td>{fmtDate(r.issueDate)}</td>
                  <td>{r.level}. Erinnerung</td>
                  <td>{fmtDate(r.dueDate)}</td>
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

  {#if timeEntries.items.length > 0}
    <div class="card border-base-300 bg-base-100 border lg:col-span-3">
      <div class="card-body p-0">
        <div class="border-base-300 border-b px-4 py-3">
          <h3 class="text-base font-semibold">Erfasste Stunden</h3>
          <p class="text-base-content/60 text-sm">
            Stundeneinträge, die auf diese Rechnung verbucht wurden.
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
    <div class="mb-2 flex flex-col justify-end gap-2 sm:flex-row">
      <button
        type="button"
        class="btn btn-sm gap-2"
        onclick={downloadXRechnung}
        disabled={busy.active}
      >
        <FileCode size={14} />
        E-Rechnung (XRechnung) herunterladen
      </button>
    </div>
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
  title="Zahlungserinnerung erneut senden?"
  message="Es wird eine weitere Zahlungserinnerung mit dem gleichen freundlichen Text an den Kunden versendet."
  confirmLabel="Jetzt senden"
  variant="primary"
  onConfirm={sendReminder}
  onClose={() => {}}
/>

<QuickTimeEntryModal
  bind:open={logHoursOpen}
  documentId={data.doc.id}
  onClose={() => {}}
/>

<ConfirmDialog
  bind:open={deleteOpen}
  title="Entwurfs-Rechnung löschen?"
  message="Diese Rechnung ist ein Entwurf und kann unwiderruflich entfernt werden. Bereits ausgestellte Rechnungen lassen sich nur stornieren."
  confirmLabel="Endgültig löschen"
  variant="danger"
  onConfirm={deleteInvoice}
  onClose={() => {}}
/>

<!--
  Storno-Dialog: Pflicht-Begründung (max. 500 Zeichen). Kein
  `ConfirmDialog`, weil wir das `<textarea>` brauchen — das normale
  ConfirmDialog hat keinen Body-Slot.
-->
{#if stornoOpen}
  <dialog class="modal modal-open">
    <div class="modal-box">
      <h3 class="text-lg font-semibold">Rechnung stornieren?</h3>
      <p class="text-base-content/80 py-2 text-sm">
        Eine GoBD-konforme Stornorechnung wird erzeugt, die diese Rechnung exakt
        negiert. Das Original bleibt unverändert lesbar im Bestand.
      </p>
      <label class="floating-label mt-2">
        <span>Stornogrund</span>
        <textarea
          class="textarea textarea-bordered w-full"
          rows="3"
          maxlength="500"
          placeholder="Bitte Stornogrund eingeben"
          bind:value={stornoReason}
          disabled={stornoSubmitting}
        ></textarea>
      </label>
      <div class="text-base-content/60 mt-1 text-right text-xs">
        {stornoReason.length} / 500
      </div>
      <div class="modal-action">
        <button
          type="button"
          class="btn btn-ghost"
          onclick={() => {
            stornoOpen = false
            stornoReason = ''
          }}
          disabled={stornoSubmitting}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="btn btn-error"
          onclick={cancelInvoice}
          disabled={stornoSubmitting || stornoReason.trim().length === 0}
        >
          {#if stornoSubmitting}
            <span class="loading loading-spinner loading-sm"></span>
          {/if}
          Stornieren
        </button>
      </div>
    </div>
    <button
      type="button"
      class="modal-backdrop"
      aria-label="Schließen"
      onclick={() => {
        stornoOpen = false
        stornoReason = ''
      }}
    ></button>
  </dialog>
{/if}
