<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import WorkOrderForm, {
    type WorkOrderFormValues
  } from '../../WorkOrderForm.svelte'
  import {
    getWorkOrderRemote,
    updateWorkOrderRemote
  } from '../../orders.remote'
  import { pickEmployeesRemote } from '../../../pickers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the form values, hydration reuses cache. */
  const [detail, employeesPage] = await Promise.all([
    getWorkOrderRemote({ id }),
    pickEmployeesRemote({ page: 1, size: 100 })
  ])

  const handleSave = async (values: WorkOrderFormValues) => {
    try {
      await busy.run(() =>
        updateWorkOrderRemote({
          id,
          values: {
            title: values.title,
            description: values.description ?? null,
            customerId: values.customerId ?? null,
            vehicleId: values.vehicleId ?? null,
            scheduledAt: values.scheduledAt ?? null,
            assigneeIds: values.assigneeIds
          }
        })
      )
      toast.success('Auftrag gespeichert.')
      goto(`/orders/${id}`)
    } catch (err) {
      handleClientError(err, 'Auftrag konnte nicht gespeichert werden')
    }
  }
</script>

<PageHeader
  title="Auftrag bearbeiten"
  subtitle={detail.order.orderNumber}
  back={`/orders/${id}`}
/>

<WorkOrderForm
  initial={{
    title: detail.order.title,
    description: detail.order.description,
    customerId: detail.order.customerId,
    customerLabel: detail.customerLabel,
    vehicleId: detail.order.vehicleId,
    vehicleLabel: detail.vehicleLabel,
    scheduledAt: detail.order.scheduledAt,
    assigneeIds: detail.assignees.map((a) => a.id)
  }}
  employees={employeesPage.items}
  onSave={handleSave}
  onCancel={() => goto(`/orders/${id}`)}
/>
