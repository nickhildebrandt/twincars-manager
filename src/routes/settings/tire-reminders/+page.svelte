<script lang="ts">
  import { untrack } from 'svelte'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Send } from '@lucide/svelte'
  import {
    getTireReminderPreviewRemote,
    sendTireRemindersRemote
  } from '../tire-reminders.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  type Season = 'spring' | 'autumn'

  /**
   * Both preview queries run in parallel on first paint so the operator
   * sees the candidate counts for spring AND autumn side by side. We
   * read them again from `.current` after a send to reflect the freshly
   * logged customers; the initial top-level await seeds the SSR
   * payload.
   */
  const springQ = $derived(getTireReminderPreviewRemote({ season: 'spring' }))
  const autumnQ = $derived(getTireReminderPreviewRemote({ season: 'autumn' }))

  const [springInitial, autumnInitial] = await Promise.all([
    untrack(() => springQ),
    untrack(() => autumnQ)
  ])

  const spring = $derived(springQ.current ?? springInitial)
  const autumn = $derived(autumnQ.current ?? autumnInitial)

  let confirmSeason = $state<Season | null>(null)

  const labelFor = (s: Season): string =>
    s === 'spring' ? 'Sommerräder (Frühjahr)' : 'Winterräder (Herbst)'

  const previewFor = (s: Season) => (s === 'spring' ? spring : autumn)

  const triggerSend = async () => {
    if (!confirmSeason) return
    const season = confirmSeason
    try {
      const result = await busy.run(() => sendTireRemindersRemote({ season }))
      const failedCount = result.failed.length
      if (result.sent === 0 && failedCount === 0) {
        toast.success(
          'Keine offenen Erinnerungen — alle Kunden bereits informiert.'
        )
      } else if (failedCount === 0) {
        toast.success(`Erinnerungen versendet: ${result.sent}.`)
      } else {
        toast.success(
          `Versendet: ${result.sent}. Fehlgeschlagen: ${failedCount}.`
        )
      }
    } catch (err) {
      handleClientError(err, 'Erinnerungen konnten nicht versendet werden')
    }
  }

  const seasons: Season[] = ['spring', 'autumn']
</script>

<PageHeader title="Reifenwechsel-Erinnerungen" back="/settings" />

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
  {#each seasons as season (season)}
    {@const preview = previewFor(season)}
    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body gap-3">
        <h3 class="card-title text-base">{labelFor(season)}</h3>
        <p class="text-sm">
          {preview.count === 0
            ? 'Aktuell stehen keine Erinnerungen aus.'
            : preview.count === 1
              ? '1 Kunde mit eingelagerten Reifen würde benachrichtigt.'
              : `${preview.count} Kunden mit eingelagerten Reifen würden benachrichtigt.`}
        </p>
        {#if preview.sampleNames.length > 0}
          <ul class="text-base-content/70 list-disc pl-5 text-sm">
            {#each preview.sampleNames as name (name)}
              <li>{name}</li>
            {/each}
            {#if preview.count > preview.sampleNames.length}
              <li class="text-base-content/50">
                … und {preview.count - preview.sampleNames.length} weitere
              </li>
            {/if}
          </ul>
        {/if}
        <div class="card-actions justify-end">
          <button
            type="button"
            class="btn btn-primary btn-sm gap-1"
            disabled={busy.active || preview.count === 0}
            onclick={() => (confirmSeason = season)}
          >
            <Send size={14} />
            Jetzt senden
          </button>
        </div>
      </div>
    </div>
  {/each}
</div>

<ConfirmDialog
  open={confirmSeason !== null}
  title="Erinnerungen jetzt versenden?"
  message={confirmSeason
    ? `Es werden Erinnerungs-Mails für ${labelFor(confirmSeason)} an alle vorgemerkten Kunden versendet. Bereits informierte Kunden werden übersprungen.`
    : ''}
  confirmLabel="Jetzt senden"
  variant="primary"
  onConfirm={triggerSend}
  onClose={() => (confirmSeason = null)}
/>
