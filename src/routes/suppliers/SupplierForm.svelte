<script lang="ts">
  import { untrack } from 'svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  type Supplier = {
    name?: string | null
    contactPerson?: string | null
    street?: string | null
    zip?: string | null
    city?: string | null
    country?: string | null
    phone?: string | null
    fax?: string | null
    email?: string | null
    website?: string | null
    bankName?: string | null
    iban?: string | null
    bic?: string | null
    notes?: string | null
    customerNumberAtSupplier?: string | null
  }

  type Props = {
    initial?: Supplier
    onSave: (values: SupplierFormValues) => Promise<void> | void
    onCancel?: () => void
  }

  export type SupplierFormValues = {
    name: string
    contactPerson?: string
    street?: string
    zip?: string
    city?: string
    country?: string
    phone?: string
    fax?: string
    email?: string
    website?: string
    bankName?: string
    iban?: string
    bic?: string
    notes?: string
    customerNumberAtSupplier?: string
  }

  const { initial = {}, onSave, onCancel }: Props = $props()

  /** Snapshot the initial prop once at mount — see CustomerForm for rationale. */
  const init = untrack(() => ({ ...initial }))

  let name = $state(init.name ?? '')
  let contactPerson = $state(init.contactPerson ?? '')
  let street = $state(init.street ?? '')
  let zip = $state(init.zip ?? '')
  let city = $state(init.city ?? '')
  let country = $state(init.country ?? 'Deutschland')
  let phone = $state(init.phone ?? '')
  let fax = $state(init.fax ?? '')
  let email = $state(init.email ?? '')
  let website = $state(init.website ?? '')
  let bankName = $state(init.bankName ?? '')
  let iban = $state(init.iban ?? '')
  let bic = $state(init.bic ?? '')
  let notes = $state(init.notes ?? '')
  let customerNumberAtSupplier = $state(init.customerNumberAtSupplier ?? '')

  let errorMsg = $state<string | null>(null)

  const emailInvalid = $derived(
    Boolean(email.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )

  /** Validity gate for the Submit button — mirrors the rules in `submit`. */
  const valid = $derived.by(() => {
    if (!name.trim()) return false
    if (emailInvalid) return false
    return true
  })

  const u = (v: string) => {
    const t = v.trim()
    return t === '' ? undefined : t
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null
    if (!name.trim()) {
      errorMsg = 'Bitte einen Firmennamen eingeben.'
      return
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errorMsg = 'Bitte eine gültige E-Mail-Adresse eingeben.'
      return
    }
    formDirty.clear()
    await onSave({
      name: name.trim(),
      contactPerson: u(contactPerson),
      street: u(street),
      zip: u(zip),
      city: u(city),
      country: u(country),
      phone: u(phone),
      fax: u(fax),
      email: u(email),
      website: u(website),
      bankName: u(bankName),
      iban: u(iban),
      bic: u(bic),
      notes: u(notes),
      customerNumberAtSupplier: u(customerNumberAtSupplier)
    })
  }

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())
</script>

<form
  onsubmit={submit}
  oninput={markDirty}
  onchange={markDirty}
  class="card border-base-300 bg-base-100 border"
>
  <div class="card-body gap-4">
    {#if errorMsg}<div class="alert alert-error"><span>{errorMsg}</span></div
      >{/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Firma</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex w-full flex-col gap-1 sm:col-span-2">
          <span class="label-text">Firmenname *</span>
          <input
            class="input input-bordered w-full"
            maxlength="200"
            bind:value={name}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Kontaktperson</span>
          <input
            class="input input-bordered w-full"
            maxlength="100"
            bind:value={contactPerson}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Kundennummer beim Lieferanten</span>
          <input
            class="input input-bordered w-full"
            maxlength="50"
            bind:value={customerNumberAtSupplier}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Anschrift</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="flex w-full flex-col gap-1 sm:col-span-3">
          <span class="label-text">Straße + Hausnummer</span>
          <input
            class="input input-bordered w-full"
            maxlength="200"
            bind:value={street}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">PLZ</span>
          <input
            class="input input-bordered w-full"
            maxlength="10"
            bind:value={zip}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Ort</span>
          <input
            class="input input-bordered w-full"
            maxlength="150"
            bind:value={city}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Land</span>
          <input
            class="input input-bordered w-full"
            maxlength="100"
            bind:value={country}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Kontakt</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Telefon</span>
          <input
            class="input input-bordered w-full"
            maxlength="30"
            bind:value={phone}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Fax</span>
          <input
            class="input input-bordered w-full"
            maxlength="30"
            bind:value={fax}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">E-Mail</span>
          <input
            class="input input-bordered w-full {emailInvalid
              ? 'input-error'
              : ''}"
            type="email"
            maxlength="254"
            bind:value={email}
          />
          {#if emailInvalid}
            <span class="text-error text-sm"
              >Bitte eine gültige E-Mail-Adresse eingeben.</span
            >
          {/if}
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Website</span>
          <input
            class="input input-bordered w-full"
            maxlength="2048"
            bind:value={website}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Bankdaten</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="flex w-full flex-col gap-1 sm:col-span-3">
          <span class="label-text">Bankname</span>
          <input
            class="input input-bordered w-full"
            maxlength="100"
            bind:value={bankName}
          />
        </label>
        <label class="flex w-full flex-col gap-1 sm:col-span-2">
          <span class="label-text">IBAN</span>
          <input
            class="input input-bordered w-full"
            maxlength="34"
            bind:value={iban}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">BIC</span>
          <input
            class="input input-bordered w-full"
            maxlength="11"
            bind:value={bic}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Notiz</legend>
      <textarea
        class="textarea textarea-bordered min-h-24 w-full"
        maxlength="2000"
        bind:value={notes}
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
  </div>
</form>
