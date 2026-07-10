<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import CalendarForm, { type CalendarFormValues } from '../CalendarForm.svelte'
  import { createCalendarEntryRemote } from '../calendar.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  /**
   * The whole form (kind selector, appointment/closure branches, the
   * overlap-confirm flow and the separated cross-module cards for
   * orders / employee absences) lives in the shared `CalendarForm`;
   * this page only performs the create call and navigates back.
   */
  const save = async (values: CalendarFormValues) => {
    try {
      await busy.run(() => createCalendarEntryRemote(values))
      toast.success(
        values.kind === 'appointment'
          ? 'Termin angelegt.'
          : 'Betriebsschließung angelegt.'
      )
      goto('/calendar')
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader title="Neuer Eintrag" back="/calendar" />

<CalendarForm mode="new" onSave={save} onCancel={() => goto('/calendar')} />
