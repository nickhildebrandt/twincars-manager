<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Pencil, Trash2 } from '@lucide/svelte'
  import { deleteTimeEntryRemote, getTimeEntryRemote } from '../hours.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const id = untrack(() => page.params.id!)
  const e = await getTimeEntryRemote({ id })

  const fmtHours = (v: string | number): string =>
    Number(v).toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })

  const fmtDate = (iso: string): string => {
    const [y, m, d] = iso.split('-')
    return `${d}.${m}.${y}`
  }

  let confirmOpen = $state(false)

  const remove = async () => {
    try {
      await busy.run(() => deleteTimeEntryRemote({ id }))
      toast.success('Stundeneintrag gelöscht.')
      goto('/hours')
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title={`${fmtDate(e.date)} · ${fmtHours(e.hours)} h`}
  back="/hours"
  primaryAction={{
    label: 'Bearbeiten',
    href: `/hours/${e.id}/edit`,
    icon: Pencil
  }}
/>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body">
      <h3 class="card-title text-base">Stammdaten</h3>
      <dl class="grid grid-cols-3 gap-y-1 text-sm">
        <dt class="text-base-content/60">Mitarbeiter</dt>
        <dd class="col-span-2"
          >{`${e.employeeFirstName} ${e.employeeLastName}`.trim() || '—'} · {e.employeeNumber}</dd
        >
        <dt class="text-base-content/60">Datum</dt>
        <dd class="col-span-2">{fmtDate(e.date)}</dd>
        <dt class="text-base-content/60">Stunden</dt>
        <dd class="col-span-2 font-mono">{fmtHours(e.hours)}</dd>
      </dl>
    </div>
  </div>

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body">
      <h3 class="card-title text-base">Verknüpfung</h3>
      <dl class="grid grid-cols-3 gap-y-1 text-sm">
        <dt class="text-base-content/60">Beleg</dt>
        <dd class="col-span-2">
          {#if e.documentNumber}
            <a class="link" href="/invoices/{e.documentId}">
              {e.documentNumber}
            </a>
          {:else}
            —
          {/if}
        </dd>
        <dt class="text-base-content/60">Kunde</dt>
        <dd class="col-span-2">
          {#if e.customerName && e.customerId}
            <a class="link" href="/customers/{e.customerId}">
              {e.customerName}
            </a>
          {:else}
            {e.customerName ?? '—'}
          {/if}
        </dd>
        <dt class="text-base-content/60">Aufgabe</dt>
        <dd class="col-span-2">{e.task ?? '—'}</dd>
      </dl>
    </div>
  </div>

  {#if e.note}
    <div class="card border-base-300 bg-base-100 border lg:col-span-2">
      <div class="card-body">
        <h3 class="card-title text-base">Notiz</h3>
        <p class="text-sm whitespace-pre-wrap">{e.note}</p>
      </div>
    </div>
  {/if}
</div>

<div class="mt-4 flex justify-end">
  <button
    class="btn btn-ghost text-error gap-2"
    onclick={() => (confirmOpen = true)}
  >
    <Trash2 size={16} /> Löschen
  </button>
</div>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Stundeneintrag löschen?"
  message="Soll dieser Stundeneintrag wirklich gelöscht werden?"
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => (confirmOpen = false)}
/>
