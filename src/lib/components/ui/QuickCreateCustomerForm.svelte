<script lang="ts" module>
  import { check, object, pipe, string } from 'valibot'

  /**
   * Client-side quick-create rule: at least one of company / last name
   * must be present (root-level check, surfaces as `_form`).
   */
  const quickCustomerSchema = pipe(
    object({
      lastName: string(),
      firstName: string(),
      company: string(),
      phone: string()
    }),
    check(
      (v) => Boolean(v.company.trim() || v.lastName.trim()),
      'Bitte mindestens Firma oder Nachname angeben.'
    )
  )
</script>

<script lang="ts">
  /**
   * Compact inline customer creation for the SearchablePicker create
   * mode: the minimal fields to identify a walk-in customer. The full
   * customer form stays at /customers/new — this quick path exists so
   * a picker never forces the user to leave the current form.
   */
  import { untrack } from 'svelte'
  import FormField from './FormField.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'
  import { handleClientError } from '$lib/utils/client-error'
  import { useFormValidation } from '$lib/utils/form-validation.svelte'
  import { customerPickerLabel } from '$lib/utils/picker-labels'

  type Props = {
    /** Search text the user had typed — prefills the last name. */
    initialQuery?: string
    /** Called with the picker item after a successful create. */
    onCreated: (item: { id: string; label: string }) => void
    /** Returns to the picker's search mode without creating. */
    onCancel: () => void
  }

  const { initialQuery = '', onCreated, onCancel }: Props = $props()

  // Snapshot: the prefill is deliberately taken once at mount.
  let lastName = $state(untrack(() => initialQuery))
  let firstName = $state('')
  let company = $state('')
  let phone = $state('')

  const fv = useFormValidation(quickCustomerSchema, () => ({
    lastName,
    firstName,
    company,
    phone
  }))

  const rootError = $derived(
    (fv.errors as Record<string, string | null>)._form ?? null
  )
  const anyTouched = $derived(Object.values(fv.touched).some(Boolean))

  const trimOrUndef = (v: string) => {
    const t = v.trim()
    return t === '' ? undefined : t
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    fv.markAllTouched()
    if (!fv.valid) return
    try {
      const row = await busy.run(async () => {
        // Deliberately a dynamic import: every picker embeds this form,
        // and a static import would drag the customers remote module
        // into every consumer's graph (and force every component test
        // to mock it) even when the create flow is never used.
        const { createCustomerRemote } =
          await import('../../../routes/customers/customers.remote')
        return createCustomerRemote({
          lastName: trimOrUndef(lastName),
          firstName: trimOrUndef(firstName),
          company: trimOrUndef(company),
          phone: trimOrUndef(phone)
        })
      })
      toast.success('Kunde angelegt.')
      onCreated({ id: row.id, label: customerPickerLabel(row) })
    } catch (err) {
      handleClientError(err, 'Kunde konnte nicht angelegt werden')
    }
  }
</script>

<form class="flex flex-col gap-3 p-4" onsubmit={submit}>
  {#if rootError && anyTouched}
    <div class="alert alert-error"><span>{rootError}</span></div>
  {/if}

  <FormField label="Nachname">
    <input
      class="input input-bordered w-full"
      maxlength="100"
      bind:value={lastName}
      onblur={() => fv.markTouched('lastName')}
    />
  </FormField>
  <FormField label="Vorname">
    <input
      class="input input-bordered w-full"
      maxlength="100"
      bind:value={firstName}
      onblur={() => fv.markTouched('firstName')}
    />
  </FormField>
  <FormField label="Firma">
    <input
      class="input input-bordered w-full"
      maxlength="200"
      bind:value={company}
      onblur={() => fv.markTouched('company')}
    />
  </FormField>
  <FormField label="Telefon">
    <input
      class="input input-bordered w-full"
      maxlength="30"
      bind:value={phone}
      onblur={() => fv.markTouched('phone')}
    />
  </FormField>

  <div class="flex justify-end gap-2">
    <button
      type="button"
      class="btn btn-ghost"
      onclick={onCancel}
      disabled={busy.active}
    >
      Abbrechen
    </button>
    <button
      type="submit"
      class="btn btn-primary"
      disabled={busy.active || !fv.valid}
    >
      {#if busy.active}
        <span class="loading loading-spinner loading-sm"></span>
      {/if}
      Kunde anlegen
    </button>
  </div>
</form>
