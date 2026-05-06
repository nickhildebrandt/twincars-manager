<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import { Wallet, FileText, Sparkles } from '@lucide/svelte'
  import {
    autoGenerateEntriesRemote,
    getPayrollPeriodRemote
  } from '../payroll.remote'
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'
  import { handleClientError } from '$lib/utils/client-error'
  import { formatEuro } from '$lib/utils/money'

  const id = untrack(() => page.params.id!)

  /** SSR-friendly load. */
  const initial = await getPayrollPeriodRemote({ id })
  let data = $state<typeof initial>(initial)
  const period = $derived(data.period)
  const entries = $derived(data.entries)
  const allEmployees = $derived(data.employees)

  const refresh = async () => {
    data = await getPayrollPeriodRemote({ id }).run()
  }

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
      : s === 'approved'
        ? 'Freigegeben'
        : s === 'sent'
          ? 'Versendet'
          : s === 'paid'
            ? 'Ausgezahlt'
            : 'Entwurf'
  const statusBadge = (s: string) =>
    s === 'cancelled'
      ? 'badge-ghost'
      : s === 'approved' || s === 'paid'
        ? 'badge-success'
        : s === 'sent'
          ? 'badge-info'
          : 'badge-warning'

  /**
   * Auto-Generation bleibt manuell auslösbar (Notfall-Knopf), aber der
   * normale Pfad ist der Tages-Cron, der am Stichtag automatisch
   * abrechnet. Editieren/Freigeben/Löschen entfällt komplett — die
   * versionierte Stamm-Daten machen das Ergebnis deterministisch.
   */
  const autoGenerate = async () => {
    try {
      const stats = await busy.run(() =>
        autoGenerateEntriesRemote({ periodId: id })
      )
      await refresh()
      const created = stats.created
      const skipped = stats.skipped
      toast.success(
        `${created} Abrechnung${created === 1 ? '' : 'en'} erstellt${
          skipped ? ` (${skipped} übersprungen)` : ''
        }.`
      )
    } catch (err) {
      handleClientError(err, 'Automatisches Abrechnen fehlgeschlagen')
    }
  }

  const unbookedEmployees = $derived(
    allEmployees.filter((emp) => !entries.some((e) => e.employeeId === emp.id))
  )

  const totalGross = $derived(
    entries.reduce((s, e) => s + Number(e.grossTotal), 0)
  )
  const totalNet = $derived(entries.reduce((s, e) => s + Number(e.netTotal), 0))
</script>

<PageHeader
  title={`Lohnabrechnung ${monthLabel(period.month)} ${period.year}`}
  back="/payroll"
/>

<div class="card border-base-300 bg-base-100 mb-4 border">
  <div class="card-body gap-3">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h3 class="card-title text-base">Periode</h3>
      <div class="flex items-center gap-2 text-sm">
        Status:
        <span
          class="badge {period.status === 'closed'
            ? 'badge-ghost'
            : period.status === 'approved'
              ? 'badge-success'
              : 'badge-info'}"
        >
          {period.status === 'closed'
            ? 'Geschlossen'
            : period.status === 'approved'
              ? 'Freigegeben'
              : 'Offen'}
        </span>
      </div>
    </div>
    <p class="text-base-content/60 text-sm">
      Lohnabrechnungen werden am Stichtag automatisch erstellt, freigegeben und
      versendet. Manuelle Bearbeitung ist nicht mehr nötig — alle Werte ergeben
      sich aus Stammdaten, Gehaltsversion zum Periodenstart und greifenden
      Sonderzahlungen.
    </p>
    <div class="text-base-content/70 grid grid-cols-2 gap-y-1 text-sm">
      <span class="text-base-content/60">Gesamt-Brutto</span>
      <span class="text-right font-mono">{formatEuro(totalGross)}</span>
      <span class="text-base-content/60">Gesamt-Auszahlung</span>
      <span class="text-right font-mono font-semibold"
        >{formatEuro(totalNet)}</span
      >
    </div>
  </div>
</div>

{#if unbookedEmployees.length > 0}
  <div class="card border-base-300 bg-base-100 mb-4 border">
    <div class="card-body gap-3">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h3 class="card-title text-base">Noch nicht abgerechnet</h3>
        <button
          type="button"
          class="btn btn-primary btn-sm gap-1"
          onclick={autoGenerate}
          disabled={busy.active}
        >
          <Sparkles size={14} />
          Jetzt automatisch abrechnen
        </button>
      </div>
      <p class="text-base-content/60 text-sm">
        {unbookedEmployees.length} Mitarbeiter ohne Eintrag in dieser Periode. Normal
        läuft das am Stichtag automatisch — der Knopf oben startet den Lauf bei Bedarf
        vorzeitig.
      </p>
    </div>
  </div>
{/if}

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if entries.length === 0}
      <EmptyState
        icon={Wallet}
        title="Noch keine Abrechnungen"
        description="Werden am Stichtag automatisch erstellt."
      />
    {:else}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Mitarbeiter</th>
              <th>Pers-Nr.</th>
              <th class="text-right">Brutto</th>
              <th class="text-right">Steuer</th>
              <th class="text-right">SV (AN)</th>
              <th class="text-right">Netto</th>
              <th>Status</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each entries as e (e.id)}
              <tr>
                <td>
                  <a
                    class="link"
                    href={`/payroll/${id}/employee/${e.employeeId}`}
                    >{e.employeeName}</a
                  >
                </td>
                <td class="font-mono text-xs">{e.personnelNumber ?? '—'}</td>
                <td class="text-right font-mono"
                  >{formatEuro(Number(e.grossTotal))}</td
                >
                <td class="text-right font-mono"
                  >{formatEuro(Number(e.taxTotal))}</td
                >
                <td class="text-right font-mono"
                  >{formatEuro(Number(e.socialEmployeeTotal))}</td
                >
                <td class="text-right font-mono font-semibold"
                  >{formatEuro(Number(e.netTotal))}</td
                >
                <td>
                  <span class="badge badge-sm {statusBadge(e.status)}">
                    {statusLabel(e.status)}
                  </span>
                </td>
                <td>
                  <div class="flex justify-end gap-1">
                    <a
                      class="btn btn-ghost btn-xs gap-1"
                      href={`/payroll/${id}/employee/${e.employeeId}`}
                      title="Lohnzettel ansehen"
                    >
                      <FileText size={14} />
                    </a>
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
