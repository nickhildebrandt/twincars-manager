<script lang="ts">
  import { untrack } from 'svelte'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, CalendarClock, Trash2 } from '@lucide/svelte'
  import {
    listAppointmentsRemote,
    deleteAppointmentRemote
  } from './appointments.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  let pageNum = $state(1)
  const size = 25
  let q = $state('')

  const query = $derived(
    listAppointmentsRemote({ page: pageNum, size, q: q || undefined })
  )

  /** Top-level await: SSR carries the data, hydration reuses the cache. */
  const initial = await untrack(() => query)

  /** Cache last successful result so paginating doesn't flash empty state. */
  let lastResult = $state<typeof initial>(initial)
  $effect(() => {
    if (query.current) lastResult = query.current
  })

  const result = $derived(query.current ?? lastResult)
  const items = $derived(result.items)
  const total = $derived(result.total)
  const pageCount = $derived(result.pageCount)
  const loading = $derived(query.loading)

  $effect(() => {
    if (query.error) handleClientError(query.error)
  })

  let confirmOpen = $state(false)
  let toDelete = $state<{ id: string; title: string } | null>(null)

  const remove = async () => {
    if (!toDelete) return
    try {
      await deleteAppointmentRemote({ id: toDelete.id }).updates(
        listAppointmentsRemote
      )
      toast.success(`Termin „${toDelete.title}" gelöscht.`)
      toDelete = null
    } catch (err) {
      handleClientError(err)
    }
  }

  const fmtDateTime = (d: Date | string) => {
    const dt = typeof d === 'string' ? new Date(d) : d
    return dt.toLocaleString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
</script>

<PageHeader
  title="Termine"
  primaryAction={{
    label: 'Neuer Termin',
    href: '/appointments/new',
    icon: Plus
  }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Termine suchen: Titel ..."
      onQuery={() => (pageNum = 1)}
    />
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if loading}
      <Loader variant="bar" />
    {/if}
    {#if items.length === 0}
      <EmptyState
        icon={CalendarClock}
        title="Noch keine Termine"
        description="Legen Sie Ihren ersten Termin an."
      >
        {#snippet action()}
          <a class="btn btn-primary btn-sm gap-2" href="/appointments/new">
            <Plus size={16} /> Neuer Termin
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="overflow-x-auto">
        <table class="table-zebra table">
          <thead>
            <tr>
              <th>Beginn</th>
              <th>Ende</th>
              <th>Titel</th>
              <th>Kunde</th>
              <th>Fahrzeug</th>
              <th>Mitarbeiter</th>
              <th>Status</th>
              <th class="text-right">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {#each items as a (a.id)}
              <tr class="hover:bg-base-200/50">
                <td class="whitespace-nowrap">{fmtDateTime(a.startsAt)}</td>
                <td class="whitespace-nowrap">{fmtDateTime(a.endsAt)}</td>
                <td class="font-medium">{a.title}</td>
                <td>{a.customerName ?? ''}</td>
                <td>{a.vehicleLabel ?? ''}</td>
                <td>{a.employeeName ?? ''}</td>
                <td>
                  <span
                    class="badge badge-sm"
                    class:badge-success={a.status === 'completed'}
                    class:badge-ghost={a.status === 'cancelled'}
                    class:badge-info={a.status === 'scheduled'}
                  >
                    {a.status}
                  </span>
                </td>
                <td>
                  <div class="flex justify-end gap-1">
                    <button
                      class="btn btn-ghost btn-sm btn-square text-error"
                      onclick={() => {
                        toDelete = { id: a.id, title: a.title }
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
  title="Termin löschen?"
  message={`Soll der Termin "${toDelete?.title ?? ''}" wirklich gelöscht werden?`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => (confirmOpen = false)}
/>
