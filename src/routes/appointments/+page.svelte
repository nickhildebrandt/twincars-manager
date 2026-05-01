<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Plus, CalendarClock, Trash2 } from '@lucide/svelte'
  import {
    listAppointmentsRemote,
    deleteAppointmentRemote
  } from './appointments.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  let page = $state(1)
  let size = $state<10 | 25 | 50 | 100>(25)
  let q = $state('')

  const aQ = $derived(listAppointmentsRemote({ page, size, q: q || undefined }))
  const items = $derived(aQ.current?.items ?? [])
  const total = $derived(aQ.current?.total ?? 0)
  const pageCount = $derived(aQ.current?.pageCount ?? 1)
  const loading = $derived(aQ.loading)

  $effect(() => {
    if (aQ.error) handleClientError(aQ.error)
  })

  let confirmOpen = $state(false)
  let toDelete = $state<{ id: string; title: string } | null>(null)

  const remove = async () => {
    if (!toDelete) return
    try {
      await deleteAppointmentRemote({ id: toDelete.id })
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
      onQuery={() => (page = 1)}
    />
  {/snippet}
</PageHeader>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-0">
    {#if loading && items.length === 0}
      <div class="text-base-content/60 flex h-32 items-center justify-center">
        <span class="loading loading-spinner"></span>
      </div>
    {:else if items.length === 0}
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
        {page}
        {pageCount}
        {size}
        onPage={(p) => (page = p)}
        onSize={(s) => {
          size = s as 10 | 25 | 50 | 100
          page = 1
        }}
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
