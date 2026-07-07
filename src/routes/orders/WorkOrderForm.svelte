<script lang="ts" module>
  import {
    check,
    maxLength,
    minLength,
    object,
    pipe,
    string,
    trim
  } from 'valibot'

  /**
   * Client-side schema mirroring the server-side rules (title required
   * + binding rule 2.4: an order needs a customer OR a vehicle) so the
   * user sees the same German wording the server would emit. The
   * link rule is a root-level `check` and surfaces as `_form`.
   */
  const linkMessage =
    'Bitte mindestens einen Kunden oder ein Fahrzeug zuordnen.'

  const workOrderSchema = pipe(
    object({
      title: pipe(
        string('Bitte einen Titel eingeben.'),
        trim(),
        minLength(1, 'Der Titel darf nicht leer sein.'),
        maxLength(200, 'Der Titel darf maximal 200 Zeichen lang sein.')
      ),
      customerId: string(),
      vehicleId: string()
    }),
    check((v) => Boolean(v.customerId || v.vehicleId), linkMessage)
  )

  export type WorkOrderFormValues = {
    title: string
    description?: string
    customerId?: string
    vehicleId?: string
    /** Planned date `YYYY-MM-DD`, empty = not scheduled. */
    scheduledDate?: string
    /** Optional start time `HH:MM`; only sent together with a date. */
    scheduledTime?: string
    assigneeIds: string[]
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import { creationFlow, currentUrl } from '$lib/stores/creation-flow.svelte'
  import FormField from '$lib/components/ui/FormField.svelte'
  import CustomerVehiclePicker from '$lib/components/ui/CustomerVehiclePicker.svelte'
  import MultiSearchablePicker from '$lib/components/ui/MultiSearchablePicker.svelte'
  import {
    useFormValidation,
    validationClasses
  } from '$lib/utils/form-validation.svelte'
  import { pickEmployeesRemote } from '../pickers.remote'

  /**
   * Shared work-order editor used by `/orders/new` and
   * `/orders/[id]/edit`. Assignees are picked through the
   * MultiSearchablePicker over `pickEmployeesRemote` (search +
   * server-side pagination); customer/vehicle through the combined
   * relation-aware picker. All three pickers offer the full-page
   * creation flow ("Neu anlegen") with draft save/restore.
   *
   * While the user has not touched the title, it composes live from
   * the picked customer + vehicle labels ("Golf VII · B-AA 100 ·
   * Müller"); typing anything stops the auto mode, clearing the field
   * completely resumes it.
   *
   * The submit button is never gated on validity (rule 1.1) — clicking
   * with invalid input surfaces the German errors instead.
   */
  type Props = {
    initial?: {
      title?: string
      description?: string | null
      customerId?: string | null
      customerLabel?: string | null
      vehicleId?: string | null
      vehicleLabel?: string | null
      scheduledDate?: string | null
      scheduledTime?: string | null
      /** Currently assigned employees (id + display label). */
      assignees?: Array<{ id: string; label: string }>
    }
    onSave: (values: WorkOrderFormValues) => Promise<void> | void
    onCancel?: () => void
  }

  const { initial = {}, onSave, onCancel }: Props = $props()

  const init = untrack(() => ({
    title: initial.title ?? '',
    description: initial.description ?? '',
    customerId: initial.customerId ?? '',
    customerLabel: initial.customerLabel ?? '',
    vehicleId: initial.vehicleId ?? '',
    vehicleLabel: initial.vehicleLabel ?? '',
    scheduledDate: initial.scheduledDate ?? '',
    scheduledTime: initial.scheduledTime ?? '',
    assignees: initial.assignees ?? []
  }))

  /**
   * JSON-serializable snapshot of every form field — pushed into the
   * creation-flow store when the user jumps to a full-page create and
   * restored (below) when they come back. Assignee labels travel as an
   * entry array (a `Map` would not survive JSON).
   */
  type Draft = {
    title: string
    titleTouched: boolean
    description: string
    customerId: string
    customerLabel: string
    vehicleId: string
    vehicleLabel: string
    scheduledDate: string
    scheduledTime: string
    assigneeIds: string[]
    assigneeLabels: Array<[string, string]>
  }

  // Returning from a full-page create? Consume the pending return for
  // THIS page exactly once — its draft wins over `initial`.
  const pending = untrack(() => creationFlow.pendingReturnFor(currentUrl()))
  const draft = (pending?.draft ?? null) as Draft | null

  /**
   * Pure title composition from the picker labels: the vehicle label
   * is `plate · make model (· holder)`, the customer label is
   * `name (· city)` — recombined as "make model · plate · name" and
   * clamped to the 200-char column limit.
   */
  const composeFrom = (
    cId: string,
    cLabel: string,
    vId: string,
    vLabel: string
  ): string => {
    const vehicleParts = vLabel.split(' · ')
    const plate = vId && vehicleParts[0] !== '-' ? vehicleParts[0] : ''
    const makeModel =
      vId && vehicleParts[1] && vehicleParts[1] !== '-' ? vehicleParts[1] : ''
    const customerName = cId ? (cLabel.split(' · ')[0] ?? '') : ''
    return [makeModel, plate, customerName]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 200)
  }

  /**
   * Merge draft > initial, apply a pending creation-flow result to the
   * picker that started the flow and, with auto-title mode armed,
   * compose the initial title — all before the `$state` declarations
   * so mount never reads reactive state.
   */
  const seeded = (() => {
    const s = {
      title: draft?.title ?? init.title,
      // Auto-title mode is off once the user typed into the title
      // field (or an existing title was loaded in edit mode);
      // clearing the field completely re-arms it.
      titleTouched: draft?.titleTouched ?? init.title.trim() !== '',
      description: draft?.description ?? init.description,
      customerId: draft?.customerId ?? init.customerId,
      customerLabel: draft?.customerLabel ?? init.customerLabel,
      vehicleId: draft?.vehicleId ?? init.vehicleId,
      vehicleLabel: draft?.vehicleLabel ?? init.vehicleLabel,
      scheduledDate: draft?.scheduledDate ?? init.scheduledDate,
      scheduledTime: draft?.scheduledTime ?? init.scheduledTime,
      assigneeIds: draft?.assigneeIds ?? init.assignees.map((a) => a.id),
      assigneeLabels: new Map<string, string>(
        draft?.assigneeLabels ?? init.assignees.map((a) => [a.id, a.label])
      )
    }
    if (pending?.result) {
      const { id, label } = pending.result
      if (pending.originField === 'customerId') {
        s.customerId = id
        s.customerLabel = label
      } else if (pending.originField === 'vehicleId') {
        s.vehicleId = id
        s.vehicleLabel = label
        // The created vehicle determines its holder — re-sync the
        // customer when it differs (same rule as picking an existing
        // vehicle; a mismatched Kunde/Fahrzeug pair must not survive).
        const holder = pending.result.holder
        if (holder && holder.id !== s.customerId) {
          s.customerId = holder.id
          s.customerLabel = holder.label
        }
      } else if (pending.originField === 'assigneeIds') {
        if (!s.assigneeIds.includes(id)) s.assigneeIds = [...s.assigneeIds, id]
        s.assigneeLabels.set(id, label)
      }
    }
    if (!s.titleTouched) {
      s.title = composeFrom(
        s.customerId,
        s.customerLabel,
        s.vehicleId,
        s.vehicleLabel
      )
    }
    return s
  })()

  let title = $state(seeded.title)
  let titleTouched = $state(seeded.titleTouched)
  let description = $state(seeded.description)
  let customerId = $state(seeded.customerId)
  let customerLabel = $state(seeded.customerLabel)
  let vehicleId = $state(seeded.vehicleId)
  let vehicleLabel = $state(seeded.vehicleLabel)
  let scheduledDate = $state(seeded.scheduledDate)
  let scheduledTime = $state(seeded.scheduledTime)
  let assigneeIds = $state<string[]>(seeded.assigneeIds)
  let assigneeLabels = $state<Map<string, string> | Array<[string, string]>>(
    seeded.assigneeLabels
  )

  // A restored draft is unsaved user input — re-arm the leave guard.
  if (draft) untrack(() => formDirty.set(true))

  let errorMsg = $state<string | null>(null)

  const buildDraft = (): Draft => ({
    title,
    titleTouched,
    description,
    customerId,
    customerLabel,
    vehicleId,
    vehicleLabel,
    scheduledDate,
    scheduledTime,
    assigneeIds: [...assigneeIds],
    assigneeLabels: [
      ...(assigneeLabels instanceof Map
        ? assigneeLabels
        : new Map(assigneeLabels)
      ).entries()
    ]
  })

  // Cycle guard: no create for an entity type already being created
  // somewhere in the active chain.
  const canCreateCustomer = $derived(
    !creationFlow.activeEntities().has('customer')
  )
  const canCreateVehicle = $derived(
    !creationFlow.activeEntities().has('vehicle')
  )
  const canCreateEmployee = $derived(
    !creationFlow.activeEntities().has('employee')
  )

  const startCreate = (
    entity: 'customer' | 'vehicle' | 'employee',
    originField: string,
    target: string
  ) => {
    creationFlow.start({
      entity,
      returnUrl: currentUrl(),
      originField,
      draft: buildDraft(),
      createdAt: Date.now(),
      // A vehicle created from here belongs to the customer already
      // picked — the leaf preselects them as holder.
      ...(entity === 'vehicle' && customerId
        ? { leafInitial: { customerId, customerLabel } }
        : {})
    })
    // The draft carries the input — silence the unsaved-changes guard.
    formDirty.clear()
    goto(target)
  }

  /** Auto title from the CURRENT picker state. */
  const composeTitle = (): string =>
    composeFrom(customerId, customerLabel, vehicleId, vehicleLabel)

  const onTitleInput = (e: Event) => {
    // Typing arms manual mode; clearing the field completely re-arms
    // the auto composition (it refills on the next picker change, not
    // instantly — the user must be able to keep the field empty).
    titleTouched = (e.target as HTMLInputElement).value.trim() !== ''
  }

  /**
   * Validation handle for per-field error display — NOT for gating the
   * submit button (rule 1.1: always clickable except while busy).
   */
  const fv = useFormValidation(workOrderSchema, () => ({
    title,
    customerId,
    vehicleId
  }))

  const err = (k: string): string | null =>
    (fv.errors as Record<string, string | null>)[k] ?? null
  const wasTouched = (k: string): boolean =>
    (fv.touched as Record<string, boolean>)[k] === true

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())

  /** Picker change: field-touch bookkeeping + live title composition. */
  const onLinksChange = () => {
    fv.markTouched('customerId')
    fv.markTouched('vehicleId')
    if (!titleTouched) title = composeTitle()
    markDirty()
  }

  const searchEmployees = (params: { q: string; page: number; size: number }) =>
    pickEmployeesRemote({
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
    formDirty.clear()
    await onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      customerId: customerId || undefined,
      vehicleId: vehicleId || undefined,
      scheduledDate: scheduledDate || undefined,
      // A start time without a date is meaningless — drop it.
      scheduledTime: (scheduledDate && scheduledTime) || undefined,
      assigneeIds: [...assigneeIds]
    })
  }
</script>

<form
  onsubmit={submit}
  oninput={markDirty}
  onchange={markDirty}
  class="card border-base-300 bg-base-100 border"
  novalidate
>
  <div class="card-body gap-4">
    {#if errorMsg}
      <div class="alert alert-error">
        <span>{errorMsg}</span>
      </div>
    {/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Auftrag</legend>
      <div class="grid grid-cols-1 gap-3">
        <FormField
          label="Titel"
          required
          error={wasTouched('title') ? err('title') : null}
        >
          <input
            class={validationClasses(err('title'), wasTouched('title'))}
            maxlength="200"
            placeholder="Wird aus Kunde und Fahrzeug vorgeschlagen"
            bind:value={title}
            oninput={onTitleInput}
            onblur={() => fv.markTouched('title')}
          />
        </FormField>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Beschreibung</span>
          <textarea
            class="textarea textarea-bordered min-h-24 w-full"
            maxlength="10000"
            bind:value={description}
          ></textarea>
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Verknüpfungen</legend>
      <p class="text-base-content/60 text-sm">
        Mindestens ein Kunde oder ein Fahrzeug wird benötigt.
      </p>
      <div class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CustomerVehiclePicker
          bind:customerId
          bind:customerLabel
          bind:vehicleId
          bind:vehicleLabel
          customerError={wasTouched('customerId') && wasTouched('vehicleId')
            ? err('_form')
            : null}
          onChange={onLinksChange}
          onCreateCustomer={canCreateCustomer
            ? () => startCreate('customer', 'customerId', '/customers/new')
            : undefined}
          onCreateVehicle={canCreateVehicle
            ? () => startCreate('vehicle', 'vehicleId', '/vehicles/new')
            : undefined}
        />
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Geplant am</span>
          <input
            class="input input-bordered w-full"
            type="date"
            bind:value={scheduledDate}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Beginn (Uhrzeit)</span>
          <input
            class="input input-bordered w-full"
            type="time"
            bind:value={scheduledTime}
            disabled={!scheduledDate}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Zugewiesene Mitarbeiter</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MultiSearchablePicker
          bind:values={assigneeIds}
          bind:valueLabels={assigneeLabels}
          placeholder="Mitarbeiter auswählen"
          dialogTitle="Mitarbeiter zuweisen"
          search={searchEmployees}
          onChange={markDirty}
          createLabel={canCreateEmployee
            ? 'Neuen Mitarbeiter anlegen'
            : undefined}
          onCreateNew={canCreateEmployee
            ? () => startCreate('employee', 'assigneeIds', '/employees/new')
            : undefined}
        />
      </div>
    </fieldset>

    <div class="card-actions justify-end gap-2">
      {#if onCancel}
        <button
          type="button"
          class="btn btn-ghost"
          onclick={onCancel}
          disabled={busy.active}
        >
          Abbrechen
        </button>
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
