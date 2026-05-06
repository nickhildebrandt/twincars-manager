<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import PdfViewer from '$lib/components/ui/PdfViewer.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import { Wallet } from '@lucide/svelte'
  import {
    findEntryRemote,
    getPayrollPeriodRemote
  } from '../../../payroll.remote'
  import { getEmployeeRemote } from '../../../../employees/employees.remote'
  import { formatEuro } from '$lib/utils/money'

  const periodId = untrack(() => page.params.id!)
  const employeeId = untrack(() => page.params.employeeId!)

  /* SSR-friendly parallel load. */
  const [period, employee, entry] = await Promise.all([
    getPayrollPeriodRemote({ id: periodId }),
    getEmployeeRemote({ id: employeeId }),
    findEntryRemote({ periodId, employeeId })
  ])

  const monthLabel = (m: number) =>
    [
      'Januar',
      'Februar',
      'März',
      'April',
      'Mai',
      'Juni',
      'Juli',
      'August',
      'September',
      'Oktober',
      'November',
      'Dezember'
    ][m - 1] ?? String(m)

  const statusLabel = (s: string) =>
    s === 'cancelled'
      ? 'Storniert'
      : s === 'sent'
        ? 'Versendet'
        : s === 'paid'
          ? 'Ausgezahlt'
          : s === 'approved'
            ? 'Freigegeben'
            : 'Entwurf'
  const statusBadge = (s: string) =>
    s === 'cancelled'
      ? 'badge-ghost'
      : s === 'paid' || s === 'approved'
        ? 'badge-success'
        : s === 'sent'
          ? 'badge-info'
          : 'badge-warning'
</script>

<PageHeader
  title={`${employee.firstName} ${employee.lastName} — ${monthLabel(period.period.month)} ${period.period.year}`}
  back={`/payroll/${periodId}`}
/>

{#if !entry}
  <EmptyState
    icon={Wallet}
    title="Keine Abrechnung vorhanden"
    description="Für diesen Mitarbeiter wurde in der Periode noch nichts abgerechnet. Der Tages-Cron erstellt die Abrechnung automatisch am Stichtag."
  />
{:else}
  <div class="card border-base-300 bg-base-100 mb-4 border">
    <div class="card-body gap-2">
      <div class="flex items-center justify-between">
        <h3 class="card-title text-base">Status</h3>
        <span class="badge badge-sm {statusBadge(entry.status)}">
          {statusLabel(entry.status)}
        </span>
      </div>
      {#if entry.payoutDate}
        <p class="text-base-content/60 text-sm">
          Auszahlung am {entry.payoutDate.slice(8, 10)}.{entry.payoutDate.slice(
            5,
            7
          )}.{entry.payoutDate.slice(0, 4)} per
          {entry.payoutMethod ?? 'Überweisung'}.
        </p>
      {/if}
    </div>
  </div>

  <div class="card border-base-300 bg-base-100 mb-4 border">
    <div class="card-body gap-3">
      <h3 class="card-title text-base">Lohnarten (Brutto)</h3>
      {#if entry.lineItems.length === 0}
        <p class="text-base-content/60 text-sm"> Keine Lohnarten erfasst. </p>
      {:else}
        <div class="overflow-x-auto">
          <table class="table-sm table">
            <thead>
              <tr>
                <th>Bezeichnung</th>
                <th class="text-right">Menge</th>
                <th>Einheit</th>
                <th class="text-right">Satz</th>
                <th class="text-right">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {#each entry.lineItems as l (l.id)}
                <tr>
                  <td>{l.label}</td>
                  <td class="text-right font-mono"
                    >{l.quantity != null
                      ? Number(l.quantity).toLocaleString('de-DE')
                      : '—'}</td
                  >
                  <td>{l.unit ?? ''}</td>
                  <td class="text-right font-mono"
                    >{l.rate != null ? formatEuro(Number(l.rate)) : '—'}</td
                  >
                  <td class="text-right font-mono"
                    >{formatEuro(Number(l.amount))}</td
                  >
                </tr>
              {/each}
            </tbody>
            <tfoot
              class="border-base-300 bg-base-200/30 border-t-2 font-semibold"
            >
              <tr>
                <td colspan="4">Summe Brutto</td>
                <td class="text-right font-mono"
                  >{formatEuro(Number(entry.grossTotal))}</td
                >
              </tr>
            </tfoot>
          </table>
        </div>
      {/if}
    </div>
  </div>

  {#if entry.deductions.length > 0}
    <div class="card border-base-300 bg-base-100 mb-4 border">
      <div class="card-body gap-3">
        <h3 class="card-title text-base">Abzüge & Beiträge</h3>
        <div class="overflow-x-auto">
          <table class="table-sm table">
            <thead>
              <tr>
                <th>Bezeichnung</th>
                <th class="text-right">Betrag</th>
                <th>Träger</th>
              </tr>
            </thead>
            <tbody>
              {#each entry.deductions as d (d.id)}
                <tr>
                  <td>{d.label}</td>
                  <td class="text-right font-mono"
                    >{formatEuro(Number(d.amount))}</td
                  >
                  <td>{d.isEmployer ? 'AG' : 'AN'}</td>
                </tr>
              {/each}
            </tbody>
            <tfoot
              class="border-base-300 bg-base-200/30 border-t-2 font-semibold"
            >
              <tr>
                <td>Steuern (AN)</td>
                <td class="text-right font-mono"
                  >{formatEuro(Number(entry.taxTotal))}</td
                >
                <td></td>
              </tr>
              <tr>
                <td>SV (AN)</td>
                <td class="text-right font-mono"
                  >{formatEuro(Number(entry.socialEmployeeTotal))}</td
                >
                <td></td>
              </tr>
              <tr>
                <td>SV (AG, informativ)</td>
                <td class="text-right font-mono"
                  >{formatEuro(Number(entry.socialEmployerTotal))}</td
                >
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  {/if}

  <div class="card border-base-300 bg-base-100 mb-4 border">
    <div class="card-body gap-3">
      <h3 class="card-title text-base">Auszahlung</h3>
      <dl class="grid grid-cols-2 gap-y-1 text-sm">
        <dt class="text-base-content/60">Brutto</dt>
        <dd class="text-right font-mono"
          >{formatEuro(Number(entry.grossTotal))}</dd
        >
        <dt class="text-base-content/60">– Steuern</dt>
        <dd class="text-right font-mono"
          >{formatEuro(Number(entry.taxTotal))}</dd
        >
        <dt class="text-base-content/60">– SV (AN)</dt>
        <dd class="text-right font-mono"
          >{formatEuro(Number(entry.socialEmployeeTotal))}</dd
        >
        <dt class="font-semibold">Netto / Auszahlung</dt>
        <dd class="text-right font-mono font-semibold"
          >{formatEuro(Number(entry.netTotal))}</dd
        >
      </dl>
    </div>
  </div>

  <PdfViewer documentId={entry.id} kind="payslip" />
{/if}
