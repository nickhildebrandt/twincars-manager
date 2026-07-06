<script lang="ts">
  import { goto } from '$app/navigation'
  import { Info } from '@lucide/svelte'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import EmployeeForm, { type EmployeeFormValues } from '../EmployeeForm.svelte'
  import { createEmployeeRemote } from '../employees.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { creationFlow } from '$lib/stores/creation-flow.svelte'

  /**
   * Flow-leaf mode: another form started a full-page employee creation
   * (creation-flow stack top is 'employee'). Saving then returns to the
   * origin page with the new employee auto-selected; cancelling returns
   * with the origin draft only.
   */
  const inFlow = $derived(creationFlow.top?.entity === 'employee')

  /** Mirrors the label format of `pickEmployeesRemote`. */
  const employeeLabel = (e: {
    firstName: string
    lastName: string
    personnelNumber: string
  }) => `${e.firstName} ${e.lastName} · ${e.personnelNumber}`

  const handleSave = async (values: EmployeeFormValues) => {
    try {
      const created = await busy.run(() => createEmployeeRemote(values))
      toast.success('Mitarbeiter angelegt.')
      if (creationFlow.top?.entity === 'employee') {
        const returnUrl = creationFlow.finish({
          id: created.id,
          label: employeeLabel(created)
        })
        goto(returnUrl ?? `/employees/${created.id}`, { replaceState: true })
        return
      }
      goto(`/employees/${created.id}`, { replaceState: true })
    } catch (err) {
      handleClientError(err)
    }
  }

  const handleCancel = () => {
    if (creationFlow.top?.entity === 'employee') {
      const returnUrl = creationFlow.cancel()
      goto(returnUrl ?? '/employees')
      return
    }
    goto('/employees')
  }
</script>

<PageHeader title="Neuen Mitarbeiter anlegen" subtitle="Stammdaten erfassen." />
{#if inFlow}
  <div class="alert alert-info mb-4">
    <Info size={16} />
    <span>
      Dieser Mitarbeiter wird nach dem Speichern automatisch im vorherigen
      Formular ausgewählt.
    </span>
  </div>
{/if}
<EmployeeForm onSave={handleSave} onCancel={handleCancel} />
