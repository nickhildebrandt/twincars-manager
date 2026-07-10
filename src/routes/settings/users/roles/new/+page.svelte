<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import RoleForm, { type RoleFormValues } from '../RoleForm.svelte'
  import { createRoleRemote, listRolesRemote } from '../../users.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  const handleSave = async (values: RoleFormValues) => {
    try {
      await busy.run(() => createRoleRemote(values).updates(listRolesRemote()))
      // Saved — release the unsaved-changes guard before the goto
      // (§11: clear AFTER success, BEFORE navigating; the catch path
      // leaves the form dirty so cancel/navigation still warns).
      formDirty.clear()
      toast.success('Rolle angelegt.')
      goto('/settings/users?tab=roles', { replaceState: true })
    } catch (err) {
      handleClientError(err, 'Rolle konnte nicht angelegt werden')
    }
  }
</script>

<PageHeader title="Neue Rolle anlegen" back="/settings/users?tab=roles" />

<RoleForm
  onSave={handleSave}
  onCancel={() => goto('/settings/users?tab=roles')}
/>
