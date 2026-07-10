<script lang="ts">
  /**
   * Mail template settings — its own top-level settings tab (formerly
   * an inner tab on /settings; old `?tab=mail` deep links redirect
   * here). One template is edited at a time; the select switches the
   * editor, save/reset go through the settings remotes.
   */
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import {
    listMailTemplatesRemote,
    resetMailTemplateRemote,
    updateMailTemplateRemote
  } from '../settings.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())

  // Never memoize the query proxy (CONTRIBUTING §5) — save/reset
  // refresh this query server-side and the editor must pick the fresh
  // value up without a reload.
  const templates = $derived.by(() => listMailTemplatesRemote().current ?? [])

  $effect(() => {
    const q = listMailTemplatesRemote()
    if (q.error) handleClientError(q.error)
  })

  let activeTemplateKey = $state<string | null>(null)
  let templateSubject = $state('')
  let templateBody = $state('')

  /** When templates load (or the active key changes), seed the editor. */
  $effect(() => {
    if (!templates.length) return
    if (!activeTemplateKey) activeTemplateKey = templates[0].key
    const tpl = templates.find((t) => t.key === activeTemplateKey)
    if (tpl) {
      templateSubject = tpl.subject
      templateBody = tpl.body
    }
  })

  const templateLabel = (key: string): string => {
    switch (key) {
      case 'invoice':
        return 'Rechnung'
      case 'cost_estimate':
        return 'Kostenvoranschlag'
      case 'offer':
        return 'Angebot'
      case 'order_confirmation':
        return 'Auftragsbestätigung'
      case 'reminder_1':
        return 'Zahlungserinnerung'
      case 'mailing':
        return 'Serienbrief'
      case 'appointment_confirmation':
        return 'Terminbestätigung'
      case 'tire_reminder':
        return 'Reifenwechsel-Erinnerung'
      default:
        return key
    }
  }

  const saveTemplate = async (e: Event) => {
    e.preventDefault()
    if (!activeTemplateKey) return
    try {
      formDirty.clear()
      await busy.run(() =>
        updateMailTemplateRemote({
          key: activeTemplateKey!,
          subject: templateSubject,
          body: templateBody
        })
      )
      toast.success('Mailvorlage gespeichert.')
    } catch (err) {
      handleClientError(err, 'Mailvorlage konnte nicht gespeichert werden')
    }
  }

  const resetTemplate = async () => {
    if (!activeTemplateKey) return
    try {
      await busy.run(() => resetMailTemplateRemote({ key: activeTemplateKey! }))
      // The list refresh feeds the effect which re-seeds the editor.
      toast.success('Mailvorlage zurückgesetzt.')
    } catch (err) {
      handleClientError(err, 'Vorlage konnte nicht zurückgesetzt werden')
    }
  }
</script>

<PageHeader title="Mailvorlagen" back="/settings" />

{#if templates.length > 0}
  <form
    onsubmit={saveTemplate}
    oninput={markDirty}
    onchange={markDirty}
    class="flex flex-col gap-4"
  >
    <fieldset class="fieldset">
      <legend class="fieldset-legend">Vorlage</legend>
      <select
        class="select select-bordered w-full"
        bind:value={activeTemplateKey}
      >
        {#each templates as tpl (tpl.key)}
          <option value={tpl.key}>
            {templateLabel(tpl.key)}{tpl.isCustom ? ' · angepasst' : ''}
          </option>
        {/each}
      </select>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Betreff</legend>
      <input
        class="input input-bordered w-full"
        maxlength="200"
        bind:value={templateSubject}
      />
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Nachricht</legend>
      <textarea
        class="textarea textarea-bordered min-h-64 w-full font-mono text-sm"
        maxlength="20000"
        bind:value={templateBody}
      ></textarea>
      <p class="text-base-content/60 mt-2 text-xs">
        Platzhalter: <code class="font-mono">{'{firma}'}</code>,
        <code class="font-mono">{'{firmaIban}'}</code>,
        <code class="font-mono">{'{firmaBic}'}</code>,
        <code class="font-mono">{'{firmaTelefon}'}</code>,
        <code class="font-mono">{'{firmaMail}'}</code>,
        <code class="font-mono">{'{rechnungNummer}'}</code>,
        <code class="font-mono">{'{rechnungDatum}'}</code>,
        <code class="font-mono">{'{rechnungBetragBrutto}'}</code>,
        <code class="font-mono">{'{rechnungOffenerBetrag}'}</code>,
        <code class="font-mono">{'{fälligkeitsDatum}'}</code>,
        <code class="font-mono">{'{angebotNummer}'}</code>,
        <code class="font-mono">{'{angebotGültigBis}'}</code>,
        <code class="font-mono">{'{fahrzeugTyp}'}</code>,
        <code class="font-mono">{'{fahrzeugKennzeichen}'}</code>,
        <code class="font-mono">{'{verzugstage}'}</code>,
        <code class="font-mono">{'{mahnungGebühr}'}</code>,
        <code class="font-mono">{'{mitarbeiterVorname}'}</code>,
        <code class="font-mono">{'{periode}'}</code>.
      </p>
    </fieldset>

    <div class="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        class="btn btn-ghost"
        disabled={busy.active}
        onclick={resetTemplate}
      >
        Auf Standard zurücksetzen
      </button>
      <button type="submit" class="btn btn-primary" disabled={busy.active}>
        Speichern
      </button>
    </div>
  </form>
{/if}
