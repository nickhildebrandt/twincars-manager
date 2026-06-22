<script lang="ts">
  import { Clock } from '@lucide/svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import {
    createTimeEntryRemote,
    currentEmployeeRemote,
    listTimeEntriesRemote
  } from '../../../routes/hours/hours.remote'

  /**
   * Small contextual "Arbeit erfassen" modal used from the
   * invoice/offer detail pages. The current employee is resolved
   * server-side from the signed-in user's email — we just need the
   * document id (offer or invoice) to link the time entry to it.
   *
   * Why a dedicated modal instead of routing to `/hours/new`:
   *   - the employee is already known (no picker needed);
   *   - the link to the document is implicit (no link-kind switch);
   *   - the operator stays on the document detail page after submit.
   */
  type Props = { open: boolean; documentId: string; onClose: () => void }

  let { open = $bindable(false), documentId, onClose }: Props = $props()

  const todayIso = (): string => new Date().toISOString().slice(0, 10)

  let date = $state(todayIso())
  let hours = $state(1)
  let task = $state('')
  let errorMsg = $state<string | null>(null)

  // Resolve the caller's employee id once when the dialog opens. The
  // query is dehydrated by the layout-level remote cache so subsequent
  // openings are free.
  const employeeQ = $derived(currentEmployeeRemote())
  const employee = $derived(employeeQ.current)

  /** Submit button validity gate — mirrors the rules in `submit`. */
  const valid = $derived.by(() => {
    if (!date) return false
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return false
    const t = task.trim()
    if (!t || t.length > 200) return false
    return true
  })

  const reset = () => {
    date = todayIso()
    hours = 1
    task = ''
    errorMsg = null
  }

  const close = () => {
    open = false
    reset()
    onClose()
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null

    if (!employee) {
      errorMsg = 'Es ist kein Mitarbeiterprofil mit Ihrem Konto verknüpft.'
      return
    }
    if (!date) {
      errorMsg = 'Bitte ein Datum eingeben.'
      return
    }
    if (!Number.isFinite(hours) || hours <= 0) {
      errorMsg = 'Bitte eine positive Stundenzahl eingeben.'
      return
    }
    if (hours > 24) {
      errorMsg = 'Maximal 24 Stunden pro Eintrag.'
      return
    }
    const taskTrim = task.trim()
    if (!taskTrim) {
      errorMsg = 'Bitte angeben, was gemacht wurde.'
      return
    }
    if (taskTrim.length > 200) {
      errorMsg = 'Beschreibung darf maximal 200 Zeichen lang sein.'
      return
    }

    try {
      await busy.run(() =>
        createTimeEntryRemote({
          employeeId: employee.id,
          date,
          hours,
          documentId,
          task: taskTrim
        })
      )
      toast.success('Stunden erfasst.')
      // Nudge any list query that's filtered by this document so the
      // "Erfasste Stunden" card on the detail page reflects the new
      // row immediately. The mutation already refreshes up to 4
      // `listTimeEntriesRemote` instances; this refresh is targeted
      // at the document-scoped instance specifically.
      await listTimeEntriesRemote({ page: 1, size: 25, documentId }).refresh()
      close()
    } catch (err) {
      handleClientError(err, 'Stunden konnten nicht erfasst werden')
    }
  }
</script>

{#if open}
  <dialog class="modal modal-open">
    <div class="modal-box">
      <h3 class="text-lg font-semibold">
        <Clock size={18} class="inline-block" />
        Arbeit erfassen
      </h3>
      <form onsubmit={submit} class="mt-3 flex flex-col gap-3">
        {#if errorMsg}
          <div class="alert alert-error">
            <span>{errorMsg}</span>
          </div>
        {/if}
        {#if employee}
          <p class="text-base-content/60 text-sm">
            Eingetragen für: <span class="font-medium"
              >{employee.firstName} {employee.lastName}</span
            >
          </p>
        {/if}

        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Datum *</span>
          <input
            type="date"
            class="input input-bordered w-full"
            bind:value={date}
          />
        </label>

        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Stunden *</span>
          <input
            type="number"
            class="input input-bordered w-full"
            min="0.25"
            max="24"
            step="0.25"
            bind:value={hours}
          />
        </label>

        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Was wurde gemacht? *</span>
          <input
            class="input input-bordered w-full"
            maxlength="200"
            placeholder="z. B. Bremsen prüfen"
            bind:value={task}
          />
        </label>

        <div class="modal-action">
          <button
            type="button"
            class="btn btn-ghost"
            onclick={close}
            disabled={busy.active}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={busy.active || !valid}
          >
            {#if busy.active}
              <span class="loading loading-spinner loading-sm"></span>
            {/if}
            Speichern
          </button>
        </div>
      </form>
    </div>
    <button
      type="button"
      class="modal-backdrop"
      aria-label="Schließen"
      onclick={close}
    ></button>
  </dialog>
{/if}
