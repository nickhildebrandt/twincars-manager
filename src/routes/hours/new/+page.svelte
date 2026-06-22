<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import HoursForm, { type HoursFormValues } from '../HoursForm.svelte'
  import {
    canReadAllHoursRemote,
    createTimeEntryRemote,
    currentEmployeeRemote
  } from '../hours.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const canReadAll = await canReadAllHoursRemote()
  const me = canReadAll ? null : await currentEmployeeRemote()

  const lockedEmployee = me
    ? {
        id: me.id,
        label: `${me.firstName} ${me.lastName} · ${me.personnelNumber}`
      }
    : null

  const handleSave = async (values: HoursFormValues) => {
    try {
      const created = await busy.run(() => createTimeEntryRemote(values))
      toast.success('Stundeneintrag erfasst.')
      goto(`/hours/${created.id}`, { replaceState: true })
    } catch (err) {
      handleClientError(err, 'Stundeneintrag konnte nicht gespeichert werden')
    }
  }
</script>

<PageHeader title="Stunden erfassen" back="/hours" />

<HoursForm
  {lockedEmployee}
  onSave={handleSave}
  onCancel={() => goto('/hours')}
/>
