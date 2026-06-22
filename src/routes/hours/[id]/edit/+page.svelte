<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import HoursForm, { type HoursFormValues } from '../../HoursForm.svelte'
  import {
    canReadAllHoursRemote,
    currentEmployeeRemote,
    getTimeEntryRemote,
    updateTimeEntryRemote
  } from '../../hours.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const id = untrack(() => page.params.id!)
  const e = await getTimeEntryRemote({ id })
  const canReadAll = await canReadAllHoursRemote()
  const me = canReadAll ? null : await currentEmployeeRemote()

  const lockedEmployee = me
    ? {
        id: me.id,
        label: `${me.firstName} ${me.lastName} · ${me.personnelNumber}`
      }
    : null

  const initial = {
    employeeId: e.employeeId,
    employeeLabel:
      `${e.employeeFirstName} ${e.employeeLastName}`.trim() || e.employeeNumber,
    date: e.date,
    hours: Number(e.hours),
    documentId: e.documentId ?? null,
    documentLabel: e.documentNumber ?? null,
    customerId: e.customerId ?? null,
    customerLabel: e.customerName ?? null,
    task: e.task ?? null,
    note: e.note ?? null
  }

  const handleSave = async (values: HoursFormValues) => {
    try {
      await busy.run(() => updateTimeEntryRemote({ id, values }))
      toast.success('Stundeneintrag gespeichert.')
      goto(`/hours/${id}`)
    } catch (err) {
      handleClientError(err, 'Stundeneintrag konnte nicht gespeichert werden')
    }
  }
</script>

<PageHeader title="Stundeneintrag bearbeiten" back={`/hours/${id}`} />

<HoursForm
  {initial}
  {lockedEmployee}
  onSave={handleSave}
  onCancel={() => goto(`/hours/${id}`)}
/>
