<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import EmployeeForm, { type EmployeeFormValues } from '../EmployeeForm.svelte'
  import { createEmployeeRemote } from '../employees.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'

  let busy = $state(false)
  const handleSave = async (values: EmployeeFormValues) => {
    busy = true
    try {
      const created = await createEmployeeRemote(values)
      toast.success('Mitarbeiter angelegt.')
      goto(`/employees/${created.id}`)
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }
</script>

<PageHeader title="Neuen Mitarbeiter anlegen" subtitle="Stammdaten erfassen." />
<EmployeeForm onSave={handleSave} onCancel={() => goto('/employees')} {busy} />
