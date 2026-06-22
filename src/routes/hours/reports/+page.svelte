<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import {
    monthlyReportRemote,
    utilizationSummaryRemote
  } from '../hours.remote'
  import { pickEmployeesRemote } from '../../pickers.remote'
  import { handleClientError } from '$lib/utils/client-error'

  type Tab = 'utilization' | 'monthly'

  const todayIso = (): string => new Date().toISOString().slice(0, 10)
  const firstOfMonth = (): string => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }

  let tab = $state<Tab>('utilization')

  // Utilization tab state.
  let from = $state(firstOfMonth())
  let to = $state(todayIso())
  let utilEmployeeId = $state('')
  let utilEmployeeLabel = $state('')

  // Monthly tab state.
  const now = new Date()
  let year = $state(now.getFullYear())
  let month = $state(now.getMonth() + 1)

  const utilizationQuery = $derived(
    utilizationSummaryRemote({
      from,
      to,
      employeeId: utilEmployeeId || undefined
    })
  )
  const monthlyQuery = $derived(monthlyReportRemote({ year, month }))

  $effect(() => {
    if (utilizationQuery.error) handleClientError(utilizationQuery.error)
  })
  $effect(() => {
    if (monthlyQuery.error) handleClientError(monthlyQuery.error)
  })

  const searchEmployees = (params: { q: string; page: number; size: number }) =>
    pickEmployeesRemote({ ...params, size: params.size as 10 | 25 | 50 | 100 })

  const fmtHours = (v: number): string =>
    v.toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })

  const monthLabels = [
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
  ]

  const yearOptions = Array.from(
    { length: 10 },
    (_, i) => now.getFullYear() - i
  )
</script>

<PageHeader title="Auswertungen" back="/hours" />

<div class="card border-base-300 bg-base-100 mb-4 border">
  <div class="card-body p-3">
    <div role="tablist" class="tabs tabs-boxed">
      <button
        type="button"
        role="tab"
        class="tab"
        class:tab-active={tab === 'utilization'}
        onclick={() => (tab = 'utilization')}>Auslastung</button
      >
      <button
        type="button"
        role="tab"
        class="tab"
        class:tab-active={tab === 'monthly'}
        onclick={() => (tab = 'monthly')}>Monatsauswertung</button
      >
    </div>
  </div>
</div>

{#if tab === 'utilization'}
  <div class="card border-base-300 bg-base-100 mb-4 border">
    <div class="card-body flex-row flex-wrap gap-3">
      <label class="flex flex-col gap-1">
        <span class="label-text">Von</span>
        <input
          type="date"
          class="input input-bordered input-sm w-44"
          bind:value={from}
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="label-text">Bis</span>
        <input
          type="date"
          class="input input-bordered input-sm w-44"
          bind:value={to}
        />
      </label>
      <label class="flex min-w-[16rem] flex-1 flex-col gap-1">
        <span class="label-text">Mitarbeiter</span>
        <SearchablePicker
          bind:value={utilEmployeeId}
          bind:valueLabel={utilEmployeeLabel}
          placeholder="— alle Mitarbeiter —"
          dialogTitle="Mitarbeiter auswählen"
          search={searchEmployees}
          onSelect={() => {}}
        />
      </label>
    </div>
  </div>

  {#await utilizationQuery then data}
    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body p-0">
        {#if data.rows.length === 0}
          <p class="text-base-content/60 p-4 text-sm">
            Keine Einträge im gewählten Zeitraum.
          </p>
        {:else}
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Mitarbeiter</th>
                  <th class="text-right">Stunden</th>
                  <th class="text-right">Davon abrechenbar</th>
                  <th class="text-right">Tage erfasst</th>
                </tr>
              </thead>
              <tbody>
                {#each data.rows as r (r.employeeId)}
                  <tr>
                    <td>{r.employeeName}</td>
                    <td class="text-right font-mono"
                      >{fmtHours(r.totalHours)}</td
                    >
                    <td class="text-right font-mono"
                      >{fmtHours(r.billableHours)}</td
                    >
                    <td class="text-right font-mono">{r.daysLogged}</td>
                  </tr>
                {/each}
              </tbody>
              <tfoot class="bg-base-200/30 border-t-2 font-semibold">
                <tr>
                  <td>Summe</td>
                  <td class="text-right font-mono"
                    >{fmtHours(data.totals.totalHours)}</td
                  >
                  <td class="text-right font-mono"
                    >{fmtHours(data.totals.billableHours)}</td
                  >
                  <td class="text-right font-mono">{data.totals.daysLogged}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/await}
{:else}
  <div class="card border-base-300 bg-base-100 mb-4 border">
    <div class="card-body flex-row flex-wrap gap-3">
      <label class="flex flex-col gap-1">
        <span class="label-text">Jahr</span>
        <select class="select select-bordered select-sm w-32" bind:value={year}>
          {#each yearOptions as y}
            <option value={y}>{y}</option>
          {/each}
        </select>
      </label>
      <label class="flex flex-col gap-1">
        <span class="label-text">Monat</span>
        <select
          class="select select-bordered select-sm w-44"
          bind:value={month}
        >
          {#each monthLabels as label, i}
            <option value={i + 1}>{label}</option>
          {/each}
        </select>
      </label>
    </div>
  </div>

  {#await monthlyQuery then rows}
    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body p-0">
        {#if rows.length === 0}
          <p class="text-base-content/60 p-4 text-sm">
            Keine Einträge in diesem Monat.
          </p>
        {:else}
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Mitarbeiter</th>
                  <th class="text-right">Stunden</th>
                  <th class="text-right">Tage erfasst</th>
                  <th class="text-right">Ø Std/Tag</th>
                </tr>
              </thead>
              <tbody>
                {#each rows as r (r.employeeId)}
                  <tr>
                    <td>{r.employeeName}</td>
                    <td class="text-right font-mono"
                      >{fmtHours(r.totalHours)}</td
                    >
                    <td class="text-right font-mono">{r.daysLogged}</td>
                    <td class="text-right font-mono"
                      >{fmtHours(r.avgHoursPerDay)}</td
                    >
                  </tr>
                {/each}
              </tbody>
              <tfoot class="bg-base-200/30 border-t-2 font-semibold">
                <tr>
                  <td>Summe</td>
                  <td class="text-right font-mono"
                    >{fmtHours(rows.reduce((a, r) => a + r.totalHours, 0))}</td
                  >
                  <td class="text-right font-mono"
                    >{rows.reduce((a, r) => a + r.daysLogged, 0)}</td
                  >
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/await}
{/if}
