<script lang="ts" module>
  import { maxLength, minLength, object, pipe, string, trim } from 'valibot'

  /**
   * Client-side schema mirroring the server-side `workOrderInputSchema`
   * (in `orders.remote.ts`) so the user sees the same German wording
   * the server would emit. Only the title is required.
   */
  const workOrderSchema = object({
    title: pipe(
      string('Bitte einen Titel eingeben.'),
      trim(),
      minLength(1, 'Der Titel darf nicht leer sein.'),
      maxLength(200, 'Der Titel darf maximal 200 Zeichen lang sein.')
    )
  })

  export type WorkOrderFormValues = {
    title: string
    description?: string
    customerId?: string
    vehicleId?: string
    /** `datetime-local` string, empty = not scheduled. */
    scheduledAt?: string
    assigneeIds: string[]
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import FormField from '$lib/components/ui/FormField.svelte'
  import CustomerVehiclePicker from '$lib/components/ui/CustomerVehiclePicker.svelte'
  import {
    useFormValidation,
    validationClasses
  } from '$lib/utils/form-validation.svelte'

  /**
   * Shared work-order editor used by `/orders/new` and
   * `/orders/[id]/edit`. The parent loads the employee list once (via
   * `pickEmployeesRemote`, first page, size 100 — a small shop) and
   * passes it in; assignees are toggled through a checkbox list like
   * the RoleForm permission matrix.
   */
  type Props = {
    initial?: {
      title?: string
      description?: string | null
      customerId?: string | null
      customerLabel?: string | null
      vehicleId?: string | null
      vehicleLabel?: string | null
      scheduledAt?: Date | string | null
      assigneeIds?: string[]
    }
    /** Selectable employees (id + display label). */
    employees: Array<{ id: string; label: string }>
    onSave: (values: WorkOrderFormValues) => Promise<void> | void
    onCancel?: () => void
  }

  const { initial = {}, employees, onSave, onCancel }: Props = $props()

  const fmtLocalIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  const init = untrack(() => ({
    title: initial.title ?? '',
    description: initial.description ?? '',
    customerId: initial.customerId ?? '',
    customerLabel: initial.customerLabel ?? '',
    vehicleId: initial.vehicleId ?? '',
    vehicleLabel: initial.vehicleLabel ?? '',
    scheduledAt: initial.scheduledAt
      ? fmtLocalIso(new Date(initial.scheduledAt))
      : '',
    assigneeIds: initial.assigneeIds ?? []
  }))

  let title = $state(init.title)
  let description = $state(init.description)
  let customerId = $state(init.customerId)
  let customerLabel = $state(init.customerLabel)
  let vehicleId = $state(init.vehicleId)
  let vehicleLabel = $state(init.vehicleLabel)
  let scheduledAt = $state(init.scheduledAt)
  /** Selected assignees as a reactive Set; checkboxes toggle entries. */
  let selected = $state<Set<string>>(new Set(init.assigneeIds))

  let errorMsg = $state<string | null>(null)

  const fv = useFormValidation(workOrderSchema, () => ({ title }))

  const err = (k: string): string | null =>
    (fv.errors as Record<string, string | null>)[k] ?? null
  const wasTouched = (k: string): boolean =>
    (fv.touched as Record<string, boolean>)[k] === true

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())

  const toggleAssignee = (employeeId: string, checked: boolean) => {
    const next = new Set(selected)
    if (checked) next.add(employeeId)
    else next.delete(employeeId)
    selected = next
    markDirty()
  }

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
      scheduledAt: scheduledAt || undefined,
      assigneeIds: Array.from(selected)
    })
  }
</script>

<form
  onsubmit={submit}
  oninput={markDirty}
  onchange={markDirty}
  class="card border-base-300 bg-base-100 border"
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
            bind:value={title}
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
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CustomerVehiclePicker
          bind:customerId
          bind:customerLabel
          bind:vehicleId
          bind:vehicleLabel
          onChange={markDirty}
        />
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Geplant am</span>
          <input
            class="input input-bordered w-full"
            type="datetime-local"
            bind:value={scheduledAt}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Zugewiesene Mitarbeiter</legend>
      {#if employees.length === 0}
        <p class="text-base-content/60 text-sm">
          Keine Mitarbeiter angelegt. Mitarbeiter können unter "Personal"
          angelegt werden.
        </p>
      {:else}
        <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {#each employees as employee (employee.id)}
            <label class="label cursor-pointer justify-start gap-3 py-1">
              <input
                type="checkbox"
                class="checkbox checkbox-sm"
                checked={selected.has(employee.id)}
                onchange={(e) =>
                  toggleAssignee(
                    employee.id,
                    (e.target as HTMLInputElement).checked
                  )}
              />
              <span class="text-sm">{employee.label}</span>
            </label>
          {/each}
        </div>
      {/if}
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
      <button
        type="submit"
        class="btn btn-primary"
        disabled={busy.active || !fv.valid}
      >
        {#if busy.active}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Speichern
      </button>
    </div>
  </div>
</form>
