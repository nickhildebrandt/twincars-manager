<script lang="ts">
  /**
   * Payment reminder settings — its own top-level settings tab
   * (formerly an inner tab on /settings; old `?tab=reminders` deep
   * links redirect here). One friendly "Zahlungserinnerung" that
   * repeats every N days; the inline template edits the single
   * `reminder_1` mail template so the operator gets a single
   * "Speichern" experience.
   */
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import {
    getAllSettingsRemote,
    listMailTemplatesRemote,
    resetMailTemplateRemote,
    updateMailTemplateRemote,
    updateReminderSettingsRemote
  } from '../settings.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())

  // Never memoize the query proxy (CONTRIBUTING §5) — the save command
  // refreshes this query server-side.
  const data = $derived.by(() => getAllSettingsRemote().current)

  $effect(() => {
    const q = getAllSettingsRemote()
    if (q.error) handleClientError(q.error)
  })

  const templates = $derived.by(() => listMailTemplatesRemote().current ?? [])

  // Zahlungserinnerung fields — single friendly template that repeats
  // every N days; keine Eskalation, keine Mahngebühr, keine
  // Verzugszinsen.
  let reminderAutoEnabled = $state(true)
  let smallBusinessExempt = $state(false)
  let reminderDays1 = $state(3)
  let reminderRecurEveryDays = $state(14)
  let reminderTemplateSubject = $state('')
  let reminderTemplateBody = $state('')

  let initialised = $state(false)
  $effect(() => {
    if (!data || initialised) return
    reminderAutoEnabled = data.company.reminderAutoEnabled
    smallBusinessExempt = data.company.smallBusinessExempt
    reminderDays1 = data.company.reminderDays1
    reminderRecurEveryDays = data.company.reminderRecurEveryDays
    initialised = true
  })

  // Hydrate the inline template from the mail templates list as soon
  // as it arrives. Runs once — subsequent edits stay user-driven so we
  // don't fight typing.
  let reminderTemplateInitialised = $state(false)
  $effect(() => {
    if (reminderTemplateInitialised || !templates.length) return
    const tpl = templates.find((t) => t.key === 'reminder_1')
    if (tpl) {
      reminderTemplateSubject = tpl.subject
      reminderTemplateBody = tpl.body
      reminderTemplateInitialised = true
    }
  })

  const saveReminders = async (e: Event) => {
    e.preventDefault()
    try {
      await busy.run(async () => {
        await updateReminderSettingsRemote({
          reminderAutoEnabled,
          smallBusinessExempt,
          reminderDays1,
          reminderRecurEveryDays
        })
        // Persist the inline template edits alongside the settings so
        // the operator gets a single "Speichern" experience.
        await updateMailTemplateRemote({
          key: 'reminder_1',
          subject: reminderTemplateSubject,
          body: reminderTemplateBody
        })
      })
      // Success — clear only now; a failure keeps the form dirty (§11).
      formDirty.clear()
      toast.success('Einstellungen für Zahlungserinnerungen gespeichert.')
    } catch (err) {
      handleClientError(err)
    }
  }

  const resetReminderTemplate = async () => {
    try {
      await busy.run(() => resetMailTemplateRemote({ key: 'reminder_1' }))
      reminderTemplateInitialised = false
      toast.success('Vorlage zurückgesetzt.')
    } catch (err) {
      handleClientError(err, 'Vorlage konnte nicht zurückgesetzt werden')
    }
  }
</script>

<PageHeader title="Zahlungserinnerung" back="/settings" />

<form
  onsubmit={saveReminders}
  oninput={markDirty}
  onchange={markDirty}
  class="flex flex-col gap-4"
>
  <div class="alert alert-info">
    <span class="text-sm">
      Es gibt nur eine einzige freundliche „Zahlungserinnerung", keine
      Mahnstufen, keine Mahngebühr, keine Verzugszinsen. Sie wird ab dem
      konfigurierten Tag nach Fälligkeit versendet und so lange in regelmäßigen
      Abständen wiederholt, bis die Rechnung bezahlt ist.
    </span>
  </div>

  <fieldset class="fieldset">
    <legend class="fieldset-legend">Allgemein</legend>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="label cursor-pointer justify-start gap-3 whitespace-normal">
        <input
          type="checkbox"
          class="toggle toggle-primary"
          bind:checked={reminderAutoEnabled}
        />
        <span>Zahlungserinnerungen automatisch versenden</span>
      </label>
      <label class="label cursor-pointer justify-start gap-3 whitespace-normal">
        <input
          type="checkbox"
          class="toggle toggle-primary"
          bind:checked={smallBusinessExempt}
        />
        <span>Kleinunternehmer (§ 19 UStG)</span>
      </label>
    </div>
  </fieldset>

  <fieldset class="fieldset">
    <legend class="fieldset-legend">Zeitplan</legend>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="flex w-full flex-col gap-1">
        <span class="label-text"
          >Erste Erinnerung nach (Tagen nach Fälligkeit)</span
        >
        <input
          class="input input-bordered w-full"
          type="number"
          min="0"
          max="365"
          step="1"
          bind:value={reminderDays1}
        />
      </label>
      <label class="flex w-full flex-col gap-1">
        <span class="label-text">Folge-Erinnerung alle (Tage)</span>
        <input
          class="input input-bordered w-full"
          type="number"
          min="1"
          max="365"
          step="1"
          bind:value={reminderRecurEveryDays}
        />
        <span class="label-text-alt text-base-content/60 mt-1 text-xs">
          Solange die Rechnung offen ist, wird die Zahlungserinnerung alle {reminderRecurEveryDays}
          Tage erneut versendet.
        </span>
      </label>
    </div>
  </fieldset>

  <fieldset class="fieldset">
    <legend class="fieldset-legend">Vorlagentext</legend>
    <label class="flex w-full flex-col gap-1">
      <span class="label-text">Betreff</span>
      <input
        class="input input-bordered w-full"
        maxlength="200"
        bind:value={reminderTemplateSubject}
      />
    </label>
    <label class="mt-2 flex w-full flex-col gap-1">
      <span class="label-text">Nachricht</span>
      <textarea
        class="textarea textarea-bordered w-full"
        rows="10"
        bind:value={reminderTemplateBody}
      ></textarea>
      <span class="label-text-alt text-base-content/60 mt-1 text-xs">
        Verfügbare Platzhalter: {'{firma}'}, {'{rechnungNummer}'},
        {'{rechnungDatum}'}, {'{rechnungOffenerBetrag}'},
        {'{verzugstage}'}, {'{fälligkeitsDatum}'}.
      </span>
    </label>
    <div class="mt-2 flex justify-end">
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        disabled={busy.active}
        onclick={resetReminderTemplate}
      >
        Auf Standard zurücksetzen
      </button>
    </div>
  </fieldset>

  <div class="flex justify-end">
    <button type="submit" class="btn btn-primary" disabled={busy.active}>
      Speichern
    </button>
  </div>
</form>
