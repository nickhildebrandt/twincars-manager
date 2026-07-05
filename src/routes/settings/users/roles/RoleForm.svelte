<script lang="ts" module>
  import { minLength, object, pipe, string, trim } from 'valibot'

  /**
   * Client-side schema mirroring the rule previously enforced ad hoc
   * in `submit`: the role name needs at least 2 characters.
   */
  const roleSchema = object({
    name: pipe(
      string(),
      trim(),
      minLength(2, 'Bitte einen Rollennamen mit mindestens 2 Zeichen angeben.')
    )
  })
</script>

<script lang="ts">
  import { untrack } from 'svelte'
  import { Trash2 } from '@lucide/svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import FormField from '$lib/components/ui/FormField.svelte'
  import {
    useFormValidation,
    validationClasses
  } from '$lib/utils/form-validation.svelte'
  import {
    MODULE_PERMISSIONS,
    WILDCARD_PERMISSION,
    type ModuleKey
  } from '$lib/permissions'

  /**
   * Shared role editor. Renders the same permission matrix for both
   * create and edit flows; the parent passes `initial` (seed values)
   * and an `onSave` callback receiving the normalized payload. The
   * "Administrator" role is rendered read-only when `locked` is true —
   * the server refuses changes to it anyway, the UI just mirrors that.
   */
  type Props = {
    initial?: {
      name?: string
      description?: string | null
      permissions?: string[]
    }
    locked?: boolean
    onSave: (values: RoleFormValues) => Promise<void> | void
    onCancel?: () => void
    onDelete?: () => void
  }

  export type RoleFormValues = {
    name: string
    description?: string
    permissions: string[]
  }

  const {
    initial = {},
    locked = false,
    onSave,
    onCancel,
    onDelete
  }: Props = $props()

  const init = untrack(() => ({
    name: initial.name ?? '',
    description: initial.description ?? '',
    permissions: initial.permissions ?? []
  }))

  let name = $state(init.name)
  let description = $state(init.description ?? '')
  let wildcard = $state(init.permissions.includes(WILDCARD_PERMISSION))
  /** Selected permissions as a reactive Set; checkbox bindings toggle entries. */
  let selected = $state<Set<string>>(
    new Set(init.permissions.filter((p) => p !== WILDCARD_PERMISSION))
  )

  let errorMsg = $state<string | null>(null)

  /**
   * Validation handle for the Submit button gate and the per-field
   * error display. The name error only surfaces once the field was
   * touched (blur) or a submit was attempted.
   */
  const fv = useFormValidation(roleSchema, () => ({ name }))

  const err = (k: string): string | null =>
    (fv.errors as Record<string, string | null>)[k] ?? null
  const wasTouched = (k: string): boolean =>
    (fv.touched as Record<string, boolean>)[k] === true

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())

  /** Module keys in declaration order; the matrix renders one section each. */
  const moduleKeys = Object.keys(MODULE_PERMISSIONS) as ModuleKey[]

  const moduleLabels: Record<ModuleKey, string> = {
    customers: 'Kunden',
    vehicles: 'Fahrzeuge',
    suppliers: 'Lieferanten',
    employees: 'Mitarbeiter',
    items: 'Leistungen / Artikel',
    offers: 'Angebote',
    invoices: 'Rechnungen',
    reminders: 'Mahnwesen',
    ledger: 'Kassenbuch',
    calendar: 'Kalender',
    inventory: 'Lager',
    hours: 'Stunden',
    mailings: 'Serienbriefe',
    import: 'Import',
    settings: 'Einstellungen',
    users: 'Benutzer & Rollen',
    tires: 'Reifenlager',
    shipping: 'Versand',
    posts: 'Aktuelle Informationen'
  }

  /**
   * Label for a single permission checkbox. In the per-module model every
   * module is a single "Zugriff" grant; the only exception is `hours`,
   * which offers a full grant plus a self-service ("nur eigene") grant.
   */
  const permissionLabel = (perm: string): string => {
    switch (perm) {
      case 'hours':
        return 'Alle Stunden'
      case 'hours:write_own':
        return 'Nur eigene Stunden'
      default:
        return 'Zugriff'
    }
  }

  const togglePerm = (perm: string, checked: boolean) => {
    const next = new Set(selected)
    if (checked) next.add(perm)
    else next.delete(perm)
    selected = next
    markDirty()
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    if (locked) return
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
    const trimmedName = name.trim()
    const permissions = wildcard ? [WILDCARD_PERMISSION] : Array.from(selected)
    const trimmedDesc = description.trim()
    await onSave({
      name: trimmedName,
      description: trimmedDesc === '' ? undefined : trimmedDesc,
      permissions
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

    {#if locked}
      <div class="alert alert-info">
        <span>
          Die Administrator-Rolle ist systemgeschützt - Name und Berechtigungen
          können nicht geändert werden.
        </span>
      </div>
    {/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Stammdaten</legend>
      <div class="grid grid-cols-1 gap-3">
        <FormField
          label="Name"
          required
          error={wasTouched('name') ? err('name') : null}
        >
          <input
            class={validationClasses(err('name'), wasTouched('name'))}
            maxlength="200"
            disabled={locked}
            bind:value={name}
            onblur={() => fv.markTouched('name')}
          />
        </FormField>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Beschreibung</span>
          <textarea
            class="textarea textarea-bordered min-h-20 w-full"
            maxlength="500"
            disabled={locked}
            bind:value={description}
          ></textarea>
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Berechtigungen</legend>

      <label class="label cursor-pointer justify-start gap-3">
        <input
          type="checkbox"
          class="checkbox checkbox-sm"
          checked={wildcard}
          disabled={locked}
          onchange={(e) => {
            wildcard = (e.target as HTMLInputElement).checked
            markDirty()
          }}
        />
        <span class="flex flex-col">
          <span class="font-medium">Voller Zugriff (*)</span>
          <span class="text-base-content/60 text-xs">
            Gewährt alle Berechtigungen inklusive zukünftiger Module.
          </span>
        </span>
      </label>

      <div
        class="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2"
        class:opacity-50={wildcard}
      >
        {#each moduleKeys as mod (mod)}
          <div
            class="border-base-300 rounded-box flex flex-col gap-2 border p-3"
          >
            <div class="text-sm font-semibold">{moduleLabels[mod]}</div>
            <div class="flex flex-col gap-1">
              {#each MODULE_PERMISSIONS[mod] as perm (perm)}
                <label class="label cursor-pointer justify-start gap-3 py-1">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    checked={selected.has(perm)}
                    disabled={locked || wildcard}
                    onchange={(e) =>
                      togglePerm(perm, (e.target as HTMLInputElement).checked)}
                  />
                  <span class="flex flex-col">
                    <span class="text-sm">{permissionLabel(perm)}</span>
                    <span class="text-base-content/60 font-mono text-xs">
                      {perm}
                    </span>
                  </span>
                </label>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </fieldset>

    <div class="card-actions justify-between gap-2">
      {#if onDelete}
        <button
          type="button"
          class="btn btn-error btn-outline gap-2"
          onclick={onDelete}
          disabled={busy.active || locked}
        >
          <Trash2 size={16} /> Löschen
        </button>
      {:else}
        <span></span>
      {/if}
      <div class="flex gap-2">
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
          disabled={busy.active || locked || !fv.valid}
        >
          {#if busy.active}
            <span class="loading loading-spinner loading-sm"></span>
          {/if}
          Speichern
        </button>
      </div>
    </div>
  </div>
</form>
