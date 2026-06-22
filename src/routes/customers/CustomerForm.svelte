<script lang="ts" module>
  import {
    check,
    maxLength,
    minLength,
    object,
    optional,
    pipe,
    string,
    trim,
    boolean,
    picklist
  } from 'valibot'

  /**
   * Client-side validation schema that mirrors the server-side
   * `customerInputSchema` (in `customers.remote.ts`) so the user sees
   * the exact same German rejection text the server would emit. The
   * one extra rule enforced here is the business rule "either Firma OR
   * Vor-/Nachname must be present for regular customers, or eBay-Name
   * for eBay customers" — that one would surface as a server-side 400
   * otherwise, but we want the Submit button disabled instead.
   */
  const ebaySchema = object({
    kind: picklist(['ebay']),
    ebayHandle: pipe(
      string('Bitte einen eBay-Namen eingeben.'),
      trim(),
      minLength(3, 'Bitte einen eBay-Namen mit 3 bis 100 Zeichen angeben.'),
      maxLength(100, 'Bitte einen eBay-Namen mit 3 bis 100 Zeichen angeben.')
    ),
    firstName: optional(
      pipe(
        string(),
        trim(),
        maxLength(100, 'Der Name darf maximal 100 Zeichen lang sein.')
      )
    ),
    wantsBroadcast: optional(boolean()),
    wantsTireReminders: optional(boolean())
  })

  const regularSchema = pipe(
    object({
      kind: picklist(['regular']),
      company: pipe(
        string(),
        trim(),
        maxLength(200, 'Die Firma darf maximal 200 Zeichen lang sein.')
      ),
      salutation: optional(pipe(string(), trim(), maxLength(30))),
      firstName: pipe(
        string(),
        trim(),
        maxLength(100, 'Der Vorname darf maximal 100 Zeichen lang sein.')
      ),
      lastName: pipe(
        string(),
        trim(),
        maxLength(100, 'Der Nachname darf maximal 100 Zeichen lang sein.')
      ),
      street: optional(
        pipe(
          string(),
          trim(),
          maxLength(200, 'Die Anschrift darf maximal 200 Zeichen lang sein.')
        )
      ),
      zip: optional(
        pipe(
          string(),
          trim(),
          maxLength(10, 'Die PLZ darf maximal 10 Zeichen lang sein.')
        )
      ),
      city: optional(
        pipe(
          string(),
          trim(),
          maxLength(150, 'Der Ort darf maximal 150 Zeichen lang sein.')
        )
      ),
      phone: optional(pipe(string(), trim(), maxLength(30))),
      mobile: optional(pipe(string(), trim(), maxLength(30))),
      email: pipe(
        string(),
        trim(),
        maxLength(254, 'Die E-Mail darf maximal 254 Zeichen lang sein.'),
        check(
          (v) => v.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
          'Bitte eine gültige E-Mail-Adresse eingeben.'
        )
      ),
      website: optional(
        pipe(
          string(),
          trim(),
          maxLength(2048, 'Die URL darf maximal 2048 Zeichen lang sein.')
        )
      ),
      notes: optional(
        pipe(
          string(),
          trim(),
          maxLength(2000, 'Die Notiz darf maximal 2000 Zeichen lang sein.')
        )
      ),
      wantsBroadcast: optional(boolean()),
      wantsTireReminders: optional(boolean())
    }),
    check(
      (v) =>
        Boolean(v.company.trim() || v.lastName.trim() || v.firstName.trim()),
      'Bitte mindestens Firma oder Nachname angeben.'
    )
  )

  export type CustomerFormValues = {
    kind: 'regular' | 'ebay'
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
    ebayHandle?: string
    wantsBroadcast?: boolean
    wantsTireReminders?: boolean
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte'
  import type { Customer, CustomerKind } from '$lib/server/db/schema'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import FormField from '$lib/components/ui/FormField.svelte'
  import {
    useFormValidation,
    validationClasses,
    selectValidationClasses,
    textareaValidationClasses
  } from '$lib/utils/form-validation.svelte'

  type Props = {
    initial?: Partial<Customer>
    onSave: (values: CustomerFormValues) => Promise<void> | void
    onCancel?: () => void
  }

  const { initial = {}, onSave, onCancel }: Props = $props()

  const init = untrack(() => ({ ...initial }))

  let kind = $state<CustomerKind>((init.kind as CustomerKind) ?? 'regular')
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
  let ebayHandle = $state(init.ebayHandle ?? '')
  let wantsBroadcast = $state(init.wantsBroadcast ?? false)
  let wantsTireReminders = $state(init.wantsTireReminders ?? false)

  let errorMsg = $state<string | null>(null)

  /**
   * Validation handle bound to the currently active kind. The Submit
   * button is gated by `fv.valid`; each field flips red as soon as it
   * has been touched AND is invalid.
   */
  const fv = useFormValidation(
    () => (kind === 'ebay' ? ebaySchema : regularSchema),
    () =>
      kind === 'ebay'
        ? {
            kind: 'ebay',
            ebayHandle,
            firstName,
            wantsBroadcast,
            wantsTireReminders
          }
        : {
            kind: 'regular',
            company,
            salutation,
            firstName,
            lastName,
            street,
            zip,
            city,
            phone,
            mobile,
            email,
            website,
            notes,
            wantsBroadcast,
            wantsTireReminders
          }
  )

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())

  const trimOrUndef = (v: string) => {
    const t = v.trim()
    return t === '' ? undefined : t
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    fv.markAllTouched()
    if (!fv.valid) {
      // Form-level (`_form`) error wins so the user sees the business
      // rule first; otherwise surface the first per-field issue.
      const errs = fv.errors as Record<string, string | null>
      const formError = errs._form
      if (formError) {
        errorMsg = formError
      } else {
        const firstError = Object.values(errs).find((v) => v != null)
        errorMsg =
          (firstError as string | null) ?? 'Bitte prüfen Sie Ihre Eingaben.'
      }
      return
    }
    errorMsg = null
    if (kind === 'ebay') {
      formDirty.clear()
      await onSave({
        kind: 'ebay',
        ebayHandle: ebayHandle.trim(),
        firstName: trimOrUndef(firstName),
        wantsBroadcast,
        wantsTireReminders
      })
      return
    }
    formDirty.clear()
    await onSave({
      kind: 'regular',
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
      notes: trimOrUndef(notes),
      wantsBroadcast,
      wantsTireReminders
    })
  }

  // Helper accessors — Svelte 5 doesn't allow function calls inline on
  // attributes that touch reactive state in some edge cases, so we wrap
  // the per-field lookup once.
  const err = (k: string): string | null =>
    (fv.errors as Record<string, string | null>)[k] ?? null
  const wasTouched = (k: string): boolean =>
    (fv.touched as Record<string, boolean>)[k] === true
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
      <legend class="fieldset-legend">Kundenart</legend>
      <div class="flex flex-wrap gap-4">
        <label class="label cursor-pointer gap-2">
          <input
            type="radio"
            class="radio radio-sm"
            name="customer-kind"
            value="regular"
            checked={kind === 'regular'}
            onchange={() => (kind = 'regular')}
          />
          <span class="label-text">Standardkunde</span>
        </label>
        <label class="label cursor-pointer gap-2">
          <input
            type="radio"
            class="radio radio-sm"
            name="customer-kind"
            value="ebay"
            checked={kind === 'ebay'}
            onchange={() => (kind = 'ebay')}
          />
          <span class="label-text">eBay-Kunde</span>
        </label>
      </div>
    </fieldset>

    {#if kind === 'ebay'}
      <fieldset class="fieldset">
        <legend class="fieldset-legend">eBay-Daten</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="eBay-Name"
            required
            error={wasTouched('ebayHandle') ? err('ebayHandle') : null}
          >
            <input
              class={validationClasses(
                err('ebayHandle'),
                wasTouched('ebayHandle')
              )}
              maxlength="100"
              bind:value={ebayHandle}
              onblur={() => fv.markTouched('ebayHandle')}
            />
          </FormField>
          <FormField label="Name (optional)">
            <input
              class="input input-bordered w-full"
              maxlength="100"
              bind:value={firstName}
            />
          </FormField>
          <label class="label cursor-pointer gap-2 sm:col-span-2">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              bind:checked={wantsBroadcast}
            />
            <span class="label-text">
              Möchte Rundschreiben / Newsletter erhalten
            </span>
          </label>
          <label class="label cursor-pointer gap-2 sm:col-span-2">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              bind:checked={wantsTireReminders}
            />
            <span class="label-text">
              Möchte Erinnerung zum Reifenwechsel erhalten
            </span>
          </label>
        </div>
      </fieldset>
    {:else}
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Person / Firma</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Firma" colSpan="sm:col-span-2">
            <input
              class={validationClasses(err('company'), wasTouched('company'))}
              maxlength="200"
              bind:value={company}
              onblur={() => fv.markTouched('company')}
            />
          </FormField>
          <FormField label="Anrede">
            <select
              class={selectValidationClasses(
                err('salutation'),
                wasTouched('salutation')
              )}
              bind:value={salutation}
              onblur={() => fv.markTouched('salutation')}
            >
              <option value="">—</option>
              <option>Herr</option>
              <option>Frau</option>
              <option>Familie</option>
            </select>
          </FormField>
          <div></div>
          <FormField label="Vorname">
            <input
              class={validationClasses(
                err('firstName'),
                wasTouched('firstName')
              )}
              maxlength="100"
              bind:value={firstName}
              onblur={() => fv.markTouched('firstName')}
            />
          </FormField>
          <FormField label="Nachname">
            <input
              class={validationClasses(err('lastName'), wasTouched('lastName'))}
              maxlength="100"
              bind:value={lastName}
              onblur={() => fv.markTouched('lastName')}
            />
          </FormField>
        </div>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">Anschrift</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField label="Straße + Hausnummer" colSpan="sm:col-span-3">
            <input
              class={validationClasses(err('street'), wasTouched('street'))}
              maxlength="200"
              bind:value={street}
              onblur={() => fv.markTouched('street')}
            />
          </FormField>
          <FormField label="PLZ">
            <input
              class={validationClasses(err('zip'), wasTouched('zip'))}
              maxlength="10"
              bind:value={zip}
              onblur={() => fv.markTouched('zip')}
            />
          </FormField>
          <FormField label="Ort" colSpan="sm:col-span-2">
            <input
              class={validationClasses(err('city'), wasTouched('city'))}
              maxlength="150"
              bind:value={city}
              onblur={() => fv.markTouched('city')}
            />
          </FormField>
        </div>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">Kontakt</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Telefon">
            <input
              class={validationClasses(err('phone'), wasTouched('phone'))}
              maxlength="30"
              bind:value={phone}
              onblur={() => fv.markTouched('phone')}
            />
          </FormField>
          <FormField label="Mobil">
            <input
              class={validationClasses(err('mobile'), wasTouched('mobile'))}
              maxlength="30"
              bind:value={mobile}
              onblur={() => fv.markTouched('mobile')}
            />
          </FormField>
          <FormField
            label="E-Mail"
            error={wasTouched('email') ? err('email') : null}
          >
            <input
              class={validationClasses(err('email'), wasTouched('email'))}
              type="email"
              maxlength="254"
              bind:value={email}
              onblur={() => fv.markTouched('email')}
            />
          </FormField>
          <FormField label="Website">
            <input
              class={validationClasses(err('website'), wasTouched('website'))}
              maxlength="2048"
              bind:value={website}
              onblur={() => fv.markTouched('website')}
            />
          </FormField>
          <label class="label cursor-pointer gap-2 sm:col-span-2">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              bind:checked={wantsBroadcast}
            />
            <span class="label-text">
              Möchte Rundschreiben / Newsletter erhalten
            </span>
          </label>
          <label class="label cursor-pointer gap-2 sm:col-span-2">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              bind:checked={wantsTireReminders}
            />
            <span class="label-text">
              Möchte Erinnerung zum Reifenwechsel erhalten
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">Notiz</legend>
        <textarea
          class={textareaValidationClasses(
            err('notes'),
            wasTouched('notes'),
            'textarea textarea-bordered min-h-24 w-full'
          )}
          maxlength="2000"
          bind:value={notes}
          onblur={() => fv.markTouched('notes')}
        ></textarea>
      </fieldset>
    {/if}

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
