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
    FileText
  } from '@lucide/svelte'
  import {
    createReminderRemote,
    listOpenInvoicesRemote,
    listRemindersRemote
  } from './reminders.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formatEuro } from '$lib/utils/money'
  import {
    reminderLevelBadge,
    reminderLevelLabel
  } from '$lib/utils/status-labels'

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

  const nextReminderLabel = (lvl: number): string => {
    const next = lvl + 1
    if (next > 4) return 'Alle Stufen erreicht'
    return reminderLevelLabel(next)
  }

  const createNextReminder = async (invoiceId: string, level: number) => {
    if (level >= 4) return
    const nextLevel = (level + 1) as 1 | 2 | 3 | 4
    try {
      await busy.run(async () => {
        await createReminderRemote({ invoiceId, level: nextLevel })
        ;[items, reminders] = await Promise.all([
          listOpenInvoicesRemote().run(),
          listRemindersRemote().run()
        ])
      })
      toast.success('Mahnung erzeugt.')
    } catch (err) {
      handleClientError(err, 'Mahnung konnte nicht erzeugt werden')
    }
  }
</script>

<PageHeader
  title="Offene Rechnungen & Mahnungen"
  subtitle="OP-Liste mit automatisch berechneten Verzugstagen und Mahnstufen."
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
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Rechnungsnr.</th>
              <th>Datum</th>
              <th>Fällig</th>
              <th>Kunde</th>
              <th class="text-right">Brutto</th>
              <th class="text-right">Offen</th>
              <th>Verzug</th>
              <th>Mahnstufe</th>
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
                <td>{i.issueDate}</td>
                <td>{i.dueDate ?? '—'}</td>
                <td>{i.customerName ?? ''}</td>
                <td class="text-right font-mono">{formatEuro(i.grossTotal)}</td>
                <td class="text-right font-mono font-semibold"
                  >{formatEuro(i.openAmount)}</td
                >
                <td>
                  {#if i.overdueDays > 0}
                    <span class="text-error">{i.overdueDays} Tage</span>
                  {:else}
                    <span class="text-base-content/40">—</span>
                  {/if}
                </td>
                <td>
                  <span
                    class="badge badge-sm {reminderLevelBadge(i.reminderLevel)}"
                  >
                    {reminderLevelLabel(i.reminderLevel)}
                  </span>
                </td>
                <td onclick={(e) => e.stopPropagation()}>
                  <div class="flex justify-end">
                    <button
                      type="button"
                      class="btn btn-sm btn-primary gap-1"
                      disabled={i.reminderLevel >= 4 || busy.active}
                      onclick={() => createNextReminder(i.id, i.reminderLevel)}
                    >
                      <BellPlus size={14} />
                      {nextReminderLabel(i.reminderLevel)}
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

{#if reminders.length > 0}
  <div class="card border-base-300 bg-base-100 mt-4 border">
    <div class="card-body p-0">
      <div class="border-base-300 border-b px-4 py-3">
        <h3 class="text-base font-semibold">Offene Mahnungen</h3>
        <p class="text-base-content/60 text-sm">
          Bereits erzeugte Mahnungen mit PDF-Vorschau.
        </p>
      </div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Nr.</th>
              <th>Datum</th>
              <th>Stufe</th>
              <th>Rechnung</th>
              <th>Kunde</th>
              <th class="text-right">Gebühr</th>
              <th class="text-right">Zinsen</th>
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
                <td>{r.issueDate}</td>
                <td>
                  <span class="badge badge-sm {reminderLevelBadge(r.level)}">
                    {reminderLevelLabel(r.level)}
                  </span>
                </td>
                <td class="font-mono text-xs">{r.invoiceNumber}</td>
                <td>{r.customerName ?? ''}</td>
                <td class="text-right font-mono">{formatEuro(r.fee)}</td>
                <td class="text-right font-mono">{formatEuro(r.interest)}</td>
                <td>{r.dueDate}</td>
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
    </div>
  </div>
{/if}
