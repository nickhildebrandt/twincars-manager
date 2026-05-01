<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import EmployeeForm, {
    type EmployeeFormValues
  } from '../../EmployeeForm.svelte'
  import {
    getEmployeeRemote,
    updateEmployeeRemote
  } from '../../employees.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the form values, hydration reuses cache. */
  const e = await getEmployeeRemote({ id })

  let busy = $state(false)

  const handleSave = async (values: EmployeeFormValues) => {
    busy = true
    try {
      await updateEmployeeRemote({ id, values })
      toast.success('Mitarbeiter gespeichert.')
      goto(`/employees/${id}`)
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="Mitarbeiter bearbeiten" subtitle={e.personnelNumber ?? ''} />

<EmployeeForm
  initial={e as never}
  onSave={handleSave}
  onCancel={() => goto(`/employees/${e.id}`)}
  {busy}
/>
