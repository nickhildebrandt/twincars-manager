<script lang="ts">
  import type { Customer } from '$lib/server/db/schema'

  type Props = {
    initial?: Partial<Customer>
    onSave: (values: CustomerFormValues) => Promise<void> | void
    onCancel?: () => void
    busy?: boolean
  }

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

  const { initial = {}, onSave, onCancel, busy = false }: Props = $props()

  let company = $state(initial.company ?? '')
  let salutation = $state(initial.salutation ?? '')
  let firstName = $state(initial.firstName ?? '')
  let lastName = $state(initial.lastName ?? '')
  let street = $state(initial.street ?? '')
  let zip = $state(initial.zip ?? '')
  let city = $state(initial.city ?? '')
  let phone = $state(initial.phone ?? '')
  let mobile = $state(initial.mobile ?? '')
  let email = $state(initial.email ?? '')
  let website = $state(initial.website ?? '')
  let notes = $state(initial.notes ?? '')

  let errorMsg = $state<string | null>(null)

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

<form onsubmit={submit} class="card border-base-300 bg-base-100 border">
  <div class="card-body gap-4">
    {#if errorMsg}
      <div class="alert alert-error">
        <span>{errorMsg}</span>
      </div>
    {/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Person / Firma</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="form-control sm:col-span-2">
          <span class="label-text">Firma</span>
          <input
            class="input input-bordered"
            maxlength="200"
            bind:value={company}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Anrede</span>
          <select class="select select-bordered" bind:value={salutation}>
            <option value="">—</option>
            <option>Herr</option>
            <option>Frau</option>
            <option>Familie</option>
          </select>
        </label>
        <div></div>
        <label class="form-control">
          <span class="label-text">Vorname</span>
          <input
            class="input input-bordered"
            maxlength="100"
            bind:value={firstName}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Nachname</span>
          <input
            class="input input-bordered"
            maxlength="100"
            bind:value={lastName}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Anschrift</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label class="form-control sm:col-span-3">
          <span class="label-text">Straße + Hausnummer</span>
          <input
            class="input input-bordered"
            maxlength="200"
            bind:value={street}
          />
        </label>
        <label class="form-control">
          <span class="label-text">PLZ</span>
          <input class="input input-bordered" maxlength="10" bind:value={zip} />
        </label>
        <label class="form-control sm:col-span-2">
          <span class="label-text">Ort</span>
          <input
            class="input input-bordered"
            maxlength="150"
            bind:value={city}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Kontakt</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="form-control">
          <span class="label-text">Telefon</span>
          <input
            class="input input-bordered"
            maxlength="30"
            bind:value={phone}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Mobil</span>
          <input
            class="input input-bordered"
            maxlength="30"
            bind:value={mobile}
          />
        </label>
        <label class="form-control">
          <span class="label-text">E-Mail</span>
          <input
            class="input input-bordered"
            type="email"
            maxlength="254"
            bind:value={email}
          />
        </label>
        <label class="form-control">
          <span class="label-text">Website</span>
          <input
            class="input input-bordered"
            maxlength="2048"
            bind:value={website}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Notiz</legend>
      <textarea
        class="textarea textarea-bordered min-h-24"
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
          disabled={busy}
        >
          Abbrechen
        </button>
      {/if}
      <button type="submit" class="btn btn-primary" disabled={busy}>
        {#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
        Speichern
      </button>
    </div>
  </div>
</form>
