<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import WorkOrderForm, {
    type WorkOrderFormValues
  } from '../WorkOrderForm.svelte'
  import { createWorkOrderRemote } from '../orders.remote'
  import { pickEmployeesRemote } from '../../pickers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  /**
   * The assignee checkbox list needs the employee roster up front —
   * first page, size 100 covers a small shop completely.
   */
  const employeesPage = await pickEmployeesRemote({ page: 1, size: 100 })

  const handleSave = async (values: WorkOrderFormValues) => {
    try {
      const created = await busy.run(() =>
        createWorkOrderRemote({
          title: values.title,
          description: values.description,
          customerId: values.customerId,
          vehicleId: values.vehicleId,
          scheduledDate: values.scheduledDate,
          scheduledTime: values.scheduledTime,
          assigneeIds: values.assigneeIds
        })
      )
      toast.success('Auftrag angelegt.')
      goto(`/orders/${created.id}`, { replaceState: true })
    } catch (err) {
      handleClientError(err, 'Auftrag konnte nicht angelegt werden')
    }
  }
</script>

<PageHeader title="Neuen Auftrag anlegen" back="/orders" />

<WorkOrderForm
  employees={employeesPage.items}
  onSave={handleSave}
  onCancel={() => goto('/orders')}
/>
