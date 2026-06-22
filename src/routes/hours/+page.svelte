<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, Clock, Pencil, Trash2, BarChart3 } from '@lucide/svelte'
  import {
    canReadAllHoursRemote,
    deleteTimeEntryRemote,
    listTimeEntriesRemote
  } from './hours.remote'
  import { pickEmployeesRemote } from '../pickers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  /** Run once at SSR to figure out which tabs the caller sees. */
  const canReadAll = await canReadAllHoursRemote()

  type Scope = 'own' | 'all'
  let scope = $state<Scope>(canReadAll ? 'all' : 'own')

  let pageNum = $state(1)
  const size = 25
  let dateFrom = $state('')
  let dateTo = $state('')
  let employeeFilterId = $state('')
  let employeeFilterLabel = $state('')

  const query = $derived(
    listTimeEntriesRemote({
      page: pageNum,
      size,
      scope,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      employeeId:
        scope === 'all' && employeeFilterId ? employeeFilterId : undefined
    })
  )

  const initial = await untrack(() => query)

  let lastResult = $state<typeof initial>(initial)
  $effect(() => {
    if (query.current) lastResult = query.current
  })

  const result = $derived(query.current ?? lastResult)
  const items = $derived(result.items)
  const total = $derived(result.total)
  const pageCount = $derived(result.pageCount)

  // Optional grand total of hours in the current filter window. The
  // service returns it as a non-standard extra field on the list
  // response — read it defensively so older cached results still
  // render.
  const totalHours = $derived(
    (result as { totalHours?: number }).totalHours ?? 0
  )

  $effect(() => {
    if (query.error) handleClientError(query.error)
  })

  const searchEmployees = (params: { q: string; page: number; size: number }) =>
    pickEmployeesRemote({ ...params, size: params.size as 10 | 25 | 50 | 100 })

  const onFilterChange = () => {
    pageNum = 1
  }

  const onScope = (next: Scope) => {
    if (scope === next) return
    scope = next
    pageNum = 1
  }

  let confirmOpen = $state(false)
  let toDelete = $state<{ id: string; label: string } | null>(null)

  const remove = async () => {
    if (!toDelete) return
    const { id, label } = toDelete
    try {
      await busy.run(() =>
        deleteTimeEntryRemote({ id }).updates(
          listTimeEntriesRemote({
            page: pageNum,
            size,
            scope,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            employeeId:
              scope === 'all' && employeeFilterId ? employeeFilterId : undefined
          }).withOverride((current) => ({
            ...current,
            items: current.items.filter((e) => e.id !== id),
            total: Math.max(0, current.total - 1)
          }))
        )
      )
      toast.success(`Stundeneintrag „${label}" gelöscht.`)
      toDelete = null
    } catch (err) {
      handleClientError(err)
    }
  }

  const fmtHours = (v: string | number): string => {
    const n = typeof v === 'string' ? Number(v) : v
    return n.toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const fmtDate = (iso: string): string => {
    const [y, m, d] = iso.split('-')
    return `${d}.${m}.${y}`
  }
</script>

<PageHeader
  title="Stunden"
  primaryAction={{ label: 'Stunden erfassen', href: '/hours/new', icon: Plus }}
>
  {#snippet toolbar()}
    <div
      class="card border-base-300 bg-base-100 flex flex-col gap-3 border p-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      {#if canReadAll}
        <div role="tablist" class="tabs tabs-boxed">
          <button
            type="button"
            role="tab"
            class="tab"
            class:tab-active={scope === 'own'}
            onclick={() => onScope('own')}>Eigene</button
          >
          <button
            type="button"
            role="tab"
            class="tab"
            class:tab-active={scope === 'all'}
            onclick={() => onScope('all')}>Alle</button
          >
        </div>
      {/if}

      <label class="flex flex-col gap-1">
        <span class="label-text">Von</span>
        <input
          type="date"
          class="input input-bordered input-sm w-full sm:w-44"
          bind:value={dateFrom}
          onchange={onFilterChange}
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="label-text">Bis</span>
        <input
          type="date"
          class="input input-bordered input-sm w-full sm:w-44"
          bind:value={dateTo}
          onchange={onFilterChange}
        />
      </label>

      {#if scope === 'all'}
        <label class="flex flex-col gap-1 sm:min-w-[16rem] sm:flex-1">
          <span class="label-text">Mitarbeiter</span>
          <SearchablePicker
            bind:value={employeeFilterId}
            bind:valueLabel={employeeFilterLabel}
            placeholder="— alle Mitarbeiter —"
            dialogTitle="Mitarbeiter auswählen"
            search={searchEmployees}
            onSelect={() => onFilterChange()}
          />
        </label>
      {/if}

      {#if canReadAll}
        <a class="btn btn-ghost btn-sm gap-2 sm:ms-auto" href="/hours/reports">
          <BarChart3 size={16} /> Auswertungen
        </a>
      {/if}
    </div>
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if items.length === 0}
      <EmptyState
        icon={Clock}
        title="Noch keine Stunden erfasst"
        description="Erfassen Sie Ihre erste Stundenposition."
      >
        {#snippet action()}
          <a class="btn btn-primary btn-sm gap-2" href="/hours/new">
            <Plus size={16} /> Stunden erfassen
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Mitarbeiter</th>
              <th class="text-right">Stunden</th>
              <th>Auftrag / Kunde</th>
              <th>Notiz</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as e (e.id)}
              <tr
                class="hover:bg-base-200 cursor-pointer"
                onclick={() => goto(`/hours/${e.id}`)}
              >
                <td>{fmtDate(e.date)}</td>
                <td
                  >{`${e.employeeFirstName} ${e.employeeLastName}`.trim() ||
                    e.employeeNumber}</td
                >
                <td class="text-right font-mono">{fmtHours(e.hours)}</td>
                <td>
                  {#if e.documentNumber}
                    Beleg {e.documentNumber}
                  {:else if e.customerName}
                    Kunde {e.customerName}
                  {:else if e.task}
                    {e.task}
                  {:else}
                    <span class="text-base-content/50">—</span>
                  {/if}
                </td>
                <td class="max-w-xs truncate">{e.note ?? ''}</td>
                <td onclick={(ev) => ev.stopPropagation()}>
                  <div class="flex justify-end gap-1">
                    <a
                      class="btn btn-ghost btn-sm btn-square"
                      href="/hours/{e.id}/edit"
                      aria-label="Bearbeiten"
                    >
                      <Pencil size={16} />
                    </a>
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      onclick={() => {
                        toDelete = {
                          id: e.id,
                          label: `${fmtDate(e.date)} · ${fmtHours(e.hours)} h`
                        }
                        confirmOpen = true
                      }}
                      aria-label="Löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
          <tfoot class="bg-base-200/30 border-t-2 font-semibold">
            <tr>
              <td colspan="2">Summe</td>
              <td class="text-right font-mono">{fmtHours(totalHours)}</td>
              <td colspan="3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <Pagination
        {total}
        page={pageNum}
        {pageCount}
        {size}
        onPage={(p) => (pageNum = p)}
      />
    {/if}
  </div>
</div>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Stundeneintrag löschen?"
  message={`Soll der Stundeneintrag „${toDelete?.label ?? ''}" wirklich gelöscht werden?`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => (confirmOpen = false)}
/>
