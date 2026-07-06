<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import StatCard from '$lib/components/ui/StatCard.svelte'
  import {
    AlertTriangle,
    Receipt,
    FileWarning,
    BellPlus,
    FileText,
    RefreshCw
  } from '@lucide/svelte'
  import {
    autoSendDuePaymentRemindersRemote,
    createPaymentReminderRemote,
    listOpenInvoicesRemote,
    listRemindersRemote
  } from './reminders.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formatEuro } from '$lib/utils/money'

  /**
   * Top-level await primes SSR + hydration; we then mirror the data into a
   * local `$state` array so post-mutation refreshes are trivially visible.
   * The reactive `query.current` path is brittle when seeded by a top-level
   * await — see CONTRIBUTING §15 — and an imperative re-fetch is both
   * simpler and more predictable for this list.
   */
  const initialOpen = await listOpenInvoicesRemote()
  const initialReminders = await listRemindersRemote()
  let items = $state<typeof initialOpen>(initialOpen)
  let reminders = $state<typeof initialReminders>(initialReminders)

  const totals = $derived.by(() => {
    const open = items.reduce((s, i) => s + i.openAmount, 0)
    const overdue = items.filter((i) => i.overdueDays > 0)
    const overdueSum = overdue.reduce((s, i) => s + i.openAmount, 0)
    return { open, overdue: overdue.length, overdueSum }
  })

  const refresh = async () => {
    ;[items, reminders] = await Promise.all([
      listOpenInvoicesRemote().run(),
      listRemindersRemote().run()
    ])
  }

  const sendReminder = async (invoiceId: string) => {
    try {
      await busy.run(async () => {
        await createPaymentReminderRemote({ invoiceId })
        await refresh()
      })
      toast.success('Zahlungserinnerung versendet.')
    } catch (err) {
      handleClientError(err, 'Zahlungserinnerung konnte nicht versendet werden')
    }
  }

  /**
   * Operator-triggered batch: scans for invoices whose configured
   * interval has elapsed (first or recurring) and sends each one. Same
   * code path as the auto-scheduler will use later.
   */
  const runAutoBatch = async () => {
    try {
      const result = await busy.run(async () => {
        const r = await autoSendDuePaymentRemindersRemote()
        await refresh()
        return r
      })
      if (result.created === 0 && result.failed === 0) {
        toast.success('Keine fälligen Zahlungserinnerungen.')
      } else {
        toast.success(
          `${result.created} Zahlungserinnerung(en) versendet` +
            (result.failed > 0 ? ` · ${result.failed} fehlgeschlagen` : '')
        )
      }
    } catch (err) {
      handleClientError(err, 'Batch-Versand fehlgeschlagen')
    }
  }

  const fmt = (s: string | null | undefined) => {
    if (!s) return '-'
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
    return m ? `${m[3]}.${m[2]}.${m[1]}` : s
  }
</script>

<PageHeader
  title="Offene Rechnungen"
  subtitle="OP-Liste mit automatisch berechneten Verzugstagen - eine einzige freundliche Zahlungserinnerung wird wiederholt versendet."
  primaryAction={{
    label: 'Fällige jetzt versenden',
    onClick: runAutoBatch,
    icon: RefreshCw
  }}
/>

<div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
  <StatCard
    title="Offene Beträge"
    value={formatEuro(totals.open)}
    icon={Receipt}
    color="warning"
  />
  <StatCard
    title="Überfällige Rechnungen"
    value={totals.overdue.toString()}
    icon={AlertTriangle}
    color="error"
  />
  <StatCard
    title="Überfälliger Betrag"
    value={formatEuro(totals.overdueSum)}
    icon={FileWarning}
    color="error"
  />
</div>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if items.length === 0}
      <EmptyState
        icon={Receipt}
        title="Keine offenen Rechnungen"
        description="Alle Rechnungen sind bezahlt."
      />
    {:else}
      <!-- Desktop / tablet: full table, hidden below lg. -->
      <div class="hidden overflow-x-auto lg:block">
        <table class="table">
          <thead>
            <tr>
              <th>Rechnungsnr.</th>
              <th class="hidden lg:table-cell">Datum</th>
              <th>Fällig</th>
              <th>Kunde</th>
              <th class="hidden text-right xl:table-cell">Brutto</th>
              <th class="text-right">Offen</th>
              <th>Verzug</th>
              <th class="text-right">Erinnerungen</th>
              <th class="hidden xl:table-cell">Zuletzt am</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as i (i.id)}
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => goto(`/invoices/${i.id}`)}
              >
                <td class="font-mono text-xs font-medium">{i.documentNumber}</td
                >
                <td class="hidden lg:table-cell">{fmt(i.issueDate)}</td>
                <td>{fmt(i.dueDate)}</td>
                <td>{i.customerName ?? ''}</td>
                <td class="hidden text-right font-mono xl:table-cell"
                  >{formatEuro(i.grossTotal)}</td
                >
                <td class="text-right font-mono font-semibold"
                  >{formatEuro(i.openAmount)}</td
                >
                <td>
                  {#if i.overdueDays > 0}
                    <span class="text-error">{i.overdueDays} Tage</span>
                  {:else}
                    <span class="text-base-content/40">-</span>
                  {/if}
                </td>
                <td class="text-right">
                  {#if i.reminderCount === 0}
                    <span class="text-base-content/40">-</span>
                  {:else}
                    <span class="badge badge-sm badge-info">
                      {i.reminderCount}×
                    </span>
                  {/if}
                </td>
                <td class="hidden xl:table-cell">{fmt(i.lastReminderDate)}</td>
                <td onclick={(e) => e.stopPropagation()}>
                  <div class="flex justify-end">
                    <button
                      type="button"
                      class="btn btn-sm btn-primary gap-1"
                      disabled={busy.active}
                      title={i.reminderCount === 0
                        ? 'Zahlungserinnerung senden'
                        : 'Zahlungserinnerung erneut senden'}
                      onclick={() => sendReminder(i.id)}
                    >
                      <BellPlus size={14} />
                      Senden
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <!-- Phone / small tablet: stacked card list. -->
      <ul class="divide-base-300 divide-y lg:hidden">
        {#each items as i (i.id)}
          <li class="hover:bg-base-200 flex items-stretch gap-2 p-3">
            <a
              href={`/invoices/${i.id}`}
              class="flex min-w-0 flex-1 flex-col gap-0.5"
            >
              <span class="truncate font-mono text-xs font-medium">
                {i.documentNumber}
              </span>
              {#if i.customerName}
                <span class="text-base-content/70 truncate text-xs">
                  {i.customerName}
                </span>
              {/if}
              <span
                class="text-base-content/70 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
              >
                <span>Fällig {fmt(i.dueDate)}</span>
                {#if i.overdueDays > 0}
                  <span class="text-error">{i.overdueDays} Tage Verzug</span>
                {/if}
                {#if i.reminderCount > 0}
                  <span class="badge badge-xs badge-info">
                    {i.reminderCount}×
                  </span>
                {/if}
              </span>
              <span class="font-mono text-sm font-semibold">
                {formatEuro(i.openAmount)} offen
              </span>
            </a>
            <div class="flex shrink-0 items-start">
              <button
                type="button"
                class="btn btn-sm btn-primary gap-1"
                disabled={busy.active}
                title={i.reminderCount === 0
                  ? 'Zahlungserinnerung senden'
                  : 'Zahlungserinnerung erneut senden'}
                onclick={() => sendReminder(i.id)}
              >
                <BellPlus size={14} />
                Senden
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

{#if reminders.length > 0}
  <div class="card border-base-300 bg-base-100 mt-4 border">
    <div class="card-body p-0">
      <div class="border-base-300 border-b px-4 py-3">
        <h3 class="text-base font-semibold">Versendete Zahlungserinnerungen</h3>
        <p class="text-base-content/60 text-sm">
          Vollständige Historie aller bisher versendeten Zahlungserinnerungen.
        </p>
      </div>
      <!-- Desktop / tablet: full table, hidden below lg. -->
      <div class="hidden overflow-x-auto lg:block">
        <table class="table">
          <thead>
            <tr>
              <th>Nr.</th>
              <th>Datum</th>
              <th>Nr. der Erinnerung</th>
              <th>Rechnung</th>
              <th>Kunde</th>
              <th>Zahlbar bis</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each reminders as r (r.id)}
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => goto(`/reminders/${r.id}`)}
              >
                <td class="font-mono text-xs font-medium">{r.documentNumber}</td
                >
                <td>{fmt(r.issueDate)}</td>
                <td>
                  <span class="badge badge-sm badge-info">
                    {r.level}. Erinnerung
                  </span>
                </td>
                <td class="font-mono text-xs">{r.invoiceNumber}</td>
                <td>{r.customerName ?? ''}</td>
                <td>{fmt(r.dueDate)}</td>
                <td onclick={(e) => e.stopPropagation()}>
                  <div class="flex justify-end">
                    <a
                      class="btn btn-sm btn-ghost gap-1"
                      href={`/reminders/${r.id}`}
                    >
                      <FileText size={14} /> Details
                    </a>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <!-- Phone / small tablet: stacked card list. -->
      <ul class="divide-base-300 divide-y lg:hidden">
        {#each reminders as r (r.id)}
          <li class="hover:bg-base-200 flex items-stretch gap-2 p-3">
            <a
              href={`/reminders/${r.id}`}
              class="flex min-w-0 flex-1 flex-col gap-0.5"
            >
              <span class="truncate font-mono text-xs font-medium">
                {r.documentNumber}
              </span>
              {#if r.customerName}
                <span class="text-base-content/70 truncate text-xs">
                  {r.customerName}
                </span>
              {/if}
              <span
                class="text-base-content/70 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
              >
                <span class="badge badge-xs badge-info">
                  {r.level}. Erinnerung
                </span>
                <span>zu <span class="font-mono">{r.invoiceNumber}</span></span>
                <span>Zahlbar bis {fmt(r.dueDate)}</span>
              </span>
            </a>
            <div class="flex shrink-0 items-start">
              <a class="btn btn-sm btn-ghost gap-1" href={`/reminders/${r.id}`}>
                <FileText size={14} /> Details
              </a>
            </div>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}
