<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import CalendarForm, {
    type CalendarFormValues
  } from '../../CalendarForm.svelte'
  import { ClipboardList, Trash2 } from '@lucide/svelte'
  import {
    deleteCalendarEntryRemote,
    getCalendarEntryRemote,
    updateCalendarEntryRemote
  } from '../../calendar.remote'
  import {
    createWorkOrderFromAppointmentRemote,
    getWorkOrderIdForAppointmentRemote
  } from '../../../orders/orders.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  const id = untrack(() => page.params.id!)

  /**
   * Top-level await: SSR carries the entry, hydration reuses cache.
   * The shared `CalendarForm` seeds its state from `entry` once at
   * mount; this page owns the update call, the delete button and the
   * work-order actions.
   */
  const entry = await getCalendarEntryRemote({ id })

  /** Kind kann nicht nachträglich geändert werden (Server lehnt ab). */
  const kind = entry.kind as 'appointment' | 'closure'

  /**
   * Work-order integration for Termine: the probe below requires the
   * `orders` permission — a 403 hides both actions (a calendar user
   * without the orders module could not create an order anyway).
   */
  let existingOrderId = $state<string | null>(null)
  let ordersAvailable = $state(false)
  if (kind === 'appointment') {
    try {
      const existing = await getWorkOrderIdForAppointmentRemote({
        appointmentId: id
      })
      existingOrderId = existing?.id ?? null
      ordersAvailable = true
    } catch (err) {
      // Permission probe only — keep the actions hidden, log for devs.
      console.info('[calendar] work-order actions hidden:', err)
    }
  }

  const createOrder = async () => {
    try {
      const created = await busy.run(() =>
        createWorkOrderFromAppointmentRemote({ appointmentId: id })
      )
      formDirty.clear()
      toast.success('Auftrag angelegt.')
      goto(`/orders/${created.id}`)
    } catch (err) {
      handleClientError(err, 'Auftrag konnte nicht angelegt werden')
    }
  }

  const save = async (values: CalendarFormValues) => {
    try {
      await busy.run(() => updateCalendarEntryRemote({ id, values }))
      toast.success(
        values.kind === 'appointment'
          ? 'Termin gespeichert.'
          : 'Betriebsschließung gespeichert.'
      )
      goto('/calendar')
    } catch (err) {
      handleClientError(err)
    }
  }

  let confirmOpen = $state(false)

  const remove = async () => {
    try {
      formDirty.clear()
      await busy.run(() => deleteCalendarEntryRemote({ id }))
      toast.success('Eintrag gelöscht.')
      goto('/calendar')
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title={kind === 'appointment'
    ? 'Termin bearbeiten'
    : 'Betriebsschließung bearbeiten'}
  back="/calendar"
/>

{#if kind === 'appointment' && ordersAvailable}
  <div class="mb-4 flex flex-wrap gap-2">
    {#if existingOrderId}
      <a href={`/orders/${existingOrderId}`} class="btn btn-ghost btn-sm gap-2">
        <ClipboardList size={14} />
        Zum Auftrag
      </a>
    {:else}
      <button
        type="button"
        class="btn btn-ghost btn-sm gap-2"
        onclick={createOrder}
        disabled={busy.active}
      >
        <ClipboardList size={14} />
        Auftrag erstellen
      </button>
    {/if}
  </div>
{/if}

<CalendarForm
  mode="edit"
  initial={{ ...entry, kind, id }}
  onSave={save}
  onCancel={() => goto('/calendar')}
>
  {#snippet deleteAction()}
    <button
      type="button"
      class="btn btn-ghost text-error gap-1"
      onclick={() => (confirmOpen = true)}
      disabled={busy.active}
    >
      <Trash2 size={14} />
      Löschen
    </button>
  {/snippet}
</CalendarForm>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Eintrag löschen?"
  message="Der Eintrag wird unwiderruflich gelöscht."
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={remove}
  onClose={() => {}}
/>
