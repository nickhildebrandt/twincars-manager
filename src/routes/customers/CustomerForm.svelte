<script lang="ts">
  import { untrack } from 'svelte'
  import type { Customer } from '$lib/server/db/schema'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  /**
   * Props for the customer form. `initial` is read once at mount time to seed
   * the editable state — subsequent prop changes do not reset the form.
   * The submit/cancel buttons read the global busy store directly so a
   * pending mutation always disables them, even before the 250 ms overlay
   * appears.
   */
  type Props = {
    initial?: Partial<Customer>
    onSave: (values: CustomerFormValues) => Promise<void> | void
    onCancel?: () => void
  }

  /**
   * Output of the customer form, ready to be sent to a remote create/update
   * command. Empty strings are normalized to `undefined`.
   */
  export type CustomerFormValues = {
    company?: string
    salutation?: string
    firstName?: string
    lastName?: string
    street?: string
    zip?: string
    city?: string
    phone?: string
    mobile?: string
    email?: string
    website?: string
    notes?: string
  }

  const { initial = {}, onSave, onCancel }: Props = $props()

  /**
   * Read `initial` exactly once at component setup. `untrack` is the
   * documented Svelte 5 way to opt out of reactivity here — we deliberately
   * want the form to seed from the initial prop value, then become editable
   * state owned by this component.
   */
  const init = untrack(() => ({ ...initial }))

  let company = $state(init.company ?? '')
  let salutation = $state(init.salutation ?? '')
  let firstName = $state(init.firstName ?? '')
  let lastName = $state(init.lastName ?? '')
  let street = $state(init.street ?? '')
  let zip = $state(init.zip ?? '')
  let city = $state(init.city ?? '')
  let phone = $state(init.phone ?? '')
  let mobile = $state(init.mobile ?? '')
  let email = $state(init.email ?? '')
  let website = $state(init.website ?? '')
  let notes = $state(init.notes ?? '')

  let errorMsg = $state<string | null>(null)

  /**
   * Markiert das Formular als geändert, sobald der Benutzer
   * irgendeinen Wert anfasst. `oninput` deckt Text-Inputs +
   * Textareas ab, `onchange` deckt `<select>`, Checkbox und Radio
   * ab; beide Events bubblen aus den Kindern bis zum `<form>`-Root.
   * AppShell hookt dann `beforeNavigate` + `beforeunload` und
   * bestätigt den Wegklick via `confirm`.
   */
  const markDirty = () => formDirty.set(true)

  /** Auf Unmount Dirty zurücksetzen, damit andere Forms sauber starten. */
  $effect(() => () => formDirty.clear())

  const trimOrUndef = (v: string) => {
    const t = v.trim()
    return t === '' ? undefined : t
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null
    const hasName = company.trim() || lastName.trim() || firstName.trim()
    if (!hasName) {
      errorMsg = 'Bitte mindestens Firma oder Nachname angeben.'
      return
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errorMsg = 'Bitte eine gültige E-Mail-Adresse eingeben.'
      return
    }
    formDirty.clear()
    await onSave({
      company: trimOrUndef(company),
      salutation: trimOrUndef(salutation),
      firstName: trimOrUndef(firstName),
      lastName: trimOrUndef(lastName),
      street: trimOrUndef(street),
      zip: trimOrUndef(zip),
      city: trimOrUndef(city),
      phone: trimOrUndef(phone),
      mobile: trimOrUndef(mobile),
      email: trimOrUndef(email),
      website: trimOrUndef(website),
      notes: trimOrUndef(notes)
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
      <legend class="fieldset-legend">Person / Firma</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex w-full flex-col gap-1 sm:col-span-2">
          <span class="label-text">Firma</span>
          <input
            class="input input-bordered w-full"
            maxlength="200"
            bind:value={company}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Anrede</span>
          <select class="select select-bordered w-full" bind:value={salutation}>
            <option value="">—</option>
            <option>Herr</option>
            <option>Frau</option>
            <option>Familie</option>
          </select>
        </label>
        <div></div>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Vorname</span>
          <input
            class="input input-bordered w-full"
            maxlength="100"
            bind:value={firstName}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Nachname</span>
          <input
            class="input input-bordered w-full"
            maxlength="100"
            bind:value={lastName}
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
        <label class="flex w-full flex-col gap-1 sm:col-span-2">
          <span class="label-text">Ort</span>
          <input
            class="input input-bordered w-full"
            maxlength="150"
            bind:value={city}
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
          <span class="label-text">Mobil</span>
          <input
            class="input input-bordered w-full"
            maxlength="30"
            bind:value={mobile}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">E-Mail</span>
          <input
            class="input input-bordered w-full"
            type="email"
            maxlength="254"
            bind:value={email}
          />
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
