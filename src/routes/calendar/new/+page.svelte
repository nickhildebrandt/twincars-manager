<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import CalendarForm, { type CalendarFormValues } from '../CalendarForm.svelte'
  import { Users2, ArrowRight, ClipboardList } from '@lucide/svelte'
  import { createCalendarEntryRemote } from '../calendar.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  /**
   * The whole form (kind selector, appointment/closure branches and
   * the overlap-confirm flow) lives in the shared `CalendarForm`; this
   * page only performs the create call and navigates back.
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

<!-- Hint card: workshop jobs belong into the orders module, not here. -->
<div class="alert alert-info alert-vertical sm:alert-horizontal mb-4">
  <ClipboardList size={20} />
  <div>
    <div class="font-medium">Werkstattarbeit geplant?</div>
    <div class="text-sm">
      Werkstattaufträge werden als Auftrag angelegt. Geplante Aufträge
      erscheinen automatisch im Kalender und erzeugen beim Abschluss die
      Rechnung.
    </div>
  </div>
  <a class="btn btn-sm gap-1" href="/orders/new">
    Neuer Auftrag
    <ArrowRight size={14} />
  </a>
</div>

<CalendarForm mode="new" onSave={save} onCancel={() => goto('/calendar')} />

<!-- Hint card linking to the employees module for vacation / sick days. -->
<div class="alert alert-info alert-vertical sm:alert-horizontal mt-4">
  <Users2 size={20} />
  <div>
    <div class="font-medium">Urlaub oder Krankheit eintragen?</div>
    <div class="text-sm">
      Mitarbeiter-Abwesenheiten werden direkt im Mitarbeiter-Datenblatt gepflegt
      und erscheinen anschließend automatisch im Kalender.
    </div>
  </div>
  <a class="btn btn-sm gap-1" href="/employees">
    Zu den Mitarbeitern
    <ArrowRight size={14} />
  </a>
</div>
