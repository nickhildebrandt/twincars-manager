<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import MultiSelect from '$lib/components/ui/MultiSelect.svelte'
  import { Trash2 } from '@lucide/svelte'
  import {
    deleteUserRemote,
    getUserRemote,
    listRolesRemote,
    listUsersRemote,
    updateUserRemote
  } from '../../users.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  const id = untrack(() => page.params.id!)

  /** SSR-friendly parallel load of the user record + available roles. */
  const [user, roles] = await Promise.all([
    getUserRemote({ id }),
    listRolesRemote()
  ])

  const init = untrack(() => ({ name: user.name, roleIds: [...user.roleIds] }))

  let name = $state(init.name)
  let roleIds = $state<string[]>(init.roleIds)

  // Password reset is a separate sub-form with its own submit handler
  // so an admin can update the user's name/roles without forcing them
  // to re-type a password (which would otherwise overwrite the stored
  // hash on every save).
  let resetPassword = $state('')
  let resetPasswordConfirm = $state('')
  let resetError = $state<string | null>(null)

  let errorMsg = $state<string | null>(null)
  let confirmOpen = $state(false)

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())

  /**
   * Map roles → MultiSelect option shape. The role description (if
   * present) becomes the option's sublabel.
   */
  const roleOptions = $derived(
    roles.map((r) => ({
      id: r.id,
      label: r.name,
      sublabel: r.description ?? undefined
    }))
  )

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null
    const trimmedName = name.trim()
    if (!trimmedName) {
      errorMsg = 'Bitte einen Anzeigenamen angeben.'
      return
    }
    try {
      formDirty.clear()
      await busy.run(() => updateUserRemote({ id, name: trimmedName, roleIds }))
      toast.success('Benutzer gespeichert.')
      goto('/settings/users')
    } catch (err) {
      handleClientError(err, 'Benutzer konnte nicht gespeichert werden')
    }
  }

  const submitPasswordReset = async (e: Event) => {
    e.preventDefault()
    resetError = null
    if (resetPassword.length < 8) {
      resetError = 'Passwort zu kurz (mind. 8 Zeichen).'
      return
    }
    if (resetPassword !== resetPasswordConfirm) {
      resetError = 'Passwörter stimmen nicht überein.'
      return
    }
    try {
      await busy.run(() => updateUserRemote({ id, password: resetPassword }))
      toast.success('Passwort zurückgesetzt.')
      resetPassword = ''
      resetPasswordConfirm = ''
    } catch (err) {
      handleClientError(err, 'Passwort konnte nicht zurückgesetzt werden')
    }
  }

  const performDelete = async () => {
    try {
      await busy.run(() =>
        deleteUserRemote({ id }).updates(listUsersRemote({ page: 1, size: 25 }))
      )
      toast.success('Benutzer gelöscht.')
      formDirty.clear()
      goto('/settings/users', { replaceState: true })
    } catch (err) {
      handleClientError(err, 'Benutzer konnte nicht gelöscht werden')
    }
  }
</script>

<PageHeader title="Benutzer bearbeiten" back="/settings/users" />

<div class="flex flex-col gap-4">
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
        <legend class="fieldset-legend">Konto</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Benutzername</span>
            <input
              class="input input-bordered w-full"
              value={user.username}
              disabled
              readonly
            />
            <span class="label-text-alt text-base-content/60 mt-1 text-xs">
              Der Benutzername kann nicht geändert werden.
            </span>
          </label>
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Anzeigename *</span>
            <input
              class="input input-bordered w-full"
              maxlength="200"
              required
              autocomplete="off"
              bind:value={name}
            />
          </label>
        </div>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">Rollen</legend>
        <MultiSelect
          options={roleOptions}
          bind:selected={roleIds}
          placeholder="Rollen auswählen…"
          emptyHint="Noch keine Rollen vorhanden. Legen Sie zuerst eine Rolle an."
          onChange={markDirty}
        />
      </fieldset>

      <div class="card-actions justify-between gap-2">
        <button
          type="button"
          class="btn btn-error btn-outline gap-2"
          onclick={() => (confirmOpen = true)}
          disabled={busy.active}
        >
          <Trash2 size={16} /> Löschen
        </button>
        <div class="flex gap-2">
          <button
            type="button"
            class="btn btn-ghost"
            onclick={() => goto('/settings/users')}
            disabled={busy.active}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={busy.active || !name.trim()}
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

  <form
    onsubmit={submitPasswordReset}
    class="card border-base-300 bg-base-100 border"
  >
    <div class="card-body gap-4">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Passwort zurücksetzen</legend>
        <p class="text-base-content/60 text-sm">
          Setzt das Passwort des Benutzers auf den hier eingegebenen Wert
          zurück. Der Benutzer wird darüber nicht automatisch informiert.
        </p>
        {#if resetError}
          <div class="alert alert-error mt-2">
            <span>{resetError}</span>
          </div>
        {/if}
        <div class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Neues Passwort</span>
            <input
              class="input input-bordered w-full"
              type="password"
              minlength="8"
              maxlength="128"
              autocomplete="new-password"
              bind:value={resetPassword}
            />
          </label>
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Passwort wiederholen</span>
            <input
              class="input input-bordered w-full"
              type="password"
              minlength="8"
              maxlength="128"
              autocomplete="new-password"
              bind:value={resetPasswordConfirm}
            />
          </label>
        </div>
      </fieldset>

      <div class="card-actions justify-end">
        <button
          type="submit"
          class="btn btn-primary"
          disabled={busy.active ||
            resetPassword.length < 8 ||
            resetPassword !== resetPasswordConfirm}
        >
          {#if busy.active}
            <span class="loading loading-spinner loading-sm"></span>
          {/if}
          Passwort zurücksetzen
        </button>
      </div>
    </div>
  </form>
</div>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Benutzer löschen?"
  message={`Soll der Benutzer „${user.name}" wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={performDelete}
  onClose={() => (confirmOpen = false)}
/>
