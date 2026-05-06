<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import EmployeeForm, { type EmployeeFormValues } from '../EmployeeForm.svelte'
  import { createEmployeeRemote } from '../employees.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const handleSave = async (values: EmployeeFormValues) => {
    try {
      const created = await busy.run(() => createEmployeeRemote(values))
      toast.success('Mitarbeiter angelegt.')
      goto(`/employees/${created.id}`, { replaceState: true })
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader title="Neuen Mitarbeiter anlegen" subtitle="Stammdaten erfassen." />
<EmployeeForm onSave={handleSave} onCancel={() => goto('/employees')} />
