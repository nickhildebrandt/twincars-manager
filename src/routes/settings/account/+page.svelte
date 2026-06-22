<script lang="ts">
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import { changeOwnPasswordRemote } from './account.remote'
  import FormField from '$lib/components/ui/FormField.svelte'
  import {
    useFormValidation,
    validationClasses
  } from '$lib/utils/form-validation.svelte'
  import { check, maxLength, minLength, object, pipe, string } from 'valibot'

  let currentPassword = $state('')
  let newPassword = $state('')
  let newPasswordConfirm = $state('')
  let errorMsg = $state<string | null>(null)

  const passwordSchema = pipe(
    object({
      currentPassword: pipe(
        string(),
        minLength(1, 'Bitte aktuelles Passwort eingeben.')
      ),
      newPassword: pipe(
        string(),
        minLength(8, 'Neues Passwort zu kurz (mind. 8 Zeichen).'),
        maxLength(128, 'Neues Passwort zu lang.')
      ),
      newPasswordConfirm: pipe(string(), minLength(1, 'Pflichtfeld.'))
    }),
    check(
      (v) => v.newPassword === v.newPasswordConfirm,
      'Die neuen Passwörter stimmen nicht überein.'
    ),
    check(
      (v) => v.newPassword !== v.currentPassword,
      'Das neue Passwort muss sich vom aktuellen unterscheiden.'
    )
  )

  const fv = useFormValidation(passwordSchema, () => ({
    currentPassword,
    newPassword,
    newPasswordConfirm
  }))
  const err = (k: string): string | null =>
    (fv.errors as Record<string, string | null>)[k] ?? null
  const wasTouched = (k: string): boolean =>
    (fv.touched as Record<string, boolean>)[k] === true

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())

  const submit = async (e: Event) => {
    e.preventDefault()
    fv.markAllTouched()
    if (!fv.valid) {
      const errs = fv.errors as Record<string, string | null>
      errorMsg =
        errs._form ??
        (Object.values(errs).find((v) => v != null) as string | null) ??
        null
      return
    }
    errorMsg = null
    try {
      formDirty.clear()
      await busy.run(() =>
        changeOwnPasswordRemote({
          currentPassword,
          newPassword,
          newPasswordConfirm
        })
      )
      toast.success('Passwort aktualisiert.')
      currentPassword = ''
      newPassword = ''
      newPasswordConfirm = ''
      fv.resetTouched()
    } catch (err) {
      handleClientError(err, 'Passwort konnte nicht geändert werden')
    }
  }
</script>

<PageHeader title="Profil" />

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
      <legend class="fieldset-legend">Passwort ändern</legend>
      <p class="text-base-content/60 text-sm">
        Bitte geben Sie zuerst Ihr aktuelles Passwort zur Bestätigung ein und
        anschließend zweimal das neue Passwort.
      </p>
      <div class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          label="Aktuelles Passwort"
          required
          colSpan="sm:col-span-2"
          error={wasTouched('currentPassword') ? err('currentPassword') : null}
        >
          <input
            class={validationClasses(
              err('currentPassword'),
              wasTouched('currentPassword')
            )}
            type="password"
            maxlength="256"
            required
            autocomplete="current-password"
            bind:value={currentPassword}
            onblur={() => fv.markTouched('currentPassword')}
          />
        </FormField>
        <FormField
          label="Neues Passwort"
          required
          error={wasTouched('newPassword') ? err('newPassword') : null}
        >
          <input
            class={validationClasses(
              err('newPassword'),
              wasTouched('newPassword')
            )}
            type="password"
            minlength="8"
            maxlength="128"
            required
            autocomplete="new-password"
            bind:value={newPassword}
            onblur={() => fv.markTouched('newPassword')}
          />
        </FormField>
        <FormField
          label="Neues Passwort bestätigen"
          required
          error={wasTouched('newPasswordConfirm')
            ? (err('newPasswordConfirm') ?? err('_form'))
            : null}
        >
          <input
            class={validationClasses(
              err('newPasswordConfirm') ?? err('_form'),
              wasTouched('newPasswordConfirm')
            )}
            type="password"
            minlength="8"
            maxlength="128"
            required
            autocomplete="new-password"
            bind:value={newPasswordConfirm}
            onblur={() => fv.markTouched('newPasswordConfirm')}
          />
        </FormField>
      </div>
    </fieldset>

    <div class="card-actions justify-end gap-2">
      <button
        type="submit"
        class="btn btn-primary"
        disabled={busy.active || !fv.valid}
      >
        {#if busy.active}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Passwort ändern
      </button>
    </div>
  </div>
</form>
