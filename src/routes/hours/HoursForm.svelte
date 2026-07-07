<script lang="ts" module>
  import {
    check,
    minLength,
    object,
    pipe,
    string,
    trim,
    unknown
  } from 'valibot'

  /**
   * Client-side schemas mirroring the rules previously enforced ad hoc
   * in `submit`. One schema per link kind, because exactly one of
   * documentId / customerId / task is required depending on the active
   * radio selection.
   */
  const hoursBaseShape = {
    employeeId: pipe(
      string(),
      minLength(1, 'Bitte einen Mitarbeiter auswählen.')
    ),
    date: pipe(string(), minLength(1, 'Bitte ein Datum eingeben.')),
    hours: pipe(
      unknown(),
      check((v) => {
        const n = Number(v)
        return Number.isFinite(n) && n > 0
      }, 'Bitte eine positive Stundenzahl eingeben.'),
      check((v) => Number(v) <= 24, 'Maximal 24 Stunden pro Eintrag.')
    )
  }

  const documentLinkSchema = object({
    ...hoursBaseShape,
    documentId: pipe(
      string(),
      minLength(1, 'Bitte einen Auftrag bzw. eine Rechnung auswählen.')
    )
  })

  const customerLinkSchema = object({
    ...hoursBaseShape,
    customerId: pipe(string(), minLength(1, 'Bitte einen Kunden auswählen.'))
  })

  const taskLinkSchema = object({
    ...hoursBaseShape,
    task: pipe(string(), trim(), minLength(1, 'Bitte eine Aufgabe eingeben.'))
  })
</script>

<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import FormField from '$lib/components/ui/FormField.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import { creationFlow, currentUrl } from '$lib/stores/creation-flow.svelte'
  import {
    useFormValidation,
    validationClasses
  } from '$lib/utils/form-validation.svelte'
  import {
    pickCustomersRemote,
    pickDocumentsRemote,
    pickEmployeesRemote
  } from '../pickers.remote'

  type LinkKind = 'document' | 'customer' | 'task'

  type Initial = {
    employeeId?: string | null
    employeeLabel?: string | null
    date?: string | null
    hours?: number | string | null
    documentId?: string | null
    documentLabel?: string | null
    customerId?: string | null
    customerLabel?: string | null
    task?: string | null
    note?: string | null
  }

  export type HoursFormValues = {
    employeeId: string
    date: string
    hours: number
    documentId?: string | null
    customerId?: string | null
    task?: string
    note?: string
  }

  type Props = {
    initial?: Initial
    /**
     * `:write_own`-only callers: render the employee row as a fixed
     * read-only field showing the caller's name. The form still posts
     * `employeeId`, but the picker is hidden.
     */
    lockedEmployee?: { id: string; label: string } | null
    onSave: (values: HoursFormValues) => Promise<void> | void
    onCancel?: () => void
  }

  const {
    initial = {},
    lockedEmployee = null,
    onSave,
    onCancel
  }: Props = $props()

  const init = untrack(() => ({ ...initial }))
  const lockedSnapshot = untrack(() =>
    lockedEmployee ? { ...lockedEmployee } : null
  )

  const todayIso = (): string => new Date().toISOString().slice(0, 10)

  /**
   * JSON-serializable snapshot of every form field — pushed into the
   * creation-flow store when the user jumps to a full-page create and
   * restored (below) when they come back.
   */
  type Draft = {
    employeeId: string
    employeeLabel: string
    date: string
    hours: number
    linkKind: LinkKind
    documentId: string
    documentLabel: string
    customerId: string
    customerLabel: string
    task: string
    note: string
  }

  // Returning from a full-page create? Consume the pending return for
  // THIS page exactly once — its draft wins over `initial`.
  const pending = untrack(() => creationFlow.pendingReturnFor(currentUrl()))
  const draft = (pending?.draft ?? null) as Draft | null

  let employeeId = $state(
    lockedSnapshot?.id ?? draft?.employeeId ?? init.employeeId ?? ''
  )
  let employeeLabel = $state(
    lockedSnapshot?.label ?? draft?.employeeLabel ?? init.employeeLabel ?? ''
  )
  let date = $state(draft?.date ?? init.date ?? todayIso())
  let hours = $state<number>(
    draft?.hours ?? (init.hours != null ? Number(init.hours) : 1)
  )

  // Initial link kind: restored draft wins, else derive from whichever
  // field is set.
  const initialLink: LinkKind =
    draft?.linkKind ??
    (init.documentId ? 'document' : init.customerId ? 'customer' : 'task')
  let linkKind = $state<LinkKind>(initialLink)

  let documentId = $state(draft?.documentId ?? init.documentId ?? '')
  let documentLabel = $state(draft?.documentLabel ?? init.documentLabel ?? '')
  let customerId = $state(draft?.customerId ?? init.customerId ?? '')
  let customerLabel = $state(draft?.customerLabel ?? init.customerLabel ?? '')
  let task = $state(draft?.task ?? init.task ?? '')
  let note = $state(draft?.note ?? init.note ?? '')

  // A successful create auto-selects the new entity in the picker
  // that started the flow.
  if (pending?.result && pending.originField === 'customerId') {
    customerId = pending.result.id
    customerLabel = pending.result.label
  }
  // A restored draft is unsaved user input — re-arm the leave guard.
  if (draft) untrack(() => formDirty.set(true))

  let errorMsg = $state<string | null>(null)

  const buildDraft = (): Draft => ({
    employeeId,
    employeeLabel,
    date,
    hours,
    linkKind,
    documentId,
    documentLabel,
    customerId,
    customerLabel,
    task,
    note
  })

  /** Cycle guard: no customer create while one is already in flight. */
  const canCreateCustomer = $derived(
    !creationFlow.activeEntities().has('customer')
  )

  const startCustomerCreate = () => {
    creationFlow.start({
      entity: 'customer',
      returnUrl: currentUrl(),
      originField: 'customerId',
      draft: buildDraft(),
      createdAt: Date.now()
    })
    // The draft carries the input — silence the unsaved-changes guard.
    formDirty.clear()
    goto('/customers/new')
  }

  /**
   * Validation handle for the per-field error display — NOT for gating
   * the submit button (rule 1.1: always clickable except while busy).
   * The active schema follows the selected link kind;
   * field errors only surface once the field was touched (blur /
   * selection) or a submit was attempted.
   */
  const fv = useFormValidation(
    () =>
      linkKind === 'document'
        ? documentLinkSchema
        : linkKind === 'customer'
          ? customerLinkSchema
          : taskLinkSchema,
    () =>
      linkKind === 'document'
        ? { employeeId, date, hours, documentId }
        : linkKind === 'customer'
          ? { employeeId, date, hours, customerId }
          : { employeeId, date, hours, task }
  )

  const err = (k: string): string | null =>
    (fv.errors as Record<string, string | null>)[k] ?? null
  const wasTouched = (k: string): boolean =>
    (fv.touched as Record<string, boolean>)[k] === true

  const searchEmployees = (params: { q: string; page: number; size: number }) =>
    pickEmployeesRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
    }).run()

  const searchDocuments = (params: { q: string; page: number; size: number }) =>
    pickDocumentsRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
    }).run()

  const searchCustomers = (params: { q: string; page: number; size: number }) =>
    pickCustomersRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
    }).run()

  const submit = async (e: Event) => {
    e.preventDefault()
    fv.markAllTouched()
    if (!fv.valid) {
      const errs = fv.errors as Record<string, string | null>
      errorMsg =
        errs._form ??
        Object.values(errs).find((v) => v != null) ??
        'Bitte prüfen Sie Ihre Eingaben.'
      return
    }
    errorMsg = null

    let docOut: string | null = null
    let custOut: string | null = null
    let taskOut: string | undefined = undefined

    if (linkKind === 'document') {
      docOut = documentId
    } else if (linkKind === 'customer') {
      custOut = customerId
    } else {
      taskOut = task.trim()
    }

    formDirty.clear()
    await onSave({
      employeeId,
      date,
      hours,
      documentId: docOut,
      customerId: custOut,
      task: taskOut,
      note: note.trim() ? note.trim() : undefined
    })
  }

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())
</script>

<form
  onsubmit={submit}
  oninput={markDirty}
  onchange={markDirty}
  novalidate
  class="card border-base-300 bg-base-100 border"
>
  <div class="card-body gap-4">
    {#if errorMsg}
      <div class="alert alert-error" role="alert"><span>{errorMsg}</span></div>
    {/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Grunddaten</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          label="Mitarbeiter"
          required
          colSpan="sm:col-span-2"
          error={wasTouched('employeeId') ? err('employeeId') : null}
        >
          {#if lockedEmployee}
            <input
              class="input input-bordered w-full"
              value={lockedEmployee.label}
              readonly
            />
          {:else}
            <SearchablePicker
              bind:value={employeeId}
              bind:valueLabel={employeeLabel}
              placeholder="- Mitarbeiter suchen und auswählen -"
              dialogTitle="Mitarbeiter auswählen"
              search={searchEmployees}
              onSelect={() => fv.markTouched('employeeId')}
            />
          {/if}
        </FormField>

        <FormField
          label="Datum"
          required
          error={wasTouched('date') ? err('date') : null}
        >
          <input
            type="date"
            class={validationClasses(err('date'), wasTouched('date'))}
            bind:value={date}
            onblur={() => fv.markTouched('date')}
          />
        </FormField>

        <FormField
          label="Stunden"
          required
          error={wasTouched('hours') ? err('hours') : null}
        >
          <input
            type="number"
            class={validationClasses(err('hours'), wasTouched('hours'))}
            min="0.25"
            max="24"
            step="0.25"
            bind:value={hours}
            onblur={() => fv.markTouched('hours')}
          />
        </FormField>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Verknüpfung</legend>
      <div class="flex flex-wrap gap-4">
        <label class="label cursor-pointer gap-2">
          <input
            type="radio"
            class="radio radio-sm"
            value="document"
            checked={linkKind === 'document'}
            onchange={() => (linkKind = 'document')}
          />
          <span class="label-text">Auftrag / Rechnung</span>
        </label>
        <label class="label cursor-pointer gap-2">
          <input
            type="radio"
            class="radio radio-sm"
            value="customer"
            checked={linkKind === 'customer'}
            onchange={() => (linkKind = 'customer')}
          />
          <span class="label-text">Kunde</span>
        </label>
        <label class="label cursor-pointer gap-2">
          <input
            type="radio"
            class="radio radio-sm"
            value="task"
            checked={linkKind === 'task'}
            onchange={() => (linkKind = 'task')}
          />
          <span class="label-text">Freie Aufgabe</span>
        </label>
      </div>

      <div class="mt-3">
        {#if linkKind === 'document'}
          <FormField
            label="Auftrag / Rechnung"
            required
            error={wasTouched('documentId') ? err('documentId') : null}
          >
            <SearchablePicker
              bind:value={documentId}
              bind:valueLabel={documentLabel}
              placeholder="- Beleg suchen und auswählen -"
              dialogTitle="Beleg auswählen"
              search={searchDocuments}
              onSelect={() => fv.markTouched('documentId')}
            />
          </FormField>
        {:else if linkKind === 'customer'}
          <FormField
            label="Kunde"
            required
            error={wasTouched('customerId') ? err('customerId') : null}
          >
            <SearchablePicker
              bind:value={customerId}
              bind:valueLabel={customerLabel}
              placeholder="- Kunde suchen und auswählen -"
              dialogTitle="Kunde auswählen"
              search={searchCustomers}
              onSelect={() => fv.markTouched('customerId')}
              createLabel={canCreateCustomer
                ? 'Neuen Kunden anlegen'
                : undefined}
              onCreateNew={canCreateCustomer ? startCustomerCreate : undefined}
            />
          </FormField>
        {:else}
          <FormField
            label="Aufgabe"
            required
            error={wasTouched('task') ? err('task') : null}
          >
            <input
              class={validationClasses(err('task'), wasTouched('task'))}
              maxlength="200"
              placeholder="z. B. Werkstattorganisation"
              bind:value={task}
              onblur={() => fv.markTouched('task')}
            />
          </FormField>
        {/if}
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Notiz</legend>
      <textarea
        class="textarea textarea-bordered min-h-24 w-full"
        maxlength="2000"
        bind:value={note}
      ></textarea>
    </fieldset>

    <div class="card-actions justify-end gap-2">
      {#if onCancel}
        <button
          type="button"
          class="btn btn-ghost"
          onclick={onCancel}
          disabled={busy.active}>Abbrechen</button
        >
      {/if}
      <button type="submit" class="btn btn-primary" disabled={busy.active}>
        {#if busy.active}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Speichern
      </button>
    </div>
  </div>
</form>
