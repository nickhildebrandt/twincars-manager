<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import MultiSelect from '$lib/components/ui/MultiSelect.svelte'
  import {
    createUserRemote,
    listRolesRemote,
    listUsersRemote
  } from '../users.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  /** Roles are loaded server-side so the SSR render already carries them. */
  const roles = await untrack(() => listRolesRemote())

  let username = $state('')
  let name = $state('')
  let password = $state('')
  let passwordConfirm = $state('')
  let roleIds = $state<string[]>([])

  let errorMsg = $state<string | null>(null)

  /** Submit button validity gate — mirrors the rules in `submit`. */
  const valid = $derived.by(() => {
    if (username.trim().length < 3) return false
    if (!name.trim()) return false
    if (password.length < 8) return false
    if (password !== passwordConfirm) return false
    return true
  })

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())

  /**
   * Map roles → MultiSelect option shape. The role description (if
   * present) becomes the option's sublabel so the picker carries the
   * same context the legacy checkbox grid used to show.
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
    const trimmedUsername = username.trim()
    const trimmedName = name.trim()
    if (trimmedUsername.length < 3) {
      errorMsg = 'Benutzername zu kurz (mind. 3 Zeichen).'
      return
    }
    if (!trimmedName) {
      errorMsg = 'Bitte einen Anzeigenamen angeben.'
      return
    }
    if (password.length < 8) {
      errorMsg = 'Passwort zu kurz (mind. 8 Zeichen).'
      return
    }
    if (password !== passwordConfirm) {
      errorMsg = 'Passwörter stimmen nicht überein.'
      return
    }
    try {
      formDirty.clear()
      await busy.run(() =>
        createUserRemote({
          username: trimmedUsername,
          name: trimmedName,
          password,
          roleIds
        }).updates(listUsersRemote({ page: 1, size: 25 }))
      )
      toast.success('Benutzer angelegt.')
      goto('/settings/users', { replaceState: true })
    } catch (err) {
      handleClientError(err, 'Benutzer konnte nicht angelegt werden')
    }
  }
</script>

<PageHeader title="Neuen Benutzer anlegen" back="/settings/users" />

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
          <span class="label-text">Benutzername *</span>
          <input
            class="input input-bordered w-full"
            maxlength="64"
            minlength="3"
            required
            autocomplete="off"
            bind:value={username}
          />
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
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Passwort *</span>
          <input
            class="input input-bordered w-full"
            type="password"
            minlength="8"
            maxlength="128"
            required
            autocomplete="new-password"
            bind:value={password}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Passwort bestätigen *</span>
          <input
            class="input input-bordered w-full"
            type="password"
            minlength="8"
            maxlength="128"
            required
            autocomplete="new-password"
            bind:value={passwordConfirm}
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

    <div class="card-actions justify-end gap-2">
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
