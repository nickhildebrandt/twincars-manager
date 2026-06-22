<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { error } from '@sveltejs/kit'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import RoleForm, { type RoleFormValues } from '../../RoleForm.svelte'
  import {
    deleteRoleRemote,
    listRolesRemote,
    updateRoleRemote
  } from '../../../users.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  const ADMIN_ROLE_NAME = 'Administrator'

  const id = untrack(() => page.params.id!)

  /**
   * There is no `getRoleRemote` — the role set is tiny (a handful of
   * rows) so we resolve the target by filtering the full list. The
   * dehydrated cache is shared with the list page so this round-trip
   * happens at most once.
   */
  const roles = await listRolesRemote()
  const role = roles.find((r) => r.id === id)
  if (!role) error(404, 'Rolle nicht gefunden.')

  const locked = role.name === ADMIN_ROLE_NAME

  let confirmOpen = $state(false)

  const handleSave = async (values: RoleFormValues) => {
    try {
      formDirty.clear()
      await busy.run(() =>
        updateRoleRemote({ id, ...values }).updates(listRolesRemote())
      )
      toast.success('Rolle gespeichert.')
      goto('/settings/users?tab=roles')
    } catch (err) {
      handleClientError(err, 'Rolle konnte nicht gespeichert werden')
    }
  }

  const performDelete = async () => {
    try {
      await busy.run(() => deleteRoleRemote({ id }).updates(listRolesRemote()))
      toast.success('Rolle gelöscht.')
      formDirty.clear()
      goto('/settings/users?tab=roles', { replaceState: true })
    } catch (err) {
      handleClientError(err, 'Rolle konnte nicht gelöscht werden')
    }
  }
</script>

<PageHeader title="Rolle bearbeiten" back="/settings/users?tab=roles" />

<RoleForm
  initial={role}
  {locked}
  onSave={handleSave}
  onCancel={() => goto('/settings/users?tab=roles')}
  onDelete={locked ? undefined : () => (confirmOpen = true)}
/>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Rolle löschen?"
  message={`Soll die Rolle „${role.name}" wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={performDelete}
  onClose={() => (confirmOpen = false)}
/>
